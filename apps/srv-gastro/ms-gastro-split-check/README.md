# Microservicio: División de Cuentas y Propinas (`ms:gastro-split-check`)

- **Clave del Microservicio:** `ms:gastro-split-check`
- **Servicio Padre (Gatekeeper):** `srv:gastro`
- **Esquema PostgreSQL:** `srv_gastro`
- **Prefijo de Tablas:** `spl_` (`srv_gastro.spl_split_bills`)
- **Prerrequisitos (`requires`):** `["srv:gastro", "ms:gastro-tables", "ms:invoicing-pos"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_GASTRO_SPLIT_CHECK`

## ¿De qué trata este microservicio?
Permite dividir la cuenta de una mesa por comensal/silla, por ítems individuales o en partes iguales, calculando propina voluntaria exacta con `MoneyDecimal` (`NUMERIC(19, 4)`) antes de pasar al cobro en `ms:invoicing-pos`.

## Endpoints Principales
- `POST /api/v1/srv:gastro/ms:gastro-split-check/checks/split-by-seats`: Liquida subcuentas por silla e incluye el cálculo exacto de propina.
