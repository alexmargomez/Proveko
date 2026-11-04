# Microservicio Independiente: Facturación y Ventas (`ms:invoicing` / `srv:invoicing`)

- **Identificador del Microservicio:** `ms:invoicing` (alias `srv:invoicing`)
- **Esquema PostgreSQL Aislado por Inquilino:** `srv_invoicing` (`pgSchema('srv_invoicing')`)
- **Variable de Servidor en API Gateway:** `UPSTREAM_MS_INVOICING` (o `UPSTREAM_SRV_INVOICING`)

## Naturaleza del Microservicio y sus Módulos Internos
`ms:invoicing` es un **Microservicio Independiente** desplegable en su propio servidor/contenedor. Dentro de él viven sus **Módulos internos (`mod:invoicing-*`)**, los cuales **no son servidores separados**, sino capacidades funcionales que se **prenden y apagan por cliente**:

1. Los módulos `mod:invoicing-simple-receipt` y `mod:invoicing-electronic-dian` comparten el grupo de exclusión mutua **`mutex_group: "fiscal_document_emitter"`** (no pueden estar prendidos en modo escritura al mismo tiempo).
2. Cuando un cliente evoluciona y prende `mod:invoicing-electronic-dian`, este reemplaza (`supersedes`) a `mod:invoicing-simple-receipt`, pasándolo automáticamente a modo **`READONLY_ARCHIVE`** (permite consultar recibos históricos pero apaga nuevas emisiones).

## Módulos Internos (Prender / Apagar)
1. [`mod:invoicing-pos`](./ms-invoicing-pos/README.md) — Punto de Venta POS y Turnos de Caja (Prefijo: `pos_`)
2. [`mod:invoicing-simple-receipt`](./ms-invoicing-simple-receipt/README.md) — Recibo / Cuenta de Cobro No Fiscal (Prefijo: `rcp_`)
3. [`mod:invoicing-electronic-dian`](./ms-invoicing-electronic-dian/README.md) — Facturación Electrónica DIAN UBL 2.1 (Prefijo: `dian_`)
4. [`mod:invoicing-quotes`](./ms-invoicing-quotes/README.md) — Cotizaciones y Remisiones Comerciales (Prefijo: `quo_`)
