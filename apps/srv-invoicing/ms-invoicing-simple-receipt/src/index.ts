import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { InvoicingSimpleReceiptUseCases } from './application.js';
import type { EmitSimpleReceiptDto, InvoicingSimpleReceiptRepositoryPort } from './domain.js';
import { InMemoryInvoicingSimpleReceiptRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildInvoicingSimpleReceiptPlugin(
  repository: InvoicingSimpleReceiptRepositoryPort = new InMemoryInvoicingSimpleReceiptRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new InvoicingSimpleReceiptUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:invoicing',
    microserviceKey: 'ms:invoicing-simple-receipt',
    tablePrefix: 'rcp_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/receipts',
        description: 'Consultar recibos simples históricos (permitido incluso en READONLY_ARCHIVE)',
        handler: async (ctx) =>
          useCases.listReceipts(ctx.tenantId, ctx.activeBranchId, ctx.isReadonlyArchive),
      },
      {
        method: 'POST',
        subPath: '/receipts',
        description:
          'Emitir recibo simple no fiscal (bloqueado automáticamente si está en READONLY_ARCHIVE)',
        handler: async (ctx, req) =>
          useCases.emitReceipt(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as EmitSimpleReceiptDto,
          ),
      },
    ],
  });
}

export const msInvoicingSimpleReceiptPlugin = buildInvoicingSimpleReceiptPlugin();

export function createStandaloneInvoicingSimpleReceiptServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: InvoicingSimpleReceiptRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository
    ? buildInvoicingSimpleReceiptPlugin(repository)
    : msInvoicingSimpleReceiptPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

