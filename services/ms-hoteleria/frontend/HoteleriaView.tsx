import React, { useState, useEffect, useCallback } from 'react';
import {
  usePlatform,
  ModuleGate,
  FeatureGate,
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

interface RoomCharge {
  id: string;
  checkInCode: string;
  concept: string;
  amount: number;
  date: string;
}

interface HotelRoom {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: string;
  nightlyRate: number;
  status: string;
  checkInCode: string;
  guestId: string;
  guestName: string;
  guestDoc: string;
  checkInDate: string;
  nights: number;
  extrasTotal: number;
  charges: RoomCharge[];
}

interface GuestOption {
  id: string;
  name: string;
  nit: string;
  phone?: string;
}

interface HotelStateResponse {
  ok: boolean;
  nextCheckInCode: string;
  rooms: HotelRoom[];
}

interface OptionalCustomersResponse {
  ok?: boolean;
  customers?: GuestOption[];
}

const VALID_MODULES = ['recepcion_habitaciones', 'tarifas_temporadas'] as const;

const ROOM_TYPE_OPTIONS = [
  { value: 'Estándar Sencilla', label: 'Estándar Sencilla' },
  { value: 'Estándar Doble', label: 'Estándar Doble' },
  { value: 'Suite Ejecutiva Doble', label: 'Suite Ejecutiva Doble' },
  { value: 'Suite Presidencial / Familiar', label: 'Suite Presidencial / Familiar' },
];

const RECEPTION_FLOOR_OPTIONS = [
  { value: 'Piso 1', label: 'Piso 1' },
  { value: 'Piso 2', label: 'Piso 2' },
  { value: 'Piso 3', label: 'Piso 3' },
  { value: 'Piso 4 / Penthouse', label: 'Piso 4 / Penthouse' },
];

const RATES_FLOOR_OPTIONS = [
  { value: 'Piso 1', label: 'Piso 1' },
  { value: 'Piso 2', label: 'Piso 2' },
  { value: 'Piso 3', label: 'Piso 3' },
  { value: 'Zona Campestre', label: 'Zona Campestre' },
];

const ROOM_STATUS_FILTER_OPTIONS = [
  { value: 'Disponible', label: 'Disponible' },
  { value: 'Ocupada', label: 'Ocupada' },
];

export const HoteleriaView: React.FC = () => {
  const {
    activeModuleKey,
    hasService,
    hasModule,
    navigateTo,
    apiGet,
    apiPost,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [receptionViewMode, setReceptionViewMode] = useState<'list' | 'create'>('list');
  const [ratesViewMode, setRatesViewMode] = useState<'list' | 'create'>('list');

  const [roomSearch, setRoomSearch] = useState('');
  const [roomStatusFilter, setRoomStatusFilter] = useState('');

  const [nextCheckInCode, setNextCheckInCode] = useState('CHK-406');
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [customers, setCustomers] = useState<GuestOption[]>([]);

  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [useManualGuest, setUseManualGuest] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [manualGuestName, setManualGuestName] = useState('');
  const [manualGuestDoc, setManualGuestDoc] = useState('');
  const [nights, setNights] = useState('1');

  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('Suite Ejecutiva Doble');
  const [floor, setFloor] = useState('Piso 2');
  const [nightlyRate, setNightlyRate] = useState('185000');

  const [chargeModalRoom, setChargeModalRoom] = useState<HotelRoom | null>(null);
  const [chargeConcept, setChargeConcept] = useState('Consumo Restaurante / Minibar');
  const [chargeAmount, setChargeAmount] = useState('25000');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<HotelStateResponse>('/api/v1/hoteleria/rooms');
      const roomList = data.rooms || [];
      setNextCheckInCode(data.nextCheckInCode || 'CHK-406');
      setRooms(roomList);

      const avail = roomList.filter((rm) => rm.status === 'Disponible');
      setSelectedRoomId((prev) => {
        if (prev && avail.some((rm) => rm.id === prev)) return prev;
        return avail.length > 0 ? avail[0].id : '';
      });

      if (hasService('ms-clientes')) {
        try {
          const crm = await apiGet<OptionalCustomersResponse>('/api/v1/clientes/all');
          const cList = crm.customers || [];
          setCustomers(cList);
          setSelectedGuestId((prev) => {
            if (prev && cList.some((c) => c.id === prev)) return prev;
            return cList.length > 0 ? cList[0].id : '';
          });
        } catch {
          setCustomers([]);
        }
      } else {
        setCustomers([]);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No fue posible cargar el estado hotelero');
    }
  }, [apiGet, hasService, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const currentTab =
    (VALID_MODULES as readonly string[]).includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : VALID_MODULES.find((m) => hasModule(m)) || 'recepcion_habitaciones';

  const availableRooms = rooms.filter((r) => r.status === 'Disponible');
  const occupiedRooms = rooms.filter((r) => r.status === 'Ocupada');
  const activeHotelTotal = occupiedRooms.reduce(
    (acc, r) => acc + r.nightlyRate * Math.max(1, r.nights) + (r.extrasTotal || 0),
    0
  );

  const hasCustomerDirectory = hasService('ms-clientes') && customers.length > 0;
  const effectiveManualMode = useManualGuest || !hasCustomerDirectory;

  const filteredRooms = rooms.filter((rm) => {
    if (roomStatusFilter && rm.status !== roomStatusFilter) return false;
    const q = roomSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      rm.roomNumber.toLowerCase().includes(q) ||
      rm.roomType.toLowerCase().includes(q) ||
      rm.floor.toLowerCase().includes(q) ||
      (rm.guestName || '').toLowerCase().includes(q) ||
      (rm.checkInCode || '').toLowerCase().includes(q)
    );
  });

  const handleCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) {
      toast('Selecciona una habitación disponible o registra una nueva habitación');
      return;
    }
    const stayNights = Number(nights || 0);
    if (!Number.isFinite(stayNights) || stayNights < 1) {
      toast('El número de noches debe ser de al menos 1');
      return;
    }

    let guestId = '';
    let guestName = '';
    let guestDoc = '';

    if (effectiveManualMode) {
      guestName = manualGuestName.trim();
      guestDoc = manualGuestDoc.trim();
      if (!guestName) {
        toast('Ingresa el nombre completo o razón social del huésped');
        return;
      }
    } else {
      const chosen = customers.find((c) => c.id === selectedGuestId);
      if (!chosen) {
        toast('Selecciona un huésped del directorio o ingresa sus datos manualmente');
        return;
      }
      guestId = chosen.id;
      guestName = chosen.name;
      guestDoc = chosen.nit || '';
    }

    void run(async () => {
      try {
        await apiPost('/api/v1/hoteleria/checkin', {
          roomId: selectedRoomId,
          guestId,
          guestName,
          guestDoc,
          nights: Math.floor(stayNights),
        });
        toast('Check-In hotelero registrado exitosamente');
        setManualGuestName('');
        setManualGuestDoc('');
        setNights('1');
        setReceptionViewMode('list');
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible registrar el Check-In');
      }
    });
  };

  const submitCreateRoom = (origin: 'modal' | 'page') => (e: React.FormEvent) => {
    e.preventDefault();
    const rate = Number(nightlyRate || 0);
    if (!roomNumber.trim() || !Number.isFinite(rate) || rate <= 0) {
      toast('Ingresa el número de habitación y una tarifa por noche válida');
      return;
    }
    void run(async () => {
      try {
        const res = await apiPost<{ room: HotelRoom }>('/api/v1/hoteleria/rooms', {
          roomNumber: roomNumber.trim(),
          roomType,
          floor,
          nightlyRate: rate,
        });
        toast(`Habitación registrada: ${res.room.roomNumber}`);
        setRoomNumber('');
        if (origin === 'modal') {
          setShowNewRoomModal(false);
        } else {
          setRatesViewMode('list');
        }
        await reload();
        if (res.room.status === 'Disponible') {
          setSelectedRoomId(res.room.id);
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al registrar la habitación');
      }
    });
  };

  const handleSubmitExtraCharge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chargeModalRoom) return;
    const amt = Number(chargeAmount || 0);
    if (!chargeConcept.trim() || !Number.isFinite(amt) || amt <= 0) {
      toast('Ingresa el concepto del consumo y un valor mayor a cero');
      return;
    }
    const targetRoom = chargeModalRoom;
    void run(async () => {
      try {
        await apiPost(`/api/v1/hoteleria/rooms/${encodeURIComponent(targetRoom.id)}/extra`, {
          concept: chargeConcept.trim(),
          amount: amt,
        });
        toast(`Cargo de ${formatCop(amt)} registrado en ${targetRoom.roomNumber}`);
        setChargeModalRoom(null);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al cargar consumo a la habitación');
      }
    });
  };

  const handleCheckoutToPos = (room: HotelRoom) => {
    if (!hasService('ms-facturacion')) {
      toast('El servicio de Facturación POS no está activo en la suscripción actual');
      return;
    }
    const stayNights = Math.max(1, room.nights || 1);
    const items: Array<Record<string, unknown>> = [
      {
        kind: 'SERVICIO',
        refId: room.id,
        code: room.checkInCode || 'ALOJ',
        name: `Alojamiento ${room.roomNumber} (${room.roomType})`,
        qty: stayNights,
        price: room.nightlyRate,
        taxPct: 19,
      },
    ];
    if (room.extrasTotal > 0) {
      items.push({
        kind: 'SERVICIO',
        refId: `${room.id}-EXT`,
        code: 'EXT-HAB',
        name: `Consumos Adicionales Habitación (${room.roomNumber})`,
        qty: 1,
        price: room.extrasTotal,
        taxPct: 8,
      });
    }
    navigateTo('ms-facturacion', 'pos_mostrador', {
      customerId: room.guestId || undefined,
      guestName: room.guestName,
      linkedRoomId: room.id,
      roomNumber: room.roomNumber,
      items,
    });
    toast(`Cuenta de ${room.roomNumber} enviada a Caja POS para Check-Out`);
  };

  const buildHotelStatementPayload = (room: HotelRoom): Record<string, unknown> => {
    const stayNights = Math.max(1, room.nights || 1);
    const lodgingSubtotal = stayNights * room.nightlyRate;
    const grandTotal = lodgingSubtotal + (room.extrasTotal || 0);
    const matchedCustomer = customers.find((c) => c.id === room.guestId);

    const items: Array<Record<string, unknown>> = [
      {
        code: room.checkInCode || 'ALOJ',
        description: `Alojamiento ${room.roomNumber} — ${room.roomType}`,
        quantity: stayNights,
        unit_price: room.nightlyRate,
        subtotal: lodgingSubtotal,
      },
    ];

    if (room.charges && room.charges.length > 0) {
      room.charges.forEach((ch, idx) => {
        items.push({
          code: `EXT-${idx + 1}`,
          description: `${ch.concept} (${ch.date})`,
          quantity: 1,
          unit_price: ch.amount,
          subtotal: ch.amount,
        });
      });
    } else if (room.extrasTotal > 0) {
      items.push({
        code: 'CONS-EXT',
        description: 'Consumos Restaurante / Minibar / Lavandería a la Habitación',
        quantity: 1,
        unit_price: room.extrasTotal,
        subtotal: room.extrasTotal,
      });
    }

    return {
      document_type: 'CUENTA_HOTEL',
      layout_variant: 'carta_membrete',
      document_number: room.checkInCode || room.id.toUpperCase(),
      issue_date: room.checkInDate || new Date().toISOString().slice(0, 10),
      customer_name: room.guestName || 'Huésped Registrado',
      customer_nit: room.guestDoc || matchedCustomer?.nit || '',
      customer_phone: matchedCustomer?.phone || '',
      extra_fields: {
        Habitación: room.roomNumber,
        Acomodación: room.roomType,
        Ubicación: room.floor,
        'Registro Check-In': room.checkInCode,
        'Fecha Ingreso': room.checkInDate,
        Noches: String(stayNights),
      },
      items,
      subtotal: grandTotal,
      grand_total: grandTotal,
      notes: 'Estado de cuenta hotelero informativo previo a facturación electrónica de Check-Out.',
    };
  };

  const handleExportRoomsCsv = () => {
    downloadCsvUtf8(
      'ocupacion_hotelera.csv',
      ['ID', 'Habitación', 'Tipo Acomodación', 'Piso', 'Tarifa Noche', 'Estado', 'Check-In', 'Huésped', 'Noches', 'Extras'],
      rooms.map((r) => [
        r.id,
        r.roomNumber,
        r.roomType,
        r.floor,
        r.nightlyRate,
        r.status,
        r.checkInCode,
        r.guestName,
        r.nights,
        r.extrasTotal,
      ])
    );
  };

  return (
    <div className="pk-stack">
      {currentTab === 'recepcion_habitaciones' && (
        <ModuleGate module="recepcion_habitaciones">
          <div className="pk-stack">
            <PkKpiRow
              items={[
                { label: 'Total Habitaciones', value: String(rooms.length) },
                { label: 'Disponibles', value: String(availableRooms.length), color: 'var(--pk-emerald)' },
                { label: 'Ocupadas Hoy', value: String(occupiedRooms.length), color: 'var(--pk-primary)' },
                { label: 'Cartera Huéspedes en Casa', value: formatCop(activeHotelTotal), color: 'var(--pk-amber)' },
              ]}
            />

            <PkViewSwitcher
              title="Recepción Hotelera y Control de Ocupación"
              subtitle="Supervisa las habitaciones ocupadas y disponibles en tiempo real o registra un nuevo Check-In."
              mode={receptionViewMode}
              onModeChange={setReceptionViewMode}
              listLabel="🛏️ Tablero de Habitaciones"
              createLabel="+ Registrar Check-In"
              count={rooms.length}
              extraActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setShowNewRoomModal(true)}
                  >
                    + Nueva Habitación
                  </button>
                  {receptionViewMode === 'list' && (
                    <button
                      type="button"
                      className="pk-btn pk-btn-outline"
                      onClick={handleExportRoomsCsv}
                    >
                      📥 Exportar CSV
                    </button>
                  )}
                </>
              }
            />

            {receptionViewMode === 'create' ? (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">🛎️ Recepción y Registro de Check-In</div>
                  <div className="pk-row-actions">
                    {hasCustomerDirectory && (
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        onClick={() => setUseManualGuest((v) => !v)}
                      >
                        {effectiveManualMode ? '📋 Elegir de Directorio Clientes' : '✍️ Ingresar Huésped Directo'}
                      </button>
                    )}
                    <span className="pk-badge pk-badge-blue">{nextCheckInCode}</span>
                  </div>
                </div>
                <div className="pk-card-body">
                  <form onSubmit={handleCheckIn} className="pk-form-grid cols-2">
                    <PkAutoCodeInput label="Folio Check-In" value={nextCheckInCode} />

                    <PkSelect
                      label="Habitación Disponible *"
                      items={availableRooms}
                      value={selectedRoomId}
                      onChange={setSelectedRoomId}
                      getValue={(r) => r.id}
                      getLabel={(r) => `${r.roomNumber} — ${r.roomType} (${formatCop(r.nightlyRate)}/noche)`}
                      onCreateNew={() => setShowNewRoomModal(true)}
                      createLabel="+ Nueva Habitación"
                      emptyLabel={availableRooms.length === 0 ? 'Sin habitaciones disponibles' : undefined}
                      searchable
                    />

                    {effectiveManualMode ? (
                      <>
                        <div className="pk-field">
                          <label>Nombre Completo / Empresa Huésped *</label>
                          <input
                            required
                            value={manualGuestName}
                            onChange={(e) => setManualGuestName(e.target.value)}
                            placeholder="Ej: Carolina Gómez / Grupo Empresarial"
                          />
                        </div>
                        <div className="pk-field">
                          <label>Documento / NIT</label>
                          <input
                            value={manualGuestDoc}
                            onChange={(e) => setManualGuestDoc(e.target.value)}
                            placeholder="Ej: 1.037.614.920"
                          />
                        </div>
                      </>
                    ) : (
                      <PkSelect
                        label="Huésped / Empresa *"
                        items={customers}
                        value={selectedGuestId}
                        onChange={setSelectedGuestId}
                        getValue={(c) => c.id}
                        getLabel={(c) => `${c.name}${c.nit ? ` (${c.nit})` : ''}`}
                        searchable
                      />
                    )}

                    <div className={`pk-field${effectiveManualMode ? ' pk-col-span-full' : ''}`}>
                      <label>Noches de Estadía *</label>
                      <input
                        required
                        type="number"
                        min="1"
                        max="365"
                        value={nights}
                        onChange={(e) => setNights(e.target.value)}
                      />
                    </div>

                    <div className="pk-form-actions">
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline"
                        onClick={() => setReceptionViewMode('list')}
                        disabled={busy}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="pk-btn pk-btn-primary"
                        disabled={busy || availableRooms.length === 0}
                      >
                        {busy ? 'Procesando...' : '🏨 Confirmar Check-In'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">🛏️ Tablero en Vivo de Habitaciones y Cuentas</div>
                </div>
                <div className="pk-datatable-toolbar">
                  <input
                    className="pk-input pk-datatable-search"
                    placeholder="🔎 Buscar por número de habitación, acomodación, piso o huésped..."
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 230 }}>
                      <PkSimpleSelect
                        ariaLabel="Filtrar habitaciones por estado"
                        value={roomStatusFilter}
                        onChange={setRoomStatusFilter}
                        allowClear
                        placeholder="Todos los estados"
                        options={ROOM_STATUS_FILTER_OPTIONS}
                      />
                    </div>
                  </div>
                </div>
                <div className="pk-card-body">
                  <div className="pk-cards-grid">
                    {filteredRooms.map((rm) => {
                      const occupied = rm.status === 'Ocupada';
                      const stayNights = Math.max(1, rm.nights || 1);
                      const roomTotal = occupied ? rm.nightlyRate * stayNights + (rm.extrasTotal || 0) : rm.nightlyRate;
                      return (
                        <div
                          key={rm.id}
                          style={{
                            border: occupied ? '2px solid var(--pk-primary)' : '1px solid var(--pk-border)',
                            borderRadius: 12,
                            padding: 14,
                            background: occupied ? '#f8fafc' : '#ffffff',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: 16 }}>{rm.roomNumber}</strong>
                            <span className={occupied ? 'pk-badge pk-badge-blue' : 'pk-badge pk-badge-emerald'}>
                              {rm.status}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 4 }}>
                            {rm.roomType} · {rm.floor} · Tarifa: <strong>{formatCop(rm.nightlyRate)}</strong>/noche
                          </div>

                          {occupied ? (
                            <div style={{ marginTop: 10, borderTop: '1px dashed #cbd5e1', paddingTop: 10 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                                👤 {rm.guestName}
                              </div>
                              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                                Folio: <strong>{rm.checkInCode}</strong> · Ingreso: {rm.checkInDate} · {stayNights} noche(s)
                              </div>
                              {rm.extrasTotal > 0 && (
                                <div style={{ fontSize: 12, color: 'var(--pk-amber)', fontWeight: 700, marginTop: 4 }}>
                                  🍽️ Consumos adicionales: {formatCop(rm.extrasTotal)}
                                </div>
                              )}
                              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 8, color: '#0f172a' }}>
                                Saldo Habitación: {formatCop(roomTotal)}
                              </div>

                              <div className="pk-row-actions" style={{ marginTop: 10 }}>
                                <FeatureGate module="recepcion_habitaciones" feature="cargos_habitacion">
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-outline pk-btn-sm"
                                    disabled={busy}
                                    onClick={() => {
                                      setChargeConcept('Consumo Restaurante / Minibar');
                                      setChargeAmount('25000');
                                      setChargeModalRoom(rm);
                                    }}
                                  >
                                    + Cargo Habitación
                                  </button>
                                </FeatureGate>

                                <PkPrintButton
                                  label="🖨️ Estado Cuenta"
                                  payload={buildHotelStatementPayload(rm)}
                                />

                                <button
                                  type="button"
                                  className="pk-btn pk-btn-emerald pk-btn-sm"
                                  disabled={busy}
                                  onClick={() => handleCheckoutToPos(rm)}
                                >
                                  💵 Cobrar Check-Out en Caja
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                marginTop: 12,
                                borderTop: '1px dashed #e2e8f0',
                                paddingTop: 10,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8,
                                flexWrap: 'wrap',
                              }}
                            >
                              <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>
                                Lista para asignación en recepción.
                              </span>
                              <button
                                type="button"
                                className="pk-btn pk-btn-primary pk-btn-sm"
                                onClick={() => {
                                  setSelectedRoomId(rm.id);
                                  setReceptionViewMode('create');
                                }}
                              >
                                🛎️ Iniciar Check-In
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <PkModal
              open={showNewRoomModal}
              title="Registrar Nueva Habitación Hotelera"
              onClose={() => setShowNewRoomModal(false)}
            >
              <form onSubmit={submitCreateRoom('modal')} className="pk-form-grid cols-2">
                <div className="pk-field">
                  <label>Número o Nombre de Habitación *</label>
                  <input
                    required
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="Ej: 204 o Suite 401"
                  />
                </div>

                <PkSimpleSelect
                  label="Tipo de Acomodación"
                  value={roomType}
                  onChange={setRoomType}
                  options={ROOM_TYPE_OPTIONS}
                />

                <PkSimpleSelect
                  label="Piso / Torre"
                  value={floor}
                  onChange={setFloor}
                  options={RECEPTION_FLOOR_OPTIONS}
                />

                <div className="pk-field">
                  <label>Tarifa por Noche (COP) *</label>
                  <input
                    required
                    type="number"
                    min="1000"
                    step="1000"
                    value={nightlyRate}
                    onChange={(e) => setNightlyRate(e.target.value)}
                  />
                </div>

                <div className="pk-form-actions">
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setShowNewRoomModal(false)}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                    {busy ? 'Guardando...' : '💾 Guardar Habitación'}
                  </button>
                </div>
              </form>
            </PkModal>

            <PkModal
              open={Boolean(chargeModalRoom)}
              title={chargeModalRoom ? `Cargar Consumo — ${chargeModalRoom.roomNumber}` : 'Cargar Consumo'}
              onClose={() => setChargeModalRoom(null)}
            >
              <form onSubmit={handleSubmitExtraCharge} className="pk-form-grid cols-2">
                <div className="pk-field pk-col-span-full">
                  <label>Concepto del Cargo *</label>
                  <input
                    required
                    value={chargeConcept}
                    onChange={(e) => setChargeConcept(e.target.value)}
                    placeholder="Ej: Consumo Restaurante / Minibar"
                  />
                  <div className="pk-row-actions" style={{ marginTop: 8 }}>
                    {[
                      { label: 'Minibar ($25.000)', concept: 'Consumo Minibar Habitación', amount: '25000' },
                      { label: 'Room Service ($42.000)', concept: 'Servicio Restaurante a la Habitación', amount: '42000' },
                      { label: 'Lavandería ($30.000)', concept: 'Servicio de Lavandería Express', amount: '30000' },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        onClick={() => {
                          setChargeConcept(p.concept);
                          setChargeAmount(p.amount);
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pk-field pk-col-span-full">
                  <label>Valor a Cargar (COP) *</label>
                  <input
                    required
                    type="number"
                    min="500"
                    step="500"
                    value={chargeAmount}
                    onChange={(e) => setChargeAmount(e.target.value)}
                  />
                </div>

                <div className="pk-form-actions">
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setChargeModalRoom(null)}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                    {busy ? 'Cargando...' : '➕ Aplicar Cargo a Habitación'}
                  </button>
                </div>
              </form>
            </PkModal>
          </div>
        </ModuleGate>
      )}

      {currentTab === 'tarifas_temporadas' && (
        <ModuleGate module="tarifas_temporadas">
          <div className="pk-stack">
            <PkViewSwitcher
              title="Inventario de Habitaciones y Tarifario Hotelero"
              subtitle="Administra el catálogo de habitaciones, ubicaciones y tarifas oficiales por noche."
              mode={ratesViewMode}
              onModeChange={setRatesViewMode}
              listLabel="📋 Tarifario Vigente"
              createLabel="+ Agregar Habitación"
              count={rooms.length}
              extraActions={
                ratesViewMode === 'list' ? (
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={handleExportRoomsCsv}
                  >
                    📥 Exportar Tarifario CSV
                  </button>
                ) : undefined
              }
            />

            {ratesViewMode === 'create' ? (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📅 Configuración de Habitaciones y Tarifario Hotelero</div>
                </div>
                <div className="pk-card-body">
                  <form onSubmit={submitCreateRoom('page')} className="pk-form-grid cols-2">
                    <div className="pk-field">
                      <label>Número o Nombre de Habitación *</label>
                      <input
                        required
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value)}
                        placeholder="Ej: 205 o Cabaña VIP 1"
                      />
                    </div>

                    <PkSimpleSelect
                      label="Tipo de Acomodación"
                      value={roomType}
                      onChange={setRoomType}
                      options={ROOM_TYPE_OPTIONS}
                    />

                    <PkSimpleSelect
                      label="Piso / Ubicación"
                      value={floor}
                      onChange={setFloor}
                      options={RATES_FLOOR_OPTIONS}
                    />

                    <div className="pk-field">
                      <label>Tarifa Oficial por Noche (COP) *</label>
                      <input
                        required
                        type="number"
                        min="1000"
                        step="1000"
                        value={nightlyRate}
                        onChange={(e) => setNightlyRate(e.target.value)}
                      />
                    </div>

                    <div className="pk-form-actions">
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline"
                        onClick={() => setRatesViewMode('list')}
                        disabled={busy}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                        {busy ? 'Guardando...' : '➕ Agregar al Tarifario'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📋 Inventario de Habitaciones y Tarifas Vigentes</div>
                </div>
                <div className="pk-datatable-toolbar">
                  <input
                    className="pk-input pk-datatable-search"
                    placeholder="🔎 Buscar por código, habitación, acomodación o piso..."
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                  />
                </div>
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Habitación</th>
                          <th>Acomodación</th>
                          <th>Ubicación</th>
                          <th>Tarifa / Noche</th>
                          <th>Estado Actual</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRooms.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 24 }}>
                              No se encontraron habitaciones con ese criterio.
                            </td>
                          </tr>
                        ) : (
                          filteredRooms.map((r) => (
                            <tr key={r.id}>
                              <td style={{ fontWeight: 700 }}>{r.id.toUpperCase()}</td>
                              <td style={{ fontWeight: 700 }}>{r.roomNumber}</td>
                              <td>{r.roomType}</td>
                              <td>{r.floor}</td>
                              <td style={{ fontWeight: 800 }}>{formatCop(r.nightlyRate)}</td>
                              <td>
                                <span
                                  className={
                                    r.status === 'Ocupada' ? 'pk-badge pk-badge-blue' : 'pk-badge pk-badge-emerald'
                                  }
                                >
                                  {r.status}
                                </span>
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
        </ModuleGate>
      )}
    </div>
  );
};

export default HoteleriaView;
