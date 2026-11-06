import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

export const SRV_TICKETING_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-ticketing',
  externalPrincipalModuleName: 'Taquilla y Soporte',
  icon: '🎟️',
  subtitle: 'Venta de entradas/covers, control de ingreso y atención de reclamos.',
  standaloneMonthlyUsd: 119000,
  submodules: [
    {
      moduleKey: 'mod-event-tickets',
      parentServiceKey: 'srv-ticketing',
      externalSubmoduleName: 'Venta de Entradas y Covers',
      tabIcon: '🎟️',
      summary: '',
      monthlyAddonUsd: 45000,
      actionButtonLabel: '+ Vender Entrada / Cover',
      tableHeaders: ['Ticket', 'Evento / Zona', 'Cliente', 'Cantidad', 'Total Pagado', 'Estado', 'Acciones'],
      fields: [
        { key: 'eventName', label: 'Evento / Localidad', type: 'select', options: ['Cover General', 'Zona VIP / Palco', 'Preventa Evento Especial'] },
        { key: 'buyerAttendee', label: 'Cliente', type: 'text', placeholder: 'Sebastián Restrepo' },
        { key: 'ticketPriceCop', label: 'Valor Total ($)', type: 'number', placeholder: '50000' },
      ],
    },
    {
      moduleKey: 'mod-gate-scanner',
      parentServiceKey: 'srv-ticketing',
      externalSubmoduleName: 'Control de Entrada en Puerta',
      tabIcon: '📲',
      summary: '',
      monthlyAddonUsd: 35000,
      actionButtonLabel: '+ Validar Entrada',
      tableHeaders: ['Código Ticket', 'Asistente', 'Zona', 'Hora Ingreso', 'Estado', 'Acciones'],
      fields: [
        { key: 'qrToken', label: 'Código de Boleta / QR', type: 'text', placeholder: 'TCK-9921' },
        { key: 'gateDoor', label: 'Puerta de Acceso', type: 'select', options: ['Entrada Principal', 'Acceso VIP'] },
      ],
    },
    {
      moduleKey: 'mod-pqrsf-helpdesk',
      parentServiceKey: 'srv-ticketing',
      externalSubmoduleName: 'Solicitudes y Garantías de Clientes',
      tabIcon: '🎧',
      summary: '',
      monthlyAddonUsd: 35000,
      actionButtonLabel: '+ Crear Caso de Atención',
      tableHeaders: ['Caso', 'Cliente', 'Tipo', 'Descripción', 'Estado', 'Acciones'],
      fields: [
        { key: 'ticketType', label: 'Tipo de Solicitud', type: 'select', options: ['Soporte / Garantía', 'Petición', 'Reclamo', 'Sugerencia'] },
        { key: 'requesterName', label: 'Cliente', type: 'text', placeholder: 'Nombre del cliente' },
        { key: 'caseSubject', label: 'Detalle del Caso', type: 'text', placeholder: 'Descripción breve' },
      ],
    },
  ],
  features: [
    { componentKey: 'comp-anti-clone-qr-gate', parentServiceKey: 'srv-ticketing', externalName: 'Lector de Código QR en Puerta', description: 'Evita doble uso de entradas.', monthlyAddonUsd: 19000 },
  ],
};
