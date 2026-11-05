import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type MicroserviceKey,
  type ModuleKey,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
  type ParentMicroserviceKey,
  SEED_INDUSTRY_PRESETS,
  type ServiceKey,
} from '@proveko/shared-kernel';
import {
  computeMigrationChecksumSha256,
  type FileBasedMigrationEngine,
  type MigrationDatabaseDriverPort,
  type MultiDatabaseFleetMigrationReport,
  type MultiDatabaseMigrationOrchestrator,
  type TenantMigrationTarget,
} from './file-migration.engine.js';

export interface RegisteredClientDatabaseRecord {
  readonly tenantId: string;
  readonly cellId: string;
  readonly slug: string;
  readonly legalName: string;
  readonly dbName: string;
  readonly isTrialVersionDb: boolean;
  readonly status: 'ACTIVE' | 'SUSPENDED';
  readonly activeServices: Partial<Record<ServiceKey, MicroserviceKey[]>>;
  readonly createdAtIso: string;
}

export interface StartupBootstrapReport {
  readonly coreDbName: string;
  readonly coreDbSkippedOldMigrations: string[];
  readonly coreDbAppliedNewMigrations: string[];
  readonly trialDbName: string;
  readonly trialDbCreatedOnStartup: boolean;
  readonly registeredDatabasesInCoreDb: string[];
  readonly tenantFleetMigrationReport: MultiDatabaseFleetMigrationReport;
}

/**
 * Orquestador de Ciclo de Vida de Bases de Datos (`coreDB` + `db_version_prueba` + Bases de Clientes Dinámicas):
 *
 * 1. **Al inicio del sistema (Día 0, sin clientes aún):**
 *    - Ejecuta las migraciones de la Base Principal (`proveko_control_db` / `coreDB`), donde vive la tabla
 *      `control_plane.tenants` (que es la lista maestra de clientes y a su vez la lista de todas las BDs).
 *    - Si aún no existe la base de prueba inicial, crea y migra únicamente `db_version_prueba` y la registra
 *      en `proveko_control_db`.
 * 2. **Cuando se registra un nuevo cliente (`registerAndMigrateNewClientDatabase`):**
 *    - Crea en caliente la nueva BD del cliente (`db_tenant_<slug>`), corre todas las migraciones `.sql`
 *      vigentes de sus módulos contratados sobre esa nueva BD, y la agrega a la lista de clientes/BDs en `proveko_control_db`.
 * 3. **En reinicios o despliegues posteriores (`Git Pull & Restart` con nuevas migraciones `0002_*.sql`):**
 *    - Consulta en `proveko_control_db` la lista real de bases de datos registradas (`db_version_prueba` + todas
 *      las `db_tenant_*` de clientes) y aplica únicamente las migraciones nuevas pendientes.
 */
export class SystemStartupBootstrapper {
  public static readonly DEFAULT_CORE_DB_NAME = 'proveko_control_db';
  public static readonly DEFAULT_TRIAL_DB_NAME = 'db_version_prueba';

  private readonly coreDbRegistry = new Map<string, RegisteredClientDatabaseRecord>();

  constructor(
    private readonly migrationDriver: MigrationDatabaseDriverPort,
    private readonly migrationEngine: FileBasedMigrationEngine,
    private readonly fleetOrchestrator: MultiDatabaseMigrationOrchestrator,
    private readonly coreDbName: string = SystemStartupBootstrapper.DEFAULT_CORE_DB_NAME,
    private readonly trialDbName: string = SystemStartupBootstrapper.DEFAULT_TRIAL_DB_NAME,
  ) {}

  /**
   * Lee la lista maestra de clientes y sus bases de datos (`db_name`) almacenada en `proveko_control_db` (`coreDB`).
   */
  public listRegisteredDatabasesFromCoreDb(): RegisteredClientDatabaseRecord[] {
    return Array.from(this.coreDbRegistry.values());
  }

  /**
   * Paso 1: Se ejecuta al arrancar el sistema (Boot / Deploy).
   * - Migra primero `proveko_control_db` (`coreDB`).
   * - Si es el arranque inicial, aprovisiona y migra únicamente `db_version_prueba`.
   * - Si ya hay clientes registrados en `proveko_control_db`, aplica cualquier migración `.sql` nueva a `db_version_prueba` y a todas las BDs de clientes de la lista.
   */
  public async bootstrapOnSystemStartup(
    controlPlaneMigrationsDir: string,
  ): Promise<StartupBootstrapReport> {
    // 1. Migrar la Base Principal (`proveko_control_db` / `coreDB`) donde vive la tabla `tenants` (lista de clientes y BDs)
    const coreMigrationResult = await this.migrateCoreControlDatabase(controlPlaneMigrationsDir);

    // 2. Garantizar que exista en `proveko_control_db` la base de datos inicial `db_version_prueba`
    let trialDbCreatedOnStartup = false;
    if (!this.coreDbRegistry.has(this.trialDbName)) {
      trialDbCreatedOnStartup = true;
      const defaultPreset = SEED_INDUSTRY_PRESETS[0]!;
      const activeServices: Partial<Record<ServiceKey, MicroserviceKey[]>> = {};
      for (const srvKey of defaultPreset.services) {
        activeServices[srvKey] = defaultPreset.microservices.filter((msKey) =>
          msKey.startsWith(`ms:${srvKey.slice(4)}-`),
        );
      }

      this.coreDbRegistry.set(this.trialDbName, {
        tenantId: 'tnt-version-prueba',
        cellId: 'cell-db-01',
        slug: 'version-prueba',
        legalName: 'Proveko — Versión de Prueba / Demo',
        dbName: this.trialDbName,
        isTrialVersionDb: true,
        status: 'ACTIVE',
        activeServices,
        createdAtIso: new Date().toISOString(),
      });
    }

    // 3. Tomar de `proveko_control_db` la lista actual de BDs activas (al inicio solo `db_version_prueba`;
    //    después incluirá todos los clientes que se hayan registrado) y ejecutar sus migraciones pendientes.
    const activeTargets: TenantMigrationTarget[] = Array.from(this.coreDbRegistry.values())
      .filter((r) => r.status === 'ACTIVE')
      .map((r) => ({
        tenantId: r.tenantId,
        cellId: r.cellId,
        dbName: r.dbName,
        activeServices: r.activeServices,
      }));

    const tenantFleetMigrationReport =
      await this.fleetOrchestrator.migrateTenantDatabaseFleet(activeTargets);

    return {
      coreDbName: this.coreDbName,
      coreDbSkippedOldMigrations: coreMigrationResult.skippedOldMigrations,
      coreDbAppliedNewMigrations: coreMigrationResult.appliedNewMigrations,
      trialDbName: this.trialDbName,
      trialDbCreatedOnStartup,
      registeredDatabasesInCoreDb: Array.from(this.coreDbRegistry.keys()),
      tenantFleetMigrationReport,
    };
  }

  /**
   * Paso 2: Se ejecuta cuando se registra un Nuevo Cliente en la plataforma.
   * - Crea su BD dedicada (`db_tenant_<slug>`).
   * - Ejecuta inmediatamente todas las migraciones `.sql` de sus servicios/módulos en esa nueva BD.
   * - Registra al cliente y su `db_name` dentro de la lista maestra en `proveko_control_db` (`coreDB`).
   */
  public async registerAndMigrateNewClientDatabase(params: {
    tenantId: string;
    cellId?: string;
    slug: string;
    legalName: string;
    dbName?: string;
    activeServices: Partial<
      Record<
        ServiceKey | ParentMicroserviceKey,
        ReadonlyArray<MicroserviceKey | ModuleKey>
      >
    >;
  }): Promise<{
    clientRecord: RegisteredClientDatabaseRecord;
    skippedOldMigrations: string[];
    appliedNewMigrations: string[];
  }> {
    const cellId = params.cellId ?? 'cell-db-01';
    const dbName =
      params.dbName ?? `db_tenant_${params.slug.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`;

    const normalizedServices: Partial<Record<ServiceKey, MicroserviceKey[]>> = {};
    for (const [rawSrv, rawModules] of Object.entries(params.activeServices)) {
      if (!rawModules) continue;
      const srvKey = normalizeParentMicroserviceKey(rawSrv as ServiceKey | ParentMicroserviceKey);
      normalizedServices[srvKey] = rawModules.map((m) =>
        normalizeModuleKey(m as MicroserviceKey | ModuleKey),
      );
    }

    // 1. Ejecutar todas las migraciones `.sql` vigentes sobre la nueva BD recién creada para este cliente
    const singleTargetReport = await this.fleetOrchestrator.migrateTenantDatabaseFleet([
      {
        tenantId: params.tenantId,
        cellId,
        dbName,
        activeServices: normalizedServices,
      },
    ]);
    const dbResult = singleTargetReport.resultsByDatabase[dbName]!;

    // 2. Guardar el nuevo cliente y su `db_name` en la lista maestra de `proveko_control_db` (`coreDB`)
    const clientRecord: RegisteredClientDatabaseRecord = {
      tenantId: params.tenantId,
      cellId,
      slug: params.slug,
      legalName: params.legalName,
      dbName,
      isTrialVersionDb: false,
      status: 'ACTIVE',
      activeServices: normalizedServices,
      createdAtIso: new Date().toISOString(),
    };
    this.coreDbRegistry.set(dbName, clientRecord);

    return {
      clientRecord,
      skippedOldMigrations: dbResult.skippedOldMigrations,
      appliedNewMigrations: dbResult.appliedNewMigrations,
    };
  }

  /**
   * Comando 1: Ejecuta únicamente las migraciones de `migrations/core/` sobre la Base Principal (`proveko_control_db` / `coreDB`).
   */
  public async runCoreMigrations(coreMigrationsDir: string): Promise<{
    coreDbName: string;
    skippedOldMigrations: string[];
    appliedNewMigrations: string[];
  }> {
    const res = await this.migrateCoreControlDatabase(coreMigrationsDir);
    return {
      coreDbName: this.coreDbName,
      skippedOldMigrations: res.skippedOldMigrations,
      appliedNewMigrations: res.appliedNewMigrations,
    };
  }

  /**
   * Comando 2: Ejecuta migraciones MASIVAS (`migrations/clients/`) sobre todas las BDs activas registradas en `proveko_control_db`.
   */
  public async runMassiveClientsMigrations(): Promise<MultiDatabaseFleetMigrationReport> {
    const activeTargets: TenantMigrationTarget[] = Array.from(this.coreDbRegistry.values())
      .filter((r) => r.status === 'ACTIVE')
      .map((r) => ({
        tenantId: r.tenantId,
        cellId: r.cellId,
        dbName: r.dbName,
        activeServices: r.activeServices,
      }));

    return this.fleetOrchestrator.migrateTenantDatabaseFleet(activeTargets);
  }

  /**
   * Comando 3: Ejecuta una migración LOCALIZADA en 1 sola base de datos de cliente (`dbName` o `tenantId`),
   * permitiendo opcionalmente filtrar por un único módulo (`onlyModuleKey`), sin tocar ninguna otra base de datos.
   */
  public async runLocalizedClientMigration(params: {
    dbName?: string;
    tenantId?: string;
    onlyModuleKey?: MicroserviceKey | ModuleKey;
  }): Promise<{
    targetDbName: string;
    tenantId: string;
    skippedOldMigrations: string[];
    appliedNewMigrations: string[];
  }> {
    const record = Array.from(this.coreDbRegistry.values()).find(
      (r) =>
        (params.dbName && r.dbName === params.dbName) ||
        (params.tenantId && r.tenantId === params.tenantId),
    );

    if (!record) {
      throw new Error(
        `Target client database not found in coreDB "${this.coreDbName}" for dbName="${params.dbName ?? ''}" / tenantId="${params.tenantId ?? ''}".`,
      );
    }

    let scopedServices: Partial<Record<ServiceKey, MicroserviceKey[]>> = record.activeServices;
    if (params.onlyModuleKey) {
      const normalizedMod = normalizeModuleKey(params.onlyModuleKey);
      const filtered: Partial<Record<ServiceKey, MicroserviceKey[]>> = {};
      for (const [srvKey, modules] of Object.entries(record.activeServices) as Array<
        [ServiceKey, MicroserviceKey[] | undefined]
      >) {
        if (modules?.includes(normalizedMod)) {
          filtered[srvKey] = [normalizedMod];
        }
      }
      scopedServices = filtered;
    }

    const report = await this.fleetOrchestrator.migrateTenantDatabaseFleet([
      {
        tenantId: record.tenantId,
        cellId: record.cellId,
        dbName: record.dbName,
        activeServices: scopedServices,
      },
    ]);
    const item = report.resultsByDatabase[record.dbName]!;
    if (item.status === 'FAILED') {
      throw new Error(item.errorDetail ?? `Localized migration failed on "${record.dbName}".`);
    }

    return {
      targetDbName: record.dbName,
      tenantId: record.tenantId,
      skippedOldMigrations: item.skippedOldMigrations,
      appliedNewMigrations: item.appliedNewMigrations,
    };
  }

  /**
   * Calcula el siguiente consecutivo (`0001`, `0002`, `0003`...) dentro de `migrations/core` o `migrations/clients/<srv>/<ms>`.
   */
  public static computeNextMigrationFilename(
    targetDir: string,
    descriptionSlug: string,
  ): { nextVersion: string; filename: string } {
    const cleanSlug = descriptionSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!cleanSlug) {
      throw new Error('Migration description slug cannot be empty.');
    }

    let maxNum = 0;
    if (existsSync(targetDir)) {
      for (const file of readdirSync(targetDir)) {
        const m = /^(\d{4})_/.exec(file);
        if (m && m[1]) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
    }

    const nextVersion = String(maxNum + 1).padStart(4, '0');
    return {
      nextVersion,
      filename: `${nextVersion}_${cleanSlug}.sql`,
    };
  }

  private async migrateCoreControlDatabase(controlPlaneMigrationsDir: string): Promise<{
    skippedOldMigrations: string[];
    appliedNewMigrations: string[];
  }> {
    const schemaName = 'control_plane';
    const moduleKey = 'ms:crm-directory'; // ledger namespace for core control plane
    const lockKey = `${this.coreDbName}:${schemaName}`;

    const acquired = await this.migrationDriver.tryAcquireAdvisoryLock(this.coreDbName, lockKey);
    if (!acquired) {
      throw new Error(`Could not acquire advisory lock for coreDB "${this.coreDbName}".`);
    }

    try {
      await this.migrationDriver.ensureMigrationLedgerTable(this.coreDbName, schemaName);
      const applied = await this.migrationDriver.getAppliedMigrations(
        this.coreDbName,
        schemaName,
        moduleKey,
      );
      const appliedMap = new Map(applied.map((a) => [a.filename, a]));

      const skippedOldMigrations: string[] = [];
      const appliedNewMigrations: string[] = [];

      if (existsSync(controlPlaneMigrationsDir)) {
        const sqlFiles = readdirSync(controlPlaneMigrationsDir)
          .filter((f) => f.endsWith('.sql'))
          .sort((a, b) => a.localeCompare(b));

        for (const filename of sqlFiles) {
          const sqlUp = readFileSync(join(controlPlaneMigrationsDir, filename), 'utf8');
          const checksumSha256 = computeMigrationChecksumSha256(sqlUp);
          const version = filename.slice(0, 4);

          const existing = appliedMap.get(filename);
          if (existing) {
            if (existing.checksumSha256 !== checksumSha256) {
              throw new Error(
                `Checksum drift detected on coreDB migration "${filename}" in "${this.coreDbName}".`,
              );
            }
            skippedOldMigrations.push(filename);
            continue;
          }

          await this.migrationDriver.executeMigrationInTransaction(this.coreDbName, schemaName, {
            version,
            filename,
            parentService: 'srv:crm',
            moduleKey,
            sqlUp,
            checksumSha256,
          });
          appliedNewMigrations.push(filename);
        }
      }

      return { skippedOldMigrations, appliedNewMigrations };
    } finally {
      await this.migrationDriver.releaseAdvisoryLock(this.coreDbName, lockKey);
    }
  }
}
