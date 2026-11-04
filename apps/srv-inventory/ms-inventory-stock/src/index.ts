import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { InventoryStockUseCases } from './application.js';
import type { InventoryStockRepositoryPort, RecordStockMovementDto } from './domain.js';
import { InMemoryInventoryStockRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildInventoryStockPlugin(
  repository: InventoryStockRepositoryPort = new InMemoryInventoryStockRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new InventoryStockUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:inventory',
    microserviceKey: 'ms:inventory-stock',
    tablePrefix: 'stk_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/items',
        description: 'Consultar existencias de Kardex por sucursal activa',
        handler: async (ctx) => useCases.listItems(ctx.tenantId, ctx.activeBranchId),
      },
      {
        method: 'POST',
        subPath: '/movements',
        description: 'Registrar movimiento de Kardex con precisión NUMERIC(19, 4)',
        handler: async (ctx, req) =>
          useCases.recordMovement(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as RecordStockMovementDto,
          ),
      },
    ],
  });
}

export const msInventoryStockPlugin = buildInventoryStockPlugin();

export function createStandaloneInventoryStockServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: InventoryStockRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildInventoryStockPlugin(repository) : msInventoryStockPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

