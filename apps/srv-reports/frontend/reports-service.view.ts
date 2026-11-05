import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

/**
 * Frontend interno del Microservicio `srv-reports` (Módulo Principal: Reportes Financieros, Analítica BI y Exportador).
 * Inspirado en `hc_version2` (`ConfiguracionReportes`, `MessageQueue`), `FixMotor` (`FinancialReportService`, `CsvAccountingExportService`) y `Siigo Reportes`.
 */
export const SRV_REPORTS_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-reports',
  externalPrincipalModuleName: 'Reportes Financieros, Analítica BI y Exportador',
  icon: '📊',
  subtitle: 'Estado de Resultados P&G en vivo, Balance de Prueba por Tercero, rentabilidad por producto, anexos DIAN y constructor BI.',
  standaloneMonthlyUsd: 99000,
  submodules: [
    {
      moduleKey: 'mod-financial-reports',
      parentServiceKey: 'srv-reports',
      externalSubmoduleName: 'Estado de Resultados (P&G) y Balance por Tercero',
      tabIcon: '📈',
      summary: 'Utilidad Neta Real (Ventas - Costo Kardex + Mano de Obra - Gastos - Comisiones), Balance General NIIF y Balance de Prueba por NIT.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Generar y Exportar Estado Financiero',
      tableHeaders: ['Reporte Financiero', 'Período / Corte', 'Ingresos Brutos', 'Costos y Gastos', 'Utilidad Neta Real ($ COP)'],
      fields: [
        { key: 'reportType', label: 'Tipo de Estado Financiero', type: 'select', options: ['Estado de Resultados Operativo (P&G Real FixMotor)', 'Balance de Prueba por Tercero (NIT)', 'Estado de Situación Financiera (Balance General NIIF)', 'Libro Auxiliar por Cuenta y Centro de Costo'] },
        { key: 'periodRange', label: 'Período o Rango de Fechas', type: 'text', placeholder: 'Noviembre 2026 (Acumulado Mensual)' },
        { key: 'grossRevenue', label: 'Ingresos Totales del Período ($ COP)', type: 'number', placeholder: '84500000' },
        { key: 'totalCostsExpenses', label: 'Costo Kardex (COGS) + Gastos + Comisiones ($ COP)', type: 'number', placeholder: '56200000' },
        { key: 'netProfit', label: 'Utilidad Neta Real Calculada ($ COP)', type: 'number', placeholder: '28300000' },
      ],
    },
    {
      moduleKey: 'mod-sales-profitability-reports',
      parentServiceKey: 'srv-reports',
      externalSubmoduleName: 'Rentabilidad de Ventas y Arqueos de Caja',
      tabIcon: '💹',
      summary: 'Margen bruto por producto, categoría, vendedor y sucursal, más consolidado de Efectivo Neto en Caja Física vs Medios Digitales.',
      monthlyAddonUsd: 35000,
      actionButtonLabel: 'Generar Reporte de Rentabilidad / Arqueo',
      tableHeaders: ['Corte / Categoría', 'Sede / Cajero', 'Efectivo Neto Caja', 'Digitales (Nequi/Tarjeta)', 'Margen Ponderado (%)'],
      fields: [
        { key: 'analysisScope', label: 'Agrupación del Reporte', type: 'select', options: ['Rentabilidad por Producto y Categoría', 'Consolidado Arqueo de Caja (Efectivo Neto vs Digital)', 'Ventas y Comisiones por Vendedor / Técnico', 'Ventas por Franja Horaria y Día'] },
        { key: 'branchCashier', label: 'Sucursal / Caja / Vendedor', type: 'text', placeholder: 'Sede Principal — Todas las Cajas' },
        { key: 'netCashBox', label: 'Efectivo Neto en Caja Física ($ COP)', type: 'number', placeholder: '12450000' },
        { key: 'digitalCollected', label: 'Recaudo Transferencias / Nequi / Datáfono ($ COP)', type: 'number', placeholder: '19800000' },
        { key: 'weightedMarginPct', label: 'Margen Bruto Ponderado (%)', type: 'text', placeholder: '38.4% Utilidad sobre Venta' },
      ],
    },
    {
      moduleKey: 'mod-inventory-reports',
      parentServiceKey: 'srv-reports',
      externalSubmoduleName: 'Valorización de Inventario, Rotación ABC y Vencimientos',
      tabIcon: '📦',
      summary: 'Capital invertido al costo vs venta potencial (FixMotor), rotación ABC (v2), alertas bajo mínimo y lotes por vencer.',
      monthlyAddonUsd: 35000,
      actionButtonLabel: 'Ejecutar Auditoría de Inventario',
      tableHeaders: ['Bodega / Familia', 'Capital al Costo', 'Venta Potencial', 'Utilidad Proyectada', 'SKUs en Alerta / Vencimiento'],
      fields: [
        { key: 'warehouseFilter', label: 'Bodega Auditada', type: 'select', options: ['Todas las Bodegas Consolidadas', 'Bodega Central Principal', 'Bodega Norte Punto Venta'] },
        { key: 'capitalAtCost', label: 'Capital Invertido al Costo ($ COP)', type: 'number', placeholder: '62400000' },
        { key: 'potentialRevenue', label: 'Valor Potencial de Venta ($ COP)', type: 'number', placeholder: '98500000' },
        { key: 'projectedProfit', label: 'Utilidad Bruta Proyectada ($ COP)', type: 'number', placeholder: '36100000' },
        { key: 'alertsSummary', label: 'Alertas de Reorden y Vencimiento FEFO', type: 'text', placeholder: '4 SKUs Bajo Mínimo | 2 Lotes en Alerta Naranja (<30 días)' },
      ],
    },
    {
      moduleKey: 'mod-tax-dian-reports',
      parentServiceKey: 'srv-reports',
      externalSubmoduleName: 'Anexos Tributarios DIAN (IVA 300, ReteFuente 350, ICA)',
      tabIcon: '🏛️',
      summary: 'Borradores automáticos de IVA Generado vs Descontable, Retenciones practicadas por renglón e ICA municipal.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Generar Anexo Tributario DIAN',
      tableHeaders: ['Declaración / Anexo', 'Período Fiscal', 'Base Gravable Total', 'Impuesto / Retención Liquidada', 'Estado Pre-Auditoría'],
      fields: [
        { key: 'taxFormType', label: 'Formulario / Anexo Oficial', type: 'select', options: ['Formulario 300 — Declaración de IVA (Generado vs Descontable)', 'Formulario 350 — Retención en la Fuente Mensual', 'Anexo Industria y Comercio (ICA y ReteICA por Municipio)', 'Certificados de Retención Bimestral/Anual en PDF'] },
        { key: 'taxPeriod', label: 'Bimestre / Cuatrimestre / Mes', type: 'text', placeholder: '2026 — Período 06 (Noviembre)' },
        { key: 'taxableBaseCop', label: 'Base Gravable Consolidada ($ COP)', type: 'number', placeholder: '142000000' },
        { key: 'taxPayableCop', label: 'Saldo Neto Impuesto / Retención ($ COP)', type: 'number', placeholder: '14850000' },
      ],
    },
    {
      moduleKey: 'mod-custom-report-builder',
      parentServiceKey: 'srv-reports',
      externalSubmoduleName: 'Constructor Dinámico BI y Exportación Asíncrona (v2)',
      tabIcon: '🛠️',
      summary: 'Cruce dinámico de tablas (ConfiguracionReportes v2) y descarga masiva en Excel (.xlsx), CSV UTF-8 BOM y PDF.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Encolar y Descargar Reporte BI',
      tableHeaders: ['Nombre del Reporte', 'Tabla Principal y Cruces', 'Formato Salida', 'Filas Procesadas', 'Estado Exportación'],
      fields: [
        { key: 'customReportName', label: 'Título de la Plantilla de Reporte', type: 'text', placeholder: 'Cruces Ventas + Kardex + Cartera por Contrato' },
        { key: 'sourceTables', label: 'Módulo Principal y Relaciones Cruzadas', type: 'select', options: ['Facturación + Clientes + Detalle Ítems + Kardex', 'Inventario + Lotes + Recepciones Técnicas + Proveedores', 'Órdenes de Taller + Vehículos + Comisiones de Técnicos', 'Agendamiento + Recursos + Tiempos de Espera Turnador'] },
        { key: 'exportFormat', label: 'Formato de Exportación', type: 'select', options: ['Excel Nativo (.xlsx)', 'CSV Contable UTF-8 con BOM (;)', 'PDF Membreteado con QR (DocForge)'] },
        { key: 'rowsCount', label: 'Registros Estimados', type: 'number', placeholder: '4520' },
      ],
    },
  ],
  features: [
    {
      componentKey: 'comp-csv-utf8-bom-export',
      externalName: 'Exportación contable CSV con BOM UTF-8 para Excel en español',
      description: 'Genera archivos planos separados por punto y coma (;) con codificación UTF-8-SIG listos para Excel y contadores.',
      parentModuleKey: 'mod-financial-reports',
      includedByDefault: true,
      monthlyAddonUsd: 15000,
    },
  ],
};
