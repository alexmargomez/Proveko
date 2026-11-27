import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkAutoCodeInput,
  PkSelect,
  PkSimpleSelect,
  PkModal,
  PkPrintButton,
  PkKpiRow,
  PkLiveHeader,
  PkTicketCard,
  PkTypeCards,
  PkFullscreenDialog,
  PkProgressBar,
  PkDistributionStrip,
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

const ZONE_TYPE_CARDS = [
  {
    key: 'Palco Empresarial',
    icon: '👑',
    title: 'VIP / Palco',
    description: 'Ubicación exclusiva numerada con mesa o servicio preferencial de palco.',
    badge: 'Exclusivo',
  },
  {
    key: 'VIP / Preferencial',
    icon: '💎',
    title: 'Platino / Preferencial',
    description: 'Zona central delantera con visibilidad privilegiada y acceso rápido.',
    badge: 'Preferencial',
  },
  {
    key: 'General',
    icon: '🎟️',
    title: 'General',
    description: 'Acceso estándar a gradería o platea general del escenario.',
    badge: 'Estándar',
  },
  {
    key: 'Cortesía Autorizada',
    icon: '🎁',
    title: 'Cortesía Autorizada',
    description: 'Pase institucional sin cobro en caja con descuento automático de aforo.',
    badge: '$0',
  },
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

  const [displayMode, setDisplayMode] = useState<'board' | 'table'>('board');
  const [boxOfficeStudioOpen, setBoxOfficeStudioOpen] = useState(false);

  const [zonePillFilter, setZonePillFilter] = useState('ALL');
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

  const handleZoneCardChange = (nextZone: string) => {
    setZone(nextZone);
    const base = activeEvent?.basePrice ?? 40000;
    if (nextZone === 'Cortesía Autorizada') {
      setUnitPrice('0');
      setPaymentMethod('Cortesía');
    } else {
      if (paymentMethod === 'Cortesía') {
        setPaymentMethod('Efectivo');
      }
      if (activeEvent && activeEvent.zone === nextZone) {
        setUnitPrice(String(base));
      } else if (nextZone === 'Palco Empresarial') {
        setUnitPrice(String(Math.round(base * 1.8)));
      } else if (nextZone === 'VIP / Preferencial') {
        setUnitPrice(String(Math.round(base * 1.35)));
      } else {
        setUnitPrice(String(base));
      }
    }
  };

  const openBoxOfficeStudio = (preselectedEvent?: TicketingEvent) => {
    if (preselectedEvent) {
      setSelectedEventId(preselectedEvent.id);
      setZone(preselectedEvent.zone || 'General');
      setUnitPrice(String(preselectedEvent.basePrice ?? 0));
      if (paymentMethod === 'Cortesía') {
        setPaymentMethod('Efectivo');
      }
    }
    setBoxOfficeStudioOpen(true);
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
        setBoxOfficeStudioOpen(false);
        await reload();
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
  const totalCapacity = events.reduce((acc, ev) => acc + Math.max(0, ev.capacity || 0), 0);
  const totalSoldSeats = events.reduce((acc, ev) => acc + Math.max(0, ev.soldCount || 0), 0);
  const totalRemainingSeats = Math.max(0, totalCapacity - totalSoldSeats);

  const qtyNumber = Math.max(1, Math.trunc(Number(qty || 1)));
  const previewTotal = Math.max(0, Number(qty || 0)) * Math.max(0, Number(unitPrice || 0));
  const availableForSelected =
    activeEvent && activeEvent.capacity > 0 ? Math.max(0, activeEvent.capacity - activeEvent.soldCount) : null;

  const filteredEvents = useMemo(
    () =>
      events.filter((ev) => {
        if (eventFilter && ev.id !== eventFilter) return false;
        if (zonePillFilter !== 'ALL' && ev.zone !== zonePillFilter) return false;
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          ev.name.toLowerCase().includes(q) ||
          ev.code.toLowerCase().includes(q) ||
          (ev.venue || '').toLowerCase().includes(q) ||
          ev.zone.toLowerCase().includes(q)
        );
      }),
    [events, eventFilter, zonePillFilter, searchQuery]
  );

  const filteredTickets = useMemo(
    () =>
      tickets.filter((tkt) => {
        if (eventFilter && tkt.eventId !== eventFilter) return false;
        if (zonePillFilter !== 'ALL' && tkt.zone !== zonePillFilter) return false;
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          tkt.code.toLowerCase().includes(q) ||
          tkt.customerName.toLowerCase().includes(q) ||
          (tkt.customerNit || '').toLowerCase().includes(q) ||
          tkt.eventName.toLowerCase().includes(q) ||
          tkt.zone.toLowerCase().includes(q)
        );
      }),
    [tickets, eventFilter, zonePillFilter, searchQuery]
  );

  const resolveCapacityTone = (pct: number): 'emerald' | 'amber' | 'rose' => {
    if (pct >= 90) return 'rose';
    if (pct >= 65) return 'amber';
    return 'emerald';
  };

  return (
    <ModuleGate module="venta_boletas">
      <div className="pk-stack">
        <PkKpiRow
          items={[
            { label: 'Funciones en Cartelera', value: String(events.length), color: 'var(--pk-primary)' },
            { label: 'Entradas Despachadas', value: String(totalAdmissions), color: 'var(--pk-emerald)' },
            { label: 'Recaudo Total Taquilla', value: formatCop(totalBoxOffice), color: '#0f172a' },
            { label: 'Próxima Boleta', value: nextCode, color: 'var(--pk-amber)' },
          ]}
        />

        {totalCapacity > 0 && (
          <PkDistributionStrip
            title="Ocupación Consolidada de Escenarios y Localidades"
            segments={[
              { label: 'Sillas / Cupos Vendidos', value: totalSoldSeats, displayValue: `${totalSoldSeats} entradas`, color: '#2563eb' },
              { label: 'Aforo Disponible en Taquilla', value: totalRemainingSeats, displayValue: `${totalRemainingSeats} libres`, color: '#10b981' },
            ]}
          />
        )}

        <PkLiveHeader
          title="Taquilla y Aforo de Eventos"
          liveLabel="Taquilla activa"
          subtitle="Supervisa el llenado en vivo de cada función, controla cupos por localidad y emite boletas térmicas al instante."
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          boardLabel="🎛️ Cartelera y Boletas"
          tableLabel="📋 Vista Tabla"
          primaryActionLabel="+ Emitir Boletas"
          onPrimaryAction={() => openBoxOfficeStudio()}
          pills={[
            { key: 'ALL', label: 'Todas las Localidades', count: tickets.length },
            { key: 'Palco Empresarial', label: '👑 VIP / Palco', count: tickets.filter((t) => t.zone === 'Palco Empresarial').length },
            { key: 'VIP / Preferencial', label: '💎 Preferencial', count: tickets.filter((t) => t.zone === 'VIP / Preferencial').length },
            { key: 'General', label: '🎟️ General', count: tickets.filter((t) => t.zone === 'General').length },
            { key: 'Cortesía Autorizada', label: '🎁 Cortesías', count: tickets.filter((t) => t.zone === 'Cortesía Autorizada').length },
          ]}
          activePill={zonePillFilter}
          onPillChange={setZonePillFilter}
          extraActions={
            <>
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                onClick={() => setShowEventModal(true)}
              >
                + Crear Función
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
              placeholder="🔎 Buscar por código de boleta, evento, escenario, localidad o comprador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 270 }}>
                <PkSimpleSelect
                  ariaLabel="Filtrar por función o evento"
                  value={eventFilter}
                  onChange={setEventFilter}
                  allowClear
                  placeholder="Todas las funciones en cartelera"
                  options={[
                    { value: '', label: 'Todas las funciones en cartelera' },
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
        </div>

        {displayMode === 'board' ? (
          <div className="pk-stack">
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🎭 Cartelera en Vivo y Medidores de Aforo ({filteredEvents.length})</div>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  onClick={() => setShowEventModal(true)}
                >
                  + Programar Nueva Función
                </button>
              </div>
              <div className="pk-card-body">
                {filteredEvents.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 24 }}>
                    No hay funciones activas que coincidan con el filtro actual.
                  </div>
                ) : (
                  <div className="pk-cards-showcase">
                    {filteredEvents.map((ev) => {
                      const cap = Math.max(0, ev.capacity || 0);
                      const sold = Math.max(0, ev.soldCount || 0);
                      const avail = cap > 0 ? Math.max(0, cap - sold) : null;
                      const pct = cap > 0 ? Math.min(100, Math.round((sold / cap) * 100)) : 0;
                      const meterTone = resolveCapacityTone(pct);
                      const soldOut = avail === 0;

                      return (
                        <PkTicketCard
                          key={ev.id}
                          code={ev.code}
                          timeAgo={`📅 ${ev.eventDate || 'Fecha abierta'} · 📍 ${ev.venue || 'Escenario Principal'}`}
                          channelBadge={{
                            label: ev.zone,
                            tone: ev.zone.includes('Palco') ? 'purple' : ev.zone.includes('VIP') ? 'blue' : 'emerald',
                          }}
                          title={ev.name}
                          subtitle={`Escenario: ${ev.venue || 'Principal'}`}
                          items={[
                            { name: 'Tarifa base localidad', amount: formatCop(ev.basePrice) },
                            {
                              name: 'Cupos disponibles',
                              amount: avail === null ? 'Aforo libre' : `${avail} de ${cap}`,
                            },
                          ]}
                          extraBody={
                            <PkProgressBar
                              label={`Ocupación (${sold} vendidas)`}
                              valueLabel={cap > 0 ? `${pct}% ocupado` : 'Sin tope'}
                              pct={pct}
                              tone={meterTone}
                            />
                          }
                          statusPill={{
                            label: soldOut ? 'Localidad Agotada' : avail !== null && avail <= 15 ? 'Últimas Entradas' : 'Venta Habilitada',
                            tone: soldOut ? 'rose' : avail !== null && avail <= 15 ? 'amber' : 'emerald',
                          }}
                          primaryAction={{
                            label: soldOut ? '🚫 Función Agotada' : '🎟️ Emitir Boletas de esta Función',
                            tone: soldOut ? 'coral' : 'blue',
                            disabled: busy || soldOut,
                            onClick: () => openBoxOfficeStudio(ev),
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🧾 Colillas y Boletas Desprendibles Emitidas ({filteredTickets.length})</div>
              </div>
              <div className="pk-card-body">
                {filteredTickets.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                    Aún no se registran boletas para la selección actual. Usa el botón &ldquo;+ Emitir Boletas&rdquo; para despachar entradas.
                  </div>
                ) : (
                  <div className="pk-cards-showcase">
                    {filteredTickets.map((tkt) => (
                      <PkTicketCard
                        key={tkt.id}
                        code={`🎟️ ${tkt.code}`}
                        timeAgo={tkt.createdAt}
                        channelBadge={{
                          label: tkt.zone,
                          tone: tkt.zone.includes('Palco')
                            ? 'purple'
                            : tkt.zone.includes('VIP')
                            ? 'blue'
                            : tkt.zone.includes('Cortesía')
                            ? 'amber'
                            : 'emerald',
                        }}
                        title={tkt.eventName}
                        subtitle={`👤 ${tkt.customerName}${tkt.customerNit ? ` · Doc: ${tkt.customerNit}` : ''}`}
                        items={[
                          {
                            qty: tkt.qty,
                            name: `Acceso ${tkt.zone} (${formatCop(tkt.unitPrice)} c/u)`,
                            amount: formatCop(tkt.total),
                          },
                        ]}
                        totalLabel="TOTAL TAQUILLA"
                        totalValue={formatCop(tkt.total)}
                        paymentLabel={tkt.paymentMethod}
                        statusPill={{ label: `${tkt.qty} entrada(s) autorizada(s)`, tone: 'emerald' }}
                        secondaryActions={
                          <PkPrintButton label="🖨️ Imprimir Tirilla 80mm" payload={buildTicketPayload(tkt)} />
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="pk-stack">
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🧾 Boletas Emitidas en Turno ({filteredTickets.length})</div>
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
                            No se encontraron boletas con el criterio aplicado.
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
                        <th>Ocupación Aforo</th>
                        <th>Disponibles</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev) => {
                        const avail = ev.capacity > 0 ? Math.max(0, ev.capacity - ev.soldCount) : null;
                        const pct = ev.capacity > 0 ? Math.min(100, Math.round((ev.soldCount / ev.capacity) * 100)) : 0;
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
                            <td style={{ minWidth: 190 }}>
                              <PkProgressBar
                                label={`${ev.soldCount} / ${ev.capacity > 0 ? ev.capacity : '∞'}`}
                                valueLabel={ev.capacity > 0 ? `${pct}%` : 'Libre'}
                                pct={pct}
                                tone={resolveCapacityTone(pct)}
                              />
                            </td>
                            <td>
                              <span
                                className={`pk-badge ${avail === 0 ? 'pk-badge-rose' : 'pk-badge-emerald'}`}
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

      <PkFullscreenDialog
        open={boxOfficeStudioOpen}
        title="Estudio de Taquilla Rápida y Emisión de Boletería"
        subtitle="Selecciona localidad, ajusta el número de entradas con validación de aforo en vivo y emite el tiquete."
        badge={{ label: nextCode, tone: 'amber' }}
        onClose={() => setBoxOfficeStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="1. Localidad / Categoría de Acceso"
            options={ZONE_TYPE_CARDS}
            value={zone}
            onChange={handleZoneCardChange}
            disabled={busy}
          />
        }
        footerLeft={
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--pk-muted)', fontWeight: 700 }}>FUNCIÓN</div>
              <div style={{ fontWeight: 900, color: 'var(--pk-navy)' }}>
                {activeEvent ? `${activeEvent.name} (${zone})` : 'Sin seleccionar'}
              </div>
            </div>
            {availableForSelected !== null && (
              <span className={`pk-badge ${availableForSelected > 0 ? 'pk-badge-blue' : 'pk-badge-rose'}`}>
                Aforo disponible: {availableForSelected} / {activeEvent?.capacity}
              </span>
            )}
            <div>
              <div style={{ fontSize: 11, color: 'var(--pk-muted)', fontWeight: 700 }}>TOTAL A RECAUDAR</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--pk-emerald)' }}>
                {formatCop(previewTotal)}
              </div>
            </div>
          </div>
        }
        footerActions={
          <>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setBoxOfficeStudioOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="taquilla-issue-studio-form"
              className="pk-btn pk-btn-primary"
              disabled={busy || (availableForSelected !== null && availableForSelected === 0)}
            >
              {busy ? 'Emitiendo...' : `🎟️ Emitir ${qtyNumber} Boleta(s) — ${formatCop(previewTotal)}`}
            </button>
          </>
        }
      >
        <form id="taquilla-issue-studio-form" onSubmit={handleIssueTicket} className="pk-stack">
          <div className="pk-grid-2">
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">2. Selección de Función y Control de Aforo</div>
              </div>
              <div className="pk-card-body pk-stack">
                <div className="pk-form-grid cols-2">
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
                    createLabel="+ Nueva Función"
                    searchable
                  />
                </div>

                {activeEvent && activeEvent.capacity > 0 && (
                  <PkProgressBar
                    label={`Proyección de aforo tras esta venta (${Math.min(
                      activeEvent.capacity,
                      activeEvent.soldCount + qtyNumber
                    )} / ${activeEvent.capacity})`}
                    valueLabel={`${Math.max(0, activeEvent.capacity - activeEvent.soldCount - qtyNumber)} restantes`}
                    pct={Math.min(100, Math.round(((activeEvent.soldCount + qtyNumber) / activeEvent.capacity) * 100))}
                    tone={resolveCapacityTone(
                      Math.round(((activeEvent.soldCount + qtyNumber) / activeEvent.capacity) * 100)
                    )}
                  />
                )}
              </div>
            </div>

            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">3. Calculadora Visual de Sillas y Medio de Pago</div>
              </div>
              <div className="pk-card-body pk-stack">
                <div>
                  <div className="pk-label" style={{ marginBottom: 8 }}>Selección rápida de entradas</div>
                  <div className="pk-row-actions">
                    {[1, 2, 3, 4, 6, 10].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`pk-btn ${qtyNumber === n ? 'pk-btn-primary' : 'pk-btn-outline'} pk-btn-sm`}
                        onClick={() => setQty(String(n))}
                      >
                        {n} {n === 1 ? 'Entrada' : 'Entradas'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pk-form-grid">
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
                </div>
              </div>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">4. Datos del Asistente / Comprador</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid">
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
              </div>
            </div>
          </div>
        </form>
      </PkFullscreenDialog>

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
