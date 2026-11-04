import {
  type DianElectronicInvoiceResult,
  type EmitDianElectronicInvoiceDto,
  type InvoicingElectronicDianRepositoryPort,
  buildValidatedDianElectronicInvoice,
} from './domain.js';

export class InvoicingElectronicDianUseCases {
  constructor(private readonly repository: InvoicingElectronicDianRepositoryPort) {}

  public async listInvoices(tenantId: string, branchId: string) {
    const invoices = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: 'srv_invoicing',
      table: 'dian_electronic_invoices',
      invoices,
    };
  }

  public async emitInvoice(
    tenantId: string,
    branchId: string,
    dto: EmitDianElectronicInvoiceDto,
  ): Promise<DianElectronicInvoiceResult> {
    const invoice = buildValidatedDianElectronicInvoice(tenantId, branchId, dto);
    return this.repository.saveElectronicInvoice(invoice);
  }
}
