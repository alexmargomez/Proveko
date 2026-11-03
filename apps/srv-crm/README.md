# Servicio Padre: Clientes y Comercial (`srv:crm`)

- **Identificador del Servicio Padre (Gatekeeper):** `srv:crm`
- **Esquema PostgreSQL por Inquilino:** `srv_crm` (`pgSchema('srv_crm')`)
- **Variable de Entorno en API Gateway:** `UPSTREAM_SRV_CRM`

## Regla de Compuerta (Service Gatekeeper)
Habilitar únicamente `srv:crm` sin ningún microservicio hijo no expone pantallas, pero es obligatorio tener `srv:crm` activo para activar cualquiera de sus 3 microservicios hijos. Si se desactiva `srv:crm`, se bloquea en cascada todo el grupo.

## Microservicios Hijos del Grupo
1. [`ms:crm-directory`](./ms-crm-directory/README.md) — Directorio de Terceros, Clientes y Proveedores (Prefijo: `dir_`)
2. [`ms:crm-pipelines`](./ms-crm-pipelines/README.md) — Embudos Comerciales y Oportunidades (Prefijo: `pip_`)
3. [`ms:crm-loyalty`](./ms-crm-loyalty/README.md) — Fidelización y Billetera de Puntos (Prefijo: `loy_`)

## Despliegue Elástico (`host-runner`)
Puedes correr los 3 microservicios juntos en un solo servidor mediante `apps/srv-crm/host-runner` o filtrar cuáles corren en esta máquina usando `ENABLED_MICROSERVICES=ms:crm-directory,ms:crm-pipelines`.
