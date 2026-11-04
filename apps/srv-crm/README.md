# Microservicio Independiente: Clientes y Comercial (`ms:crm` / `srv:crm`)

- **Identificador del Microservicio:** `ms:crm` (alias `srv:crm`)
- **Esquema PostgreSQL Aislado por Inquilino:** `srv_crm` (`pgSchema('srv_crm')`)
- **Variable de Servidor en API Gateway:** `UPSTREAM_MS_CRM` (o `UPSTREAM_SRV_CRM`)

## Naturaleza del Microservicio y sus Módulos Internos
`ms:crm` es un **Microservicio Independiente** desplegable en su propio servidor/contenedor. Dentro de él viven sus **Módulos internos (`mod:crm-*`)**, los cuales **no son servidores separados**, sino capacidades funcionales que se **prenden y apagan dinámicamente por cliente** según su suscripción.

- Activar únicamente el Microservicio `ms:crm` sin ningún módulo interno habilita el contenedor pero no expone pantallas.
- Apagar el Microservicio `ms:crm` corta en cascada todos sus módulos internos.

## Módulos Internos (Prender / Apagar)
1. [`mod:crm-directory`](./ms-crm-directory/README.md) — Directorio de Terceros, Clientes y Proveedores (Prefijo: `dir_`)
2. [`mod:crm-pipelines`](./ms-crm-pipelines/README.md) — Embudos Comerciales y Oportunidades (Prefijo: `pip_`)
3. [`mod:crm-loyalty`](./ms-crm-loyalty/README.md) — Fidelización y Billetera de Puntos (Prefijo: `loy_`)
