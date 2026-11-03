# Microservicio: Punto de Venta POS y Turnos de Caja (`ms:invoicing-pos`)

- **Clave del Microservicio:** `ms:invoicing-pos`
- **Servicio Padre (Gatekeeper):** `srv:invoicing`
- **Esquema PostgreSQL:** `srv_invoicing`
- **Prefijo de Tablas:** `pos_` (`srv_invoicing.pos_cash_shifts`, `srv_invoicing.pos_sale_tickets`)
- **Prerrequisitos (`requires`):** `["srv:invoicing", "ms:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_INVOICING_POS`

## ¿De qué trata este microservicio?
Motor operativo de caja registradora POS: apertura/arqueo/cierre de turnos de cajero, liquidación exacta de líneas de venta e impuestos con `MoneyDecimal` (`NUMERIC(19, 4)`) y detección automática del emisor documental activo (`ms:invoicing-electronic-dian` o `ms:invoicing-simple-receipt`).

## Endpoints Principales
- `GET /api/v1/srv:invoicing/ms:invoicing-pos/shifts`: Consulta los turnos de caja de la sucursal.
- `POST /api/v1/srv:invoicing/ms:invoicing-pos/checkout`: Liquida una venta en caja POS y resuelve el emisor fiscal activo.
