import { srvHotelSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { HotelFrontdeskRepositoryPort, RoomFolioBalanceRecord } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_hotel` — Prefijo obligatorio `fdk_` (`mod:hotel-frontdesk` / `ms:hotel-frontdesk`)
 */
export const fdkRoomFoliosTable = srvHotelSchema.table('fdk_room_folios', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  roomNumber: varchar('room_number', { length: 32 }).notNull(),
  guestContactId: varchar('guest_contact_id', { length: 64 }).notNull(),
  lodgingCharges: numeric('lodging_charges', { precision: 19, scale: 4 }).notNull().default('0.0000'),
  minibarAndPosCharges: numeric('minibar_and_pos_charges', { precision: 19, scale: 4 })
    .notNull()
    .default('0.0000'),
  folioStatus: varchar('folio_status', { length: 32 }).notNull().default('CHECKED_IN'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryHotelFrontdeskRepositoryAdapter implements HotelFrontdeskRepositoryPort {
  private readonly store = new Map<string, RoomFolioBalanceRecord[]>();

  public async saveFolioBalance(record: RoomFolioBalanceRecord): Promise<RoomFolioBalanceRecord> {
    const key = `${record.tenantId}:${record.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(record);
    this.store.set(key, list);
    return record;
  }

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<RoomFolioBalanceRecord[]> {
    return [...(this.store.get(`${tenantId}:${branchId}`) ?? [])];
  }
}
