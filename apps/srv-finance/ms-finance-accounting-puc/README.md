# Microservicio: Contabilidad PUC / NIIF (`ms:finance-accounting-puc`)

- **Clave del Microservicio:** `ms:finance-accounting-puc`
- **Servicio Padre (Gatekeeper):** `srv:finance`
- **Esquema PostgreSQL:** `srv_finance`
- **Prefijo de Tablas:** `puc_` (`srv_finance.puc_journal_headers`)
- **Prerrequisitos (`requires`):** `["srv:finance", "ms:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `"accounting_ledger_engine"`
- **Reemplaza a (`supersedes`):** `["ms:finance-cashbook"]` (en modo `"readonly_archive"`)
- **Override de Servidor Dedicado:** `UPSTREAM_MS_FINANCE_ACCOUNTING_PUC`

## ¿De qué trata este microservicio?
Motor contable formal bajo Plan Único de Cuentas (PUC) y NIIF por partida doble. Valida estrictamente en cada comprobante contable que la suma exacta de débitos sea igual a la suma exacta de créditos ($\sum \text{Débitos} = \sum \text{Créditos}$) utilizando `MoneyDecimal` (`NUMERIC(19, 4)`) con imputación por tercero (`ms:crm-directory`).
