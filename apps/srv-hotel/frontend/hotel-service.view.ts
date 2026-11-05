import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

/**
 * Frontend interno del Microservicio `srv-hotel` (Módulo Principal: Reservas de Cupos, Tickets y Alojamiento).
 * Submódulos en interpestañas:
 *  - Reserva de Cupos y Agenda (`mod-bookings`)
 *  - Emisión de Tickets y Taquilla (`mod-tickets`)
 *  - Recepción y Habitaciones (`mod-rooms`)
 */
export const SRV_HOTEL_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-hotel',
  externalPrincipalModuleName: 'Reservas de Cupos, Tickets y Alojamiento',
  icon: '🎟️',
  subtitle: 'Agenda de cupos por franja horaria, taquilla de tickets con código QR y recepción de huéspedes.',
  standaloneMonthlyUsd: 29,
  submodules: [
    {
      moduleKey: 'mod-bookings',
      parentServiceKey: 'srv-hotel',
      externalSubmoduleName: 'Reserva de Cupos y Agenda',
      tabIcon: '📅',
      summary: 'Control de cupos disponibles por fecha, franja horaria, capacidad máxima y titular.',
      monthlyAddonUsd: 10,
      actionButtonLabel: 'Confirmar Reserva de Cupo',
      tableHeaders: ['Código Reserva', 'Titular', 'Espacio / Servicio', 'Fecha y Franja', 'Cupos', 'Estado'],
      fields: [
        { key: 'holderName', label: 'Nombre del Titular', type: 'text', placeholder: 'Valeria Mendoza' },
        { key: 'spaceName', label: 'Espacio / Recinto / Servicio', type: 'select', options: ['Salón Auditorio Empresarial', 'Recorrido Guiado / Evento', 'Cabaña / Suite Ejecutiva'] },
        { key: 'bookingDate', label: 'Fecha Programada', type: 'date' },
        { key: 'slotsBooked', label: 'Cantidad de Cupos Reservados', type: 'number', placeholder: '4' },
      ],
    },
    {
      moduleKey: 'mod-tickets',
      parentServiceKey: 'srv-hotel',
      externalSubmoduleName: 'Emisión de Tickets y Taquilla',
      tabIcon: '🎫',
      summary: 'Expedición de tickets numerados de ingreso, pases de acceso y validación QR en portería.',
      monthlyAddonUsd: 12,
      actionButtonLabel: 'Emitir Ticket de Acceso',
      tableHeaders: ['N° Ticket', 'Categoría', 'Visitante / Comprador', 'Código QR', 'Tarifa', 'Estado Portería'],
      fields: [
        { key: 'ticketCategory', label: 'Categoría de Ticket', type: 'select', options: ['Pase General Día', 'Ticket VIP Preferencial', 'Ticket Vehicular / Parqueadero'] },
        { key: 'visitorName', label: 'Nombre del Visitante', type: 'text', placeholder: 'Santiago Ospina' },
        {
          key: 'qrToken',
          label: 'Código QR de Control',
          type: 'text',
          placeholder: 'QR-PK-88412',
          requiredFeatureKey: 'comp-qr-ticket',
        },
        { key: 'ticketPrice', label: 'Valor del Ticket ($)', type: 'number', placeholder: '45000' },
      ],
    },
    {
      moduleKey: 'mod-rooms',
      parentServiceKey: 'srv-hotel',
      externalSubmoduleName: 'Recepción y Alojamiento',
      tabIcon: '🏨',
      summary: 'Check-in, check-out, estado de habitaciones/espacios y cargos a la cuenta del huésped.',
      monthlyAddonUsd: 12,
      actionButtonLabel: 'Registrar Check-In / Habitación',
      tableHeaders: ['Habitación / Unidad', 'Huésped Titular', 'Ingreso / Salida', 'Tarifa Noche', 'Estado'],
      fields: [
        { key: 'roomNumber', label: 'Unidad / Habitación', type: 'text', placeholder: 'Habitación 304 — Vista Jardín' },
        { key: 'guestName', label: 'Huésped Titular y Documento', type: 'text', placeholder: 'Camila Restrepo — CC 1.020.441.210' },
        { key: 'nightsCount', label: 'Noches de Estadía', type: 'number', placeholder: '2' },
        { key: 'nightlyRate', label: 'Tarifa por Noche ($)', type: 'number', placeholder: '210000' },
      ],
    },
  ],
  features: [
    {
      componentKey: 'comp-qr-ticket',
      externalName: 'Validador QR de ticket en portería',
      description: 'Genera y valida token QR único para control de acceso en eventos, cupos y parqueaderos.',
      parentModuleKey: 'mod-tickets',
      includedByDefault: true,
      monthlyAddonUsd: 5,
    },
  ],
};
