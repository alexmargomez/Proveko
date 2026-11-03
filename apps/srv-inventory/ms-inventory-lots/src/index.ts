import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvInventorySchema } from '@proveko/tenant-db-resolver';
import { date, numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_inventory` — Prefijo obligatorio `lot_` (`ms:inventory-lots`)
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

export interface LotBatchCandidate {
  batchCode: string;
  expirationDate: string; // YYYY-MM-DD
  availableQty: string;
}

export const msInventoryLotsPlugin = defineProvekoMicroservice({
  parentService: 'srv:inventory',
  microserviceKey: 'ms:inventory-lots',
  tablePrefix: 'lot_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/batches',
      description: 'Listar lotes y fechas de vencimiento FEFO por sucursal',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        branchId: ctx.activeBranchId,
        schema: 'srv_inventory',
        table: 'lot_batches',
        batches: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/batches/allocate-fefo',
      description: 'Asignar lotes bajo regla FEFO (First-Expired, First-Out)',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          sku: string;
          requestedQty: string;
          batches: LotBatchCandidate[];
        };
        const sorted = [...(body.batches ?? [])].sort((a, b) =>
          a.expirationDate.localeCompare(b.expirationDate),
        );
        let remaining = MoneyDecimal.from(body.requestedQty);
        const allocations: Array<{ batchCode: string; allocatedQty: string; expirationDate: string }> =
          [];

        for (const batch of sorted) {
          if (remaining.equals(MoneyDecimal.zero())) break;
          const avail = MoneyDecimal.from(batch.availableQty);
          const diff = avail.sub(remaining);
          const take = diff.isNegative() ? avail : remaining;
          allocations.push({
            batchCode: batch.batchCode,
            expirationDate: batch.expirationDate,
            allocatedQty: take.toFixed4(),
          });
          remaining = remaining.sub(take);
        }

        return {
          tenantId: ctx.tenantId,
          sku: body.sku,
          allocations,
          unfulfilledQty: remaining.toFixed4(),
        };
      },
    },
  ],
});

export function createStandaloneInventoryLotsServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msInventoryLotsPlugin, guard, serverNodeId);
}
