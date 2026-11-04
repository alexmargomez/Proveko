# Módulo Interno (Prender / Apagar): Facturación Electrónica DIAN (`mod:invoicing-electronic-dian`)

- **Clave del Módulo (On/Off):** `mod:invoicing-electronic-dian` (alias `ms:invoicing-electronic-dian`)
- **Pertenece al Microservicio Independiente:** `ms:invoicing` (`srv:invoicing`)
- **Esquema PostgreSQL:** `srv_invoicing`
- **Prefijo de Tablas:** `dian_` (`srv_invoicing.dian_electronic_invoices`)
- **Prerrequisitos (`requires`):** `["ms:invoicing", "mod:invoicing-pos", "mod:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `"fiscal_document_emitter"`
- **Reemplaza a (`supersedes`):** `["mod:invoicing-simple-receipt"]` (en modo `"readonly_archive"`)

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:invoicing` que se prende o apaga según la suscripción del cliente. Actúa como emisor de Facturación Electrónica DIAN (Anexo Técnico 1.9 UBL 2.1): la ruta HTTP pre-liquida la factura con `MoneyDecimal`, calcula determinísticamente el **CUFE (`SHA-384`)** y encola la firma criptográfica `XAdES-EPES` y transmisión SOAP/REST hacia la DIAN en el worker asíncrono (`bullmq:dian-xml-signer`), respondiendo en `< 15 ms` sin bloquear el Event Loop.
