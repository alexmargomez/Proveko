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

/**
 * Ejecutor real de migraciones SQL sobre PostgreSQL en Docker / ALpanel (`psql`).
 * Garantiza que al construir o reiniciar los contenedores (`core-service` / `api-gateway`),
 * la base principal `proveko_control_db` (`proveko_db`) ejecute `migrations/core/*.sql`
 * (creando SuperAdmin, conexiones a cada BD de cliente, usuarios, roles y pagos Standby)
 * y aprovisione las bases de datos individuales de cada cliente con `migrations/clients/`.
 */
export class PostgresPsqlBootstrapRunner {
  public static resolveEnvConfig(): PostgresEnvConfig | null {
    const host = process.env['DB_HOST']?.trim();
    const password = process.env['POSTGRES_PASSWORD']?.trim();
    if (!host || !password) {
      return null;
    }
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
      return {
        ok: false,
        stdout: res.stdout ?? '',
        stderr: res.stderr || res.error?.message || 'psql error',
      };
    }
    return { ok: true, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
  }

  public static ensureDatabaseExists(cfg: PostgresEnvConfig, targetDbName: string): boolean {
    const safeDb = targetDbName.replace(/[^a-zA-Z0-9_]/g, '');
    if (!safeDb) return false;
    const check = this.runPsql(cfg, cfg.coreDbName, [
      '-tAc',
      `SELECT 1 FROM pg_database WHERE datname = '${safeDb}';`,
    ]);
    if (!check.ok) return false;
    if (check.stdout.trim() === '1') return true;
    const created = this.runPsql(cfg, cfg.coreDbName, [
      '-c',
      `CREATE DATABASE "${safeDb}";`,
    ]);
    return created.ok;
  }

  private static collectSqlFilesSorted(dirPath: string): string[] {
    if (!existsSync(dirPath)) return [];
    const results: string[] = [];
    const entries = readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...this.collectSqlFilesSorted(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.sql')) {
        results.push(fullPath);
      }
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

    // 1. Asegurar que la BD principal `proveko_control_db` exista
    const checkCore = this.runPsql(cfg, 'postgres', [
      '-tAc',
      `SELECT 1 FROM pg_database WHERE datname = '${cfg.coreDbName.replace(/[^a-zA-Z0-9_]/g, '')}';`,
    ]);
    if (checkCore.ok && checkCore.stdout.trim() !== '1') {
      this.runPsql(cfg, 'postgres', [
        '-c',
        `CREATE DATABASE "${cfg.coreDbName.replace(/[^a-zA-Z0-9_]/g, '')}";`,
      ]);
    }

    // 2. Ejecutar todas las migraciones de `migrations/core/*.sql` en `proveko_control_db`
    const coreDir = join(migrationsRootDir, 'core');
    const coreFiles = this.collectSqlFilesSorted(coreDir);
    const appliedCore: string[] = [];
    for (const filePath of coreFiles) {
      const sqlContent = readFileSync(filePath, 'utf8');
      const execRes = this.runPsql(cfg, cfg.coreDbName, ['-c', sqlContent]);
      if (execRes.ok) {
        appliedCore.push(filePath.split('/').pop() ?? filePath);
      }
    }

    // 3. Consultar las BDs de clientes registradas en `public.tenant_database_connections`
    const clientDbsQuery = this.runPsql(cfg, cfg.coreDbName, [
      '-tAc',
      "SELECT db_name FROM public.tenant_database_connections WHERE status = 'ACTIVE' ORDER BY db_name ASC;",
    ]);
    const clientDbNames = clientDbsQuery.ok
      ? clientDbsQuery.stdout
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      : ['db_version_prueba'];

    // 4. Crear cada BD de cliente si no existe y aplicarle `migrations/clients/**/*.sql`
    const clientFiles = this.collectSqlFilesSorted(join(migrationsRootDir, 'clients'));
    const provisionedClientDbs: string[] = [];
    for (const clientDb of clientDbNames) {
      if (this.ensureDatabaseExists(cfg, clientDb)) {
        for (const clientSqlPath of clientFiles) {
          const sql = readFileSync(clientSqlPath, 'utf8');
          this.runPsql(cfg, clientDb, ['-c', sql]);
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
}
