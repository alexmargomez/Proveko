import React, { useState, useEffect, useCallback } from 'react';
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
  downloadCsvUtf8,
} from '@platform/ui-sdk';

interface HeavyVehicle {
  id: string;
  code: string;
  plate: string;
  brand: string;
  axleConfig: string;
  referenceTareKg: number;
}

interface Driver {
  id: string;
  code: string;
  name: string;
  docNumber: string;
  licenseCategory: string;
  phone: string;
}

interface Carrier {
  id: string;
  code: string;
  name: string;
  nit: string;
  city: string;
  phone: string;
}

interface CargoRoute {
  id: string;
  code: string;
  description: string;
  origin: string;
  destination: string;
}

interface ScaleTicket {
  id: string;
  date: string;
  vehicleId: string;
  plate: string;
  driverId: string;
  driverName: string;
  carrierId: string;
  carrierName: string;
  cargoId: string;
  cargoDesc: string;
  grossKg: number;
  tareKg: number;
  netKg: number;
  status: string;
}

interface BasculaStateResponse {
  ok: boolean;
  nextTicketCode: string;
  nextVehicleCode: string;
  nextDriverCode: string;
  nextCarrierCode: string;
  nextRouteCode: string;
  tickets: ScaleTicket[];
  vehicles: HeavyVehicle[];
  drivers: Driver[];
  carriers: Carrier[];
  routes: CargoRoute[];
}

const VALID_MODULES = ['pesaje_camionero', 'flota_conductores', 'rutas_manifiestos'] as const;

const AXLE_OPTIONS = [
  { value: 'C3S3 Tractocamión 6 Ejes', label: 'C3S3 Tractocamión 6 Ejes' },
  { value: 'C3S2 Dobletroque 5 Ejes', label: 'C3S2 Dobletroque 5 Ejes' },
  { value: 'C3 Volqueta Dobletroque', label: 'C3 Volqueta Dobletroque' },
  { value: 'C2 Camión Sencillo', label: 'C2 Camión Sencillo' },
];

const LICENSE_OPTIONS = [
  { value: 'C3', label: 'C3 — Articulados Pesados' },
  { value: 'C2', label: 'C2 — Camiones Rígidos' },
  { value: 'C1', label: 'C1 — Servicio Público Liviano' },
];

export const BasculaView: React.FC = () => {
  const { activeModuleKey, hasModule, hasFeature, apiGet, apiPost, toast } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [ticketMode, setTicketMode] = useState<'list' | 'create'>('list');
  const [ticketSearch, setTicketSearch] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');

  const [fleetMode, setFleetMode] = useState<'list' | 'create'>('list');
  const [fleetSearch, setFleetSearch] = useState('');

  const [routeMode, setRouteMode] = useState<'list' | 'create'>('list');
  const [routeSearch, setRouteSearch] = useState('');

  const [nextTicketCode, setNextTicketCode] = useState('BAS-1006');
  const [nextVehicleCode, setNextVehicleCode] = useState('CAM-303');
  const [nextDriverCode, setNextDriverCode] = useState('COND-203');
  const [nextCarrierCode, setNextCarrierCode] = useState('TRN-403');
  const [nextRouteCode, setNextRouteCode] = useState('CAR-106');

  const [tickets, setTickets] = useState<ScaleTicket[]>([]);
  const [vehicles, setVehicles] = useState<HeavyVehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [routes, setRoutes] = useState<CargoRoute[]>([]);

  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [cargoId, setCargoId] = useState('');
  const [grossKg, setGrossKg] = useState('48500');
  const [tareKg, setTareKg] = useState('16200');

  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehPlate, setVehPlate] = useState('');
  const [vehBrand, setVehBrand] = useState('');
  const [vehAxle, setVehAxle] = useState('C3S3 Tractocamión 6 Ejes');
  const [vehTare, setVehTare] = useState('16200');

  const [showDriverModal, setShowDriverModal] = useState(false);
  const [drvName, setDrvName] = useState('');
  const [drvDoc, setDrvDoc] = useState('');
  const [drvCat, setDrvCat] = useState('C3');
  const [drvPhone, setDrvPhone] = useState('');

  const [showCarrierModal, setShowCarrierModal] = useState(false);
  const [carName, setCarName] = useState('');
  const [carNit, setCarNit] = useState('');
  const [carCity, setCarCity] = useState('Bogotá D.C.');
  const [carPhone, setCarPhone] = useState('');

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeDesc, setRouteDesc] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<BasculaStateResponse>('/api/v1/bascula/all');
      const vList = data.vehicles || [];
      const dList = data.drivers || [];
      const cList = data.carriers || [];
      const rList = data.routes || [];

      setNextTicketCode(data.nextTicketCode || 'BAS-1006');
      setNextVehicleCode(data.nextVehicleCode || 'CAM-303');
      setNextDriverCode(data.nextDriverCode || 'COND-203');
      setNextCarrierCode(data.nextCarrierCode || 'TRN-403');
      setNextRouteCode(data.nextRouteCode || 'CAR-106');

      setTickets(data.tickets || []);
      setVehicles(vList);
      setDrivers(dList);
      setCarriers(cList);
      setRoutes(rList);

      setVehicleId((prev) => {
        if (prev && vList.some((v) => v.id === prev)) return prev;
        if (vList.length > 0) {
          setTareKg(String(vList[0].referenceTareKg || 16200));
          return vList[0].id;
        }
        return '';
      });
      setDriverId((prev) => (prev && dList.some((d) => d.id === prev) ? prev : dList[0]?.id || ''));
      setCarrierId((prev) => (prev && cList.some((c) => c.id === prev) ? prev : cList[0]?.id || ''));
      setCargoId((prev) => (prev && rList.some((r) => r.id === prev) ? prev : rList[0]?.id || ''));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No fue posible cargar la estación de báscula');
    }
  }, [apiGet, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const currentTab =
    (VALID_MODULES as readonly string[]).includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : VALID_MODULES.find((m) => hasModule(m)) || 'pesaje_camionero';

  const grossNumeric = Number(grossKg || 0);
  const tareNumeric = Number(tareKg || 0);
  const liveNetKg = grossNumeric > tareNumeric && tareNumeric > 0 ? grossNumeric - tareNumeric : 0;

  const totalNetDispatchedKg = tickets.reduce((acc, t) => acc + (t.netKg || 0), 0);
  const totalTons = (totalNetDispatchedKg / 1000).toFixed(2);
  const dualSignatureEnabled = hasFeature('pesaje_camionero', 'tiquete_doble_firma');

  const handleSelectVehicle = (id: string) => {
    setVehicleId(id);
    const found = vehicles.find((v) => v.id === id);
    if (found && found.referenceTareKg > 0) {
      setTareKg(String(found.referenceTareKg));
    }
  };

  const handleEmitScaleTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(tareNumeric) || tareNumeric <= 0) {
      toast('El peso tara debe ser un valor positivo mayor a cero');
      return;
    }
    if (!Number.isFinite(grossNumeric) || grossNumeric <= tareNumeric) {
      toast('El peso bruto debe ser estrictamente mayor al peso tara');
      return;
    }
    void run(async () => {
      try {
        const res = await apiPost<{ ticket: ScaleTicket }>('/api/v1/bascula/tickets', {
          vehicleId,
          driverId,
          carrierId,
          cargoId,
          grossKg: grossNumeric,
          tareKg: tareNumeric,
        });
        toast(
          `Tiquete ${res.ticket.id} emitido (${res.ticket.netKg.toLocaleString('es-CO')} kg netos destarados)`
        );
        await reload();
        setTicketMode('list');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible emitir el tiquete de báscula');
      }
    });
  };

  const submitCreateVehicle = (originMode: 'modal' | 'page') => (e: React.FormEvent) => {
    e.preventDefault();
    const tareNum = Number(vehTare || 0);
    if (vehPlate.trim().length < 5 || !vehBrand.trim() || !Number.isFinite(tareNum) || tareNum <= 0) {
      toast('Ingresa placa válida, marca del tractocamión y peso tara de referencia mayor a cero');
      return;
    }
    void run(async () => {
      try {
        const res = await apiPost<{ vehicle: HeavyVehicle }>('/api/v1/bascula/vehicles', {
          plate: vehPlate.trim().toUpperCase(),
          brand: vehBrand.trim(),
          axleConfig: vehAxle,
          referenceTareKg: tareNum,
        });
        toast(`Tractocamión registrado: ${res.vehicle.plate} (${res.vehicle.code})`);
        setVehPlate('');
        setVehBrand('');
        if (originMode === 'modal') {
          setShowVehicleModal(false);
        } else {
          setFleetMode('list');
        }
        await reload();
        setVehicleId(res.vehicle.id);
        setTareKg(String(res.vehicle.referenceTareKg));
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al registrar el tractocamión');
      }
    });
  };

  const submitCreateDriver = (originMode: 'modal' | 'page') => (e: React.FormEvent) => {
    e.preventDefault();
    if (!drvName.trim() || !drvDoc.trim()) {
      toast('Ingresa el nombre completo y documento del conductor');
      return;
    }
    void run(async () => {
      try {
        const res = await apiPost<{ driver: Driver }>('/api/v1/bascula/drivers', {
          name: drvName.trim(),
          docNumber: drvDoc.trim(),
          licenseCategory: drvCat,
          phone: drvPhone.trim(),
        });
        toast(`Conductor registrado: ${res.driver.name} (${res.driver.code})`);
        setDrvName('');
        setDrvDoc('');
        setDrvPhone('');
        if (originMode === 'modal') {
          setShowDriverModal(false);
        } else {
          setFleetMode('list');
        }
        await reload();
        setDriverId(res.driver.id);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al registrar el conductor');
      }
    });
  };

  const submitCreateCarrier = (originMode: 'modal' | 'page') => (e: React.FormEvent) => {
    e.preventDefault();
    if (!carName.trim() || !carNit.trim()) {
      toast('Ingresa razón social y NIT de la empresa transportadora');
      return;
    }
    void run(async () => {
      try {
        const res = await apiPost<{ carrier: Carrier }>('/api/v1/bascula/carriers', {
          name: carName.trim(),
          nit: carNit.trim(),
          city: carCity.trim(),
          phone: carPhone.trim(),
        });
        toast(`Transportadora registrada: ${res.carrier.name} (${res.carrier.code})`);
        setCarName('');
        setCarNit('');
        setCarPhone('');
        if (originMode === 'modal') {
          setShowCarrierModal(false);
        } else {
          setFleetMode('list');
        }
        await reload();
        setCarrierId(res.carrier.id);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al registrar la transportadora');
      }
    });
  };

  const submitCreateRoute = (originMode: 'modal' | 'page') => (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeDesc.trim()) {
      toast('Ingresa la descripción del tipo de carga o ruta');
      return;
    }
    void run(async () => {
      try {
        const res = await apiPost<{ route: CargoRoute }>('/api/v1/bascula/routes', {
          description: routeDesc.trim(),
          origin: origin.trim(),
          destination: destination.trim(),
        });
        toast(`Ruta / Carga registrada: ${res.route.code}`);
        setRouteDesc('');
        setOrigin('');
        setDestination('');
        if (originMode === 'modal') {
          setShowRouteModal(false);
        } else {
          setRouteMode('list');
        }
        await reload();
        setCargoId(res.route.id);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al registrar la ruta o carga');
      }
    });
  };

  const handleExportTicketsCsv = () => {
    downloadCsvUtf8(
      'tiquetes_bascula.csv',
      ['Tiquete', 'Fecha', 'Placa', 'Conductor', 'Transportadora', 'Carga / Ruta', 'Bruto kg', 'Tara kg', 'Neto kg'],
      tickets.map((t) => [
        t.id,
        t.date,
        t.plate,
        t.driverName,
        t.carrierName,
        t.cargoDesc,
        t.grossKg,
        t.tareKg,
        t.netKg,
      ])
    );
  };

  const handleExportRoutesCsv = () => {
    downloadCsvUtf8(
      'rutas_cargas_bascula.csv',
      ['Código', 'Descripción Carga', 'Origen', 'Destino', 'Viajes', 'Peso Neto Total kg'],
      routes.map((r) => {
        const matched = tickets.filter((t) => t.cargoId === r.id);
        const sumKg = matched.reduce((acc, t) => acc + t.netKg, 0);
        return [r.code, r.description, r.origin, r.destination, matched.length, sumKg];
      })
    );
  };

  const buildTicketPrintPayload = (tk: ScaleTicket): Record<string, unknown> => {
    const extraFields: Record<string, string> = {
      'Placa Tractocamión': tk.plate,
      Conductor: tk.driverName,
      Transportadora: tk.carrierName,
      'Carga / Ruta': tk.cargoDesc,
      'Peso Bruto': `${tk.grossKg.toLocaleString('es-CO')} kg`,
      'Peso Tara': `${tk.tareKg.toLocaleString('es-CO')} kg`,
      'Peso Neto Destarado': `${tk.netKg.toLocaleString('es-CO')} kg`,
    };

    if (dualSignatureEnabled) {
      extraFields['Firma Conductor'] = `______________________ (${tk.driverName})`;
      extraFields['Firma Operador Báscula'] = '______________________ (Operador Certificado)';
    }

    return {
      document_type: 'TIQUETE_BASCULA',
      layout_variant: 'carta_membrete',
      document_number: tk.id,
      issue_date: tk.date,
      customer_name: tk.carrierName,
      extra_fields: extraFields,
      items: [
        {
          code: tk.id,
          description: `Pesaje Camionero Certificado — ${tk.cargoDesc} [Bruto: ${tk.grossKg.toLocaleString(
            'es-CO'
          )} kg | Tara: ${tk.tareKg.toLocaleString('es-CO')} kg | Neto: ${tk.netKg.toLocaleString('es-CO')} kg]`,
          quantity: tk.netKg,
          unit_price: 0,
          subtotal: 0,
        },
      ],
      subtotal: 0,
      grand_total: 0,
      notes: dualSignatureEnabled
        ? 'TIQUETE OFICIAL CON DOBLE FIRMA DE CONFORMIDAD: Conductor del vehículo y Operador de Báscula.'
        : 'Tiquete oficial de pesaje camionero certificado.',
    };
  };

  const filteredTickets = tickets.filter((tk) => {
    if (carrierFilter && tk.carrierId !== carrierFilter) return false;
    const q = ticketSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      tk.id.toLowerCase().includes(q) ||
      tk.plate.toLowerCase().includes(q) ||
      tk.driverName.toLowerCase().includes(q) ||
      tk.carrierName.toLowerCase().includes(q) ||
      tk.cargoDesc.toLowerCase().includes(q)
    );
  });

  const fleetQuery = fleetSearch.trim().toLowerCase();
  const filteredVehicles = vehicles.filter(
    (v) =>
      !fleetQuery ||
      v.code.toLowerCase().includes(fleetQuery) ||
      v.plate.toLowerCase().includes(fleetQuery) ||
      v.brand.toLowerCase().includes(fleetQuery) ||
      v.axleConfig.toLowerCase().includes(fleetQuery)
  );
  const filteredDrivers = drivers.filter(
    (d) =>
      !fleetQuery ||
      d.code.toLowerCase().includes(fleetQuery) ||
      d.name.toLowerCase().includes(fleetQuery) ||
      d.docNumber.toLowerCase().includes(fleetQuery)
  );
  const filteredCarriers = carriers.filter(
    (c) =>
      !fleetQuery ||
      c.code.toLowerCase().includes(fleetQuery) ||
      c.name.toLowerCase().includes(fleetQuery) ||
      c.nit.toLowerCase().includes(fleetQuery) ||
      c.city.toLowerCase().includes(fleetQuery)
  );

  const routeQuery = routeSearch.trim().toLowerCase();
  const filteredRoutes = routes.filter(
    (r) =>
      !routeQuery ||
      r.code.toLowerCase().includes(routeQuery) ||
      r.description.toLowerCase().includes(routeQuery) ||
      r.origin.toLowerCase().includes(routeQuery) ||
      r.destination.toLowerCase().includes(routeQuery)
  );

  return (
    <div className="pk-stack">
      {currentTab === 'pesaje_camionero' && (
        <ModuleGate module="pesaje_camionero">
          <div className="pk-stack">
            <PkKpiRow
              items={[
                { label: 'Tiquetes Emitidos', value: String(tickets.length), color: 'var(--pk-primary)' },
                {
                  label: 'Peso Neto Acumulado',
                  value: `${totalNetDispatchedKg.toLocaleString('es-CO')} kg`,
                  color: 'var(--pk-emerald)',
                },
                { label: 'Toneladas Despachadas', value: `${totalTons} Ton`, color: '#0f172a' },
                {
                  label: 'Flota y Conductores',
                  value: `${vehicles.length} camiones · ${drivers.length} cond.`,
                  color: 'var(--pk-amber)',
                },
              ]}
            />

            <PkViewSwitcher
              title="Estación de Pesaje Camionero y Tiquetes"
              subtitle="Consulta el historial certificado de tiquetes de báscula o registra un nuevo pesaje con destare."
              mode={ticketMode}
              onModeChange={setTicketMode}
              listLabel="🧾 Historial de Tiquetes"
              createLabel="+ Emitir Tiquete"
              count={tickets.length}
              extraActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setShowVehicleModal(true)}
                  >
                    + Nuevo Camión
                  </button>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setShowDriverModal(true)}
                  >
                    + Nuevo Conductor
                  </button>
                  {ticketMode === 'list' && (
                    <button type="button" className="pk-btn pk-btn-outline" onClick={handleExportTicketsCsv}>
                      📥 Exportar CSV
                    </button>
                  )}
                </>
              }
            />

            {ticketMode === 'create' ? (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">⚖️ Estación de Pesaje Camionero y Destare Oficial</div>
                  <div
                    style={{
                      background: liveNetKg > 0 ? '#d1fae5' : '#fee2e2',
                      color: liveNetKg > 0 ? '#065f46' : '#991b1b',
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontWeight: 800,
                      fontSize: 13.5,
                    }}
                  >
                    Peso Neto Destarado: {liveNetKg.toLocaleString('es-CO')} kg
                  </div>
                </div>
                <div className="pk-card-body">
                  <form onSubmit={handleEmitScaleTicket} className="pk-form-grid cols-2">
                    <PkAutoCodeInput label="N° Tiquete Báscula" value={nextTicketCode} />

                    <PkSelect
                      label="Placa Tractocamión *"
                      items={vehicles}
                      value={vehicleId}
                      onChange={handleSelectVehicle}
                      getValue={(v) => v.id}
                      getLabel={(v) =>
                        `${v.plate} — ${v.brand} (Tara ref: ${v.referenceTareKg.toLocaleString('es-CO')} kg)`
                      }
                      onCreateNew={() => setShowVehicleModal(true)}
                      createLabel="+ Nuevo Camión"
                      searchable
                    />

                    <PkSelect
                      label="Conductor Asignado *"
                      items={drivers}
                      value={driverId}
                      onChange={setDriverId}
                      getValue={(d) => d.id}
                      getLabel={(d) => `${d.name} (${d.docNumber} · Lic. ${d.licenseCategory})`}
                      onCreateNew={() => setShowDriverModal(true)}
                      createLabel="+ Nuevo Conductor"
                      searchable
                    />

                    <PkSelect
                      label="Empresa Transportadora *"
                      items={carriers}
                      value={carrierId}
                      onChange={setCarrierId}
                      getValue={(c) => c.id}
                      getLabel={(c) => `${c.name} (${c.nit})`}
                      onCreateNew={() => setShowCarrierModal(true)}
                      createLabel="+ Nueva Transportadora"
                      searchable
                    />

                    <PkSelect
                      label="Carga / Ruta de Manifiesto *"
                      items={routes}
                      value={cargoId}
                      onChange={setCargoId}
                      getValue={(r) => r.id}
                      getLabel={(r) =>
                        r.origin && r.destination
                          ? `${r.code} — ${r.description} (${r.origin} -> ${r.destination})`
                          : `${r.code} — ${r.description}`
                      }
                      onCreateNew={() => setShowRouteModal(true)}
                      createLabel="+ Nueva Ruta"
                      searchable
                    />

                    <div className="pk-field">
                      <label>Peso Bruto en Plataforma (kg) *</label>
                      <input
                        required
                        type="number"
                        min="1"
                        step="10"
                        value={grossKg}
                        onChange={(e) => setGrossKg(e.target.value)}
                      />
                    </div>

                    <div className="pk-field">
                      <label>Peso Tara Vehículo Vacío (kg) *</label>
                      <input
                        required
                        type="number"
                        min="1"
                        step="10"
                        value={tareKg}
                        onChange={(e) => setTareKg(e.target.value)}
                      />
                    </div>

                    <div className="pk-form-actions">
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline"
                        onClick={() => setTicketMode('list')}
                        disabled={busy}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="pk-btn pk-btn-primary"
                        disabled={busy || liveNetKg <= 0}
                      >
                        {busy ? 'Emitiendo...' : '⚖️ Emitir Tiquete Oficial'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">🧾 Historial de Tiquetes de Pesaje Certificados</div>
                </div>
                <div className="pk-datatable-toolbar">
                  <input
                    className="pk-input pk-datatable-search"
                    placeholder="🔎 Buscar por tiquete, placa, conductor o carga..."
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 260 }}>
                      <PkSimpleSelect
                        ariaLabel="Filtrar por empresa transportadora"
                        value={carrierFilter}
                        onChange={setCarrierFilter}
                        allowClear
                        placeholder="Todas las transportadoras"
                        options={[
                          { value: '', label: 'Todas las transportadoras' },
                          ...carriers.map((c) => ({
                            value: c.id,
                            label: c.name,
                            sublabel: c.nit,
                          })),
                        ]}
                      />
                    </div>
                    <span className="pk-badge pk-badge-slate">{filteredTickets.length} tiquetes</span>
                  </div>
                </div>
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Tiquete</th>
                          <th>Placa / Conductor</th>
                          <th>Transportadora</th>
                          <th>Carga / Ruta</th>
                          <th>Bruto (kg)</th>
                          <th>Tara (kg)</th>
                          <th>Neto (kg)</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTickets.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              {tickets.length === 0
                                ? 'No hay tiquetes emitidos todavía. Haz clic en "+ Emitir Tiquete" para registrar un pesaje.'
                                : 'No se encontraron tiquetes con el criterio seleccionado.'}
                            </td>
                          </tr>
                        ) : (
                          filteredTickets.map((tk) => (
                            <tr key={tk.id}>
                              <td>
                                <div style={{ fontWeight: 800 }}>{tk.id}</div>
                                <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{tk.date}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 800 }}>{tk.plate}</div>
                                <div style={{ fontSize: 11.5, color: '#475569' }}>{tk.driverName}</div>
                              </td>
                              <td>{tk.carrierName}</td>
                              <td>{tk.cargoDesc}</td>
                              <td className="num">{tk.grossKg.toLocaleString('es-CO')}</td>
                              <td className="num">{tk.tareKg.toLocaleString('es-CO')}</td>
                              <td className="num" style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>
                                {tk.netKg.toLocaleString('es-CO')} kg
                              </td>
                              <td>
                                <PkPrintButton label="🖨️ Tiquete" payload={buildTicketPrintPayload(tk)} />
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

      {currentTab === 'flota_conductores' && (
        <ModuleGate module="flota_conductores">
          <div className="pk-stack">
            <PkKpiRow
              items={[
                { label: 'Flota Pesada', value: String(vehicles.length), color: 'var(--pk-primary)' },
                { label: 'Conductores Activos', value: String(drivers.length), color: 'var(--pk-emerald)' },
                { label: 'Transportadoras', value: String(carriers.length), color: 'var(--pk-amber)' },
                { label: 'Próximo Código Flota', value: nextVehicleCode, color: '#0f172a' },
              ]}
            />

            <PkViewSwitcher
              title="Flota Pesada, Conductores y Empresas Transportadoras"
              subtitle="Administra el directorio logístico de tractocamiones, conductores de carga y empresas aliadas."
              mode={fleetMode}
              onModeChange={setFleetMode}
              listLabel="🚛 Directorio de Flota y Conductores"
              createLabel="+ Registrar Vehículo / Conductor"
              count={vehicles.length + drivers.length + carriers.length}
              extraActions={
                <button
                  type="button"
                  className="pk-btn pk-btn-outline"
                  onClick={() => setShowCarrierModal(true)}
                >
                  + Nueva Transportadora
                </button>
              }
            />

            {fleetMode === 'create' ? (
              <div className="pk-stack">
                <div className="pk-grid-2">
                  <div className="pk-card">
                    <div className="pk-card-head">
                      <div className="pk-card-title">🚛 Registrar Tractocamión / Vehículo Pesado</div>
                      <span className="pk-badge pk-badge-blue">{nextVehicleCode}</span>
                    </div>
                    <div className="pk-card-body">
                      <form onSubmit={submitCreateVehicle('page')} className="pk-form-grid cols-2">
                        <PkAutoCodeInput label="Código Flota" value={nextVehicleCode} />
                        <div className="pk-field">
                          <label>Placa *</label>
                          <input
                            required
                            value={vehPlate}
                            onChange={(e) => setVehPlate(e.target.value.toUpperCase())}
                            placeholder="Ej: TRK945"
                          />
                        </div>
                        <div className="pk-field">
                          <label>Marca y Línea *</label>
                          <input
                            required
                            value={vehBrand}
                            onChange={(e) => setVehBrand(e.target.value)}
                            placeholder="Ej: Freightliner Cascadia DD15"
                          />
                        </div>
                        <PkSimpleSelect
                          label="Configuración Ejes"
                          value={vehAxle}
                          onChange={setVehAxle}
                          options={AXLE_OPTIONS}
                        />
                        <div className="pk-field pk-col-span-full">
                          <label>Peso Tara Referencia (kg) *</label>
                          <input
                            required
                            type="number"
                            min="500"
                            step="50"
                            value={vehTare}
                            onChange={(e) => setVehTare(e.target.value)}
                          />
                        </div>
                        <div className="pk-form-actions">
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline"
                            onClick={() => setFleetMode('list')}
                            disabled={busy}
                          >
                            Cancelar
                          </button>
                          <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                            💾 Guardar Tractocamión
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>

                  <div className="pk-card">
                    <div className="pk-card-head">
                      <div className="pk-card-title">🪪 Registrar Conductor de Carga</div>
                      <span className="pk-badge pk-badge-emerald">{nextDriverCode}</span>
                    </div>
                    <div className="pk-card-body">
                      <form onSubmit={submitCreateDriver('page')} className="pk-form-grid cols-2">
                        <PkAutoCodeInput label="Código Conductor" value={nextDriverCode} />
                        <div className="pk-field">
                          <label>Nombre Completo *</label>
                          <input
                            required
                            value={drvName}
                            onChange={(e) => setDrvName(e.target.value)}
                            placeholder="Ej: Álvaro Ríos"
                          />
                        </div>
                        <div className="pk-field">
                          <label>Cédula *</label>
                          <input
                            required
                            value={drvDoc}
                            onChange={(e) => setDrvDoc(e.target.value)}
                            placeholder="Ej: 79.812.304"
                          />
                        </div>
                        <PkSimpleSelect
                          label="Categoría Licencia"
                          value={drvCat}
                          onChange={setDrvCat}
                          options={LICENSE_OPTIONS}
                        />
                        <div className="pk-field pk-col-span-full">
                          <label>Teléfono Móvil</label>
                          <input
                            value={drvPhone}
                            onChange={(e) => setDrvPhone(e.target.value)}
                            placeholder="Ej: 3124009911"
                          />
                        </div>
                        <div className="pk-form-actions">
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline"
                            onClick={() => setFleetMode('list')}
                            disabled={busy}
                          >
                            Cancelar
                          </button>
                          <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                            💾 Guardar Conductor
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>

                <div className="pk-card">
                  <div className="pk-card-head">
                    <div className="pk-card-title">🏢 Registrar Empresa Transportadora</div>
                    <span className="pk-badge pk-badge-amber">{nextCarrierCode}</span>
                  </div>
                  <div className="pk-card-body">
                    <form onSubmit={submitCreateCarrier('page')} className="pk-form-grid cols-2">
                      <PkAutoCodeInput label="Código Transportadora" value={nextCarrierCode} />
                      <div className="pk-field">
                        <label>Razón Social *</label>
                        <input
                          required
                          value={carName}
                          onChange={(e) => setCarName(e.target.value)}
                          placeholder="Ej: Expreso Andino de Carga S.A.S."
                        />
                      </div>
                      <div className="pk-field">
                        <label>NIT *</label>
                        <input
                          required
                          value={carNit}
                          onChange={(e) => setCarNit(e.target.value)}
                          placeholder="Ej: 900.812.441-9"
                        />
                      </div>
                      <div className="pk-field">
                        <label>Ciudad Sede</label>
                        <input
                          value={carCity}
                          onChange={(e) => setCarCity(e.target.value)}
                          placeholder="Ej: Bogotá D.C."
                        />
                      </div>
                      <div className="pk-field pk-col-span-full">
                        <label>Teléfono Contacto</label>
                        <input
                          value={carPhone}
                          onChange={(e) => setCarPhone(e.target.value)}
                          placeholder="Ej: 6017428800"
                        />
                      </div>
                      <div className="pk-form-actions">
                        <button
                          type="button"
                          className="pk-btn pk-btn-outline"
                          onClick={() => setFleetMode('list')}
                          disabled={busy}
                        >
                          Cancelar
                        </button>
                        <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                          💾 Guardar Transportadora
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pk-stack">
                <div className="pk-card">
                  <div className="pk-datatable-toolbar">
                    <input
                      className="pk-input pk-datatable-search"
                      placeholder="🔎 Filtrar tractocamiones, placas, conductores o empresas transportadoras..."
                      value={fleetSearch}
                      onChange={(e) => setFleetSearch(e.target.value)}
                    />
                    <div className="pk-row-actions">
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        onClick={() => setShowVehicleModal(true)}
                      >
                        + Camión Rápido
                      </button>
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        onClick={() => setShowDriverModal(true)}
                      >
                        + Conductor Rápido
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pk-grid-2">
                  <div className="pk-card">
                    <div className="pk-card-head">
                      <div className="pk-card-title">🚛 Flota Pesada ({filteredVehicles.length})</div>
                    </div>
                    <div className="pk-card-body">
                      <div className="pk-table-wrap">
                        <table className="pk-table">
                          <thead>
                            <tr>
                              <th>Código</th>
                              <th>Placa</th>
                              <th>Vehículo</th>
                              <th>Tara Ref.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredVehicles.map((v) => (
                              <tr key={v.id}>
                                <td>{v.code}</td>
                                <td style={{ fontWeight: 800 }}>{v.plate}</td>
                                <td>
                                  <div>{v.brand}</div>
                                  <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{v.axleConfig}</div>
                                </td>
                                <td className="num">{v.referenceTareKg.toLocaleString('es-CO')} kg</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="pk-card">
                    <div className="pk-card-head">
                      <div className="pk-card-title">🪪 Conductores Registrados ({filteredDrivers.length})</div>
                    </div>
                    <div className="pk-card-body">
                      <div className="pk-table-wrap">
                        <table className="pk-table">
                          <thead>
                            <tr>
                              <th>Código</th>
                              <th>Conductor</th>
                              <th>Cédula</th>
                              <th>Lic.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredDrivers.map((d) => (
                              <tr key={d.id}>
                                <td>{d.code}</td>
                                <td style={{ fontWeight: 700 }}>{d.name}</td>
                                <td>{d.docNumber}</td>
                                <td>{d.licenseCategory}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pk-card">
                  <div className="pk-card-head">
                    <div className="pk-card-title">🏢 Empresas Transportadoras ({filteredCarriers.length})</div>
                  </div>
                  <div className="pk-card-body">
                    <div className="pk-table-wrap">
                      <table className="pk-table">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Transportadora</th>
                            <th>NIT</th>
                            <th>Ciudad</th>
                            <th>Teléfono</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCarriers.map((c) => (
                            <tr key={c.id}>
                              <td>{c.code}</td>
                              <td style={{ fontWeight: 700 }}>{c.name}</td>
                              <td>{c.nit}</td>
                              <td>{c.city}</td>
                              <td>{c.phone || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ModuleGate>
      )}

      {currentTab === 'rutas_manifiestos' && (
        <ModuleGate module="rutas_manifiestos">
          <div className="pk-stack">
            <PkViewSwitcher
              title="Catálogo de Cargas, Materiales y Rutas Logísticas"
              subtitle="Consulta el volumen despachado por ruta de manifiesto o registra un nuevo corredor logístico."
              mode={routeMode}
              onModeChange={setRouteMode}
              listLabel="📦 Consolidado de Rutas"
              createLabel="+ Registrar Ruta / Carga"
              count={routes.length}
              extraActions={
                routeMode === 'list' ? (
                  <button type="button" className="pk-btn pk-btn-outline" onClick={handleExportRoutesCsv}>
                    📥 Exportar Rutas CSV
                  </button>
                ) : null
              }
            />

            {routeMode === 'create' ? (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">🛣️ Registrar Carga, Material o Ruta Logística</div>
                  <span className="pk-badge pk-badge-blue">{nextRouteCode}</span>
                </div>
                <div className="pk-card-body">
                  <form onSubmit={submitCreateRoute('page')} className="pk-form-grid cols-2">
                    <PkAutoCodeInput label="Código Carga / Ruta" value={nextRouteCode} />
                    <div className="pk-field">
                      <label>Descripción de Carga o Material *</label>
                      <input
                        required
                        value={routeDesc}
                        onChange={(e) => setRouteDesc(e.target.value)}
                        placeholder="Ej: Carbón Térmico Granulado / Soya a Granel"
                      />
                    </div>
                    <div className="pk-field">
                      <label>Origen</label>
                      <input
                        value={origin}
                        onChange={(e) => setOrigin(e.target.value)}
                        placeholder="Ej: Puerto Buenaventura"
                      />
                    </div>
                    <div className="pk-field">
                      <label>Destino</label>
                      <input
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="Ej: Zona Franca Bogotá"
                      />
                    </div>
                    <div className="pk-form-actions">
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline"
                        onClick={() => setRouteMode('list')}
                        disabled={busy}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                        ➕ Registrar Ruta / Carga
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📦 Consolidado de Despachos por Ruta y Tipo de Carga</div>
                </div>
                <div className="pk-datatable-toolbar">
                  <input
                    className="pk-input pk-datatable-search"
                    placeholder="🔎 Buscar por código, material, origen o destino..."
                    value={routeSearch}
                    onChange={(e) => setRouteSearch(e.target.value)}
                  />
                  <span className="pk-badge pk-badge-slate">{filteredRoutes.length} rutas</span>
                </div>
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Descripción Carga / Producto</th>
                          <th>Origen</th>
                          <th>Destino</th>
                          <th>Despachos</th>
                          <th>Total Neto Despachado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRoutes.map((r) => {
                          const matched = tickets.filter((t) => t.cargoId === r.id);
                          const sumKg = matched.reduce((acc, t) => acc + t.netKg, 0);
                          return (
                            <tr key={r.id}>
                              <td style={{ fontWeight: 800 }}>{r.code}</td>
                              <td style={{ fontWeight: 700 }}>{r.description}</td>
                              <td>{r.origin || '—'}</td>
                              <td>{r.destination || '—'}</td>
                              <td className="num">{matched.length}</td>
                              <td className="num" style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>
                                {sumKg.toLocaleString('es-CO')} kg
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ModuleGate>
      )}

      <PkModal
        open={showVehicleModal}
        title="Registrar Nuevo Tractocamión"
        onClose={() => setShowVehicleModal(false)}
      >
        <form onSubmit={submitCreateVehicle('modal')} className="pk-form-grid cols-2">
          <PkAutoCodeInput label="Código Flota" value={nextVehicleCode} />
          <div className="pk-field">
            <label>Placa *</label>
            <input
              required
              value={vehPlate}
              onChange={(e) => setVehPlate(e.target.value.toUpperCase())}
              placeholder="Ej: TRK945"
            />
          </div>
          <div className="pk-field">
            <label>Marca y Línea *</label>
            <input
              required
              value={vehBrand}
              onChange={(e) => setVehBrand(e.target.value)}
              placeholder="Ej: Kenworth T800"
            />
          </div>
          <PkSimpleSelect
            label="Configuración Ejes"
            value={vehAxle}
            onChange={setVehAxle}
            options={AXLE_OPTIONS}
          />
          <div className="pk-field pk-col-span-full">
            <label>Peso Tara Referencia (kg) *</label>
            <input
              required
              type="number"
              min="500"
              value={vehTare}
              onChange={(e) => setVehTare(e.target.value)}
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setShowVehicleModal(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              💾 Guardar Camión
            </button>
          </div>
        </form>
      </PkModal>

      <PkModal
        open={showDriverModal}
        title="Registrar Nuevo Conductor"
        onClose={() => setShowDriverModal(false)}
      >
        <form onSubmit={submitCreateDriver('modal')} className="pk-form-grid cols-2">
          <PkAutoCodeInput label="Código Conductor" value={nextDriverCode} />
          <div className="pk-field">
            <label>Nombre Completo *</label>
            <input
              required
              value={drvName}
              onChange={(e) => setDrvName(e.target.value)}
            />
          </div>
          <div className="pk-field">
            <label>Documento / Cédula *</label>
            <input
              required
              value={drvDoc}
              onChange={(e) => setDrvDoc(e.target.value)}
            />
          </div>
          <PkSimpleSelect
            label="Categoría Licencia"
            value={drvCat}
            onChange={setDrvCat}
            options={LICENSE_OPTIONS}
          />
          <div className="pk-field pk-col-span-full">
            <label>Teléfono</label>
            <input
              value={drvPhone}
              onChange={(e) => setDrvPhone(e.target.value)}
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setShowDriverModal(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              💾 Guardar Conductor
            </button>
          </div>
        </form>
      </PkModal>

      <PkModal
        open={showCarrierModal}
        title="Registrar Nueva Empresa Transportadora"
        onClose={() => setShowCarrierModal(false)}
      >
        <form onSubmit={submitCreateCarrier('modal')} className="pk-form-grid cols-2">
          <PkAutoCodeInput label="Código Transportadora" value={nextCarrierCode} />
          <div className="pk-field">
            <label>Razón Social *</label>
            <input
              required
              value={carName}
              onChange={(e) => setCarName(e.target.value)}
            />
          </div>
          <div className="pk-field">
            <label>NIT *</label>
            <input
              required
              value={carNit}
              onChange={(e) => setCarNit(e.target.value)}
            />
          </div>
          <div className="pk-field">
            <label>Ciudad</label>
            <input
              value={carCity}
              onChange={(e) => setCarCity(e.target.value)}
            />
          </div>
          <div className="pk-field pk-col-span-full">
            <label>Teléfono</label>
            <input
              value={carPhone}
              onChange={(e) => setCarPhone(e.target.value)}
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setShowCarrierModal(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              💾 Guardar Transportadora
            </button>
          </div>
        </form>
      </PkModal>

      <PkModal
        open={showRouteModal}
        title="Registrar Nueva Ruta o Tipo de Carga"
        onClose={() => setShowRouteModal(false)}
      >
        <form onSubmit={submitCreateRoute('modal')} className="pk-form-grid cols-2">
          <PkAutoCodeInput label="Código Ruta" value={nextRouteCode} />
          <div className="pk-field">
            <label>Descripción de Carga *</label>
            <input
              required
              value={routeDesc}
              onChange={(e) => setRouteDesc(e.target.value)}
            />
          </div>
          <div className="pk-field">
            <label>Origen</label>
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
          </div>
          <div className="pk-field">
            <label>Destino</label>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setShowRouteModal(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              💾 Guardar Ruta
            </button>
          </div>
        </form>
      </PkModal>
    </div>
  );
};

export default BasculaView;
