import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PostgresEnvConfig {
  readonly host: string;
  readonly port: string;
  readonly user: string;
  readonly password: string;
  readonly coreDbName: string;
}

export interface PostgresBootstrapSummary {
  readonly executedAgainstRealPostgres: boolean;
  readonly coreDbName: string;
  readonly coreFilesApplied: readonly string[];
  readonly clientDatabasesProvisioned: readonly string[];
  readonly reasonIfSkipped?: string;
}

export interface NewClientPostgresProvisionInput {
  readonly tenantId: string;
  readonly slug: string;
  readonly companyName: string;
  readonly nit: string;
  readonly businessType: string;
  readonly dbName: string;
  readonly adminUsername: string;
  readonly adminPassword: string;
  readonly maxRolesAllowed: number;
  readonly maxUsersAllowed: number;
  readonly enabledServices: readonly string[];
  readonly enabledSubmodules: readonly string[];
  readonly enabledFeatures: readonly string[];
  readonly monthlyAmountUsd: number;
  readonly paymentReference: string;
  readonly migrationsRootDir: string;
}

const CLIENT_PUBLIC_BASE_DDL = `
CREATE TABLE IF NOT EXISTS "public"."client_internal_roles" (
  "role_id" VARCHAR(64) PRIMARY KEY,
  "role_name" VARCHAR(120) NOT NULL,
  "description" TEXT NOT NULL,
  "allowed_submodules_json" JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "public"."client_internal_users" (
  "user_id" VARCHAR(64) PRIMARY KEY,
  "username" VARCHAR(120) NOT NULL UNIQUE,
  "full_name" VARCHAR(180) NOT NULL,
  "email" VARCHAR(180) NOT NULL,
  "role_id" VARCHAR(64) NOT NULL REFERENCES "public"."client_internal_roles"("role_id") ON DELETE RESTRICT,
  "password_hint" VARCHAR(120) NOT NULL,
  "is_client_admin" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "public"."warehouses" (
  "warehouse_code" VARCHAR(64) PRIMARY KEY,
  "warehouse_name" VARCHAR(180) NOT NULL,
  "city_location" VARCHAR(180) NOT NULL,
  "capacity_label" VARCHAR(120) NOT NULL,
  "manager_signature" VARCHAR(180),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS "public"."stock_transfers" (
  "transfer_id" VARCHAR(64) PRIMARY KEY,
  "origin_warehouse_code" VARCHAR(64) NOT NULL REFERENCES "public"."warehouses"("warehouse_code") ON DELETE RESTRICT,
  "target_warehouse_code" VARCHAR(64) NOT NULL REFERENCES "public"."warehouses"("warehouse_code") ON DELETE RESTRICT,
  "item_summary" VARCHAR(255) NOT NULL,
  "carrier_name" VARCHAR(180),
  "manager_signature" VARCHAR(180),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export class PostgresPsqlBootstrapRunner {
  public static resolveEnvConfig(): PostgresEnvConfig | null {
    const host = process.env['DB_HOST']?.trim();
    const password = process.env['POSTGRES_PASSWORD']?.trim();
    if (!host || !password) return null;
    return {
      host,
      port: process.env['DB_PORT']?.trim() || '5432',
      user: process.env['POSTGRES_USER']?.trim() || 'postgres',
      password,
      coreDbName: process.env['POSTGRES_DB']?.trim() || 'proveko_control_db',
    };
  }

  private static runPsql(
    cfg: PostgresEnvConfig,
    dbName: string,
    args: readonly string[],
  ): { ok: boolean; stdout: string; stderr: string } {
    const res = spawnSync(
      'psql',
      ['-h', cfg.host, '-p', cfg.port, '-U', cfg.user, '-d', dbName, '-v', 'ON_ERROR_STOP=1', ...args],
      { env: { ...process.env, PGPASSWORD: cfg.password }, encoding: 'utf8', timeout: 20_000 },
    );
    if (res.error || res.status !== 0) {
      return { ok: false, stdout: res.stdout ?? '', stderr: res.stderr || res.error?.message || 'psql error' };
    }
    return { ok: true, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
  }

  public static ensureDatabaseExists(cfg: PostgresEnvConfig, targetDbName: string): boolean {
    const safeDb = targetDbName.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safeDb) return false;
    const check = this.runPsql(cfg, 'postgres', [
      '-tAc',
      `SELECT 1 FROM pg_database WHERE datname = '${safeDb}';`,
    ]);
    if (!check.ok) return false;
    if (check.stdout.trim() === '1') return true;
    return this.runPsql(cfg, 'postgres', ['-c', `CREATE DATABASE "${safeDb}";`]).ok;
  }

  private static collectSqlFilesSorted(dirPath: string): string[] {
    if (!existsSync(dirPath)) return [];
    const results: string[] = [];
    const entries = readdirSync(dirPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) results.push(...this.collectSqlFilesSorted(fullPath));
      else if (entry.isFile() && entry.name.endsWith('.sql')) results.push(fullPath);
    }
    return results;
  }

  public static runStartupMigrations(migrationsRootDir: string): PostgresBootstrapSummary {
    const cfg = this.resolveEnvConfig();
    if (!cfg) {
      return {
        executedAgainstRealPostgres: false,
        coreDbName: 'proveko_control_db',
        coreFilesApplied: [],
        clientDatabasesProvisioned: [],
        reasonIfSkipped: 'DB_HOST / POSTGRES_PASSWORD no configurados.',
      };
    }
    const ping = this.runPsql(cfg, 'postgres', ['-tAc', 'SELECT 1;']);
    if (!ping.ok) {
      return {
        executedAgainstRealPostgres: false,
        coreDbName: cfg.coreDbName,
        coreFilesApplied: [],
        clientDatabasesProvisioned: [],
        reasonIfSkipped: `PostgreSQL no alcanzable (${ping.stderr.trim()})`,
      };
    }

    this.ensureDatabaseExists(cfg, cfg.coreDbName);
    this.runPsql(cfg, 'postgres', ['-c', 'DROP DATABASE IF EXISTS "db_agrovalle";']);
    this.runPsql(cfg, 'postgres', ['-c', 'DROP DATABASE IF EXISTS "db_labrasa";']);

    const coreFiles = this.collectSqlFilesSorted(join(migrationsRootDir, 'core'));
    const appliedCore: string[] = [];
    for (const filePath of coreFiles) {
      if (this.runPsql(cfg, cfg.coreDbName, ['-c', readFileSync(filePath, 'utf8')]).ok) {
        appliedCore.push(filePath.split('/').pop() ?? filePath);
      }
    }

    const clientDbsQuery = this.runPsql(cfg, cfg.coreDbName, [
      '-tAc',
      "SELECT db_name FROM public.tenant_database_connections WHERE status = 'ACTIVE' ORDER BY db_name ASC;",
    ]);
    const clientDbNames = clientDbsQuery.ok
      ? clientDbsQuery.stdout.split('\n').map((l) => l.trim()).filter(Boolean)
      : ['db_version_prueba'];

    const clientFiles = this.collectSqlFilesSorted(join(migrationsRootDir, 'clients'));
    const provisionedClientDbs: string[] = [];
    for (const clientDb of clientDbNames) {
      if (this.ensureDatabaseExists(cfg, clientDb)) {
        this.runPsql(cfg, clientDb, ['-c', CLIENT_PUBLIC_BASE_DDL]);
        for (const clientSqlPath of clientFiles) {
          this.runPsql(cfg, clientDb, ['-c', readFileSync(clientSqlPath, 'utf8')]);
        }
        provisionedClientDbs.push(clientDb);
      }
    }
    return {
      executedAgainstRealPostgres: true,
      coreDbName: cfg.coreDbName,
      coreFilesApplied: appliedCore,
      clientDatabasesProvisioned: provisionedClientDbs,
    };
  }

  public static provisionNewClientDatabaseInPostgres(input: NewClientPostgresProvisionInput): boolean {
    const cfg = this.resolveEnvConfig();
    if (!cfg) return false;
    const safeDb = input.dbName.replace(/[^a-zA-Z0-9_]/g, '');
    if (!this.ensureDatabaseExists(cfg, safeDb)) return false;

    const esc = (v: string) => v.replace(/'/g, "''");
    this.runPsql(cfg, safeDb, [
      '-c',
      `${CLIENT_PUBLIC_BASE_DDL}
       INSERT INTO "public"."client_internal_roles" ("role_id", "role_name", "description") VALUES
         ('rol-admin', 'Administrador General (Cuenta Admin)', 'Control total en la BD del cliente.'),
         ('rol-cajero', 'Cajero y Facturador', 'Caja POS y Facturación.'),
         ('rol-bodega', 'Encargado de Bodega', 'Existencias, Bodegas y Traslados.')
       ON CONFLICT ("role_id") DO NOTHING;
       INSERT INTO "public"."client_internal_users" ("user_id", "username", "full_name", "email", "role_id", "password_hint", "is_client_admin")
       VALUES ('u-admin', '${esc(input.adminUsername)}', 'Admin ${esc(input.companyName)}', 'admin@${esc(input.slug)}.co', 'rol-admin', '${esc(input.adminPassword)}', TRUE)
       ON CONFLICT ("user_id") DO NOTHING;`,
    ]);

    const clientFiles = this.collectSqlFilesSorted(join(input.migrationsRootDir, 'clients'));
    for (const clientSqlPath of clientFiles) {
      this.runPsql(cfg, safeDb, ['-c', readFileSync(clientSqlPath, 'utf8')]);
    }

    const insertSql = `
      INSERT INTO "control_plane"."tenants" ("id", "slug", "legal_name", "tier", "cell_id", "db_name", "status")
      VALUES ('${esc(input.tenantId)}', '${esc(input.slug)}', '${esc(input.companyName)}', 'PRO', 'cell-alpanel-primary', '${safeDb}', 'ACTIVE')
      ON CONFLICT ("id") DO UPDATE SET "legal_name" = EXCLUDED."legal_name", "db_name" = EXCLUDED."db_name";
      INSERT INTO "public"."tenant_database_connections" (
        "connection_id", "tenant_id", "company_name", "nit", "business_type",
        "db_host", "db_port", "db_name", "db_user", "db_password_secret_ref",
        "admin_username", "admin_password_hint", "max_roles_allowed", "max_users_allowed",
        "enabled_services_json", "enabled_submodules_json", "enabled_features_json", "status"
      ) VALUES (
        'conn-${esc(input.tenantId)}', '${esc(input.tenantId)}', '${esc(input.companyName)}', '${esc(input.nit)}', '${esc(input.businessType)}',
        'db', 5432, '${safeDb}', 'postgres', 'env:POSTGRES_PASSWORD',
        '${esc(input.adminUsername)}', '${esc(input.adminPassword)}', ${Number(input.maxRolesAllowed) || 5}, ${Number(input.maxUsersAllowed) || 10},
        '${esc(JSON.stringify(input.enabledServices))}'::jsonb, '${esc(JSON.stringify(input.enabledSubmodules))}'::jsonb, '${esc(JSON.stringify(input.enabledFeatures))}'::jsonb, 'ACTIVE'
      ) ON CONFLICT ("tenant_id") DO UPDATE SET "db_name" = EXCLUDED."db_name", "company_name" = EXCLUDED."company_name";
    `;
    return this.runPsql(cfg, cfg.coreDbName, ['-c', insertSql]).ok;
  }

  public static listPostgresDatabasesAndClients(): { databases: string[]; rows: Record<string, unknown>[] } {
    const cfg = this.resolveEnvConfig();
    if (!cfg) return { databases: [], rows: [] };
    const dbRes = this.runPsql(cfg, 'postgres', [
      '-tAc',
      "SELECT datname FROM pg_database WHERE datistemplate = false AND datname <> 'postgres' ORDER BY datname ASC;",
    ]);
    const databases = dbRes.ok ? dbRes.stdout.split('\n').map((s) => s.trim()).filter(Boolean) : [];
    const rowsRes = this.runPsql(cfg, cfg.coreDbName, [
      '-tAc',
      "SELECT COALESCE(json_agg(t), '[]'::json) FROM (SELECT tenant_id, company_name, nit, business_type, db_name, db_host, db_port, admin_username, admin_password_hint, max_roles_allowed, max_users_allowed, enabled_services_json, enabled_submodules_json, enabled_features_json FROM public.tenant_database_connections WHERE status = 'ACTIVE' ORDER BY updated_at ASC) t;",
    ]);
    let rows: Record<string, unknown>[] = [];
    if (rowsRes.ok && rowsRes.stdout.trim()) {
      try { rows = JSON.parse(rowsRes.stdout.trim()); } catch { rows = []; }
    }
    return { databases, rows };
  }
}
