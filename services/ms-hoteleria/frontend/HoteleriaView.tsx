import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkSelect,
  PkSimpleSelect,
  PkModal,
  PkPrintButton,
  PkKpiRow,
  PkLiveHeader,
  PkTicketCard,
  PkProcessNodes,
  PkTypeCards,
  PkFullscreenDialog,
  PkProgressBar,
  PkDistributionStrip,
  PkProcessStep,
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

type GuestProfileType = 'ejecutivo' | 'familiar' | 'corporativo';

const VALID_MODULES = ['recepcion_habitaciones', 'tarifas_temporadas'] as const;

const ROOM_TYPE_OPTIONS = [
  { value: 'Estándar Sencilla', label: 'Estándar Sencilla' },
  { value: 'Estándar Doble', label: 'Estándar Doble' },
  { value: 'Suite Ejecutiva Doble', label: 'Suite Ejecutiva Doble' },
  { value: 'Suite Presidencial / Familiar', label: 'Suite Presidencial / Familiar' },
];

const ROOM_TYPE_CARDS = [
  {
    key: 'Estándar Sencilla',
    icon: '🛏️',
    title: 'Estándar Sencilla',
    description: 'Acomodación individual ejecutiva con escritorio y conectividad.',
  },
  {
    key: 'Estándar Doble',
    icon: '🛌',
    title: 'Estándar Doble',
    description: 'Acomodación doble versátil para parejas o compañeros de viaje.',
  },
  {
    key: 'Suite Ejecutiva Doble',
    icon: '✨',
    title: 'Suite Ejecutiva Doble',
    description: 'Suite amplia con sala de estar, minibar y servicio preferencial.',
  },
  {
    key: 'Suite Presidencial / Familiar',
    icon: '👑',
    title: 'Suite Presidencial / Familiar',
    description: 'Máxima capacidad y confort para estadías familiares o VIP.',
  },
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

const GUEST_TYPE_CARDS = [
  {
    key: 'ejecutivo',
    icon: '🧳',
    title: 'Huésped Ejecutivo / Individual',
    description: 'Registro ágil individual de negocios con control de viáticos y facturación inmediata.',
    badge: 'Express',
  },
  {
    key: 'familiar',
    icon: '👨‍👩‍👧',
    title: 'Estadía Familiar / Turística',
    description: 'Alojamiento vacacional o grupal con control de acompañantes y consumos de estadía.',
    badge: 'Turismo',
  },
  {
    key: 'corporativo',
    icon: '🏢',
    title: 'Convenio Corporativo',
    description: 'Reserva empresarial respaldada por NIT corporativo y estado de cuenta consolidado.',
    badge: 'Empresa',
  },
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

  const [receptionDisplayMode, setReceptionDisplayMode] = useState<'board' | 'table'>('board');
  const [ratesDisplayMode, setRatesDisplayMode] = useState<'board' | 'table'>('board');

  const [checkInStudioOpen, setCheckInStudioOpen] = useState(false);
  const [roomStudioOpen, setRoomStudioOpen] = useState(false);

  const [statusPillFilter, setStatusPillFilter] = useState('ALL');
  const [floorPillFilter, setFloorPillFilter] = useState('ALL');
  const [roomSearch, setRoomSearch] = useState('');

  const [nextCheckInCode, setNextCheckInCode] = useState('CHK-406');
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [customers, setCustomers] = useState<GuestOption[]>([]);

  const [guestProfileType, setGuestProfileType] = useState<GuestProfileType>('ejecutivo');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [useManualGuest, setUseManualGuest] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [manualGuestName, setManualGuestName] = useState('');
  const [manualGuestDoc, setManualGuestDoc] = useState('');
  const [nights, setNights] = useState('1');
  const [companionsCount, setCompanionsCount] = useState('2');
  const [corporateCompanyRef, setCorporateCompanyRef] = useState('');

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
  const maintenanceRooms = rooms.filter((r) => r.status !== 'Disponible' && r.status !== 'Ocupada');

  const activeHotelTotal = occupiedRooms.reduce(
    (acc, r) => acc + r.nightlyRate * Math.max(1, r.nights) + (r.extrasTotal || 0),
    0
  );

  const occupancyPct = rooms.length > 0 ? Math.round((occupiedRooms.length / rooms.length) * 100) : 0;

  const hasCustomerDirectory = hasService('ms-clientes') && customers.length > 0;
  const effectiveManualMode = useManualGuest || !hasCustomerDirectory;

  const distinctFloors = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r) => {
      if (r.floor) set.add(r.floor);
    });
    return Array.from(set);
  }, [rooms]);

  const filteredRooms = useMemo(
    () =>
      rooms.filter((rm) => {
        if (statusPillFilter === 'Disponible' && rm.status !== 'Disponible') return false;
        if (statusPillFilter === 'Ocupada' && rm.status !== 'Ocupada') return false;
        if (statusPillFilter === 'Mantenimiento' && (rm.status === 'Disponible' || rm.status === 'Ocupada')) return false;
        if (floorPillFilter !== 'ALL' && rm.floor !== floorPillFilter) return false;

        const q = roomSearch.trim().toLowerCase();
        if (!q) return true;
        return (
          rm.roomNumber.toLowerCase().includes(q) ||
          rm.roomType.toLowerCase().includes(q) ||
          rm.floor.toLowerCase().includes(q) ||
          (rm.guestName || '').toLowerCase().includes(q) ||
          (rm.checkInCode || '').toLowerCase().includes(q)
        );
      }),
    [rooms, statusPillFilter, floorPillFilter, roomSearch]
  );

  const activeStudioRoom = useMemo(
    () => availableRooms.find((r) => r.id === selectedRoomId) || null,
    [availableRooms, selectedRoomId]
  );

  const estimatedCheckInSubtotal =
    (activeStudioRoom?.nightlyRate || 0) * Math.max(1, Number(nights || 1));

  const openCheckInStudio = (preselectedRoomId?: string) => {
    if (preselectedRoomId) {
      setSelectedRoomId(preselectedRoomId);
    } else if (!selectedRoomId && availableRooms.length > 0) {
      setSelectedRoomId(availableRooms[0].id);
    }
    setCheckInStudioOpen(true);
  };

  const handleGuestProfileChange = (key: string) => {
    const next = key as GuestProfileType;
    setGuestProfileType(next);
    if (next === 'ejecutivo') {
      setNights('1');
    } else if (next === 'familiar') {
      if (Number(nights || 1) < 2) setNights('3');
    } else if (next === 'corporativo') {
      if (hasCustomerDirectory) setUseManualGuest(false);
    }
  };

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
      if (guestProfileType === 'corporativo' && corporateCompanyRef.trim() && !guestName.includes(corporateCompanyRef.trim())) {
        guestName = `${guestName} (${corporateCompanyRef.trim()})`;
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
        setCorporateCompanyRef('');
        setNights('1');
        setCheckInStudioOpen(false);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible registrar el Check-In');
      }
    });
  };

  const submitCreateRoom = (origin: 'modal' | 'studio') => (e: React.FormEvent) => {
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
          setRoomStudioOpen(false);
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

  const buildRoomStayNodes = (rm: HotelRoom): PkProcessStep[] => {
    if (rm.status === 'Ocupada') {
      return [
        { step: 1, label: 'Check-In', sublabel: rm.checkInCode || 'Activo', status: 'done' },
        { step: 2, label: 'Estadía', sublabel: `${Math.max(1, rm.nights || 1)}n`, status: 'active' },
        { step: 3, label: 'Check-Out', sublabel: 'Caja POS', status: 'pending' },
      ];
    }
    return [
      { step: 1, label: 'Check-In', status: 'pending' },
      { step: 2, label: 'Estadía', status: 'pending' },
      { step: 3, label: 'Check-Out', status: 'pending' },
    ];
  };

  return (
    <div className="pk-stack">
      {currentTab === 'recepcion_habitaciones' && (
        <ModuleGate module="recepcion_habitaciones">
          <div className="pk-stack">
            <PkKpiRow
              items={[
                { label: 'Total Suites y Habitaciones', value: String(rooms.length) },
                { label: 'Disponibles Ahora', value: String(availableRooms.length), color: 'var(--pk-emerald)' },
                { label: 'Ocupación Actual', value: `${occupiedRooms.length} (${occupancyPct}%)`, color: 'var(--pk-primary)' },
                { label: 'Cartera Huéspedes en Casa', value: formatCop(activeHotelTotal), color: 'var(--pk-amber)' },
              ]}
            />

            <PkDistributionStrip
              title="Panorama de Ocupación Hotelera por Estado"
              segments={[
                { label: 'Disponibles', value: availableRooms.length, displayValue: `${availableRooms.length} hab.`, color: '#10b981' },
                { label: 'Ocupadas (Huéspedes en casa)', value: occupiedRooms.length, displayValue: `${occupiedRooms.length} hab.`, color: '#2563eb' },
                { label: 'Mantenimiento / Alistamiento', value: maintenanceRooms.length, displayValue: `${maintenanceRooms.length} hab.`, color: '#f59e0b' },
              ]}
            />

            <PkLiveHeader
              title="Recepción y Suites"
              liveLabel="Ocupación en vivo"
              subtitle="Gestiona entradas de huéspedes, cargos de minibar o restaurante y cierres de cuenta hacia facturación electrónica."
              displayMode={receptionDisplayMode}
              onDisplayModeChange={setReceptionDisplayMode}
              boardLabel="🎛️ Rack Visual"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Nuevo Check-In"
              onPrimaryAction={() => openCheckInStudio()}
              pills={[
                { key: 'ALL', label: 'Todas', count: rooms.length },
                { key: 'Disponible', label: 'Disponibles', count: availableRooms.length },
                { key: 'Ocupada', label: 'Ocupadas', count: occupiedRooms.length },
                { key: 'Mantenimiento', label: 'Mantenimiento', count: maintenanceRooms.length },
              ]}
              activePill={statusPillFilter}
              onPillChange={setStatusPillFilter}
              extraActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setShowNewRoomModal(true)}
                  >
                    + Nueva Habitación
                  </button>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={handleExportRoomsCsv}
                  >
                    📥 Exportar CSV
                  </button>
                </>
              }
            />

            <div className="pk-card" style={{ padding: '12px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                <div className="pk-pill-tabs" role="tablist" aria-label="Filtrar por piso">
                  <button
                    type="button"
                    className={`pk-pill-tab${floorPillFilter === 'ALL' ? ' active' : ''}`}
                    onClick={() => setFloorPillFilter('ALL')}
                  >
                    🏢 Todos los Pisos
                  </button>
                  {distinctFloors.map((fl) => (
                    <button
                      key={fl}
                      type="button"
                      className={`pk-pill-tab${floorPillFilter === fl ? ' active' : ''}`}
                      onClick={() => setFloorPillFilter(fl)}
                    >
                      {fl}
                    </button>
                  ))}
                </div>
                <input
                  className="pk-input pk-datatable-search"
                  style={{ minWidth: 280, flex: '1 1 280px', maxWidth: 440 }}
                  placeholder="🔎 Buscar suite, piso, acomodación, folio o huésped..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                />
              </div>
            </div>

            {receptionDisplayMode === 'board' ? (
              <div className="pk-cards-showcase">
                {filteredRooms.length === 0 ? (
                  <div className="pk-card" style={{ gridColumn: '1 / -1', padding: 32, textAlign: 'center', color: 'var(--pk-muted)' }}>
                    No se encontraron suites o habitaciones para el filtro seleccionado.
                  </div>
                ) : (
                  filteredRooms.map((rm) => {
                    const occupied = rm.status === 'Ocupada';
                    const available = rm.status === 'Disponible';
                    const stayNights = Math.max(1, rm.nights || 1);
                    const lodgingSubtotal = rm.nightlyRate * stayNights;
                    const roomTotal = occupied ? lodgingSubtotal + (rm.extrasTotal || 0) : rm.nightlyRate;

                    if (occupied) {
                      const chargeLines =
                        rm.charges && rm.charges.length > 0
                          ? rm.charges.slice(0, 3).map((ch) => ({
                              qty: 1,
                              name: ch.concept,
                              amount: formatCop(ch.amount),
                            }))
                          : rm.extrasTotal > 0
                          ? [{ qty: 1, name: 'Consumos restaurante / minibar', amount: formatCop(rm.extrasTotal) }]
                          : [];

                      return (
                        <PkTicketCard
                          key={rm.id}
                          code={`Suite ${rm.roomNumber}`}
                          timeAgo={`Folio ${rm.checkInCode} · Ingreso ${rm.checkInDate}`}
                          channelBadge={{ label: rm.roomType, tone: 'blue' }}
                          title={`👤 ${rm.guestName}`}
                          subtitle={`${rm.guestDoc ? `Doc/NIT: ${rm.guestDoc} · ` : ''}${rm.floor}`}
                          metaLine={`🌙 ${stayNights} noche(s) × ${formatCop(rm.nightlyRate)}`}
                          items={[
                            { qty: stayNights, name: `Alojamiento ${rm.roomNumber}`, amount: formatCop(lodgingSubtotal) },
                            ...chargeLines,
                          ]}
                          totalLabel="SALDO HABITACIÓN"
                          totalValue={formatCop(roomTotal)}
                          processNodes={buildRoomStayNodes(rm)}
                          statusPill={{ label: 'Huésped en Casa', tone: 'blue' }}
                          primaryAction={{
                            label: '🧾 Check-Out y Facturar',
                            tone: 'purple',
                            disabled: busy,
                            onClick: () => handleCheckoutToPos(rm),
                          }}
                          secondaryActions={
                            <>
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
                              <PkPrintButton label="🖨️ Estado Cuenta" payload={buildHotelStatementPayload(rm)} />
                            </>
                          }
                        />
                      );
                    }

                    return (
                      <PkTicketCard
                        key={rm.id}
                        code={`Suite ${rm.roomNumber}`}
                        timeAgo={rm.floor}
                        channelBadge={{ label: rm.roomType, tone: available ? 'emerald' : 'amber' }}
                        title={rm.roomType}
                        subtitle={`${rm.floor} · Acomodación lista para recepción`}
                        items={[
                          { qty: 1, name: 'Tarifa oficial por noche', amount: formatCop(rm.nightlyRate) },
                        ]}
                        totalLabel="TARIFA / NOCHE"
                        totalValue={formatCop(rm.nightlyRate)}
                        statusPill={{
                          label: available ? 'Disponible para Check-In' : rm.status,
                          tone: available ? 'emerald' : 'amber',
                        }}
                        primaryAction={
                          available
                            ? {
                                label: '🛎️ Iniciar Check-In',
                                tone: 'emerald',
                                disabled: busy,
                                onClick: () => openCheckInStudio(rm.id),
                              }
                            : undefined
                        }
                      />
                    );
                  })
                )}
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📋 Consolidado de Recepción y Cuentas de Huéspedes</div>
                </div>
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Habitación</th>
                          <th>Acomodación / Piso</th>
                          <th>Huésped / Folio</th>
                          <th>Ciclo de Estadía</th>
                          <th>Tarifa / Noche</th>
                          <th>Extras</th>
                          <th>Saldo Total</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRooms.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 24 }}>
                              No se encontraron habitaciones para el criterio aplicado.
                            </td>
                          </tr>
                        ) : (
                          filteredRooms.map((rm) => {
                            const occupied = rm.status === 'Ocupada';
                            const stayNights = Math.max(1, rm.nights || 1);
                            const roomTotal = occupied
                              ? rm.nightlyRate * stayNights + (rm.extrasTotal || 0)
                              : rm.nightlyRate;

                            return (
                              <tr key={rm.id}>
                                <td style={{ fontWeight: 900 }}>{rm.roomNumber}</td>
                                <td>
                                  <div style={{ fontWeight: 700 }}>{rm.roomType}</div>
                                  <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>{rm.floor}</div>
                                </td>
                                <td>
                                  {occupied ? (
                                    <>
                                      <div style={{ fontWeight: 700 }}>{rm.guestName}</div>
                                      <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                                        {rm.checkInCode} · {rm.checkInDate} ({stayNights}n)
                                      </div>
                                    </>
                                  ) : (
                                    <span className="pk-badge pk-badge-emerald">Disponible</span>
                                  )}
                                </td>
                                <td style={{ minWidth: 210 }}>
                                  {occupied ? (
                                    <PkProcessNodes steps={buildRoomStayNodes(rm)} compact />
                                  ) : (
                                    <span style={{ fontSize: 12, color: 'var(--pk-muted)' }}>Sin huésped asignado</span>
                                  )}
                                </td>
                                <td>{formatCop(rm.nightlyRate)}</td>
                                <td>{occupied ? formatCop(rm.extrasTotal || 0) : '—'}</td>
                                <td style={{ fontWeight: 800 }}>{formatCop(roomTotal)}</td>
                                <td>
                                  <div className="pk-row-actions">
                                    {occupied ? (
                                      <>
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
                                            + Cargo
                                          </button>
                                        </FeatureGate>
                                        <PkPrintButton label="🖨️ Cuenta" payload={buildHotelStatementPayload(rm)} />
                                        <button
                                          type="button"
                                          className="pk-btn pk-btn-emerald pk-btn-sm"
                                          disabled={busy}
                                          onClick={() => handleCheckoutToPos(rm)}
                                        >
                                          🧾 Check-Out
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        className="pk-btn pk-btn-primary pk-btn-sm"
                                        onClick={() => openCheckInStudio(rm.id)}
                                      >
                                        🛎️ Check-In
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <PkFullscreenDialog
              open={checkInStudioOpen}
              title="Estudio Concierge de Recepción y Check-In Hotelero"
              subtitle="Selecciona el perfil del huésped, asigna la suite disponible y confirma el plan de noches."
              badge={{ label: nextCheckInCode, tone: 'emerald' }}
              onClose={() => setCheckInStudioOpen(false)}
              subheader={
                <PkTypeCards
                  label="1. Perfil de Estadía / Tipo de Huésped"
                  options={GUEST_TYPE_CARDS}
                  value={guestProfileType}
                  onChange={handleGuestProfileChange}
                  disabled={busy}
                />
              }
              footerLeft={
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--pk-muted)', fontWeight: 700 }}>SUITE SELECCIONADA</div>
                    <div style={{ fontWeight: 900, color: 'var(--pk-navy)' }}>
                      {activeStudioRoom ? `${activeStudioRoom.roomNumber} (${activeStudioRoom.roomType})` : 'Sin seleccionar'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--pk-muted)', fontWeight: 700 }}>SUBTOTAL ALOJAMIENTO</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--pk-emerald)' }}>
                      {formatCop(estimatedCheckInSubtotal)}
                    </div>
                  </div>
                </div>
              }
              footerActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setCheckInStudioOpen(false)}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    form="hoteleria-checkin-studio-form"
                    className="pk-btn pk-btn-primary"
                    disabled={busy || availableRooms.length === 0}
                  >
                    {busy ? 'Procesando...' : '🏨 Confirmar Check-In y Entregar Llave'}
                  </button>
                </>
              }
            >
              <form id="hoteleria-checkin-studio-form" onSubmit={handleCheckIn} className="pk-stack">
                <div className="pk-card">
                  <div className="pk-card-head">
                    <div className="pk-card-title">2. Selección de Suite Disponible y Plan de Noches</div>
                    <button
                      type="button"
                      className="pk-btn pk-btn-outline pk-btn-sm"
                      onClick={() => setShowNewRoomModal(true)}
                    >
                      + Registrar Nueva Habitación
                    </button>
                  </div>
                  <div className="pk-card-body pk-stack">
                    {availableRooms.length > 0 && (
                      <div className="pk-type-grid">
                        {availableRooms.slice(0, 6).map((rm) => {
                          const isSelected = rm.id === selectedRoomId;
                          return (
                            <button
                              key={rm.id}
                              type="button"
                              className={`pk-type-card${isSelected ? ' active' : ''}`}
                              onClick={() => setSelectedRoomId(rm.id)}
                            >
                              <span className="pk-type-icon">🔑</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                                  <span className="pk-type-title">Hab. {rm.roomNumber}</span>
                                  <span className="pk-badge pk-badge-emerald">{formatCop(rm.nightlyRate)}</span>
                                </div>
                                <div className="pk-type-desc">{rm.roomType} · {rm.floor}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="pk-form-grid">
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

                      <div className="pk-field">
                        <label>Noches de Estadía *</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            required
                            type="number"
                            min="1"
                            max="365"
                            value={nights}
                            onChange={(e) => setNights(e.target.value)}
                          />
                          {[1, 2, 3, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              className={`pk-btn ${Number(nights) === n ? 'pk-btn-primary' : 'pk-btn-outline'} pk-btn-sm`}
                              onClick={() => setNights(String(n))}
                            >
                              {n}n
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pk-card">
                  <div className="pk-card-head">
                    <div className="pk-card-title">
                      3. Registro del Titular ({guestProfileType === 'corporativo' ? 'Empresa / Convenio' : guestProfileType === 'familiar' ? 'Grupo Familiar' : 'Huésped Ejecutivo'})
                    </div>
                    {hasCustomerDirectory && (
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        onClick={() => setUseManualGuest((v) => !v)}
                      >
                        {effectiveManualMode ? '📋 Elegir de Directorio Clientes' : '✍️ Ingresar Huésped Directo'}
                      </button>
                    )}
                  </div>
                  <div className="pk-card-body">
                    <div className="pk-form-grid cols-2">
                      {effectiveManualMode ? (
                        <>
                          <div className="pk-field">
                            <label>
                              {guestProfileType === 'corporativo'
                                ? 'Huésped / Funcionario Autorizado *'
                                : 'Nombre Completo del Huésped *'}
                            </label>
                            <input
                              required
                              value={manualGuestName}
                              onChange={(e) => setManualGuestName(e.target.value)}
                              placeholder="Ej: Carolina Gómez / Ejecutivo Asignado"
                            />
                          </div>
                          <div className="pk-field">
                            <label>{guestProfileType === 'corporativo' ? 'NIT Corporativo / Documento' : 'Documento / Pasaporte'}</label>
                            <input
                              value={manualGuestDoc}
                              onChange={(e) => setManualGuestDoc(e.target.value)}
                              placeholder={guestProfileType === 'corporativo' ? 'Ej: 900.412.890-1' : 'Ej: 1.037.614.920'}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="pk-col-span-full">
                          <PkSelect
                            label="Huésped / Empresa Registrada *"
                            items={customers}
                            value={selectedGuestId}
                            onChange={setSelectedGuestId}
                            getValue={(c) => c.id}
                            getLabel={(c) => `${c.name}${c.nit ? ` (${c.nit})` : ''}`}
                            searchable
                          />
                        </div>
                      )}

                      {guestProfileType === 'familiar' && (
                        <div className="pk-field pk-col-span-full">
                          <label>Número Estimado de Huéspedes en la Suite</label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={companionsCount}
                            onChange={(e) => setCompanionsCount(e.target.value)}
                          />
                        </div>
                      )}

                      {guestProfileType === 'corporativo' && effectiveManualMode && (
                        <div className="pk-field pk-col-span-full">
                          <label>Empresa o Referencia de Convenio</label>
                          <input
                            value={corporateCompanyRef}
                            onChange={(e) => setCorporateCompanyRef(e.target.value)}
                            placeholder="Ej: Constructora Andina S.A.S. — Orden Viáticos"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            </PkFullscreenDialog>

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
            <PkLiveHeader
              title="Inventario de Suites y Tarifario Hotelero"
              liveLabel="Tarifario vigente"
              subtitle="Administra el catálogo oficial de habitaciones, acomodaciones por piso y tarifas por noche."
              displayMode={ratesDisplayMode}
              onDisplayModeChange={setRatesDisplayMode}
              boardLabel="🎛️ Catálogo Visual"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Agregar Habitación"
              onPrimaryAction={() => setRoomStudioOpen(true)}
              extraActions={
                <button
                  type="button"
                  className="pk-btn pk-btn-outline"
                  onClick={handleExportRoomsCsv}
                >
                  📥 Exportar Tarifario CSV
                </button>
              }
            />

            <div className="pk-card" style={{ padding: '12px 18px' }}>
              <input
                className="pk-input pk-datatable-search"
                style={{ width: '100%' }}
                placeholder="🔎 Buscar en el tarifario por código, habitación, acomodación o piso..."
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
              />
            </div>

            {ratesDisplayMode === 'board' ? (
              <div className="pk-cards-showcase">
                {filteredRooms.map((r) => (
                  <PkTicketCard
                    key={r.id}
                    code={`Hab. ${r.roomNumber}`}
                    timeAgo={r.id.toUpperCase()}
                    channelBadge={{
                      label: r.floor,
                      tone: r.status === 'Ocupada' ? 'blue' : 'emerald',
                    }}
                    title={r.roomType}
                    subtitle={`Ubicación: ${r.floor}`}
                    extraBody={
                      <PkProgressBar
                        label="Posicionamiento tarifario"
                        valueLabel={`${formatCop(r.nightlyRate)} / noche`}
                        pct={Math.min(100, Math.round((r.nightlyRate / 450000) * 100))}
                        tone={r.status === 'Ocupada' ? 'blue' : 'emerald'}
                      />
                    }
                    totalLabel="TARIFA OFICIAL NOCHE"
                    totalValue={formatCop(r.nightlyRate)}
                    statusPill={{
                      label: r.status,
                      tone: r.status === 'Ocupada' ? 'blue' : 'emerald',
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📋 Inventario de Habitaciones y Tarifas Vigentes</div>
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

            <PkFullscreenDialog
              open={roomStudioOpen}
              title="Estudio de Configuración de Suite y Tarifario"
              subtitle="Define la categoría de acomodación, ubicación en torre/piso y tarifa oficial por noche."
              onClose={() => setRoomStudioOpen(false)}
              subheader={
                <PkTypeCards
                  label="1. Categoría de Acomodación"
                  options={ROOM_TYPE_CARDS}
                  value={roomType}
                  onChange={setRoomType}
                  disabled={busy}
                />
              }
              footerActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setRoomStudioOpen(false)}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    form="hoteleria-room-studio-form"
                    className="pk-btn pk-btn-primary"
                    disabled={busy}
                  >
                    {busy ? 'Guardando...' : '💾 Agregar Suite al Tarifario'}
                  </button>
                </>
              }
            >
              <form id="hoteleria-room-studio-form" onSubmit={submitCreateRoom('studio')} className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">2. Identificación y Tarifa Oficial</div>
                </div>
                <div className="pk-card-body">
                  <div className="pk-form-grid">
                    <div className="pk-field">
                      <label>Número o Nombre de Habitación *</label>
                      <input
                        required
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value)}
                        placeholder="Ej: 205 o Suite 402"
                      />
                    </div>

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
                  </div>
                </div>
              </form>
            </PkFullscreenDialog>
          </div>
        </ModuleGate>
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
    </div>
  );
};

export default HoteleriaView;
