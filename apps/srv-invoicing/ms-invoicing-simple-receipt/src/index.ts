import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvInvoicingSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_invoicing` — Prefijo obligatorio `rcp_` (`ms:invoicing-simple-receipt`).
 * Pertenece a `mutex_group: "fiscal_document_emitter"`.
 * Cuando el inquilino activa `ms:invoicing-electronic-dian`, este microservicio pasa a `READONLY_ARCHIVE`.
 */
export const rcpSimpleReceiptsTable = srvInvoicingSchema.table('rcp_simple_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  consecutiveNumber: varchar('consecutive_number', { length: 32 }).notNull(),
  customerName: varchar('customer_name', { length: 180 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 19, scale: 4 }).notNull(),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
});

export const msInvoicingSimpleReceiptPlugin = defineProvekoMicroservice({
  parentService: 'srv:invoicing',
  microserviceKey: 'ms:invoicing-simple-receipt',
  tablePrefix: 'rcp_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/receipts',
      description: 'Consultar recibos simples históricos (permitido incluso en READONLY_ARCHIVE)',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        branchId: ctx.activeBranchId,
        schema: 'srv_invoicing',
        table: 'rcp_simple_receipts',
        isReadonlyArchive: ctx.isReadonlyArchive,
        receipts: [
          {
            consecutiveNumber: 'RCP-0001',
            totalAmount: '45000.0000',
            status: 'HISTORICAL_ARCHIVED',
          },
        ],
      }),
    },
    {
      method: 'POST',
      subPath: '/receipts',
      description: 'Emitir recibo simple no fiscal (bloqueado automáticamente si está en READONLY_ARCHIVE)',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          consecutiveNumber: string;
          customerName: string;
          totalAmount: string;
        };
        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          consecutiveNumber: body.consecutiveNumber,
          customerName: body.customerName,
          totalAmount: MoneyDecimal.from(body.totalAmount).toFixed4(),
          documentType: 'SIMPLE_NON_FISCAL_RECEIPT',
        };
      },
    },
  ],
});

export function createStandaloneInvoicingSimpleReceiptServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msInvoicingSimpleReceiptPlugin, guard, serverNodeId);
}
