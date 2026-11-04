import { srvFinanceSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { CashbookEntryRecord, FinanceCashbookRepositoryPort } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_finance` — Prefijo obligatorio `csh_` (`mod:finance-cashbook` / `ms:finance-cashbook`).
 * Pertenece a `mutex_group: "accounting_ledger_engine"`.
 */
export const cshEntriesTable = srvFinanceSchema.table('csh_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  entryType: varchar('entry_type', { length: 16 }).notNull(), // INCOME | EXPENSE
  concept: varchar('concept', { length: 180 }).notNull(),
  amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryFinanceCashbookRepositoryAdapter implements FinanceCashbookRepositoryPort {
  private readonly store = new Map<string, CashbookEntryRecord[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<CashbookEntryRecord[]> {
    return [...(this.store.get(`${tenantId}:${branchId}`) ?? [])];
  }

  public async saveEntry(entry: CashbookEntryRecord): Promise<CashbookEntryRecord> {
    const key = `${entry.tenantId}:${entry.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(entry);
    this.store.set(key, list);
    return entry;
  }
}
