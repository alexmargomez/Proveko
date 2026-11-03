# Microservicio: Traslados entre Sucursales (`ms:inventory-transfers`)

- **Clave del Microservicio:** `ms:inventory-transfers`
- **Servicio Padre (Gatekeeper):** `srv:inventory`
- **Esquema PostgreSQL:** `srv_inventory`
- **Prefijo de Tablas:** `trf_` (`srv_inventory.trf_orders`)
- **Prerrequisitos (`requires`):** `["srv:inventory", "ms:inventory-stock"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_INVENTORY_TRANSFERS`

## ¿De qué trata este microservicio?
Gestiona órdenes de traslado y requisiciones de mercancía entre diferentes sedes o bodegas de la misma empresa (`fromBranchId` -> `toBranchId`), verificando que el usuario tenga permisos sobre las sucursales involucradas (`allowed_branch_ids`).

## Endpoints Principales
- `GET /api/v1/srv:inventory/ms:inventory-transfers/transfers`: Lista los traslados en tránsito o recibidos.
- `POST /api/v1/srv:inventory/ms:inventory-transfers/transfers`: Crea una orden de traslado validando autorización multi-sede.
