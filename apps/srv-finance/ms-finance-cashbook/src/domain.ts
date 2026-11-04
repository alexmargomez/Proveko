import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export type CashbookEntryType = 'INCOME' | 'EXPENSE';

export interface RecordCashbookEntryDto {
  entryType: CashbookEntryType;
  concept: string;
  amount: string;
}

export interface CashbookEntryRecord {
  tenantId: string;
  branchId: string;
  entryType: CashbookEntryType;
  concept: string;
  amount: string;
}

/**
 * Puerto de Repositorio del Libro de Caja Simple (SOLID DIP)
 */
export interface FinanceCashbookRepositoryPort {
  listByTenantAndBranch(tenantId: string, branchId: string): Promise<CashbookEntryRecord[]>;
  saveEntry(entry: CashbookEntryRecord): Promise<CashbookEntryRecord>;
}

const VALID_ENTRY_TYPES: ReadonlySet<string> = new Set<CashbookEntryType>(['INCOME', 'EXPENSE']);

export function buildValidatedCashbookEntry(
  tenantId: string,
  branchId: string,
  input: RecordCashbookEntryDto,
): CashbookEntryRecord {
  if (!input.entryType || !VALID_ENTRY_TYPES.has(input.entryType)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Invalid "entryType"; expected INCOME or EXPENSE.',
    );
  }
  if (typeof input.concept !== 'string' || input.concept.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "concept" is required.',
    );
  }
  const amount = MoneyDecimal.from(input.amount).assertPositive('amount').toFixed4();

  return {
    tenantId,
    branchId,
    entryType: input.entryType,
    concept: input.concept.trim(),
    amount,
  };
}
