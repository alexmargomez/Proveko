import { srvHotelSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { HotelRoomRecord, HotelRoomsRepositoryPort } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_hotel` — Prefijo obligatorio `rom_` (`mod:hotel-rooms` / `ms:hotel-rooms`)
 */
export const romRoomsTable = srvHotelSchema.table('rom_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  roomNumber: varchar('room_number', { length: 32 }).notNull(),
  roomCategory: varchar('room_category', { length: 64 }).notNull(), // STANDARD | SUITE | DELUXE
  nightlyRate: numeric('nightly_rate', { precision: 19, scale: 4 }).notNull(),
  housekeepingStatus: varchar('housekeeping_status', { length: 32 }).notNull().default('CLEAN'), // CLEAN | DIRTY | INSPECTED
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryHotelRoomsRepositoryAdapter implements HotelRoomsRepositoryPort {
  private readonly store = new Map<string, HotelRoomRecord[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<HotelRoomRecord[]> {
    return [...(this.store.get(`${tenantId}:${branchId}`) ?? [])];
  }

  public async saveRoom(room: HotelRoomRecord): Promise<HotelRoomRecord> {
    const key = `${room.tenantId}:${room.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(room);
    this.store.set(key, list);
    return room;
  }
}
