import {
  type CreateHotelReservationDto,
  type HotelBookingsRepositoryPort,
  type HotelReservationRecord,
  buildValidatedHotelReservation,
} from './domain.js';

export class HotelBookingsUseCases {
  constructor(private readonly repository: HotelBookingsRepositoryPort) {}

  public async listReservations(tenantId: string, branchId: string) {
    const reservations = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: 'srv_hotel',
      table: 'bkg_reservations',
      reservations,
    };
  }

  public async createReservation(
    tenantId: string,
    branchId: string,
    dto: CreateHotelReservationDto,
  ): Promise<HotelReservationRecord> {
    const reservation = buildValidatedHotelReservation(tenantId, branchId, dto);
    return this.repository.saveReservation(reservation);
  }
}
