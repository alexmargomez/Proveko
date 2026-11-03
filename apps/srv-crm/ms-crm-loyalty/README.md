# Microservicio: Fidelización y Billetera de Puntos (`ms:crm-loyalty`)

- **Clave del Microservicio:** `ms:crm-loyalty`
- **Servicio Padre (Gatekeeper):** `srv:crm`
- **Esquema PostgreSQL:** `srv_crm`
- **Prefijo de Tablas:** `loy_` (`srv_crm.loy_wallets`)
- **Prerrequisitos (`requires`):** `["srv:crm", "ms:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_CRM_LOYALTY`

## ¿De qué trata este microservicio?
Administra programas de lealtad, niveles de membresía (`SILVER`, `GOLD`, `PLATINUM`) y acumulación/redención de puntos sobre las compras de los clientes registrados en `ms:crm-directory`.

## Endpoints Principales
- `GET /api/v1/srv:crm/ms:crm-loyalty/wallets`: Consulta el saldo de puntos de los clientes.
- `POST /api/v1/srv:crm/ms:crm-loyalty/accrue`: Calcula y acredita puntos por monto facturado usando `MoneyDecimal`.
