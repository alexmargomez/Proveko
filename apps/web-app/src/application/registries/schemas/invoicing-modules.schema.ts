import type { ModuleUiSchemaDefinition } from '../../../domain/contracts/module-ui-schema.contract.js';

export const INVOICING_MODULE_SCHEMAS: Readonly<Record<string, ModuleUiSchemaDefinition>> = {
  'ms:invoicing-pos': {
    microserviceKey: 'ms:invoicing-pos',
    moduleNotation: 'mod:invoicing-pos',
    parentService: 'srv:invoicing',
    title: 'Terminal Punto de Venta (POS) y Turnos de Caja',
    badge: 'Prefijo SQL: pos_',
    description:
      'Apertura, arqueo ciego y cuadre de turnos de cajero por terminal y sucursal.',
    listEndpoint: '/api/v1/invoicing/pos/shifts',
    createEndpoint: '/api/v1/invoicing/pos/shifts/open',
    createButtonLabel: 'Abrir Turno de Caja POS',
    responseCollectionPath: 'shifts',
    kpis: [
      { label: 'Estado Terminal', value: 'OPERATIVA', badgeTone: 'emerald', subtext: 'Sincronizada con sede activa' },
      { label: 'Base de Efectivo', value: 'NUMERIC(19,4)', badgeTone: 'blue', subtext: 'Control de arqueo de turno' },
      { label: 'Esquema DB', value: 'srv_invoicing.pos_*', badgeTone: 'slate', subtext: 'Auditoría por cajero' },
    ],
    formFields: [
      { name: 'cashierUserId', label: 'Usuario Cajero', type: 'text', defaultValue: 'usr-cajero-principal' },
      { name: 'openingCashFixed4', label: 'Base Inicial en Efectivo ($)', type: 'decimal', defaultValue: '300000.0000' },
    ],
    columns: [
      { key: 'id', header: 'ID Turno', format: 'code' },
      { key: 'cashierUserId', header: 'Cajero Responsable', format: 'text' },
      { key: 'status', header: 'Estado Turno', format: 'badge' },
      { key: 'openingCashFixed4', header: 'Base Inicial', format: 'tabular-currency' },
      { key: 'openedAtIso', header: 'Fecha Apertura', format: 'code' },
    ],
    defaultPayload: {
      cashierUserId: 'usr-cajero-principal',
      openingCashFixed4: '300000.0000',
    },
  },
  'ms:invoicing-simple-receipt': {
    microserviceKey: 'ms:invoicing-simple-receipt',
    moduleNotation: 'mod:invoicing-simple-receipt',
    parentService: 'srv:invoicing',
    title: 'Comprobante y Tirilla de Venta Rápida (No Fiscal)',
    badge: 'Prefijo SQL: rcp_ · Mutex: document_emit_mode',
    description:
      'Emisión rápida de recibos de mostrador. Conmuta automáticamente a modo Archivo Histórico si activas Facturación DIAN.',
    listEndpoint: '/api/v1/invoicing/simple-receipt/receipts',
    createEndpoint: '/api/v1/invoicing/simple-receipt/receipts/emit',
    createButtonLabel: 'Emitir Comprobante Rápido',
    responseCollectionPath: 'receipts',
    kpis: [
      { label: 'Modo Emisión', value: 'TIRILLA SIMPLE', badgeTone: 'amber', subtext: 'Grupo mutex: document_emit_mode' },
      { label: 'Cálculo Línea', value: 'Exactitud 4 Dec.', badgeTone: 'blue', subtext: 'Sin errores IEEE 754' },
      { label: 'Esquema DB', value: 'srv_invoicing.rcp_*', badgeTone: 'slate', subtext: 'Consecutivo local' },
    ],
    formFields: [
      { name: 'receiptNumber', label: 'Consecutivo de Tirilla', type: 'text', defaultValue: 'TIR-1001' },
      { name: 'customerName', label: 'Nombre del Comprador', type: 'text', defaultValue: 'Consumidor Mostrador' },
      {
        name: 'lines',
        label: 'Ítems del Comprobante (JSON Estructurado)',
        type: 'json-lines',
        defaultValue: [
          { description: 'Café Origen Huila 500g', quantityFixed4: '2.0000', unitPriceFixed4: '32000.0000' },
        ],
      },
    ],
    columns: [
      { key: 'receiptNumber', header: 'No. Tirilla', format: 'code' },
      { key: 'customerName', header: 'Cliente', format: 'text' },
      { key: 'totalFixed4', header: 'Total Comprobante', format: 'tabular-currency' },
      { key: 'issuedAtIso', header: 'Fecha Emisión', format: 'code' },
    ],
    defaultPayload: {
      receiptNumber: 'TIR-1001',
      customerName: 'Consumidor Mostrador',
      lines: [
        { description: 'Café Origen Huila 500g', quantityFixed4: '2.0000', unitPriceFixed4: '32000.0000' },
      ],
    },
  },
  'ms:invoicing-electronic-dian': {
    microserviceKey: 'ms:invoicing-electronic-dian',
    moduleNotation: 'mod:invoicing-electronic-dian',
    parentService: 'srv:invoicing',
    title: 'Facturación Electrónica UBL 2.1 DIAN (CUFE SHA-384)',
    badge: 'Prefijo SQL: fe_ · Supersedes: mod:invoicing-simple-receipt',
    description:
      'Emisión fiscal electrónica con firma criptográfica CUFE SHA-384, liquidación exacta de IVA/INC y envío a la DIAN.',
    listEndpoint: '/api/v1/invoicing/electronic-dian/invoices',
    createEndpoint: '/api/v1/invoicing/electronic-dian/invoices/emit',
    createButtonLabel: 'Firmar y Emitir Factura Electrónica DIAN',
    responseCollectionPath: 'invoices',
    kpis: [
      { label: 'Firma Fiscal', value: 'CUFE SHA-384', badgeTone: 'emerald', subtext: 'Anexo Técnico DIAN 1.9' },
      { label: 'Reconciliación POS', value: 'Single-Flight Activo', badgeTone: 'blue', subtext: 'Conserva carrito en upgrade' },
      { label: 'Esquema DB', value: 'srv_invoicing.fe_*', badgeTone: 'slate', subtext: 'Inmutabilidad tributaria' },
    ],
    formFields: [
      { name: 'invoiceNumber', label: 'Prefijo y Consecutivo DIAN', type: 'text', defaultValue: 'SETT-99001' },
      { name: 'customerTaxId', label: 'NIT / Cédula Adquiriente', type: 'text', defaultValue: '901445889-1' },
      {
        name: 'lines',
        label: 'Líneas Gravadas UBL 2.1 (JSON Estructurado)',
        type: 'json-lines',
        defaultValue: [
          {
            sku: 'PROD-01',
            description: 'Licencia Corporativa Anual',
            quantityFixed4: '1.0000',
            unitPriceFixed4: '1200000.0000',
            taxRatePercent: '19.0000',
          },
        ],
      },
    ],
    columns: [
      { key: 'invoiceNumber', header: 'No. Factura DIAN', format: 'code' },
      { key: 'customerTaxId', header: 'NIT Adquiriente', format: 'code' },
      { key: 'subtotalFixed4', header: 'Subtotal Base', format: 'tabular-currency' },
      { key: 'taxTotalFixed4', header: 'IVA Liquidado', format: 'tabular-currency' },
      { key: 'grandTotalFixed4', header: 'Total Fiscal', format: 'tabular-currency' },
      { key: 'cufeSha384', header: 'Huella CUFE SHA-384', format: 'code' },
    ],
    defaultPayload: {
      invoiceNumber: 'SETT-99001',
      customerTaxId: '901445889-1',
      lines: [
        {
          sku: 'PROD-01',
          description: 'Licencia Corporativa Anual',
          quantityFixed4: '1.0000',
          unitPriceFixed4: '1200000.0000',
          taxRatePercent: '19.0000',
        },
      ],
    },
  },
  'ms:invoicing-quotes': {
    microserviceKey: 'ms:invoicing-quotes',
    moduleNotation: 'mod:invoicing-quotes',
    parentService: 'srv:invoicing',
    title: 'Cotizaciones Comerciales y Pedidos Remisionados',
    badge: 'Prefijo SQL: quo_',
    description:
      'Elaboración de propuestas comerciales formales con descuento porcentual exacto y conversión a factura.',
    listEndpoint: '/api/v1/invoicing/quotes/quotes',
    createEndpoint: '/api/v1/invoicing/quotes/quotes',
    createButtonLabel: 'Generar Cotización Comercial',
    responseCollectionPath: 'quotes',
    kpis: [
      { label: 'Vigencia Comercial', value: 'Control Automático', badgeTone: 'emerald', subtext: 'Conversión 1-clic a Factura' },
      { label: 'Descuento Línea', value: 'Exactitud 4 Dec.', badgeTone: 'blue', subtext: 'Tope máximo validado' },
      { label: 'Esquema DB', value: 'srv_invoicing.quo_*', badgeTone: 'slate', subtext: 'Trazabilidad B2B' },
    ],
    formFields: [
      { name: 'quoteNumber', label: 'Número de Cotización', type: 'text', defaultValue: 'COT-2026-01' },
      { name: 'customerTaxId', label: 'NIT / Documento Cliente', type: 'text', defaultValue: '901445889-1' },
      { name: 'subtotalFixed4', label: 'Subtotal Antes de Descuento ($)', type: 'decimal', defaultValue: '5000000.0000' },
      { name: 'discountPercent', label: 'Porcentaje de Descuento (%)', type: 'decimal', defaultValue: '10.0000' },
    ],
    columns: [
      { key: 'quoteNumber', header: 'No. Cotización', format: 'code' },
      { key: 'customerTaxId', header: 'NIT Cliente', format: 'code' },
      { key: 'status', header: 'Estado', format: 'badge' },
      { key: 'discountAmountFixed4', header: 'Valor Descuento', format: 'tabular-currency' },
      { key: 'netTotalFixed4', header: 'Total Neto Cotizado', format: 'tabular-currency' },
    ],
    defaultPayload: {
      quoteNumber: 'COT-2026-01',
      customerTaxId: '901445889-1',
      subtotalFixed4: '5000000.0000',
      discountPercent: '10.0000',
    },
  },
};
