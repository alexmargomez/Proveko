import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { CrmLoyaltyUseCases } from './application.js';
import {
  type AccrueLoyaltyDto,
  type CrmLoyaltyRepositoryPort,
  DefaultPercentLoyaltyAccrualPolicy,
  type LoyaltyAccrualPolicyPort,
} from './domain.js';
import { InMemoryCrmLoyaltyRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildCrmLoyaltyPlugin(
  repository: CrmLoyaltyRepositoryPort = new InMemoryCrmLoyaltyRepositoryAdapter(),
  accrualPolicy: LoyaltyAccrualPolicyPort = new DefaultPercentLoyaltyAccrualPolicy(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new CrmLoyaltyUseCases(repository, accrualPolicy);

  return defineProvekoMicroservice({
    parentService: 'srv:crm',
    microserviceKey: 'ms:crm-loyalty',
    tablePrefix: 'loy_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/wallets',
        description: 'Consultar saldos de puntos de fidelización',
        handler: async (ctx) => useCases.listWallets(ctx.tenantId),
      },
      {
        method: 'POST',
        subPath: '/accrue',
        description: 'Acumular puntos de fidelización por compra validada',
        handler: async (ctx, req) =>
          useCases.accruePoints(ctx.tenantId, (req.body ?? {}) as AccrueLoyaltyDto),
      },
    ],
  });
}

export const msCrmLoyaltyPlugin = buildCrmLoyaltyPlugin();

export function createStandaloneCrmLoyaltyServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: CrmLoyaltyRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildCrmLoyaltyPlugin(repository) : msCrmLoyaltyPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

