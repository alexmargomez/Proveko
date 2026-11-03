import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvFinanceSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_finance` — Prefijo obligatorio `csh_` (`ms:finance-cashbook`).
 * Pertenece a `mutex_group: "accounting_ledger_engine"`.
 * Cuando el inquilino evoluciona a `ms:finance-accounting-puc`, pasa a `READONLY_ARCHIVE`.
 */
export const cshEntriesTable = srvFinanceSchema.table('csh_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  entryType: varchar('entry_type', { length: 16 }).notNull(), // INCOME | EXPENSE
  concept: varchar('concept', { length: 180 }).notNull(),
  amount: numeric('amount', { precision: 19, scale: 4 }).notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const msFinanceCashbookPlugin = defineProvekoMicroservice({
  parentService: 'srv:finance',
  microserviceKey: 'ms:finance-cashbook',
  tablePrefix: 'csh_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/entries',
      description: 'Consultar movimientos del libro de caja simple (disponible en READONLY_ARCHIVE)',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        branchId: ctx.activeBranchId,
        schema: 'srv_finance',
        table: 'csh_entries',
        isReadonlyArchive: ctx.isReadonlyArchive,
        entries: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/entries',
      description: 'Registrar ingreso o gasto simple (bloqueado si fue reemplazado por PUC)',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          entryType: 'INCOME' | 'EXPENSE';
          concept: string;
          amount: string;
        };
        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          entryType: body.entryType,
          concept: body.concept,
          amount: MoneyDecimal.from(body.amount).toFixed4(),
        };
      },
    },
  ],
});

export function createStandaloneFinanceCashbookServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msFinanceCashbookPlugin, guard, serverNodeId);
}
