import { srvGastroSchema } from '@proveko/tenant-db-resolver';
import { integer, numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { GastroSplitCheckRepositoryPort, SplitCheckResult } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_gastro` — Prefijo obligatorio `spl_` (`mod:gastro-split-check` / `ms:gastro-split-check`)
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

export class InMemoryGastroSplitCheckRepositoryAdapter
  implements GastroSplitCheckRepositoryPort
{
  private readonly store = new Map<string, SplitCheckResult[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<SplitCheckResult[]> {
    return [...(this.store.get(`${tenantId}:${branchId}`) ?? [])];
  }

  public async saveSplitCheck(record: SplitCheckResult): Promise<SplitCheckResult> {
    const key = `${record.tenantId}:${record.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(record);
    this.store.set(key, list);
    return record;
  }
}
