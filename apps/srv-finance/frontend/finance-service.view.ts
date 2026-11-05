import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

/**
 * Frontend interno del Microservicio `srv-finance` (Módulo Principal: Tesorería, Cartera y Contabilidad).
 * Submódulos en interpestañas:
 *  - Caja y Bancos (`mod-cashbook`)
 *  - Cuentas por Cobrar y Pagar (`mod-arap`)
 *  - Libro Contable PUC (`mod-puc`)
 */
export const SRV_FINANCE_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-finance',
  externalPrincipalModuleName: 'Tesorería, Cartera y Contabilidad',
  icon: '🏦',
  subtitle: 'Flujo de caja y bancos, recaudo de cartera CxC, pago a proveedores CxP y asientos PUC.',
  standaloneMonthlyUsd: 29,
  submodules: [
    {
      moduleKey: 'mod-cashbook',
      parentServiceKey: 'srv-finance',
      externalSubmoduleName: 'Caja y Bancos',
      tabIcon: '💵',
      summary: 'Ingresos, egresos de tesorería, arqueo de turno y saldos conciliados en cuentas bancarias.',
      monthlyAddonUsd: 10,
      actionButtonLabel: 'Registrar Movimiento de Caja/Banco',
      tableHeaders: ['Comprobante', 'Cuenta / Caja', 'Tipo', 'Concepto', 'Firma Encargado', 'Monto'],
      fields: [
        { key: 'accountName', label: 'Caja o Cuenta Bancaria', type: 'select', options: ['Caja General Principal', 'Bancolombia Cuenta Corriente', 'Davivienda Recaudos'] },
        { key: 'movementType', label: 'Naturaleza', type: 'select', options: ['Ingreso / Recaudo', 'Egreso / Pago', 'Traslado entre Cuentas'] },
        { key: 'concept', label: 'Concepto del Movimiento', type: 'text', placeholder: 'Pago Flete Transporte Nacional' },
        {
          key: 'managerSignature',
          label: 'Firma de Encargado que Autoriza',
          type: 'text',
          placeholder: 'Autorizado: Tesorería General',
          requiredFeatureKey: 'comp-manager-signature',
        },
        { key: 'amount', label: 'Valor del Movimiento ($)', type: 'number', placeholder: '890000' },
      ],
    },
    {
      moduleKey: 'mod-arap',
      parentServiceKey: 'srv-finance',
      externalSubmoduleName: 'Cartera CxC y CxP',
      tabIcon: '📑',
      summary: 'Seguimiento de facturas pendientes por cobrar a clientes y obligaciones por pagar a proveedores.',
      monthlyAddonUsd: 12,
      actionButtonLabel: 'Registrar Abono / Obligación',
      tableHeaders: ['Documento', 'Tercero', 'Tipo de Cartera', 'Vencimiento', 'Saldo Pendiente', 'Estado'],
      fields: [
        { key: 'thirdParty', label: 'Cliente o Proveedor', type: 'text', placeholder: 'Agroinsumos del Norte S.A.S.' },
        { key: 'ledgerType', label: 'Tipo de Cartera', type: 'select', options: ['Cuenta por Cobrar (Cliente)', 'Cuenta por Pagar (Proveedor)'] },
        { key: 'dueDate', label: 'Fecha de Vencimiento', type: 'date' },
        { key: 'balanceAmount', label: 'Valor / Abono ($)', type: 'number', placeholder: '4200000' },
      ],
    },
    {
      moduleKey: 'mod-puc',
      parentServiceKey: 'srv-finance',
      externalSubmoduleName: 'Contabilidad PUC',
      tabIcon: '📘',
      summary: 'Comprobantes de diario, causación automática por cuenta PUC y balance de prueba.',
      monthlyAddonUsd: 12,
      actionButtonLabel: 'Asentar Comprobante Contable',
      tableHeaders: ['Asiento', 'Cuenta PUC', 'Tercero', 'Detalle', 'Débito / Crédito', 'Estado'],
      fields: [
        { key: 'pucCode', label: 'Cuenta Contable PUC', type: 'select', options: ['110505 - Caja General', '130505 - Clientes Nacionales', '220501 - Proveedores Nacionales', '413501 - Comercio al por Mayor y Menor'] },
        { key: 'thirdPartyNit', label: 'NIT Tercero', type: 'text', placeholder: '900.412.110-1' },
        { key: 'entryDetail', label: 'Concepto Contable', type: 'text', placeholder: 'Causación Factura de Venta FEV-1042' },
        { key: 'entryAmount', label: 'Valor Asiento ($)', type: 'number', placeholder: '2350000' },
      ],
    },
  ],
  features: [],
};
