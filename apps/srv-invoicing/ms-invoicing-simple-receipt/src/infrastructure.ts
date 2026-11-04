import { srvInvoicingSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { InvoicingSimpleReceiptRepositoryPort, SimpleReceiptRecord } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_invoicing` — Prefijo obligatorio `rcp_` (`mod:invoicing-simple-receipt` / `ms:invoicing-simple-receipt`).
 * Pertenece a `mutex_group: "fiscal_document_emitter"`.
 */
export const rcpSimpleReceiptsTable = srvInvoicingSchema.table('rcp_simple_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  consecutiveNumber: varchar('consecutive_number', { length: 32 }).notNull(),
  customerName: varchar('customer_name', { length: 180 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 19, scale: 4 }).notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryInvoicingSimpleReceiptRepositoryAdapter
  implements InvoicingSimpleReceiptRepositoryPort
{
  private readonly store = new Map<string, SimpleReceiptRecord[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<SimpleReceiptRecord[]> {
    const key = `${tenantId}:${branchId}`;
    const existing = this.store.get(key);
    if (!existing || existing.length === 0) {
      return [
        {
          tenantId,
          branchId,
          consecutiveNumber: 'RCP-0001',
          customerName: 'Consumidor General',
          totalAmount: '45000.0000',
          documentType: 'SIMPLE_NON_FISCAL_RECEIPT',
          status: 'HISTORICAL_ARCHIVED',
        },
      ];
    }
    return [...existing];
  }

  public async saveReceipt(receipt: SimpleReceiptRecord): Promise<SimpleReceiptRecord> {
    const key = `${receipt.tenantId}:${receipt.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(receipt);
    this.store.set(key, list);
    return receipt;
  }
}
