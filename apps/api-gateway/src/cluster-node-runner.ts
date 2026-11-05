import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ClusterHmacGuard,
  DEFAULT_PROVEKO_CLUSTER_SECRET,
  Ed25519JwtVault,
} from '@proveko/crypto-vault';
import {
  DoubleKeyServiceGuard,
  type HttpMethodType,
  type ParentServiceHostRunner,
} from '@proveko/service-guard';
import {
  SEED_INDUSTRY_PRESETS,
  type MicroserviceKey,
  type ModuleKey,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
  type ParentMicroserviceKey,
  ProvekoDomainError,
  SEED_MICROSERVICES_CATALOG,
  SEED_SERVICES_CATALOG,
  type ServiceKey,
  toModuleNotation,
  toParentMicroserviceNotation,
} from '@proveko/shared-kernel';
import {
  FileBasedMigrationRegistry,
  type PostgresBootstrapSummary,
  PostgresPsqlBootstrapRunner,
} from '@proveko/tenant-db-resolver';
import { createSrvCrmHostRunner } from '../../srv-crm/host-runner/src/index.js';
import { createSrvFinanceHostRunner } from '../../srv-finance/host-runner/src/index.js';
import { createSrvGastroHostRunner } from '../../srv-gastro/host-runner/src/index.js';
import { createSrvHotelHostRunner } from '../../srv-hotel/host-runner/src/index.js';
import { createSrvInventoryHostRunner } from '../../srv-inventory/host-runner/src/index.js';
import { createSrvInvoicingHostRunner } from '../../srv-invoicing/host-runner/src/index.js';
import { renderProvekoWorkstationHtml } from '../../web-app/src/workstation/workstation-ui.renderer.js';
import { FetchUpstreamHttpClientAdapter, ProvekoApiGateway } from './gateway.server.js';
import { UpstreamRouteRegistry } from './routing/upstream-registry.js';
import { TenantTierRateLimiter } from './security/rate-limiter.js';

export type ProvekoClusterNodeRole =
  | 'api-gateway'
  | 'core-service'
  | 'ms-host-runner'
  | 'frontend';

export interface StartClusterNodeOptions {
  nodeRole: ProvekoClusterNodeRole;
  port?: number;
  host?: string;
  jwtMasterSeed?: string;
  jwtKid?: string;
  clusterSecret?: string;
  parentService?: ServiceKey | ParentMicroserviceKey;
  enabledModulesFilter?: string;
  nodeId?: string;
  env?: Record<string, string | undefined>;
}

export interface RunningClusterNodeHandle {
  readonly server: http.Server;
  readonly port: number;
  readonly baseUrl: string;
  readonly nodeRole: ProvekoClusterNodeRole;
  readonly nodeId: string;
  readonly jwtVault: Ed25519JwtVault;
  close(): Promise<void>;
}

function createHostRunnerForParentService(
  parentServiceInput: ServiceKey | ParentMicroserviceKey,
  guard: DoubleKeyServiceGuard,
  enabledModulesFilter: string = '*',
  nodeId?: string,
): ParentServiceHostRunner {
  const normalizedParent = normalizeParentMicroserviceKey(parentServiceInput);
  const resolvedNodeId = nodeId ?? `container:${toParentMicroserviceNotation(normalizedParent)}`;

  switch (normalizedParent) {
    case 'srv:crm':
      return createSrvCrmHostRunner(guard, enabledModulesFilter, resolvedNodeId);
    case 'srv:inventory':
      return createSrvInventoryHostRunner(guard, enabledModulesFilter, resolvedNodeId);
    case 'srv:invoicing':
      return createSrvInvoicingHostRunner(guard, enabledModulesFilter, resolvedNodeId);
    case 'srv:gastro':
      return createSrvGastroHostRunner(guard, enabledModulesFilter, resolvedNodeId);
    case 'srv:hotel':
      return createSrvHotelHostRunner(guard, enabledModulesFilter, resolvedNodeId);
    case 'srv:finance':
      return createSrvFinanceHostRunner(guard, enabledModulesFilter, resolvedNodeId);
  }
}

const MAX_BODY_BYTES = 1_048_576; // 1 MiB

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    totalBytes += buf.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      throw new ProvekoDomainError(
        'ERR_VALIDATION_FAILED',
        413,
        `Request payload exceeds maximum allowed size (${MAX_BODY_BYTES} bytes).`,
      );
    }
    chunks.push(buf);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new ProvekoDomainError(
      'ERR_VALIDATION_FAILED',
      400,
      'Invalid JSON payload in HTTP request body.',
    );
  }
}

/**
 * Arranca un nodo HTTP real para cada contenedor independiente del cluster en ALpanel (`docker-compose.yml`):
 * - `api-gateway`: Punto de entrada perimetral (`BACKEND_PORT`) que balancea hacia cada contenedor `ms-*`.
 * - `core-service`: Plano de control (`:4010`), catálogo de servicios/módulos y registro de migraciones `.sql`.
 * - `ms-host-runner`: Contenedor independiente por Microservicio (`ms:crm`, `ms:inventory`, `ms:invoicing`, `ms:gastro`, `ms:hotel`, `ms:finance`).
 * - `frontend`: Workstation Web App (`FRONTEND_PORT`).
 */
export async function startProvekoClusterNodeHttpServer(
  options: StartClusterNodeOptions,
): Promise<RunningClusterNodeHandle> {
  const env = options.env ?? process.env;
  const host = options.host ?? '0.0.0.0';
  const port = options.port ?? Number(env.PORT ?? 4000);
  const jwtKid = options.jwtKid ?? env.JWT_ACTIVE_KID ?? 'kid-proveko-cluster-2026';
  const jwtMasterSeed =
    options.jwtMasterSeed ??
    env.JWT_MASTER_SEED ??
    'proveko-default-cluster-ed25519-master-seed-2026';
  const clusterSecret =
    options.clusterSecret ??
    env.PROVEKO_CLUSTER_SECRET ??
    DEFAULT_PROVEKO_CLUSTER_SECRET;

  const keyPair = Ed25519JwtVault.deriveDeterministicKeyPairEntry(jwtKid, jwtMasterSeed);
  const jwtVault = new Ed25519JwtVault(jwtKid, [keyPair]);
  const guard = new DoubleKeyServiceGuard(jwtVault);
  const clusterHmacGuard = new ClusterHmacGuard(clusterSecret);

  const nodeId =
    options.nodeId ??
    env.PROVEKO_NODE_ID ??
    `proveko-${options.nodeRole}${options.parentService ? `-${options.parentService}` : ''}`;

  let hostRunner: ParentServiceHostRunner | null = null;
  let gateway: ProvekoApiGateway | null = null;
  let migrationRegistry: FileBasedMigrationRegistry | null = null;
  let postgresBootstrapSummary: PostgresBootstrapSummary | null = null;

  const cwdMigrations = path.resolve(process.cwd(), 'libs/tenant-db-resolver/migrations');
  const relativeMigrations = fileURLToPath(
    new URL('../../../libs/tenant-db-resolver/migrations', import.meta.url),
  );
  const migrationsRootDir =
    env.PROVEKO_MIGRATIONS_DIR ??
    (existsSync(cwdMigrations) ? cwdMigrations : relativeMigrations);

  if (options.nodeRole === 'ms-host-runner') {
    const rawParent = (options.parentService ??
      env.PROVEKO_PARENT_SERVICE ??
      'ms:invoicing') as ParentMicroserviceKey;
    const enabledFilter =
      options.enabledModulesFilter ??
      env.ENABLED_MODULES ??
      env.ENABLED_MICROSERVICES ??
      '*';
    hostRunner = createHostRunnerForParentService(rawParent, guard, enabledFilter, nodeId);
  } else if (options.nodeRole === 'api-gateway') {
    const upstreamRegistry = new UpstreamRouteRegistry(env);
    gateway = new ProvekoApiGateway(
      guard,
      upstreamRegistry,
      new TenantTierRateLimiter(),
      new FetchUpstreamHttpClientAdapter(),
      clusterHmacGuard,
    );
    if (env.DB_HOST) {
      postgresBootstrapSummary = PostgresPsqlBootstrapRunner.runStartupMigrations(migrationsRootDir);
    }
  } else if (options.nodeRole === 'core-service') {
    migrationRegistry = new FileBasedMigrationRegistry();
    migrationRegistry.loadAllCatalogMigrationsFromRoot(migrationsRootDir);
    if (env.DB_HOST) {
      postgresBootstrapSummary = PostgresPsqlBootstrapRunner.runStartupMigrations(migrationsRootDir);
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const method = (req.method?.toUpperCase() ?? 'GET') as HttpMethodType;
      const url = req.url ?? '/';

      // 1. Healthcheck universal para Docker y ALpanel
      if (method === 'GET' && (url === '/health' || url === '/api/v1/health')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        if (options.nodeRole === 'ms-host-runner' && hostRunner) {
          res.end(
            JSON.stringify({
              status: 'healthy',
              nodeRole: options.nodeRole,
              nodeId,
              parentMicroservice: toParentMicroserviceNotation(hostRunner.parentService),
              mountedModules: hostRunner
                .getMountedMicroserviceKeys()
                .map((k) => toModuleNotation(k)),
            }),
          );
          return;
        }
        if (options.nodeRole === 'api-gateway' && gateway) {
          res.end(
            JSON.stringify({
              status: 'healthy',
              nodeRole: options.nodeRole,
              nodeId,
              topology: gateway.upstreamRegistry.getTopologySnapshot(),
            }),
          );
          return;
        }
        if (options.nodeRole === 'core-service' && migrationRegistry) {
          res.end(
            JSON.stringify({
              status: 'healthy',
              nodeRole: options.nodeRole,
              nodeId,
              servicesCount: SEED_SERVICES_CATALOG.length,
              modulesCount: SEED_MICROSERVICES_CATALOG.length,
              sqlMigrationsCount: migrationRegistry.getAllMigrations().length,
            }),
          );
          return;
        }
        res.end(
          JSON.stringify({
            status: 'healthy',
            nodeRole: options.nodeRole,
            nodeId,
          }),
        );
        return;
      }

      // 2. Comportamiento de Contenedor de Microservicio Independiente (`ms-host-runner`)
      if (options.nodeRole === 'ms-host-runner' && hostRunner) {
        const targetModuleHeader = req.headers['x-proveko-target-module'];
        const rawTargetModule = Array.isArray(targetModuleHeader)
          ? targetModuleHeader[0]
          : targetModuleHeader;

        if (!rawTargetModule) {
          res.writeHead(400, { 'content-type': 'application/problem+json' });
          res.end(
            JSON.stringify({
              title: 'Missing Target Module Header',
              status: 400,
              detail: 'Expected header x-proveko-target-module from Proveko API Gateway.',
            }),
          );
          return;
        }

        const targetModule = normalizeModuleKey(rawTargetModule as ModuleKey | MicroserviceKey);
        const authHeaderRaw = req.headers['authorization'] ?? req.headers['Authorization'];
        const authorizationHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw;

        // Sello Criptográfico de Clúster (HMAC-SHA256 + Anti-Replay):
        // Bloquea cualquier acceso directo que no haya pasado por el API Gateway.
        try {
          clusterHmacGuard.verifyInboundRequest(req.headers, {
            method,
            pathAndQuery: url,
            targetParent: hostRunner.parentService,
            targetModule,
            authorizationHeader,
          });
        } catch (hmacErr) {
          if (hmacErr instanceof ProvekoDomainError) {
            res.writeHead(hmacErr.statusCode, {
              'content-type': 'application/problem+json',
              'x-proveko-served-by': nodeId,
            });
            res.end(JSON.stringify(hmacErr.toProblemDetails()));
            return;
          }
          throw hmacErr;
        }

        const body = method !== 'GET' && method !== 'HEAD' ? await readJsonBody(req) : undefined;

        const qIndex = url.indexOf('?');
        const queryParams: Record<string, string> = {};
        if (qIndex >= 0) {
          const searchParams = new URLSearchParams(url.slice(qIndex + 1));
          for (const [k, v] of searchParams.entries()) {
            queryParams[k] = v;
          }
        }

        const result = await hostRunner.dispatch(targetModule, {
          method,
          path: url,
          headers: req.headers,
          body,
          query: queryParams,
        });

        res.writeHead(result.status, result.headers);
        res.end(JSON.stringify(result.body));
        return;
      }

      // 3. Comportamiento de Contenedor API Gateway (`api-gateway`)
      if (options.nodeRole === 'api-gateway' && gateway) {
        if (method === 'GET' && url === '/api/v1/topology') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              gatewayNodeId: nodeId,
              topology: gateway.upstreamRegistry.getTopologySnapshot(),
            }),
          );
          return;
        }

        if (method === 'GET' && url === '/api/v1/control/catalog') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              microservices: SEED_SERVICES_CATALOG.map((s) => ({
                ...s,
                microserviceKey: toParentMicroserviceNotation(s.key),
              })),
              modules: SEED_MICROSERVICES_CATALOG.map((m) => ({
                ...m,
                parentMicroserviceKey: toParentMicroserviceNotation(m.parentService),
                moduleKey: toModuleNotation(m.key),
              })),
              presets: SEED_INDUSTRY_PRESETS,
              topology: gateway.upstreamRegistry.getTopologySnapshot(),
            }),
          );
          return;
        }

        if (method === 'POST' && url === '/api/v1/control/session') {
          const sessionReq = ((await readJsonBody(req)) ?? {}) as {
            tenantId?: string;
            activeBranchId?: string;
            subVer?: number;
            services?: Record<string, MicroserviceKey[]>;
            readonlyMicroservices?: MicroserviceKey[];
          };

          const tenantId =
            typeof sessionReq.tenantId === 'string' && sessionReq.tenantId.trim().length > 0
              ? sessionReq.tenantId.trim()
              : 'db_version_prueba';
          const activeBranchId =
            typeof sessionReq.activeBranchId === 'string' &&
            sessionReq.activeBranchId.trim().length > 0
              ? sessionReq.activeBranchId.trim()
              : 'br-01';
          const rawSubVer = Number(sessionReq.subVer ?? 1);
          const subVer = Number.isInteger(rawSubVer) && rawSubVer >= 1 ? rawSubVer : 1;
          const services = sessionReq.services ?? {
            'srv:crm': ['ms:crm-directory'],
            'srv:invoicing': ['ms:invoicing-pos', 'ms:invoicing-electronic-dian'],
            'srv:inventory': ['ms:inventory-stock'],
          };
          const readonlyMicroservices = Array.isArray(sessionReq.readonlyMicroservices)
            ? sessionReq.readonlyMicroservices
            : [];

          const token = jwtVault.signAccessToken({
            tenant_id: tenantId,
            cell_id: 'cell-db-01',
            user_id: 'usr-workstation-admin',
            role_key: 'admin',
            tier: 'business',
            is_sandbox: tenantId === 'db_version_prueba',
            active_branch_id: activeBranchId,
            allowed_branch_ids: ['br-01', 'br-02'],
            sub_ver: subVer,
            services,
            readonly_microservices: readonlyMicroservices,
          });

          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              token,
              tenantId,
              activeBranchId,
              subVer,
            }),
          );
          return;
        }

        if (method === 'POST' && url === '/api/v1/payments/checkout/standby') {
          const checkoutReq = ((await readJsonBody(req)) ?? {}) as {
            companyName?: string;
            nit?: string;
            adminEmail?: string;
            adminUsername?: string;
            adminPasswordHint?: string;
            businessTypeId?: string;
            monthlyUsd?: number;
            maxRolesAllowed?: number;
            maxUsersAllowed?: number;
            activePrincipalServices?: string[];
            activeSubmodules?: string[];
            activeFeatures?: string[];
          };
          const companyName =
            typeof checkoutReq.companyName === 'string' && checkoutReq.companyName.trim().length > 0
              ? checkoutReq.companyName.trim()
              : 'Nueva Empresa Cliente S.A.S.';
          const nit =
            typeof checkoutReq.nit === 'string' && checkoutReq.nit.trim().length > 0
              ? checkoutReq.nit.trim()
              : '900.000.000-1';
          const rawSlug = companyName
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
            typeof checkoutReq.adminPasswordHint === 'string' && checkoutReq.adminPasswordHint.trim().length > 0
              ? checkoutReq.adminPasswordHint.trim()
              : `Prov#2026!`;
          const paymentReference = `STBY-${Date.now()}`;

          if (env.DB_HOST) {
            PostgresPsqlBootstrapRunner.provisionNewClientDatabaseInPostgres({
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
              enabledServices: checkoutReq.activePrincipalServices ?? ['srv-invoicing', 'srv-inventory'],
              enabledSubmodules: checkoutReq.activeSubmodules ?? ['mod-pos', 'mod-stock', 'mod-warehouses'],
              enabledFeatures: checkoutReq.activeFeatures ?? ['comp-cashier-name', 'comp-manager-signature'],
              monthlyAmountUsd: checkoutReq.monthlyUsd ?? 39,
              paymentReference,
              migrationsRootDir,
            });
          }

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
          return;
        }

        const body = method !== 'GET' && method !== 'HEAD' ? await readJsonBody(req) : undefined;
        const gatewayRes = await gateway.handleGatewayRequest({
          method,
          url,
          headers: req.headers,
          body,
          clientIp: req.socket.remoteAddress,
        });

        res.writeHead(gatewayRes.status, gatewayRes.headers);
        res.end(JSON.stringify(gatewayRes.body));
        return;
      }

      // 4. Comportamiento de Contenedor Control Plane (`core-service`)
      if (options.nodeRole === 'core-service' && migrationRegistry) {
        if (method === 'GET' && url === '/api/v1/control/catalog') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              microservices: SEED_SERVICES_CATALOG.map((s) => ({
                ...s,
                microserviceKey: toParentMicroserviceNotation(s.key),
              })),
              modules: SEED_MICROSERVICES_CATALOG.map((m) => ({
                ...m,
                parentMicroserviceKey: toParentMicroserviceNotation(m.parentService),
                moduleKey: toModuleNotation(m.key),
              })),
              presets: SEED_INDUSTRY_PRESETS,
            }),
          );
          return;
        }

        if (method === 'GET' && url === '/api/v1/control/migrations') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(
            JSON.stringify({
              totalFiles: migrationRegistry.getAllMigrations().length,
              migrations: migrationRegistry.getAllMigrations().map((m) => ({
                version: m.version,
                filename: m.filename,
                parentMicroservice: toParentMicroserviceNotation(m.parentService),
                moduleKey: toModuleNotation(m.moduleKey),
                checksumSha256: m.checksumSha256,
              })),
            }),
          );
          return;
        }
      }

      // 5. Comportamiento de Contenedor Frontend Workstation (`frontend`)
      if (options.nodeRole === 'frontend') {
        const initialSurface = url.startsWith('/app') ? 'workstation' : 'landing';
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
          'referrer-policy': 'strict-origin-when-cross-origin',
        });
        res.end(
          renderProvekoWorkstationHtml({
            appUrl: env.APP_URL,
            appDomain: env.APP_DOMAIN,
            initialSurface,
          }),
        );
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', nodeRole: options.nodeRole, url }));
    } catch (err) {
      if (err instanceof ProvekoDomainError) {
        res.writeHead(err.statusCode, { 'content-type': 'application/problem+json' });
        res.end(JSON.stringify(err.toProblemDetails()));
        return;
      }
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Internal Server Error',
        }),
      );
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;
  const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;

  return {
    server,
    port: actualPort,
    baseUrl: `http://${displayHost}:${actualPort}`,
    nodeRole: options.nodeRole,
    nodeId,
    jwtVault,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

// Auto-arranque cuando se invoca directamente como entrypoint de contenedor Docker en ALpanel
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && process.argv[1] === currentFilePath) {
  const role = (process.env.PROVEKO_NODE_ROLE ?? 'api-gateway') as ProvekoClusterNodeRole;
  startProvekoClusterNodeHttpServer({ nodeRole: role })
    .then((handle) => {
      console.log(
        `[Proveko Cluster] Node "${handle.nodeId}" (${handle.nodeRole}) listening on ${handle.baseUrl}`,
      );
    })
    .catch((err) => {
      console.error('[Proveko Cluster] Fatal startup error:', err);
      process.exit(1);
    });
}
