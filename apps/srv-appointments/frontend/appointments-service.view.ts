import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

/**
 * Frontend interno del Microservicio `srv-appointments` (Módulo Principal: Agendamiento, Turnos y Recordatorios IA v2).
 * Inspirado en `hc_version2` (`Agenda`, `Cita`, `Turnos`) y `Proyecto Raíz del Río`.
 */
export const SRV_APPOINTMENTS_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-appointments',
  externalPrincipalModuleName: 'Agendamiento, Turnos y Recordatorios IA (v2)',
  icon: '📅',
  subtitle: 'Motor de agendas multi-profesional y consultorios/recursos estilo v2, recordatorios interactivos WhatsApp IA y turnador.',
  standaloneMonthlyUsd: 135000,
  submodules: [
    {
      moduleKey: 'mod-calendar-slots',
      parentServiceKey: 'srv-appointments',
      externalSubmoduleName: 'Agenda Multi-Profesional y Recursos (v2)',
      tabIcon: '🗓️',
      summary: 'Calendario por bloques horarios, asignación de sala/consultorio/bahía, control de inasistencias y estados de cita.',
      monthlyAddonUsd: 45000,
      actionButtonLabel: 'Agendar Cita / Bloque Horario',
      tableHeaders: ['Código Cita', 'Cliente / Usuario', 'Profesional / Recurso', 'Fecha y Hora', 'Servicio Programado'],
      fields: [
        { key: 'appointmentCode', label: 'Código de Cita', type: 'text', placeholder: 'CIT-2026-0412' },
        { key: 'customerName', label: 'Cliente / Usuario y WhatsApp', type: 'text', placeholder: 'Laura Valentina Ríos — 315 884 1200' },
        { key: 'specialistResource', label: 'Profesional y Sala / Consultorio', type: 'select', options: ['Dr. Alejandro Mejía — Consultorio 201', 'Esp. Camila Pineda — Cabina 02', 'Ing. Mateo Gómez — Bahía Diagnóstico 01'] },
        { key: 'slotDateTime', label: 'Fecha y Bloque Horario', type: 'text', placeholder: '2026-11-12 09:30 AM (45 min)' },
        { key: 'serviceName', label: 'Servicio / Procedimiento Agendado', type: 'text', placeholder: 'Valoración Especializada Integral' },
      ],
    },
    {
      moduleKey: 'mod-staff-schedules',
      parentServiceKey: 'srv-appointments',
      externalSubmoduleName: 'Mallas Horarias, Bloqueos y Excepciones',
      tabIcon: '⏰',
      summary: 'Configuración de turnos semanales por especialista, vacaciones, permisos y tiempos de alistamiento.',
      monthlyAddonUsd: 35000,
      actionButtonLabel: 'Publicar Malla Horaria',
      tableHeaders: ['Especialista', 'Sede / Consultorio', 'Franja Horaria', 'Duración Bloque (min)', 'Estado Malla'],
      fields: [
        { key: 'specialistName', label: 'Profesional / Especialista', type: 'text', placeholder: 'Dr. Alejandro Mejía' },
        { key: 'branchRoom', label: 'Sede y Recurso Físico', type: 'select', options: ['Sede Principal — Consultorio 201', 'Sede Norte — Sala Especial 03', 'Atención Virtual Teleconsulta'] },
        { key: 'workDaysSchedule', label: 'Días y Franja Horaria', type: 'text', placeholder: 'Lunes a Viernes 07:00 AM - 05:00 PM' },
        { key: 'slotDurationMin', label: 'Duración por Cita (Minutos)', type: 'number', placeholder: '30' },
      ],
    },
    {
      moduleKey: 'mod-interactive-reminders',
      parentServiceKey: 'srv-appointments',
      externalSubmoduleName: 'Recordatorios Interactivos WhatsApp / Email',
      tabIcon: '💬',
      summary: 'Envío automatizado 24h y 2h antes con botones interactivos para Confirmar, Cancelar o Reprogramar en vivo.',
      monthlyAddonUsd: 39000,
      actionButtonLabel: 'Disparar Recordatorio Interactivo',
      tableHeaders: ['Envío #', 'Destinatario', 'Canal', 'Respuesta Cliente', 'Estado Cupo'],
      fields: [
        { key: 'notificationCode', label: 'Código de Notificación', type: 'text', placeholder: 'WSP-2026-8812' },
        { key: 'customerName', label: 'Cliente y Teléfono', type: 'text', placeholder: 'Laura Valentina Ríos — +57 3158841200' },
        { key: 'channel', label: 'Canal de Recordatorio', type: 'select', options: ['WhatsApp Interactivo IA (24h/2h)', 'Correo Electrónico + ICS', 'SMS Transaccional'] },
        { key: 'clientResponse', label: 'Acción del Usuario', type: 'select', options: ['Confirmada por WhatsApp', 'Solicitó Reprogramar', 'Cancelada — Cupo Liberado'] },
      ],
    },
    {
      moduleKey: 'mod-queue-turnador',
      parentServiceKey: 'srv-appointments',
      externalSubmoduleName: 'Sala de Espera, Check-In QR y Turnador TV',
      tabIcon: '📺',
      summary: 'Registro de llegada en kiosco o QR, llamado en pantalla de sala de espera por módulo y métrica de espera.',
      monthlyAddonUsd: 35000,
      actionButtonLabel: 'Llamar Siguiente Turno en Pantalla',
      tableHeaders: ['Turno Sala', 'Cliente en Espera', 'Módulo / Consultorio', 'Espera (Min)', 'Estado Llamado'],
      fields: [
        { key: 'turnTicket', label: 'Código de Turno', type: 'text', placeholder: 'A-042 (Prioritario)' },
        { key: 'customerName', label: 'Nombre en Sala de Espera', type: 'text', placeholder: 'Jorge Enrique Vargas' },
        { key: 'deskModule', label: 'Consultorio / Ventanilla que Llama', type: 'select', options: ['Consultorio 201', 'Recepción Admisiones 01', 'Sala de Procedimientos 02'] },
        { key: 'waitingMinutes', label: 'Minutos en Sala de Espera', type: 'number', placeholder: '8' },
      ],
    },
  ],
  features: [
    {
      componentKey: 'comp-overbooking-guard',
      externalName: 'Candado anti-cruce de profesional y consultorio/sala',
      description: 'Bloquea colisiones simultáneas de especialista o recurso físico al reservar o reprogramar citas.',
      parentModuleKey: 'mod-calendar-slots',
      includedByDefault: true,
      monthlyAddonUsd: 19000,
    },
    {
      componentKey: 'comp-whatsapp-ai-reschedule',
      externalName: 'Auto-reprogramación conversacional por WhatsApp IA',
      description: 'Libera el cupo automáticamente al cancelar y ofrece 3 nuevos horarios disponibles al cliente.',
      parentModuleKey: 'mod-interactive-reminders',
      includedByDefault: true,
      monthlyAddonUsd: 25000,
    },
  ],
};
