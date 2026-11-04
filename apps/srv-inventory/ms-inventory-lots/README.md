# Módulo Interno (Prender / Apagar): Lotes, Series y Vencimientos FEFO (`mod:inventory-lots`)

- **Clave del Módulo (On/Off):** `mod:inventory-lots` (alias `ms:inventory-lots`)
- **Pertenece al Microservicio Independiente:** `ms:inventory` (`srv:inventory`)
- **Esquema PostgreSQL:** `srv_inventory`
- **Prefijo de Tablas:** `lot_` (`srv_inventory.lot_batches`)
- **Prerrequisitos (`requires`):** `["ms:inventory", "mod:inventory-stock"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:inventory` que se prende o apaga según la suscripción del cliente (diseñado para farmacias, distribuidoras de alimentos y comercios con control sanitario). Administra lotes con fecha de vencimiento y aplica el algoritmo **FEFO (*First-Expired, First-Out*)** para despachar siempre primero las unidades cuyo lote vence más pronto.

## Endpoints Principales
- `GET /api/v1/ms:inventory/mod:inventory-lots/batches`: Consulta los lotes disponibles y sus fechas de vencimiento.
- `POST /api/v1/ms:inventory/mod:inventory-lots/batches/allocate-fefo`: Asigna automáticamente qué lotes descontar para cubrir una cantidad solicitada bajo orden FEFO.
