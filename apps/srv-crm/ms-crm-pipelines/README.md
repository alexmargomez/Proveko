# Microservicio: Embudos Comerciales y Oportunidades (`ms:crm-pipelines`)

- **Clave del Microservicio:** `ms:crm-pipelines`
- **Servicio Padre (Gatekeeper):** `srv:crm`
- **Esquema PostgreSQL:** `srv_crm`
- **Prefijo de Tablas:** `pip_` (`srv_crm.pip_deals`)
- **Prerrequisitos (`requires`):** `["srv:crm", "ms:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_CRM_PIPELINES`

## ¿De qué trata este microservicio?
Permite gestionar oportunidades de venta B2B/B2C vinculadas a los terceros de `ms:crm-directory`, organizadas por etapas del embudo (`LEAD`, `QUALIFIED`, `PROPOSAL`, `WON`, `LOST`) con valor esperado exacto en `MoneyDecimal` (`NUMERIC(19, 4)`).

## Endpoints Principales
- `GET /api/v1/srv:crm/ms:crm-pipelines/deals`: Consulta las oportunidades activas del embudo.
- `POST /api/v1/srv:crm/ms:crm-pipelines/deals`: Registra una nueva oportunidad comercial.
