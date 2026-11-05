import type { ModuleUiSchemaDefinition } from '../../../domain/contracts/module-ui-schema.contract.js';

export const HOTEL_MODULE_SCHEMAS: Readonly<Record<string, ModuleUiSchemaDefinition>> = {
  'ms:hotel-rooms': {
    microserviceKey: 'ms:hotel-rooms',
    moduleNotation: 'mod:hotel-rooms',
    parentService: 'srv:hotel',
    title: 'Rack de Habitaciones, Tarifas por Noche y Housekeeping',
    badge: 'Prefijo SQL: hrm_',
    description:
      'Inventario físico de habitaciones, suites y cabañas con tarifa base por noche y estado de ama de llaves.',
    listEndpoint: '/api/v1/hotel/rooms/rooms',
    createEndpoint: '/api/v1/hotel/rooms/rooms',
    createButtonLabel: 'Registrar Habitación en el Rack',
    responseCollectionPath: 'rooms',
    kpis: [
      { label: 'Estado Ama Llaves', value: 'AVAILABLE / DIRTY', badgeTone: 'emerald', subtext: 'Sincronización recepción' },
      { label: 'Tarifa Base', value: 'NUMERIC(19,4)', badgeTone: 'blue', subtext: 'Tarifa oficial por noche' },
      { label: 'Esquema DB', value: 'srv_hotel.hrm_*', badgeTone: 'slate', subtext: 'Rack por propiedad' },
    ],
    formFields: [
      { name: 'roomNumber', label: 'Número de Habitación', type: 'text', defaultValue: 'HAB-302' },
      {
        name: 'category',
        label: 'Categoría de Alojamiento',
        type: 'select',
        defaultValue: 'SUITE',
        options: [
          { value: 'STANDARD', label: 'Estándar Ejecutiva (STANDARD)' },
          { value: 'DELUXE', label: 'Deluxe Superior (DELUXE)' },
          { value: 'SUITE', label: 'Suite Presidencial (SUITE)' },
        ],
      },
      { name: 'nightlyRateFixed4', label: 'Tarifa por Noche ($)', type: 'decimal', defaultValue: '420000.0000' },
    ],
    columns: [
      { key: 'roomNumber', header: 'Habitación', format: 'code' },
      { key: 'category', header: 'Categoría', format: 'badge' },
      { key: 'housekeepingStatus', header: 'Estado Rack', format: 'badge' },
      { key: 'nightlyRateFixed4', header: 'Tarifa / Noche', format: 'tabular-currency' },
    ],
    defaultPayload: {
      roomNumber: 'HAB-302',
      category: 'SUITE',
      nightlyRateFixed4: '420000.0000',
    },
  },
  'ms:hotel-bookings': {
    microserviceKey: 'ms:hotel-bookings',
    moduleNotation: 'mod:hotel-bookings',
    parentService: 'srv:hotel',
    title: 'Motor de Reservas de Alojamiento y Estadías',
    badge: 'Prefijo SQL: bkg_',
    description:
      'Confirmación de reservas por huésped con cálculo exacto de estadía total (noches × tarifa).',
    listEndpoint: '/api/v1/hotel/bookings/reservations',
    createEndpoint: '/api/v1/hotel/bookings/reservations',
    createButtonLabel: 'Confirmar Reserva de Huésped',
    responseCollectionPath: 'reservations',
    kpis: [
      { label: 'Liquidación Estadía', value: 'Noches × Tarifa', badgeTone: 'emerald', subtext: 'Exactitud de 4 decimales' },
      { label: 'Estado Reserva', value: 'CONFIRMED', badgeTone: 'blue', subtext: 'Lista para Check-In' },
      { label: 'Esquema DB', value: 'srv_hotel.bkg_*', badgeTone: 'slate', subtext: 'Historial de reservas' },
    ],
    formFields: [
      { name: 'guestContactId', label: 'ID Huésped / Tercero', type: 'text', defaultValue: 'cnt-huesped-901' },
      { name: 'roomNumber', label: 'Habitación Asignada', type: 'text', defaultValue: 'HAB-302' },
      { name: 'nightsCount', label: 'Cantidad de Noches', type: 'integer', defaultValue: 3 },
      { name: 'nightlyRateFixed4', label: 'Tarifa Pactada por Noche ($)', type: 'decimal', defaultValue: '420000.0000' },
    ],
    columns: [
      { key: 'id', header: 'ID Reserva', format: 'code' },
      { key: 'guestContactId', header: 'Huésped', format: 'code' },
      { key: 'roomNumber', header: 'Habitación', format: 'code' },
      { key: 'nightsCount', header: 'Noches', format: 'code' },
      { key: 'status', header: 'Estado', format: 'badge' },
      { key: 'totalStayFixed4', header: 'Total Estadía', format: 'tabular-currency' },
    ],
    defaultPayload: {
      guestContactId: 'cnt-huesped-901',
      roomNumber: 'HAB-302',
      nightsCount: 3,
      nightlyRateFixed4: '420000.0000',
    },
  },
  'ms:hotel-frontdesk': {
    microserviceKey: 'ms:hotel-frontdesk',
    moduleNotation: 'mod:hotel-frontdesk',
    parentService: 'srv:hotel',
    title: 'Recepción Hotelera (Check-In, Folios de Huésped y Check-Out)',
    badge: 'Prefijo SQL: fdk_',
    description:
      'Cargos de alojamiento, restaurante y minibar a la cuenta corriente (folio) de la habitación activa.',
    listEndpoint: '/api/v1/hotel/frontdesk/folios',
    createEndpoint: '/api/v1/hotel/frontdesk/folios/post-charge',
    createButtonLabel: 'Cargar Consumo al Folio de Habitación',
    responseCollectionPath: 'folios',
    kpis: [
      { label: 'Cuenta Huésped', value: 'Folio Consolidado', badgeTone: 'emerald', subtext: 'Alojamiento + Minibar + POS' },
      { label: 'Auditoría Nocturna', value: 'NUMERIC(19,4)', badgeTone: 'blue', subtext: 'Cero descuadres al Check-Out' },
      { label: 'Esquema DB', value: 'srv_hotel.fdk_*', badgeTone: 'slate', subtext: 'Folios abiertos en sede' },
    ],
    formFields: [
      { name: 'roomNumber', label: 'Número de Habitación', type: 'text', defaultValue: 'HAB-302' },
      { name: 'currentBalance', label: 'Saldo Actual del Folio ($)', type: 'decimal', defaultValue: '1260000.0000' },
      { name: 'newChargeAmount', label: 'Nuevo Cargo (Room Service / Minibar) ($)', type: 'decimal', defaultValue: '85000.0000' },
    ],
    columns: [
      { key: 'roomNumber', header: 'Habitación', format: 'code' },
      { key: 'branchId', header: 'Sede Hotel', format: 'code' },
      { key: 'updatedFolioBalance', header: 'Saldo Acumulado Folio', format: 'tabular-currency' },
    ],
    defaultPayload: {
      roomNumber: 'HAB-302',
      currentBalance: '1260000.0000',
      newChargeAmount: '85000.0000',
    },
  },
};
