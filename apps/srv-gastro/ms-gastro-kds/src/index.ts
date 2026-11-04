import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { GastroKdsUseCases } from './application.js';
import type { DispatchKdsTicketDto, GastroKdsRepositoryPort } from './domain.js';
import { InMemoryGastroKdsRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildGastroKdsPlugin(
  repository: GastroKdsRepositoryPort = new InMemoryGastroKdsRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new GastroKdsUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:gastro',
    microserviceKey: 'ms:gastro-kds',
    tablePrefix: 'kds_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/tickets',
        description: 'Consultar comandas activas de cocina y barra KDS',
        handler: async (ctx) => useCases.listTickets(ctx.tenantId, ctx.activeBranchId),
      },
      {
        method: 'POST',
        subPath: '/tickets/dispatch',
        description: 'Enviar comanda a estación de cocina o barra',
        handler: async (ctx, req) =>
          useCases.dispatchTicket(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as DispatchKdsTicketDto,
          ),
      },
    ],
  });
}

export const msGastroKdsPlugin = buildGastroKdsPlugin();

export function createStandaloneGastroKdsServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: GastroKdsRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildGastroKdsPlugin(repository) : msGastroKdsPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

