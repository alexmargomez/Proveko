import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  type MicroserviceKey,
  type ModuleKey,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
  type ParentMicroserviceKey,
  SEED_MICROSERVICES_CATALOG,
  type ServiceKey,
  toModuleNotation,
  toParentMicroserviceNotation,
} from '@proveko/shared-kernel';
import {
  FileBasedMigrationEngine,
  FileBasedMigrationRegistry,
  InMemoryMigrationDatabaseDriverAdapter,
  MultiDatabaseMigrationOrchestrator,
} from './file-migration.engine.js';
import { SERVICE_SCHEMA_MAP } from './pg-schemas.js';
import { SystemStartupBootstrapper } from './system-startup.bootstrapper.js';

export interface GenerateMigrationResult {
  readonly scope: 'core' | 'clients';
  readonly version: string;
  readonly filename: string;
  readonly absolutePath: string;
}

/**
 * Generador inteligente de archivos de migración `.sql` separados en dos carpetas:
 * 1. `migrations/core/` -> Migraciones de la Base Principal (`proveko_control_db` / `coreDB`)
 * 2. `migrations/clients/<srv-*>/<ms-*>/` -> Migraciones de las Bases de Datos de Clientes (`db_version_prueba` y `db_tenant_*`)
 */
export function generateMigrationFileOnDisk(params: {
  migrationsRootDir: string;
  scope: 'core' | 'clients';
  descriptionSlug: string;
  parentService?: ServiceKey | ParentMicroserviceKey;
  moduleKey?: MicroserviceKey | ModuleKey;
  customSqlTemplate?: string;
}): GenerateMigrationResult {
  if (params.scope === 'core') {
    const coreDir = join(params.migrationsRootDir, 'core');
    mkdirSync(coreDir, { recursive: true });
    const { nextVersion, filename } = SystemStartupBootstrapper.computeNextMigrationFilename(
      coreDir,
      params.descriptionSlug,
    );
    const absolutePath = join(coreDir, filename);
    const sqlContent =
      params.customSqlTemplate ??
      [
        '-- =============================================================================',
        `-- PROVEKO — Core Control Plane Migration (${SystemStartupBootstrapper.DEFAULT_CORE_DB_NAME})`,
        `-- Migration: ${filename}`,
        '-- Scope: migrations/core (Base Principal / coreDB)',
        '-- =============================================================================',
        '',
        'CREATE SCHEMA IF NOT EXISTS control_plane;',
        '',
        '-- Escribe aquí tus sentencias DDL idempotentes (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS):',
        '',
      ].join('\n');

    writeFileSync(absolutePath, sqlContent, 'utf8');
    return {
      scope: 'core',
      version: nextVersion,
      filename,
      absolutePath,
    };
  }

  if (!params.parentService || !params.moduleKey) {
    throw new Error(
      'Client migrations require both parentService (e.g. "ms:invoicing") and moduleKey (e.g. "mod:invoicing-pos").',
    );
  }

  const normalizedParent = normalizeParentMicroserviceKey(params.parentService);
  const normalizedModule = normalizeModuleKey(params.moduleKey);
  const catalogItem = SEED_MICROSERVICES_CATALOG.find((m) => m.key === normalizedModule);
  if (!catalogItem || catalogItem.parentService !== normalizedParent) {
    throw new Error(
      `Module "${normalizedModule}" does not belong to parent microservice "${normalizedParent}".`,
    );
  }

  const srvFolder = normalizedParent.replace(':', '-');
  const msFolder = normalizedModule.replace(':', '-');
  const targetDir = join(params.migrationsRootDir, 'clients', srvFolder, msFolder);
  mkdirSync(targetDir, { recursive: true });

  const { nextVersion, filename } = SystemStartupBootstrapper.computeNextMigrationFilename(
    targetDir,
    params.descriptionSlug,
  );
  const absolutePath = join(targetDir, filename);
  const schemaName = SERVICE_SCHEMA_MAP[normalizedParent];

  const sqlContent =
    params.customSqlTemplate ??
    [
      '-- =============================================================================',
      `-- PROVEKO — Client Database Migration (${toParentMicroserviceNotation(normalizedParent)} -> ${toModuleNotation(normalizedModule)})`,
      `-- Migration: ${filename}`,
      `-- Scope: migrations/clients/${srvFolder}/${msFolder}`,
      `-- Target Schema: "${schemaName}" (Table Prefix: "${catalogItem.tablePrefix}")`,
      '-- =============================================================================',
      '',
      `CREATE SCHEMA IF NOT EXISTS "${schemaName}";`,
      '',
      `-- Ejemplo idempotente: ALTER TABLE "${schemaName}"."${catalogItem.tablePrefix}..." ADD COLUMN IF NOT EXISTS ...;`,
      '',
    ].join('\n');

  writeFileSync(absolutePath, sqlContent, 'utf8');
  return {
    scope: 'clients',
    version: nextVersion,
    filename,
    absolutePath,
  };
}

// Ejecutor CLI cuando se invoca mediante `npm run db:...`
const cliArgv1 = process.argv[1] ?? '';
if (
  cliArgv1.endsWith('proveko-migrations-cli.mjs') ||
  cliArgv1.endsWith('migrations.cli.ts') ||
  cliArgv1.endsWith('migrations.cli.js')
) {
  const args = process.argv.slice(2);
  const command = args[0] ?? 'help';
  const migrationsRootDir =
    process.env.PROVEKO_MIGRATIONS_DIR ??
    resolve(process.cwd(), 'libs/tenant-db-resolver/migrations');

  (async () => {
    if (command === 'make:core') {
      const slug = args[1];
      if (!slug) {
        throw new Error('Usage: npm run db:make:core -- <migration_name>');
      }
      const res = generateMigrationFileOnDisk({
        migrationsRootDir,
        scope: 'core',
        descriptionSlug: slug,
      });
      console.log(`[Proveko Migrations] Created CORE migration: ${res.absolutePath}`);
      return;
    }

    if (command === 'make:client') {
      const parentService = args[1] as ParentMicroserviceKey | undefined;
      const moduleKey = args[2] as ModuleKey | undefined;
      const slug = args[3];
      if (!parentService || !moduleKey || !slug) {
        throw new Error(
          'Usage: npm run db:make:client -- <ms:domain> <mod:domain-module> <migration_name>',
        );
      }
      const res = generateMigrationFileOnDisk({
        migrationsRootDir,
        scope: 'clients',
        parentService,
        moduleKey,
        descriptionSlug: slug,
      });
      console.log(`[Proveko Migrations] Created CLIENT migration: ${res.absolutePath}`);
      return;
    }

    const registry = new FileBasedMigrationRegistry();
    registry.loadAllCatalogMigrationsFromRoot(migrationsRootDir);
    const driver = new InMemoryMigrationDatabaseDriverAdapter();
    const engine = new FileBasedMigrationEngine(registry, driver);
    const orchestrator = new MultiDatabaseMigrationOrchestrator(engine);
    const bootstrapper = new SystemStartupBootstrapper(driver, engine, orchestrator);
    const coreDir = join(migrationsRootDir, 'core');

    if (command === 'migrate:core') {
      const res = await bootstrapper.runCoreMigrations(coreDir);
      console.log('[Proveko Migrations] Core DB migration finished:', JSON.stringify(res, null, 2));
      return;
    }

    if (command === 'migrate:clients') {
      await bootstrapper.bootstrapOnSystemStartup(coreDir);
      const res = await bootstrapper.runMassiveClientsMigrations();
      console.log(
        '[Proveko Migrations] Massive Clients migration finished:',
        JSON.stringify(res, null, 2),
      );
      return;
    }

    if (command === 'migrate:client') {
      await bootstrapper.bootstrapOnSystemStartup(coreDir);
      const dbFlag = args.find((a) => a.startsWith('--db='))?.slice('--db='.length);
      const tenantFlag = args.find((a) => a.startsWith('--tenant='))?.slice('--tenant='.length);
      const modFlag = args.find((a) => a.startsWith('--module='))?.slice('--module='.length) as
        | ModuleKey
        | undefined;

      const targetDb = dbFlag ?? SystemStartupBootstrapper.DEFAULT_TRIAL_DB_NAME;
      const res = await bootstrapper.runLocalizedClientMigration({
        dbName: targetDb,
        tenantId: tenantFlag,
        onlyModuleKey: modFlag,
      });
      console.log(
        '[Proveko Migrations] Localized Client DB migration finished:',
        JSON.stringify(res, null, 2),
      );
      return;
    }

    console.log(
      [
        'Proveko Migration CLI Commands:',
        '  npm run db:make:core -- <name>',
        '  npm run db:make:client -- <ms:domain> <mod:module> <name>',
        '  npm run db:migrate:core',
        '  npm run db:migrate:clients',
        '  npm run db:migrate:client -- --db=<db_name> [--module=<mod:key>]',
      ].join('\n'),
    );
  })().catch((err) => {
    console.error('[Proveko Migrations Error]:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
