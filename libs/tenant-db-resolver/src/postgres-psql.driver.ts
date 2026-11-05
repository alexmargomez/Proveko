import { join } from 'node:path';
import {
  type MicroserviceKey,
  SEED_MICROSERVICES_CATALOG,
  type ServiceKey,
} from '@proveko/shared-kernel';
import {
  FileBasedMigrationEngine,
  FileBasedMigrationRegistry,
  MultiDatabaseMigrationOrchestrator,
  type TenantMigrationTarget,
} from './file-migration.engine.js';
import {
  type PostgresEnvConfig,
  PostgresMigrationDatabaseDriverAdapter,
} from './postgres-migration-driver.adapter.js';
import { SystemStartupBootstrapper } from './system-startup.bootstrapper.js';
import {
  type ClusterDatabaseCatalogSnapshot,
  PostgresTenantControlCatalogRepository,
  type RegisterTenantCatalogInput,
} from './tenant-control-catalog.repository.js';

export type { PostgresEnvConfig };

export interface PostgresBootstrapSummary {
  readonly executedAgainstRealPostgres: boolean;
  readonly coreDbName: string;
  readonly coreFilesSkippedOld: readonly string[];
  readonly coreFilesApplied: readonly string[];
  readonly clientDatabasesProvisioned: readonly string[];
  readonly reasonIfSkipped?: string;
}

export interface NewClientPostgresProvisionInput extends RegisterTenantCatalogInput {
  readonly monthlyAmountUsd: number;
  readonly paymentReference: string;
  readonly migrationsRootDir: string;
}

function buildFullCatalogServicesMap(): Partial<Record<ServiceKey, MicroserviceKey[]>> {
  const map: Partial<Record<ServiceKey, MicroserviceKey[]>> = {};
  for (const mod of SEED_MICROSERVICES_CATALOG) {
    const list = map[mod.parentService] ?? [];
    list.push(mod.key);
    map[mod.parentService] = list;
  }
  return map;
}

/**
 * Composition Root / Facade para el Ciclo de Vida PostgreSQL (SOLID DIP + SRP + OCP).
 * - Cero SQL DDL/DML quemado: delega 100% en `SystemStartupBootstrapper`, `FileBasedMigrationEngine`
 *   (con salto O(1) de migraciones antiguas vía checksum SHA-256 en `schema_migrations`),
 *   `PostgresMigrationDatabaseDriverAdapter` y `PostgresTenantControlCatalogRepository`.
 */
export class PostgresPsqlBootstrapRunner {
  private static createHexagonalPipeline(
    cfg: PostgresEnvConfig,
    migrationsRootDir: string,
  ): {
    driver: PostgresMigrationDatabaseDriverAdapter;
    orchestrator: MultiDatabaseMigrationOrchestrator;
    bootstrapper: SystemStartupBootstrapper;
    catalogRepo: PostgresTenantControlCatalogRepository;
  } {
    const driver = new PostgresMigrationDatabaseDriverAdapter(cfg);
    const registry = new FileBasedMigrationRegistry();
    registry.loadAllCatalogMigrationsFromRoot(migrationsRootDir);
    const engine = new FileBasedMigrationEngine(registry, driver);
    const orchestrator = new MultiDatabaseMigrationOrchestrator(engine, {
      maxConcurrentDatabases: 4,
    });
    const bootstrapper = new SystemStartupBootstrapper(
      driver,
      engine,
      orchestrator,
      cfg.coreDbName,
    );
    const catalogRepo = new PostgresTenantControlCatalogRepository(driver);
    return { driver, orchestrator, bootstrapper, catalogRepo };
  }

  public static async runStartupMigrations(
    migrationsRootDir: string,
  ): Promise<PostgresBootstrapSummary> {
    const cfg = PostgresMigrationDatabaseDriverAdapter.resolveEnvConfig();
    if (!cfg) {
      return {
        executedAgainstRealPostgres: false,
        coreDbName: SystemStartupBootstrapper.DEFAULT_CORE_DB_NAME,
        coreFilesSkippedOld: [],
        coreFilesApplied: [],
        clientDatabasesProvisioned: [],
        reasonIfSkipped: 'DB_HOST / POSTGRES_PASSWORD no configurados.',
      };
    }

    const { driver, orchestrator, bootstrapper, catalogRepo } = this.createHexagonalPipeline(
      cfg,
      migrationsRootDir,
    );
    const ping = driver.isReachable();
    if (!ping.ok) {
      return {
        executedAgainstRealPostgres: false,
        coreDbName: cfg.coreDbName,
        coreFilesSkippedOld: [],
        coreFilesApplied: [],
        clientDatabasesProvisioned: [],
        reasonIfSkipped: `PostgreSQL no alcanzable (${ping.reason ?? 'connection error'})`,
      };
    }

    driver.ensureDatabaseExists(cfg.coreDbName);
    driver.dropLegacyRandomDatabaseIfExists('db_agrovalle');
    driver.dropLegacyRandomDatabaseIfExists('db_labrasa');

    const coreResult = await bootstrapper.runCoreMigrations(join(migrationsRootDir, 'core'));
    const activeClientDbNames = catalogRepo.listActiveTenantDatabaseNames(cfg.coreDbName);
    const fullServicesMap = buildFullCatalogServicesMap();

    const targets: TenantMigrationTarget[] = activeClientDbNames.map((dbName) => {
      driver.ensureDatabaseExists(dbName);
      return {
        tenantId: dbName === 'db_version_prueba' ? 'tnt-demo' : `tnt-${dbName}`,
        cellId: 'cell-alpanel-primary',
        dbName,
        activeServices: fullServicesMap,
      };
    });

    await orchestrator.migrateTenantDatabaseFleet(targets);

    return {
      executedAgainstRealPostgres: true,
      coreDbName: cfg.coreDbName,
      coreFilesSkippedOld: coreResult.skippedOldMigrations,
      coreFilesApplied: coreResult.appliedNewMigrations,
      clientDatabasesProvisioned: activeClientDbNames,
    };
  }

  public static async provisionNewClientDatabaseInPostgres(
    input: NewClientPostgresProvisionInput,
  ): Promise<boolean> {
    const cfg = PostgresMigrationDatabaseDriverAdapter.resolveEnvConfig();
    if (!cfg) return false;

    const { driver, bootstrapper, catalogRepo } = this.createHexagonalPipeline(
      cfg,
      input.migrationsRootDir,
    );
    if (!driver.isReachable().ok) return false;
    if (!driver.ensureDatabaseExists(input.dbName)) return false;

    await bootstrapper.registerAndMigrateNewClientDatabase({
      tenantId: input.tenantId,
      cellId: 'cell-alpanel-primary',
      slug: input.slug,
      legalName: input.companyName,
      dbName: input.dbName,
      activeServices: buildFullCatalogServicesMap(),
    });

    return catalogRepo.registerTenantAndSeedClientAdmin(cfg.coreDbName, input);
  }

  public static listPostgresDatabasesAndClients(): ClusterDatabaseCatalogSnapshot {
    const cfg = PostgresMigrationDatabaseDriverAdapter.resolveEnvConfig();
    if (!cfg) return { databases: [], rows: [] };
    const driver = new PostgresMigrationDatabaseDriverAdapter(cfg);
    if (!driver.isReachable().ok) return { databases: [], rows: [] };
    const catalogRepo = new PostgresTenantControlCatalogRepository(driver);
    return catalogRepo.getClusterDatabaseCatalogSnapshot(cfg.coreDbName);
  }
}
