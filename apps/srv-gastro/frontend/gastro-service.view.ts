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
  standaloneMonthlyUsd: 29,
  submodules: [
    {
      moduleKey: 'mod-tables',
      parentServiceKey: 'srv-gastro',
      externalSubmoduleName: 'Salón y Mapa de Mesas',
      tabIcon: '🪑',
      summary: 'Ocupación de mesas por terraza o salón, comensales activos y asignación de mesero.',
      monthlyAddonUsd: 10,
      actionButtonLabel: 'Abrir / Actualizar Mesa',
      tableHeaders: ['Mesa / Zona', 'Comensales', 'Mesero Asignado', 'Consumo Acumulado', 'Estado'],
      fields: [
        { key: 'tableCode', label: 'Mesa y Zona', type: 'select', options: ['Mesa 01 — Salón Principal', 'Mesa 05 — Terraza', 'Mesa 12 — VIP', 'Barra Principal 02'] },
        { key: 'guestsCount', label: 'Número de Comensales', type: 'number', placeholder: '4' },
        {
          key: 'waiterName',
          label: 'Mesero / Encargado de Mesa',
          type: 'text',
          placeholder: 'Mateo Ríos',
          requiredFeatureKey: 'comp-waiter-assign',
        },
        { key: 'currentTotal', label: 'Consumo Inicial ($)', type: 'number', placeholder: '148000' },
      ],
    },
    {
      moduleKey: 'mod-kds',
      parentServiceKey: 'srv-gastro',
      externalSubmoduleName: 'Monitor de Cocina (KDS)',
      tabIcon: '🔥',
      summary: 'Tablero de comandas por estación de preparación (parrilla, cocina fría, bar) y tiempos.',
      monthlyAddonUsd: 12,
      actionButtonLabel: 'Enviar Comanda a Cocina',
      tableHeaders: ['Comanda', 'Mesa / Origen', 'Platos y Notas', 'Estación', 'Tiempo / Estado'],
      fields: [
        { key: 'originTable', label: 'Mesa / Pedido', type: 'text', placeholder: 'Mesa 05 — Terraza' },
        { key: 'dishesDetail', label: 'Platos Solicitados y Término', type: 'text', placeholder: '2x Punta de Anca 3/4, 1x Limonada de Coco' },
        { key: 'stationName', label: 'Estación de Cocina', type: 'select', options: ['Parrilla y Calientes', 'Cocina Fría y Entradas', 'Bar y Bebidas', 'Repostería'] },
      ],
    },
    {
      moduleKey: 'mod-split',
      parentServiceKey: 'srv-gastro',
      externalSubmoduleName: 'División de Cuentas',
      tabIcon: '➗',
      summary: 'Separación de cuenta por silla, por comensal o en partes iguales antes de facturar.',
      monthlyAddonUsd: 8,
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
      externalName: 'Asignación de mesero por mesa',
      description: 'Registra el mesero responsable en apertura de mesa y liquidación de propinas.',
      parentModuleKey: 'mod-tables',
      includedByDefault: true,
      monthlyAddonUsd: 4,
    },
  ],
};
