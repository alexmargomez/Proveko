import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

/**
 * Frontend interno del Microservicio `srv-hotel` (Módulo Principal: Hotelería, Alojamiento, Folios y Reservas).
 */
export const SRV_HOTEL_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-hotel',
  externalPrincipalModuleName: 'Hotelería, Alojamiento, Folios y Reservas',
  icon: '🏨',
  subtitle: 'Rack de habitaciones, check-in/out, folios de cargos (minibar/restaurante), tarifas por temporada y ama de llaves.',
  standaloneMonthlyUsd: 129000,
  submodules: [
    {
      moduleKey: 'mod-bookings',
      parentServiceKey: 'srv-hotel',
      externalSubmoduleName: 'Reserva de Cupos, Cabañas y Salones',
      tabIcon: '📅',
      summary: 'Control de disponibilidad por fecha, temporada, anticipo garantizado y bloqueo en calendario.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Confirmar Reserva de Alojamiento',
      tableHeaders: ['Código Reserva', 'Titular', 'Espacio / Habitación', 'Fecha y Franja', 'Cupos / Huéspedes', 'Estado'],
      fields: [
        { key: 'holderName', label: 'Nombre del Titular', type: 'text', placeholder: 'Valeria Mendoza' },
        { key: 'spaceName', label: 'Habitación / Cabaña / Salón', type: 'select', options: ['Suite Ejecutiva Matrimonial', 'Cabaña Familiar Glamping', 'Salón Auditorio Empresarial'] },
        { key: 'bookingDate', label: 'Fecha de Check-In', type: 'date' },
        { key: 'slotsBooked', label: 'Cantidad de Huéspedes', type: 'number', placeholder: '4' },
      ],
    },
    {
      moduleKey: 'mod-rooms',
      parentServiceKey: 'srv-hotel',
      externalSubmoduleName: 'Recepción, Check-In y Folio de Huésped',
      tabIcon: '🛎️',
      summary: 'Check-in, registro TRA MinCIT, estado de habitaciones y cuenta maestra (folio) de consumos.',
      monthlyAddonUsd: 45000,
      actionButtonLabel: 'Registrar Check-In / Cargo a Habitación',
      tableHeaders: ['Habitación / Unidad', 'Huésped Titular', 'Ingreso / Salida', 'Tarifa Noche', 'Estado'],
      fields: [
        { key: 'roomNumber', label: 'Unidad / Habitación', type: 'text', placeholder: 'Habitación 304 — Vista Jardín' },
        { key: 'guestName', label: 'Huésped Titular y Documento', type: 'text', placeholder: 'Camila Restrepo — CC 1.020.441.210' },
        { key: 'nightsCount', label: 'Noches de Estadía', type: 'number', placeholder: '2' },
        { key: 'nightlyRate', label: 'Tarifa por Noche ($ COP)', type: 'number', placeholder: '210000' },
      ],
    },
    {
      moduleKey: 'mod-seasonal-rates',
      parentServiceKey: 'srv-hotel',
      externalSubmoduleName: 'Tarifas por Temporada y Planes de Estadía',
      tabIcon: '🌞',
      summary: 'Configuración de tarifas dinámicas por temporada alta/media/baja, puentes festivos y planes con desayuno.',
      monthlyAddonUsd: 35000,
      actionButtonLabel: 'Guardar Plan Tarifario de Temporada',
      tableHeaders: ['Plan / Temporada', 'Tipo Habitación', 'Vigencia', 'Incluye Alimentación', 'Tarifa Noche ($ COP)'],
      fields: [
        { key: 'seasonPlanName', label: 'Nombre de Temporada / Plan', type: 'text', placeholder: 'Temporada Alta Puentes Festivos — Plan Americano' },
        { key: 'roomType', label: 'Categoría de Alojamiento', type: 'select', options: ['Estándar Doble', 'Suite Junior VIP', 'Cabaña Familiar 6 Personas'] },
        { key: 'mealPlan', label: 'Régimen de Alimentación', type: 'select', options: ['Alojamiento + Desayuno Buffet', 'Todo Incluido (Pensión Completa)', 'Solo Alojamiento'] },
        { key: 'seasonRateCop', label: 'Tarifa Noche Temporada ($ COP)', type: 'number', placeholder: '340000' },
      ],
    },
    {
      moduleKey: 'mod-housekeeping',
      parentServiceKey: 'srv-hotel',
      externalSubmoduleName: 'Ama de Llaves, Aseo y Mantenimiento',
      tabIcon: '🧹',
      summary: 'Tablero operativo de habitaciones (Sucia, En Limpieza, Inspeccionada, Bloqueada) y conteo de lencería/minibar.',
      monthlyAddonUsd: 32000,
      actionButtonLabel: 'Actualizar Estado de Habitación',
      tableHeaders: ['Habitación', 'Camarera Asignada', 'Estado Limpieza', 'Novedad Minibar / Lencería', 'Hora Liberación'],
      fields: [
        { key: 'roomCode', label: 'Habitación / Cabaña', type: 'text', placeholder: 'Habitación 304' },
        { key: 'staffAssigned', label: 'Camarera / Auxiliar Asignado', type: 'text', placeholder: 'Luz Marina Pineda' },
        { key: 'cleaningState', label: 'Estado de Ama de Llaves', type: 'select', options: ['Inspeccionada — Lista para Check-In', 'Sucia (Salida Reciente)', 'En Proceso de Limpieza', 'Fuera de Servicio / Mantenimiento'] },
        { key: 'minibarReport', label: 'Consumo Minibar / Novedad', type: 'text', placeholder: '2x Agua Cristal + 1x Chocolatina (Cargado a Folio)' },
      ],
    },
    {
      moduleKey: 'mod-tickets',
      parentServiceKey: 'srv-hotel',
      externalSubmoduleName: 'Pasadías, Eventos y Tickets de Acceso QR',
      tabIcon: '🎫',
      summary: 'Expedición de pases de día (Day Pass), acceso a piscina/zonas húmedas y validación QR en portería.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Emitir Pase / Ticket QR',
      tableHeaders: ['N° Ticket', 'Categoría', 'Visitante / Comprador', 'Código QR', 'Tarifa', 'Estado Portería'],
      fields: [
        { key: 'ticketCategory', label: 'Categoría de Ticket', type: 'select', options: ['Pasadía Adulto (Incluye Almuerzo)', 'Pasadía Niño', 'Ticket Parqueadero / Evento'] },
        { key: 'visitorName', label: 'Nombre del Visitante', type: 'text', placeholder: 'Santiago Ospina' },
        { key: 'qrToken', label: 'Código QR de Control', type: 'text', placeholder: 'QR-PK-88412', requiredFeatureKey: 'comp-qr-ticket' },
        { key: 'ticketPrice', label: 'Valor del Ticket ($ COP)', type: 'number', placeholder: '85000' },
      ],
    },
  ],
  features: [
    {
      componentKey: 'comp-qr-ticket',
      externalName: 'Validador QR de ticket en portería',
      description: 'Genera y valida token QR único para control de acceso en eventos, pasadías y parqueaderos.',
      parentModuleKey: 'mod-tickets',
      includedByDefault: true,
      monthlyAddonUsd: 19000,
    },
  ],
};
