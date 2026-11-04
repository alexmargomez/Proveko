import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface CreateHotelReservationDto {
  guestContactId: string;
  roomNumber: string;
  nightsCount: number;
  nightlyRate: string;
}

export interface HotelReservationRecord {
  tenantId: string;
  branchId: string;
  guestContactId: string;
  roomNumber: string;
  nightsCount: number;
  estimatedTotal: string;
  status: 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELED';
}

/**
 * Puerto de Repositorio de Reservas Hoteleras (SOLID DIP)
 */
export interface HotelBookingsRepositoryPort {
  listByTenantAndBranch(tenantId: string, branchId: string): Promise<HotelReservationRecord[]>;
  saveReservation(reservation: HotelReservationRecord): Promise<HotelReservationRecord>;
}

export function buildValidatedHotelReservation(
  tenantId: string,
  branchId: string,
  input: CreateHotelReservationDto,
): HotelReservationRecord {
  if (typeof input.guestContactId !== 'string' || input.guestContactId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "guestContactId" is required.',
    );
  }
  if (typeof input.roomNumber !== 'string' || input.roomNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "roomNumber" is required.',
    );
  }
  if (
    typeof input.nightsCount !== 'number' ||
    !Number.isInteger(input.nightsCount) ||
    input.nightsCount <= 0
  ) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "nightsCount" must be a positive integer (> 0).',
    );
  }

  const nightlyRate = MoneyDecimal.from(input.nightlyRate).assertPositive('nightlyRate');
  const total = nightlyRate.mul(input.nightsCount);

  return {
    tenantId,
    branchId,
    guestContactId: input.guestContactId.trim(),
    roomNumber: input.roomNumber.trim(),
    nightsCount: input.nightsCount,
    estimatedTotal: total.toFixed4(),
    status: 'CONFIRMED',
  };
}
