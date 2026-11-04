# Microservicio: Facturación Electrónica DIAN (`ms:invoicing-electronic-dian`)

- **Clave del Microservicio:** `ms:invoicing-electronic-dian`
- **Servicio Padre (Gatekeeper):** `srv:invoicing`
- **Esquema PostgreSQL:** `srv_invoicing`
- **Prefijo de Tablas:** `dian_` (`srv_invoicing.dian_electronic_invoices`)
- **Prerrequisitos (`requires`):** `["srv:invoicing", "ms:invoicing-pos", "ms:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `"fiscal_document_emitter"`
- **Reemplaza a (`supersedes`):** `["ms:invoicing-simple-receipt"]` (en modo `"readonly_archive"`)
- **Override de Servidor Dedicado:** `UPSTREAM_MS_INVOICING_ELECTRONIC_DIAN`

## ¿De qué trata este microservicio?
Emisor de Facturación Electrónica DIAN (Anexo Técnico 1.9 UBL 2.1). La ruta HTTP pre-liquida la factura con `MoneyDecimal`, calcula determinísticamente el **CUFE (`SHA-384`)** y encola la firma criptográfica `XAdES-EPES` y transmisión SOAP/REST hacia la DIAN en el worker asíncrono (`bullmq:dian-xml-signer`), respondiendo en `< 15 ms` sin bloquear el Event Loop.

## Despliegue en Servidor Dedicado
Puede ejecutarse aislado en su propio VPS mediante `createStandaloneInvoicingElectronicDianServer` configurando `UPSTREAM_MS_INVOICING_ELECTRONIC_DIAN` en el API Gateway.
