import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { InvoicingPosUseCases } from './application.js';
import type { InvoicingPosRepositoryPort, PosCheckoutDto } from './domain.js';
import { InMemoryInvoicingPosRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildInvoicingPosPlugin(
  repository: InvoicingPosRepositoryPort = new InMemoryInvoicingPosRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new InvoicingPosUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:invoicing',
    microserviceKey: 'ms:invoicing-pos',
    tablePrefix: 'pos_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/shifts',
        description: 'Consultar turnos de caja POS en la sucursal activa',
        handler: async (ctx) => useCases.listShifts(ctx.tenantId, ctx.activeBranchId),
      },
      {
        method: 'POST',
        subPath: '/checkout',
        description: 'Procesar venta en Caja POS calculando totales exactos NUMERIC(19, 4)',
        handler: async (ctx, req) =>
          useCases.checkout(
            ctx.tenantId,
            ctx.activeBranchId,
            ctx.claims.services['srv:invoicing'] ?? [],
            (req.body ?? {}) as PosCheckoutDto,
          ),
      },
    ],
  });
}

export const msInvoicingPosPlugin = buildInvoicingPosPlugin();

export function createStandaloneInvoicingPosServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: InvoicingPosRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildInvoicingPosPlugin(repository) : msInvoicingPosPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

