import { srvFinanceSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type {
  FinanceAccountingPucRepositoryPort,
  PucJournalVoucherResult,
} from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_finance` — Prefijo obligatorio `puc_` (`mod:finance-accounting-puc` / `ms:finance-accounting-puc`).
 * Pertenece a `mutex_group: "accounting_ledger_engine"` y reemplaza (`supersedes`) a `ms:finance-cashbook`.
 */
export const pucJournalHeadersTable = srvFinanceSchema.table('puc_journal_headers', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  voucherNumber: varchar('voucher_number', { length: 32 }).notNull().unique(),
  totalDebit: numeric('total_debit', { precision: 19, scale: 4 }).notNull(),
  totalCredit: numeric('total_credit', { precision: 19, scale: 4 }).notNull(),
  postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryFinanceAccountingPucRepositoryAdapter
  implements FinanceAccountingPucRepositoryPort
{
  private readonly store = new Map<string, PucJournalVoucherResult[]>();

  public async saveJournalVoucher(
    voucher: PucJournalVoucherResult,
  ): Promise<PucJournalVoucherResult> {
    const key = `${voucher.tenantId}:${voucher.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(voucher);
    this.store.set(key, list);
    return voucher;
  }

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<PucJournalVoucherResult[]> {
    return [...(this.store.get(`${tenantId}:${branchId}`) ?? [])];
  }
}
