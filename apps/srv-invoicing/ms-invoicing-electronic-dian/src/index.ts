import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { InvoicingElectronicDianUseCases } from './application.js';
import type {
  EmitDianElectronicInvoiceDto,
  InvoicingElectronicDianRepositoryPort,
} from './domain.js';
import { InMemoryInvoicingElectronicDianRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildInvoicingElectronicDianPlugin(
  repository: InvoicingElectronicDianRepositoryPort = new InMemoryInvoicingElectronicDianRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new InvoicingElectronicDianUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:invoicing',
    microserviceKey: 'ms:invoicing-electronic-dian',
    tablePrefix: 'dian_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/invoices',
        description: 'Listar facturas electrónicas DIAN emitidas y su estado CUFE',
        handler: async (ctx) => useCases.listInvoices(ctx.tenantId, ctx.activeBranchId),
      },
      {
        method: 'POST',
        subPath: '/invoices/emit',
        description:
          'Pre-liquidar Factura Electrónica DIAN, calcular CUFE SHA-384 y encolar firma XAdES-EPES en Worker (<15ms sin bloquear Event Loop)',
        handler: async (ctx, req) =>
          useCases.emitInvoice(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as EmitDianElectronicInvoiceDto,
          ),
      },
    ],
  });
}

export const msInvoicingElectronicDianPlugin = buildInvoicingElectronicDianPlugin();

/**
 * Permite desplegar `mod:invoicing-electronic-dian` (`ms:invoicing-electronic-dian`) en un Servidor Dedicado exclusivo para DIAN
 */
export function createStandaloneInvoicingElectronicDianServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId: string = 'dedicated-server:ms:invoicing-electronic-dian',
  repository?: InvoicingElectronicDianRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository
    ? buildInvoicingElectronicDianPlugin(repository)
    : msInvoicingElectronicDianPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

