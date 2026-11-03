# Microservicio: Productos, Bodegas y Kardex (`ms:inventory-stock`)

- **Clave del Microservicio:** `ms:inventory-stock`
- **Servicio Padre (Gatekeeper):** `srv:inventory`
- **Esquema PostgreSQL:** `srv_inventory`
- **Prefijo de Tablas:** `stk_` (`srv_inventory.stk_items`, `srv_inventory.stk_movements`)
- **Prerrequisitos (`requires`):** `["srv:inventory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_INVENTORY_STOCK`

## ¿De qué trata este microservicio?
Administra el catálogo maestro de productos/SKUs, existencias por bodega/sucursal (`qty_on_hand`), costos unitarios y movimientos de Kardex (`INBOUND`, `OUTBOUND_SALE`, `RECIPE_DEDUCTION`, `ADJUSTMENT`) con precisión `NUMERIC(19, 4)`. Es prerrequisito obligatorio para `ms:inventory-recipes`, `ms:inventory-lots` y `ms:inventory-transfers`.

## Endpoints Principales
- `GET /api/v1/srv:inventory/ms:inventory-stock/items`: Consulta las existencias actuales de la sucursal activa.
- `POST /api/v1/srv:inventory/ms:inventory-stock/movements`: Registra entradas/salidas de Kardex y recalcula la valorización total con `MoneyDecimal`.
