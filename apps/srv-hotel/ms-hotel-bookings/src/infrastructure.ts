import { srvHotelSchema } from '@proveko/tenant-db-resolver';
import { date, integer, numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { HotelBookingsRepositoryPort, HotelReservationRecord } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_hotel` — Prefijo obligatorio `bkg_` (`mod:hotel-bookings` / `ms:hotel-bookings`)
 */
export const bkgReservationsTable = srvHotelSchema.table('bkg_reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  guestContactId: varchar('guest_contact_id', { length: 64 }).notNull(),
  roomNumber: varchar('room_number', { length: 32 }).notNull(),
  checkInDate: date('check_in_date').notNull(),
  checkOutDate: date('check_out_date').notNull(),
  nightsCount: integer('nights_count').notNull(),
  estimatedTotal: numeric('estimated_total', { precision: 19, scale: 4 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('CONFIRMED'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryHotelBookingsRepositoryAdapter implements HotelBookingsRepositoryPort {
  private readonly store = new Map<string, HotelReservationRecord[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<HotelReservationRecord[]> {
    return [...(this.store.get(`${tenantId}:${branchId}`) ?? [])];
  }

  public async saveReservation(
    reservation: HotelReservationRecord,
  ): Promise<HotelReservationRecord> {
    const key = `${reservation.tenantId}:${reservation.branchId}`;
    const list = this.store.get(key) ?? [];
    list.push(reservation);
    this.store.set(key, list);
    return reservation;
  }
}
