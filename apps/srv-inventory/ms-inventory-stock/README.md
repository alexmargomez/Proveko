# Módulo Interno (Prender / Apagar): Productos, Bodegas y Kardex (`mod:inventory-stock`)

- **Clave del Módulo (On/Off):** `mod:inventory-stock` (alias `ms:inventory-stock`)
- **Pertenece al Microservicio Independiente:** `ms:inventory` (`srv:inventory`)
- **Esquema PostgreSQL:** `srv_inventory`
- **Prefijo de Tablas:** `stk_` (`srv_inventory.stk_items`, `srv_inventory.stk_movements`)
- **Prerrequisitos (`requires`):** `["ms:inventory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:inventory` que se prende o apaga según la suscripción del cliente. Administra el catálogo maestro de productos/SKUs, existencias por bodega/sucursal (`qty_on_hand`), costos unitarios y movimientos de Kardex con precisión `NUMERIC(19, 4)`. Es prerrequisito obligatorio para `mod:inventory-recipes`, `mod:inventory-lots` y `mod:inventory-transfers`.

## Endpoints Principales
- `GET /api/v1/ms:inventory/mod:inventory-stock/items`: Consulta las existencias actuales de la sucursal activa.
- `POST /api/v1/ms:inventory/mod:inventory-stock/movements`: Registra entradas/salidas de Kardex y recalcula la valorización total con `MoneyDecimal`.
