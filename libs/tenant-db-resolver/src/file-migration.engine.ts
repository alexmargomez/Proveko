import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  type MicroserviceKey,
  type ModuleKey,
  PROVEKO_ERROR_CODES,
  type ParentMicroserviceKey,
  ProvekoDomainError,
  SEED_MICROSERVICES_CATALOG,
  type ServiceKey,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
} from '@proveko/shared-kernel';
import { SERVICE_SCHEMA_MAP } from './pg-schemas.js';

export interface MigrationFileDescriptor {
  readonly version: string; // ej. '0001', '0002'
  readonly filename: string; // ej. '0001_init_pos_tables.sql'
  readonly parentService: ServiceKey;
  readonly moduleKey: MicroserviceKey;
  readonly sqlUp: string;
  readonly checksumSha256: string;
}

export interface AppliedMigrationRecord {
  readonly moduleKey: MicroserviceKey;
  readonly filename: string;
  readonly version: string;
  readonly checksumSha256: string;
  readonly appliedAtIso: string;
  readonly executionMs: number;
}

export interface SingleModuleMigrationResult {
  readonly tenantId: string;
  readonly dbName: string;
  readonly parentService: ServiceKey;
  readonly moduleKey: MicroserviceKey;
  readonly schemaName: string;
  readonly skippedOldMigrations: string[];
  readonly appliedNewMigrations: string[];
  readonly totalAppliedCount: number;
}

export interface TenantMigrationTarget {
  readonly tenantId: string;
  readonly cellId: string;
  readonly dbName: string;
  readonly activeServices: Partial<Record<ServiceKey, MicroserviceKey[]>>;
}

export interface DatabaseFleetMigrationItemResult {
  readonly tenantId: string;
  readonly dbName: string;
  readonly status: 'SUCCESS' | 'FAILED';
  readonly skippedOldMigrations: string[];
  readonly appliedNewMigrations: string[];
  readonly errorCode?: string;
  readonly errorDetail?: string;
}

export interface MultiDatabaseFleetMigrationReport {
  readonly totalDatabasesTargeted: number;
  readonly succeededDatabasesCount: number;
  readonly failedDatabasesCount: number;
  readonly resultsByDatabase: Record<string, DatabaseFleetMigrationItemResult>;
}

/**
 * Puerto de Base de Datos Administrativa (`adminPort: 5432`) para ejecución de Migraciones por Cliente (SOLID DIP)
 */
export interface MigrationDatabaseDriverPort {
  tryAcquireAdvisoryLock(dbName: string, lockNamespace: string): Promise<boolean>;
  releaseAdvisoryLock(dbName: string, lockNamespace: string): Promise<void>;
  ensureMigrationLedgerTable(dbName: string, schemaName: string): Promise<void>;
  getAppliedMigrations(
    dbName: string,
    schemaName: string,
    moduleKey: MicroserviceKey,
  ): Promise<AppliedMigrationRecord[]>;
  executeMigrationInTransaction(
    dbName: string,
    schemaName: string,
    descriptor: MigrationFileDescriptor,
  ): Promise<AppliedMigrationRecord>;
}

/**
 * Calcula el hash SHA-256 determinístico (normalizando saltos de línea CRLF -> LF) de un archivo SQL de migración
 */
export function computeMigrationChecksumSha256(sqlContent: string): string {
  const normalized = sqlContent.replace(/\r\n/g, '\n').trim();
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

const MIGRATION_FILENAME_REGEX = /^(\d{4})_[a-z0-9_]+\.sql$/;

/**
 * Crea un descriptor inmutable de archivo de migración validando su nomenclatura secuencial (`0001_nombre.sql`)
 */
export function createMigrationFileDescriptor(params: {
  filename: string;
  parentService: ServiceKey | ParentMicroserviceKey;
  moduleKey: MicroserviceKey | ModuleKey;
  sqlUp: string;
}): MigrationFileDescriptor {
  const match = MIGRATION_FILENAME_REGEX.exec(params.filename);
  if (!match || !match[1]) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Invalid migration filename "${params.filename}". Expected pattern "NNNN_snake_case_description.sql" (e.g. "0001_init_tables.sql").`,
    );
  }
  if (!params.sqlUp || params.sqlUp.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Migration file "${params.filename}" cannot have empty SQL content.`,
    );
  }

  return Object.freeze({
    version: match[1],
    filename: params.filename,
    parentService: normalizeParentMicroserviceKey(params.parentService),
    moduleKey: normalizeModuleKey(params.moduleKey),
    sqlUp: params.sqlUp,
    checksumSha256: computeMigrationChecksumSha256(params.sqlUp),
  });
}

/**
 * Cargador de archivos `.sql` de migración desde el sistema de archivos local o registro en memoria
 */
export class FileBasedMigrationRegistry {
  private readonly filesByModule = new Map<MicroserviceKey, MigrationFileDescriptor[]>();

  public registerMigrationFile(descriptor: MigrationFileDescriptor): void {
    const existing = this.filesByModule.get(descriptor.moduleKey) ?? [];
    const duplicateIdx = existing.findIndex(
      (f) => f.filename === descriptor.filename || f.version === descriptor.version,
    );
    if (duplicateIdx >= 0) {
      existing[duplicateIdx] = descriptor;
    } else {
      existing.push(descriptor);
    }
    existing.sort((a, b) => a.version.localeCompare(b.version));
    this.filesByModule.set(descriptor.moduleKey, existing);
  }

  public loadModuleMigrationsFromDirectory(
    dirPath: string,
    parentServiceInput: ServiceKey | ParentMicroserviceKey,
    moduleKeyInput: MicroserviceKey | ModuleKey,
  ): MigrationFileDescriptor[] {
    if (!existsSync(dirPath)) {
      return [];
    }
    const entries = readdirSync(dirPath)
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const filename of entries) {
      const sqlUp = readFileSync(join(dirPath, filename), 'utf8');
      this.registerMigrationFile(
        createMigrationFileDescriptor({
          filename,
          parentService: parentServiceInput,
          moduleKey: moduleKeyInput,
          sqlUp,
        }),
      );
    }
    return this.getMigrationsForModule(moduleKeyInput);
  }

  public loadAllCatalogMigrationsFromRoot(migrationsRootDir: string): number {
    let loadedFilesCount = 0;
    for (const def of SEED_MICROSERVICES_CATALOG) {
      const srvFolder = def.parentService.replace(':', '-'); // ej. srv-invoicing
      const msFolder = def.key.replace(':', '-'); // ej. ms-invoicing-pos
      const moduleDir = join(migrationsRootDir, srvFolder, msFolder);
      const loaded = this.loadModuleMigrationsFromDirectory(
        moduleDir,
        def.parentService,
        def.key,
      );
      loadedFilesCount += loaded.length;
    }
    return loadedFilesCount;
  }

  public getMigrationsForModule(
    moduleKeyInput: MicroserviceKey | ModuleKey,
  ): MigrationFileDescriptor[] {
    const moduleKey = normalizeModuleKey(moduleKeyInput);
    return [...(this.filesByModule.get(moduleKey) ?? [])];
  }

  public getAllMigrations(): MigrationFileDescriptor[] {
    const all: MigrationFileDescriptor[] = [];
    for (const list of this.filesByModule.values()) {
      all.push(...list);
    }
    return all;
  }
}

/**
 * Adaptador en Memoria de `MigrationDatabaseDriverPort` para pruebas de auditoría e integración sin demonios externos
 */
export class InMemoryMigrationDatabaseDriverAdapter implements MigrationDatabaseDriverPort {
  private readonly activeLocks = new Set<string>();
  private readonly ledgerByDb = new Map<string, AppliedMigrationRecord[]>();
  private readonly executedSqlLogByDb = new Map<string, string[]>();
  private readonly simulatedFailuresByDb = new Map<string, string>();

  public simulateFailureForDatabase(dbName: string, errorMessage: string): void {
    this.simulatedFailuresByDb.set(dbName, errorMessage);
  }

  public clearSimulatedFailureForDatabase(dbName: string): void {
    this.simulatedFailuresByDb.delete(dbName);
  }

  public tamperStoredChecksumForTesting(
    dbName: string,
    moduleKeyInput: MicroserviceKey | ModuleKey,
    filename: string,
    corruptedChecksum: string,
  ): void {
    const moduleKey = normalizeModuleKey(moduleKeyInput);
    const records = this.ledgerByDb.get(dbName) ?? [];
    const idx = records.findIndex((r) => r.moduleKey === moduleKey && r.filename === filename);
    if (idx >= 0) {
      records[idx] = {
        ...records[idx]!,
        checksumSha256: corruptedChecksum,
      };
      this.ledgerByDb.set(dbName, records);
    }
  }

  public getExecutedSqlForDatabase(dbName: string): string[] {
    return [...(this.executedSqlLogByDb.get(dbName) ?? [])];
  }

  public getAllAppliedRecordsForDatabase(dbName: string): AppliedMigrationRecord[] {
    return [...(this.ledgerByDb.get(dbName) ?? [])];
  }

  public async tryAcquireAdvisoryLock(dbName: string, lockNamespace: string): Promise<boolean> {
    const key = `${dbName}::${lockNamespace}`;
    if (this.activeLocks.has(key)) {
      return false;
    }
    this.activeLocks.add(key);
    return true;
  }

  public async releaseAdvisoryLock(dbName: string, lockNamespace: string): Promise<void> {
    const key = `${dbName}::${lockNamespace}`;
    this.activeLocks.delete(key);
  }

  public async ensureMigrationLedgerTable(dbName: string, schemaName: string): Promise<void> {
    const failure = this.simulatedFailuresByDb.get(dbName);
    if (failure) {
      throw new Error(failure);
    }
    const sqlLog = this.executedSqlLogByDb.get(dbName) ?? [];
    const createLedgerCmd = `CREATE SCHEMA IF NOT EXISTS ${schemaName}; CREATE TABLE IF NOT EXISTS ${schemaName}.schema_migrations`;
    if (!sqlLog.includes(createLedgerCmd)) {
      sqlLog.push(createLedgerCmd);
      this.executedSqlLogByDb.set(dbName, sqlLog);
    }
  }

  public async getAppliedMigrations(
    dbName: string,
    _schemaName: string,
    moduleKey: MicroserviceKey,
  ): Promise<AppliedMigrationRecord[]> {
    const records = this.ledgerByDb.get(dbName) ?? [];
    return records
      .filter((r) => r.moduleKey === moduleKey)
      .sort((a, b) => a.version.localeCompare(b.version));
  }

  public async executeMigrationInTransaction(
    dbName: string,
    schemaName: string,
    descriptor: MigrationFileDescriptor,
  ): Promise<AppliedMigrationRecord> {
    const failure = this.simulatedFailuresByDb.get(dbName);
    if (failure) {
      throw new Error(failure);
    }

    const sqlLog = this.executedSqlLogByDb.get(dbName) ?? [];
    sqlLog.push(`BEGIN [${schemaName}:${descriptor.filename}]`);
    sqlLog.push(descriptor.sqlUp.trim());
    sqlLog.push(`COMMIT [${schemaName}:${descriptor.filename}]`);
    this.executedSqlLogByDb.set(dbName, sqlLog);

    const record: AppliedMigrationRecord = {
      moduleKey: descriptor.moduleKey,
      filename: descriptor.filename,
      version: descriptor.version,
      checksumSha256: descriptor.checksumSha256,
      appliedAtIso: new Date().toISOString(),
      executionMs: 2,
    };

    const records = this.ledgerByDb.get(dbName) ?? [];
    records.push(record);
    this.ledgerByDb.set(dbName, records);
    return record;
  }
}

/**
 * Motor de Migraciones por Archivo (Antiguas ya corridas vs. Nuevas pendientes)
 * con Verificación de Integridad SHA-256 y Bloqueo Exclusivo `pg_advisory_lock`.
 */
export class FileBasedMigrationEngine {
  constructor(
    private readonly registry: FileBasedMigrationRegistry,
    private readonly driver: MigrationDatabaseDriverPort,
  ) {}

  /**
   * Ejecuta el flujo de migraciones para un módulo específico dentro de la base de datos de un cliente (`dbName`):
   * 1. Adquiere `pg_advisory_lock` exclusivo por `(dbName, parentService)`.
   * 2. Inspecciona `srv_<servicio>.schema_migrations`.
   * 3. Valida el Checksum SHA-256 de todas las migraciones ANTIGUAS ya aplicadas y las salta (`skippedOldMigrations`).
   * 4. Ejecuta en orden estricto únicamente los archivos NUEVOS pendientes (`appliedNewMigrations`).
   */
  public async migrateModuleForTenantDatabase(params: {
    tenantId: string;
    dbName: string;
    parentService: ServiceKey | ParentMicroserviceKey;
    moduleKey: MicroserviceKey | ModuleKey;
  }): Promise<SingleModuleMigrationResult> {
    const parentService = normalizeParentMicroserviceKey(params.parentService);
    const moduleKey = normalizeModuleKey(params.moduleKey);
    const schemaName = SERVICE_SCHEMA_MAP[parentService];
    const lockNamespace = `${schemaName}:${moduleKey}`;

    const lockAcquired = await this.driver.tryAcquireAdvisoryLock(params.dbName, lockNamespace);
    if (!lockAcquired) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_MIGRATION_LOCK_TIMEOUT,
        409,
        `Database "${params.dbName}" is currently locked by another active migration on "${lockNamespace}".`,
        { tenant_id: params.tenantId, db_name: params.dbName, module_key: moduleKey },
      );
    }

    try {
      await this.driver.ensureMigrationLedgerTable(params.dbName, schemaName);

      const availableFiles = this.registry.getMigrationsForModule(moduleKey);
      const appliedRecords = await this.driver.getAppliedMigrations(
        params.dbName,
        schemaName,
        moduleKey,
      );
      const appliedMap = new Map<string, AppliedMigrationRecord>(
        appliedRecords.map((r) => [r.filename, r]),
      );

      const skippedOldMigrations: string[] = [];
      const appliedNewMigrations: string[] = [];

      for (const fileDescriptor of availableFiles) {
        const previouslyApplied = appliedMap.get(fileDescriptor.filename);
        if (previouslyApplied) {
          // Es una MIGRACIÓN ANTIGUA ya corrida en esta base de datos: verificar que nadie haya alterado el archivo histórico
          if (previouslyApplied.checksumSha256 !== fileDescriptor.checksumSha256) {
            throw new ProvekoDomainError(
              PROVEKO_ERROR_CODES.ERR_MIGRATION_CHECKSUM_DRIFT,
              409,
              `Checksum drift detected on already-applied old migration "${fileDescriptor.filename}" in database "${params.dbName}". Historical migration files are immutable.`,
              {
                tenant_id: params.tenantId,
                db_name: params.dbName,
                module_key: moduleKey,
                filename: fileDescriptor.filename,
                expected_checksum: previouslyApplied.checksumSha256,
                current_file_checksum: fileDescriptor.checksumSha256,
              },
            );
          }
          skippedOldMigrations.push(fileDescriptor.filename);
          continue;
        }

        // Es una MIGRACIÓN NUEVA pendiente en esta base de datos: ejecutar dentro de transacción y registrar en ledger
        await this.driver.executeMigrationInTransaction(params.dbName, schemaName, fileDescriptor);
        appliedNewMigrations.push(fileDescriptor.filename);
      }

      return {
        tenantId: params.tenantId,
        dbName: params.dbName,
        parentService,
        moduleKey,
        schemaName,
        skippedOldMigrations,
        appliedNewMigrations,
        totalAppliedCount: skippedOldMigrations.length + appliedNewMigrations.length,
      };
    } finally {
      await this.driver.releaseAdvisoryLock(params.dbName, lockNamespace);
    }
  }
}

/**
 * Orquestador de Migraciones Múltiples en Flota (`Base A`, `Base B`, `Base C`, `Base D`)
 * con Semáforo de Concurrencia (`Bulkhead`) y Aislamiento de Fallos por Base de Datos.
 */
export class MultiDatabaseMigrationOrchestrator {
  private readonly maxConcurrentDatabases: number;

  constructor(
    private readonly migrationEngine: FileBasedMigrationEngine,
    options?: { maxConcurrentDatabases?: number },
  ) {
    this.maxConcurrentDatabases = Math.max(1, options?.maxConcurrentDatabases ?? 4);
  }

  /**
   * Recorre múltiples bases de datos de clientes (`Base A`, `Base B`, `Base C`, `Base D`):
   * - En clientes antiguos: salta las migraciones antiguas (`0001_*.sql`) y corre solo las nuevas (`0002_*.sql`).
   * - En clientes nuevos: corre todas las migraciones (`0001_*.sql`, `0002_*.sql`, ...) de sus módulos activos.
   * - Si una base de datos falla (ej. `Base C`), aísla el error y continúa migrando el resto de bases sin abortar la flota.
   */
  public async migrateTenantDatabaseFleet(
    targets: ReadonlyArray<TenantMigrationTarget>,
  ): Promise<MultiDatabaseFleetMigrationReport> {
    const resultsByDatabase: Record<string, DatabaseFleetMigrationItemResult> = {};
    let succeededDatabasesCount = 0;
    let failedDatabasesCount = 0;

    // Procesar en lotes acotados por `maxConcurrentDatabases` (Bulkhead)
    for (let i = 0; i < targets.length; i += this.maxConcurrentDatabases) {
      const batch = targets.slice(i, i + this.maxConcurrentDatabases);
      await Promise.all(
        batch.map(async (target) => {
          const allSkippedOld: string[] = [];
          const allAppliedNew: string[] = [];

          try {
            const entries = Object.entries(target.activeServices) as Array<
              [ServiceKey, MicroserviceKey[] | undefined]
            >;
            for (const [parentService, modules] of entries) {
              if (!modules || modules.length === 0) continue;
              for (const moduleKey of modules) {
                const res = await this.migrationEngine.migrateModuleForTenantDatabase({
                  tenantId: target.tenantId,
                  dbName: target.dbName,
                  parentService,
                  moduleKey,
                });
                allSkippedOld.push(...res.skippedOldMigrations);
                allAppliedNew.push(...res.appliedNewMigrations);
              }
            }

            succeededDatabasesCount += 1;
            resultsByDatabase[target.dbName] = {
              tenantId: target.tenantId,
              dbName: target.dbName,
              status: 'SUCCESS',
              skippedOldMigrations: allSkippedOld,
              appliedNewMigrations: allAppliedNew,
            };
          } catch (err) {
            failedDatabasesCount += 1;
            const errorCode =
              err instanceof ProvekoDomainError ? err.errorCode : 'ERR_MIGRATION_EXECUTION_FAILED';
            const errorDetail = err instanceof Error ? err.message : 'Unknown migration error';

            resultsByDatabase[target.dbName] = {
              tenantId: target.tenantId,
              dbName: target.dbName,
              status: 'FAILED',
              skippedOldMigrations: allSkippedOld,
              appliedNewMigrations: allAppliedNew,
              errorCode,
              errorDetail,
            };
          }
        }),
      );
    }

    return {
      totalDatabasesTargeted: targets.length,
      succeededDatabasesCount,
      failedDatabasesCount,
      resultsByDatabase,
    };
  }
}
