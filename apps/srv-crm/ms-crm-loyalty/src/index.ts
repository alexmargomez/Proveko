import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvCrmSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_crm` — Prefijo obligatorio `loy_` (`ms:crm-loyalty`)
 */
export const loyWalletsTable = srvCrmSchema.table('loy_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull().unique(),
  tierLevel: varchar('tier_level', { length: 32 }).notNull().default('SILVER'),
  pointsBalance: numeric('points_balance', { precision: 19, scale: 4 }).notNull().default('0.0000'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const msCrmLoyaltyPlugin = defineProvekoMicroservice({
  parentService: 'srv:crm',
  microserviceKey: 'ms:crm-loyalty',
  tablePrefix: 'loy_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/wallets',
      description: 'Consultar saldos de puntos de fidelización',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        schema: 'srv_crm',
        table: 'loy_wallets',
        wallets: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/accrue',
      description: 'Acumular puntos de fidelización por compra validada',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as { contactId: string; invoiceAmount: string };
        const pointsEarned = MoneyDecimal.from(body.invoiceAmount).applyTaxRatePercent('5.00');
        return {
          tenantId: ctx.tenantId,
          contactId: body.contactId,
          pointsEarned: pointsEarned.toFixed4(),
        };
      },
    },
  ],
});

export function createStandaloneCrmLoyaltyServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msCrmLoyaltyPlugin, guard, serverNodeId);
}
