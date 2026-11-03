import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';
import { srvInventorySchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_inventory` — Prefijo obligatorio `trf_` (`ms:inventory-transfers`)
 */
export const trfOrdersTable = srvInventorySchema.table('trf_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromBranchId: varchar('from_branch_id', { length: 64 }).notNull(),
  toBranchId: varchar('to_branch_id', { length: 64 }).notNull(),
  sku: varchar('sku', { length: 64 }).notNull(),
  quantity: numeric('quantity', { precision: 19, scale: 4 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('IN_TRANSIT'), // IN_TRANSIT | RECEIVED
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const msInventoryTransfersPlugin = defineProvekoMicroservice({
  parentService: 'srv:inventory',
  microserviceKey: 'ms:inventory-transfers',
  tablePrefix: 'trf_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/transfers',
      description: 'Listar traslados de mercancía entre sucursales',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        activeBranchId: ctx.activeBranchId,
        schema: 'srv_inventory',
        table: 'trf_orders',
        transfers: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/transfers',
      description: 'Crear traslado entre sucursales autorizadas del usuario',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          toBranchId: string;
          sku: string;
          quantity: string;
        };
        if (!ctx.allowedBranchIds.includes(body.toBranchId)) {
          throw new ProvekoDomainError(
            PROVEKO_ERROR_CODES.ERR_BRANCH_FORBIDDEN,
            403,
            `Destination branch "${body.toBranchId}" is not in allowed_branch_ids.`,
          );
        }
        return {
          tenantId: ctx.tenantId,
          fromBranchId: ctx.activeBranchId,
          toBranchId: body.toBranchId,
          sku: body.sku,
          quantity: MoneyDecimal.from(body.quantity).toFixed4(),
          status: 'IN_TRANSIT',
        };
      },
    },
  ],
});

export function createStandaloneInventoryTransfersServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msInventoryTransfersPlugin, guard, serverNodeId);
}
