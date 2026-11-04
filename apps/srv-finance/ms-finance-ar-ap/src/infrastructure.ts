import { srvFinanceSchema } from '@proveko/tenant-db-resolver';
import { date, numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { ArApPaymentResult, FinanceArApRepositoryPort } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_finance` — Prefijo obligatorio `arp_` (`mod:finance-ar-ap` / `ms:finance-ar-ap`)
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

export class InMemoryFinanceArApRepositoryAdapter implements FinanceArApRepositoryPort {
  private readonly store = new Map<string, ArApPaymentResult[]>();

  public async savePaymentApplication(record: ArApPaymentResult): Promise<ArApPaymentResult> {
    const key = `${record.tenantId}:${record.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(record);
    this.store.set(key, list);
    return record;
  }
}
