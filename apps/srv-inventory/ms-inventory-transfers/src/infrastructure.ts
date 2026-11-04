import { srvInventorySchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { BranchTransferOrderRecord, InventoryTransfersRepositoryPort } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_inventory` — Prefijo obligatorio `trf_` (`mod:inventory-transfers` / `ms:inventory-transfers`)
 */
export const trfOrdersTable = srvInventorySchema.table('trf_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromBranchId: varchar('from_branch_id', { length: 64 }).notNull(),
  toBranchId: varchar('to_branch_id', { length: 64 }).notNull(),
  sku: varchar('sku', { length: 64 }).notNull(),
  quantity: numeric('quantity', { precision: 19, scale: 4 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('IN_TRANSIT'), // IN_TRANSIT | RECEIVED
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryInventoryTransfersRepositoryAdapter
  implements InventoryTransfersRepositoryPort
{
  private readonly store = new Map<string, BranchTransferOrderRecord[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<BranchTransferOrderRecord[]> {
    const all = this.store.get(tenantId) ?? [];
    return all.filter((o) => o.fromBranchId === branchId || o.toBranchId === branchId);
  }

  public async saveTransferOrder(
    order: BranchTransferOrderRecord,
  ): Promise<BranchTransferOrderRecord> {
    const list = this.store.get(order.tenantId) ?? [];
    list.push(order);
    this.store.set(order.tenantId, list);
    return order;
  }
}
