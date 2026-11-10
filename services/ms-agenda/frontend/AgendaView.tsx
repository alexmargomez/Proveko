import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  ModuleGate,
  PkAutoCodeInput,
  PkEntitySelect,
  PkPrintButton,
  PkKpiRow,
  Customer,
  Worker,
  PrintDocumentPayload,
} from '@proveko/ui-sdk';

interface AppointmentRecord {
  id: string;
  createdAt: string;
  moduleKey: string;
  fields: Record<string, string>;
}

interface AgendaAllResponse {
  ok: boolean;
  nextCode: string;
  customers: Customer[];
  workers: Worker[];
  appointments: AppointmentRecord[];
}

export const AgendaView: React.FC = () => {
  const { apiGet, apiPost, apiDelete, toast, openQuickDialog, dialogVersion } = useProveko();

  const [nextCode, setNextCode] = useState('CIT-606');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [dateTime, setDateTime] = useState(() => {
    const d = new Date(Date.now() + 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [serviceName, setServiceName] = useState('');
  const [notes, setNotes] = useState('');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<AgendaAllResponse>('/api/v1/agenda/all');
      const custList = data.customers || [];
      const wkList = data.workers || [];

      setNextCode(data.nextCode || 'CIT-606');
      setCustomers(custList);
      setWorkers(wkList);
      setAppointments(data.appointments || []);

      setCustomerId((prev) => (prev && custList.some((c) => c.id === prev) ? prev : custList[0]?.id || ''));
      setWorkerId((prev) => (prev && wkList.some((w) => w.id === prev) ? prev : wkList[0]?.id || ''));
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void reload();
  }, [reload, dialogVersion]);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !dateTime || !serviceName.trim()) {
      toast('Selecciona cliente, fecha/hora y el motivo o servicio de la cita.');
      return;
    }
    await apiPost('/api/v1/agenda/appointments', {
      customerId,
      workerId,
      dateTime,
      serviceName,
      notes,
    });
    toast('Cita agendada correctamente');
    setServiceName('');
    setNotes('');
    await reload();
  };

  const handleCancel = async (id: string) => {
    await apiDelete(`/api/v1/agenda/appointments/${id}`);
    toast(`Cita ${id} cancelada`);
    await reload();
  };

  const buildAppointmentReceipt = (apt: AppointmentRecord): PrintDocumentPayload => ({
    document_type: 'COMPROBANTE DE CITA / RESERVA',
    layout_variant: 'media_carta',
    document_number: apt.id,
    issue_date: apt.createdAt,
    customer_name: apt.fields?.customerName || 'Cliente',
    customer_nit: apt.fields?.customerNit || '',
    customer_phone: apt.fields?.customerPhone || '',
    extra_fields: {
      'Fecha y Hora Programada': apt.fields?.dateTime || '',
      'Profesional / Especialista': apt.fields?.workerName || 'Por Asignar',
      Especialidad: apt.fields?.workerSpecialty || 'General',
      Estado: apt.fields?.status || 'Programada',
    },
    items: [
      {
        code: apt.id,
        description: `${apt.fields?.serviceName || 'Servicio Programado'}${
          apt.fields?.notes ? ` — Obs: ${apt.fields.notes}` : ''
        }`,
        quantity: 1,
        unit_price: 0,
        subtotal: 0,
      },
    ],
    grand_total: 0,
    notes: 'Por favor presentarse 10 minutos antes de la hora programada.',
  });

  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayCount = appointments.filter((a) => (a.fields?.dateTime || '').startsWith(todayPrefix)).length;

  return (
    <ModuleGate module="calendario_citas">
      <PkKpiRow
        items={[
          { label: 'Citas Activas', value: String(appointments.length), color: 'var(--pk-primary)' },
          { label: 'Citas para Hoy', value: String(todayCount), color: 'var(--pk-emerald)' },
          { label: 'Especialistas Disponibles', value: String(workers.length), color: 'var(--pk-amber)' },
          { label: 'Clientes Registrados', value: String(customers.length), color: '#0f172a' },
        ]}
      />

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📅 Programar Nueva Cita o Reserva</div>
        </div>
        <div className="pk-card-body">
          <form onSubmit={handleSchedule} className="pk-form-grid">
            <PkAutoCodeInput label="Código Cita" value={nextCode} />
            <PkEntitySelect
              label="Cliente / Paciente *"
              items={customers}
              value={customerId}
              onChange={setCustomerId}
              getValue={(c) => c.id}
              getLabel={(c) => `${c.name} (${c.nit})`}
              onCreateNew={() => openQuickDialog('nuevo-cliente', () => void reload())}
              createLabel="+ Nuevo Cliente"
              searchable
            />
            <PkEntitySelect
              label="Profesional / Especialista *"
              items={workers}
              value={workerId}
              onChange={setWorkerId}
              getValue={(w) => w.id}
              getLabel={(w) => `${w.name} — ${w.specialty}`}
            />
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
                placeholder="Ej: Valoración inicial / Diagnóstico especializado"
              />
            </div>
            <div className="pk-field">
              <label>Observaciones</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas opcionales o preparación previa"
              />
            </div>
            <div className="pk-field">
              <button type="submit" className="pk-btn pk-btn-primary">
                🕒 Agendar Cita
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
                  <th>Fecha / Hora Cita</th>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Profesional / Especialista</th>
                  <th>Motivo / Servicio</th>
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
                        <span className="pk-badge pk-badge-blue">{apt.id}</span>
                      </td>
                      <td style={{ fontWeight: 800 }}>{apt.fields?.dateTime}</td>
                      <td style={{ fontWeight: 700 }}>{apt.fields?.customerName}</td>
                      <td>{apt.fields?.customerPhone || '—'}</td>
                      <td>{apt.fields?.workerName}</td>
                      <td>
                        <div>{apt.fields?.serviceName}</div>
                        {apt.fields?.notes && (
                          <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{apt.fields.notes}</div>
                        )}
                      </td>
                      <td>
                        <span className="pk-badge pk-badge-emerald">{apt.fields?.status || 'Programada'}</span>
                      </td>
                      <td>
                        <div className="pk-row-actions">
                          <PkPrintButton label="🖨️ Comprobante Cita" payload={buildAppointmentReceipt(apt)} />
                          <button
                            type="button"
                            className="pk-btn pk-btn-danger pk-btn-sm"
                            onClick={() => void handleCancel(apt.id)}
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
    </ModuleGate>
  );
};
