# Microservicio: Libro de Caja Simple (`ms:finance-cashbook`)

- **Clave del Microservicio:** `ms:finance-cashbook`
- **Servicio Padre (Gatekeeper):** `srv:finance`
- **Esquema PostgreSQL:** `srv_finance`
- **Prefijo de Tablas:** `csh_` (`srv_finance.csh_entries`)
- **Prerrequisitos (`requires`):** `["srv:finance"]`
- **Grupo de Exclusión (`mutex_group`):** `"accounting_ledger_engine"`
- **Reemplazado por (`superseded by`):** `ms:finance-accounting-puc` -> pasa a `READONLY_ARCHIVE`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_FINANCE_CASHBOOK`

## ¿De qué trata este microservicio?
Permite a pequeños negocios llevar un control ágil de entradas y salidas de dinero (`INCOME` / `EXPENSE`) sin requerir conocimientos de plan de cuentas PUC. Si el negocio crece y activa `ms:finance-accounting-puc`, pasa automáticamente a `READONLY_ARCHIVE` conservando intacta la consulta de sus registros históricos.
