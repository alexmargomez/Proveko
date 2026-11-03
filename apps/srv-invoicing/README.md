# Servicio Padre: Facturación y Ventas (`srv:invoicing`)

- **Identificador del Servicio Padre (Gatekeeper):** `srv:invoicing`
- **Esquema PostgreSQL por Inquilino:** `srv_invoicing` (`pgSchema('srv_invoicing')`)
- **Variable de Entorno en API Gateway:** `UPSTREAM_SRV_INVOICING`

## Regla de Compuerta y Exclusión Mutua (`fiscal_document_emitter`)
1. `srv:invoicing` debe estar habilitado para activar cualquiera de sus 4 microservicios hijos.
2. Los microservicios `ms:invoicing-simple-receipt` y `ms:invoicing-electronic-dian` comparten el grupo de exclusión mutua **`mutex_group: "fiscal_document_emitter"`**.
3. Cuando una empresa activa `ms:invoicing-electronic-dian`, este reemplaza (`supersedes`) a `ms:invoicing-simple-receipt`, pasándolo automáticamente a modo **`READONLY_ARCHIVE`** (conservando la consulta histórica de recibos anteriores y bloqueando nuevas emisiones).

## Microservicios Hijos del Grupo
1. [`ms:invoicing-pos`](./ms-invoicing-pos/README.md) — Punto de Venta POS y Turnos de Caja (Prefijo: `pos_`)
2. [`ms:invoicing-simple-receipt`](./ms-invoicing-simple-receipt/README.md) — Recibo / Cuenta de Cobro No Fiscal (Prefijo: `rcp_`)
3. [`ms:invoicing-electronic-dian`](./ms-invoicing-electronic-dian/README.md) — Facturación Electrónica DIAN UBL 2.1 (Prefijo: `dian_`)
4. [`ms:invoicing-quotes`](./ms-invoicing-quotes/README.md) — Cotizaciones y Remisiones Comerciales (Prefijo: `quo_`)
