# Módulo Interno (Prender / Apagar): Libro de Caja Simple (`mod:finance-cashbook`)

- **Clave del Módulo (On/Off):** `mod:finance-cashbook` (alias `ms:finance-cashbook`)
- **Pertenece al Microservicio Independiente:** `ms:finance` (`srv:finance`)
- **Esquema PostgreSQL:** `srv_finance`
- **Prefijo de Tablas:** `csh_` (`srv_finance.csh_entries`)
- **Prerrequisitos (`requires`):** `["ms:finance"]`
- **Grupo de Exclusión (`mutex_group`):** `"accounting_ledger_engine"`
- **Reemplazado por (`superseded by`):** `mod:finance-accounting-puc` -> pasa a `READONLY_ARCHIVE`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:finance` que se prende o apaga según la suscripción del cliente. Permite a pequeños negocios llevar un control ágil de entradas y salidas de dinero (`INCOME` / `EXPENSE`) sin requerir conocimientos de plan de cuentas PUC. Si el negocio crece y prende `mod:finance-accounting-puc`, pasa automáticamente a `READONLY_ARCHIVE` conservando intacta la consulta de sus registros históricos.
