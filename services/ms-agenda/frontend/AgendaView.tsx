import React, { useState, useEffect, useCallback } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkAutoCodeInput,
  PkSelect,
  PkModal,
  PkConfirmModal,
  PkPrintButton,
  PkKpiRow,
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

export const AgendaView: React.FC = () => {
  const { hasService, apiGet, apiPost, apiDelete, toast } = usePlatform();
  const { busy, run } = useAsyncAction();

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

  return (
    <ModuleGate module="calendario_citas">
      <PkKpiRow
        items={[
          { label: 'Citas Activas', value: String(appointments.length), color: 'var(--pk-primary)' },
          { label: 'Citas para Hoy', value: String(todayCount), color: 'var(--pk-emerald)' },
          { label: 'Profesionales / Recursos', value: String(resources.length), color: 'var(--pk-amber)' },
          { label: 'Próximo Consecutivo', value: nextCode, color: '#0f172a' },
        ]}
      />

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📅 Programar Cita o Reserva</div>
          <div className="pk-row-actions">
            {clientesEnabled && customers.length > 0 && (
              <button
                type="button"
                className="pk-btn pk-btn-outline pk-btn-sm"
                onClick={() => setUseManualClient((v) => !v)}
              >
                {useManualClient ? '👥 Elegir del Directorio' : '✍️ Ingreso Directo Paciente/Cliente'}
              </button>
            )}
            <button
              type="button"
              className="pk-btn pk-btn-outline pk-btn-sm"
              onClick={() => setResourceModalOpen(true)}
            >
              + Nuevo Profesional / Recurso
            </button>
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportCsv}>
              📥 Exportar CSV
            </button>
          </div>
        </div>
        <div className="pk-card-body">
          <form onSubmit={handleSchedule} className="pk-form-grid">
            <PkAutoCodeInput label="Código Cita" value={nextCode} />

            <PkSelect
              label="Profesional / Recurso *"
              items={resources}
              value={resourceId}
              onChange={setResourceId}
              getValue={(r) => r.id}
              getLabel={(r) => `${r.code} — ${r.name} (${r.specialty})`}
              onCreateNew={() => setResourceModalOpen(true)}
              createLabel="+ Nuevo Profesional / Recurso"
              searchable
            />

            {showClientDirectory ? (
              <PkSelect
                label="Cliente / Paciente *"
                items={customers}
                value={customerId}
                onChange={setCustomerId}
                getValue={(c) => c.id}
                getLabel={(c) => `${c.name} (${c.nit})`}
                searchable
              />
            ) : (
              <>
                <div className="pk-field">
                  <label>Nombre Cliente / Paciente *</label>
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
                  <label>Teléfono Contacto</label>
                  <input
                    value={manualCustomerPhone}
                    onChange={(e) => setManualCustomerPhone(e.target.value)}
                    placeholder="Ej: 3154409980"
                  />
                </div>
              </>
            )}

            <div className="pk-field">
              <label>Fecha y Hora *</label>
              <input
                required
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
              />
            </div>

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
              <label>Observaciones</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Preparación previa o indicaciones"
              />
            </div>

            <div className="pk-field">
              <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                {busy ? 'Agendando...' : '🕒 Agendar Cita'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📋 Agenda de Citas Programadas ({appointments.length})</div>
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
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                      No hay citas programadas en la agenda actual.
                    </td>
                  </tr>
                ) : (
                  appointments.map((apt) => (
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

      <PkModal
        open={resourceModalOpen}
        title="👨‍⚕️ Nuevo Profesional / Recurso de Agenda"
        onClose={() => setResourceModalOpen(false)}
      >
        <form onSubmit={handleCreateResource} className="pk-form-grid">
          <PkAutoCodeInput label="Código Recurso" value={nextResourceCode} />
          <div className="pk-field">
            <label>Nombre Profesional / Sala / Recurso *</label>
            <input
              required
              value={resName}
              onChange={(e) => setResName(e.target.value)}
              placeholder="Ej: Dr. Alejandro Vega / Consultorio 2"
            />
          </div>
          <div className="pk-field">
            <label>Especialidad / Área</label>
            <input
              value={resSpecialty}
              onChange={(e) => setResSpecialty(e.target.value)}
              placeholder="Ej: Odontología / Asesoría Técnica"
            />
          </div>
          <div className="pk-field">
            <label>Teléfono Directo</label>
            <input
              value={resPhone}
              onChange={(e) => setResPhone(e.target.value)}
              placeholder="Ej: 3115508899"
            />
          </div>
          <div className="pk-field">
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
