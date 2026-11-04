import { srvInvoicingSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { CommercialQuoteRecord, InvoicingQuotesRepositoryPort } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_invoicing` — Prefijo obligatorio `quo_` (`mod:invoicing-quotes` / `ms:invoicing-quotes`)
 */
export const quoQuotesTable = srvInvoicingSchema.table('quo_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  contactId: varchar('contact_id', { length: 64 }).notNull(),
  quoteNumber: varchar('quote_number', { length: 32 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 19, scale: 4 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('OPEN'), // OPEN | CONVERTED_TO_INVOICE | EXPIRED
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryInvoicingQuotesRepositoryAdapter implements InvoicingQuotesRepositoryPort {
  private readonly store = new Map<string, CommercialQuoteRecord[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<CommercialQuoteRecord[]> {
    return [...(this.store.get(`${tenantId}:${branchId}`) ?? [])];
  }

  public async saveQuote(quote: CommercialQuoteRecord): Promise<CommercialQuoteRecord> {
    const key = `${quote.tenantId}:${quote.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(quote);
    this.store.set(key, list);
    return quote;
  }
}
