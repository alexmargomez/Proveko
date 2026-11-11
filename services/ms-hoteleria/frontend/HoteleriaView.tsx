import React, { useState, useEffect, useCallback } from 'react';
import {
  usePlatform,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkSelect,
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
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible registrar el Check-In');
      }
    });
  };

  const submitCreateRoom = (closeModalAfter: boolean) => (e: React.FormEvent) => {
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
        if (closeModalAfter) {
          setShowNewRoomModal(false);
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
    <div>
      {currentTab === 'recepcion_habitaciones' && (
        <ModuleGate module="recepcion_habitaciones">
          <PkKpiRow
            items={[
              { label: 'Total Habitaciones', value: String(rooms.length) },
              { label: 'Disponibles', value: String(availableRooms.length), color: 'var(--pk-emerald)' },
              { label: 'Ocupadas Hoy', value: String(occupiedRooms.length), color: 'var(--pk-primary)' },
              { label: 'Cartera Huéspedes en Casa', value: formatCop(activeHotelTotal), color: 'var(--pk-amber)' },
            ]}
          />

          <div className="pk-card" style={{ marginBottom: 16 }}>
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
                <button
                  type="button"
                  className="pk-btn pk-btn-primary pk-btn-sm"
                  onClick={() => setShowNewRoomModal(true)}
                >
                  + Nueva Habitación
                </button>
              </div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleCheckIn} className="pk-form-grid">
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

                <div className="pk-field">
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

                <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    className="pk-btn pk-btn-primary"
                    disabled={busy || availableRooms.length === 0}
                  >
                    🏨 Confirmar Check-In
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🛏️ Tablero en Vivo de Habitaciones y Cuentas</div>
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportRoomsCsv}>
                📥 Exportar CSV
              </button>
            </div>
            <div className="pk-card-body">
              <div className="pk-cards-grid">
                {rooms.map((rm) => {
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
                        <div style={{ marginTop: 12, fontSize: 12, color: '#059669', fontWeight: 700 }}>
                          Lista para asignación inmediata en recepción.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <PkModal
            open={showNewRoomModal}
            title="Registrar Nueva Habitación Hotelera"
            onClose={() => setShowNewRoomModal(false)}
          >
            <form onSubmit={submitCreateRoom(true)} className="pk-form-grid">
              <div className="pk-field">
                <label>Número o Nombre de Habitación *</label>
                <input
                  required
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="Ej: 204 o Suite 401"
                />
              </div>
              <div className="pk-field">
                <label>Tipo de Acomodación</label>
                <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                  <option value="Estándar Sencilla">Estándar Sencilla</option>
                  <option value="Estándar Doble">Estándar Doble</option>
                  <option value="Suite Ejecutiva Doble">Suite Ejecutiva Doble</option>
                  <option value="Suite Presidencial / Familiar">Suite Presidencial / Familiar</option>
                </select>
              </div>
              <div className="pk-field">
                <label>Piso / Torre</label>
                <select value={floor} onChange={(e) => setFloor(e.target.value)}>
                  <option value="Piso 1">Piso 1</option>
                  <option value="Piso 2">Piso 2</option>
                  <option value="Piso 3">Piso 3</option>
                  <option value="Piso 4 / Penthouse">Piso 4 / Penthouse</option>
                </select>
              </div>
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
              <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
                <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                  💾 Guardar Habitación
                </button>
              </div>
            </form>
          </PkModal>

          <PkModal
            open={Boolean(chargeModalRoom)}
            title={chargeModalRoom ? `Cargar Consumo — ${chargeModalRoom.roomNumber}` : 'Cargar Consumo'}
            onClose={() => setChargeModalRoom(null)}
          >
            <form onSubmit={handleSubmitExtraCharge} className="pk-form-grid">
              <div className="pk-field">
                <label>Concepto del Cargo *</label>
                <input
                  required
                  value={chargeConcept}
                  onChange={(e) => setChargeConcept(e.target.value)}
                  placeholder="Ej: Consumo Restaurante / Minibar"
                />
                <div className="pk-row-actions" style={{ marginTop: 6 }}>
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
              <div className="pk-field">
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
              <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
                <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                  ➕ Aplicar Cargo a Habitación
                </button>
              </div>
            </form>
          </PkModal>
        </ModuleGate>
      )}

      {currentTab === 'tarifas_temporadas' && (
        <ModuleGate module="tarifas_temporadas">
          <div className="pk-card" style={{ marginBottom: 16 }}>
            <div className="pk-card-head">
              <div className="pk-card-title">📅 Configuración de Habitaciones y Tarifario Hotelero</div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={submitCreateRoom(false)} className="pk-form-grid">
                <div className="pk-field">
                  <label>Número o Nombre de Habitación *</label>
                  <input
                    required
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="Ej: 205 o Cabaña VIP 1"
                  />
                </div>
                <div className="pk-field">
                  <label>Tipo de Acomodación</label>
                  <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                    <option value="Estándar Sencilla">Estándar Sencilla</option>
                    <option value="Estándar Doble">Estándar Doble</option>
                    <option value="Suite Ejecutiva Doble">Suite Ejecutiva Doble</option>
                    <option value="Suite Presidencial / Familiar">Suite Presidencial / Familiar</option>
                  </select>
                </div>
                <div className="pk-field">
                  <label>Piso / Ubicación</label>
                  <select value={floor} onChange={(e) => setFloor(e.target.value)}>
                    <option value="Piso 1">Piso 1</option>
                    <option value="Piso 2">Piso 2</option>
                    <option value="Piso 3">Piso 3</option>
                    <option value="Zona Campestre">Zona Campestre</option>
                  </select>
                </div>
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
                <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
                  <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                    ➕ Agregar al Tarifario
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">📋 Inventario de Habitaciones y Tarifas Vigentes</div>
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportRoomsCsv}>
                📥 Exportar Tarifario CSV
              </button>
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
                    {rooms.map((r) => (
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ModuleGate>
      )}
    </div>
  );
};

export default HoteleriaView;
