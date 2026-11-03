# Microservicio: Comandas de Cocina y Barra KDS (`ms:gastro-kds`)

- **Clave del Microservicio:** `ms:gastro-kds`
- **Servicio Padre (Gatekeeper):** `srv:gastro`
- **Esquema PostgreSQL:** `srv_gastro`
- **Prefijo de Tablas:** `kds_` (`srv_gastro.kds_tickets`)
- **Prerrequisitos (`requires`):** `["srv:gastro", "ms:gastro-tables"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_GASTRO_KDS`

## ¿De qué trata este microservicio?
Sistema de Pantallas de Cocina y Barra (*Kitchen Display System — KDS*). Recibe los pedidos tomados en las mesas (`ms:gastro-tables`), los separa por estación de preparación (`HOT_KITCHEN`, `BAR`, `GRILL`) y controla tiempos de preparación (`PREPARING`, `READY`, `SERVED`).

## Endpoints Principales
- `GET /api/v1/srv:gastro/ms:gastro-kds/tickets`: Lista las comandas activas por estación.
- `POST /api/v1/srv:gastro/ms:gastro-kds/tickets/dispatch`: Despacha una nueva comanda a cocina o barra.
