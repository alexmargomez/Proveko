import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { InventoryLotsUseCases } from './application.js';
import type { AllocateFefoDto, InventoryLotsRepositoryPort } from './domain.js';
import { InMemoryInventoryLotsRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildInventoryLotsPlugin(
  repository: InventoryLotsRepositoryPort = new InMemoryInventoryLotsRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new InventoryLotsUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:inventory',
    microserviceKey: 'ms:inventory-lots',
    tablePrefix: 'lot_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/batches',
        description: 'Listar lotes y fechas de vencimiento FEFO por sucursal',
        handler: async (ctx) => useCases.listBatches(ctx.tenantId, ctx.activeBranchId),
      },
      {
        method: 'POST',
        subPath: '/batches/allocate-fefo',
        description: 'Asignar lotes bajo regla FEFO (First-Expired, First-Out)',
        handler: async (ctx, req) =>
          useCases.allocateFefo(ctx.tenantId, (req.body ?? {}) as AllocateFefoDto),
      },
    ],
  });
}

export const msInventoryLotsPlugin = buildInventoryLotsPlugin();

export function createStandaloneInventoryLotsServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: InventoryLotsRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildInventoryLotsPlugin(repository) : msInventoryLotsPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

