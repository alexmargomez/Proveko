# Microservicio: Recibo Simple / Cuenta de Cobro (`ms:invoicing-simple-receipt`)

- **Clave del Microservicio:** `ms:invoicing-simple-receipt`
- **Servicio Padre (Gatekeeper):** `srv:invoicing`
- **Esquema PostgreSQL:** `srv_invoicing`
- **Prefijo de Tablas:** `rcp_` (`srv_invoicing.rcp_simple_receipts`)
- **Prerrequisitos (`requires`):** `["srv:invoicing", "ms:invoicing-pos"]`
- **Grupo de Exclusión (`mutex_group`):** `"fiscal_document_emitter"`
- **Reemplazado por (`superseded by`):** `ms:invoicing-electronic-dian` -> pasa a `READONLY_ARCHIVE`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_INVOICING_SIMPLE_RECEIPT`

## ¿De qué trata este microservicio?
Permite emitir comprobantes de venta rápidos no electrónicos (recibos internos o cuentas de cobro). Cuando el negocio evoluciona y activa `ms:invoicing-electronic-dian`, este microservicio pasa automáticamente a **`READONLY_ARCHIVE`**: permite consultar todo el historial (`GET /receipts`) pero bloquea nuevas emisiones (`POST /receipts` devuelve `403 ERR_MICROSERVICE_READONLY_ARCHIVE`).
