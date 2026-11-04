import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { FinanceCashbookUseCases } from './application.js';
import type { FinanceCashbookRepositoryPort, RecordCashbookEntryDto } from './domain.js';
import { InMemoryFinanceCashbookRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildFinanceCashbookPlugin(
  repository: FinanceCashbookRepositoryPort = new InMemoryFinanceCashbookRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new FinanceCashbookUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:finance',
    microserviceKey: 'ms:finance-cashbook',
    tablePrefix: 'csh_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/entries',
        description:
          'Consultar movimientos del libro de caja simple (disponible en READONLY_ARCHIVE)',
        handler: async (ctx) =>
          useCases.listEntries(ctx.tenantId, ctx.activeBranchId, ctx.isReadonlyArchive),
      },
      {
        method: 'POST',
        subPath: '/entries',
        description: 'Registrar ingreso o gasto simple (bloqueado si fue reemplazado por PUC)',
        handler: async (ctx, req) =>
          useCases.recordEntry(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as RecordCashbookEntryDto,
          ),
      },
    ],
  });
}

export const msFinanceCashbookPlugin = buildFinanceCashbookPlugin();

export function createStandaloneFinanceCashbookServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: FinanceCashbookRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildFinanceCashbookPlugin(repository) : msFinanceCashbookPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

