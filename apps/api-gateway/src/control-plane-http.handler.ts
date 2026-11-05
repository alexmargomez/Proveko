import type http from 'node:http';
import type { Ed25519JwtVault } from '@proveko/crypto-vault';
import type { HttpMethodType } from '@proveko/service-guard';
import { PostgresPsqlBootstrapRunner } from '@proveko/tenant-db-resolver';

export interface StandbyCheckoutRequestDto {
  readonly companyName?: string;
  readonly nit?: string;
  readonly adminEmail?: string;
  readonly adminUsername?: string;
  readonly adminPasswordHint?: string;
  readonly businessTypeId?: string;
  readonly monthlyUsd?: number;
  readonly maxRolesAllowed?: number;
  readonly maxUsersAllowed?: number;
  readonly activePrincipalServices?: string[];
  readonly activeSubmodules?: string[];
  readonly activeFeatures?: string[];
}

/**
 * Controlador HTTP de Aprovisionamiento de Clientes (Standby Checkout) y Catálogo de Bases de Datos (SOLID SRP).
 * Elimina la duplicación entre nodos `frontend` y `api-gateway` y delega al motor Hexagonal `PostgresPsqlBootstrapRunner`.
 */
export async function handleControlPlaneAndCheckoutRoutes(params: {
  method: HttpMethodType;
  url: string;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  jwtVault: Ed25519JwtVault;
  migrationsRootDir: string;
  readJsonBody: (req: http.IncomingMessage) => Promise<unknown>;
}): Promise<boolean> {
  const { method, url, req, res, jwtVault, migrationsRootDir, readJsonBody } = params;

  if (method === 'GET' && url === '/api/v1/control/databases') {
    let live = PostgresPsqlBootstrapRunner.listPostgresDatabasesAndClients();
    if (
      process.env.DB_HOST &&
      (!live.databases.includes('proveko_groups_db') ||
        live.databases.includes('db_version_prueba'))
    ) {
      await PostgresPsqlBootstrapRunner.runStartupMigrations(migrationsRootDir);
      live = PostgresPsqlBootstrapRunner.listPostgresDatabasesAndClients();
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(live));
    return true;
  }

  if (method === 'GET' && url === '/api/v1/control/groups-catalog') {
    const snapshot = PostgresPsqlBootstrapRunner.getClientGroupsCatalogFromPostgres();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(snapshot));
    return true;
  }

  if (method === 'POST' && url === '/api/v1/control/client-db/record') {
    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
    const ok = PostgresPsqlBootstrapRunner.saveClientSubmoduleRecordInPostgres({
      dbName: String(body.dbName ?? ''),
      submoduleKey: String(body.submoduleKey ?? 'mod-pos'),
      recordId: String(body.recordId ?? `REG-${Date.now()}`),
      cells: Array.isArray(body.cells) ? (body.cells as string[]) : [],
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok }));
    return true;
  }

  if (method === 'POST' && url === '/api/v1/control/groups-catalog/group') {
    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
    const ok = PostgresPsqlBootstrapRunner.upsertClientBusinessGroupInPostgres({
      groupKey: String(body.groupKey ?? 'nuevo-grupo'),
      groupName: String(body.groupName ?? 'Nuevo Grupo de Clientes'),
      badgeLabel: String(body.badgeLabel ?? 'Plan Base Completo'),
      description: String(body.description ?? ''),
      baseMonthlyCop: Number(body.baseMonthlyCop ?? 149000),
      includedPrincipalServices: Array.isArray(body.includedPrincipalServices)
        ? (body.includedPrincipalServices as string[])
        : [],
      includedSubmodules: Array.isArray(body.includedSubmodules)
        ? (body.includedSubmodules as string[])
        : [],
      includedFeatures: Array.isArray(body.includedFeatures)
        ? (body.includedFeatures as string[])
        : [],
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok }));
    return true;
  }

  if (method === 'POST' && url === '/api/v1/control/groups-catalog/item') {
    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
    const rawTier = String(body.itemTier ?? 'FUNCIONALIDAD');
    const itemTier =
      rawTier === 'MODULO_PRINCIPAL' || rawTier === 'SUBMODULO' ? rawTier : 'FUNCIONALIDAD';
    const ok = PostgresPsqlBootstrapRunner.registerDeveloperCatalogItemInPostgres({
      itemTier,
      itemKey: String(body.itemKey ?? `comp-dev-${Date.now()}`),
      parentServiceKey: String(body.parentServiceKey ?? 'srv-gastro'),
      parentSubmoduleKey: String(body.parentSubmoduleKey ?? 'independent'),
      externalName: String(body.externalName ?? 'Nueva Funcionalidad'),
      iconEmoji: String(body.iconEmoji ?? '✨'),
      description: String(body.description ?? ''),
      monthlyCop: Number(body.monthlyCop ?? 19000),
      targetGroupKey: typeof body.targetGroupKey === 'string' ? body.targetGroupKey : undefined,
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok }));
    return true;
  }

  if (method === 'POST' && url === '/api/v1/payments/checkout/standby') {
    const checkoutReq = ((await readJsonBody(req)) ?? {}) as StandbyCheckoutRequestDto;
    const companyName =
      typeof checkoutReq.companyName === 'string' && checkoutReq.companyName.trim().length > 0
        ? checkoutReq.companyName.trim()
        : 'Nueva Empresa Cliente S.A.S.';
    const nit =
      typeof checkoutReq.nit === 'string' && checkoutReq.nit.trim().length > 0
        ? checkoutReq.nit.trim()
        : '900.000.000-1';
    const rawSlug =
      companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 20) || 'cliente';
    const tenantId = `tnt-${rawSlug}`;
    const dbName = `db_${rawSlug}`;
    const adminUsername =
      typeof checkoutReq.adminUsername === 'string' && checkoutReq.adminUsername.trim().length > 0
        ? checkoutReq.adminUsername.trim()
        : typeof checkoutReq.adminEmail === 'string' && checkoutReq.adminEmail.trim().length > 0
          ? checkoutReq.adminEmail.trim()
          : `admin.${rawSlug}`;
    const temporaryPassword =
      typeof checkoutReq.adminPasswordHint === 'string' &&
      checkoutReq.adminPasswordHint.trim().length > 0
        ? checkoutReq.adminPasswordHint.trim()
        : 'Prov#2026!';
    const paymentReference = `STBY-${Date.now()}`;

    const createdInPostgres =
      await PostgresPsqlBootstrapRunner.provisionNewClientDatabaseInPostgres({
        tenantId,
        slug: rawSlug,
        companyName,
        nit,
        businessType: checkoutReq.businessTypeId ?? 'comercio-retail',
        dbName,
        adminUsername,
        adminPassword: temporaryPassword,
        maxRolesAllowed: checkoutReq.maxRolesAllowed ?? 5,
        maxUsersAllowed: checkoutReq.maxUsersAllowed ?? 10,
        enabledServices: checkoutReq.activePrincipalServices ?? [
          'srv-invoicing',
          'srv-inventory',
        ],
        enabledSubmodules: checkoutReq.activeSubmodules ?? [
          'mod-pos',
          'mod-stock',
          'mod-warehouses',
        ],
        enabledFeatures: checkoutReq.activeFeatures ?? [
          'comp-cashier-name',
          'comp-manager-signature',
        ],
        monthlyAmountUsd: checkoutReq.monthlyUsd ?? 39,
        paymentReference,
        migrationsRootDir,
      });

    const token = jwtVault.signAccessToken({
      tenant_id: tenantId,
      cell_id: 'cell-db-01',
      user_id: `usr-admin-${rawSlug}`,
      role_key: 'cliente',
      tier: 'enterprise',
      is_sandbox: false,
      active_branch_id: 'br-01',
      allowed_branch_ids: ['br-01', 'br-02'],
      sub_ver: 1,
      services: {
        'srv:crm': ['ms:crm-directory'],
        'srv:invoicing': ['ms:invoicing-pos', 'ms:invoicing-electronic-dian'],
        'srv:inventory': ['ms:inventory-stock', 'ms:inventory-recipes'],
      },
      readonly_microservices: [],
    });

    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        paymentStatus: 'STANDBY_APPROVED',
        paymentService: 'ms-payments',
        paymentReference,
        dbName,
        createdInPostgres,
        credential: {
          tenantId,
          companyName,
          nit,
          dbName,
          adminUsername,
          temporaryPassword,
          roleKey: 'cliente',
        },
        token,
      }),
    );
    return true;
  }

  return false;
}
