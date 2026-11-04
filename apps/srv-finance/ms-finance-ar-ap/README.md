# Módulo Interno (Prender / Apagar): Cartera CxC y CxP (`mod:finance-ar-ap`)

- **Clave del Módulo (On/Off):** `mod:finance-ar-ap` (alias `ms:finance-ar-ap`)
- **Pertenece al Microservicio Independiente:** `ms:finance` (`srv:finance`)
- **Esquema PostgreSQL:** `srv_finance`
- **Prefijo de Tablas:** `arp_` (`srv_finance.arp_ledgers`)
- **Prerrequisitos (`requires`):** `["ms:finance", "mod:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:finance` que se prende o apaga según la suscripción del cliente. Administra las **Cuentas por Cobrar (`RECEIVABLE_CXC`)** de ventas a crédito a clientes y las **Cuentas por Pagar (`PAYABLE_CXP`)** a proveedores registrados en `mod:crm-directory`, controlando edades de vencimiento y aplicación de abonos parciales o totales con `MoneyDecimal`.
