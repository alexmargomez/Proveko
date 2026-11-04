import { srvInvoicingSchema } from '@proveko/tenant-db-resolver';
import { numeric, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type {
  DianElectronicInvoiceResult,
  InvoicingElectronicDianRepositoryPort,
} from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_invoicing` — Prefijo obligatorio `dian_` (`mod:invoicing-electronic-dian` / `ms:invoicing-electronic-dian`).
 * Pertenece a `mutex_group: "fiscal_document_emitter"` y reemplaza (`supersedes`) a `ms:invoicing-simple-receipt`.
 */
export const dianElectronicInvoicesTable = srvInvoicingSchema.table('dian_electronic_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  prefixAndNumber: varchar('prefix_and_number', { length: 32 }).notNull().unique(),
  customerNit: varchar('customer_nit', { length: 32 }).notNull(),
  subtotal: numeric('subtotal', { precision: 19, scale: 4 }).notNull(),
  ivaTax: numeric('iva_tax', { precision: 19, scale: 4 }).notNull(),
  grandTotal: numeric('grand_total', { precision: 19, scale: 4 }).notNull(),
  cufeSha384: varchar('cufe_sha384', { length: 96 }).notNull().unique(),
  dianStatus: varchar('dian_status', { length: 32 }).notNull().default('QUEUED_FOR_SIGNING'),
  signedXmlUrl: text('signed_xml_url'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryInvoicingElectronicDianRepositoryAdapter
  implements InvoicingElectronicDianRepositoryPort
{
  private readonly store = new Map<string, DianElectronicInvoiceResult[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<DianElectronicInvoiceResult[]> {
    return [...(this.store.get(`${tenantId}:${branchId}`) ?? [])];
  }

  public async saveElectronicInvoice(
    invoice: DianElectronicInvoiceResult,
  ): Promise<DianElectronicInvoiceResult> {
    const key = `${invoice.tenantId}:${invoice.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(invoice);
    this.store.set(key, list);
    return invoice;
  }
}
