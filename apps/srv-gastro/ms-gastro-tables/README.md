# Módulo Interno (Prender / Apagar): Salones, Mesas y Ocupación (`mod:gastro-tables`)

- **Clave del Módulo (On/Off):** `mod:gastro-tables` (alias `ms:gastro-tables`)
- **Pertenece al Microservicio Independiente:** `ms:gastro` (`srv:gastro`)
- **Esquema PostgreSQL:** `srv_gastro`
- **Prefijo de Tablas:** `tbl_` (`srv_gastro.tbl_dining_tables`)
- **Prerrequisitos (`requires`):** `["ms:gastro", "mod:invoicing-pos"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:gastro` que se prende o apaga según la suscripción del cliente. Gestiona el plano de salones, terrazas y barras, controlando en tiempo real el estado de cada mesa (`AVAILABLE`, `OCCUPIED`, `BILL_REQUESTED`) y la cantidad de comensales atendidos. Es prerrequisito para `mod:gastro-kds` y `mod:gastro-split-check`.

## Endpoints Principales
- `GET /api/v1/ms:gastro/mod:gastro-tables/tables`: Consulta el estado de todas las mesas de la sucursal.
- `POST /api/v1/ms:gastro/mod:gastro-tables/tables/occupy`: Abre una mesa y asigna número de comensales.
