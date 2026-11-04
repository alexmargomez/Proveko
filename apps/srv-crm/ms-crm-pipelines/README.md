# Módulo Interno (Prender / Apagar): Embudos Comerciales y Oportunidades (`mod:crm-pipelines`)

- **Clave del Módulo (On/Off):** `mod:crm-pipelines` (alias `ms:crm-pipelines`)
- **Pertenece al Microservicio Independiente:** `ms:crm` (`srv:crm`)
- **Esquema PostgreSQL:** `srv_crm`
- **Prefijo de Tablas:** `pip_` (`srv_crm.pip_deals`)
- **Prerrequisitos (`requires`):** `["ms:crm", "mod:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:crm` que se prende o apaga según la suscripción del cliente. Permite gestionar oportunidades de venta B2B/B2C vinculadas a los terceros de `mod:crm-directory`, organizadas por etapas del embudo (`LEAD`, `QUALIFIED`, `PROPOSAL`, `WON`, `LOST`) con valor esperado exacto en `MoneyDecimal` (`NUMERIC(19, 4)`).

## Endpoints Principales
- `GET /api/v1/ms:crm/mod:crm-pipelines/deals`: Consulta las oportunidades activas del embudo.
- `POST /api/v1/ms:crm/mod:crm-pipelines/deals`: Registra una nueva oportunidad comercial.
