import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface SeatSubtotalInput {
  seatNumber: number;
  subtotal: string;
}

export interface SplitCheckBySeatsDto {
  tableCode: string;
  seatSubtotals: SeatSubtotalInput[];
  tipRatePercent?: string;
}

export interface SplitCheckResult {
  tenantId: string;
  branchId: string;
  tableCode: string;
  splits: Array<{
    seatNumber: number;
    subtotal: string;
    serviceTip: string;
    totalDue: string;
  }>;
}

/**
 * Puerto de Repositorio de División de Cuentas (SOLID DIP)
 */
export interface GastroSplitCheckRepositoryPort {
  listByTenantAndBranch?(tenantId: string, branchId: string): Promise<SplitCheckResult[]>;
  saveSplitCheck(record: SplitCheckResult): Promise<SplitCheckResult>;
}

export function calculateValidatedSplitCheck(
  tenantId: string,
  branchId: string,
  input: SplitCheckBySeatsDto,
): SplitCheckResult {
  if (typeof input.tableCode !== 'string' || input.tableCode.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "tableCode" is required.',
    );
  }
  if (!Array.isArray(input.seatSubtotals) || input.seatSubtotals.length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "seatSubtotals" must be a non-empty array.',
    );
  }

  const tipRate = input.tipRatePercent ?? '10.00';

  const splits = input.seatSubtotals.map((seat, idx) => {
    if (
      typeof seat.seatNumber !== 'number' ||
      !Number.isInteger(seat.seatNumber) ||
      seat.seatNumber <= 0
    ) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Seat at index ${idx} must have a positive integer "seatNumber".`,
      );
    }
    const sub = MoneyDecimal.from(seat.subtotal).assertPositive(
      `seatSubtotals[${idx}].subtotal`,
    );
    const tip = sub.applyTaxRatePercent(tipRate);
    const total = sub.add(tip);
    return {
      seatNumber: seat.seatNumber,
      subtotal: sub.toFixed4(),
      serviceTip: tip.toFixed4(),
      totalDue: total.toFixed4(),
    };
  });

  return {
    tenantId,
    branchId,
    tableCode: input.tableCode.trim(),
    splits,
  };
}
