import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { HotelFrontdeskUseCases } from './application.js';
import type { HotelFrontdeskRepositoryPort, PostFolioChargeDto } from './domain.js';
import { InMemoryHotelFrontdeskRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildHotelFrontdeskPlugin(
  repository: HotelFrontdeskRepositoryPort = new InMemoryHotelFrontdeskRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new HotelFrontdeskUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:hotel',
    microserviceKey: 'ms:hotel-frontdesk',
    tablePrefix: 'fdk_',
    version: '1.0.0',
    routes: [
      {
        method: 'POST',
        subPath: '/folios/post-charge',
        description: 'Cargar consumo (minibar/restaurante/alojamiento) al folio de habitación',
        handler: async (ctx, req) =>
          useCases.postFolioCharge(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as PostFolioChargeDto,
          ),
      },
      {
        method: 'GET',
        subPath: '/folios',
        description: 'Listar saldos de folios de habitaciones por sucursal',
        handler: async (ctx) => ({
          branchId: ctx.activeBranchId,
          folios: await useCases.listFolios(ctx.tenantId, ctx.activeBranchId),
        }),
      },
      {
        method: 'GET',
        subPath: '/folios/post-charge',
        description: 'Listar saldos de folios de habitaciones por sucursal (alias)',
        handler: async (ctx) => ({
          branchId: ctx.activeBranchId,
          folios: await useCases.listFolios(ctx.tenantId, ctx.activeBranchId),
        }),
      },
    ],
  });
}

export const msHotelFrontdeskPlugin = buildHotelFrontdeskPlugin();

export function createStandaloneHotelFrontdeskServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: HotelFrontdeskRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildHotelFrontdeskPlugin(repository) : msHotelFrontdeskPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

