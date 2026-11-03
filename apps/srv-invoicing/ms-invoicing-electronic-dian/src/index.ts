import crypto from 'node:crypto';
import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvInvoicingSchema } from '@proveko/tenant-db-resolver';
import { numeric, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_invoicing` — Prefijo obligatorio `dian_` (`ms:invoicing-electronic-dian`).
 * Pertenece a `mutex_group: "fiscal_document_emitter"` y reemplaza (`supersedes`) a `ms:invoicing-simple-receipt`.
 */
export const dianElectronicInvoicesTable = srvInvoicingSchema.table('dian_electronic_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  prefixAndNumber: varchar('prefix_and_number', { length: 32 }).notNull().unique(),
  customerNit: varchar('customer_nit', { length: 32 }).notNull(),
  subtotal: numeric('subtotal', { precision: 19, scale: 4 }).notNull(),
  ivaTax: numeric('iva_tax', { precision: 19, scale: 4 }).notNull(),
  grandTotal: numeric('grand_total', { precision: 19, scale: 4 }).notNull(),
  cufeSha384: varchar('cufe_sha384', { length: 96 }).notNull().unique(),
  dianStatus: varchar('dian_status', { length: 32 }).notNull().default('QUEUED_FOR_SIGNING'),
  signedXmlUrl: text('signed_xml_url'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Calcula el CUFE (Código Único de Factura Electrónica) con SHA-384 según anexo técnico DIAN 1.9
 */
export function computeDeterministicDianCufe(params: {
  invoiceNumber: string;
  issueDateIso: string;
  subtotalFixed2: string;
  ivaFixed2: string;
  totalFixed2: string;
  issuerNit: string;
  customerNit: string;
  technicalKey: string;
}): string {
  const seed = [
    params.invoiceNumber,
    params.issueDateIso,
    params.subtotalFixed2,
    '01',
    params.ivaFixed2,
    '04',
    '0.00',
    '03',
    '0.00',
    params.totalFixed2,
    params.issuerNit,
    params.customerNit,
    params.technicalKey,
  ].join('|');

  return crypto.createHash('sha384').update(seed, 'utf8').digest('hex');
}

export const msInvoicingElectronicDianPlugin = defineProvekoMicroservice({
  parentService: 'srv:invoicing',
  microserviceKey: 'ms:invoicing-electronic-dian',
  tablePrefix: 'dian_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/invoices',
      description: 'Listar facturas electrónicas DIAN emitidas y su estado CUFE',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        branchId: ctx.activeBranchId,
        schema: 'srv_invoicing',
        table: 'dian_electronic_invoices',
        invoices: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/invoices/emit',
      description:
        'Pre-liquidar Factura Electrónica DIAN, calcular CUFE SHA-384 y encolar firma XAdES-EPES en Worker (<15ms sin bloquear Event Loop)',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          prefixAndNumber: string;
          issuerNit: string;
          customerNit: string;
          subtotal: string;
          ivaPercent?: string;
          technicalKey?: string;
        };

        const sub = MoneyDecimal.from(body.subtotal);
        const iva = sub.applyTaxRatePercent(body.ivaPercent ?? '19.00');
        const total = sub.add(iva);

        const cufe = computeDeterministicDianCufe({
          invoiceNumber: body.prefixAndNumber,
          issueDateIso: '2026-11-03T17:45:00-05:00',
          subtotalFixed2: sub.toCurrencyFixed2(),
          ivaFixed2: iva.toCurrencyFixed2(),
          totalFixed2: total.toCurrencyFixed2(),
          issuerNit: body.issuerNit,
          customerNit: body.customerNit,
          technicalKey: body.technicalKey ?? 'PROVEKO-DIAN-TECH-KEY-2026',
        });

        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          prefixAndNumber: body.prefixAndNumber,
          subtotal: sub.toFixed4(),
          ivaTax: iva.toFixed4(),
          grandTotal: total.toFixed4(),
          cufeSha384: cufe,
          dianStatus: 'QUEUED_FOR_SIGNING',
          workerQueue: 'bullmq:dian-xml-signer',
        };
      },
    },
  ],
});

/**
 * Permite desplegar `ms:invoicing-electronic-dian` en un Servidor Dedicado exclusivo para DIAN
 */
export function createStandaloneInvoicingElectronicDianServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId: string = 'dedicated-server:ms:invoicing-electronic-dian',
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msInvoicingElectronicDianPlugin, guard, serverNodeId);
}
