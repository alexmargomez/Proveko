import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvHotelSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_hotel` — Prefijo obligatorio `rom_` (`ms:hotel-rooms`)
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

export const msHotelRoomsPlugin = defineProvekoMicroservice({
  parentService: 'srv:hotel',
  microserviceKey: 'ms:hotel-rooms',
  tablePrefix: 'rom_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/rooms',
      description: 'Listar habitaciones, tarifas y estado de limpieza housekeeping',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        branchId: ctx.activeBranchId,
        schema: 'srv_hotel',
        table: 'rom_rooms',
        rooms: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/rooms',
      description: 'Registrar habitación con tarifa por noche NUMERIC(19, 4)',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          roomNumber: string;
          roomCategory: string;
          nightlyRate: string;
        };
        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          roomNumber: body.roomNumber,
          roomCategory: body.roomCategory,
          nightlyRate: MoneyDecimal.from(body.nightlyRate).toFixed4(),
          housekeepingStatus: 'CLEAN',
        };
      },
    },
  ],
});

export function createStandaloneHotelRoomsServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msHotelRoomsPlugin, guard, serverNodeId);
}
