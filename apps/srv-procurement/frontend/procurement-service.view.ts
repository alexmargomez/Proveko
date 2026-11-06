import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

export const SRV_PROCUREMENT_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-procurement',
  externalPrincipalModuleName: 'Compras y Proveedores',
  icon: '🚚',
  subtitle: 'Órdenes de compra, facturas de proveedores y recepción de mercancía.',
  standaloneMonthlyUsd: 129000,
  submodules: [
    {
      moduleKey: 'mod-purchase-orders',
      parentServiceKey: 'srv-procurement',
      externalSubmoduleName: 'Órdenes de Compra',
      tabIcon: '📝',
      summary: '',
      monthlyAddonUsd: 39000,
      actionButtonLabel: '+ Crear Orden de Compra',
      tableHeaders: ['N° Orden', 'Proveedor', 'Productos Solicitados', 'Bodega Destino', 'Total', 'Estado', 'Acciones'],
      fields: [
        { key: 'poNumber', label: 'N° Orden', type: 'text', placeholder: 'OC-2026-01' },
        { key: 'supplierName', label: 'Proveedor', type: 'text', placeholder: 'Distribuidora Nacional' },
        { key: 'itemsRequested', label: 'Productos y Cantidades', type: 'text', placeholder: '20 Cajas Aceite / 50 Filtros' },
        { key: 'totalOrderCop', label: 'Valor Total ($)', type: 'number', placeholder: '1850000' },
      ],
    },
    {
      moduleKey: 'mod-purchase-invoices',
      parentServiceKey: 'srv-procurement',
      externalSubmoduleName: 'Facturas de Compra',
      tabIcon: '📥',
      summary: '',
      monthlyAddonUsd: 42000,
      actionButtonLabel: '+ Registrar Factura de Compra',
      tableHeaders: ['N° Factura', 'Proveedor', 'Fecha', 'Condición Pago', 'Total', 'Estado', 'Acciones'],
      fields: [
        { key: 'supplierInvoiceNo', label: 'N° Factura Proveedor', type: 'text', placeholder: 'FC-9940' },
        { key: 'supplierVendor', label: 'Proveedor', type: 'text', placeholder: 'Importadora Andina' },
        { key: 'paymentDue', label: 'Forma de Pago', type: 'select', options: ['Contado', 'Crédito 30 Días', 'Crédito 60 Días'] },
        { key: 'invoiceTotal', label: 'Valor Total ($)', type: 'number', placeholder: '2400000' },
      ],
    },
    {
      moduleKey: 'mod-support-doc-dse',
      parentServiceKey: 'srv-procurement',
      externalSubmoduleName: 'Compras a No Obligados (Doc. Soporte)',
      tabIcon: '📄',
      summary: '',
      monthlyAddonUsd: 35000,
      actionButtonLabel: '+ Emitir Documento Soporte',
      tableHeaders: ['Consecutivo', 'Proveedor / Persona', 'Cédula', 'Concepto', 'Valor', 'Estado', 'Acciones'],
      fields: [
        { key: 'dseNumber', label: 'Consecutivo', type: 'text', placeholder: 'DSE-001' },
        { key: 'informalSeller', label: 'Nombre de la Persona', type: 'text', placeholder: 'Pedro Nel Ospina' },
        { key: 'sellerDoc', label: 'Cédula', type: 'text', placeholder: '71.224.890' },
        { key: 'serviceOrGood', label: 'Servicio o Producto Comprado', type: 'text', placeholder: 'Arreglo eléctrico / Transporte' },
        { key: 'dseAmount', label: 'Valor Pagado ($)', type: 'number', placeholder: '180000' },
      ],
    },
  ],
  features: [
    { componentKey: 'comp-margin-drop-alert', parentServiceKey: 'srv-procurement', externalName: 'Alerta de Subida de Costo', description: 'Avisa si un proveedor sube el precio.', monthlyAddonUsd: 15000 },
  ],
};
