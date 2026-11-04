import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { HotelBookingsUseCases } from './application.js';
import type { CreateHotelReservationDto, HotelBookingsRepositoryPort } from './domain.js';
import { InMemoryHotelBookingsRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildHotelBookingsPlugin(
  repository: HotelBookingsRepositoryPort = new InMemoryHotelBookingsRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new HotelBookingsUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:hotel',
    microserviceKey: 'ms:hotel-bookings',
    tablePrefix: 'bkg_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/reservations',
        description: 'Consultar calendario de reservas y ocupación hotelera',
        handler: async (ctx) => useCases.listReservations(ctx.tenantId, ctx.activeBranchId),
      },
      {
        method: 'POST',
        subPath: '/reservations',
        description: 'Crear reserva hotelera calculando total por número de noches',
        handler: async (ctx, req) =>
          useCases.createReservation(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as CreateHotelReservationDto,
          ),
      },
    ],
  });
}

export const msHotelBookingsPlugin = buildHotelBookingsPlugin();

export function createStandaloneHotelBookingsServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: HotelBookingsRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildHotelBookingsPlugin(repository) : msHotelBookingsPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

