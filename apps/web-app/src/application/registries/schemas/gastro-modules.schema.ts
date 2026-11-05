import type { ModuleUiSchemaDefinition } from '../../../domain/contracts/module-ui-schema.contract.js';

export const GASTRO_MODULE_SCHEMAS: Readonly<Record<string, ModuleUiSchemaDefinition>> = {
  'ms:gastro-tables': {
    microserviceKey: 'ms:gastro-tables',
    moduleNotation: 'mod:gastro-tables',
    parentService: 'srv:gastro',
    title: 'Plano de Salón, Mesas, Zonas y Comensales',
    badge: 'Prefijo SQL: tbl_',
    description:
      'Apertura y asignación de mesas en salón, terraza o barra con control de comensales y mesero.',
    listEndpoint: '/api/v1/gastro/tables/tables',
    createEndpoint: '/api/v1/gastro/tables/tables/seat',
    createButtonLabel: 'Asignar y Sentar Comensales en Mesa',
    responseCollectionPath: 'tables',
    kpis: [
      { label: 'Control Salón', value: 'Tiempo Real', badgeTone: 'emerald', subtext: 'Rotación de mesas por zona' },
      { label: 'Capacidad', value: 'Comensales / PAX', badgeTone: 'blue', subtext: 'Asignación por mesero' },
      { label: 'Esquema DB', value: 'srv_gastro.tbl_*', badgeTone: 'slate', subtext: 'Aislamiento por sucursal' },
    ],
    formFields: [
      { name: 'tableCode', label: 'Código de Mesa / Ubicación', type: 'text', defaultValue: 'MESA-TERRAZA-04' },
      { name: 'dinersCount', label: 'Número de Comensales (PAX)', type: 'integer', defaultValue: 4 },
      { name: 'waiterUserId', label: 'Mesero / Anfitrión Asignado', type: 'text', defaultValue: 'usr-mesero-carlos' },
    ],
    columns: [
      { key: 'tableCode', header: 'Mesa / Zona', format: 'code' },
      { key: 'waiterUserId', header: 'Mesero', format: 'text' },
      { key: 'dinersCount', header: 'Comensales', format: 'code' },
      { key: 'status', header: 'Estado Mesa', format: 'badge' },
    ],
    defaultPayload: {
      tableCode: 'MESA-TERRAZA-04',
      dinersCount: 4,
      waiterUserId: 'usr-mesero-carlos',
    },
  },
  'ms:gastro-kds': {
    microserviceKey: 'ms:gastro-kds',
    moduleNotation: 'mod:gastro-kds',
    parentService: 'srv:gastro',
    title: 'Comandera Digital de Cocina y Barra (Kitchen Display System)',
    badge: 'Prefijo SQL: kds_',
    description:
      'Despacho de comandas por estación de preparación (Parrilla, Fríos, Horno, Bar) con modificadores y tiempos.',
    listEndpoint: '/api/v1/gastro/kds/tickets',
    createEndpoint: '/api/v1/gastro/kds/tickets/fire',
    createButtonLabel: 'Marchar Comanda a Cocina / Barra',
    responseCollectionPath: 'tickets',
    kpis: [
      { label: 'Estaciones KDS', value: 'PARRILLA / BARRA', badgeTone: 'emerald', subtext: 'Ruteo instantáneo de platos' },
      { label: 'Estado Ticket', value: 'PREPARING -> READY', badgeTone: 'amber', subtext: 'Semáforo de tiempos' },
      { label: 'Esquema DB', value: 'srv_gastro.kds_*', badgeTone: 'slate', subtext: 'Trazabilidad de cocina' },
    ],
    formFields: [
      { name: 'tableCode', label: 'Mesa Origen', type: 'text', defaultValue: 'MESA-TERRAZA-04' },
      {
        name: 'station',
        label: 'Estación de Preparación',
        type: 'select',
        defaultValue: 'HOT_KITCHEN',
        options: [
          { value: 'HOT_KITCHEN', label: 'Cocina Caliente / Parrilla (HOT_KITCHEN)' },
          { value: 'COLD_BAR', label: 'Barra Fría / Ensaladas (COLD_BAR)' },
          { value: 'BEVERAGE_BAR', label: 'Bar y Coctelería (BEVERAGE_BAR)' },
        ],
      },
      {
        name: 'items',
        label: 'Platos y Modificadores a Marchar (JSON Estructurado)',
        type: 'json-lines',
        defaultValue: [
          { dishName: 'Lomo al Trapo 350g', quantity: 2, notes: 'Término medio, sin sal gruesa' },
        ],
      },
    ],
    columns: [
      { key: 'id', header: 'ID Comanda', format: 'code' },
      { key: 'tableCode', header: 'Mesa', format: 'code' },
      { key: 'station', header: 'Estación Cocina', format: 'badge' },
      { key: 'status', header: 'Estado KDS', format: 'badge' },
      { key: 'firedAtIso', header: 'Hora Marchado', format: 'code' },
    ],
    defaultPayload: {
      tableCode: 'MESA-TERRAZA-04',
      station: 'HOT_KITCHEN',
      items: [{ dishName: 'Lomo al Trapo 350g', quantity: 2, notes: 'Término medio, sin sal gruesa' }],
    },
  },
  'ms:gastro-split-check': {
    microserviceKey: 'ms:gastro-split-check',
    moduleNotation: 'mod:gastro-split-check',
    parentService: 'srv:gastro',
    title: 'División Exacta de Cuentas por Silla y Propina Voluntaria',
    badge: 'Prefijo SQL: spc_',
    description:
      'Separación matemática exacta de pre-cuentas por comensal/silla con liquidación de propina sin perder centavos.',
    listEndpoint: '/api/v1/gastro/split-check/checks',
    createEndpoint: '/api/v1/gastro/split-check/checks/split-by-seats',
    createButtonLabel: 'Liquidar y Dividir Cuenta por Silla',
    responseCollectionPath: 'checks',
    kpis: [
      { label: 'Cuadre Centavos', value: 'Cero Descuadres', badgeTone: 'emerald', subtext: 'Suma sillas == Total mesa' },
      { label: 'Propina Legal', value: 'Cálculo Exacto', badgeTone: 'blue', subtext: 'Porcentaje parametrizable' },
      { label: 'Esquema DB', value: 'srv_gastro.spc_*', badgeTone: 'slate', subtext: 'Sub-cuentas auditadas' },
    ],
    formFields: [
      { name: 'tableId', label: 'Código de Mesa a Dividir', type: 'text', defaultValue: 'MESA-TERRAZA-04' },
      { name: 'tipPercent', label: 'Porcentaje de Propina Voluntaria (%)', type: 'decimal', defaultValue: '10.0000' },
      {
        name: 'items',
        label: 'Consumos Asignados por Silla (JSON Estructurado)',
        type: 'json-lines',
        defaultValue: [
          { seatNumber: 1, itemName: 'Lomo al Trapo', lineAmount: '68000.0000' },
          { seatNumber: 2, itemName: 'Salmón Austral', lineAmount: '62000.0000' },
        ],
      },
    ],
    columns: [
      { key: 'tableId', header: 'Mesa', format: 'code' },
      { key: 'tableGrandTotal', header: 'Total General Mesa (Con Propina)', format: 'tabular-currency' },
      { key: 'branchId', header: 'Sucursal', format: 'code' },
    ],
    defaultPayload: {
      tableId: 'MESA-TERRAZA-04',
      tipPercent: '10.0000',
      items: [
        { seatNumber: 1, itemName: 'Lomo al Trapo', lineAmount: '68000.0000' },
        { seatNumber: 2, itemName: 'Salmón Austral', lineAmount: '62000.0000' },
      ],
    },
  },
};
