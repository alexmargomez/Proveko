import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

/**
 * Frontend interno del Microservicio `srv-treasury` (Módulo Principal: Tesorería, Cartera CxC/CxP, Bancos y Cajas Menores).
 * Inspirado en `hc_version2` (`FacturaClientesAbonos`, `EgresoOrdenAbonos`, `CajaMovimiento`) y `FixMotor` (`buildReceivablesAging`, `Expenses`).
 */
export const SRV_TREASURY_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-treasury',
  externalPrincipalModuleName: 'Tesorería, Cartera por Edades, Bancos y Cajas Menores',
  icon: '💰',
  subtitle: 'Recibos de caja, edades de cartera CxC, comprobantes de egreso CxP, conciliación bancaria y gastos menores.',
  standaloneMonthlyUsd: 119000,
  submodules: [
    {
      moduleKey: 'mod-receivables-cxc',
      parentServiceKey: 'srv-treasury',
      externalSubmoduleName: 'Cartera Clientes (CxC) y Recibos de Caja',
      tabIcon: '📥',
      summary: 'Edades de cartera (Al día, 15, 30, 60, +90 días), abonos parciales con retenciones y cobro jurídico.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Emitir Recibo de Caja (Abono CxC)',
      tableHeaders: ['Recibo / Factura', 'Cliente', 'Edad de Mora', 'Retenciones Aplicadas', 'Abono Recibido ($ COP)'],
      fields: [
        { key: 'receiptNumber', label: 'N° Recibo de Caja y Factura Cruzada', type: 'text', placeholder: 'RC-001420 -> FEV-1042' },
        { key: 'customerName', label: 'Cliente Pagador', type: 'text', placeholder: 'Clínica / Comercializadora del Norte S.A.S.' },
        { key: 'agingBucket', label: 'Tramo de Cartera / Estado', type: 'select', options: ['Al Día (0-15 días)', 'Mora Temprana (16-30 días)', 'Mora Media (31-60 días)', 'Cartera Crítica (+60 días)', 'En Cobro Jurídico'] },
        {
          key: 'withholdingDeducted',
          label: 'Retenciones Practicadas por el Cliente al Pagar',
          type: 'text',
          placeholder: 'ReteFuente $85.000 + ReteICA $24.000',
          requiredFeatureKey: 'comp-payment-withholding-deduct',
        },
        { key: 'amountReceived', label: 'Valor Neto Ingresado a Caja/Banco ($ COP)', type: 'number', placeholder: '3450000' },
      ],
    },
    {
      moduleKey: 'mod-payables-cxp',
      parentServiceKey: 'srv-treasury',
      externalSubmoduleName: 'Cuentas por Pagar (CxP) y Comprobantes de Egreso',
      tabIcon: '📤',
      summary: 'Programación de pagos a proveedores, abonos a órdenes de compra y exportación de archivo plano ACH.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Emitir Comprobante de Egreso (CE)',
      tableHeaders: ['Comprobante CE', 'Proveedor Beneficiario', 'Factura / OC Cruzada', 'Banco / Medio', 'Valor Pagado ($ COP)'],
      fields: [
        { key: 'ceNumber', label: 'Consecutivo Comprobante de Egreso', type: 'text', placeholder: 'CE-2026-00892' },
        { key: 'supplierBeneficiary', label: 'Proveedor / Beneficiario', type: 'text', placeholder: 'Distribuidora Mayorista del Eje S.A.S.' },
        { key: 'invoiceRef', label: 'Factura de Compra / Orden Cruzada', type: 'text', placeholder: 'FC-99412 / OC-00418' },
        { key: 'bankSource', label: 'Cuenta Bancaria o Caja Origen', type: 'select', options: ['Bancolombia Cta Corriente — Dispersiones PAB', 'Davivienda Empresarial ACH', 'Nequi Negocios', 'Caja General Principal'] },
        { key: 'paidAmount', label: 'Valor Girado ($ COP)', type: 'number', placeholder: '2890000' },
      ],
    },
    {
      moduleKey: 'mod-banks-reconciliation',
      parentServiceKey: 'srv-treasury',
      externalSubmoduleName: 'Bancos, Traslados y Conciliación Bancaria',
      tabIcon: '🏦',
      summary: 'Saldos en libros vs extracto bancario, traslados entre cajas/bancos e imputación automática de 4x1000.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Registrar Conciliación / Traslado',
      tableHeaders: ['Cuenta Bancaria', 'Período Corte', 'Saldo en Libros', 'Saldo Extracto', 'Diferencia Conciliada ($ COP)'],
      fields: [
        { key: 'bankAccount', label: 'Cuenta Bancaria o Billetera', type: 'select', options: ['Bancolombia Corriente #412-88901-2', 'Davivienda Ahorros #0051-99120', 'BBVA Empresarial #110-44521', 'Billetera Nequi / QR Bre-B'] },
        { key: 'cutoffPeriod', label: 'Mes de Conciliación / Operación', type: 'text', placeholder: 'Noviembre 2026 — Corte Mensual' },
        { key: 'bookBalance', label: 'Saldo Según Libros ($ COP)', type: 'number', placeholder: '48520000' },
        { key: 'statementBalance', label: 'Saldo Según Extracto Bancario ($ COP)', type: 'number', placeholder: '48520000' },
      ],
    },
    {
      moduleKey: 'mod-petty-cash',
      parentServiceKey: 'srv-treasury',
      externalSubmoduleName: 'Cajas Menores y Gastos de Turno (FixMotor)',
      tabIcon: '🪙',
      summary: 'Control de salidas operativas de efectivo (Expenses FixMotor), vales provisionales y reembolso de caja menor.',
      monthlyAddonUsd: 29000,
      actionButtonLabel: 'Registrar Gasto / Legalización',
      tableHeaders: ['Comprobante', 'Categoría de Gasto', 'Concepto / Tercero', 'Medio de Salida', 'Valor Gasto ($ COP)'],
      fields: [
        { key: 'expenseCategory', label: 'Categoría Operativa', type: 'select', options: ['Insumos y Suministros Rápidos', 'Transporte, Peajes y Mensajería', 'Servicios Públicos y Aseo', 'Gastos Generales de Turno'] },
        { key: 'expenseDescription', label: 'Concepto y NIT del Soporte', type: 'text', placeholder: 'Compra Jabón Desengrasante y Papelería — NIT 800.112.440' },
        { key: 'paymentSource', label: 'Pagado Desde', type: 'select', options: ['Efectivo de Caja (Resta Efectivo Neto)', 'Fondo Fijo Caja Menor Administración', 'Transferencia Nequi Menor'] },
        { key: 'expenseAmount', label: 'Valor del Gasto ($ COP)', type: 'number', placeholder: '65000' },
      ],
    },
  ],
  features: [
    {
      componentKey: 'comp-payment-withholding-deduct',
      externalName: 'Liquidación de retenciones aplicadas por el cliente en el recaudo (v2)',
      description: 'Permite descontar ReteFuente, ReteICA y ReteIVA practicadas por el cliente al registrar el Recibo de Caja.',
      parentModuleKey: 'mod-receivables-cxc',
      includedByDefault: true,
      monthlyAddonUsd: 15000,
    },
    {
      componentKey: 'comp-gmf-4x1000-auto',
      externalName: 'Cálculo automático de GMF (4x1000) en egresos bancarios',
      description: 'Calcula y contabiliza automáticamente el gravamen a los movimientos financieros (4x1000) en cuentas no exentas.',
      parentModuleKey: 'mod-banks-reconciliation',
      includedByDefault: true,
      monthlyAddonUsd: 15000,
    },
  ],
};
