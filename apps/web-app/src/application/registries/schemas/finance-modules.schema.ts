import type { ModuleUiSchemaDefinition } from '../../../domain/contracts/module-ui-schema.contract.js';

export const FINANCE_MODULE_SCHEMAS: Readonly<Record<string, ModuleUiSchemaDefinition>> = {
  'ms:finance-cashbook': {
    microserviceKey: 'ms:finance-cashbook',
    moduleNotation: 'mod:finance-cashbook',
    parentService: 'srv:finance',
    title: 'Libro Diario de Ingresos, Egresos y Caja Menor',
    badge: 'Prefijo SQL: csh_ · Mutex: accounting_ledger_engine',
    description:
      'Control simplificado de flujo de caja diario. Conmuta a Archivo Histórico cuando activas Contabilidad PUC/NIIF.',
    listEndpoint: '/api/v1/finance/cashbook/entries',
    createEndpoint: '/api/v1/finance/cashbook/entries',
    createButtonLabel: 'Asentar Movimiento en Libro de Caja',
    responseCollectionPath: 'entries',
    kpis: [
      { label: 'Motor Financiero', value: 'CAJA SIMPLIFICADA', badgeTone: 'amber', subtext: 'Mutex: accounting_ledger_engine' },
      { label: 'Flujo Efectivo', value: 'INFLOW / OUTFLOW', badgeTone: 'blue', subtext: 'Control diario por sede' },
      { label: 'Esquema DB', value: 'srv_finance.csh_*', badgeTone: 'slate', subtext: 'Trazabilidad de recibos' },
    ],
    formFields: [
      {
        name: 'direction',
        label: 'Naturaleza del Movimiento',
        type: 'select',
        defaultValue: 'INFLOW',
        options: [
          { value: 'INFLOW', label: 'Ingreso de Efectivo / Bancos (INFLOW)' },
          { value: 'OUTFLOW', label: 'Egreso / Gasto Operativo (OUTFLOW)' },
        ],
      },
      { name: 'concept', label: 'Concepto del Movimiento', type: 'text', defaultValue: 'Recaudo Ventas Mostrador Turno AM' },
      { name: 'amountFixed4', label: 'Valor del Movimiento ($)', type: 'decimal', defaultValue: '950000.0000' },
    ],
    columns: [
      { key: 'id', header: 'ID Movimiento', format: 'code' },
      { key: 'direction', header: 'Tipo', format: 'badge' },
      { key: 'concept', header: 'Concepto / Detalle', format: 'text' },
      { key: 'signedDeltaFixed4', header: 'Impacto en Caja', format: 'tabular-currency' },
    ],
    defaultPayload: {
      direction: 'INFLOW',
      concept: 'Recaudo Ventas Mostrador Turno AM',
      amountFixed4: '950000.0000',
    },
  },
  'ms:finance-ar-ap': {
    microserviceKey: 'ms:finance-ar-ap',
    moduleNotation: 'mod:finance-ar-ap',
    parentService: 'srv:finance',
    title: 'Cartera de Clientes (CxC) y Cuentas por Pagar a Proveedores (CxP)',
    badge: 'Prefijo SQL: arp_',
    description:
      'Aplicación de abonos parciales o cancelación total de facturas a crédito con bloqueo de sobrepagos.',
    listEndpoint: '/api/v1/finance/ar-ap/ledgers',
    createEndpoint: '/api/v1/finance/ar-ap/ledgers/apply-payment',
    createButtonLabel: 'Aplicar Abono a Cartera CxC / CxP',
    responseCollectionPath: 'ledgers',
    kpis: [
      { label: 'Integridad Saldo', value: 'Anti-Sobrepago', badgeTone: 'emerald', subtext: 'Rechaza abonos mayores a deuda' },
      { label: 'Libros Auxiliares', value: 'CxC y CxP', badgeTone: 'blue', subtext: 'Estado de cuenta por tercero' },
      { label: 'Esquema DB', value: 'srv_finance.arp_*', badgeTone: 'slate', subtext: 'Recaudos y pagos' },
    ],
    formFields: [
      { name: 'contactId', label: 'ID Tercero (Cliente o Proveedor)', type: 'text', defaultValue: 'cnt-901445889' },
      {
        name: 'ledgerType',
        label: 'Libro de Cartera',
        type: 'select',
        defaultValue: 'RECEIVABLE_CXC',
        options: [
          { value: 'RECEIVABLE_CXC', label: 'Cuentas por Cobrar Clientes (RECEIVABLE_CXC)' },
          { value: 'PAYABLE_CXP', label: 'Cuentas por Pagar Proveedores (PAYABLE_CXP)' },
        ],
      },
      { name: 'outstandingBalance', label: 'Saldo Pendiente Actual ($)', type: 'decimal', defaultValue: '2400000.0000' },
      { name: 'paymentAmount', label: 'Valor del Abono a Aplicar ($)', type: 'decimal', defaultValue: '1000000.0000' },
    ],
    columns: [
      { key: 'contactId', header: 'Tercero', format: 'code' },
      { key: 'ledgerType', header: 'Tipo Cartera', format: 'badge' },
      { key: 'remainingBalance', header: 'Nuevo Saldo Pendiente', format: 'tabular-currency' },
      { key: 'isSettled', header: '¿Paz y Salvo?', format: 'badge' },
    ],
    defaultPayload: {
      contactId: 'cnt-901445889',
      ledgerType: 'RECEIVABLE_CXC',
      outstandingBalance: '2400000.0000',
      paymentAmount: '1000000.0000',
    },
  },
  'ms:finance-accounting-puc': {
    microserviceKey: 'ms:finance-accounting-puc',
    moduleNotation: 'mod:finance-accounting-puc',
    parentService: 'srv:finance',
    title: 'Contabilidad Integral PUC / NIIF de Partida Doble',
    badge: 'Prefijo SQL: puc_ · Supersedes: mod:finance-cashbook',
    description:
      'Asientos contables mayores con validación estricta de partida doble (Total Débito == Total Crédito) por tercero.',
    listEndpoint: '/api/v1/finance/accounting-puc/journal/vouchers',
    createEndpoint: '/api/v1/finance/accounting-puc/journal/post-voucher',
    createButtonLabel: 'Contabilizar Comprobante de Partida Doble',
    responseCollectionPath: 'vouchers',
    kpis: [
      { label: 'Invariante Contable', value: 'Débito == Crédito', badgeTone: 'emerald', subtext: 'Rechaza asientos descuadrados' },
      { label: 'Normativa', value: 'PUC / NIIF Colombia', badgeTone: 'blue', subtext: 'Auxiliar por NIT de tercero' },
      { label: 'Esquema DB', value: 'srv_finance.puc_*', badgeTone: 'slate', subtext: 'Mayor y Balances' },
    ],
    formFields: [
      { name: 'voucherNumber', label: 'Número de Comprobante Contable', type: 'text', defaultValue: 'COMP-DIARIO-001' },
      {
        name: 'lines',
        label: 'Imputaciones PUC Débito / Crédito (JSON Estructurado)',
        type: 'json-lines',
        defaultValue: [
          { pucAccountCode: '110505', thirdPartyContactId: 'cnt-901445889', debit: '1190000.0000', credit: '0.0000' },
          { pucAccountCode: '413501', thirdPartyContactId: 'cnt-901445889', debit: '0.0000', credit: '1000000.0000' },
          { pucAccountCode: '240801', thirdPartyContactId: 'cnt-901445889', debit: '0.0000', credit: '190000.0000' },
        ],
      },
    ],
    columns: [
      { key: 'voucherNumber', header: 'No. Comprobante', format: 'code' },
      { key: 'totalDebit', header: 'Total Débito', format: 'tabular-currency' },
      { key: 'totalCredit', header: 'Total Crédito', format: 'tabular-currency' },
      { key: 'balanced', header: 'Partida Doble', format: 'badge' },
    ],
    defaultPayload: {
      voucherNumber: 'COMP-DIARIO-001',
      lines: [
        { pucAccountCode: '110505', thirdPartyContactId: 'cnt-901445889', debit: '1190000.0000', credit: '0.0000' },
        { pucAccountCode: '413501', thirdPartyContactId: 'cnt-901445889', debit: '0.0000', credit: '1000000.0000' },
        { pucAccountCode: '240801', thirdPartyContactId: 'cnt-901445889', debit: '0.0000', credit: '190000.0000' },
      ],
    },
  },
};
