import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

/**
 * Frontend interno del Microservicio `srv-ticketing` (Módulo Principal: Taquilla QR, Eventos y Mesa PQRSF SLA).
 */
export const SRV_TICKETING_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-ticketing',
  externalPrincipalModuleName: 'Taquilla QR, Eventos y Mesa PQRSF SLA',
  icon: '🎫',
  subtitle: 'Venta de boletería/covers con código QR antifraude, control de aforo en torniquetes y mesa PQRSF con SLA en días hábiles.',
  standaloneMonthlyUsd: 130000,
  submodules: [
    {
      moduleKey: 'mod-event-tickets',
      parentServiceKey: 'srv-ticketing',
      externalSubmoduleName: 'Taquilla, Covers, Palcos y Preventa QR',
      tabIcon: '🎟️',
      summary: 'Emisión de entradas generales, VIP y palcos con consumo mínimo incluido y código QR único criptográfico.',
      monthlyAddonUsd: 45000,
      actionButtonLabel: 'Emitir Ticket / Cover QR',
      tableHeaders: ['N° Ticket', 'Categoría / Palco', 'Visitante / Comprador', 'Código QR', 'Tarifa ($ COP)'],
      fields: [
        { key: 'ticketCategory', label: 'Categoría de Ticket / Localidad', type: 'select', options: ['Cover General Noche', 'Palco VIP (Incluye Consumo)', 'Preventa Evento Especial', 'Pase Parqueadero'] },
        { key: 'visitorName', label: 'Nombre del Asistente / Comprador', type: 'text', placeholder: 'Santiago Ospina' },
        {
          key: 'qrToken',
          label: 'Código QR Criptográfico de Control',
          type: 'text',
          placeholder: 'QR-PK-88412',
          requiredFeatureKey: 'comp-anti-clone-qr-gate',
        },
        { key: 'ticketPrice', label: 'Valor del Ticket ($ COP)', type: 'number', placeholder: '65000' },
      ],
    },
    {
      moduleKey: 'mod-gate-scanner',
      parentServiceKey: 'srv-ticketing',
      externalSubmoduleName: 'Escáner de Puerta, Torniquetes y Aforo en Vivo',
      tabIcon: '🚧',
      summary: 'Control de acceso en tiempo real por portería, contador de ocupación máxima legal y lista de cortesías.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Validar Ingreso en Portería',
      tableHeaders: ['Portería / Acceso', 'Evento Activo', 'Ingresos Validados', 'Aforo Máximo', 'Estado Puerta'],
      fields: [
        { key: 'gateCode', label: 'Punto de Acceso / Torniquete', type: 'select', options: ['Portería Principal Calle 85', 'Acceso VIP Palcos', 'Portería Vehicular'] },
        { key: 'eventName', label: 'Evento / Noche Activa', type: 'text', placeholder: 'Sábado Concierto en Vivo' },
        { key: 'checkedInCount', label: 'Asistentes Dentro del Recinto', type: 'number', placeholder: '340' },
        { key: 'maxCapacity', label: 'Aforo Legal Permitido', type: 'number', placeholder: '450' },
      ],
    },
    {
      moduleKey: 'mod-pqrsf-helpdesk',
      parentServiceKey: 'srv-ticketing',
      externalSubmoduleName: 'Mesa de Ayuda PQRSF y SLA Días Hábiles (Ley 1755)',
      tabIcon: '🛎️',
      summary: 'Radicación de Peticiones, Quejas, Reclamos y Solicitudes con semáforo de vencimiento en días hábiles de Colombia.',
      monthlyAddonUsd: 45000,
      actionButtonLabel: 'Radicar Caso PQRSF',
      tableHeaders: ['Radicado PQRSF', 'Tipo (P/Q/R/S/F)', 'Solicitante', 'Días Hábiles SLA', 'Estado Trámite'],
      fields: [
        { key: 'radicadoNumber', label: 'Número de Radicado Oficial', type: 'text', placeholder: 'PQRS-2026-00914' },
        { key: 'requestType', label: 'Tipología Ley 1755', type: 'select', options: ['Petición (15 días hábiles)', 'Queja de Servicio (15 días hábiles)', 'Reclamo de Facturación / Garantía', 'Solicitud de Información (10 días hábiles)'] },
        { key: 'petitionerName', label: 'Nombre del Solicitante y Correo', type: 'text', placeholder: 'Marcela Quintero — marcela@cliente.co' },
        { key: 'businessDaysLeft', label: 'Días Hábiles Restantes (Sin Festivos)', type: 'number', placeholder: '12' },
      ],
    },
  ],
  features: [
    {
      componentKey: 'comp-anti-clone-qr-gate',
      externalName: 'Generador y validador QR criptográfico anti-clonación en torniquetes',
      description: 'Invalida el token QR en milisegundos tras la primera lectura en puerta para impedir reingresos.',
      parentModuleKey: 'mod-event-tickets',
      includedByDefault: true,
      monthlyAddonUsd: 19000,
    },
    {
      componentKey: 'comp-sla-business-days',
      externalName: 'Calculadora SLA con festivos oficiales de Colombia (Ley Emiliani)',
      description: 'Descuenta domingos y festivos oficiales de Colombia al calcular términos legales de respuesta PQRSF.',
      parentModuleKey: 'mod-pqrsf-helpdesk',
      includedByDefault: true,
      monthlyAddonUsd: 19000,
    },
  ],
};
