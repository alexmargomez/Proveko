import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface PostFolioChargeDto {
  roomNumber: string;
  currentBalance: string;
  newChargeAmount: string;
}

export interface RoomFolioBalanceRecord {
  tenantId: string;
  branchId: string;
  roomNumber: string;
  updatedFolioBalance: string;
}

/**
 * Puerto de Repositorio de Folios de Recepción Hotelera (SOLID DIP)
 */
export interface HotelFrontdeskRepositoryPort {
  saveFolioBalance(record: RoomFolioBalanceRecord): Promise<RoomFolioBalanceRecord>;
  listByTenantAndBranch?(tenantId: string, branchId: string): Promise<RoomFolioBalanceRecord[]>;
}

export function calculateValidatedFolioCharge(
  tenantId: string,
  branchId: string,
  input: PostFolioChargeDto,
): RoomFolioBalanceRecord {
  if (typeof input.roomNumber !== 'string' || input.roomNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "roomNumber" is required.',
    );
  }
  const currentBalance = MoneyDecimal.from(input.currentBalance).assertNonNegative(
    'currentBalance',
  );
  const newChargeAmount = MoneyDecimal.from(input.newChargeAmount).assertPositive(
    'newChargeAmount',
  );
  const updatedBalance = currentBalance.add(newChargeAmount);

  return {
    tenantId,
    branchId,
    roomNumber: input.roomNumber.trim(),
    updatedFolioBalance: updatedBalance.toFixed4(),
  };
}
