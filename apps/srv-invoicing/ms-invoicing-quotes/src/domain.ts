import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface CreateCommercialQuoteDto {
  contactId: string;
  quoteNumber: string;
  totalAmount: string;
}

export interface CommercialQuoteRecord {
  tenantId: string;
  branchId: string;
  contactId: string;
  quoteNumber: string;
  totalAmount: string;
  status: 'OPEN' | 'CONVERTED_TO_INVOICE' | 'EXPIRED';
}

/**
 * Puerto de Repositorio de Cotizaciones Comerciales (SOLID DIP)
 */
export interface InvoicingQuotesRepositoryPort {
  listByTenantAndBranch(tenantId: string, branchId: string): Promise<CommercialQuoteRecord[]>;
  saveQuote(quote: CommercialQuoteRecord): Promise<CommercialQuoteRecord>;
}

export function buildValidatedCommercialQuote(
  tenantId: string,
  branchId: string,
  input: CreateCommercialQuoteDto,
): CommercialQuoteRecord {
  if (typeof input.contactId !== 'string' || input.contactId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "contactId" is required.',
    );
  }
  if (typeof input.quoteNumber !== 'string' || input.quoteNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "quoteNumber" is required.',
    );
  }
  const totalAmount = MoneyDecimal.from(input.totalAmount)
    .assertPositive('totalAmount')
    .toFixed4();

  return {
    tenantId,
    branchId,
    contactId: input.contactId.trim(),
    quoteNumber: input.quoteNumber.trim(),
    totalAmount,
    status: 'OPEN',
  };
}
