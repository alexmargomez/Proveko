import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface EmitSimpleReceiptDto {
  consecutiveNumber: string;
  customerName: string;
  totalAmount: string;
}

export interface SimpleReceiptRecord {
  tenantId: string;
  branchId: string;
  consecutiveNumber: string;
  customerName: string;
  totalAmount: string;
  documentType: 'SIMPLE_NON_FISCAL_RECEIPT';
  status?: string;
}

/**
 * Puerto de Repositorio de Recibos Simples No Fiscales (SOLID DIP)
 */
export interface InvoicingSimpleReceiptRepositoryPort {
  listByTenantAndBranch(tenantId: string, branchId: string): Promise<SimpleReceiptRecord[]>;
  saveReceipt(receipt: SimpleReceiptRecord): Promise<SimpleReceiptRecord>;
}

export function buildValidatedSimpleReceipt(
  tenantId: string,
  branchId: string,
  input: EmitSimpleReceiptDto,
): SimpleReceiptRecord {
  if (typeof input.consecutiveNumber !== 'string' || input.consecutiveNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "consecutiveNumber" is required.',
    );
  }
  if (typeof input.customerName !== 'string' || input.customerName.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "customerName" is required.',
    );
  }
  const totalAmount = MoneyDecimal.from(input.totalAmount)
    .assertPositive('totalAmount')
    .toFixed4();

  return {
    tenantId,
    branchId,
    consecutiveNumber: input.consecutiveNumber.trim(),
    customerName: input.customerName.trim(),
    totalAmount,
    documentType: 'SIMPLE_NON_FISCAL_RECEIPT',
  };
}
