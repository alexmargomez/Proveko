import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { GastroSplitCheckUseCases } from './application.js';
import type { GastroSplitCheckRepositoryPort, SplitCheckBySeatsDto } from './domain.js';
import { InMemoryGastroSplitCheckRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildGastroSplitCheckPlugin(
  repository: GastroSplitCheckRepositoryPort = new InMemoryGastroSplitCheckRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new GastroSplitCheckUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:gastro',
    microserviceKey: 'ms:gastro-split-check',
    tablePrefix: 'spl_',
    version: '1.0.0',
    routes: [
      {
        method: 'POST',
        subPath: '/checks/split-by-seats',
        description:
          'Dividir cuenta de restaurante por sillas/ítems y calcular propina voluntaria con Decimal',
        handler: async (ctx, req) =>
          useCases.splitBySeats(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as SplitCheckBySeatsDto,
          ),
      },
    ],
  });
}

export const msGastroSplitCheckPlugin = buildGastroSplitCheckPlugin();

export function createStandaloneGastroSplitCheckServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: GastroSplitCheckRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildGastroSplitCheckPlugin(repository) : msGastroSplitCheckPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

