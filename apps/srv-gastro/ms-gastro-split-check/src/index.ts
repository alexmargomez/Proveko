import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvGastroSchema } from '@proveko/tenant-db-resolver';
import { integer, numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_gastro` — Prefijo obligatorio `spl_` (`ms:gastro-split-check`)
 */
export const splSplitBillsTable = srvGastroSchema.table('spl_split_bills', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  tableCode: varchar('table_code', { length: 32 }).notNull(),
  seatNumber: integer('seat_number').notNull(),
  subtotal: numeric('subtotal', { precision: 19, scale: 4 }).notNull(),
  serviceTip: numeric('service_tip', { precision: 19, scale: 4 }).notNull(),
  totalDue: numeric('total_due', { precision: 19, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const msGastroSplitCheckPlugin = defineProvekoMicroservice({
  parentService: 'srv:gastro',
  microserviceKey: 'ms:gastro-split-check',
  tablePrefix: 'spl_',
  version: '1.0.0',
  routes: [
    {
      method: 'POST',
      subPath: '/checks/split-by-seats',
      description: 'Dividir cuenta de restaurante por sillas/ítems y calcular propina voluntaria con Decimal',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          tableCode: string;
          seatSubtotals: Array<{ seatNumber: number; subtotal: string }>;
          tipRatePercent?: string;
        };
        const tipRate = body.tipRatePercent ?? '10.00';

        const splits = (body.seatSubtotals ?? []).map((seat) => {
          const sub = MoneyDecimal.from(seat.subtotal);
          const tip = sub.applyTaxRatePercent(tipRate);
          const total = sub.add(tip);
          return {
            seatNumber: seat.seatNumber,
            subtotal: sub.toFixed4(),
            serviceTip: tip.toFixed4(),
            totalDue: total.toFixed4(),
          };
        });

        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          tableCode: body.tableCode,
          splits,
        };
      },
    },
  ],
});

export function createStandaloneGastroSplitCheckServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msGastroSplitCheckPlugin, guard, serverNodeId);
}
