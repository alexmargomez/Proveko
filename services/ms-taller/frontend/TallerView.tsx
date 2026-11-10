import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkEntitySelect,
  PkPrintButton,
  PkKpiRow,
  WorkOrder,
  Worker,
  Customer,
  Vehicle,
  PrintDocumentPayload,
  formatCop,
} from '@proveko/ui-sdk';

interface SettlementRecord {
  id: string;
  date: string;
  workerId: string;
  workerName: string;
  grossLabor: number;
  commissionPct: number;
  technicianPayout: number;
  companyRetention: number;
}

interface TallerAllResponse {
  ok: boolean;
  nextOrderCode: string;
  nextWorkerCode: string;
  orders: WorkOrder[];
  workers: Worker[];
  settlements: SettlementRecord[];
  customers: Customer[];
  vehicles: Vehicle[];
}

export const TallerView: React.FC = () => {
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

  const [nextOrderCode, setNextOrderCode] = useState('OT-706');
  const [nextWorkerCode, setNextWorkerCode] = useState('TEC-106');
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [currentKm, setCurrentKm] = useState('45000');
  const [serviceDesc, setServiceDesc] = useState('');
  const [totalEstimated, setTotalEstimated] = useState('180000');

  const [wkName, setWkName] = useState('');
  const [wkDoc, setWkDoc] = useState('');
  const [wkSpecialty, setWkSpecialty] = useState('Mecánica General e Inyección');
  const [wkCommission, setWkCommission] = useState('40');
  const [wkPhone, setWkPhone] = useState('');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<TallerAllResponse>('/api/v1/taller/all');
      const cList = data.customers || [];
      const vList = data.vehicles || [];
      const wList = data.workers || [];

      setNextOrderCode(data.nextOrderCode || 'OT-706');
      setNextWorkerCode(data.nextWorkerCode || 'TEC-106');
      setOrders(data.orders || []);
      setWorkers(wList);
      setSettlements(data.settlements || []);
      setCustomers(cList);
      setVehicles(vList);

      setCustomerId((prev) => {
        if (prev && cList.some((c) => c.id === prev)) return prev;
        return cList.length > 0 ? cList[0].id : '';
      });
      setVehicleId((prev) => {
        if (prev && vList.some((v) => v.id === prev)) return prev;
        if (vList.length > 0) {
          setCurrentKm(String(vList[0].currentKm || 45000));
          return vList[0].id;
        }
        return '';
      });
      setWorkerId((prev) => {
        if (prev && wList.some((w) => w.id === prev)) return prev;
        return wList.length > 0 ? wList[0].id : '';
      });
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void reload();
  }, [reload, dialogVersion]);

  const validModules = ['tablero_ordenes', 'hoja_vida_vehiculos', 'comisiones_tecnicos'];
  const currentTab =
    validModules.includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : validModules.find((m) => hasModule(m)) || 'tablero_ordenes';

  const handleVehicleChange = (newVehId: string) => {
    setVehicleId(newVehId);
    const veh = vehicles.find((v) => v.id === newVehId);
    if (veh) {
      if (veh.currentKm > 0) setCurrentKm(String(veh.currentKm));
      if (veh.customerId) setCustomerId(veh.customerId);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !serviceDesc.trim()) {
      toast('Selecciona la placa del vehículo y describe el servicio a realizar.');
      return;
    }
    await apiPost('/api/v1/taller/orders', {
      customerId,
      vehicleId,
      workerId,
      currentKm: Number(currentKm || 0),
      serviceDesc,
      totalEstimated: Number(totalEstimated || 0),
    });
    toast('🔧 Orden de trabajo ingresada al taller');
    setServiceDesc('');
    await reload();
  };

  const handleAdvanceStage = async (order: WorkOrder, status: string) => {
    await apiPost(`/api/v1/taller/orders/${order.id}/stage`, { status });
    toast(`Orden ${order.id} actualizada a "${status}"`);
    await reload();
  };

  const handleSendOrderToPos = (order: WorkOrder) => {
    sendToPosCheckout({
      customerId: order.customerId || undefined,
      vehicleId: order.vehicleId || undefined,
      mechanicId: order.workerId || undefined,
      linkedWorkOrderId: order.id,
      items: [
        {
          kind: 'SERVICIO',
          refId: order.id,
          code: order.id,
          name: `${order.serviceDesc} (${order.plate})`,
          qty: 1,
          price: order.totalEstimated,
          taxPct: 0,
          workerId: order.workerId,
          workerName: order.workerName,
        },
      ],
    });
    toast(`Orden ${order.id} enviada a Caja POS para facturación`);
  };

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wkName.trim()) return;
    await apiPost('/api/v1/taller/workers', {
      name: wkName,
      docNumber: wkDoc,
      specialty: wkSpecialty,
      commissionPct: Number(wkCommission || 40),
      phone: wkPhone,
    });
    toast('👷 Especialista registrado en el taller');
    setWkName('');
    setWkDoc('');
    setWkPhone('');
    await reload();
  };

  const handleSettleWorker = async (wk: Worker) => {
    await apiPost(`/api/v1/taller/workers/${wk.id}/settle`, {});
    toast(`💸 Comisión liquidada para ${wk.name}`);
    await reload();
  };

  const buildOrderPrintPayload = (order: WorkOrder): PrintDocumentPayload => ({
    document_type: 'ORDEN_TALLER',
    layout_variant: 'factura_taller',
    document_number: order.id,
    issue_date: order.createdAt,
    customer_name: order.customerName,
    extra_fields: {
      Placa: order.plate,
      Vehículo: order.vehicleBrand,
      'Kilometraje Ingreso': `${order.currentKm.toLocaleString('es-CO')} km`,
      'Próximo Aceite': `${order.nextOilKm.toLocaleString('es-CO')} km`,
      'Especialista Asignado': order.workerName || 'Taller General',
      'Estado Orden': order.status,
    },
    items: [
      {
        code: order.id,
        description: order.serviceDesc,
        quantity: 1,
        unit_price: order.totalEstimated,
        subtotal: order.totalEstimated,
      },
    ],
    subtotal: order.totalEstimated,
    grand_total: order.totalEstimated,
    notes: 'Orden de ingreso automotriz. Inventario y estado general verificado con el cliente.',
  });

  const kmNumeric = Number(currentKm || 0);
  const nextOilPreview = kmNumeric + 5000;
  const activeOrdersCount = orders.filter((o) => o.status !== 'Entregado').length;
  const pendingCommissions = workers.reduce(
    (acc, w) => acc + (w.totalDayGross * w.commissionPct) / 100,
    0
  );

  const statusBadge = (st: string): string => {
    if (st === 'Entregado') return 'pk-badge pk-badge-emerald';
    if (st === 'Listo' || st === 'Listo para Entrega') return 'pk-badge pk-badge-blue';
    if (st === 'En Proceso') return 'pk-badge pk-badge-amber';
    return 'pk-badge pk-badge-slate';
  };

  return (
    <div>
      {currentTab === 'tablero_ordenes' && (
        <ModuleGate module="tablero_ordenes">
          <PkKpiRow
            items={[
              { label: 'Órdenes en Taller', value: String(activeOrdersCount), color: 'var(--pk-primary)' },
              { label: 'Total Histórico OT', value: String(orders.length) },
              { label: 'Vehículos Registrados', value: String(vehicles.length), color: 'var(--pk-emerald)' },
              { label: 'Comisiones por Liquidar', value: formatCop(pendingCommissions), color: 'var(--pk-amber)' },
            ]}
          />

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">📋 Recepción de Vehículo y Nueva Orden de Servicio</div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleCreateOrder} className="pk-form-grid">
                <PkAutoCodeInput label="N° Orden Trabajo" value={nextOrderCode} />
                <PkEntitySelect
                  label="Cliente / Propietario"
                  items={customers}
                  value={customerId}
                  onChange={setCustomerId}
                  getValue={(c) => c.id}
                  getLabel={(c) => `${c.name} (${c.nit})`}
                  createLabel="+ Nuevo Cliente"
                  onCreateNew={() => openQuickDialog('nuevo-cliente', () => void reload())}
                  searchable
                />
                <PkEntitySelect
                  label="Placa / Vehículo"
                  items={vehicles}
                  value={vehicleId}
                  onChange={handleVehicleChange}
                  getValue={(v) => v.id}
                  getLabel={(v) => `${v.plate} — ${v.brand}`}
                  createLabel="+ Nueva Placa"
                  onCreateNew={() => openQuickDialog('nueva-placa', () => void reload())}
                  searchable
                />
                <PkEntitySelect
                  label="Especialista / Técnico"
                  items={workers}
                  value={workerId}
                  onChange={setWorkerId}
                  getValue={(w) => w.id}
                  getLabel={(w) => `${w.name} (${w.commissionPct}% MO)`}
                />
                <div className="pk-field">
                  <label>
                    <span>Kilometraje Actual</span>
                    <FeatureGate module="tablero_ordenes" feature="alerta_cambio_aceite">
                      <span style={{ color: 'var(--pk-amber)', fontSize: 10.5 }}>
                        🛢️ Próx. Aceite (+5.000 km): {nextOilPreview.toLocaleString('es-CO')} km
                      </span>
                    </FeatureGate>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={currentKm}
                    onChange={(e) => setCurrentKm(e.target.value)}
                  />
                </div>
                <div className="pk-field">
                  <label>Servicio / Diagnóstico Solicitado *</label>
                  <input
                    required
                    value={serviceDesc}
                    onChange={(e) => setServiceDesc(e.target.value)}
                    placeholder="Ej: Cambio aceite sintético, filtros y revisión frenos"
                  />
                </div>
                <div className="pk-field">
                  <label>Valor Mano de Obra Estimado ($)</label>
                  <input
                    type="number"
                    min="0"
                    value={totalEstimated}
                    onChange={(e) => setTotalEstimated(e.target.value)}
                  />
                </div>
                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-primary">
                    🔧 Crear Orden {nextOrderCode}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🚗 Tablero Operativo de Órdenes ({orders.length})</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-cards-grid">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      border: '1px solid var(--pk-border)',
                      borderRadius: 12,
                      padding: 14,
                      background: order.status === 'Entregado' ? '#f8fafc' : '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 15 }}>
                        {order.id} · {order.plate}
                      </strong>
                      <span className={statusBadge(order.status)}>{order.status}</span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155', marginTop: 4 }}>
                      {order.vehicleBrand}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
                      👤 {order.customerName} · 👷 {order.workerName || 'Sin asignar'}
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
                      📍 Km actual: <strong>{order.currentKm.toLocaleString('es-CO')} km</strong>
                      <FeatureGate module="tablero_ordenes" feature="alerta_cambio_aceite">
                        <span style={{ color: 'var(--pk-amber)', marginLeft: 8, fontWeight: 700 }}>
                          🛢️ Próx. aceite: {order.nextOilKm.toLocaleString('es-CO')} km
                        </span>
                      </FeatureGate>
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        padding: '8px 10px',
                        background: '#f1f5f9',
                        borderRadius: 8,
                        fontSize: 12.5,
                      }}
                    >
                      {order.serviceDesc}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800 }}>
                      Estimado: {formatCop(order.totalEstimated)}
                    </div>

                    <div className="pk-row-actions" style={{ marginTop: 10 }}>
                      {(['Recibido', 'En Proceso', 'Listo', 'Entregado'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          className={`pk-btn pk-btn-sm ${
                            order.status === st ? 'pk-btn-primary' : 'pk-btn-outline'
                          }`}
                          onClick={() => void handleAdvanceStage(order, st)}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    <div className="pk-row-actions" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
                      <PkPrintButton label="🖨️ Orden de Servicio" payload={buildOrderPrintPayload(order)} />
                      {order.status !== 'Entregado' && (
                        <button
                          type="button"
                          className="pk-btn pk-btn-emerald pk-btn-sm"
                          onClick={() => handleSendOrderToPos(order)}
                        >
                          💵 Facturar en Caja
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModuleGate>
      )}

      {currentTab === 'hoja_vida_vehiculos' && (
        <ModuleGate module="hoja_vida_vehiculos">
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🚗 Parque Automotor y Hoja de Vida de Placas ({vehicles.length})</div>
              <button
                type="button"
                className="pk-btn pk-btn-primary pk-btn-sm"
                onClick={() => openQuickDialog('nueva-placa', () => void reload())}
              >
                + Registrar Vehículo
              </button>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Placa</th>
                      <th>Marca y Línea</th>
                      <th>Modelo</th>
                      <th>Propietario</th>
                      <th>Km Actual</th>
                      <th>Próximo Aceite</th>
                      <th>Vencimiento SOAT</th>
                      <th>Hoja de Vida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.map((veh) => {
                      const vehOrders = orders.filter(
                        (o) => o.vehicleId === veh.id || o.plate === veh.plate
                      );
                      return (
                        <tr key={veh.id}>
                          <td>
                            <span className="pk-badge pk-badge-blue">{veh.plate}</span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{veh.brand}</td>
                          <td>{veh.modelYear}</td>
                          <td>{veh.customerName}</td>
                          <td>{veh.currentKm.toLocaleString('es-CO')} km</td>
                          <td style={{ color: 'var(--pk-amber)', fontWeight: 700 }}>
                            {veh.nextOilChangeKm.toLocaleString('es-CO')} km
                          </td>
                          <td>{veh.soatExpiry || '—'}</td>
                          <td>
                            <PkPrintButton
                              label="🖨️ Hoja de Vida"
                              payload={{
                                document_type: 'ORDEN_TALLER',
                                layout_variant: 'factura_taller',
                                document_number: `HV-${veh.plate}`,
                                issue_date: new Date().toISOString().slice(0, 10),
                                customer_name: veh.customerName,
                                extra_fields: {
                                  Placa: veh.plate,
                                  Vehículo: `${veh.brand} (${veh.modelYear})`,
                                  'Kilometraje Actual': `${veh.currentKm.toLocaleString('es-CO')} km`,
                                  'Próximo Cambio Aceite': `${veh.nextOilChangeKm.toLocaleString('es-CO')} km`,
                                  'Vencimiento SOAT': veh.soatExpiry || 'N/A',
                                },
                                items:
                                  vehOrders.length > 0
                                    ? vehOrders.map((o) => ({
                                        code: o.id,
                                        description: `[${o.createdAt}] ${o.serviceDesc} — Técnico: ${o.workerName} (${o.status})`,
                                        quantity: 1,
                                        unit_price: o.totalEstimated,
                                        subtotal: o.totalEstimated,
                                      }))
                                    : [
                                        {
                                          code: veh.plate,
                                          description: 'Vehículo registrado sin órdenes previas',
                                          quantity: 1,
                                          unit_price: 0,
                                          subtotal: 0,
                                        },
                                      ],
                                grand_total: vehOrders.reduce((s, o) => s + o.totalEstimated, 0),
                                notes: veh.notes || 'Certificado técnico de historial vehicular.',
                              }}
                            />
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

      {currentTab === 'comisiones_tecnicos' && (
        <ModuleGate module="comisiones_tecnicos">
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">👷 Alta de Especialista / Mecánico</div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleCreateWorker} className="pk-form-grid">
                <PkAutoCodeInput label="Código Técnico" value={nextWorkerCode} />
                <div className="pk-field">
                  <label>Nombre Completo *</label>
                  <input
                    required
                    value={wkName}
                    onChange={(e) => setWkName(e.target.value)}
                    placeholder="Ej: Mauricio Cárdenas"
                  />
                </div>
                <div className="pk-field">
                  <label>Documento / Cédula</label>
                  <input
                    value={wkDoc}
                    onChange={(e) => setWkDoc(e.target.value)}
                    placeholder="Ej: 1020789456"
                  />
                </div>
                <div className="pk-field">
                  <label>Especialidad</label>
                  <input
                    value={wkSpecialty}
                    onChange={(e) => setWkSpecialty(e.target.value)}
                    placeholder="Frenos, Suspensión, Diesel..."
                  />
                </div>
                <div className="pk-field">
                  <label>% Comisión Mano de Obra</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={wkCommission}
                    onChange={(e) => setWkCommission(e.target.value)}
                  />
                </div>
                <div className="pk-field">
                  <label>Celular</label>
                  <input value={wkPhone} onChange={(e) => setWkPhone(e.target.value)} placeholder="311..." />
                </div>
                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-primary">
                    ➕ Guardar Técnico
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">💸 Acumulado del Día y Liquidación de Técnicos</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Especialista</th>
                      <th>Especialidad</th>
                      <th>% Comisión</th>
                      <th>Mano de Obra Facturada</th>
                      <th>Pago Técnico</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((wk) => {
                      const estPayout = (wk.totalDayGross * wk.commissionPct) / 100;
                      return (
                        <tr key={wk.id}>
                          <td>
                            <span className="pk-badge pk-badge-slate">{wk.code}</span>
                          </td>
                          <td style={{ fontWeight: 800 }}>{wk.name}</td>
                          <td>{wk.specialty}</td>
                          <td>{wk.commissionPct}%</td>
                          <td style={{ fontWeight: 700 }}>{formatCop(wk.totalDayGross)}</td>
                          <td style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>
                            {formatCop(estPayout)}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="pk-btn pk-btn-emerald pk-btn-sm"
                              disabled={wk.totalDayGross <= 0}
                              style={wk.totalDayGross <= 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                              onClick={() => void handleSettleWorker(wk)}
                            >
                              💸 Liquidar Comisión
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🧾 Historial de Liquidaciones Pagadas ({settlements.length})</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Consecutivo</th>
                      <th>Fecha</th>
                      <th>Técnico</th>
                      <th>Base Mano de Obra</th>
                      <th>%</th>
                      <th>Pagado Técnico</th>
                      <th>Utilidad Taller</th>
                      <th>Soporte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                          Aún no hay liquidaciones registradas.
                        </td>
                      </tr>
                    ) : (
                      settlements.map((st) => (
                        <tr key={st.id}>
                          <td>
                            <span className="pk-badge pk-badge-blue">{st.id}</span>
                          </td>
                          <td>{st.date}</td>
                          <td style={{ fontWeight: 700 }}>{st.workerName}</td>
                          <td>{formatCop(st.grossLabor)}</td>
                          <td>{st.commissionPct}%</td>
                          <td style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>
                            {formatCop(st.technicianPayout)}
                          </td>
                          <td>{formatCop(st.companyRetention)}</td>
                          <td>
                            <PkPrintButton
                              label="🖨️ Comprobante Comisión"
                              payload={{
                                document_type: 'RECIBO_CAJA',
                                layout_variant: 'carta_membrete',
                                document_number: st.id,
                                issue_date: st.date,
                                customer_name: st.workerName,
                                extra_fields: {
                                  'Base Mano de Obra': formatCop(st.grossLabor),
                                  'Porcentaje Pactado': `${st.commissionPct}%`,
                                  'Retención Taller': formatCop(st.companyRetention),
                                },
                                items: [
                                  {
                                    code: st.id,
                                    description: `Liquidación comisión mano de obra automotriz (${st.commissionPct}%)`,
                                    quantity: 1,
                                    unit_price: st.technicianPayout,
                                    subtotal: st.technicianPayout,
                                  },
                                ],
                                grand_total: st.technicianPayout,
                                notes: 'Comprobante de pago de comisiones técnicas recibido a satisfacción.',
                              }}
                            />
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
      )}
    </div>
  );
};
