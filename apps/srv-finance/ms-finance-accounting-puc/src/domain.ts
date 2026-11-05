import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface PucJournalEntryLine {
  pucAccountCode: string; // ej. '110505' Caja General, '413501' Comercio al por menor, '240801' IVA Generado
  thirdPartyContactId: string;
  debit: string;
  credit: string;
}

export interface PostPucJournalVoucherDto {
  voucherNumber: string;
  lines: PucJournalEntryLine[];
}

export interface PucJournalVoucherResult {
  tenantId: string;
  branchId: string;
  voucherNumber: string;
  totalDebit: string;
  totalCredit: string;
  balanced: true;
}

/**
 * Puerto de Repositorio de Comprobantes Contables PUC / NIIF (SOLID DIP)
 */
export interface FinanceAccountingPucRepositoryPort {
  saveJournalVoucher(voucher: PucJournalVoucherResult): Promise<PucJournalVoucherResult>;
  listByTenantAndBranch?(tenantId: string, branchId: string): Promise<PucJournalVoucherResult[]>;
}

export function validateAndBalancePucJournalVoucher(
  tenantId: string,
  branchId: string,
  input: PostPucJournalVoucherDto,
): PucJournalVoucherResult {
  if (typeof input.voucherNumber !== 'string' || input.voucherNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "voucherNumber" is required.',
    );
  }
  if (!Array.isArray(input.lines) || input.lines.length < 2) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'A double-entry accounting voucher requires at least 2 lines.',
    );
  }

  let sumDebit = MoneyDecimal.zero();
  let sumCredit = MoneyDecimal.zero();

  for (let idx = 0; idx < input.lines.length; idx++) {
    const line = input.lines[idx]!;
    if (typeof line.pucAccountCode !== 'string' || line.pucAccountCode.trim().length === 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Journal line at index ${idx} is missing "pucAccountCode".`,
      );
    }
    if (
      typeof line.thirdPartyContactId !== 'string' ||
      line.thirdPartyContactId.trim().length === 0
    ) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Journal line at index ${idx} is missing "thirdPartyContactId".`,
      );
    }

    const debit = MoneyDecimal.from(line.debit).assertNonNegative(`lines[${idx}].debit`);
    const credit = MoneyDecimal.from(line.credit).assertNonNegative(`lines[${idx}].credit`);

    // Una misma línea contable no puede tener débito y crédito simultáneamente ni estar en 0 ambos
    if (debit.isZero() && credit.isZero()) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Journal line at index ${idx} (${line.pucAccountCode}) cannot have both debit and credit equal to 0.`,
      );
    }
    if (!debit.isZero() && !credit.isZero()) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Journal line at index ${idx} (${line.pucAccountCode}) cannot have both debit (${debit.toFixed4()}) and credit (${credit.toFixed4()}) > 0 on the same line.`,
      );
    }

    sumDebit = sumDebit.add(debit);
    sumCredit = sumCredit.add(credit);
  }

  if (!sumDebit.equals(sumCredit) || sumDebit.isZero()) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_ACCOUNTING_IMBALANCE,
      422,
      `Double-entry accounting imbalance: Total Debit (${sumDebit.toFixed4()}) !== Total Credit (${sumCredit.toFixed4()}).`,
      {
        total_debit: sumDebit.toFixed4(),
        total_credit: sumCredit.toFixed4(),
      },
    );
  }

  return {
    tenantId,
    branchId,
    voucherNumber: input.voucherNumber.trim(),
    totalDebit: sumDebit.toFixed4(),
    totalCredit: sumCredit.toFixed4(),
    balanced: true,
  };
}
