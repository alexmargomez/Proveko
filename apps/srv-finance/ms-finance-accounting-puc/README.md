# Módulo Interno (Prender / Apagar): Contabilidad PUC / NIIF (`mod:finance-accounting-puc`)

- **Clave del Módulo (On/Off):** `mod:finance-accounting-puc` (alias `ms:finance-accounting-puc`)
- **Pertenece al Microservicio Independiente:** `ms:finance` (`srv:finance`)
- **Esquema PostgreSQL:** `srv_finance`
- **Prefijo de Tablas:** `puc_` (`srv_finance.puc_journal_headers`)
- **Prerrequisitos (`requires`):** `["ms:finance", "mod:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `"accounting_ledger_engine"`
- **Reemplaza a (`supersedes`):** `["mod:finance-cashbook"]` (en modo `"readonly_archive"`)

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:finance` que se prende o apaga según la suscripción del cliente. Opera como motor contable formal bajo Plan Único de Cuentas (PUC) y NIIF por partida doble: valida estrictamente en cada comprobante contable que la suma exacta de débitos sea igual a la suma exacta de créditos ($\sum \text{Débitos} = \sum \text{Créditos}$) utilizando `MoneyDecimal` (`NUMERIC(19, 4)`) con imputación por tercero (`mod:crm-directory`).
