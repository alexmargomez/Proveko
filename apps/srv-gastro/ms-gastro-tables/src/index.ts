import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { GastroTablesUseCases } from './application.js';
import type { GastroTablesRepositoryPort, OccupyTableDto } from './domain.js';
import { InMemoryGastroTablesRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildGastroTablesPlugin(
  repository: GastroTablesRepositoryPort = new InMemoryGastroTablesRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new GastroTablesUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:gastro',
    microserviceKey: 'ms:gastro-tables',
    tablePrefix: 'tbl_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/tables',
        description: 'Consultar mapa de salones y ocupación de mesas en tiempo real',
        handler: async (ctx) => useCases.listTables(ctx.tenantId, ctx.activeBranchId),
      },
      {
        method: 'POST',
        subPath: '/tables/occupy',
        description: 'Abrir mesa y asignar número de comensales',
        handler: async (ctx, req) =>
          useCases.occupyTable(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as OccupyTableDto,
          ),
      },
    ],
  });
}

export const msGastroTablesPlugin = buildGastroTablesPlugin();

export function createStandaloneGastroTablesServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: GastroTablesRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildGastroTablesPlugin(repository) : msGastroTablesPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

