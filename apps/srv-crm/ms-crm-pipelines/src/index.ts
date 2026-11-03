import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvCrmSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_crm` — Prefijo obligatorio `pip_` (`ms:crm-pipelines`)
 */
export const pipDealsTable = srvCrmSchema.table('pip_deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull(),
  stageKey: varchar('stage_key', { length: 48 }).notNull(), // LEAD | QUALIFIED | PROPOSAL | WON | LOST
  expectedValue: numeric('expected_value', { precision: 19, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const msCrmPipelinesPlugin = defineProvekoMicroservice({
  parentService: 'srv:crm',
  microserviceKey: 'ms:crm-pipelines',
  tablePrefix: 'pip_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/deals',
      description: 'Consultar oportunidades comerciales del embudo CRM',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        schema: 'srv_crm',
        table: 'pip_deals',
        deals: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/deals',
      description: 'Crear oportunidad comercial en el embudo CRM',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          contactId: string;
          stageKey: string;
          expectedValue: string;
        };
        return {
          tenantId: ctx.tenantId,
          contactId: body.contactId,
          stageKey: body.stageKey,
          expectedValue: MoneyDecimal.from(body.expectedValue).toFixed4(),
        };
      },
    },
  ],
});

export function createStandaloneCrmPipelinesServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msCrmPipelinesPlugin, guard, serverNodeId);
}
