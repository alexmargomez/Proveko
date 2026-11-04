# Módulo Interno (Prender / Apagar): Fidelización y Billetera de Puntos (`mod:crm-loyalty`)

- **Clave del Módulo (On/Off):** `mod:crm-loyalty` (alias `ms:crm-loyalty`)
- **Pertenece al Microservicio Independiente:** `ms:crm` (`srv:crm`)
- **Esquema PostgreSQL:** `srv_crm`
- **Prefijo de Tablas:** `loy_` (`srv_crm.loy_wallets`)
- **Prerrequisitos (`requires`):** `["ms:crm", "mod:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:crm` que se prende o apaga según la suscripción del cliente. Administra programas de lealtad, niveles de membresía (`SILVER`, `GOLD`, `PLATINUM`) y acumulación/redención de puntos sobre las compras de los clientes registrados en `mod:crm-directory`.

## Endpoints Principales
- `GET /api/v1/ms:crm/mod:crm-loyalty/wallets`: Consulta el saldo de puntos de los clientes.
- `POST /api/v1/ms:crm/mod:crm-loyalty/accrue`: Calcula y acredita puntos por monto facturado usando `MoneyDecimal`.
