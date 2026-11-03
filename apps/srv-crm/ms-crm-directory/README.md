# Microservicio: Directorio de Terceros y Clientes (`ms:crm-directory`)

- **Clave del Microservicio:** `ms:crm-directory`
- **Servicio Padre (Gatekeeper):** `srv:crm`
- **Esquema PostgreSQL:** `srv_crm`
- **Prefijo de Tablas:** `dir_` (`srv_crm.dir_contacts`)
- **Prerrequisitos (`requires`):** `["srv:crm"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_CRM_DIRECTORY`

## ¿De qué trata este microservicio?
Gestiona el padrón único de terceros fiscales (clientes, proveedores, huéspedes y empleados) con identificación tributaria (`NIT`, `CC`, `CE`, `PASSPORT`), cupo de crédito financiero (`NUMERIC(19, 4)`) y campos personalizados `custom_fields JSONB` protegidos por `CustomFieldsAndWebhookGuard` (máximo 32 KB y 3 niveles de profundidad). Es prerrequisito base para Facturación, Reservas de Hotel y Cartera Financiera.

## Endpoints Principales
- `GET /api/v1/srv:crm/ms:crm-directory/contacts`: Lista los terceros registrados en la sucursal activa.
- `POST /api/v1/srv:crm/ms:crm-directory/contacts`: Crea un nuevo tercero validando `custom_fields` y cupo de crédito con `MoneyDecimal`.
