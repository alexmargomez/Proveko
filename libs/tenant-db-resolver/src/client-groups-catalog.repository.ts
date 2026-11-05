import {
  type PostgresMigrationDatabaseDriverAdapter,
  sanitizePgIdentifier,
} from './postgres-migration-driver.adapter.js';

export interface ClientGroupsCatalogSnapshot {
  readonly groupsDbName: string;
  readonly groups: Record<string, unknown>[];
  readonly principalModules: Record<string, unknown>[];
  readonly submodules: Record<string, unknown>[];
  readonly features: Record<string, unknown>[];
  readonly bundleItems: Record<string, unknown>[];
}

export interface UpsertClientBusinessGroupInput {
  readonly groupKey: string;
  readonly groupName: string;
  readonly badgeLabel: string;
  readonly description: string;
  readonly baseMonthlyCop: number;
  readonly includedPrincipalServices: readonly string[];
  readonly includedSubmodules: readonly string[];
  readonly includedFeatures: readonly string[];
}

export interface RegisterDeveloperCatalogItemInput {
  readonly itemTier: 'MODULO_PRINCIPAL' | 'SUBMODULO' | 'FUNCIONALIDAD';
  readonly itemKey: string;
  readonly parentServiceKey: string;
  readonly parentSubmoduleKey?: string;
  readonly externalName: string;
  readonly iconEmoji?: string;
  readonly description: string;
  readonly monthlyCop: number;
  readonly targetGroupKey?: string;
}

/**
 * Repositorio Hexagonal para la Base de Datos Dedicada de Grupos de Clientes y Catálogo (`proveko_groups_db`).
 * Permite que los Grupos de Clientes (Bares, Comercio, Agro, etc.) y sus Módulos, Submódulos y Funcionalidades
 * vivan en PostgreSQL y que los Desarrolladores / SuperAdmin puedan crear nuevos ítems y asociarlos a cualquier grupo básico.
 */
export class PostgresClientGroupsCatalogRepository {
  public static readonly DEFAULT_GROUPS_DB_NAME = 'proveko_groups_db';

  constructor(private readonly driver: PostgresMigrationDatabaseDriverAdapter) {}

  public getGroupsAndCatalogSnapshot(
    groupsDbName: string = PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME,
  ): ClientGroupsCatalogSnapshot {
    const safeDb = sanitizePgIdentifier(groupsDbName);
    const res = this.driver.executePsql({
      dbName: safeDb,
      sql: `
        SELECT json_build_object(
          'groups', COALESCE((SELECT json_agg(g ORDER BY g.group_key) FROM public.client_business_groups g WHERE g.is_active = TRUE), '[]'::json),
          'principalModules', COALESCE((SELECT json_agg(m ORDER BY m.service_key) FROM public.catalog_principal_modules m), '[]'::json),
          'submodules', COALESCE((SELECT json_agg(s ORDER BY s.submodule_key) FROM public.catalog_submodules s), '[]'::json),
          'features', COALESCE((SELECT json_agg(f ORDER BY f.feature_key) FROM public.catalog_features f), '[]'::json),
          'bundleItems', COALESCE((SELECT json_agg(b ORDER BY b.bundle_id) FROM public.business_group_bundle_items b WHERE b.included_in_base_plan = TRUE), '[]'::json)
        );
      `,
    });

    if (!res.ok || !res.stdout.trim()) {
      return {
        groupsDbName: safeDb,
        groups: [],
        principalModules: [],
        submodules: [],
        features: [],
        bundleItems: [],
      };
    }

    try {
      const parsed = JSON.parse(res.stdout.trim()) as Partial<ClientGroupsCatalogSnapshot>;
      return {
        groupsDbName: safeDb,
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        principalModules: Array.isArray(parsed.principalModules) ? parsed.principalModules : [],
        submodules: Array.isArray(parsed.submodules) ? parsed.submodules : [],
        features: Array.isArray(parsed.features) ? parsed.features : [],
        bundleItems: Array.isArray(parsed.bundleItems) ? parsed.bundleItems : [],
      };
    } catch {
      return {
        groupsDbName: safeDb,
        groups: [],
        principalModules: [],
        submodules: [],
        features: [],
        bundleItems: [],
      };
    }
  }

  public upsertClientBusinessGroup(
    input: UpsertClientBusinessGroupInput,
    groupsDbName: string = PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME,
  ): boolean {
    const safeDb = sanitizePgIdentifier(groupsDbName);
    const groupRes = this.driver.executePsql({
      dbName: safeDb,
      singleTransaction: true,
      variables: {
        group_key: input.groupKey,
        group_name: input.groupName,
        badge_label: input.badgeLabel,
        description: input.description,
        base_monthly_cop: Math.max(0, Math.round(Number(input.baseMonthlyCop) || 149000)),
      },
      sql: `
        INSERT INTO public.client_business_groups (
          group_key, group_name, badge_label, description, base_monthly_cop, is_active, updated_at
        ) VALUES (
          :'group_key', :'group_name', :'badge_label', :'description', :'base_monthly_cop'::bigint, TRUE, NOW()
        )
        ON CONFLICT (group_key) DO UPDATE SET
          group_name = EXCLUDED.group_name,
          badge_label = EXCLUDED.badge_label,
          description = EXCLUDED.description,
          base_monthly_cop = EXCLUDED.base_monthly_cop,
          updated_at = NOW();

        DELETE FROM public.business_group_bundle_items WHERE group_key = :'group_key';
      `,
    });
    if (!groupRes.ok) return false;

    const bundleEntries: Array<{ tier: string; key: string }> = [
      ...input.includedPrincipalServices.map((key) => ({ tier: 'MODULO_PRINCIPAL', key })),
      ...input.includedSubmodules.map((key) => ({ tier: 'SUBMODULO', key })),
      ...input.includedFeatures.map((key) => ({ tier: 'FUNCIONALIDAD', key })),
    ];

    for (const item of bundleEntries) {
      this.driver.executePsql({
        dbName: safeDb,
        variables: {
          bundle_id: `${input.groupKey}:${item.tier}:${item.key}`,
          group_key: input.groupKey,
          item_tier: item.tier,
          item_key: item.key,
        },
        sql: `
          INSERT INTO public.business_group_bundle_items (
            bundle_id, group_key, item_tier, item_key, included_in_base_plan
          ) VALUES (
            :'bundle_id', :'group_key', :'item_tier', :'item_key', TRUE
          )
          ON CONFLICT (bundle_id) DO UPDATE SET included_in_base_plan = TRUE;
        `,
      });
    }
    return true;
  }

  public registerDeveloperCatalogItem(
    input: RegisterDeveloperCatalogItemInput,
    groupsDbName: string = PostgresClientGroupsCatalogRepository.DEFAULT_GROUPS_DB_NAME,
  ): boolean {
    const safeDb = sanitizePgIdentifier(groupsDbName);
    const cop = Math.max(0, Math.round(Number(input.monthlyCop) || 19000));

    let itemSql = '';
    if (input.itemTier === 'MODULO_PRINCIPAL') {
      itemSql = `
        INSERT INTO public.catalog_principal_modules (
          service_key, external_name, icon_emoji, subtitle, standalone_monthly_cop, updated_at
        ) VALUES (
          :'item_key', :'external_name', :'icon_emoji', :'description', :'monthly_cop'::bigint, NOW()
        )
        ON CONFLICT (service_key) DO UPDATE SET
          external_name = EXCLUDED.external_name,
          subtitle = EXCLUDED.subtitle,
          standalone_monthly_cop = EXCLUDED.standalone_monthly_cop,
          updated_at = NOW();
      `;
    } else if (input.itemTier === 'SUBMODULO') {
      itemSql = `
        INSERT INTO public.catalog_submodules (
          submodule_key, parent_service_key, external_name, tab_icon, summary, addon_monthly_cop, updated_at
        ) VALUES (
          :'item_key', :'parent_service_key', :'external_name', :'icon_emoji', :'description', :'monthly_cop'::bigint, NOW()
        )
        ON CONFLICT (submodule_key) DO UPDATE SET
          external_name = EXCLUDED.external_name,
          summary = EXCLUDED.summary,
          addon_monthly_cop = EXCLUDED.addon_monthly_cop,
          updated_at = NOW();
      `;
    } else {
      itemSql = `
        INSERT INTO public.catalog_features (
          feature_key, parent_service_key, parent_submodule_key, external_name, description, addon_monthly_cop, updated_at
        ) VALUES (
          :'item_key', :'parent_service_key', :'parent_submodule_key', :'external_name', :'description', :'monthly_cop'::bigint, NOW()
        )
        ON CONFLICT (feature_key) DO UPDATE SET
          external_name = EXCLUDED.external_name,
          description = EXCLUDED.description,
          addon_monthly_cop = EXCLUDED.addon_monthly_cop,
          updated_at = NOW();
      `;
    }

    const res = this.driver.executePsql({
      dbName: safeDb,
      singleTransaction: true,
      variables: {
        item_key: input.itemKey,
        parent_service_key: input.parentServiceKey || 'srv-gastro',
        parent_submodule_key: input.parentSubmoduleKey || 'independent',
        external_name: input.externalName,
        icon_emoji: input.iconEmoji || '✨',
        description: input.description,
        monthly_cop: cop,
      },
      sql: itemSql,
    });
    if (!res.ok) return false;

    if (input.targetGroupKey && input.targetGroupKey !== 'NONE') {
      this.driver.executePsql({
        dbName: safeDb,
        variables: {
          bundle_id: `${input.targetGroupKey}:${input.itemTier}:${input.itemKey}`,
          group_key: input.targetGroupKey,
          item_tier: input.itemTier,
          item_key: input.itemKey,
        },
        sql: `
          INSERT INTO public.business_group_bundle_items (
            bundle_id, group_key, item_tier, item_key, included_in_base_plan
          ) VALUES (
            :'bundle_id', :'group_key', :'item_tier', :'item_key', TRUE
          )
          ON CONFLICT (bundle_id) DO UPDATE SET included_in_base_plan = TRUE;
        `,
      });
    }
    return true;
  }
}
