import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkAutoCodeInput,
  PkSelect,
  PkSimpleSelect,
  PkModal,
  PkConfirmModal,
  PkPrintButton,
  PkKpiRow,
  PkLiveHeader,
  PkKanbanBoard,
  PkTicketCard,
  PkProcessNodes,
  PkTypeCards,
  PkFullscreenDialog,
  PkProgressBar,
  PkProcessStep,
  useAsyncAction,
  downloadCsvUtf8,
} from '@platform/ui-sdk';

interface ProfResource {
  id: string;
  code: string;
  name: string;
  specialty: string;
  phone: string;
  active: boolean;
  createdAt: string;
}

interface Appointment {
  id: string;
  code: string;
  resourceId: string;
  resourceName: string;
  resourceSpecialty: string;
  customerId: string;
  customerName: string;
  customerNit: string;
  customerPhone: string;
  dateTime: string;
  serviceName: string;
  notes: string;
  status: string;
  createdAt: string;
}

interface ExternalCustomerItem {
  id: string;
  name: string;
  nit: string;
  phone?: string;
}

interface AgendaAllResponse {
  ok: boolean;
  nextCode: string;
  nextResourceCode: string;
  resources: ProfResource[];
  appointments: Appointment[];
}

interface ClientesAllResponse {
  ok?: boolean;
  customers?: ExternalCustomerItem[];
}

type AppointmentModalType = 'valoracion' | 'procedimiento' | 'recurso';

const APPOINTMENT_TYPE_CARDS = [
  {
    key: 'valoracion',
    icon: '🩺',
    title: 'Consulta / Valoración Individual',
    description: 'Atención personalizada con especialista, control periódico o asesoría profesional.',
    badge: 'Consulta',
  },
  {
    key: 'procedimiento',
    icon: '⚡',
    title: 'Procedimiento Especializado',
    description: 'Intervención programada, sesión terapéutica o diagnóstico con indicaciones previas.',
    badge: 'Especial',
  },
  {
    key: 'recurso',
    icon: '🏛️',
    title: 'Reserva de Sala o Recurso',
    description: 'Bloqueo programado de consultorio, sala ejecutiva o equipamiento técnico.',
    badge: 'Espacio',
  },
];

const QUICK_SERVICES_BY_TYPE: Record<AppointmentModalType, { label: string; service: string; note: string }[]> = {
  valoracion: [
    { label: '🩺 Valoración Inicial', service: 'Consulta de Valoración Inicial Especializada', note: 'Asistir 10 minutos antes con documento de identidad' },
    { label: '📋 Control y Seguimiento', service: 'Cita de Control y Revisión de Resultados', note: 'Traer soportes o estudios previos' },
    { label: '💼 Asesoría Ejecutiva', service: 'Sesión de Consultoría Personalizada', note: 'Revisión integral de caso' },
  ],
  procedimiento: [
    { label: '⚡ Sesión Especializada', service: 'Procedimiento Ambulatorio Programado', note: 'Confirmar preparación previa 24h antes' },
    { label: '🔬 Examen Diagnóstico', service: 'Toma de Estudio / Diagnóstico Técnico', note: 'Seguir protocolo de preparación indicado' },
    { label: '💆 Terapia Integral', service: 'Sesión de Rehabilitación / Tratamiento', note: 'Asistir con ropa cómoda' },
  ],
  recurso: [
    { label: '🏛️ Reserva Consultorio', service: 'Reserva Operativa de Consultorio / Cabina', note: 'Alistamiento de instrumental incluido' },
    { label: '🖥️ Sala de Juntas / Equipos', service: 'Asignación de Sala Técnica y Equipos', note: 'Verificar disponibilidad de conectividad' },
  ],
};

const DAILY_SLOT_TARGET = 8;

export const AgendaView: React.FC = () => {
  const { hasService, apiGet, apiPost, apiDelete, toast } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [displayMode, setDisplayMode] = useState<'board' | 'table'>('board');
  const [studioOpen, setStudioOpen] = useState(false);
  const [appointmentType, setAppointmentType] = useState<AppointmentModalType>('valoracion');

  const [timePillFilter, setTimePillFilter] = useState<'ALL' | 'TODAY' | 'UPCOMING'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');

  const [nextCode, setNextCode] = useState('CIT-602');
  const [nextResourceCode, setNextResourceCode] = useState('RES-103');
  const [resources, setResources] = useState<ProfResource[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<ExternalCustomerItem[]>([]);

  const [resourceId, setResourceId] = useState('');
  const [useManualClient, setUseManualClient] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualCustomerNit, setManualCustomerNit] = useState('');
  const [manualCustomerPhone, setManualCustomerPhone] = useState('');
  const [dateTime, setDateTime] = useState(() => {
    const d = new Date(Date.now() + 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [serviceName, setServiceName] = useState('');
  const [notes, setNotes] = useState('');

  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [resName, setResName] = useState('');
  const [resSpecialty, setResSpecialty] = useState('Consultoría Especializada');
  const [resPhone, setResPhone] = useState('');

  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);

  const clientesEnabled = hasService('ms-clientes');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<AgendaAllResponse>('/api/v1/agenda/all');
      const resList = data.resources || [];
      setNextCode(data.nextCode || 'CIT-602');
      setNextResourceCode(data.nextResourceCode || 'RES-103');
      setResources(resList);
      setAppointments(data.appointments || []);
      setResourceId((prev) => (prev && resList.some((r) => r.id === prev) ? prev : resList[0]?.id || ''));
    } catch {
      // Handled by platform session layer
    }

    if (clientesEnabled) {
      try {
        const cliData = await apiGet<ClientesAllResponse>('/api/v1/clientes/all');
        const cliList = cliData.customers || [];
        setCustomers(cliList);
        setCustomerId((prev) => (prev && cliList.some((c) => c.id === prev) ? prev : cliList[0]?.id || ''));
      } catch {
        setCustomers([]);
      }
    } else {
      setCustomers([]);
    }
  }, [apiGet, clientesEnabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const showClientDirectory = clientesEnabled && customers.length > 0 && !useManualClient;

  const openStudioForResource = (preselectedResourceId?: string) => {
    if (preselectedResourceId) {
      setResourceId(preselectedResourceId);
    }
    setStudioOpen(true);
  };

  const handleAppointmentTypeChange = (key: string) => {
    const next = key as AppointmentModalType;
    setAppointmentType(next);
    const preset = QUICK_SERVICES_BY_TYPE[next]?.[0];
    if (preset && !serviceName.trim()) {
      setServiceName(preset.service);
      setNotes(preset.note);
    }
  };

  const handleCreateResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resName.trim()) {
      toast('Ingresa el nombre del profesional o recurso.');
      return;
    }
    void run(async () => {
      const resp = await apiPost<{ ok: boolean; resource: ProfResource }>('/api/v1/agenda/resources', {
        name: resName.trim(),
        specialty: resSpecialty.trim() || 'Especialista General',
        phone: resPhone.trim(),
      });
      toast('Profesional o recurso agregado a la agenda.');
      setResName('');
      setResPhone('');
      setResourceModalOpen(false);
      await reload();
      if (resp?.resource?.id) {
        setResourceId(resp.resource.id);
      }
    });
  };

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceId || !dateTime || !serviceName.trim()) {
      toast('Selecciona el profesional/recurso, la fecha/hora y el motivo de la cita.');
      return;
    }

    let resolvedCustomerId = '';
    let resolvedCustomerName = manualCustomerName.trim();
    let resolvedCustomerNit = manualCustomerNit.trim();
    let resolvedCustomerPhone = manualCustomerPhone.trim();

    if (showClientDirectory) {
      const found = customers.find((c) => c.id === customerId);
      if (!found) {
        toast('Selecciona un cliente del directorio o activa el ingreso directo.');
        return;
      }
      resolvedCustomerId = found.id;
      resolvedCustomerName = found.name;
      resolvedCustomerNit = found.nit;
      resolvedCustomerPhone = found.phone || '';
    } else if (!resolvedCustomerName) {
      toast('Ingresa el nombre completo del cliente o paciente.');
      return;
    }

    void run(async () => {
      await apiPost('/api/v1/agenda/appointments', {
        resourceId,
        customerId: resolvedCustomerId,
        customerName: resolvedCustomerName,
        customerNit: resolvedCustomerNit,
        customerPhone: resolvedCustomerPhone,
        dateTime,
        serviceName: serviceName.trim(),
        notes: notes.trim(),
      });
      toast('Cita programada correctamente.');
      setServiceName('');
      setNotes('');
      if (!showClientDirectory) {
        setManualCustomerName('');
        setManualCustomerNit('');
        setManualCustomerPhone('');
      }
      setStudioOpen(false);
      await reload();
    });
  };

  const handleConfirmCancel = () => {
    if (!cancelTarget) return;
    const target = cancelTarget;
    void run(async () => {
      await apiDelete(`/api/v1/agenda/appointments/${encodeURIComponent(target.id)}`);
      toast(`Cita ${target.code} cancelada y horario liberado.`);
      setCancelTarget(null);
      await reload();
    });
  };

  const handleExportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsvUtf8(
      `agenda_citas_${stamp}.csv`,
      ['Codigo', 'Fecha Hora', 'Cliente', 'Documento', 'Telefono', 'Profesional', 'Especialidad', 'Servicio', 'Estado'],
      appointments.map((a) => [
        a.code,
        a.dateTime,
        a.customerName,
        a.customerNit,
        a.customerPhone,
        a.resourceName,
        a.resourceSpecialty,
        a.serviceName,
        a.status,
      ])
    );
    toast('Agenda exportada en formato CSV.');
  };

  const buildAppointmentReceipt = (apt: Appointment): Record<string, unknown> => ({
    document_type: 'COMPROBANTE DE CITA Y RESERVA',
    layout_variant: 'media_carta',
    document_number: apt.code,
    issue_date: apt.createdAt,
    customer_name: apt.customerName,
    customer_nit: apt.customerNit,
    customer_phone: apt.customerPhone,
    extra_fields: {
      'Fecha y Hora Programada': apt.dateTime,
      'Profesional / Recurso': apt.resourceName,
      Especialidad: apt.resourceSpecialty,
      Estado: apt.status,
    },
    items: [
      {
        code: apt.code,
        description: `${apt.serviceName}${apt.notes ? ` — Observaciones: ${apt.notes}` : ''}`,
        quantity: 1,
        unit_price: 0,
        tax_pct: 0,
        subtotal: 0,
      },
    ],
    grand_total: 0,
    notes: 'Por favor presentarse 10 minutos antes de la hora asignada.',
  });

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayCount = appointments.filter((a) => a.dateTime.startsWith(todayPrefix)).length;
  const upcomingCount = Math.max(0, appointments.length - todayCount);

  const filteredAppointments = useMemo(
    () =>
      appointments.filter((apt) => {
        const isToday = apt.dateTime.startsWith(todayPrefix);
        if (timePillFilter === 'TODAY' && !isToday) return false;
        if (timePillFilter === 'UPCOMING' && isToday) return false;
        if (resourceFilter && apt.resourceId !== resourceFilter) return false;

        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          apt.code.toLowerCase().includes(q) ||
          apt.customerName.toLowerCase().includes(q) ||
          (apt.customerNit || '').toLowerCase().includes(q) ||
          apt.resourceName.toLowerCase().includes(q) ||
          apt.serviceName.toLowerCase().includes(q)
        );
      }),
    [appointments, todayPrefix, timePillFilter, resourceFilter, searchQuery]
  );

  const todayLaneAppointments = filteredAppointments.filter((a) => a.dateTime.startsWith(todayPrefix));
  const upcomingLaneAppointments = filteredAppointments.filter((a) => !a.dateTime.startsWith(todayPrefix));
  const visibleResources = useMemo(
    () => (resourceFilter ? resources.filter((r) => r.id === resourceFilter) : resources),
    [resources, resourceFilter]
  );

  const buildAppointmentNodes = (isToday: boolean): PkProcessStep[] => [
    { step: 1, label: 'Reserva', status: 'done' },
    { step: 2, label: isToday ? 'En Sala / Hoy' : 'Programada', status: isToday ? 'active' : 'pending' },
    { step: 3, label: 'Atención', status: 'pending' },
  ];

  const renderAppointmentCard = (apt: Appointment) => {
    const isToday = apt.dateTime.startsWith(todayPrefix);
    const formattedClock = apt.dateTime.includes('T') ? apt.dateTime.replace('T', ' · ') : apt.dateTime;

    return (
      <PkTicketCard
        key={apt.id}
        code={apt.code}
        timeAgo={`🕒 ${formattedClock}`}
        channelBadge={{
          label: isToday ? '⏰ Para Hoy' : '📅 Próxima',
          tone: isToday ? 'amber' : 'blue',
        }}
        title={`👤 ${apt.customerName}`}
        subtitle={`${apt.customerNit ? `Doc: ${apt.customerNit} · ` : ''}📞 ${apt.customerPhone || 'Sin teléfono'}`}
        metaLine={`🩺 ${apt.resourceName} (${apt.resourceSpecialty})`}
        items={[{ qty: 1, name: apt.serviceName }]}
        highlightNote={apt.notes || undefined}
        processNodes={buildAppointmentNodes(isToday)}
        statusPill={{ label: apt.status || 'Confirmada', tone: 'emerald' }}
        secondaryActions={
          <>
            <PkPrintButton label="🖨️ Comprobante" payload={buildAppointmentReceipt(apt)} />
            <button
              type="button"
              className="pk-btn pk-btn-danger pk-btn-sm"
              onClick={() => setCancelTarget(apt)}
              disabled={busy}
            >
              ✕ Cancelar
            </button>
          </>
        }
      />
    );
  };

  const selectedStudioResource = resources.find((r) => r.id === resourceId);

  return (
    <ModuleGate module="calendario_citas">
      <div className="pk-stack">
        <PkKpiRow
          items={[
            { label: 'Citas Activas', value: String(appointments.length), color: 'var(--pk-primary)' },
            { label: 'En Agenda para Hoy', value: String(todayCount), color: 'var(--pk-emerald)' },
            { label: 'Consultorios y Especialistas', value: String(resources.length), color: 'var(--pk-amber)' },
            { label: 'Próximo Consecutivo', value: nextCode, color: '#0f172a' },
          ]}
        />

        {resources.length > 0 && (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🩺 Ocupación Diaria por Especialista y Consultorio</div>
              {resourceFilter && (
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  onClick={() => setResourceFilter('')}
                >
                  Mostrar Todos
                </button>
              )}
            </div>
            <div className="pk-card-body">
              <div className="pk-grid-3">
                {resources.map((res) => {
                  const resTotal = appointments.filter((a) => a.resourceId === res.id).length;
                  const resToday = appointments.filter(
                    (a) => a.resourceId === res.id && a.dateTime.startsWith(todayPrefix)
                  ).length;
                  const loadPct = Math.min(100, Math.round((Math.max(resToday, resTotal) / DAILY_SLOT_TARGET) * 100));
                  const isFiltered = resourceFilter === res.id;

                  return (
                    <div
                      key={res.id}
                      onClick={() => setResourceFilter(isFiltered ? '' : res.id)}
                      style={{
                        border: isFiltered ? '2px solid var(--pk-primary)' : '1px solid var(--pk-border)',
                        background: isFiltered ? '#f0f7ff' : '#ffffff',
                        borderRadius: 12,
                        padding: 14,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: 13.5, color: 'var(--pk-navy)' }}>{res.name}</strong>
                        <span className="pk-badge pk-badge-blue">{res.code}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>
                        {res.specialty} {res.phone ? `· 📞 ${res.phone}` : ''}
                      </div>
                      <PkProgressBar
                        label={`Hoy: ${resToday} · Total: ${resTotal}`}
                        valueLabel={`${Math.max(resToday, resTotal)}/${DAILY_SLOT_TARGET} cupos`}
                        pct={loadPct}
                        tone={loadPct >= 85 ? 'amber' : 'emerald'}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <PkLiveHeader
          title="Central de Citas y Consultorios"
          liveLabel="Agenda en vivo"
          subtitle="Coordina la atención diaria en sala, próximas fechas programadas y disponibilidad por especialista o recurso."
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          boardLabel="🎛️ Tablero de Atención"
          tableLabel="📋 Vista Tabla"
          primaryActionLabel="+ Programar Cita"
          onPrimaryAction={() => openStudioForResource()}
          pills={[
            { key: 'ALL', label: 'Todas', count: appointments.length },
            { key: 'TODAY', label: 'Para Hoy', count: todayCount },
            { key: 'UPCOMING', label: 'Próximas', count: upcomingCount },
          ]}
          activePill={timePillFilter}
          onPillChange={(k) => setTimePillFilter(k as 'ALL' | 'TODAY' | 'UPCOMING')}
          extraActions={
            <>
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                onClick={() => setResourceModalOpen(true)}
              >
                + Nuevo Profesional / Recurso
              </button>
              <button type="button" className="pk-btn pk-btn-outline" onClick={handleExportCsv}>
                📥 Exportar CSV
              </button>
            </>
          }
        />

        <div className="pk-card" style={{ padding: '12px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
            <input
              className="pk-input pk-datatable-search"
              style={{ flex: 1, minWidth: 260 }}
              placeholder="🔎 Buscar por código de cita, paciente/cliente, documento, especialista o motivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 270 }}>
                <PkSimpleSelect
                  ariaLabel="Filtrar por profesional o recurso"
                  value={resourceFilter}
                  onChange={setResourceFilter}
                  allowClear
                  placeholder="Todos los profesionales y recursos"
                  options={[
                    { value: '', label: 'Todos los profesionales y recursos' },
                    ...resources.map((r) => ({
                      value: r.id,
                      label: `${r.code} — ${r.name}`,
                      sublabel: r.specialty,
                    })),
                  ]}
                />
              </div>
              <span className="pk-badge pk-badge-slate">{filteredAppointments.length} citas</span>
            </div>
          </div>
        </div>

        {displayMode === 'board' ? (
          <PkKanbanBoard
            columns={[
              {
                key: 'today',
                title: 'Para Hoy / En Sala',
                dotColor: 'amber',
                count: todayLaneAppointments.length,
                emptyText: 'Sin citas programadas para la jornada de hoy',
                children: todayLaneAppointments.map(renderAppointmentCard),
              },
              {
                key: 'upcoming',
                title: 'Próximas Fechas',
                dotColor: 'blue',
                count: upcomingLaneAppointments.length,
                emptyText: 'No hay reservas futuras con este filtro',
                children: upcomingLaneAppointments.map(renderAppointmentCard),
              },
              {
                key: 'resources',
                title: 'Recursos y Consultorios Activos',
                dotColor: 'purple',
                count: visibleResources.length,
                emptyText: 'Registra un profesional o consultorio para habilitar agenda',
                children: visibleResources.map((res) => {
                  const resCount = appointments.filter((a) => a.resourceId === res.id).length;
                  const pct = Math.min(100, Math.round((resCount / DAILY_SLOT_TARGET) * 100));
                  return (
                    <PkTicketCard
                      key={res.id}
                      code={res.code}
                      timeAgo={res.active ? 'Habilitado en agenda' : 'Inactivo'}
                      channelBadge={{ label: res.specialty, tone: 'purple' }}
                      title={res.name}
                      subtitle={res.phone ? `📞 Contacto directo: ${res.phone}` : 'Consultorio / Recurso institucional'}
                      extraBody={
                        <PkProgressBar
                          label="Cupos asignados"
                          valueLabel={`${resCount} cita(s)`}
                          pct={pct}
                          tone="purple"
                        />
                      }
                      statusPill={{ label: 'Disponible para Agendar', tone: 'emerald' }}
                      primaryAction={{
                        label: '📅 Agendar con este Recurso',
                        tone: 'purple',
                        disabled: busy,
                        onClick: () => openStudioForResource(res.id),
                      }}
                    />
                  );
                }),
              },
            ]}
          />
        ) : (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">📋 Agenda Tabular de Citas Programadas</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Fecha y Hora</th>
                      <th>Cliente / Paciente</th>
                      <th>Teléfono</th>
                      <th>Profesional / Recurso</th>
                      <th>Servicio / Motivo</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                          {appointments.length === 0
                            ? 'No hay citas programadas todavía. Haz clic en "+ Programar Cita" para crear una nueva reserva.'
                            : 'No se encontraron citas con el filtro seleccionado.'}
                        </td>
                      </tr>
                    ) : (
                      filteredAppointments.map((apt) => (
                        <tr key={apt.id}>
                          <td>
                            <span className="pk-badge pk-badge-blue">{apt.code}</span>
                          </td>
                          <td style={{ fontWeight: 800 }}>{apt.dateTime}</td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{apt.customerName}</div>
                            {apt.customerNit && (
                              <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{apt.customerNit}</div>
                            )}
                          </td>
                          <td>{apt.customerPhone || '—'}</td>
                          <td>
                            <div style={{ fontWeight: 700 }}>{apt.resourceName}</div>
                            <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{apt.resourceSpecialty}</div>
                          </td>
                          <td>
                            <div>{apt.serviceName}</div>
                            {apt.notes && (
                              <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{apt.notes}</div>
                            )}
                          </td>
                          <td>
                            <span className="pk-badge pk-badge-emerald">{apt.status}</span>
                          </td>
                          <td>
                            <div className="pk-row-actions">
                              <PkPrintButton label="🖨️ Comprobante" payload={buildAppointmentReceipt(apt)} />
                              <button
                                type="button"
                                className="pk-btn pk-btn-danger pk-btn-sm"
                                onClick={() => setCancelTarget(apt)}
                                disabled={busy}
                              >
                                ✕ Cancelar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <PkFullscreenDialog
        open={studioOpen}
        title="Estudio de Agendamiento de Citas y Consultorios"
        subtitle="Elige el tipo de reserva, asigna especialista o sala y genera comprobante inmediato."
        badge={{ label: nextCode, tone: 'blue' }}
        onClose={() => setStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="1. Modalidad de Atención o Reserva"
            options={APPOINTMENT_TYPE_CARDS}
            value={appointmentType}
            onChange={handleAppointmentTypeChange}
            disabled={busy}
          />
        }
        footerLeft={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--pk-muted)', fontWeight: 700 }}>CITA</div>
              <div style={{ fontWeight: 900, color: 'var(--pk-navy)' }}>{nextCode}</div>
            </div>
            {selectedStudioResource && (
              <span className="pk-badge pk-badge-blue">
                🩺 {selectedStudioResource.name} ({selectedStudioResource.specialty})
              </span>
            )}
            <span className="pk-badge pk-badge-emerald">🕒 {dateTime.replace('T', ' ')}</span>
          </div>
        }
        footerActions={
          <>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setStudioOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="agenda-appointment-studio-form"
              className="pk-btn pk-btn-primary"
              disabled={busy}
            >
              {busy ? 'Agendando...' : '🕒 Confirmar y Programar Cita'}
            </button>
          </>
        }
      >
        <form id="agenda-appointment-studio-form" onSubmit={handleSchedule} className="pk-stack">
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">2. Horario y Asignación de Especialista / Consultorio</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid">
                <PkAutoCodeInput label="Código Cita" value={nextCode} />

                <div className="pk-field">
                  <label>Fecha y Hora Programada *</label>
                  <input
                    required
                    type="datetime-local"
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                  />
                </div>

                <PkSelect
                  label="Profesional / Consultorio / Recurso *"
                  items={resources}
                  value={resourceId}
                  onChange={setResourceId}
                  getValue={(r) => r.id}
                  getLabel={(r) => `${r.code} — ${r.name} (${r.specialty})`}
                  onCreateNew={() => setResourceModalOpen(true)}
                  createLabel="+ Nuevo Profesional / Recurso"
                  searchable
                />
              </div>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                3. Identificación del {appointmentType === 'recurso' ? 'Solicitante / Responsable' : 'Paciente o Cliente'}
              </div>
              {clientesEnabled && customers.length > 0 && (
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  onClick={() => setUseManualClient((v) => !v)}
                >
                  {useManualClient ? '👥 Elegir del Directorio' : '✍️ Ingreso Directo Paciente/Cliente'}
                </button>
              )}
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid">
                {showClientDirectory ? (
                  <div className="pk-col-span-full">
                    <PkSelect
                      label="Cliente / Paciente Registrado *"
                      items={customers}
                      value={customerId}
                      onChange={setCustomerId}
                      getValue={(c) => c.id}
                      getLabel={(c) => `${c.name} (${c.nit})`}
                      searchable
                    />
                  </div>
                ) : (
                  <>
                    <div className="pk-field">
                      <label>Nombre Completo Cliente / Paciente *</label>
                      <input
                        required
                        value={manualCustomerName}
                        onChange={(e) => setManualCustomerName(e.target.value)}
                        placeholder="Ej: Mariana López Giraldo"
                      />
                    </div>
                    <div className="pk-field">
                      <label>Documento / NIT</label>
                      <input
                        value={manualCustomerNit}
                        onChange={(e) => setManualCustomerNit(e.target.value)}
                        placeholder="Ej: 1020778410"
                      />
                    </div>
                    <div className="pk-field">
                      <label>Teléfono Móvil Contacto</label>
                      <input
                        value={manualCustomerPhone}
                        onChange={(e) => setManualCustomerPhone(e.target.value)}
                        placeholder="Ej: 3154409980"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">4. Motivo de Atención, Servicio e Indicaciones Previas</div>
            </div>
            <div className="pk-card-body pk-stack">
              <div>
                <div className="pk-label" style={{ marginBottom: 8 }}>Motivos frecuentes para esta modalidad</div>
                <div className="pk-row-actions">
                  {QUICK_SERVICES_BY_TYPE[appointmentType].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="pk-btn pk-btn-outline pk-btn-sm"
                      onClick={() => {
                        setServiceName(preset.service);
                        setNotes(preset.note);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pk-form-grid cols-2">
                <div className="pk-field">
                  <label>Motivo / Servicio Solicitado *</label>
                  <input
                    required
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="Ej: Valoración especializada"
                  />
                </div>

                <div className="pk-field">
                  <label>Observaciones e Indicaciones al Paciente</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Preparación previa o recomendaciones"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </PkFullscreenDialog>

      <PkModal
        open={resourceModalOpen}
        title="👨‍⚕️ Nuevo Profesional / Recurso de Agenda"
        onClose={() => setResourceModalOpen(false)}
        maxWidth={640}
      >
        <form onSubmit={handleCreateResource} className="pk-form-grid cols-2">
          <PkAutoCodeInput label="Código Recurso" value={nextResourceCode} />
          <div className="pk-field">
            <label>Teléfono Directo</label>
            <input
              value={resPhone}
              onChange={(e) => setResPhone(e.target.value)}
              placeholder="Ej: 3115508899"
            />
          </div>
          <div className="pk-field pk-col-span-full">
            <label>Nombre Profesional / Sala / Recurso *</label>
            <input
              required
              value={resName}
              onChange={(e) => setResName(e.target.value)}
              placeholder="Ej: Dr. Alejandro Vega / Consultorio 2"
            />
          </div>
          <div className="pk-field pk-col-span-full">
            <label>Especialidad / Área</label>
            <input
              value={resSpecialty}
              onChange={(e) => setResSpecialty(e.target.value)}
              placeholder="Ej: Odontología / Asesoría Técnica"
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setResourceModalOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              {busy ? 'Guardando...' : '💾 Guardar Recurso'}
            </button>
          </div>
        </form>
      </PkModal>

      <PkConfirmModal
        open={Boolean(cancelTarget)}
        title="Cancelar Cita Programada"
        message={
          cancelTarget
            ? `¿Deseas cancelar la cita ${cancelTarget.code} de ${cancelTarget.customerName} programada para el ${cancelTarget.dateTime} con ${cancelTarget.resourceName}?`
            : ''
        }
        confirmLabel="Confirmar Cancelación"
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
        busy={busy}
      />
    </ModuleGate>
  );
};

export default AgendaView;
