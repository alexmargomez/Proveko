import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { HotelRoomsUseCases } from './application.js';
import type { CreateHotelRoomDto, HotelRoomsRepositoryPort } from './domain.js';
import { InMemoryHotelRoomsRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildHotelRoomsPlugin(
  repository: HotelRoomsRepositoryPort = new InMemoryHotelRoomsRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new HotelRoomsUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:hotel',
    microserviceKey: 'ms:hotel-rooms',
    tablePrefix: 'rom_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/rooms',
        description: 'Listar habitaciones, tarifas y estado de limpieza housekeeping',
        handler: async (ctx) => useCases.listRooms(ctx.tenantId, ctx.activeBranchId),
      },
      {
        method: 'POST',
        subPath: '/rooms',
        description: 'Registrar habitación con tarifa por noche NUMERIC(19, 4)',
        handler: async (ctx, req) =>
          useCases.createRoom(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as CreateHotelRoomDto,
          ),
      },
    ],
  });
}

export const msHotelRoomsPlugin = buildHotelRoomsPlugin();

export function createStandaloneHotelRoomsServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: HotelRoomsRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildHotelRoomsPlugin(repository) : msHotelRoomsPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

