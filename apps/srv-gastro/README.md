# Microservicio Independiente: Gastronomía, Bares y Restaurantes (`ms:gastro` / `srv:gastro`)

- **Identificador del Microservicio:** `ms:gastro` (alias `srv:gastro`)
- **Esquema PostgreSQL Aislado por Inquilino:** `srv_gastro` (`pgSchema('srv_gastro')`)
- **Variable de Servidor en API Gateway:** `UPSTREAM_MS_GASTRO` (o `UPSTREAM_SRV_GASTRO`)

## Naturaleza del Microservicio y sus Módulos Internos
`ms:gastro` es un **Microservicio Independiente** desplegable en su propio servidor/contenedor. Dentro de él viven sus **Módulos internos (`mod:gastro-*`)**, los cuales se **prenden y apagan dinámicamente por cliente** según las herramientas gastronómicas contratadas.

## Módulos Internos (Prender / Apagar)
1. [`mod:gastro-tables`](./ms-gastro-tables/README.md) — Mapa de Salones, Mesas y Ocupación (Prefijo: `tbl_`)
2. [`mod:gastro-kds`](./ms-gastro-kds/README.md) — Comandas de Cocina y Barra KDS (Prefijo: `kds_`)
3. [`mod:gastro-split-check`](./ms-gastro-split-check/README.md) — División de Cuentas por Silla/Ítem y Propinas (Prefijo: `spl_`)
