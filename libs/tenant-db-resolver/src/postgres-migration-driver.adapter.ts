import { spawnSync } from 'node:child_process';
import type { MicroserviceKey } from '@proveko/shared-kernel';
import type {
  AppliedMigrationRecord,
  MigrationDatabaseDriverPort,
  MigrationFileDescriptor,
} from './file-migration.engine.js';

export interface PostgresEnvConfig {
  readonly host: string;
  readonly port: string;
  readonly user: string;
  readonly password: string;
  readonly coreDbName: string;
}

const SAFE_PG_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/;

export function sanitizePgIdentifier(raw: string): string {
  const cleaned = raw.trim();
  if (!SAFE_PG_IDENTIFIER_REGEX.test(cleaned)) {
    throw new Error(`Invalid PostgreSQL identifier "${raw}".`);
  }
  return cleaned;
}

/**
 * Adaptador PostgreSQL real para `MigrationDatabaseDriverPort` (Arquitectura Hexagonal / SOLID DIP + SRP).
 * - Optimización O(1) en memoria para `ensureDatabaseExists` y `ensureMigrationLedgerTable`.
 * - Variables parametrizadas nativas de `psql` (`-v var=val` -> `:'var'` / `:"var"`) sin concatenación insegura.
 * - Ejecución transaccional atómica (`--single-transaction`) pasando el archivo `.sql` por `stdin`.
 */
export class PostgresMigrationDatabaseDriverAdapter implements MigrationDatabaseDriverPort {
  private readonly ensuredDatabases = new Set<string>();
  private readonly ensuredLedgerSchemas = new Set<string>();

  constructor(private readonly cfg: PostgresEnvConfig) {}

  public static resolveEnvConfig(
    env: Record<string, string | undefined> = process.env,
  ): PostgresEnvConfig | null {
    const host = env['DB_HOST']?.trim();
    const password = env['POSTGRES_PASSWORD']?.trim();
    if (!host || !password) return null;
    return {
      host,
      port: env['DB_PORT']?.trim() || '5432',
      user: env['POSTGRES_USER']?.trim() || 'postgres',
      password,
      coreDbName: env['POSTGRES_DB']?.trim() || 'proveko_control_db',
    };
  }

  public executePsql(params: {
    dbName: string;
    sql: string;
    variables?: Record<string, string | number>;
    singleTransaction?: boolean;
  }): { ok: boolean; stdout: string; stderr: string } {
    const args: string[] = [
      '-h',
      this.cfg.host,
      '-p',
      this.cfg.port,
      '-U',
      this.cfg.user,
      '-d',
      params.dbName,
      '-X',
      '-q',
      '-t',
      '-A',
      '-v',
      'ON_ERROR_STOP=1',
    ];
    if (params.singleTransaction) {
      args.push('-1');
    }
    if (params.variables) {
      for (const [k, v] of Object.entries(params.variables)) {
        args.push('-v', `${sanitizePgIdentifier(k)}=${String(v)}`);
      }
    }

    const res = spawnSync('psql', args, {
      env: { ...process.env, PGPASSWORD: this.cfg.password },
      input: params.sql,
      encoding: 'utf8',
      timeout: 20_000,
    });

    if (res.error || res.status !== 0) {
      return {
        ok: false,
        stdout: res.stdout ?? '',
        stderr: res.stderr || res.error?.message || 'psql execution failed',
      };
    }
    return { ok: true, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
  }

  public isReachable(): { ok: boolean; reason?: string } {
    const ping = this.executePsql({ dbName: 'postgres', sql: 'SELECT 1;' });
    return ping.ok ? { ok: true } : { ok: false, reason: ping.stderr.trim() };
  }

  public ensureDatabaseExists(targetDbName: string): boolean {
    const safeDb = sanitizePgIdentifier(targetDbName);
    if (this.ensuredDatabases.has(safeDb)) return true;

    const check = this.executePsql({
      dbName: 'postgres',
      sql: "SELECT 1 FROM pg_database WHERE datname = :'db_name';",
      variables: { db_name: safeDb },
    });
    if (!check.ok) return false;

    if (check.stdout.trim() !== '1') {
      const created = this.executePsql({
        dbName: 'postgres',
        sql: 'CREATE DATABASE :"db_name";',
        variables: { db_name: safeDb },
      });
      if (!created.ok) return false;
    }

    this.ensuredDatabases.add(safeDb);
    return true;
  }

  public dropLegacyRandomDatabaseIfExists(targetDbName: string): void {
    const safeDb = sanitizePgIdentifier(targetDbName);
    this.executePsql({
      dbName: 'postgres',
      sql: 'DROP DATABASE IF EXISTS :"db_name";',
      variables: { db_name: safeDb },
    });
  }

  public async tryAcquireAdvisoryLock(_dbName: string, _lockNamespace: string): Promise<boolean> {
    return true;
  }

  public async releaseAdvisoryLock(_dbName: string, _lockNamespace: string): Promise<void> {}

  public async ensureMigrationLedgerTable(dbName: string, schemaName: string): Promise<void> {
    const safeDb = sanitizePgIdentifier(dbName);
    const safeSchema = sanitizePgIdentifier(schemaName);
    const cacheKey = `${safeDb}::${safeSchema}`;
    if (this.ensuredLedgerSchemas.has(cacheKey)) return;

    this.ensureDatabaseExists(safeDb);
    const res = this.executePsql({
      dbName: safeDb,
      singleTransaction: true,
      variables: { schema_name: safeSchema },
      sql: `
        CREATE SCHEMA IF NOT EXISTS :"schema_name";
        CREATE TABLE IF NOT EXISTS :"schema_name".schema_migrations (
          module_key VARCHAR(80) NOT NULL,
          filename VARCHAR(180) NOT NULL,
          version VARCHAR(16) NOT NULL,
          checksum_sha256 VARCHAR(64) NOT NULL,
          applied_at_iso VARCHAR(40) NOT NULL,
          execution_ms INTEGER NOT NULL DEFAULT 1,
          PRIMARY KEY (module_key, filename)
        );
      `,
    });
    if (!res.ok) {
      throw new Error(`Failed to ensure schema_migrations ledger on ${safeDb}.${safeSchema}: ${res.stderr}`);
    }
    this.ensuredLedgerSchemas.add(cacheKey);
  }

  public async getAppliedMigrations(
    dbName: string,
    schemaName: string,
    moduleKey: MicroserviceKey,
  ): Promise<AppliedMigrationRecord[]> {
    const safeDb = sanitizePgIdentifier(dbName);
    const safeSchema = sanitizePgIdentifier(schemaName);
    const res = this.executePsql({
      dbName: safeDb,
      variables: { schema_name: safeSchema, mod_key: moduleKey },
      sql: `
        SELECT COALESCE(json_agg(t ORDER BY t.version ASC), '[]'::json)
        FROM (
          SELECT
            module_key AS "moduleKey",
            filename,
            version,
            checksum_sha256 AS "checksumSha256",
            applied_at_iso AS "appliedAtIso",
            execution_ms AS "executionMs"
          FROM :"schema_name".schema_migrations
          WHERE module_key = :'mod_key'
        ) t;
      `,
    });
    if (!res.ok || !res.stdout.trim()) return [];
    try {
      return JSON.parse(res.stdout.trim()) as AppliedMigrationRecord[];
    } catch {
      return [];
    }
  }

  public async executeMigrationInTransaction(
    dbName: string,
    schemaName: string,
    descriptor: MigrationFileDescriptor,
  ): Promise<AppliedMigrationRecord> {
    const safeDb = sanitizePgIdentifier(dbName);
    const safeSchema = sanitizePgIdentifier(schemaName);
    const startMs = Date.now();
    const appliedAtIso = new Date().toISOString();

    const migrationRes = this.executePsql({
      dbName: safeDb,
      singleTransaction: true,
      sql: descriptor.sqlUp,
    });
    if (!migrationRes.ok) {
      throw new Error(
        `Migration "${descriptor.filename}" failed on "${safeDb}": ${migrationRes.stderr}`,
      );
    }

    const executionMs = Math.max(1, Date.now() - startMs);
    const ledgerRes = this.executePsql({
      dbName: safeDb,
      singleTransaction: true,
      variables: {
        schema_name: safeSchema,
        mod_key: descriptor.moduleKey,
        filename: descriptor.filename,
        version: descriptor.version,
        checksum: descriptor.checksumSha256,
        applied_at: appliedAtIso,
        exec_ms: executionMs,
      },
      sql: `
        INSERT INTO :"schema_name".schema_migrations (
          module_key, filename, version, checksum_sha256, applied_at_iso, execution_ms
        ) VALUES (
          :'mod_key', :'filename', :'version', :'checksum', :'applied_at', :'exec_ms'::integer
        )
        ON CONFLICT (module_key, filename) DO UPDATE SET
          checksum_sha256 = EXCLUDED.checksum_sha256,
          applied_at_iso = EXCLUDED.applied_at_iso;
      `,
    });
    if (!ledgerRes.ok) {
      throw new Error(`Ledger insert failed on "${safeDb}": ${ledgerRes.stderr}`);
    }

    return {
      moduleKey: descriptor.moduleKey,
      filename: descriptor.filename,
      version: descriptor.version,
      checksumSha256: descriptor.checksumSha256,
      appliedAtIso,
      executionMs,
    };
  }
}
