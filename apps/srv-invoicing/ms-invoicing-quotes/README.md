# Módulo Interno (Prender / Apagar): Cotizaciones y Remisiones (`mod:invoicing-quotes`)

- **Clave del Módulo (On/Off):** `mod:invoicing-quotes` (alias `ms:invoicing-quotes`)
- **Pertenece al Microservicio Independiente:** `ms:invoicing` (`srv:invoicing`)
- **Esquema PostgreSQL:** `srv_invoicing`
- **Prefijo de Tablas:** `quo_` (`srv_invoicing.quo_quotes`)
- **Prerrequisitos (`requires`):** `["ms:invoicing", "mod:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:invoicing` que se prende o apaga según la suscripción del cliente. Permite elaborar cotizaciones formales y remisiones de entrega con fecha de vigencia para clientes del directorio CRM (`mod:crm-directory`), listas para convertirse en factura en 1 clic sin volver a digitar los productos.

## Endpoints Principales
- `GET /api/v1/ms:invoicing/mod:invoicing-quotes/quotes`: Lista las cotizaciones abiertas o facturadas.
- `POST /api/v1/ms:invoicing/mod:invoicing-quotes/quotes`: Crea una nueva cotización comercial con `MoneyDecimal`.
