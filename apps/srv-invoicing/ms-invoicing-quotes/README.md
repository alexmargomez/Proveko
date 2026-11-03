# Microservicio: Cotizaciones y Remisiones (`ms:invoicing-quotes`)

- **Clave del Microservicio:** `ms:invoicing-quotes`
- **Servicio Padre (Gatekeeper):** `srv:invoicing`
- **Esquema PostgreSQL:** `srv_invoicing`
- **Prefijo de Tablas:** `quo_` (`srv_invoicing.quo_quotes`)
- **Prerrequisitos (`requires`):** `["srv:invoicing", "ms:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_INVOICING_QUOTES`

## ¿De qué trata este microservicio?
Permite elaborar cotizaciones formales y remisiones de entrega con fecha de vigencia para clientes del directorio CRM (`ms:crm-directory`), listas para convertirse en factura en 1 clic sin volver a digitar los productos.

## Endpoints Principales
- `GET /api/v1/srv:invoicing/ms:invoicing-quotes/quotes`: Lista las cotizaciones abiertas o facturadas.
- `POST /api/v1/srv:invoicing/ms:invoicing-quotes/quotes`: Crea una nueva cotización comercial con `MoneyDecimal`.
