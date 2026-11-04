import { srvInvoicingSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { InvoicingPosRepositoryPort, PosSaleTicketResult } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_invoicing` — Prefijo obligatorio `pos_` (`mod:invoicing-pos` / `ms:invoicing-pos`)
 */
export const posCashShiftsTable = srvInvoicingSchema.table('pos_cash_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  cashierUserId: varchar('cashier_user_id', { length: 64 }).notNull(),
  openingBalance: numeric('opening_balance', { precision: 19, scale: 4 }).notNull(),
  closingBalance: numeric('closing_balance', { precision: 19, scale: 4 }),
  status: varchar('status', { length: 32 }).notNull().default('OPEN'),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
});

export const posSaleTicketsTable = srvInvoicingSchema.table('pos_sale_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  contactId: varchar('contact_id', { length: 64 }).notNull(),
  subtotal: numeric('subtotal', { precision: 19, scale: 4 }).notNull(),
  taxTotal: numeric('tax_total', { precision: 19, scale: 4 }).notNull(),
  grandTotal: numeric('grand_total', { precision: 19, scale: 4 }).notNull(),
  emitterMicroservice: varchar('emitter_microservice', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryInvoicingPosRepositoryAdapter implements InvoicingPosRepositoryPort {
  private readonly ticketsByKey = new Map<string, PosSaleTicketResult[]>();

  public async listShiftsByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<Array<Record<string, unknown>>> {
    return [...(this.ticketsByKey.get(`${tenantId}:${branchId}`) ?? [])] as unknown as Array<
      Record<string, unknown>
    >;
  }

  public async saveSaleTicket(ticket: PosSaleTicketResult): Promise<PosSaleTicketResult> {
    const key = `${ticket.tenantId}:${ticket.branchId}`;
    const list = this.ticketsByKey.get(key) ?? [];
    list.push(ticket);
    this.ticketsByKey.set(key, list);
    return ticket;
  }
}
