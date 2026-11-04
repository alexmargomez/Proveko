import { srvInventorySchema } from '@proveko/tenant-db-resolver';
import { jsonb, numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { InventoryStockRepositoryPort, StockMovementResult } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_inventory` — Prefijo obligatorio `stk_` (`mod:inventory-stock` / `ms:inventory-stock`)
 */
export const stkItemsTable = srvInventorySchema.table('stk_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  sku: varchar('sku', { length: 64 }).notNull(),
  name: varchar('name', { length: 180 }).notNull(),
  qtyOnHand: numeric('qty_on_hand', { precision: 19, scale: 4 }).notNull().default('0.0000'),
  unitCost: numeric('unit_cost', { precision: 19, scale: 4 }).notNull().default('0.0000'),
  salePrice: numeric('sale_price', { precision: 19, scale: 4 }).notNull().default('0.0000'),
  customFields: jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stkMovementsTable = srvInventorySchema.table('stk_movements', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  movementType: varchar('movement_type', { length: 32 }).notNull(), // INBOUND | OUTBOUND_SALE | RECIPE_DEDUCTION | ADJUSTMENT
  quantityDelta: numeric('quantity_delta', { precision: 19, scale: 4 }).notNull(),
  referenceEventId: varchar('reference_event_id', { length: 128 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryInventoryStockRepositoryAdapter implements InventoryStockRepositoryPort {
  private readonly store = new Map<string, StockMovementResult[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<StockMovementResult[]> {
    return [...(this.store.get(`${tenantId}:${branchId}`) ?? [])];
  }

  public async saveStockSnapshot(snapshot: StockMovementResult): Promise<StockMovementResult> {
    const key = `${snapshot.tenantId}:${snapshot.branchId}`;
    const list = this.store.get(key) ?? [];
    const existingIdx = list.findIndex((i) => i.sku === snapshot.sku);
    if (existingIdx >= 0) {
      list[existingIdx] = snapshot;
    } else {
      list.push(snapshot);
    }
    this.store.set(key, list);
    return snapshot;
  }
}
