import {
  type MicroserviceKey,
  MoneyDecimal,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
} from '@proveko/shared-kernel';

export interface PosCheckoutLineInput {
  sku: string;
  quantity: string;
  unitPrice: string;
  taxPercent: string;
}

export interface PosCheckoutDto {
  contactId: string;
  lines: PosCheckoutLineInput[];
}

export interface PosSaleTicketResult {
  tenantId: string;
  branchId: string;
  contactId: string;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  resolvedFiscalEmitter: 'ms:invoicing-electronic-dian' | 'ms:invoicing-simple-receipt';
}

/**
 * Puerto de Repositorio para Caja POS (SOLID DIP)
 */
export interface InvoicingPosRepositoryPort {
  listShiftsByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<Array<Record<string, unknown>>>;
  saveSaleTicket(ticket: PosSaleTicketResult): Promise<PosSaleTicketResult>;
}

export function calculateValidatedPosCheckout(
  tenantId: string,
  branchId: string,
  activeInvoicingChildren: readonly MicroserviceKey[],
  input: PosCheckoutDto,
): PosSaleTicketResult {
  if (typeof input.contactId !== 'string' || input.contactId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "contactId" is required.',
    );
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'POS checkout "lines" must be a non-empty array.',
    );
  }

  let subtotal = MoneyDecimal.zero();
  let taxTotal = MoneyDecimal.zero();

  for (let idx = 0; idx < input.lines.length; idx++) {
    const line = input.lines[idx]!;
    if (typeof line.sku !== 'string' || line.sku.trim().length === 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `POS line at index ${idx} is missing "sku".`,
      );
    }
    const qty = MoneyDecimal.from(line.quantity).assertPositive(`lines[${idx}].quantity`);
    const unitPrice = MoneyDecimal.from(line.unitPrice).assertNonNegative(
      `lines[${idx}].unitPrice`,
    );
    const lineSub = qty.mul(unitPrice);
    const lineTax = lineSub.applyTaxRatePercent(line.taxPercent);
    subtotal = subtotal.add(lineSub);
    taxTotal = taxTotal.add(lineTax);
  }

  const grandTotal = subtotal.add(taxTotal);
  const emitter = activeInvoicingChildren.includes('ms:invoicing-electronic-dian')
    ? 'ms:invoicing-electronic-dian'
    : 'ms:invoicing-simple-receipt';

  return {
    tenantId,
    branchId,
    contactId: input.contactId.trim(),
    subtotal: subtotal.toFixed4(),
    taxTotal: taxTotal.toFixed4(),
    grandTotal: grandTotal.toFixed4(),
    resolvedFiscalEmitter: emitter,
  };
}
