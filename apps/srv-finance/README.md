# Servicio Padre: Finanzas y Contabilidad (`srv:finance`)

- **Identificador del Servicio Padre (Gatekeeper):** `srv:finance`
- **Esquema PostgreSQL por Inquilino:** `srv_finance` (`pgSchema('srv_finance')`)
- **Variable de Entorno en API Gateway:** `UPSTREAM_SRV_FINANCE`

## Regla de Compuerta y Exclusión Mutua (`accounting_ledger_engine`)
1. `srv:finance` debe estar habilitado para activar cualquiera de sus 3 microservicios hijos.
2. Los microservicios `ms:finance-cashbook` y `ms:finance-accounting-puc` comparten el grupo de exclusión mutua **`mutex_group: "accounting_ledger_engine"`**.
3. Cuando una empresa evoluciona de caja simple a contabilidad formal y activa `ms:finance-accounting-puc`, este reemplaza (`supersedes`) a `ms:finance-cashbook`, pasándolo automáticamente a modo **`READONLY_ARCHIVE`**.

## Microservicios Hijos del Grupo
1. [`ms:finance-cashbook`](./ms-finance-cashbook/README.md) — Libro Diario Simple de Ingresos y Gastos (Prefijo: `csh_`)
2. [`ms:finance-ar-ap`](./ms-finance-ar-ap/README.md) — Cartera de Cuentas por Cobrar y por Pagar CxC/CxP (Prefijo: `arp_`)
3. [`ms:finance-accounting-puc`](./ms-finance-accounting-puc/README.md) — Contabilidad Completa PUC/NIIF por Partida Doble (Prefijo: `puc_`)
