# Módulo Interno (Prender / Apagar): División de Cuentas y Propinas (`mod:gastro-split-check`)

- **Clave del Módulo (On/Off):** `mod:gastro-split-check` (alias `ms:gastro-split-check`)
- **Pertenece al Microservicio Independiente:** `ms:gastro` (`srv:gastro`)
- **Esquema PostgreSQL:** `srv_gastro`
- **Prefijo de Tablas:** `spl_` (`srv_gastro.spl_split_bills`)
- **Prerrequisitos (`requires`):** `["ms:gastro", "mod:gastro-tables", "mod:invoicing-pos"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:gastro` que se prende o apaga según la suscripción del cliente. Permite dividir la cuenta de una mesa por comensal/silla, por ítems individuales o en partes iguales, calculando propina voluntaria exacta con `MoneyDecimal` (`NUMERIC(19, 4)`) antes de pasar al cobro en `mod:invoicing-pos`.

## Endpoints Principales
- `POST /api/v1/ms:gastro/mod:gastro-split-check/checks/split-by-seats`: Liquida subcuentas por silla e incluye el cálculo exacto de propina.
