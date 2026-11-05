import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { FinanceArApUseCases } from './application.js';
import type { ApplyArApPaymentDto, FinanceArApRepositoryPort } from './domain.js';
import { InMemoryFinanceArApRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildFinanceArApPlugin(
  repository: FinanceArApRepositoryPort = new InMemoryFinanceArApRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new FinanceArApUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:finance',
    microserviceKey: 'ms:finance-ar-ap',
    tablePrefix: 'arp_',
    version: '1.0.0',
    routes: [
      {
        method: 'POST',
        subPath: '/ledgers/apply-payment',
        description: 'Aplicar abono parcial o total a cartera CxC / CxP',
        handler: async (ctx, req) =>
          useCases.applyPayment(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as ApplyArApPaymentDto,
          ),
      },
      {
        method: 'GET',
        subPath: '/ledgers',
        description: 'Listar aplicaciones de cartera CxC / CxP por sucursal',
        handler: async (ctx) => ({
          branchId: ctx.activeBranchId,
          ledgers: await useCases.listLedgers(ctx.tenantId, ctx.activeBranchId),
        }),
      },
      {
        method: 'GET',
        subPath: '/ledgers/apply-payment',
        description: 'Listar aplicaciones de cartera CxC / CxP por sucursal (alias)',
        handler: async (ctx) => ({
          branchId: ctx.activeBranchId,
          ledgers: await useCases.listLedgers(ctx.tenantId, ctx.activeBranchId),
        }),
      },
    ],
  });
}

export const msFinanceArApPlugin = buildFinanceArApPlugin();

export function createStandaloneFinanceArApServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: FinanceArApRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildFinanceArApPlugin(repository) : msFinanceArApPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

