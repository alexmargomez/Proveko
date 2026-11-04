# Módulo Interno (Prender / Apagar): Traslados entre Sucursales (`mod:inventory-transfers`)

- **Clave del Módulo (On/Off):** `mod:inventory-transfers` (alias `ms:inventory-transfers`)
- **Pertenece al Microservicio Independiente:** `ms:inventory` (`srv:inventory`)
- **Esquema PostgreSQL:** `srv_inventory`
- **Prefijo de Tablas:** `trf_` (`srv_inventory.trf_orders`)
- **Prerrequisitos (`requires`):** `["ms:inventory", "mod:inventory-stock"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:inventory` que se prende o apaga según la suscripción del cliente. Gestiona órdenes de traslado y requisiciones de mercancía entre diferentes sedes o bodegas de la misma empresa (`fromBranchId` -> `toBranchId`), verificando que el usuario tenga permisos sobre las sucursales involucradas (`allowed_branch_ids`).

## Endpoints Principales
- `GET /api/v1/ms:inventory/mod:inventory-transfers/transfers`: Lista los traslados en tránsito o recibidos.
- `POST /api/v1/ms:inventory/mod:inventory-transfers/transfers`: Crea una orden de traslado validando autorización multi-sede.
