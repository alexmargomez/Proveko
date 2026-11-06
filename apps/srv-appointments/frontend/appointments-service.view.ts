import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

export const SRV_APPOINTMENTS_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-appointments',
  externalPrincipalModuleName: 'Agenda y Citas',
  icon: '📅',
  subtitle: 'Agendamiento de citas, horarios de profesionales y sala de espera.',
  standaloneMonthlyUsd: 119000,
  submodules: [
    {
      moduleKey: 'mod-calendar-slots',
      parentServiceKey: 'srv-appointments',
      externalSubmoduleName: 'Agenda de Citas',
      tabIcon: '📅',
      summary: '',
      monthlyAddonUsd: 39000,
      actionButtonLabel: '+ Agendar Cita',
      tableHeaders: ['Código', 'Fecha y Hora', 'Cliente / Paciente', 'Profesional', 'Servicio', 'Estado', 'Acciones'],
      fields: [
        { key: 'slotDateTime', label: 'Fecha y Hora', type: 'text', placeholder: 'Mañana 10:00 AM' },
        { key: 'patientOrClient', label: 'Cliente / Paciente', type: 'text', placeholder: 'María Fernanda López' },
        { key: 'professionalAssigned', label: 'Profesional / Especialista', type: 'text', placeholder: 'Dr. Alejandro Martínez' },
        { key: 'serviceProcedure', label: 'Motivo / Servicio', type: 'text', placeholder: 'Consulta General / Valoración' },
      ],
    },
    {
      moduleKey: 'mod-staff-schedules',
      parentServiceKey: 'srv-appointments',
      externalSubmoduleName: 'Horarios de Profesionales',
      tabIcon: '🕒',
      summary: '',
      monthlyAddonUsd: 29000,
      actionButtonLabel: '+ Guardar Horario',
      tableHeaders: ['ID', 'Profesional', 'Días de Atención', 'Horario', 'Consultorio / Sede', 'Estado', 'Acciones'],
      fields: [
        { key: 'staffName', label: 'Profesional', type: 'text', placeholder: 'Dra. Carolina Gómez' },
        { key: 'workDays', label: 'Días de Atención', type: 'text', placeholder: 'Lunes a Viernes' },
        { key: 'shiftHours', label: 'Horario', type: 'text', placeholder: '08:00 AM a 05:00 PM' },
      ],
    },
    {
      moduleKey: 'mod-queue-turnador',
      parentServiceKey: 'srv-appointments',
      externalSubmoduleName: 'Turnos y Sala de Espera',
      tabIcon: '🔔',
      summary: '',
      monthlyAddonUsd: 25000,
      actionButtonLabel: '+ Llamar Turno',
      tableHeaders: ['Turno', 'Cliente / Paciente', 'Módulo / Consultorio', 'Profesional', 'Estado', 'Acciones'],
      fields: [
        { key: 'turnCode', label: 'Turno', type: 'text', placeholder: 'A-015' },
        { key: 'waitingPerson', label: 'Nombre', type: 'text', placeholder: 'Jorge Iván Cano' },
        { key: 'deskRoom', label: 'Consultorio / Módulo', type: 'text', placeholder: 'Consultorio 2' },
      ],
    },
  ],
  features: [
    { componentKey: 'comp-overbooking-guard', parentServiceKey: 'srv-appointments', externalName: 'Bloqueo de Cruce de Horarios', description: 'Evita citas duplicadas.', monthlyAddonUsd: 15000 },
    { componentKey: 'comp-whatsapp-ai-reschedule', parentServiceKey: 'srv-appointments', externalName: 'Recordatorio por WhatsApp', description: 'Envía confirmación de cita.', monthlyAddonUsd: 19000 },
  ],
};
