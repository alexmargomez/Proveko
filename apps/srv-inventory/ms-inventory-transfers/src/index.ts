import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { InventoryTransfersUseCases } from './application.js';
import type { CreateBranchTransferDto, InventoryTransfersRepositoryPort } from './domain.js';
import { InMemoryInventoryTransfersRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildInventoryTransfersPlugin(
  repository: InventoryTransfersRepositoryPort = new InMemoryInventoryTransfersRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new InventoryTransfersUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:inventory',
    microserviceKey: 'ms:inventory-transfers',
    tablePrefix: 'trf_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/transfers',
        description: 'Listar traslados de mercancía entre sucursales',
        handler: async (ctx) => useCases.listTransfers(ctx.tenantId, ctx.activeBranchId),
      },
      {
        method: 'POST',
        subPath: '/transfers',
        description: 'Crear traslado entre sucursales autorizadas del usuario',
        handler: async (ctx, req) =>
          useCases.createTransfer(
            ctx.tenantId,
            ctx.activeBranchId,
            ctx.allowedBranchIds,
            (req.body ?? {}) as CreateBranchTransferDto,
          ),
      },
    ],
  });
}

export const msInventoryTransfersPlugin = buildInventoryTransfersPlugin();

export function createStandaloneInventoryTransfersServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: InventoryTransfersRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildInventoryTransfersPlugin(repository) : msInventoryTransfersPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

