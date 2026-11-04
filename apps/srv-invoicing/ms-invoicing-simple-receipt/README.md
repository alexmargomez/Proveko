# Módulo Interno (Prender / Apagar): Recibo Simple / Cuenta de Cobro (`mod:invoicing-simple-receipt`)

- **Clave del Módulo (On/Off):** `mod:invoicing-simple-receipt` (alias `ms:invoicing-simple-receipt`)
- **Pertenece al Microservicio Independiente:** `ms:invoicing` (`srv:invoicing`)
- **Esquema PostgreSQL:** `srv_invoicing`
- **Prefijo de Tablas:** `rcp_` (`srv_invoicing.rcp_simple_receipts`)
- **Prerrequisitos (`requires`):** `["ms:invoicing", "mod:invoicing-pos"]`
- **Grupo de Exclusión (`mutex_group`):** `"fiscal_document_emitter"`
- **Reemplazado por (`superseded by`):** `mod:invoicing-electronic-dian` -> pasa a `READONLY_ARCHIVE`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:invoicing` que se prende o apaga según la suscripción del cliente. Permite emitir comprobantes de venta rápidos no electrónicos (recibos internos o cuentas de cobro). Cuando el negocio evoluciona y prende `mod:invoicing-electronic-dian`, este módulo pasa automáticamente a **`READONLY_ARCHIVE`**: permite consultar todo el historial (`GET /receipts`) pero bloquea nuevas emisiones (`POST /receipts` devuelve `403 ERR_MICROSERVICE_READONLY_ARCHIVE`).
