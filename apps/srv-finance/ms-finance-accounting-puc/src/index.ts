import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { FinanceAccountingPucUseCases } from './application.js';
import type {
  FinanceAccountingPucRepositoryPort,
  PostPucJournalVoucherDto,
} from './domain.js';
import { InMemoryFinanceAccountingPucRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildFinanceAccountingPucPlugin(
  repository: FinanceAccountingPucRepositoryPort = new InMemoryFinanceAccountingPucRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new FinanceAccountingPucUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:finance',
    microserviceKey: 'ms:finance-accounting-puc',
    tablePrefix: 'puc_',
    version: '1.0.0',
    routes: [
      {
        method: 'POST',
        subPath: '/journal/post-voucher',
        description:
          'Contabilizar comprobante PUC/NIIF validando partida doble exacta (Débito == Crédito)',
        handler: async (ctx, req) =>
          useCases.postJournalVoucher(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as PostPucJournalVoucherDto,
          ),
      },
      {
        method: 'GET',
        subPath: '/journal/vouchers',
        description: 'Listar comprobantes contables PUC/NIIF por sucursal',
        handler: async (ctx) => ({
          branchId: ctx.activeBranchId,
          vouchers: await useCases.listVouchers(ctx.tenantId, ctx.activeBranchId),
        }),
      },
      {
        method: 'GET',
        subPath: '/journal/post-voucher',
        description: 'Listar comprobantes contables PUC/NIIF por sucursal (alias)',
        handler: async (ctx) => ({
          branchId: ctx.activeBranchId,
          vouchers: await useCases.listVouchers(ctx.tenantId, ctx.activeBranchId),
        }),
      },
    ],
  });
}

export const msFinanceAccountingPucPlugin = buildFinanceAccountingPucPlugin();

export function createStandaloneFinanceAccountingPucServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: FinanceAccountingPucRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository
    ? buildFinanceAccountingPucPlugin(repository)
    : msFinanceAccountingPucPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

