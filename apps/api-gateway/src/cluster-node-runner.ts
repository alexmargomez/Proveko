import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ed25519JwtVault } from '@proveko/crypto-vault';
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
  SEED_MICROSERVICES_CATALOG,
  SEED_SERVICES_CATALOG,
  type ServiceKey,
  toModuleNotation,
  toParentMicroserviceNotation,
} from '@proveko/shared-kernel';
import { FileBasedMigrationRegistry } from '@proveko/tenant-db-resolver';
import { createSrvCrmHostRunner } from '../../srv-crm/host-runner/src/index.js';
import { createSrvFinanceHostRunner } from '../../srv-finance/host-runner/src/index.js';
import { createSrvGastroHostRunner } from '../../srv-gastro/host-runner/src/index.js';
import { createSrvHotelHostRunner } from '../../srv-hotel/host-runner/src/index.js';
import { createSrvInventoryHostRunner } from '../../srv-inventory/host-runner/src/index.js';
import { createSrvInvoicingHostRunner } from '../../srv-invoicing/host-runner/src/index.js';
import { ProvekoApiGateway } from './gateway.server.js';
import { UpstreamRouteRegistry } from './routing/upstream-registry.js';

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

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return undefined;
  return JSON.parse(raw);
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

  const keyPair = Ed25519JwtVault.deriveDeterministicKeyPairEntry(jwtKid, jwtMasterSeed);
  const jwtVault = new Ed25519JwtVault(jwtKid, [keyPair]);
  const guard = new DoubleKeyServiceGuard(jwtVault);

  const nodeId =
    options.nodeId ??
    env.PROVEKO_NODE_ID ??
    `proveko-${options.nodeRole}${options.parentService ? `-${options.parentService}` : ''}`;

  let hostRunner: ParentServiceHostRunner | null = null;
  let gateway: ProvekoApiGateway | null = null;
  let migrationRegistry: FileBasedMigrationRegistry | null = null;

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
    gateway = new ProvekoApiGateway(guard, upstreamRegistry);
  } else if (options.nodeRole === 'core-service') {
    const cwdMigrations = path.resolve(process.cwd(), 'libs/tenant-db-resolver/migrations');
    const relativeMigrations = fileURLToPath(
      new URL('../../../libs/tenant-db-resolver/migrations', import.meta.url),
    );
    const migrationsRootDir =
      env.PROVEKO_MIGRATIONS_DIR ??
      (existsSync(cwdMigrations) ? cwdMigrations : relativeMigrations);
    migrationRegistry = new FileBasedMigrationRegistry();
    migrationRegistry.loadAllCatalogMigrationsFromRoot(migrationsRootDir);
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
        const apiUrl = env.APP_URL ?? `http://localhost:${env.BACKEND_PORT ?? '4000'}`;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Proveko — Plataforma SaaS Modular Multi-Tenant</title>
</head>
<body style="font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 2rem;">
  <h1>Proveko Workstation</h1>
  <p>Arquitectura de Microservicios Independientes (<code>ms:&lt;dominio&gt;</code>) + Módulos Activables (<code>mod:&lt;dominio&gt;-&lt;modulo&gt;</code>) + Bases de Datos por Cliente.</p>
  <p>API Gateway conectado en: <code>${apiUrl}</code></p>
</body>
</html>`);
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', nodeRole: options.nodeRole, url }));
    } catch (err) {
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
