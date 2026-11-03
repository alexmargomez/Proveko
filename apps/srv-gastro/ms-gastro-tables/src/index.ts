import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { srvGastroSchema } from '@proveko/tenant-db-resolver';
import { integer, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_gastro` — Prefijo obligatorio `tbl_` (`ms:gastro-tables`)
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

export const msGastroTablesPlugin = defineProvekoMicroservice({
  parentService: 'srv:gastro',
  microserviceKey: 'ms:gastro-tables',
  tablePrefix: 'tbl_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/tables',
      description: 'Consultar mapa de salones y ocupación de mesas en tiempo real',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        branchId: ctx.activeBranchId,
        schema: 'srv_gastro',
        table: 'tbl_dining_tables',
        tables: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/tables/occupy',
      description: 'Abrir mesa y asignar número de comensales',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as { tableCode: string; guestsCount: number };
        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          tableCode: body.tableCode,
          guestsCount: body.guestsCount,
          occupancyStatus: 'OCCUPIED',
        };
      },
    },
  ],
});

export function createStandaloneGastroTablesServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msGastroTablesPlugin, guard, serverNodeId);
}
