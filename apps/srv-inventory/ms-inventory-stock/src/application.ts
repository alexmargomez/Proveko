import {
  type InventoryStockRepositoryPort,
  type RecordStockMovementDto,
  type StockMovementResult,
  calculateValidatedKardexMovement,
} from './domain.js';

export class InventoryStockUseCases {
  constructor(private readonly repository: InventoryStockRepositoryPort) {}

  public async listItems(tenantId: string, branchId: string) {
    const items = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: 'srv_inventory',
      table: 'stk_items',
      items,
    };
  }

  public async recordMovement(
    tenantId: string,
    branchId: string,
    dto: RecordStockMovementDto,
  ): Promise<StockMovementResult> {
    const result = calculateValidatedKardexMovement(tenantId, branchId, dto);
    return this.repository.saveStockSnapshot(result);
  }
}
