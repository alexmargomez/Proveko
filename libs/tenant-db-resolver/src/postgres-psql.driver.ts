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
      {
        env: { ...process.env, PGPASSWORD: cfg.password },
        encoding: 'utf8',
        timeout: 20_000,
      },
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
    const entries = readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
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
        reasonIfSkipped: 'DB_HOST / POSTGRES_PASSWORD no configurados en entorno local.',
      };
    }

    const ping = this.runPsql(cfg, 'postgres', ['-tAc', 'SELECT 1;']);
    if (!ping.ok) {
      return {
        executedAgainstRealPostgres: false,
        coreDbName: cfg.coreDbName,
        coreFilesApplied: [],
        clientDatabasesProvisioned: [],
        reasonIfSkipped: `PostgreSQL no alcanzable vía psql (${ping.stderr.trim()})`,
      };
    }

    this.ensureDatabaseExists(cfg, cfg.coreDbName);
    // Eliminar BDs random previas si existían
    this.runPsql(cfg, 'postgres', ['-c', 'DROP DATABASE IF EXISTS "db_agrovalle";']);
    this.runPsql(cfg, 'postgres', ['-c', 'DROP DATABASE IF EXISTS "db_labrasa";']);

    const coreFiles = this.collectSqlFilesSorted(join(migrationsRootDir, 'core'));
    const appliedCore: string[] = [];
    for (const filePath of coreFiles) {
      const sqlContent = readFileSync(filePath, 'utf8');
      if (this.runPsql(cfg, cfg.coreDbName, ['-c', sqlContent]).ok) {
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

    const clientFiles = this.collectSqlFilesSorted(join(input.migrationsRootDir, 'clients'));
    for (const clientSqlPath of clientFiles) {
      this.runPsql(cfg, safeDb, ['-c', readFileSync(clientSqlPath, 'utf8')]);
    }

    const esc = (v: string) => v.replace(/'/g, "''");
    const insertSql = `
      INSERT INTO "control_plane"."tenants" ("id", "slug", "legal_name", "tier", "cell_id", "db_name", "status")
      VALUES ('${esc(input.tenantId)}', '${esc(input.slug)}', '${esc(input.companyName)}', 'PRO', 'cell-alpanel-primary', '${safeDb}', 'ACTIVE')
      ON CONFLICT ("id") DO NOTHING;
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
      ) ON CONFLICT ("tenant_id") DO NOTHING;
      INSERT INTO "public"."subscription_payments" ("payment_id", "tenant_id", "plan_name", "monthly_amount_usd", "payment_gateway_state", "payment_reference")
      VALUES ('pay-${esc(input.tenantId)}', '${esc(input.tenantId)}', '${esc(input.businessType)}', ${Number(input.monthlyAmountUsd) || 0}, 'STANDBY_MICROSERVICE', '${esc(input.paymentReference)}')
      ON CONFLICT ("payment_id") DO NOTHING;
    `;
    return this.runPsql(cfg, cfg.coreDbName, ['-c', insertSql]).ok;
  }
}
