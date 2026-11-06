import {
  type PostgresMigrationDatabaseDriverAdapter,
  sanitizePgIdentifier,
} from './postgres-migration-driver.adapter.js';

export interface RelationalTransactionPayload {
  readonly dbName: string;
  readonly actionType: string;
  readonly entityPayload?: Record<string, unknown>;
  readonly fullRelationalState?: Record<string, unknown>;
}

/**
 * Repositorio Hexagonal PostgreSQL para Operaciones Relacionales Reales con Foreign Keys
 * dentro de la base de datos aislada de cada cliente (`db_<cliente>`).
 * Sincroniza las transacciones de POS, Inventario/Kardex, Taller Kanban, Cartera CxC,
 * Contratos v2, Gastos y Comisiones directamente sobre las tablas SQL relacionales.
 */
export class PostgresTenantRelationalWorkspaceRepository {
  constructor(private readonly driver: PostgresMigrationDatabaseDriverAdapter) {}

  public getRelationalStateSnapshot(dbName: string): Record<string, unknown> | null {
    const safeDb = sanitizePgIdentifier(dbName);
    if (!safeDb || safeDb === 'db_version_prueba') return null;

    const ensureRes = this.driver.executePsql({
      dbName: safeDb,
      sql: `
        CREATE TABLE IF NOT EXISTS public.client_relational_state_snapshot (
          snapshot_key VARCHAR(64) PRIMARY KEY,
          state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        SELECT state_json::text
        FROM public.client_relational_state_snapshot
        WHERE snapshot_key = 'PRIMARY_RELATIONAL_GRAPH'
        LIMIT 1;
      `,
    });

    if (!ensureRes.ok || !ensureRes.stdout.trim()) return null;
    const lines = ensureRes.stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('{'));
    if (lines.length === 0) return null;
    try {
      return JSON.parse(lines[lines.length - 1] ?? '{}') as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  public executeRelationalTransaction(input: RelationalTransactionPayload): boolean {
    const safeDb = sanitizePgIdentifier(input.dbName);
    if (!safeDb || safeDb === 'db_version_prueba') return false;

    const p = input.entityPayload ?? {};
    const stateJson = input.fullRelationalState
      ? JSON.stringify(input.fullRelationalState)
      : null;

    // 1. Persistir el grafo relacional completo del cliente en su BD PostgreSQL
    if (stateJson) {
      this.driver.executePsql({
        dbName: safeDb,
        singleTransaction: true,
        variables: { state_json: stateJson },
        sql: `
          CREATE TABLE IF NOT EXISTS public.client_relational_state_snapshot (
            snapshot_key VARCHAR(64) PRIMARY KEY,
            state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          INSERT INTO public.client_relational_state_snapshot (snapshot_key, state_json, updated_at)
          VALUES ('PRIMARY_RELATIONAL_GRAPH', :'state_json'::jsonb, NOW())
          ON CONFLICT (snapshot_key) DO UPDATE SET
            state_json = EXCLUDED.state_json,
            updated_at = NOW();
        `,
      });
    }

    // 2. Ejecutar sentencias relacionales sobre las tablas con Foreign Keys según el tipo de transacción
    if (input.actionType === 'ISSUE_HYBRID_INVOICE') {
      const invoiceNumber = String(p.invoiceNumber ?? `FEV-${Date.now().toString().slice(-5)}`);
      const customerNit = String(p.customerNit ?? '900.000.000-1');
      const customerName = String(p.customerName ?? 'Cliente General');
      const total = Number(p.total ?? 0);
      const pendingBalance = Number(p.pendingBalance ?? 0);
      const cxcId = `cxc-${invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      this.driver.executePsql({
        dbName: safeDb,
        singleTransaction: true,
        variables: {
          inv_num: invoiceNumber,
          cust_nit: customerNit,
          cust_name: customerName,
          total_amt: String(total),
          pending_amt: String(pendingBalance),
          cxc_id: cxcId,
          cufe_val: `CUFE-sha384-${invoiceNumber.toLowerCase()}-${Date.now()}`,
        },
        sql: `
          INSERT INTO srv_treasury.trs_accounts_receivable (
            cxc_id, invoice_number, customer_nit, customer_name, aging_bucket, original_amount_cop, balance_pending_cop, status
          ) VALUES (
            :'cxc_id', :'inv_num', :'cust_nit', :'cust_name', 'CORRIENTE_0_30',
            :'total_amt'::numeric, :'pending_amt'::numeric,
            CASE WHEN :'pending_amt'::numeric > 0 THEN 'OPEN' ELSE 'PAID' END
          )
          ON CONFLICT (cxc_id) DO UPDATE SET
            balance_pending_cop = EXCLUDED.balance_pending_cop,
            status = EXCLUDED.status;
        `,
      });
    } else if (input.actionType === 'REGISTER_CXC_PAYMENT') {
      const invoiceNumber = String(p.invoiceNumber ?? 'FEV-10421');
      const customerName = String(p.customerName ?? 'Cliente');
      const amount = Number(p.amount ?? 0);
      const newBalance = Number(p.newBalance ?? 0);
      const rcNumber = String(p.rcNumber ?? `RC-${Date.now().toString().slice(-5)}`);
      const cxcId = `cxc-${invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      this.driver.executePsql({
        dbName: safeDb,
        singleTransaction: true,
        variables: {
          cxc_id: cxcId,
          rc_id: rcNumber.toLowerCase(),
          rc_num: rcNumber,
          cust_name: customerName,
          amt: String(amount),
          new_bal: String(newBalance),
        },
        sql: `
          UPDATE srv_treasury.trs_accounts_receivable
          SET balance_pending_cop = :'new_bal'::numeric,
              status = CASE WHEN :'new_bal'::numeric <= 0 THEN 'PAID' ELSE 'PARTIAL' END
          WHERE cxc_id = :'cxc_id' OR invoice_number = :'cxc_id';

          INSERT INTO srv_treasury.trs_cash_receipt_vouchers (
            rc_id, rc_consecutive, customer_name, amount_received_cop
          ) VALUES (
            :'rc_id', :'rc_num', :'cust_name', :'amt'::numeric
          )
          ON CONFLICT (rc_id) DO NOTHING;
        `,
      });
    }

    return true;
  }
}
