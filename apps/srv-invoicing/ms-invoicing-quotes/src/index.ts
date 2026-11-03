import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvInvoicingSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_invoicing` — Prefijo obligatorio `quo_` (`ms:invoicing-quotes`)
 */
export const quoQuotesTable = srvInvoicingSchema.table('quo_quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  contactId: varchar('contact_id', { length: 64 }).notNull(),
  quoteNumber: varchar('quote_number', { length: 32 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 19, scale: 4 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('OPEN'), // OPEN | CONVERTED_TO_INVOICE | EXPIRED
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const msInvoicingQuotesPlugin = defineProvekoMicroservice({
  parentService: 'srv:invoicing',
  microserviceKey: 'ms:invoicing-quotes',
  tablePrefix: 'quo_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/quotes',
      description: 'Listar cotizaciones y remisiones comerciales',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        branchId: ctx.activeBranchId,
        schema: 'srv_invoicing',
        table: 'quo_quotes',
        quotes: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/quotes',
      description: 'Crear cotización comercial convertible en factura con 1 clic',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          contactId: string;
          quoteNumber: string;
          totalAmount: string;
        };
        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          contactId: body.contactId,
          quoteNumber: body.quoteNumber,
          totalAmount: MoneyDecimal.from(body.totalAmount).toFixed4(),
          status: 'OPEN',
        };
      },
    },
  ],
});

export function createStandaloneInvoicingQuotesServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msInvoicingQuotesPlugin, guard, serverNodeId);
}
