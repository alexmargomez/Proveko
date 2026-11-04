import { srvGastroSchema } from '@proveko/tenant-db-resolver';
import { integer, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { DiningTableOccupancyRecord, GastroTablesRepositoryPort } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_gastro` — Prefijo obligatorio `tbl_` (`mod:gastro-tables` / `ms:gastro-tables`)
 */
export const tblDiningTablesTable = srvGastroSchema.table('tbl_dining_tables', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  zoneName: varchar('zone_name', { length: 64 }).notNull(),
  tableCode: varchar('table_code', { length: 32 }).notNull(),
  seatsCapacity: integer('seats_capacity').notNull().default(4),
  occupancyStatus: varchar('occupancy_status', { length: 32 }).notNull().default('AVAILABLE'), // AVAILABLE | OCCUPIED | BILL_REQUESTED
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryGastroTablesRepositoryAdapter implements GastroTablesRepositoryPort {
  private readonly store = new Map<string, DiningTableOccupancyRecord[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<DiningTableOccupancyRecord[]> {
    return [...(this.store.get(`${tenantId}:${branchId}`) ?? [])];
  }

  public async saveTableOccupancy(
    record: DiningTableOccupancyRecord,
  ): Promise<DiningTableOccupancyRecord> {
    const key = `${record.tenantId}:${record.branchId}`;
    const list = this.store.get(key) ?? [];
    const existingIdx = list.findIndex((t) => t.tableCode === record.tableCode);
    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.push(record);
    }
    this.store.set(key, list);
    return record;
  }
}
