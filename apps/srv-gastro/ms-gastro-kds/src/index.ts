import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { srvGastroSchema } from '@proveko/tenant-db-resolver';
import { jsonb, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_gastro` — Prefijo obligatorio `kds_` (`ms:gastro-kds`)
 */
export const kdsTicketsTable = srvGastroSchema.table('kds_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  stationKey: varchar('station_key', { length: 48 }).notNull(), // HOT_KITCHEN | BAR | GRILL
  tableCode: varchar('table_code', { length: 32 }).notNull(),
  itemsJson: jsonb('items_json').$type<Array<{ sku: string; qty: number; notes?: string }>>().notNull(),
  status: varchar('status', { length: 32 }).notNull().default('PREPARING'), // PREPARING | READY | SERVED
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }).notNull().defaultNow(),
});

export const msGastroKdsPlugin = defineProvekoMicroservice({
  parentService: 'srv:gastro',
  microserviceKey: 'ms:gastro-kds',
  tablePrefix: 'kds_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/tickets',
      description: 'Consultar comandas activas de cocina y barra KDS',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        branchId: ctx.activeBranchId,
        schema: 'srv_gastro',
        table: 'kds_tickets',
        tickets: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/tickets/dispatch',
      description: 'Enviar comanda a estación de cocina o barra',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          stationKey: 'HOT_KITCHEN' | 'BAR' | 'GRILL';
          tableCode: string;
          items: Array<{ sku: string; qty: number; notes?: string }>;
        };
        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          stationKey: body.stationKey,
          tableCode: body.tableCode,
          items: body.items,
          status: 'PREPARING',
        };
      },
    },
  ],
});

export function createStandaloneGastroKdsServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msGastroKdsPlugin, guard, serverNodeId);
}
