# Microservicio: Cartera CxC y CxP (`ms:finance-ar-ap`)

- **Clave del Microservicio:** `ms:finance-ar-ap`
- **Servicio Padre (Gatekeeper):** `srv:finance`
- **Esquema PostgreSQL:** `srv_finance`
- **Prefijo de Tablas:** `arp_` (`srv_finance.arp_ledgers`)
- **Prerrequisitos (`requires`):** `["srv:finance", "ms:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_FINANCE_AR_AP`

## ¿De qué trata este microservicio?
Administra las **Cuentas por Cobrar (`RECEIVABLE_CXC`)** de ventas a crédito a clientes y las **Cuentas por Pagar (`PAYABLE_CXP`)** a proveedores registrados en `ms:crm-directory`, controlando edades de vencimiento y aplicación de abonos parciales o totales con `MoneyDecimal`.
