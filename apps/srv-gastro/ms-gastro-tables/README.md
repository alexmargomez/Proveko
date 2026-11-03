# Microservicio: Salones, Mesas y Ocupación (`ms:gastro-tables`)

- **Clave del Microservicio:** `ms:gastro-tables`
- **Servicio Padre (Gatekeeper):** `srv:gastro`
- **Esquema PostgreSQL:** `srv_gastro`
- **Prefijo de Tablas:** `tbl_` (`srv_gastro.tbl_dining_tables`)
- **Prerrequisitos (`requires`):** `["srv:gastro", "ms:invoicing-pos"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_GASTRO_TABLES`

## ¿De qué trata este microservicio?
Gestiona el plano de salones, terrazas y barras, controlando en tiempo real el estado de cada mesa (`AVAILABLE`, `OCCUPIED`, `BILL_REQUESTED`) y la cantidad de comensales atendidos. Es prerrequisito para `ms:gastro-kds` y `ms:gastro-split-check`.

## Endpoints Principales
- `GET /api/v1/srv:gastro/ms:gastro-tables/tables`: Consulta el estado de todas las mesas de la sucursal.
- `POST /api/v1/srv:gastro/ms:gastro-tables/tables/occupy`: Abre una mesa y asigna número de comensales.
