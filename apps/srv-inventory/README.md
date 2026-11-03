# Servicio Padre: Inventario y Logística (`srv:inventory`)

- **Identificador del Servicio Padre (Gatekeeper):** `srv:inventory`
- **Esquema PostgreSQL por Inquilino:** `srv_inventory` (`pgSchema('srv_inventory')`)
- **Variable de Entorno en API Gateway:** `UPSTREAM_SRV_INVENTORY`

## Regla de Compuerta (Service Gatekeeper)
Habilitar únicamente `srv:inventory` sin ningún microservicio hijo no expone pantallas, pero es obligatorio tener `srv:inventory` activo para habilitar cualquiera de sus 4 microservicios hijos.

## Microservicios Hijos del Grupo
1. [`ms:inventory-stock`](./ms-inventory-stock/README.md) — Productos, Bodegas y Kardex Valorizado (Prefijo: `stk_`)
2. [`ms:inventory-recipes`](./ms-inventory-recipes/README.md) — Recetas, Escandallos y Explosión de Insumos BOM (Prefijo: `rec_`)
3. [`ms:inventory-lots`](./ms-inventory-lots/README.md) — Lotes, Series y Vencimientos FEFO (Prefijo: `lot_`)
4. [`ms:inventory-transfers`](./ms-inventory-transfers/README.md) — Traslados de Mercancía entre Sucursales (Prefijo: `trf_`)

## Despliegue Elástico (`host-runner`)
Puedes correr los 4 microservicios juntos en un solo servidor mediante `apps/srv-inventory/host-runner` o separar cualquiera en un servidor dedicado usando `ENABLED_MICROSERVICES` y `UPSTREAM_MS_INVENTORY_*`.
