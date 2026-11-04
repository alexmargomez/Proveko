import { srvInventorySchema } from '@proveko/tenant-db-resolver';
import { date, numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type {
  FefoAllocationResult,
  InventoryLotsRepositoryPort,
  LotBatchCandidate,
} from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_inventory` — Prefijo obligatorio `lot_` (`mod:inventory-lots` / `ms:inventory-lots`)
 */
export const lotBatchesTable = srvInventorySchema.table('lot_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  sku: varchar('sku', { length: 64 }).notNull(),
  batchCode: varchar('batch_code', { length: 64 }).notNull(),
  expirationDate: date('expiration_date').notNull(),
  availableQty: numeric('available_qty', { precision: 19, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryInventoryLotsRepositoryAdapter implements InventoryLotsRepositoryPort {
  private readonly batchesByKey = new Map<string, LotBatchCandidate[]>();
  private readonly allocationsByTenant = new Map<string, FefoAllocationResult[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<LotBatchCandidate[]> {
    return [...(this.batchesByKey.get(`${tenantId}:${branchId}`) ?? [])];
  }

  public async saveAllocationRecord(record: FefoAllocationResult): Promise<FefoAllocationResult> {
    const list = this.allocationsByTenant.get(record.tenantId) ?? [];
    list.push(record);
    this.allocationsByTenant.set(record.tenantId, list);
    return record;
  }
}
