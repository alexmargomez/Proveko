# Microservicio: Lotes, Series y Vencimientos FEFO (`ms:inventory-lots`)

- **Clave del Microservicio:** `ms:inventory-lots`
- **Servicio Padre (Gatekeeper):** `srv:inventory`
- **Esquema PostgreSQL:** `srv_inventory`
- **Prefijo de Tablas:** `lot_` (`srv_inventory.lot_batches`)
- **Prerrequisitos (`requires`):** `["srv:inventory", "ms:inventory-stock"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_INVENTORY_LOTS`

## ¿De qué trata este microservicio?
Diseñado para farmacias, distribuidoras de alimentos y comercios con control sanitario. Administra lotes con fecha de vencimiento y aplica el algoritmo **FEFO (*First-Expired, First-Out*)** para despachar siempre primero las unidades cuyo lote vence más pronto.

## Endpoints Principales
- `GET /api/v1/srv:inventory/ms:inventory-lots/batches`: Consulta los lotes disponibles y sus fechas de vencimiento.
- `POST /api/v1/srv:inventory/ms:inventory-lots/batches/allocate-fefo`: Asigna automáticamente qué lotes descontar para cubrir una cantidad solicitada bajo orden FEFO.
