import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

export const SRV_REPORTS_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-reports',
  externalPrincipalModuleName: 'Reportes',
  icon: '📊',
  subtitle: 'Resumen de ventas, ganancias, inventario y descargas en Excel.',
  standaloneMonthlyUsd: 119000,
  submodules: [
    {
      moduleKey: 'mod-sales-profitability-reports',
      parentServiceKey: 'srv-reports',
      externalSubmoduleName: 'Resumen de Ventas y Descargas Excel',
      tabIcon: '📊',
      summary: '',
      monthlyAddonUsd: 35000,
      actionButtonLabel: '+ Generar Corte de Ventas',
      tableHeaders: ['Reporte', 'Período', 'Ventas Totales', 'Utilidad Neta', 'Formato'],
      fields: [
        { key: 'dateRange', label: 'Período a Consultar', type: 'select', options: ['Hoy', 'Últimos 7 Días', 'Mes Actual', 'Mes Anterior'] },
        { key: 'branchFilter', label: 'Sede / Caja', type: 'select', options: ['Todas las Sedes', 'Caja Principal', 'Punto de Venta Norte'] },
      ],
    },
    {
      moduleKey: 'mod-financial-reports',
      parentServiceKey: 'srv-reports',
      externalSubmoduleName: 'Ingresos vs Gastos (Ganancias)',
      tabIcon: '📈',
      summary: '',
      monthlyAddonUsd: 39000,
      actionButtonLabel: '+ Generar Balance',
      tableHeaders: ['Período', 'Ingresos por Ventas', 'Costo de Mercancía', 'Gastos Operativos', 'Ganancia Neta'],
      fields: [
        { key: 'reportType', label: 'Tipo de Balance', type: 'select', options: ['Ingresos vs Gastos del Mes', 'Balance por Cliente', 'Resumen de Caja y Bancos'] },
        { key: 'periodMonth', label: 'Mes / Año', type: 'text', placeholder: 'Noviembre 2026' },
      ],
    },
    {
      moduleKey: 'mod-inventory-reports',
      parentServiceKey: 'srv-reports',
      externalSubmoduleName: 'Reporte de Inventario y Rotación',
      tabIcon: '📦',
      summary: '',
      monthlyAddonUsd: 29000,
      actionButtonLabel: '+ Consultar Inventario',
      tableHeaders: ['Bodega', 'Total Referencias', 'Costo en Bodega', 'Valor de Venta', 'Alertas Stock Bajo'],
      fields: [
        { key: 'warehouseReport', label: 'Bodega', type: 'select', options: ['Todas las Bodegas', 'Bodega Principal', 'Bodega Punto de Venta'] },
      ],
    },
    {
      moduleKey: 'mod-tax-dian-reports',
      parentServiceKey: 'srv-reports',
      externalSubmoduleName: 'Resumen de Impuestos',
      tabIcon: '🏛️',
      summary: '',
      monthlyAddonUsd: 35000,
      actionButtonLabel: '+ Generar Resumen Tributario',
      tableHeaders: ['Impuesto', 'Período', 'Base Gravable', 'Impuesto Generado', 'Estado'],
      fields: [
        { key: 'taxType', label: 'Tipo de Impuesto', type: 'select', options: ['IVA Ventas vs Compras', 'Impuesto al Consumo', 'Retenciones Aplicadas'] },
        { key: 'taxPeriod', label: 'Bimestre / Mes', type: 'text', placeholder: 'Bimestre Actual' },
      ],
    },
  ],
  features: [
    { componentKey: 'comp-dian-xml-exporter', parentServiceKey: 'srv-reports', externalName: 'Exportación directa a Excel (.CSV)', description: 'Descarga reportes listos para Excel.', monthlyAddonUsd: 15000 },
  ],
};
