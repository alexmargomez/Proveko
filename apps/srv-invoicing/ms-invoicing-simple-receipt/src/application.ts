import {
  type EmitSimpleReceiptDto,
  type InvoicingSimpleReceiptRepositoryPort,
  type SimpleReceiptRecord,
  buildValidatedSimpleReceipt,
} from './domain.js';

export class InvoicingSimpleReceiptUseCases {
  constructor(private readonly repository: InvoicingSimpleReceiptRepositoryPort) {}

  public async listReceipts(tenantId: string, branchId: string, isReadonlyArchive: boolean) {
    const receipts = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: 'srv_invoicing',
      table: 'rcp_simple_receipts',
      isReadonlyArchive,
      receipts,
    };
  }

  public async emitReceipt(
    tenantId: string,
    branchId: string,
    dto: EmitSimpleReceiptDto,
  ): Promise<SimpleReceiptRecord> {
    const receipt = buildValidatedSimpleReceipt(tenantId, branchId, dto);
    return this.repository.saveReceipt(receipt);
  }
}
