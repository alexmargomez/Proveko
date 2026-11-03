import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvFinanceSchema } from '@proveko/tenant-db-resolver';
import { date, numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_finance` — Prefijo obligatorio `arp_` (`ms:finance-ar-ap`)
 */
export const arpLedgersTable = srvFinanceSchema.table('arp_ledgers', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  contactId: varchar('contact_id', { length: 64 }).notNull(),
  ledgerType: varchar('ledger_type', { length: 16 }).notNull(), // RECEIVABLE_CXC | PAYABLE_CXP
  originalAmount: numeric('original_amount', { precision: 19, scale: 4 }).notNull(),
  outstandingBalance: numeric('outstanding_balance', { precision: 19, scale: 4 }).notNull(),
  dueDate: date('due_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const msFinanceArApPlugin = defineProvekoMicroservice({
  parentService: 'srv:finance',
  microserviceKey: 'ms:finance-ar-ap',
  tablePrefix: 'arp_',
  version: '1.0.0',
  routes: [
    {
      method: 'POST',
      subPath: '/ledgers/apply-payment',
      description: 'Aplicar abono parcial o total a cartera CxC / CxP',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          contactId: string;
          ledgerType: 'RECEIVABLE_CXC' | 'PAYABLE_CXP';
          outstandingBalance: string;
          paymentAmount: string;
        };
        const remaining = MoneyDecimal.from(body.outstandingBalance).sub(
          MoneyDecimal.from(body.paymentAmount),
        );
        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          contactId: body.contactId,
          ledgerType: body.ledgerType,
          remainingBalance: remaining.toFixed4(),
          isSettled: remaining.equals(MoneyDecimal.zero()),
        };
      },
    },
  ],
});

export function createStandaloneFinanceArApServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msFinanceArApPlugin, guard, serverNodeId);
}
