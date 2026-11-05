import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

/**
 * Frontend interno del Microservicio `srv-gastro` (Módulo Principal: Restaurantes, Mesas y Comandas).
 * Submódulos en interpestañas:
 *  - Salón y Mapa de Mesas (`mod-tables`)
 *  - Monitor de Cocina KDS (`mod-kds`)
 *  - División de Cuentas (`mod-split`)
 */
export const SRV_GASTRO_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-gastro',
  externalPrincipalModuleName: 'Restaurantes, Mesas y Comandas',
  icon: '🍽️',
  subtitle: 'Control de salón, comandas en tiempo real para cocina/bar y división de cuentas.',
  standaloneMonthlyUsd: 119000,
  submodules: [
    {
      moduleKey: 'mod-tables',
      parentServiceKey: 'srv-gastro',
      externalSubmoduleName: 'Salón y Mapa de Mesas',
      tabIcon: '🪑',
      summary: 'Ocupación de mesas por terraza o salón, comensales activos y asignación de mesero.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Abrir / Actualizar Mesa',
      tableHeaders: ['Mesa / Zona', 'Comensales', 'Mesero Asignado', 'Consumo Acumulado', 'Estado'],
      fields: [
        { key: 'tableCode', label: 'Mesa y Zona', type: 'select', options: ['Mesa 01 — Salón Principal', 'Mesa 05 — Terraza', 'Mesa 12 — VIP', 'Barra Principal 02'] },
        { key: 'guestsCount', label: 'Número de Comensales', type: 'number', placeholder: '4' },
        {
          key: 'waiterName',
          label: 'Mesero / Bartender Asignado',
          type: 'text',
          placeholder: 'Mateo Ríos',
          requiredFeatureKey: 'comp-waiter-assign',
        },
        {
          key: 'barBottleMeasure',
          label: 'Medida de Licor / Botella (Bares)',
          type: 'select',
          options: ['Botella Completa 750ml', 'Media Botella 375ml', 'Trago / Shot 1.5 Oz', 'Cóctel de Autor'],
          requiredFeatureKey: 'comp-bar-shot-measure',
        },
        { key: 'currentTotal', label: 'Consumo Inicial ($ COP)', type: 'number', placeholder: '148000' },
      ],
    },
    {
      moduleKey: 'mod-kds',
      parentServiceKey: 'srv-gastro',
      externalSubmoduleName: 'Monitor de Cocina y Barra (KDS)',
      tabIcon: '🔥',
      summary: 'Tablero de comandas por estación de preparación (parrilla, cocina fría, barra de licores) y tiempos.',
      monthlyAddonUsd: 45000,
      actionButtonLabel: 'Enviar Comanda a Cocina / Barra',
      tableHeaders: ['Comanda', 'Mesa / Barra', 'Pedido y Notas', 'Estación', 'Tiempo / Estado'],
      fields: [
        { key: 'originTable', label: 'Mesa / Barra', type: 'text', placeholder: 'Mesa 05 — Terraza / Barra 02' },
        { key: 'dishesDetail', label: 'Platos o Tragos Solicitados', type: 'text', placeholder: '2x Punta de Anca 3/4, 2x Gin Tonic' },
        { key: 'stationName', label: 'Estación Destino', type: 'select', options: ['Barra Principal y Coctelería', 'Parrilla y Calientes', 'Cocina Fría y Entradas', 'Repostería'] },
      ],
    },
    {
      moduleKey: 'mod-split',
      parentServiceKey: 'srv-gastro',
      externalSubmoduleName: 'División de Cuentas',
      tabIcon: '➗',
      summary: 'Separación de cuenta por silla, por comensal o en partes iguales antes de facturar.',
      monthlyAddonUsd: 29000,
      actionButtonLabel: 'Registrar División de Cuenta',
      tableHeaders: ['Referencia', 'Mesa', 'Modalidad', 'Pagadores', 'Total por Pagador'],
      fields: [
        { key: 'tableRef', label: 'Mesa a Dividir', type: 'text', placeholder: 'Mesa 12 — VIP' },
        { key: 'splitMode', label: 'Modalidad de División', type: 'select', options: ['Por Comensal / Silla', 'Partes Iguales', 'Por Producto Consumido'] },
        { key: 'payersCount', label: 'Cantidad de Pagadores', type: 'number', placeholder: '3' },
        { key: 'amountPerPayer', label: 'Valor Promedio por Pagador ($)', type: 'number', placeholder: '85000' },
      ],
    },
  ],
  features: [
    {
      componentKey: 'comp-waiter-assign',
      externalName: 'Asignación de mesero / bartender por mesa',
      description: 'Registra el mesero o bartender responsable en apertura de mesa y liquidación de propinas.',
      parentModuleKey: 'mod-tables',
      includedByDefault: true,
      monthlyAddonUsd: 15000,
    },
    {
      componentKey: 'comp-bar-shot-measure',
      externalName: 'Control de inventario por trago / botella (Bares)',
      description: 'Descuenta automáticamente onzas o mililitros de botellas abiertas al vender tragos o cócteles.',
      parentModuleKey: 'mod-tables',
      includedByDefault: true,
      monthlyAddonUsd: 19000,
    },
    {
      componentKey: 'comp-happy-hour-pricing',
      externalName: 'Tarifas automáticas Happy Hour (Bares)',
      description: 'Activa precios promocionales por franja horaria en barra y mesas.',
      parentModuleKey: 'mod-tables',
      includedByDefault: true,
      monthlyAddonUsd: 15000,
    },
  ],
};
