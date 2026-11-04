import { srvGastroSchema } from '@proveko/tenant-db-resolver';
import { jsonb, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { GastroKdsRepositoryPort, KdsTicketRecord } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_gastro` — Prefijo obligatorio `kds_` (`mod:gastro-kds` / `ms:gastro-kds`)
 */
export const kdsTicketsTable = srvGastroSchema.table('kds_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  stationKey: varchar('station_key', { length: 48 }).notNull(), // HOT_KITCHEN | BAR | GRILL
  tableCode: varchar('table_code', { length: 32 }).notNull(),
  itemsJson: jsonb('items_json')
    .$type<Array<{ sku: string; qty: number; notes?: string }>>()
    .notNull(),
  status: varchar('status', { length: 32 }).notNull().default('PREPARING'), // PREPARING | READY | SERVED
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryGastroKdsRepositoryAdapter implements GastroKdsRepositoryPort {
  private readonly store = new Map<string, KdsTicketRecord[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<KdsTicketRecord[]> {
    return [...(this.store.get(`${tenantId}:${branchId}`) ?? [])];
  }

  public async saveTicket(ticket: KdsTicketRecord): Promise<KdsTicketRecord> {
    const key = `${ticket.tenantId}:${ticket.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(ticket);
    this.store.set(key, list);
    return ticket;
  }
}
