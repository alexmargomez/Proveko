import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';
import { srvFinanceSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_finance` — Prefijo obligatorio `puc_` (`ms:finance-accounting-puc`).
 * Pertenece a `mutex_group: "accounting_ledger_engine"` y reemplaza (`supersedes`) a `ms:finance-cashbook`.
 */
export const pucJournalHeadersTable = srvFinanceSchema.table('puc_journal_headers', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  voucherNumber: varchar('voucher_number', { length: 32 }).notNull().unique(),
  totalDebit: numeric('total_debit', { precision: 19, scale: 4 }).notNull(),
  totalCredit: numeric('total_credit', { precision: 19, scale: 4 }).notNull(),
  postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
});

export interface PucJournalEntryLine {
  pucAccountCode: string; // ej. '110505' Caja General, '413501' Comercio al por menor, '240801' IVA Generado
  thirdPartyContactId: string;
  debit: string;
  credit: string;
}

export const msFinanceAccountingPucPlugin = defineProvekoMicroservice({
  parentService: 'srv:finance',
  microserviceKey: 'ms:finance-accounting-puc',
  tablePrefix: 'puc_',
  version: '1.0.0',
  routes: [
    {
      method: 'POST',
      subPath: '/journal/post-voucher',
      description: 'Contabilizar comprobante PUC/NIIF validando partida doble exacta (Débito == Crédito)',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          voucherNumber: string;
          lines: PucJournalEntryLine[];
        };

        let sumDebit = MoneyDecimal.zero();
        let sumCredit = MoneyDecimal.zero();

        for (const line of body.lines ?? []) {
          sumDebit = sumDebit.add(MoneyDecimal.from(line.debit));
          sumCredit = sumCredit.add(MoneyDecimal.from(line.credit));
        }

        if (!sumDebit.equals(sumCredit) || sumDebit.equals(MoneyDecimal.zero())) {
          throw new ProvekoDomainError(
            PROVEKO_ERROR_CODES.ERR_MISSING_PREREQUISITES,
            422,
            `Double-entry accounting imbalance: Total Debit (${sumDebit.toFixed4()}) !== Total Credit (${sumCredit.toFixed4()}).`,
            {
              total_debit: sumDebit.toFixed4(),
              total_credit: sumCredit.toFixed4(),
            },
          );
        }

        return {
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          voucherNumber: body.voucherNumber,
          totalDebit: sumDebit.toFixed4(),
          totalCredit: sumCredit.toFixed4(),
          balanced: true,
        };
      },
    },
  ],
});

export function createStandaloneFinanceAccountingPucServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msFinanceAccountingPucPlugin, guard, serverNodeId);
}
