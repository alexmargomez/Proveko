import {
  type EncryptedConnectionEnvelope,
  EnvelopeCryptoVault,
  type PlainDatabaseCredentials,
} from '@proveko/crypto-vault';
import { TenantContextStorage } from '@proveko/service-guard';
import type { ServiceKey, TenantTier } from '@proveko/shared-kernel';
import { SERVICE_SCHEMA_MAP } from './pg-schemas.js';

export interface TenantSqlClient {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
  release(): void;
}

export interface TenantConnectionPool {
  readonly maxConnections: number;
  connect(): Promise<TenantSqlClient>;
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[] }>;
  end(): Promise<void>;
}

export type PoolFactoryFn = (
  credentials: PlainDatabaseCredentials,
  maxConnections: number,
) => TenantConnectionPool;

export interface RoutingEnvelopeProviderPort {
  getEncryptedEnvelope(tenantId: string, cellId: string): Promise<EncryptedConnectionEnvelope>;
}

/**
 * Wrapper con Reference Counting (`activeQueries`) y Graceful Drain [P1-02]
 * Impide que la expulsión de la caché LRU cierre un pool mientras hay una consulta en vuelo.
 */
export class ManagedTenantPool {
  private activeQueries = 0;
  private isDraining = false;
  private closed = false;
  private drainResolvers: Array<() => void> = [];

  constructor(
    public readonly tenantId: string,
    public readonly cellId: string,
    public readonly pool: TenantConnectionPool,
  ) {}

  public getActiveQueriesCount(): number {
    return this.activeQueries;
  }

  public isClosed(): boolean {
    return this.closed;
  }

  public async acquireAndRun<T>(fn: (pool: TenantConnectionPool) => Promise<T>): Promise<T> {
    if (this.closed) {
      throw new Error(`ManagedTenantPool for tenant "${this.tenantId}" is already closed.`);
    }
    this.activeQueries += 1;
    try {
      return await fn(this.pool);
    } finally {
      this.activeQueries -= 1;
      if (this.isDraining && this.activeQueries === 0) {
        await this.finalizeClose();
      }
    }
  }

  public async initiateGracefulDrain(): Promise<void> {
    if (this.closed) return;
    this.isDraining = true;
    if (this.activeQueries === 0) {
      await this.finalizeClose();
      return;
    }
    await new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  private async finalizeClose(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.pool.end();
    for (const resolve of this.drainResolvers) {
      resolve();
    }
    this.drainResolvers = [];
  }
}

export interface TenantPoolManagerOptions {
  maxActiveTenantPools?: number;
}

/**
 * Gestor de Micro-Pools Multi-Tenant con Presupuesto de Sockets, Single-Flight y Graceful Drain [P1-02]
 */
export class TenantConnectionPoolManager {
  private readonly maxActivePools: number;
  private readonly lruMap = new Map<string, ManagedTenantPool>();
  private readonly inFlightResolutions = new Map<string, Promise<ManagedTenantPool>>();
  private readonly drainingPools = new Set<Promise<void>>();

  constructor(
    private readonly cryptoVault: EnvelopeCryptoVault,
    private readonly envelopeProvider: RoutingEnvelopeProviderPort,
    private readonly poolFactory: PoolFactoryFn,
    options?: TenantPoolManagerOptions,
  ) {
    this.maxActivePools = options?.maxActiveTenantPools ?? 64;
  }

  public getActivePoolCount(): number {
    return this.lruMap.size;
  }

  private computeMaxConnectionsForTier(tier: TenantTier): number {
    if (tier === 'enterprise') return 4;
    if (tier === 'business') return 3;
    return 2; // Presupuesto estricto de micro-pool por pod
  }

  /**
   * Resuelve el pool tomando tenantId y cellId EXCLUSIVAMENTE del AsyncLocalStorage firmado [P1-05]
   */
  public async resolveCurrentTenantPool(): Promise<ManagedTenantPool> {
    const ctx = TenantContextStorage.getRequiredContext();
    return this.getOrCreatePool(ctx.tenantId, ctx.cellId, ctx.tier);
  }

  public async getOrCreatePool(
    tenantId: string,
    cellId: string,
    tier: TenantTier = 'basic',
  ): Promise<ManagedTenantPool> {
    const existing = this.lruMap.get(tenantId);
    if (existing && !existing.isClosed()) {
      // Refrescar orden LRU
      this.lruMap.delete(tenantId);
      this.lruMap.set(tenantId, existing);
      return existing;
    }

    // Deduplicación Single-Flight para impedir Cache Stampede (Thundering Herd)
    const inFlight = this.inFlightResolutions.get(tenantId);
    if (inFlight) {
      return inFlight;
    }

    const creationPromise = this.createPoolInternal(tenantId, cellId, tier).finally(() => {
      this.inFlightResolutions.delete(tenantId);
    });

    this.inFlightResolutions.set(tenantId, creationPromise);
    return creationPromise;
  }

  private async createPoolInternal(
    tenantId: string,
    cellId: string,
    tier: TenantTier,
  ): Promise<ManagedTenantPool> {
    // Si alcanzamos el tope de pools activos en el pod, expulsar el menos usado con Graceful Drain
    if (this.lruMap.size >= this.maxActivePools) {
      const oldestKey = this.lruMap.keys().next().value;
      if (oldestKey) {
        const evicted = this.lruMap.get(oldestKey);
        this.lruMap.delete(oldestKey);
        if (evicted) {
          const drainPromise = evicted.initiateGracefulDrain();
          this.drainingPools.add(drainPromise);
          void drainPromise.finally(() => this.drainingPools.delete(drainPromise));
        }
      }
    }

    // 1. Obtener sobre cifrado (EncryptedConnectionEnvelope)
    const envelope = await this.envelopeProvider.getEncryptedEnvelope(tenantId, cellId);

    // 2. Desenvolver DEK y descifrar credenciales exclusivamente en la RAM privada V8
    const credentials = this.cryptoVault.unsealDatabaseCredentials(envelope, tenantId, cellId);

    // 3. Instanciar micro-pool apuntando al poolerPort (PgBouncer)
    const maxConn = this.computeMaxConnectionsForTier(tier);
    const rawPool = this.poolFactory(credentials, maxConn);
    const managed = new ManagedTenantPool(tenantId, cellId, rawPool);

    this.lruMap.set(tenantId, managed);
    return managed;
  }

  /**
   * Ejecuta una lectura directa sin abrir transacción innecesaria (confiando en pgSchema('srv_*') [P1-01])
   */
  public async executeReadQuery<R = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<R[]> {
    const managed = await this.resolveCurrentTenantPool();
    return managed.acquireAndRun(async (pool) => {
      const res = await pool.query<R>(sql, params);
      return res.rows;
    });
  }

  /**
   * Ejecuta una transacción de escritura fijando explícitamente `SET LOCAL search_path TO srv_<servicio>, public`
   * dentro de un bloque BEGIN ... COMMIT seguro para PgBouncer transaction pooling [P1-01]
   */
  public async executeInServiceTransaction<T>(
    serviceKey: ServiceKey,
    fn: (client: TenantSqlClient) => Promise<T>,
  ): Promise<T> {
    const schemaName = SERVICE_SCHEMA_MAP[serviceKey];
    const managed = await this.resolveCurrentTenantPool();

    return managed.acquireAndRun(async (pool) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL search_path TO ${schemaName}, public`);
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    });
  }

  /**
   * Drenaje limpio en apagado de contenedor Kubernetes (SIGTERM / OnApplicationShutdown)
   */
  public async drainAll(): Promise<void> {
    const activeDrains: Promise<void>[] = [];
    for (const [tenantId, managed] of this.lruMap.entries()) {
      this.lruMap.delete(tenantId);
      activeDrains.push(managed.initiateGracefulDrain());
    }
    await Promise.all([...activeDrains, ...this.drainingPools]);
  }
}
