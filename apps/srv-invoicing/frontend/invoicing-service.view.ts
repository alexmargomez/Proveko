import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

/**
 * Frontend interno del Microservicio `srv-invoicing` (Módulo Principal: Facturación y Ventas).
 * Submódulos en interpestañas:
 *  - Caja POS y Tirilla Rápida (`mod-pos`)
 *  - Facturación Electrónica DIAN (`mod-dian`)
 *  - Cotizaciones y Remisiones (`mod-quotes`)
 * Funcionalidades (Componentes minis):
 *  - Ingreso de nombre de cajero (`comp-cashier-name`)
 *  - Propina sugerida en cuenta (`comp-tip`)
 *  - Descuento por línea (`comp-line-discount`)
 *  - Firma de encargado en remisión (`comp-invoice-manager-sign`)
 */
export const SRV_INVOICING_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-invoicing',
  externalPrincipalModuleName: 'Facturación y Ventas',
  icon: '🧾',
  subtitle: 'Caja registradora POS, facturación electrónica DIAN, cotizaciones y remisiones.',
  standaloneMonthlyUsd: 119000,
  submodules: [
    {
      moduleKey: 'mod-pos',
      parentServiceKey: 'srv-invoicing',
      externalSubmoduleName: 'Caja POS y Comprobantes',
      tabIcon: '🛒',
      summary: 'Terminal de venta rápida con carrito interactivo, cálculo de impuestos y medios de pago.',
      monthlyAddonUsd: 45000,
      actionButtonLabel: 'Emitir Comprobante POS',
      tableHeaders: ['Comprobante', 'Cliente', 'Cajero / Turno', 'Medio de Pago', 'Total', 'Estado'],
      hasInteractivePosCart: true,
      fields: [
        { key: 'customerName', label: 'Cliente / Comprador', type: 'text', placeholder: 'Consumidor Final o Razón Social' },
        { key: 'customerNit', label: 'NIT o Documento', type: 'text', placeholder: '222222222-2' },
        {
          key: 'cashierName',
          label: 'Nombre de Cajero y Turno',
          type: 'text',
          placeholder: 'Ej: Laura Gómez — Turno Mañana',
          requiredFeatureKey: 'comp-cashier-name',
        },
        {
          key: 'paymentMethod',
          label: 'Medio de Pago',
          type: 'select',
          options: ['Efectivo', 'Tarjeta Débito / Crédito', 'Transferencia / QR', 'Pago Mixto'],
        },
        {
          key: 'tipPct',
          label: 'Propina Voluntaria (%)',
          type: 'number',
          placeholder: '10',
          requiredFeatureKey: 'comp-tip',
        },
      ],
    },
    {
      moduleKey: 'mod-dian',
      parentServiceKey: 'srv-invoicing',
      externalSubmoduleName: 'Facturación Electrónica DIAN',
      tabIcon: '🏛️',
      summary: 'Emisión de facturas electrónicas de venta con validación previa, CUFE y envío de XML/PDF.',
      monthlyAddonUsd: 69000,
      actionButtonLabel: 'Emitir Factura Electrónica',
      tableHeaders: ['Prefijo / Número', 'Adquirente', 'NIT', 'Total Gravado', 'CUFE / Estado DIAN', 'Fecha'],
      fields: [
        { key: 'resolutionPrefix', label: 'Prefijo de Resolución', type: 'select', options: ['FEV - Factura Electrónica', 'NC - Nota Crédito', 'ND - Nota Débito'] },
        { key: 'buyerLegalName', label: 'Razón Social del Adquirente', type: 'text', placeholder: 'Comercializadora del Valle S.A.S.' },
        { key: 'buyerTaxId', label: 'NIT con Dígito de Verificación', type: 'text', placeholder: '901.452.110-4' },
        { key: 'buyerEmail', label: 'Correo de Recepción XML/PDF', type: 'text', placeholder: 'facturacion@empresa.co' },
        { key: 'totalAmount', label: 'Valor Total Factura ($)', type: 'number', placeholder: '1450000' },
      ],
    },
    {
      moduleKey: 'mod-quotes',
      parentServiceKey: 'srv-invoicing',
      externalSubmoduleName: 'Cotizaciones y Remisiones',
      tabIcon: '📋',
      summary: 'Propuestas comerciales, remisiones de entrega de mercancía y conversión a factura.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Guardar Cotización / Remisión',
      tableHeaders: ['Documento', 'Cliente', 'Vigencia', 'Encargado Autorizador', 'Valor Estimado', 'Estado'],
      fields: [
        { key: 'docType', label: 'Tipo de Documento', type: 'select', options: ['Cotización Comercial', 'Remisión de Salida', 'Orden de Pedido'] },
        { key: 'clientName', label: 'Empresa / Cliente', type: 'text', placeholder: 'Constructora Andina S.A.S.' },
        { key: 'validUntil', label: 'Válido Hasta', type: 'date' },
        {
          key: 'managerSignature',
          label: 'Firma de Encargado que Autoriza',
          type: 'text',
          placeholder: 'Ing. Carlos Ruiz — Director Comercial',
          requiredFeatureKey: 'comp-manager-signature',
        },
        { key: 'quotedTotal', label: 'Valor Cotizado ($)', type: 'number', placeholder: '3200000' },
      ],
    },
  ],
  features: [
    {
      componentKey: 'comp-cashier-name',
      externalName: 'Ingreso de nombre de cajero y turno',
      description: 'Habilita la identificación del cajero responsable en cada comprobante POS.',
      parentModuleKey: 'mod-pos',
      includedByDefault: true,
      monthlyAddonUsd: 15000,
    },
    {
      componentKey: 'comp-tip',
      externalName: 'Propina sugerida en cuenta',
      description: 'Permite registrar porcentaje de propina voluntaria en la liquidación de caja.',
      parentModuleKey: 'mod-pos',
      includedByDefault: true,
      monthlyAddonUsd: 15000,
    },
    {
      componentKey: 'comp-line-discount',
      externalName: 'Descuento por línea en carrito',
      description: 'Permite aplicar porcentaje de descuento individual por producto en el carrito POS.',
      parentModuleKey: 'mod-pos',
      includedByDefault: true,
      monthlyAddonUsd: 19000,
    },
  ],
};
