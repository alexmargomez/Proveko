import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvInvoicingSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_invoicing` — Prefijo obligatorio `pos_` (`ms:invoicing-pos`)
 */
export const posCashShiftsTable = srvInvoicingSchema.table('pos_cash_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  cashierUserId: varchar('cashier_user_id', { length: 64 }).notNull(),
  openingBalance: numeric('opening_balance', { precision: 19, scale: 4 }).notNull(),
  closingBalance: numeric('closing_balance', { precision: 19, scale: 4 }),
  status: varchar('status', { length: 32 }).notNull().default('OPEN'),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
});

export const posSaleTicketsTable = srvInvoicingSchema.table('pos_sale_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  contactId: varchar('contact_id', { length: 64 }).notNull(),
  subtotal: numeric('subtotal', { precision: 19, scale: 4 }).notNull(),
  taxTotal: numeric('tax_total', { precision: 19, scale: 4 }).notNull(),
  grandTotal: numeric('grand_total', { precision: 19, scale: 4 }).notNull(),
  emitterMicroservice: varchar('emitter_microservice', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface PosCheckoutLineInput {
  sku: string;
  quantity: string;
  unitPrice: string;
  taxPercent: string;
}

export const msInvoicingPosPlugin = defineProvekoMicroservice({
  parentService: 'srv:invoicing',
  microserviceKey: 'ms:invoicing-pos',
  tablePrefix: 'pos_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/shifts',
      description: 'Consultar turnos de caja POS en la sucursal activa',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        branchId: ctx.activeBranchId,
        schema: 'srv_invoicing',
        table: 'pos_cash_shifts',
        shifts: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/checkout',
      description: 'Procesar venta en Caja POS calculando totales exactos NUMERIC(19, 4)',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          contactId: string;
          lines: PosCheckoutLineInput[];
        };
        let subtotal = MoneyDecimal.zero();
        let taxTotal = MoneyDecimal.zero();

        for (const line of body.lines ?? []) {
          const lineSub = MoneyDecimal.from(line.quantity).mul(MoneyDecimal.from(line.unitPrice));
          const lineTax = lineSub.applyTaxRatePercent(line.taxPercent);
          subtotal = subtotal.add(lineSub);
          taxTotal = taxTotal.add(lineTax);
        }

        const grandTotal = subtotal.add(taxTotal);
        const activeInvoicingChildren = ctx.claims.services['srv:invoicing'] ?? [];
        const emitter = activeInvoicingChildren.includes('ms:invoicing-electronic-dian')
          ? 'ms:invoicing-electronic-dian'
          : 'ms:invoicing-simple-receipt';

        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          contactId: body.contactId,
          subtotal: subtotal.toFixed4(),
          taxTotal: taxTotal.toFixed4(),
          grandTotal: grandTotal.toFixed4(),
          resolvedFiscalEmitter: emitter,
        };
      },
    },
  ],
});

export function createStandaloneInvoicingPosServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msInvoicingPosPlugin, guard, serverNodeId);
}
