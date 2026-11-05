import {
  type PostgresMigrationDatabaseDriverAdapter,
  sanitizePgIdentifier,
} from './postgres-migration-driver.adapter.js';

export interface RegisterTenantCatalogInput {
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
}

export interface ClusterDatabaseCatalogSnapshot {
  readonly databases: string[];
  readonly rows: Record<string, unknown>[];
}

/**
 * Puerto de Repositorio del Catálogo Maestro de Clientes y Bases de Datos (SOLID DIP + ISP)
 */
export interface TenantControlCatalogPort {
  listActiveTenantDatabaseNames(coreDbName: string): string[];
  registerTenantAndSeedClientAdmin(coreDbName: string, input: RegisterTenantCatalogInput): boolean;
  getClusterDatabaseCatalogSnapshot(coreDbName: string): ClusterDatabaseCatalogSnapshot;
}

/**
 * Adaptador de Repositorio PostgreSQL Parametrizado (`-v key=val` -> `:'key'`) para el Catálogo de Clientes (SOLID SRP)
 */
export class PostgresTenantControlCatalogRepository implements TenantControlCatalogPort {
  constructor(private readonly driver: PostgresMigrationDatabaseDriverAdapter) {}

  public listActiveTenantDatabaseNames(coreDbName: string): string[] {
    const res = this.driver.executePsql({
      dbName: sanitizePgIdentifier(coreDbName),
      sql: `
        SELECT db_name
        FROM public.tenant_database_connections
        WHERE status = 'ACTIVE' AND db_name <> 'db_version_prueba'
        ORDER BY db_name ASC;
      `,
    });
    if (!res.ok) return [];
    return res.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((name) => Boolean(name) && name !== 'db_version_prueba');
  }

  public registerTenantAndSeedClientAdmin(
    coreDbName: string,
    input: RegisterTenantCatalogInput,
  ): boolean {
    const safeCoreDb = sanitizePgIdentifier(coreDbName);
    const safeClientDb = sanitizePgIdentifier(input.dbName);

    const seedAdminRes = this.driver.executePsql({
      dbName: safeClientDb,
      singleTransaction: true,
      variables: {
        admin_username: input.adminUsername,
        full_name: `Admin ${input.companyName}`,
        email: `admin@${input.slug}.co`,
        password_hint: input.adminPassword,
      },
      sql: `
        INSERT INTO public.client_internal_users (
          user_id, username, full_name, email, role_id, password_hint, is_client_admin
        ) VALUES (
          'u-admin', :'admin_username', :'full_name', :'email', 'rol-admin', :'password_hint', TRUE
        )
        ON CONFLICT (user_id) DO UPDATE SET
          username = EXCLUDED.username,
          password_hint = EXCLUDED.password_hint;
      `,
    });
    if (!seedAdminRes.ok) return false;

    const registerRes = this.driver.executePsql({
      dbName: safeCoreDb,
      singleTransaction: true,
      variables: {
        conn_id: `conn-${input.tenantId}`,
        tenant_id: input.tenantId,
        slug: input.slug,
        company_name: input.companyName,
        nit: input.nit,
        business_type: input.businessType,
        db_name: safeClientDb,
        admin_username: input.adminUsername,
        admin_password_hint: input.adminPassword,
        max_roles: Math.max(1, Number(input.maxRolesAllowed) || 5),
        max_users: Math.max(1, Number(input.maxUsersAllowed) || 10),
        services_json: JSON.stringify(input.enabledServices),
        submodules_json: JSON.stringify(input.enabledSubmodules),
        features_json: JSON.stringify(input.enabledFeatures),
      },
      sql: `
        INSERT INTO control_plane.tenants (
          id, slug, legal_name, tax_id_nit, tier, is_sandbox, status,
          cell_id, db_name, encrypted_connection_envelope, theme_config
        ) VALUES (
          :'tenant_id', :'slug', :'company_name', :'nit', 'PRO', FALSE, 'ACTIVE',
          'cell-alpanel-primary', :'db_name', '{}'::jsonb, '{}'::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          legal_name = EXCLUDED.legal_name,
          db_name = EXCLUDED.db_name;

        INSERT INTO public.tenant_database_connections (
          connection_id, tenant_id, company_name, nit, business_type,
          db_host, db_port, db_name, db_user, db_password_secret_ref,
          admin_username, admin_password_hint, max_roles_allowed, max_users_allowed,
          enabled_services_json, enabled_submodules_json, enabled_features_json, status
        ) VALUES (
          :'conn_id', :'tenant_id', :'company_name', :'nit', :'business_type',
          'db', 5432, :'db_name', 'postgres', 'env:POSTGRES_PASSWORD',
          :'admin_username', :'admin_password_hint', :'max_roles'::integer, :'max_users'::integer,
          :'services_json'::jsonb, :'submodules_json'::jsonb, :'features_json'::jsonb, 'ACTIVE'
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          db_name = EXCLUDED.db_name,
          company_name = EXCLUDED.company_name,
          max_roles_allowed = EXCLUDED.max_roles_allowed,
          max_users_allowed = EXCLUDED.max_users_allowed;
      `,
    });

    return registerRes.ok;
  }

  public saveClientSubmoduleRecord(params: {
    dbName: string;
    submoduleKey: string;
    recordId: string;
    cells: readonly string[];
  }): boolean {
    const safeClientDb = sanitizePgIdentifier(params.dbName);
    const res = this.driver.executePsql({
      dbName: safeClientDb,
      singleTransaction: true,
      variables: {
        rec_id: params.recordId,
        sub_key: params.submoduleKey,
        cells_json: JSON.stringify(params.cells),
      },
      sql: `
        CREATE TABLE IF NOT EXISTS public.client_submodule_records (
          record_id VARCHAR(64) PRIMARY KEY,
          submodule_key VARCHAR(64) NOT NULL,
          cells_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        INSERT INTO public.client_submodule_records (record_id, submodule_key, cells_json)
        VALUES (:'rec_id', :'sub_key', :'cells_json'::jsonb)
        ON CONFLICT (record_id) DO UPDATE SET cells_json = EXCLUDED.cells_json;
      `,
    });
    return res.ok;
  }

  public getClusterDatabaseCatalogSnapshot(coreDbName: string): ClusterDatabaseCatalogSnapshot {
    const dbRes = this.driver.executePsql({
      dbName: 'postgres',
      sql: `
        SELECT datname
        FROM pg_database
        WHERE datistemplate = false AND datname <> 'postgres' AND datname <> 'db_version_prueba'
        ORDER BY datname ASC;
      `,
    });
    const databases = dbRes.ok
      ? dbRes.stdout
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const rowsRes = this.driver.executePsql({
      dbName: sanitizePgIdentifier(coreDbName),
      sql: `
        SELECT COALESCE(json_agg(t), '[]'::json)
        FROM (
          SELECT
            tenant_id, company_name, nit, business_type, db_name, db_host, db_port,
            admin_username, admin_password_hint, max_roles_allowed, max_users_allowed,
            enabled_services_json, enabled_submodules_json, enabled_features_json
          FROM public.tenant_database_connections
          WHERE status = 'ACTIVE' AND db_name <> 'db_version_prueba'
          ORDER BY updated_at ASC
        ) t;
      `,
    });

    let rows: Record<string, unknown>[] = [];
    if (rowsRes.ok && rowsRes.stdout.trim()) {
      try {
        rows = JSON.parse(rowsRes.stdout.trim()) as Record<string, unknown>[];
      } catch {
        rows = [];
      }
    }
    return { databases, rows };
  }
}

