import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export type LedgerType = 'RECEIVABLE_CXC' | 'PAYABLE_CXP';

export interface ApplyArApPaymentDto {
  contactId: string;
  ledgerType: LedgerType;
  outstandingBalance: string;
  paymentAmount: string;
}

export interface ArApPaymentResult {
  tenantId: string;
  branchId: string;
  contactId: string;
  ledgerType: LedgerType;
  remainingBalance: string;
  isSettled: boolean;
}

/**
 * Puerto de Repositorio de Cartera CxC / CxP (SOLID DIP)
 */
export interface FinanceArApRepositoryPort {
  savePaymentApplication(record: ArApPaymentResult): Promise<ArApPaymentResult>;
}

const VALID_LEDGER_TYPES: ReadonlySet<string> = new Set<LedgerType>([
  'RECEIVABLE_CXC',
  'PAYABLE_CXP',
]);

export function calculateValidatedArApPayment(
  tenantId: string,
  branchId: string,
  input: ApplyArApPaymentDto,
): ArApPaymentResult {
  if (typeof input.contactId !== 'string' || input.contactId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "contactId" is required.',
    );
  }
  if (!input.ledgerType || !VALID_LEDGER_TYPES.has(input.ledgerType)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Invalid "ledgerType"; expected RECEIVABLE_CXC or PAYABLE_CXP.',
    );
  }

  const outstanding = MoneyDecimal.from(input.outstandingBalance).assertPositive(
    'outstandingBalance',
  );
  const payment = MoneyDecimal.from(input.paymentAmount).assertPositive('paymentAmount');
  const remaining = outstanding.sub(payment);

  if (remaining.isNegative()) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Payment amount (${payment.toFixed4()}) exceeds outstanding balance (${outstanding.toFixed4()}).`,
      {
        outstanding_balance: outstanding.toFixed4(),
        payment_amount: payment.toFixed4(),
      },
    );
  }

  return {
    tenantId,
    branchId,
    contactId: input.contactId.trim(),
    ledgerType: input.ledgerType,
    remainingBalance: remaining.toFixed4(),
    isSettled: remaining.isZero(),
  };
}
