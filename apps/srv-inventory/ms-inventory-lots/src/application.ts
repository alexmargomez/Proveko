import {
  type AllocateFefoDto,
  type FefoAllocationResult,
  type InventoryLotsRepositoryPort,
  allocateValidatedFefoBatches,
} from './domain.js';

export class InventoryLotsUseCases {
  constructor(private readonly repository: InventoryLotsRepositoryPort) {}

  public async listBatches(tenantId: string, branchId: string) {
    const batches = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: 'srv_inventory',
      table: 'lot_batches',
      batches,
    };
  }

  public async allocateFefo(
    tenantId: string,
    dto: AllocateFefoDto,
  ): Promise<FefoAllocationResult> {
    const result = allocateValidatedFefoBatches(tenantId, dto);
    return this.repository.saveAllocationRecord(result);
  }
}
