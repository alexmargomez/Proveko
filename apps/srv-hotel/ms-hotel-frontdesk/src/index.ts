import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvHotelSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_hotel` — Prefijo obligatorio `fdk_` (`ms:hotel-frontdesk`)
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

export const msHotelFrontdeskPlugin = defineProvekoMicroservice({
  parentService: 'srv:hotel',
  microserviceKey: 'ms:hotel-frontdesk',
  tablePrefix: 'fdk_',
  version: '1.0.0',
  routes: [
    {
      method: 'POST',
      subPath: '/folios/post-charge',
      description: 'Cargar consumo (minibar/restaurante/alojamiento) al folio de habitación',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          roomNumber: string;
          currentBalance: string;
          newChargeAmount: string;
        };
        const updatedBalance = MoneyDecimal.from(body.currentBalance).add(
          MoneyDecimal.from(body.newChargeAmount),
        );
        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          roomNumber: body.roomNumber,
          updatedFolioBalance: updatedBalance.toFixed4(),
        };
      },
    },
  ],
});

export function createStandaloneHotelFrontdeskServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msHotelFrontdeskPlugin, guard, serverNodeId);
}
