# Módulo Interno (Prender / Apagar): Comandas de Cocina y Barra KDS (`mod:gastro-kds`)

- **Clave del Módulo (On/Off):** `mod:gastro-kds` (alias `ms:gastro-kds`)
- **Pertenece al Microservicio Independiente:** `ms:gastro` (`srv:gastro`)
- **Esquema PostgreSQL:** `srv_gastro`
- **Prefijo de Tablas:** `kds_` (`srv_gastro.kds_tickets`)
- **Prerrequisitos (`requires`):** `["ms:gastro", "mod:gastro-tables"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:gastro` que se prende o apaga según la suscripción del cliente. Opera el Sistema de Pantallas de Cocina y Barra (*Kitchen Display System — KDS*): recibe los pedidos tomados en las mesas (`mod:gastro-tables`), los separa por estación de preparación (`HOT_KITCHEN`, `BAR`, `GRILL`) y controla tiempos de preparación (`PREPARING`, `READY`, `SERVED`).

## Endpoints Principales
- `GET /api/v1/ms:gastro/mod:gastro-kds/tickets`: Lista las comandas activas por estación.
- `POST /api/v1/ms:gastro/mod:gastro-kds/tickets/dispatch`: Despacha una nueva comanda a cocina o barra.
