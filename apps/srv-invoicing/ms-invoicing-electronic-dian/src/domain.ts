import crypto from 'node:crypto';
import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface EmitDianElectronicInvoiceDto {
  prefixAndNumber: string;
  issuerNit: string;
  customerNit: string;
  subtotal: string;
  ivaPercent?: string;
  technicalKey?: string;
  issueDateIso?: string;
}

export interface DianElectronicInvoiceResult {
  tenantId: string;
  branchId: string;
  prefixAndNumber: string;
  subtotal: string;
  ivaTax: string;
  grandTotal: string;
  cufeSha384: string;
  dianStatus: 'QUEUED_FOR_SIGNING' | 'SIGNED_ACCEPTED' | 'REJECTED';
  workerQueue: string;
}

/**
 * Puerto de Repositorio de Facturas Electrónicas DIAN (SOLID DIP)
 */
export interface InvoicingElectronicDianRepositoryPort {
  listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<DianElectronicInvoiceResult[]>;
  saveElectronicInvoice(
    invoice: DianElectronicInvoiceResult,
  ): Promise<DianElectronicInvoiceResult>;
}

/**
 * Calcula el CUFE (Código Único de Factura Electrónica) con SHA-384 según anexo técnico DIAN 1.9
 */
export function computeDeterministicDianCufe(params: {
  invoiceNumber: string;
  issueDateIso: string;
  subtotalFixed2: string;
  ivaFixed2: string;
  totalFixed2: string;
  issuerNit: string;
  customerNit: string;
  technicalKey: string;
}): string {
  const seed = [
    params.invoiceNumber,
    params.issueDateIso,
    params.subtotalFixed2,
    '01',
    params.ivaFixed2,
    '04',
    '0.00',
    '03',
    '0.00',
    params.totalFixed2,
    params.issuerNit,
    params.customerNit,
    params.technicalKey,
  ].join('|');

  return crypto.createHash('sha384').update(seed, 'utf8').digest('hex');
}

export function buildValidatedDianElectronicInvoice(
  tenantId: string,
  branchId: string,
  input: EmitDianElectronicInvoiceDto,
): DianElectronicInvoiceResult {
  if (typeof input.prefixAndNumber !== 'string' || input.prefixAndNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "prefixAndNumber" is required.',
    );
  }
  if (typeof input.issuerNit !== 'string' || input.issuerNit.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "issuerNit" is required.',
    );
  }
  if (typeof input.customerNit !== 'string' || input.customerNit.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "customerNit" is required.',
    );
  }

  const sub = MoneyDecimal.from(input.subtotal).assertPositive('subtotal');
  const iva = sub.applyTaxRatePercent(input.ivaPercent ?? '19.00');
  const total = sub.add(iva);
  const issueDateIso =
    typeof input.issueDateIso === 'string' && input.issueDateIso.trim().length > 0
      ? input.issueDateIso.trim()
      : new Date().toISOString();

  const cufe = computeDeterministicDianCufe({
    invoiceNumber: input.prefixAndNumber.trim(),
    issueDateIso,
    subtotalFixed2: sub.toCurrencyFixed2(),
    ivaFixed2: iva.toCurrencyFixed2(),
    totalFixed2: total.toCurrencyFixed2(),
    issuerNit: input.issuerNit.trim(),
    customerNit: input.customerNit.trim(),
    technicalKey: input.technicalKey?.trim() || 'PROVEKO-DIAN-TECH-KEY-2026',
  });

  return {
    tenantId,
    branchId,
    prefixAndNumber: input.prefixAndNumber.trim(),
    subtotal: sub.toFixed4(),
    ivaTax: iva.toFixed4(),
    grandTotal: total.toFixed4(),
    cufeSha384: cufe,
    dianStatus: 'QUEUED_FOR_SIGNING',
    workerQueue: 'bullmq:dian-xml-signer',
  };
}
