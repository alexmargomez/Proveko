# Módulo Interno (Prender / Apagar): Directorio de Terceros y Clientes (`mod:crm-directory`)

- **Clave del Módulo (On/Off):** `mod:crm-directory` (alias `ms:crm-directory`)
- **Pertenece al Microservicio Independiente:** `ms:crm` (`srv:crm`)
- **Esquema PostgreSQL:** `srv_crm`
- **Prefijo de Tablas:** `dir_` (`srv_crm.dir_contacts`)
- **Prerrequisitos (`requires`):** `["ms:crm"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:crm` que se prende o apaga según la suscripción del cliente. Gestiona el padrón único de terceros fiscales (clientes, proveedores, huéspedes y empleados) con identificación tributaria (`NIT`, `CC`, `CE`, `PASSPORT`), cupo de crédito financiero (`NUMERIC(19, 4)`) y campos personalizados `custom_fields JSONB` protegidos por `CustomFieldsAndWebhookGuard` (máximo 32 KB y 3 niveles de profundidad). Es prerrequisito base para Facturación, Reservas de Hotel y Cartera Financiera.

## Endpoints Principales
- `GET /api/v1/ms:crm/mod:crm-directory/contacts`: Lista los terceros registrados en la sucursal activa.
- `POST /api/v1/ms:crm/mod:crm-directory/contacts`: Crea un nuevo tercero validando `custom_fields` y cupo de crédito con `MoneyDecimal`.
