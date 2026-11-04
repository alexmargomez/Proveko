import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface CreateHotelRoomDto {
  roomNumber: string;
  roomCategory: string;
  nightlyRate: string;
}

export interface HotelRoomRecord {
  tenantId: string;
  branchId: string;
  roomNumber: string;
  roomCategory: string;
  nightlyRate: string;
  housekeepingStatus: 'CLEAN' | 'DIRTY' | 'INSPECTED';
}

/**
 * Puerto de Repositorio de Habitaciones y Tarifas (SOLID DIP)
 */
export interface HotelRoomsRepositoryPort {
  listByTenantAndBranch(tenantId: string, branchId: string): Promise<HotelRoomRecord[]>;
  saveRoom(room: HotelRoomRecord): Promise<HotelRoomRecord>;
}

export function buildValidatedHotelRoom(
  tenantId: string,
  branchId: string,
  input: CreateHotelRoomDto,
): HotelRoomRecord {
  if (typeof input.roomNumber !== 'string' || input.roomNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "roomNumber" is required.',
    );
  }
  if (typeof input.roomCategory !== 'string' || input.roomCategory.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "roomCategory" is required.',
    );
  }
  const nightlyRate = MoneyDecimal.from(input.nightlyRate)
    .assertPositive('nightlyRate')
    .toFixed4();

  return {
    tenantId,
    branchId,
    roomNumber: input.roomNumber.trim(),
    roomCategory: input.roomCategory.trim(),
    nightlyRate,
    housekeepingStatus: 'CLEAN',
  };
}
