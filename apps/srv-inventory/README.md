# Microservicio Independiente: Inventario y Logística (`ms:inventory` / `srv:inventory`)

- **Identificador del Microservicio:** `ms:inventory` (alias `srv:inventory`)
- **Esquema PostgreSQL Aislado por Inquilino:** `srv_inventory` (`pgSchema('srv_inventory')`)
- **Variable de Servidor en API Gateway:** `UPSTREAM_MS_INVENTORY` (o `UPSTREAM_SRV_INVENTORY`)

## Naturaleza del Microservicio y sus Módulos Internos
`ms:inventory` es un **Microservicio Independiente** desplegable en su propio servidor/contenedor. Dentro de él viven sus **Módulos internos (`mod:inventory-*`)**, los cuales **no son servidores separados**, sino funcionalidades que se **prenden y apagan dinámicamente por cliente** según su plan.

## Módulos Internos (Prender / Apagar)
1. [`mod:inventory-stock`](./ms-inventory-stock/README.md) — Productos, Bodegas y Kardex Valorizado (Prefijo: `stk_`)
2. [`mod:inventory-recipes`](./ms-inventory-recipes/README.md) — Recetas, Escandallos y Explosión de Insumos BOM (Prefijo: `rec_`)
3. [`mod:inventory-lots`](./ms-inventory-lots/README.md) — Lotes, Series y Vencimientos FEFO (Prefijo: `lot_`)
4. [`mod:inventory-transfers`](./ms-inventory-transfers/README.md) — Traslados de Mercancía entre Sucursales (Prefijo: `trf_`)
