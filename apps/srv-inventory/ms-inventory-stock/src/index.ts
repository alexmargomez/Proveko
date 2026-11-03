import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvInventorySchema } from '@proveko/tenant-db-resolver';
import { jsonb, numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_inventory` — Prefijo obligatorio `stk_` (`ms:inventory-stock`)
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

export const msInventoryStockPlugin = defineProvekoMicroservice({
  parentService: 'srv:inventory',
  microserviceKey: 'ms:inventory-stock',
  tablePrefix: 'stk_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/items',
      description: 'Consultar existencias de Kardex por sucursal activa',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        branchId: ctx.activeBranchId,
        schema: 'srv_inventory',
        table: 'stk_items',
        items: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/movements',
      description: 'Registrar movimiento de Kardex con precisión NUMERIC(19, 4)',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          sku: string;
          movementType: string;
          currentQty: string;
          quantityDelta: string;
          unitCost: string;
        };
        const currentQty = MoneyDecimal.from(body.currentQty);
        const delta = MoneyDecimal.from(body.quantityDelta);
        const newQty =
          body.movementType === 'INBOUND' ? currentQty.add(delta) : currentQty.sub(delta);
        const unitCost = MoneyDecimal.from(body.unitCost);
        const totalValuation = newQty.mul(unitCost);

        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          sku: body.sku,
          movementType: body.movementType,
          newQtyOnHand: newQty.toFixed4(),
          totalValuation: totalValuation.toFixed4(),
        };
      },
    },
  ],
});

export function createStandaloneInventoryStockServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msInventoryStockPlugin, guard, serverNodeId);
}
