import {
  type CreateHotelRoomDto,
  type HotelRoomRecord,
  type HotelRoomsRepositoryPort,
  buildValidatedHotelRoom,
} from './domain.js';

export class HotelRoomsUseCases {
  constructor(private readonly repository: HotelRoomsRepositoryPort) {}

  public async listRooms(tenantId: string, branchId: string) {
    const rooms = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: 'srv_hotel',
      table: 'rom_rooms',
      rooms,
    };
  }

  public async createRoom(
    tenantId: string,
    branchId: string,
    dto: CreateHotelRoomDto,
  ): Promise<HotelRoomRecord> {
    const room = buildValidatedHotelRoom(tenantId, branchId, dto);
    return this.repository.saveRoom(room);
  }
}
