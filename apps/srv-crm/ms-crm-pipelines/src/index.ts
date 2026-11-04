import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { CrmPipelinesUseCases } from './application.js';
import type { CreatePipelineDealDto, CrmPipelinesRepositoryPort } from './domain.js';
import { InMemoryCrmPipelinesRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildCrmPipelinesPlugin(
  repository: CrmPipelinesRepositoryPort = new InMemoryCrmPipelinesRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new CrmPipelinesUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:crm',
    microserviceKey: 'ms:crm-pipelines',
    tablePrefix: 'pip_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/deals',
        description: 'Consultar oportunidades comerciales del embudo CRM',
        handler: async (ctx) => useCases.listDeals(ctx.tenantId),
      },
      {
        method: 'POST',
        subPath: '/deals',
        description: 'Crear oportunidad comercial en el embudo CRM',
        handler: async (ctx, req) =>
          useCases.createDeal(ctx.tenantId, (req.body ?? {}) as CreatePipelineDealDto),
      },
    ],
  });
}

export const msCrmPipelinesPlugin = buildCrmPipelinesPlugin();

export function createStandaloneCrmPipelinesServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: CrmPipelinesRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildCrmPipelinesPlugin(repository) : msCrmPipelinesPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

