import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkEntitySelect,
  PkPrintButton,
  PkKpiRow,
  HotelRoom,
  Customer,
  InvoiceItem,
  PrintDocumentPayload,
  formatCop,
} from '@proveko/ui-sdk';

interface HotelRoomsResponse {
  ok: boolean;
  nextCheckInCode: string;
  rooms: HotelRoom[];
  customers: Customer[];
}

export const HoteleriaView: React.FC = () => {
  const {
    activeModuleKey,
    hasModule,
    apiGet,
    apiPost,
    toast,
    openQuickDialog,
    sendToPosCheckout,
    dialogVersion,
  } = useProveko();

  const [nextCheckInCode, setNextCheckInCode] = useState('CHK-406');
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [nights, setNights] = useState('1');

  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('Suite Ejecutiva Doble');
  const [floor, setFloor] = useState('Piso 2');
  const [nightlyRate, setNightlyRate] = useState('180000');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<HotelRoomsResponse>('/api/v1/hoteleria/rooms');
      const rList = data.rooms || [];
      const cList = data.customers || [];
      setNextCheckInCode(data.nextCheckInCode || 'CHK-406');
      setRooms(rList);
      setCustomers(cList);

      const avail = rList.filter((rm) => rm.status === 'Disponible');
      setSelectedRoomId((prev) => {
        if (prev && avail.some((rm) => rm.id === prev)) return prev;
        return avail.length > 0 ? avail[0].id : '';
      });
      setSelectedGuestId((prev) => {
        if (prev && cList.some((c) => c.id === prev)) return prev;
        return cList.length > 0 ? cList[0].id : '';
      });
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void reload();
  }, [reload, dialogVersion]);

  const validModules = ['recepcion_habitaciones', 'tarifas_temporadas'];
  const currentTab =
    validModules.includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : validModules.find((m) => hasModule(m)) || 'recepcion_habitaciones';

  const availableRooms = rooms.filter((r) => r.status === 'Disponible');
  const occupiedRooms = rooms.filter((r) => r.status === 'Ocupada');
  const activeHotelTotal = occupiedRooms.reduce(
    (acc, r) => acc + r.nightlyRate * Math.max(1, r.nights) + (r.extrasTotal || 0),
    0
  );

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) {
      toast('No hay habitación disponible seleccionada. Crea una nueva habitación primero.');
      return;
    }
    if (!selectedGuestId) {
      toast('Selecciona o registra un huésped para el Check-In.');
      return;
    }
    await apiPost('/api/v1/hoteleria/checkin', {
      roomId: selectedRoomId,
      guestId: selectedGuestId,
      nights: Math.max(1, Number(nights || 1)),
    });
    toast('🏨 Check-In registrado exitosamente');
    setNights('1');
    await reload();
  };

  const handleAddConsumption = async (room: HotelRoom) => {
    await apiPost(`/api/v1/hoteleria/rooms/${room.id}/extra`, {
      amount: 25000,
      concept: 'Consumo Restaurante / Minibar',
    });
    toast(`🍽️ Cargo de $25.000 sumado a ${room.roomNumber}`);
    await reload();
  };

  const handleCheckoutToPos = (room: HotelRoom) => {
    const stayNights = Math.max(1, room.nights || 1);
    const items: InvoiceItem[] = [
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
        name: `Consumos Extra Habitación (${room.roomNumber})`,
        qty: 1,
        price: room.extrasTotal,
        taxPct: 8,
      });
    }
    sendToPosCheckout({
      customerId: room.guestId || undefined,
      linkedRoomId: room.id,
      items,
    });
    toast(`Cuenta de ${room.roomNumber} enviada a Caja POS para Check-Out`);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = Number(nightlyRate || 0);
    if (!roomNumber.trim() || rate <= 0) {
      toast('Ingresa el número de habitación y una tarifa válida.');
      return;
    }
    await apiPost('/api/v1/hoteleria/rooms', {
      roomNumber,
      roomType,
      floor,
      nightlyRate: rate,
    });
    toast('Habitación agregada al tarifario hotelero');
    setRoomNumber('');
    await reload();
  };

  const buildHotelStatementPayload = (room: HotelRoom): PrintDocumentPayload => {
    const stayNights = Math.max(1, room.nights || 1);
    const lodgingSubtotal = stayNights * room.nightlyRate;
    const grandTotal = lodgingSubtotal + (room.extrasTotal || 0);
    const guest = customers.find((c) => c.id === room.guestId);

    const items: PrintDocumentPayload['items'] = [
      {
        code: room.checkInCode || 'ALOJ',
        description: `Alojamiento ${room.roomNumber} — ${room.roomType}`,
        quantity: stayNights,
        unit_price: room.nightlyRate,
        subtotal: lodgingSubtotal,
      },
    ];
    if (room.extrasTotal > 0) {
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
      customer_nit: guest?.nit || '',
      customer_phone: guest?.phone || '',
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
      notes: 'Estado de cuenta hotelero previo a facturación de Check-Out.',
    };
  };

  return (
    <div>
      {currentTab === 'recepcion_habitaciones' && (
        <ModuleGate module="recepcion_habitaciones">
          <PkKpiRow
            items={[
              { label: 'Total Habitaciones', value: String(rooms.length) },
              { label: 'Ocupadas', value: String(occupiedRooms.length), color: 'var(--pk-amber)' },
              { label: 'Disponibles', value: String(availableRooms.length), color: 'var(--pk-emerald)' },
              { label: 'Cuentas en Estadía', value: formatCop(activeHotelTotal), color: 'var(--pk-primary)' },
            ]}
          />

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🛎️ Recepción y Registro de Check-In</div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleCheckIn} className="pk-form-grid">
                <PkAutoCodeInput label="Registro Check-In" value={nextCheckInCode} />
                <PkEntitySelect
                  label="Habitación Disponible"
                  items={availableRooms}
                  value={selectedRoomId}
                  onChange={setSelectedRoomId}
                  getValue={(r) => r.id}
                  getLabel={(r) => `${r.roomNumber} · ${r.roomType} (${formatCop(r.nightlyRate)}/noche)`}
                  createLabel="+ Nueva Habitación"
                  onCreateNew={() => openQuickDialog('nueva-habitacion', () => void reload())}
                />
                <PkEntitySelect
                  label="Huésped / Empresa"
                  items={customers}
                  value={selectedGuestId}
                  onChange={setSelectedGuestId}
                  getValue={(c) => c.id}
                  getLabel={(c) => `${c.name} (${c.nit})`}
                  createLabel="+ Nuevo Huésped"
                  onCreateNew={() => openQuickDialog('nuevo-cliente', () => void reload())}
                  searchable
                />
                <div className="pk-field">
                  <label>N° de Noches *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={nights}
                    onChange={(e) => setNights(e.target.value)}
                  />
                </div>
                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-primary">
                    🏨 Registrar Check-In
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🛏️ Mapa de Habitaciones y Cuentas Activas</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-cards-grid">
                {rooms.map((room) => {
                  const isOccupied = room.status === 'Ocupada';
                  const stayNights = Math.max(1, room.nights || 1);
                  const lodgingAmount = isOccupied ? stayNights * room.nightlyRate : 0;
                  const totalAccount = lodgingAmount + (room.extrasTotal || 0);

                  return (
                    <div
                      key={room.id}
                      style={{
                        border: isOccupied ? '2px solid var(--pk-primary)' : '1px solid var(--pk-border)',
                        borderRadius: 12,
                        padding: 14,
                        background: isOccupied ? '#f8fafc' : '#ffffff',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 15.5 }}>{room.roomNumber}</strong>
                        <span className={`pk-badge ${isOccupied ? 'pk-badge-amber' : 'pk-badge-emerald'}`}>
                          {room.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 4 }}>
                        {room.roomType} · {room.floor} · {formatCop(room.nightlyRate)}/noche
                      </div>

                      {isOccupied ? (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                          <div style={{ fontSize: 12.5 }}>
                            <strong>Huésped:</strong> {room.guestName}
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                            <strong>Check-In:</strong> {room.checkInCode} ({room.checkInDate}) · {stayNights} noche(s)
                          </div>
                          <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                            Alojamiento: {formatCop(lodgingAmount)} + Extras: {formatCop(room.extrasTotal)}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 6, color: '#0f172a' }}>
                            Total Cuenta: {formatCop(totalAccount)}
                          </div>

                          <div className="pk-row-actions" style={{ marginTop: 10 }}>
                            <FeatureGate module="recepcion_habitaciones" feature="cargos_habitacion">
                              <button
                                type="button"
                                className="pk-btn pk-btn-amber pk-btn-sm"
                                onClick={() => void handleAddConsumption(room)}
                              >
                                🍽️ + Consumo ($25k)
                              </button>
                            </FeatureGate>
                            <PkPrintButton
                              label="🖨️ Imprimir Cuenta Hotelera"
                              payload={buildHotelStatementPayload(room)}
                            />
                            <button
                              type="button"
                              className="pk-btn pk-btn-emerald pk-btn-sm"
                              onClick={() => handleCheckoutToPos(room)}
                            >
                              💵 Cobrar Check-Out en Caja
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--pk-emerald)', fontWeight: 700 }}>
                          ✓ Lista para asignación en recepción
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </ModuleGate>
      )}

      {currentTab === 'tarifas_temporadas' && (
        <ModuleGate module="tarifas_temporadas">
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">📅 Configuración de Habitaciones y Tarifas por Noche</div>
              <PkPrintButton
                label="🖨️ Imprimir Tarifario Hotelero"
                variant="primary"
                payload={{
                  document_type: 'REPORTE_TABLA',
                  layout_variant: 'carta_membrete',
                  document_number: `TAR-HTL-${new Date().toISOString().slice(0, 10)}`,
                  issue_date: new Date().toISOString().slice(0, 10),
                  customer_name: 'Tarifario Oficial de Acomodación Hotelera',
                  items: rooms.map((r) => ({
                    code: r.id.toUpperCase(),
                    description: `${r.roomNumber} — ${r.roomType} (${r.floor}) [${r.status}]`,
                    quantity: 1,
                    unit_price: r.nightlyRate,
                    subtotal: r.nightlyRate,
                  })),
                  grand_total: rooms.reduce((acc, r) => acc + r.nightlyRate, 0),
                  notes: 'Tarifas vigentes por noche de alojamiento.',
                }}
              />
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleCreateRoom} className="pk-form-grid">
                <div className="pk-field">
                  <label>N° o Nombre Habitación *</label>
                  <input
                    required
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="Ej: Habitación 301 / Cabaña 4"
                  />
                </div>
                <div className="pk-field">
                  <label>Tipo de Acomodación</label>
                  <select value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                    <option value="Estándar Sencilla">Estándar Sencilla</option>
                    <option value="Suite Ejecutiva Doble">Suite Ejecutiva Doble</option>
                    <option value="Suite Familiar">Suite Familiar</option>
                    <option value="Cabaña VIP">Cabaña VIP</option>
                  </select>
                </div>
                <div className="pk-field">
                  <label>Piso / Sector</label>
                  <input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="Ej: Piso 2" />
                </div>
                <div className="pk-field">
                  <label>Tarifa por Noche ($) *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={nightlyRate}
                    onChange={(e) => setNightlyRate(e.target.value)}
                  />
                </div>
                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-primary">
                    ➕ Agregar Habitación
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🏨 Catálogo de Acomodación y Tarifas ({rooms.length})</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Habitación</th>
                      <th>Tipo de Acomodación</th>
                      <th>Piso / Zona</th>
                      <th>Tarifa / Noche</th>
                      <th>Estado Actual</th>
                      <th>Huésped Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((r) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 800 }}>{r.roomNumber}</td>
                        <td>{r.roomType}</td>
                        <td>{r.floor}</td>
                        <td style={{ fontWeight: 800, color: 'var(--pk-primary)' }}>
                          {formatCop(r.nightlyRate)}
                        </td>
                        <td>
                          <span
                            className={`pk-badge ${
                              r.status === 'Ocupada' ? 'pk-badge-amber' : 'pk-badge-emerald'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td>{r.guestName || '—'}</td>
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
