import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { InvoicingQuotesUseCases } from './application.js';
import type { CreateCommercialQuoteDto, InvoicingQuotesRepositoryPort } from './domain.js';
import { InMemoryInvoicingQuotesRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildInvoicingQuotesPlugin(
  repository: InvoicingQuotesRepositoryPort = new InMemoryInvoicingQuotesRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new InvoicingQuotesUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:invoicing',
    microserviceKey: 'ms:invoicing-quotes',
    tablePrefix: 'quo_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/quotes',
        description: 'Listar cotizaciones y remisiones comerciales',
        handler: async (ctx) => useCases.listQuotes(ctx.tenantId, ctx.activeBranchId),
      },
      {
        method: 'POST',
        subPath: '/quotes',
        description: 'Crear cotización comercial convertible en factura con 1 clic',
        handler: async (ctx, req) =>
          useCases.createQuote(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as CreateCommercialQuoteDto,
          ),
      },
    ],
  });
}

export const msInvoicingQuotesPlugin = buildInvoicingQuotesPlugin();

export function createStandaloneInvoicingQuotesServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: InvoicingQuotesRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildInvoicingQuotesPlugin(repository) : msInvoicingQuotesPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

