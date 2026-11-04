# Microservicio Independiente: Finanzas y Contabilidad (`ms:finance` / `srv:finance`)

- **Identificador del Microservicio:** `ms:finance` (alias `srv:finance`)
- **Esquema PostgreSQL Aislado por Inquilino:** `srv_finance` (`pgSchema('srv_finance')`)
- **Variable de Servidor en API Gateway:** `UPSTREAM_MS_FINANCE` (o `UPSTREAM_SRV_FINANCE`)

## Naturaleza del Microservicio y sus Módulos Internos
`ms:finance` es un **Microservicio Independiente** desplegable en su propio servidor/contenedor. Dentro de él viven sus **Módulos internos (`mod:finance-*`)**, los cuales se **prenden y apagan dinámicamente por cliente**:

1. Los módulos `mod:finance-cashbook` y `mod:finance-accounting-puc` comparten el grupo de exclusión mutua **`mutex_group: "accounting_ledger_engine"`**.
2. Cuando una empresa evoluciona de caja simple a contabilidad formal y prende `mod:finance-accounting-puc`, este reemplaza (`supersedes`) a `mod:finance-cashbook`, pasándolo automáticamente a modo **`READONLY_ARCHIVE`**.

## Módulos Internos (Prender / Apagar)
1. [`mod:finance-cashbook`](./ms-finance-cashbook/README.md) — Libro Diario Simple de Ingresos y Gastos (Prefijo: `csh_`)
2. [`mod:finance-ar-ap`](./ms-finance-ar-ap/README.md) — Cartera de Cuentas por Cobrar y por Pagar CxC/CxP (Prefijo: `arp_`)
3. [`mod:finance-accounting-puc`](./ms-finance-accounting-puc/README.md) — Contabilidad Completa PUC/NIIF por Partida Doble (Prefijo: `puc_`)
