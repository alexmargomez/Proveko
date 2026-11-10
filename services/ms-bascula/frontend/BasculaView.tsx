import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  ModuleGate,
  PkAutoCodeInput,
  PkEntitySelect,
  PkEntityDialog,
  PkPrintButton,
  PkKpiRow,
  ScaleTicket,
  CargoRoute,
  Vehicle,
  Driver,
  Carrier,
  PrintDocumentPayload,
} from '@proveko/ui-sdk';

interface BasculaAllResponse {
  ok: boolean;
  nextTicketCode: string;
  nextRouteCode: string;
  tickets: ScaleTicket[];
  routes: CargoRoute[];
  vehicles: Vehicle[];
  drivers: Driver[];
  carriers: Carrier[];
}

export const BasculaView: React.FC = () => {
  const {
    activeModuleKey,
    hasModule,
    hasFeature,
    apiGet,
    apiPost,
    toast,
    openQuickDialog,
    dialogVersion,
  } = useProveko();

  const [nextTicketCode, setNextTicketCode] = useState('BAS-1006');
  const [nextRouteCode, setNextRouteCode] = useState('CAR-106');
  const [tickets, setTickets] = useState<ScaleTicket[]>([]);
  const [routes, setRoutes] = useState<CargoRoute[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);

  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [cargoId, setCargoId] = useState('');
  const [grossKg, setGrossKg] = useState('48500');
  const [tareKg, setTareKg] = useState('16200');

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeDesc, setRouteDesc] = useState('');
  const [origin, setOrigin] = useState('Puerto Buenaventura');
  const [destination, setDestination] = useState('Zona Franca Bogotá');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<BasculaAllResponse>('/api/v1/bascula/all');
      const vList = data.vehicles || [];
      const dList = data.drivers || [];
      const cList = data.carriers || [];
      const rList = data.routes || [];

      setNextTicketCode(data.nextTicketCode || 'BAS-1006');
      setNextRouteCode(data.nextRouteCode || 'CAR-106');
      setTickets(data.tickets || []);
      setRoutes(rList);
      setVehicles(vList);
      setDrivers(dList);
      setCarriers(cList);

      setVehicleId((prev) => (prev && vList.some((v) => v.id === prev) ? prev : vList[0]?.id || ''));
      setDriverId((prev) => (prev && dList.some((d) => d.id === prev) ? prev : dList[0]?.id || ''));
      setCarrierId((prev) => (prev && cList.some((c) => c.id === prev) ? prev : cList[0]?.id || ''));
      setCargoId((prev) => (prev && rList.some((r) => r.id === prev) ? prev : rList[0]?.id || ''));
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void reload();
  }, [reload, dialogVersion]);

  const validModules = ['pesaje_camionero', 'rutas_manifiestos'];
  const currentTab =
    validModules.includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : validModules.find((m) => hasModule(m)) || 'pesaje_camionero';

  const grossNumeric = Number(grossKg || 0);
  const tareNumeric = Number(tareKg || 0);
  const liveNetKg = grossNumeric > tareNumeric ? grossNumeric - tareNumeric : 0;

  const totalNetDispatchedKg = tickets.reduce((acc, t) => acc + (t.netKg || 0), 0);
  const totalTons = (totalNetDispatchedKg / 1000).toFixed(2);
  const dualSignatureEnabled = hasFeature('pesaje_camionero', 'tiquete_doble_firma');

  const handleEmitScaleTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grossNumeric <= tareNumeric) {
      toast('El Peso Bruto (kg) debe ser estrictamente mayor al Peso Tara (kg).');
      return;
    }
    const res = await apiPost<{ ticket: ScaleTicket }>('/api/v1/bascula/tickets', {
      vehicleId,
      driverId,
      carrierId,
      cargoId,
      grossKg: grossNumeric,
      tareKg: tareNumeric,
    });
    toast(`⚖️ Tiquete ${res.ticket.id} emitido (${res.ticket.netKg.toLocaleString('es-CO')} kg netos)`);
    await reload();
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeDesc.trim()) {
      toast('Ingresa la descripción de la carga o ruta.');
      return;
    }
    const res = await apiPost<{ route: CargoRoute }>('/api/v1/bascula/routes', {
      description: routeDesc,
      origin,
      destination,
    });
    toast(`🛣️ Ruta / Carga ${res.route.code} registrada`);
    setRouteDesc('');
    setShowRouteModal(false);
    await reload();
    setCargoId(res.route.id);
  };

  const buildTicketPrintPayload = (tk: ScaleTicket): PrintDocumentPayload => {
    const extraFields: Record<string, string> = {
      'Placa Vehículo': tk.plate,
      Conductor: tk.driverName,
      Transportadora: tk.carrierName,
      'Carga / Ruta': tk.cargoDesc,
      'Peso Bruto': `${tk.grossKg.toLocaleString('es-CO')} kg`,
      'Peso Tara': `${tk.tareKg.toLocaleString('es-CO')} kg`,
      'Peso Neto Destarado': `${tk.netKg.toLocaleString('es-CO')} kg`,
    };

    if (dualSignatureEnabled) {
      extraFields['Firma Conductor'] = `______________________ (${tk.driverName})`;
      extraFields['Firma Operador Báscula'] = '______________________ (Báscula Oficial)';
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
      grand_total: 0,
      notes: dualSignatureEnabled
        ? 'TIQUETE CON DOBLE FIRMA DE CONFORMIDAD: Conductor del vehículo y Operador de Báscula.'
        : 'Tiquete oficial de pesaje camionero certificado.',
    };
  };

  return (
    <div>
      {currentTab === 'pesaje_camionero' && (
        <ModuleGate module="pesaje_camionero">
          <PkKpiRow
            items={[
              { label: 'Tiquetes Emitidos', value: String(tickets.length), color: 'var(--pk-primary)' },
              {
                label: 'Peso Neto Acumulado',
                value: `${totalNetDispatchedKg.toLocaleString('es-CO')} kg`,
                color: 'var(--pk-emerald)',
              },
              { label: 'Toneladas Despachadas', value: `${totalTons} Ton`, color: '#0f172a' },
              { label: 'Rutas / Cargas Activas', value: String(routes.length), color: 'var(--pk-amber)' },
            ]}
          />

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">⚖️ Estación de Pesaje Camionero y Destare</div>
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
              <form onSubmit={handleEmitScaleTicket} className="pk-form-grid">
                <PkAutoCodeInput label="N° Tiquete Báscula" value={nextTicketCode} />

                <PkEntitySelect
                  label="Placa Tractocamión / Vehículo"
                  items={vehicles}
                  value={vehicleId}
                  onChange={setVehicleId}
                  getValue={(v) => v.id}
                  getLabel={(v) => `${v.plate} — ${v.brand}`}
                  createLabel="+ Nueva Placa"
                  onCreateNew={() => openQuickDialog('nueva-placa', () => void reload())}
                  searchable
                />

                <PkEntitySelect
                  label="Conductor Asignado"
                  items={drivers}
                  value={driverId}
                  onChange={setDriverId}
                  getValue={(d) => d.id}
                  getLabel={(d) => `${d.name} (${d.docNumber})`}
                  createLabel="+ Nuevo Conductor"
                  onCreateNew={() => openQuickDialog('nuevo-conductor', () => void reload())}
                  searchable
                />

                <PkEntitySelect
                  label="Empresa Transportista"
                  items={carriers}
                  value={carrierId}
                  onChange={setCarrierId}
                  getValue={(c) => c.id}
                  getLabel={(c) => `${c.name} (${c.nit})`}
                  createLabel="+ Nuevo Transportista"
                  onCreateNew={() => openQuickDialog('nuevo-transportista', () => void reload())}
                  searchable
                />

                <PkEntitySelect
                  label="Carga / Ruta Logística"
                  items={routes}
                  value={cargoId}
                  onChange={setCargoId}
                  getValue={(r) => r.id}
                  getLabel={(r) => `${r.code} · ${r.description} (${r.origin} → ${r.destination})`}
                  createLabel="+ Nueva Carga/Ruta"
                  onCreateNew={() => setShowRouteModal(true)}
                />

                <div className="pk-field">
                  <label>Peso Bruto en Plataforma (kg) *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={grossKg}
                    onChange={(e) => setGrossKg(e.target.value)}
                  />
                </div>

                <div className="pk-field">
                  <label>Peso Tara Vehículo Vacío (kg) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={tareKg}
                    onChange={(e) => setTareKg(e.target.value)}
                  />
                </div>

                <div className="pk-field">
                  <label>Peso Neto Destarado (kg)</label>
                  <input
                    type="text"
                    readOnly
                    value={`${liveNetKg.toLocaleString('es-CO')} kg`}
                    style={{
                      background: '#ecfdf5',
                      fontWeight: 800,
                      color: '#065f46',
                      borderColor: '#10b981',
                    }}
                  />
                </div>

                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-primary">
                    ⚖️ Emitir Tiquete {nextTicketCode}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">📋 Tiquetes Oficiales de Báscula Emitidos ({tickets.length})</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>N° Tiquete</th>
                      <th>Fecha y Hora</th>
                      <th>Placa</th>
                      <th>Conductor</th>
                      <th>Transportista</th>
                      <th>Carga / Ruta</th>
                      <th>Bruto (kg)</th>
                      <th>Tara (kg)</th>
                      <th>Neto (kg)</th>
                      <th>Impresión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((tk) => (
                      <tr key={tk.id}>
                        <td>
                          <span className="pk-badge pk-badge-blue">{tk.id}</span>
                        </td>
                        <td>{tk.date}</td>
                        <td style={{ fontWeight: 800 }}>{tk.plate}</td>
                        <td>{tk.driverName}</td>
                        <td>{tk.carrierName}</td>
                        <td>{tk.cargoDesc}</td>
                        <td>{tk.grossKg.toLocaleString('es-CO')}</td>
                        <td>{tk.tareKg.toLocaleString('es-CO')}</td>
                        <td style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>
                          {tk.netKg.toLocaleString('es-CO')} kg
                        </td>
                        <td>
                          <PkPrintButton
                            label="🖨️ Imprimir Tiquete Báscula"
                            payload={buildTicketPrintPayload(tk)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <PkEntityDialog
            open={showRouteModal}
            title="➕ Registrar Nueva Carga / Ruta de Transporte"
            onClose={() => setShowRouteModal(false)}
          >
            <form onSubmit={handleCreateRoute} className="pk-form-grid">
              <PkAutoCodeInput label="Código Carga" value={nextRouteCode} />
              <div className="pk-field">
                <label>Tipo de Carga / Producto *</label>
                <input
                  required
                  value={routeDesc}
                  onChange={(e) => setRouteDesc(e.target.value)}
                  placeholder="Ej: Carbón Térmico / Granel Soya"
                />
              </div>
              <div className="pk-field">
                <label>Origen</label>
                <input value={origin} onChange={(e) => setOrigin(e.target.value)} />
              </div>
              <div className="pk-field">
                <label>Destino</label>
                <input value={destination} onChange={(e) => setDestination(e.target.value)} />
              </div>
              <div className="pk-field">
                <button type="submit" className="pk-btn pk-btn-primary">
                  💾 Guardar Carga/Ruta
                </button>
              </div>
            </form>
          </PkEntityDialog>
        </ModuleGate>
      )}

      {currentTab === 'rutas_manifiestos' && (
        <ModuleGate module="rutas_manifiestos">
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🛣️ Registro de Rutas y Tipos de Carga</div>
              <PkPrintButton
                label="🖨️ Imprimir Catálogo de Rutas"
                variant="primary"
                payload={{
                  document_type: 'REPORTE_TABLA',
                  layout_variant: 'carta_membrete',
                  document_number: `MAN-${new Date().toISOString().slice(0, 10)}`,
                  issue_date: new Date().toISOString().slice(0, 10),
                  customer_name: 'Catálogo Oficial de Rutas y Tipos de Carga Pesada',
                  items: routes.map((r) => ({
                    code: r.code,
                    description: `${r.description} — Origen: ${r.origin || 'N/A'} → Destino: ${r.destination || 'N/A'}`,
                    quantity: 1,
                    unit_price: 0,
                    subtotal: 0,
                  })),
                  grand_total: 0,
                  notes: 'Listado oficial de rutas logísticas habilitadas para despacho en báscula.',
                }}
              />
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleCreateRoute} className="pk-form-grid">
                <PkAutoCodeInput label="Código Ruta / Carga" value={nextRouteCode} />
                <div className="pk-field">
                  <label>Descripción de Carga *</label>
                  <input
                    required
                    value={routeDesc}
                    onChange={(e) => setRouteDesc(e.target.value)}
                    placeholder="Ej: Contenedor Refrigerado 40 Pies"
                  />
                </div>
                <div className="pk-field">
                  <label>Ciudad / Planta Origen *</label>
                  <input
                    required
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="Ej: Puerto Cartagena"
                  />
                </div>
                <div className="pk-field">
                  <label>Ciudad / Bodega Destino *</label>
                  <input
                    required
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Ej: Centro Logístico Medellín"
                  />
                </div>
                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-primary">
                    ➕ Crear Ruta {nextRouteCode}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">📦 Cargas y Corredores Logísticos Registrados ({routes.length})</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Tipo de Carga</th>
                      <th>Origen</th>
                      <th>Destino</th>
                      <th>Despachos Asociados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routes.map((r) => {
                      const count = tickets.filter((t) => t.cargoId === r.id).length;
                      return (
                        <tr key={r.id}>
                          <td>
                            <span className="pk-badge pk-badge-slate">{r.code}</span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{r.description}</td>
                          <td>{r.origin || '—'}</td>
                          <td>{r.destination || '—'}</td>
                          <td>
                            <span className="pk-badge pk-badge-emerald">{count} tiquete(s)</span>
                          </td>
                        </tr>
                      );
                    })}
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
