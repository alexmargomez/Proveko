# Módulo Interno (Prender / Apagar): Punto de Venta POS y Turnos de Caja (`mod:invoicing-pos`)

- **Clave del Módulo (On/Off):** `mod:invoicing-pos` (alias `ms:invoicing-pos`)
- **Pertenece al Microservicio Independiente:** `ms:invoicing` (`srv:invoicing`)
- **Esquema PostgreSQL:** `srv_invoicing`
- **Prefijo de Tablas:** `pos_` (`srv_invoicing.pos_cash_shifts`, `srv_invoicing.pos_sale_tickets`)
- **Prerrequisitos (`requires`):** `["ms:invoicing", "mod:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:invoicing` que se prende o apaga según la suscripción del cliente. Gestiona la caja registradora POS: apertura/arqueo/cierre de turnos de cajero, liquidación exacta de líneas de venta e impuestos con `MoneyDecimal` (`NUMERIC(19, 4)`) y detección automática del módulo emisor documental prendido (`mod:invoicing-electronic-dian` o `mod:invoicing-simple-receipt`).

## Endpoints Principales
- `GET /api/v1/ms:invoicing/mod:invoicing-pos/shifts`: Consulta los turnos de caja de la sucursal.
- `POST /api/v1/ms:invoicing/mod:invoicing-pos/checkout`: Liquida una venta en caja POS y resuelve el emisor fiscal activo.
