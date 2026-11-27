import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkAutoCodeInput,
  PkSelect,
  PkSimpleSelect,
  PkViewSwitcher,
  PkModal,
  PkPrintButton,
  PkKpiRow,
  useAsyncAction,
  formatCop,
  downloadCsvUtf8,
} from '@platform/ui-sdk';

interface TicketingEvent {
  id: string;
  code: string;
  name: string;
  venue: string;
  eventDate: string;
  zone: string;
  basePrice: number;
  capacity: number;
  soldCount: number;
  createdAt: string;
}

interface Ticket {
  id: string;
  code: string;
  eventId: string;
  eventName: string;
  zone: string;
  customerId: string;
  customerName: string;
  customerNit: string;
  qty: number;
  unitPrice: number;
  total: number;
  paymentMethod: string;
  createdAt: string;
}

interface TaquillaAllResponse {
  ok: boolean;
  nextCode: string;
  nextEventCode: string;
  events: TicketingEvent[];
  tickets: Ticket[];
}

interface RemoteCustomer {
  id: string;
  name: string;
  nit: string;
}

const TICKET_ZONE_OPTIONS = [
  { value: 'General', label: 'General' },
  { value: 'VIP / Preferencial', label: 'VIP / Preferencial' },
  { value: 'Palco Empresarial', label: 'Palco Empresarial' },
  { value: 'Cortesía Autorizada', label: 'Cortesía Autorizada' },
];

const EVENT_ZONE_OPTIONS = [
  { value: 'General', label: 'General' },
  { value: 'VIP / Preferencial', label: 'VIP / Preferencial' },
  { value: 'Palco Empresarial', label: 'Palco Empresarial' },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Tarjeta / Datáfono', label: 'Tarjeta / Datáfono' },
  { value: 'Transferencia QR', label: 'Transferencia QR' },
  { value: 'Cortesía', label: 'Cortesía' },
];

export const TaquillaView: React.FC = () => {
  const { apiGet, apiPost, toast, hasService } = usePlatform();
  const { run, busy } = useAsyncAction();

  const [viewMode, setViewMode] = useState<'list' | 'create'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState('');

  const [nextCode, setNextCode] = useState('TKT-5001');
  const [nextEventCode, setNextEventCode] = useState('EVT-3001');
  const [events, setEvents] = useState<TicketingEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [customers, setCustomers] = useState<RemoteCustomer[]>([]);

  const [selectedEventId, setSelectedEventId] = useState('');
  const [zone, setZone] = useState('General');
  const [qty, setQty] = useState('1');
  const [unitPrice, setUnitPrice] = useState('35000');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('Comprador Mostrador');
  const [customerNit, setCustomerNit] = useState('222222222222');

  const [showEventModal, setShowEventModal] = useState(false);
  const [evName, setEvName] = useState('');
  const [evVenue, setEvVenue] = useState('Escenario Principal');
  const [evDate, setEvDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [evZone, setEvZone] = useState('General');
  const [evPrice, setEvPrice] = useState('45000');
  const [evCapacity, setEvCapacity] = useState('150');

  const hasClientes = hasService('ms-clientes');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<TaquillaAllResponse>('/api/v1/taquilla/all');
      const evList = data.events || [];
      setNextCode(data.nextCode || 'TKT-5001');
      setNextEventCode(data.nextEventCode || 'EVT-3001');
      setEvents(evList);
      setTickets(data.tickets || []);

      setSelectedEventId((prev) => {
        if (prev && evList.some((item) => item.id === prev)) {
          return prev;
        }
        const first = evList[0];
        if (first) {
          setZone(first.zone || 'General');
          setUnitPrice(String(first.basePrice ?? 0));
          return first.id;
        }
        return '';
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No fue posible cargar la taquilla');
    }

    if (hasClientes) {
      try {
        const cliData = await apiGet<{ customers?: RemoteCustomer[] }>('/api/v1/clientes/all');
        setCustomers(cliData.customers || []);
      } catch {
        setCustomers([]);
      }
    }
  }, [apiGet, hasClientes, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeEvent = useMemo(
    () => events.find((ev) => ev.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const handleSelectEvent = (evId: string) => {
    setSelectedEventId(evId);
    const found = events.find((ev) => ev.id === evId);
    if (found) {
      setZone(found.zone || 'General');
      setUnitPrice(String(found.basePrice ?? 0));
    }
  };

  const handleSelectCustomer = (cliId: string) => {
    setSelectedCustomerId(cliId);
    const found = customers.find((c) => c.id === cliId);
    if (found) {
      setCustomerName(found.name);
      setCustomerNit(found.nit);
    } else {
      setCustomerName('Comprador Mostrador');
      setCustomerNit('222222222222');
    }
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = Number(evPrice);
    const numCap = Number(evCapacity);
    if (!evName.trim() || !Number.isFinite(numPrice) || numPrice < 0 || !Number.isFinite(numCap) || numCap < 1) {
      toast('Completa el nombre de la función, precio válido y aforo mayor a cero.');
      return;
    }
    void run(async () => {
      try {
        const res = await apiPost<{ ok: boolean; event: TicketingEvent }>('/api/v1/taquilla/events', {
          name: evName.trim(),
          venue: evVenue.trim(),
          eventDate: evDate,
          zone: evZone,
          basePrice: numPrice,
          capacity: Math.trunc(numCap),
        });
        toast(`Evento ${res.event.code} habilitado en taquilla`);
        setShowEventModal(false);
        setEvName('');
        await reload();
        if (res.event?.id) {
          setSelectedEventId(res.event.id);
          setZone(res.event.zone);
          setUnitPrice(String(res.event.basePrice));
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error creando evento');
      }
    });
  };

  const handleIssueTicket = (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = Number(qty);
    const numPrice = Number(unitPrice);
    if (!selectedEventId) {
      toast('Selecciona un evento o crea una función antes de emitir boletas.');
      return;
    }
    if (!Number.isInteger(numQty) || numQty < 1 || !Number.isFinite(numPrice) || numPrice < 0) {
      toast('Ingresa una cantidad entera mayor o igual a 1 y un precio válido.');
      return;
    }
    void run(async () => {
      try {
        await apiPost('/api/v1/taquilla/tickets', {
          eventId: selectedEventId,
          eventName: activeEvent?.name || '',
          zone,
          customerId: selectedCustomerId,
          customerName: customerName.trim() || 'Comprador Mostrador',
          customerNit: customerNit.trim() || '222222222222',
          qty: numQty,
          unitPrice: numPrice,
          paymentMethod,
        });
        toast('Boleta emitida y lista para impresión térmica 80mm');
        setQty('1');
        await reload();
        setViewMode('list');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible emitir la boleta');
      }
    });
  };

  const handleExportCsv = () => {
    downloadCsvUtf8(
      'taquilla_boletas.csv',
      [
        'Boleta',
        'Fecha',
        'Evento',
        'Localidad',
        'Comprador',
        'Documento',
        'Cantidad',
        'Precio Unitario',
        'Total',
        'Medio Pago',
      ],
      tickets.map((t) => [
        t.code,
        t.createdAt,
        t.eventName,
        t.zone,
        t.customerName,
        t.customerNit,
        t.qty,
        t.unitPrice,
        t.total,
        t.paymentMethod,
      ])
    );
  };

  const buildTicketPayload = (tkt: Ticket): Record<string, unknown> => ({
    document_type: 'BOLETA / TIQUETE DE ACCESO',
    layout_variant: 'tirilla_80mm',
    document_number: tkt.code,
    issue_date: tkt.createdAt,
    customer_name: tkt.customerName || 'Comprador Mostrador',
    customer_nit: tkt.customerNit || '',
    payment_method: tkt.paymentMethod || 'Efectivo',
    extra_fields: {
      Evento: tkt.eventName,
      Localidad: tkt.zone,
      'Entradas Autorizadas': String(tkt.qty),
    },
    items: [
      {
        code: tkt.code,
        description: `${tkt.eventName} — Localidad: ${tkt.zone}`,
        quantity: tkt.qty,
        unit_price: tkt.unitPrice,
        subtotal: tkt.total,
      },
    ],
    subtotal: tkt.total,
    grand_total: tkt.total,
    notes: 'Tiquete válido únicamente para la función y localidad indicadas. Conserve su colilla.',
  });

  const totalAdmissions = tickets.reduce((acc, t) => acc + Number(t.qty || 0), 0);
  const totalBoxOffice = tickets.reduce((acc, t) => acc + Number(t.total || 0), 0);
  const previewTotal = Math.max(0, Number(qty || 0)) * Math.max(0, Number(unitPrice || 0));
  const availableForSelected =
    activeEvent && activeEvent.capacity > 0 ? Math.max(0, activeEvent.capacity - activeEvent.soldCount) : null;

  const filteredTickets = tickets.filter((tkt) => {
    if (eventFilter && tkt.eventId !== eventFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      tkt.code.toLowerCase().includes(q) ||
      tkt.customerName.toLowerCase().includes(q) ||
      (tkt.customerNit || '').toLowerCase().includes(q) ||
      tkt.eventName.toLowerCase().includes(q) ||
      tkt.zone.toLowerCase().includes(q)
    );
  });

  return (
    <ModuleGate module="venta_boletas">
      <div className="pk-stack">
        <PkKpiRow
          items={[
            { label: 'Funciones Activas', value: String(events.length), color: 'var(--pk-primary)' },
            { label: 'Entradas Emitidas', value: String(totalAdmissions), color: 'var(--pk-emerald)' },
            { label: 'Recaudo Taquilla', value: formatCop(totalBoxOffice), color: '#0f172a' },
            { label: 'Próxima Boleta', value: nextCode, color: 'var(--pk-amber)' },
          ]}
        />

        <PkViewSwitcher
          title="Taquilla de Eventos y Emisión de Boletas"
          subtitle="Controla el aforo por localidad, revisa las boletas emitidas en el turno y despacha nuevas entradas."
          mode={viewMode}
          onModeChange={setViewMode}
          listLabel="🧾 Boletas y Cartelera"
          createLabel="+ Emitir Boleta"
          count={tickets.length}
          extraActions={
            <>
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                onClick={() => setShowEventModal(true)}
              >
                + Crear Función
              </button>
              {viewMode === 'list' && (
                <button type="button" className="pk-btn pk-btn-outline" onClick={handleExportCsv}>
                  📥 Exportar CSV
                </button>
              )}
            </>
          }
        />

        {viewMode === 'create' ? (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🎟️ Taquilla Ágil — Emisión de Boletas y Control de Aforo</div>
              <div className="pk-row-actions">
                {availableForSelected !== null && (
                  <span className={`pk-badge ${availableForSelected > 0 ? 'pk-badge-blue' : 'pk-badge-amber'}`}>
                    Cupos Disponibles: {availableForSelected} / {activeEvent?.capacity}
                  </span>
                )}
                <span className="pk-badge pk-badge-emerald">Total a Cobrar: {formatCop(previewTotal)}</span>
              </div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleIssueTicket} className="pk-form-grid cols-2">
                <PkAutoCodeInput label="Consecutivo Boleta" value={nextCode} />

                <PkSelect
                  label="Evento / Función *"
                  items={events}
                  value={selectedEventId}
                  onChange={handleSelectEvent}
                  getValue={(ev) => ev.id}
                  getLabel={(ev) =>
                    `${ev.name} [${ev.zone}] (${
                      ev.capacity > 0 ? `${Math.max(0, ev.capacity - ev.soldCount)} disp.` : 'Libre'
                    })`
                  }
                  emptyLabel="-- Seleccionar función --"
                  onCreateNew={() => setShowEventModal(true)}
                  createLabel="+ Nuevo Evento"
                  searchable
                />

                <PkSimpleSelect
                  label="Localidad / Zona"
                  value={zone}
                  onChange={setZone}
                  options={TICKET_ZONE_OPTIONS}
                />

                {hasClientes && customers.length > 0 && (
                  <PkSelect
                    label="Cliente Registrado (Opcional)"
                    items={customers}
                    value={selectedCustomerId}
                    onChange={handleSelectCustomer}
                    getValue={(c) => c.id}
                    getLabel={(c) => `${c.name} (${c.nit})`}
                    emptyLabel="Comprador Mostrador"
                    searchable
                  />
                )}

                <div className="pk-field">
                  <label>Nombre Comprador *</label>
                  <input
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Comprador Mostrador"
                  />
                </div>

                <div className="pk-field">
                  <label>NIT / Documento</label>
                  <input
                    value={customerNit}
                    onChange={(e) => setCustomerNit(e.target.value)}
                    placeholder="222222222222"
                  />
                </div>

                <div className="pk-field">
                  <label>Cantidad Entradas *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>

                <div className="pk-field">
                  <label>Precio Unitario ($) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                  />
                </div>

                <PkSimpleSelect
                  label="Medio de Pago"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={PAYMENT_METHOD_OPTIONS}
                />

                <div className="pk-form-actions">
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setViewMode('list')}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                    {busy ? 'Emitiendo...' : '🎟️ Emitir Boleta'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="pk-stack">
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🧾 Boletas Emitidas en Turno ({tickets.length})</div>
              </div>
              <div className="pk-datatable-toolbar">
                <input
                  className="pk-input pk-datatable-search"
                  placeholder="🔎 Buscar boleta por código, comprador, documento o evento..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 260 }}>
                    <PkSimpleSelect
                      ariaLabel="Filtrar por función o evento"
                      value={eventFilter}
                      onChange={setEventFilter}
                      allowClear
                      placeholder="Todas las funciones"
                      options={[
                        { value: '', label: 'Todas las funciones' },
                        ...events.map((ev) => ({
                          value: ev.id,
                          label: `${ev.code} — ${ev.name}`,
                          sublabel: ev.zone,
                        })),
                      ]}
                    />
                  </div>
                  <span className="pk-badge pk-badge-slate">{filteredTickets.length} boletas</span>
                </div>
              </div>
              <div className="pk-card-body">
                <div className="pk-table-wrap">
                  <table className="pk-table">
                    <thead>
                      <tr>
                        <th>Boleta</th>
                        <th>Fecha / Hora</th>
                        <th>Comprador</th>
                        <th>Evento / Función</th>
                        <th>Localidad</th>
                        <th>Cant.</th>
                        <th>Unitario</th>
                        <th>Total</th>
                        <th>Tirilla 80mm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                            {tickets.length === 0
                              ? 'Aún no se han emitido boletas en el turno actual. Haz clic en "+ Emitir Boleta" para registrar una venta.'
                              : 'No se encontraron boletas con el criterio aplicado.'}
                          </td>
                        </tr>
                      ) : (
                        filteredTickets.map((tkt) => (
                          <tr key={tkt.id}>
                            <td>
                              <span className="pk-badge pk-badge-amber">{tkt.code}</span>
                            </td>
                            <td>{tkt.createdAt}</td>
                            <td style={{ fontWeight: 700 }}>{tkt.customerName}</td>
                            <td>{tkt.eventName}</td>
                            <td>
                              <span className="pk-badge pk-badge-blue">{tkt.zone}</span>
                            </td>
                            <td style={{ fontWeight: 800 }}>{tkt.qty}</td>
                            <td>{formatCop(tkt.unitPrice)}</td>
                            <td style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>
                              {formatCop(tkt.total)}
                            </td>
                            <td>
                              <PkPrintButton label="🖨️ Tirilla 80mm" payload={buildTicketPayload(tkt)} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🎭 Cartelera y Control de Aforo ({events.length})</div>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  onClick={() => setShowEventModal(true)}
                >
                  + Crear Función
                </button>
              </div>
              <div className="pk-card-body">
                <div className="pk-table-wrap">
                  <table className="pk-table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Evento / Función</th>
                        <th>Escenario</th>
                        <th>Fecha</th>
                        <th>Localidad</th>
                        <th>Tarifa Base</th>
                        <th>Vendidas / Aforo</th>
                        <th>Disponibles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev) => {
                        const avail = ev.capacity > 0 ? Math.max(0, ev.capacity - ev.soldCount) : null;
                        return (
                          <tr key={ev.id}>
                            <td>
                              <span className="pk-badge pk-badge-blue">{ev.code}</span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{ev.name}</td>
                            <td>{ev.venue || '—'}</td>
                            <td>{ev.eventDate || '—'}</td>
                            <td>{ev.zone}</td>
                            <td>{formatCop(ev.basePrice)}</td>
                            <td>
                              {ev.soldCount} / {ev.capacity > 0 ? ev.capacity : '∞'}
                            </td>
                            <td>
                              <span
                                className={`pk-badge ${avail === 0 ? 'pk-badge-amber' : 'pk-badge-emerald'}`}
                              >
                                {avail === null ? 'Libre' : avail === 0 ? 'Agotado' : `${avail} cupos`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <PkModal
        open={showEventModal}
        title="Programar Nuevo Evento / Función"
        onClose={() => setShowEventModal(false)}
      >
        <form onSubmit={handleCreateEvent} className="pk-form-grid cols-2">
          <PkAutoCodeInput label="Código Evento" value={nextEventCode} />
          <div className="pk-field">
            <label>Nombre del Evento / Función *</label>
            <input
              required
              value={evName}
              onChange={(e) => setEvName(e.target.value)}
              placeholder="Ej: Concierto Acústico Nocturno"
            />
          </div>
          <div className="pk-field">
            <label>Escenario / Sala</label>
            <input
              value={evVenue}
              onChange={(e) => setEvVenue(e.target.value)}
              placeholder="Ej: Auditorio Principal"
            />
          </div>
          <div className="pk-field">
            <label>Fecha Función</label>
            <input type="date" value={evDate} onChange={(e) => setEvDate(e.target.value)} />
          </div>
          <PkSimpleSelect
            label="Localidad"
            value={evZone}
            onChange={setEvZone}
            options={EVENT_ZONE_OPTIONS}
          />
          <div className="pk-field">
            <label>Tarifa Base ($) *</label>
            <input
              required
              type="number"
              min="0"
              step="any"
              value={evPrice}
              onChange={(e) => setEvPrice(e.target.value)}
            />
          </div>
          <div className="pk-field pk-col-span-full">
            <label>Aforo Máximo (Cupos) *</label>
            <input
              required
              type="number"
              min="1"
              step="1"
              value={evCapacity}
              onChange={(e) => setEvCapacity(e.target.value)}
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setShowEventModal(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              {busy ? 'Guardando...' : 'Guardar Función'}
            </button>
          </div>
        </form>
      </PkModal>
    </ModuleGate>
  );
};

export default TaquillaView;
