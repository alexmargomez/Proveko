import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvHotelSchema } from '@proveko/tenant-db-resolver';
import { date, integer, numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_hotel` — Prefijo obligatorio `bkg_` (`ms:hotel-bookings`)
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

export const msHotelBookingsPlugin = defineProvekoMicroservice({
  parentService: 'srv:hotel',
  microserviceKey: 'ms:hotel-bookings',
  tablePrefix: 'bkg_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/reservations',
      description: 'Consultar calendario de reservas y ocupación hotelera',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        branchId: ctx.activeBranchId,
        schema: 'srv_hotel',
        table: 'bkg_reservations',
        reservations: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/reservations',
      description: 'Crear reserva hotelera calculando total por número de noches',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          guestContactId: string;
          roomNumber: string;
          nightsCount: number;
          nightlyRate: string;
        };
        const total = MoneyDecimal.from(body.nightlyRate).mul(body.nightsCount);
        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          guestContactId: body.guestContactId,
          roomNumber: body.roomNumber,
          nightsCount: body.nightsCount,
          estimatedTotal: total.toFixed4(),
          status: 'CONFIRMED',
        };
      },
    },
  ],
});

export function createStandaloneHotelBookingsServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msHotelBookingsPlugin, guard, serverNodeId);
}
