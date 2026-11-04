import {
  type BranchTransferOrderRecord,
  type CreateBranchTransferDto,
  type InventoryTransfersRepositoryPort,
  buildValidatedBranchTransfer,
} from './domain.js';

export class InventoryTransfersUseCases {
  constructor(private readonly repository: InventoryTransfersRepositoryPort) {}

  public async listTransfers(tenantId: string, activeBranchId: string) {
    const transfers = await this.repository.listByTenantAndBranch(tenantId, activeBranchId);
    return {
      tenantId,
      activeBranchId,
      schema: 'srv_inventory',
      table: 'trf_orders',
      transfers,
    };
  }

  public async createTransfer(
    tenantId: string,
    activeBranchId: string,
    allowedBranchIds: readonly string[],
    dto: CreateBranchTransferDto,
  ): Promise<BranchTransferOrderRecord> {
    const order = buildValidatedBranchTransfer(tenantId, activeBranchId, allowedBranchIds, dto);
    return this.repository.saveTransferOrder(order);
  }
}
