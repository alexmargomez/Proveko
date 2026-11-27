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
  PkConfirmModal,
  PkPrintButton,
  PkKpiRow,
  useAsyncAction,
  formatCop,
  downloadCsvUtf8,
} from '@platform/ui-sdk';

interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  vehicleType: string;
  customerId: string;
  customerName: string;
  currentKm: number;
  nextOilKm: number;
  nextOilChangeKm: number;
  soatExpiry: string;
}

interface Worker {
  id: string;
  code: string;
  name: string;
  docNumber: string;
  specialty: string;
  commissionPct: number;
  phone: string;
  totalDayGross: number;
}

interface WorkOrder {
  id: string;
  createdAt: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  plate: string;
  vehicleBrand: string;
  currentKm: number;
  nextOilKm: number;
  workerId: string;
  workerName: string;
  status: string;
  serviceDesc: string;
  totalEstimated: number;
}

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

interface CustomerOption {
  id: string;
  name: string;
  nit: string;
  phone?: string;
}

interface TallerStateResponse {
  ok: boolean;
  nextOrderCode: string;
  nextWorkerCode: string;
  nextVehicleCode: string;
  orders: WorkOrder[];
  workers: Worker[];
  settlements: SettlementRecord[];
  vehicles: Vehicle[];
}

interface OptionalCustomersResponse {
  ok?: boolean;
  customers?: CustomerOption[];
}

const VALID_MODULES = ['tablero_ordenes', 'hoja_vida_vehiculos', 'comisiones_tecnicos'] as const;

const VEHICLE_TYPE_OPTIONS = [
  { value: 'Automóvil', label: 'Automóvil' },
  { value: 'Camioneta', label: 'Camioneta / SUV' },
  { value: 'Motocicleta', label: 'Motocicleta' },
  { value: 'Utilitario / Carga', label: 'Utilitario / Carga' },
];

const ORDER_STATUS_FILTER_OPTIONS = [
  { value: 'Recibido', label: 'Recibido' },
  { value: 'En Proceso', label: 'En Proceso' },
  { value: 'Listo', label: 'Listo para Entrega' },
  { value: 'Entregado', label: 'Entregado' },
];

export const TallerView: React.FC = () => {
  const {
    activeModuleKey,
    hasService,
    hasModule,
    navigateTo,
    apiGet,
    apiPost,
    apiDelete,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [ordersViewMode, setOrdersViewMode] = useState<'list' | 'create'>('list');
  const [vehiclesViewMode, setVehiclesViewMode] = useState<'list' | 'create'>('list');
  const [workersViewMode, setWorkersViewMode] = useState<'list' | 'create'>('list');

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  const [nextOrderCode, setNextOrderCode] = useState('OT-706');
  const [nextWorkerCode, setNextWorkerCode] = useState('TEC-106');
  const [nextVehicleCode, setNextVehicleCode] = useState('VEH-204');
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [vehicleId, setVehicleId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [ownerNameOverride, setOwnerNameOverride] = useState('');
  const [currentKm, setCurrentKm] = useState('45000');
  const [serviceDesc, setServiceDesc] = useState('');
  const [totalEstimated, setTotalEstimated] = useState('180000');

  const [showNewVehicleModal, setShowNewVehicleModal] = useState(false);
  const [vehPlate, setVehPlate] = useState('');
  const [vehBrand, setVehBrand] = useState('');
  const [vehType, setVehType] = useState('Automóvil');
  const [vehCustomerName, setVehCustomerName] = useState('');
  const [vehCustomerId, setVehCustomerId] = useState('');
  const [vehKm, setVehKm] = useState('40000');
  const [vehSoat, setVehSoat] = useState('2027-06-30');

  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [workerToSettle, setWorkerToSettle] = useState<Worker | null>(null);

  const [wkName, setWkName] = useState('');
  const [wkDoc, setWkDoc] = useState('');
  const [wkSpecialty, setWkSpecialty] = useState('Mecánica General e Inyección');
  const [wkCommission, setWkCommission] = useState('40');
  const [wkPhone, setWkPhone] = useState('');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<TallerStateResponse>('/api/v1/taller/all');
      const vList = data.vehicles || [];
      const wList = data.workers || [];

      setNextOrderCode(data.nextOrderCode || 'OT-706');
      setNextWorkerCode(data.nextWorkerCode || 'TEC-106');
      setNextVehicleCode(data.nextVehicleCode || 'VEH-204');
      setOrders(data.orders || []);
      setWorkers(wList);
      setSettlements(data.settlements || []);
      setVehicles(vList);

      setVehicleId((prev) => {
        if (prev && vList.some((v) => v.id === prev)) return prev;
        if (vList.length > 0) {
          setCurrentKm(String(vList[0].currentKm || 45000));
          setOwnerNameOverride(vList[0].customerName || '');
          setCustomerId(vList[0].customerId || '');
          return vList[0].id;
        }
        return '';
      });

      setWorkerId((prev) => {
        if (prev && wList.some((w) => w.id === prev)) return prev;
        return wList.length > 0 ? wList[0].id : '';
      });

      if (hasService('ms-clientes')) {
        try {
          const crm = await apiGet<OptionalCustomersResponse>('/api/v1/clientes/all');
          const cList = crm.customers || [];
          setCustomers(cList);
          setVehCustomerId((prev) => (prev && cList.some((c) => c.id === prev) ? prev : cList[0]?.id || ''));
        } catch {
          setCustomers([]);
        }
      } else {
        setCustomers([]);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No fue posible cargar la información del taller');
    }
  }, [apiGet, hasService, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const currentTab =
    (VALID_MODULES as readonly string[]).includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : VALID_MODULES.find((m) => hasModule(m)) || 'tablero_ordenes';

  const handleVehicleChange = (newVehId: string) => {
    setVehicleId(newVehId);
    const veh = vehicles.find((v) => v.id === newVehId);
    if (veh) {
      setCurrentKm(String(veh.currentKm || 0));
      setCustomerId(veh.customerId || '');
      setOwnerNameOverride(veh.customerName || '');
    }
  };

  const submitCreateVehicle = (origin: 'modal' | 'page') => (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPlate = vehPlate.trim().toUpperCase();
    const kmNum = Number(vehKm || 0);
    if (cleanPlate.length < 5 || !vehBrand.trim()) {
      toast('Ingresa una placa válida y la marca/línea del vehículo');
      return;
    }
    if (!Number.isFinite(kmNum) || kmNum < 0) {
      toast('Ingresa un kilometraje actual válido');
      return;
    }

    const matchedCrm = customers.find((c) => c.id === vehCustomerId);
    const resolvedOwner = vehCustomerName.trim() || matchedCrm?.name || 'Propietario General';
    const resolvedCustomerId = vehCustomerName.trim() ? '' : matchedCrm?.id || '';

    void run(async () => {
      try {
        const res = await apiPost<{ vehicle: Vehicle }>('/api/v1/taller/vehicles', {
          plate: cleanPlate,
          brand: vehBrand.trim(),
          vehicleType: vehType,
          customerId: resolvedCustomerId,
          customerName: resolvedOwner,
          currentKm: Math.floor(kmNum),
          soatExpiry: vehSoat,
        });
        toast(`Vehículo registrado con placa ${res.vehicle.plate}`);
        setVehPlate('');
        setVehBrand('');
        setVehCustomerName('');
        if (origin === 'modal') {
          setShowNewVehicleModal(false);
        } else {
          setVehiclesViewMode('list');
        }
        await reload();
        setVehicleId(res.vehicle.id);
        setCurrentKm(String(res.vehicle.currentKm));
        setOwnerNameOverride(res.vehicle.customerName);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al registrar el vehículo');
      }
    });
  };

  const confirmDeleteVehicle = () => {
    if (!vehicleToDelete) return;
    const target = vehicleToDelete;
    void run(async () => {
      try {
        await apiDelete(`/api/v1/taller/vehicles/${encodeURIComponent(target.id)}`);
        toast(`Vehículo ${target.plate} eliminado del directorio`);
        setVehicleToDelete(null);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible eliminar el vehículo');
      }
    });
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !serviceDesc.trim()) {
      toast('Selecciona la placa del vehículo y describe el trabajo o diagnóstico');
      return;
    }
    const kmNum = Number(currentKm || 0);
    const estNum = Number(totalEstimated || 0);
    if (!Number.isFinite(kmNum) || kmNum < 0 || !Number.isFinite(estNum) || estNum < 0) {
      toast('Verifica el kilometraje de ingreso y el valor estimado');
      return;
    }

    const matchedCrm = customers.find((c) => c.id === customerId);
    const resolvedName = ownerNameOverride.trim() || matchedCrm?.name || '';

    void run(async () => {
      try {
        const res = await apiPost<{ order: WorkOrder }>('/api/v1/taller/orders', {
          customerId,
          customerName: resolvedName,
          vehicleId,
          workerId,
          currentKm: Math.floor(kmNum),
          serviceDesc: serviceDesc.trim(),
          totalEstimated: estNum,
        });
        toast(`Orden de trabajo ${res.order.id} ingresada para placa ${res.order.plate}`);
        setServiceDesc('');
        setOrdersViewMode('list');
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible crear la orden de trabajo');
      }
    });
  };

  const handleAdvanceStage = (order: WorkOrder, status: string) => {
    void run(async () => {
      try {
        await apiPost(`/api/v1/taller/orders/${encodeURIComponent(order.id)}/stage`, { status });
        toast(`Orden ${order.id} actualizada a etapa "${status}"`);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible avanzar la etapa de la orden');
      }
    });
  };

  const handleSendOrderToPos = (order: WorkOrder) => {
    if (!hasService('ms-facturacion')) {
      toast('El servicio de Facturación POS no está activo en la suscripción actual');
      return;
    }
    navigateTo('ms-facturacion', 'pos_mostrador', {
      customerId: order.customerId || undefined,
      customerName: order.customerName,
      vehicleId: order.vehicleId || undefined,
      plate: order.plate,
      currentKm: order.currentKm,
      nextOilKm: order.nextOilKm,
      mechanicId: order.workerId || undefined,
      linkedWorkOrderId: order.id,
      items: [
        {
          kind: 'SERVICIO',
          refId: order.id,
          code: order.id,
          name: `${order.serviceDesc} (Placa ${order.plate})`,
          qty: 1,
          price: order.totalEstimated,
          taxPct: 0,
          workerId: order.workerId,
          workerName: order.workerName,
        },
      ],
    });
    toast(`Orden ${order.id} transferida a Caja POS para facturación`);
  };

  const handleCreateWorker = (e: React.FormEvent) => {
    e.preventDefault();
    const pct = Number(wkCommission || 0);
    if (!wkName.trim() || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast('Ingresa el nombre del especialista y un porcentaje de comisión entre 0% y 100%');
      return;
    }
    void run(async () => {
      try {
        const res = await apiPost<{ worker: Worker }>('/api/v1/taller/workers', {
          name: wkName.trim(),
          docNumber: wkDoc.trim(),
          specialty: wkSpecialty.trim(),
          commissionPct: pct,
          phone: wkPhone.trim(),
        });
        toast(`Especialista registrado: ${res.worker.name} (${res.worker.code})`);
        setWkName('');
        setWkDoc('');
        setWkPhone('');
        setWorkersViewMode('list');
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al registrar el especialista');
      }
    });
  };

  const confirmSettleWorker = () => {
    if (!workerToSettle) return;
    const wk = workerToSettle;
    void run(async () => {
      try {
        const res = await apiPost<{ settlement: SettlementRecord }>(
          `/api/v1/taller/workers/${encodeURIComponent(wk.id)}/settle`,
          {}
        );
        toast(`Comisión liquidada (${res.settlement.id}): ${formatCop(res.settlement.technicianPayout)}`);
        setWorkerToSettle(null);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible liquidar la comisión');
      }
    });
  };

  const handleExportOrdersCsv = () => {
    downloadCsvUtf8(
      'ordenes_taller.csv',
      ['Orden', 'Fecha', 'Placa', 'Vehículo', 'Cliente', 'Km Ingreso', 'Próx. Aceite', 'Técnico', 'Estado', 'Estimado'],
      orders.map((o) => [
        o.id,
        o.createdAt,
        o.plate,
        o.vehicleBrand,
        o.customerName,
        o.currentKm,
        o.nextOilKm,
        o.workerName,
        o.status,
        o.totalEstimated,
      ])
    );
  };

  const handleExportVehiclesCsv = () => {
    downloadCsvUtf8(
      'hoja_vida_vehiculos.csv',
      ['ID', 'Placa', 'Marca / Línea', 'Tipo', 'Propietario', 'Km Actual', 'Próximo Aceite Km', 'SOAT'],
      vehicles.map((v) => [
        v.id,
        v.plate,
        v.brand,
        v.vehicleType,
        v.customerName,
        v.currentKm,
        v.nextOilKm,
        v.soatExpiry,
      ])
    );
  };

  const buildOrderPrintPayload = (order: WorkOrder): Record<string, unknown> => ({
    document_type: 'ORDEN_TALLER',
    layout_variant: 'factura_taller',
    document_number: order.id,
    issue_date: order.createdAt,
    customer_name: order.customerName,
    extra_fields: {
      Placa: order.plate,
      Vehículo: order.vehicleBrand,
      'Kilometraje Ingreso': `${order.currentKm.toLocaleString('es-CO')} km`,
      'Próximo Aceite Sugerido': `${order.nextOilKm.toLocaleString('es-CO')} km`,
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
    notes: 'Orden de servicio automotriz. Conserve este comprobante para el retiro del vehículo.',
  });

  const buildSettlementPrintPayload = (st: SettlementRecord): Record<string, unknown> => ({
    document_type: 'COMPROBANTE_LIQUIDACION',
    layout_variant: 'carta_membrete',
    document_number: st.id,
    issue_date: st.date,
    customer_name: st.workerName,
    extra_fields: {
      Especialista: st.workerName,
      'Base Mano de Obra': formatCop(st.grossLabor),
      'Porcentaje Comisión': `${st.commissionPct}%`,
      'Retención Taller': formatCop(st.companyRetention),
    },
    items: [
      {
        code: st.id,
        description: `Liquidación de comisión técnica (${st.commissionPct}% sobre mano de obra facturada)`,
        quantity: 1,
        unit_price: st.technicianPayout,
        subtotal: st.technicianPayout,
      },
    ],
    subtotal: st.technicianPayout,
    grand_total: st.technicianPayout,
    notes: 'Comprobante de pago de comisiones a especialista técnico.',
  });

  const activeOrders = orders.filter((o) => o.status !== 'Entregado');
  const readyOrders = orders.filter((o) => o.status === 'Listo');
  const estimatedPipeline = activeOrders.reduce((acc, o) => acc + (o.totalEstimated || 0), 0);
  const pendingCommissionsGross = workers.reduce((acc, w) => acc + (w.totalDayGross || 0), 0);
  const liveKmNumeric = Math.max(0, Number(currentKm || 0));
  const suggestedNextOilKm = liveKmNumeric + 5000;

  const filteredOrders = orders.filter((ord) => {
    if (orderStatusFilter && ord.status !== orderStatusFilter) return false;
    const q = orderSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      ord.id.toLowerCase().includes(q) ||
      ord.plate.toLowerCase().includes(q) ||
      ord.vehicleBrand.toLowerCase().includes(q) ||
      ord.customerName.toLowerCase().includes(q) ||
      ord.serviceDesc.toLowerCase().includes(q) ||
      (ord.workerName || '').toLowerCase().includes(q)
    );
  });

  const filteredVehicles = vehicles.filter((v) => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      v.plate.toLowerCase().includes(q) ||
      v.brand.toLowerCase().includes(q) ||
      v.vehicleType.toLowerCase().includes(q) ||
      v.customerName.toLowerCase().includes(q)
    );
  });

  const badgeForOrderStatus = (status: string): string => {
    if (status === 'Entregado') return 'pk-badge pk-badge-emerald';
    if (status === 'Listo') return 'pk-badge pk-badge-blue';
    if (status === 'En Proceso') return 'pk-badge pk-badge-amber';
    return 'pk-badge';
  };

  return (
    <div className="pk-stack">
      {currentTab === 'tablero_ordenes' && (
        <ModuleGate module="tablero_ordenes">
          <div className="pk-stack">
            <PkKpiRow
              items={[
                { label: 'Órdenes en Taller', value: String(activeOrders.length), color: 'var(--pk-primary)' },
                { label: 'Vehículos Listos', value: String(readyOrders.length), color: 'var(--pk-emerald)' },
                { label: 'Servicio en Proceso', value: formatCop(estimatedPipeline), color: 'var(--pk-amber)' },
                { label: 'Flota Registrada', value: `${vehicles.length} placas` },
              ]}
            />

            <PkViewSwitcher
              title="Órdenes de Trabajo y Servicio Automotriz"
              subtitle="Supervisa el tablero operativo de vehículos en taller o registra una nueva recepción."
              mode={ordersViewMode}
              onModeChange={setOrdersViewMode}
              listLabel="📋 Tablero de Órdenes"
              createLabel="+ Nueva Orden de Trabajo"
              count={orders.length}
              extraActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setShowNewVehicleModal(true)}
                  >
                    + Nueva Placa
                  </button>
                  {ordersViewMode === 'list' && (
                    <button
                      type="button"
                      className="pk-btn pk-btn-outline"
                      onClick={handleExportOrdersCsv}
                    >
                      📥 Exportar CSV
                    </button>
                  )}
                </>
              }
            />

            {ordersViewMode === 'create' ? (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">🔧 Recepción de Vehículo y Apertura de Orden de Trabajo</div>
                  <div className="pk-row-actions">
                    <FeatureGate module="tablero_ordenes" feature="alerta_cambio_aceite">
                      <span className="pk-badge pk-badge-amber">
                        🛢️ Próximo Aceite Sugerido: {suggestedNextOilKm.toLocaleString('es-CO')} km
                      </span>
                    </FeatureGate>
                    <span className="pk-badge pk-badge-blue">{nextOrderCode}</span>
                  </div>
                </div>
                <div className="pk-card-body">
                  <form onSubmit={handleCreateOrder} className="pk-form-grid cols-2">
                    <PkAutoCodeInput label="Consecutivo Orden" value={nextOrderCode} />

                    <PkSelect
                      label="Placa / Vehículo *"
                      items={vehicles}
                      value={vehicleId}
                      onChange={handleVehicleChange}
                      getValue={(v) => v.id}
                      getLabel={(v) => `${v.plate} — ${v.brand} (${v.currentKm.toLocaleString('es-CO')} km)`}
                      onCreateNew={() => setShowNewVehicleModal(true)}
                      createLabel="+ Nueva Placa"
                      searchable
                    />

                    <div className="pk-field">
                      <label>Propietario / Cliente</label>
                      <input
                        value={ownerNameOverride}
                        onChange={(e) => setOwnerNameOverride(e.target.value)}
                        placeholder="Nombre del titular o empresa"
                      />
                    </div>

                    <PkSelect
                      label="Especialista Asignado"
                      items={workers}
                      value={workerId}
                      onChange={setWorkerId}
                      getValue={(w) => w.id}
                      getLabel={(w) => `${w.name} (${w.specialty})`}
                      emptyLabel="Sin asignar / Taller General"
                      searchable
                    />

                    <div className="pk-field">
                      <label>Kilometraje Actual de Ingreso *</label>
                      <input
                        required
                        type="number"
                        min="0"
                        value={currentKm}
                        onChange={(e) => setCurrentKm(e.target.value)}
                      />
                    </div>

                    <div className="pk-field">
                      <label>Valor Estimado Servicio (COP) *</label>
                      <input
                        required
                        type="number"
                        min="0"
                        step="1000"
                        value={totalEstimated}
                        onChange={(e) => setTotalEstimated(e.target.value)}
                      />
                    </div>

                    <div className="pk-field pk-col-span-full">
                      <label>Diagnóstico Inicial y Trabajos Solicitados *</label>
                      <input
                        required
                        value={serviceDesc}
                        onChange={(e) => setServiceDesc(e.target.value)}
                        placeholder="Ej: Revisión general de frenos, cambio de aceite sintético 5W-30 y escáner electrónico"
                      />
                    </div>

                    <div className="pk-form-actions">
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline"
                        onClick={() => setOrdersViewMode('list')}
                        disabled={busy}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                        {busy ? 'Registrando...' : '📋 Ingresar Orden a Taller'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📋 Tablero Operativo de Órdenes de Servicio</div>
                </div>
                <div className="pk-datatable-toolbar">
                  <input
                    className="pk-input pk-datatable-search"
                    placeholder="🔎 Buscar por orden, placa, vehículo, cliente o diagnóstico..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 230 }}>
                      <PkSimpleSelect
                        ariaLabel="Filtrar por estado de orden"
                        value={orderStatusFilter}
                        onChange={setOrderStatusFilter}
                        allowClear
                        placeholder="Todas las etapas operativas"
                        options={ORDER_STATUS_FILTER_OPTIONS}
                      />
                    </div>
                  </div>
                </div>
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Orden</th>
                          <th>Vehículo / Placa</th>
                          <th>Cliente</th>
                          <th>Servicio y Diagnóstico</th>
                          <th>Técnico</th>
                          <th>Estado</th>
                          <th>Estimado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 24 }}>
                              No se encontraron órdenes de trabajo con los criterios actuales.
                            </td>
                          </tr>
                        ) : (
                          filteredOrders.map((ord) => (
                            <tr key={ord.id}>
                              <td>
                                <div style={{ fontWeight: 800 }}>{ord.id}</div>
                                <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{ord.createdAt}</div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 800 }}>{ord.plate}</div>
                                <div style={{ fontSize: 11.5, color: '#475569' }}>{ord.vehicleBrand}</div>
                                <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                                  {ord.currentKm.toLocaleString('es-CO')} km
                                </div>
                              </td>
                              <td>{ord.customerName}</td>
                              <td>
                                <div>{ord.serviceDesc}</div>
                                <FeatureGate module="tablero_ordenes" feature="alerta_cambio_aceite">
                                  <div style={{ fontSize: 11, color: 'var(--pk-amber)', fontWeight: 700, marginTop: 2 }}>
                                    🛢️ Próx. aceite: {ord.nextOilKm.toLocaleString('es-CO')} km
                                  </div>
                                </FeatureGate>
                              </td>
                              <td>{ord.workerName || 'Taller General'}</td>
                              <td>
                                <span className={badgeForOrderStatus(ord.status)}>{ord.status}</span>
                              </td>
                              <td style={{ fontWeight: 800 }}>{formatCop(ord.totalEstimated)}</td>
                              <td>
                                <div className="pk-row-actions">
                                  {ord.status === 'Recibido' && (
                                    <button
                                      type="button"
                                      className="pk-btn pk-btn-outline pk-btn-sm"
                                      disabled={busy}
                                      onClick={() => handleAdvanceStage(ord, 'En Proceso')}
                                    >
                                      ▶ Iniciar
                                    </button>
                                  )}
                                  {ord.status === 'En Proceso' && (
                                    <button
                                      type="button"
                                      className="pk-btn pk-btn-amber pk-btn-sm"
                                      disabled={busy}
                                      onClick={() => handleAdvanceStage(ord, 'Listo')}
                                    >
                                      ✓ Marcar Listo
                                    </button>
                                  )}
                                  {ord.status !== 'Entregado' && (
                                    <button
                                      type="button"
                                      className="pk-btn pk-btn-emerald pk-btn-sm"
                                      disabled={busy}
                                      onClick={() => handleSendOrderToPos(ord)}
                                    >
                                      💵 Facturar POS
                                    </button>
                                  )}
                                  <PkPrintButton
                                    label="🖨️ Orden"
                                    payload={buildOrderPrintPayload(ord)}
                                  />
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
            )}

            <PkModal
              open={showNewVehicleModal}
              title="Registrar Nueva Placa y Hoja de Vida"
              onClose={() => setShowNewVehicleModal(false)}
            >
              <form onSubmit={submitCreateVehicle('modal')} className="pk-form-grid cols-2">
                <PkAutoCodeInput label="Código Vehículo" value={nextVehicleCode} />

                <div className="pk-field">
                  <label>Placa del Vehículo *</label>
                  <input
                    required
                    value={vehPlate}
                    onChange={(e) => setVehPlate(e.target.value.toUpperCase())}
                    placeholder="Ej: KLP842"
                  />
                </div>

                <div className="pk-field">
                  <label>Marca y Línea *</label>
                  <input
                    required
                    value={vehBrand}
                    onChange={(e) => setVehBrand(e.target.value)}
                    placeholder="Ej: Renault Duster Intens 1.3T"
                  />
                </div>

                <PkSimpleSelect
                  label="Clase de Vehículo"
                  value={vehType}
                  onChange={setVehType}
                  options={VEHICLE_TYPE_OPTIONS}
                />

                {customers.length > 0 && (
                  <PkSelect
                    label="Directorio Clientes (Opcional)"
                    items={customers}
                    value={vehCustomerId}
                    onChange={setVehCustomerId}
                    getValue={(c) => c.id}
                    getLabel={(c) => `${c.name} (${c.nit})`}
                    emptyLabel="Especificar propietario manual"
                    searchable
                  />
                )}

                <div className={`pk-field${customers.length === 0 ? ' pk-col-span-full' : ''}`}>
                  <label>Nombre Propietario / Empresa</label>
                  <input
                    value={vehCustomerName}
                    onChange={(e) => setVehCustomerName(e.target.value)}
                    placeholder="Ej: Transportes Sabana S.A.S."
                  />
                </div>

                <div className="pk-field">
                  <label>Kilometraje Actual *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    value={vehKm}
                    onChange={(e) => setVehKm(e.target.value)}
                  />
                </div>

                <div className="pk-field">
                  <label>Vencimiento SOAT</label>
                  <input
                    type="date"
                    value={vehSoat}
                    onChange={(e) => setVehSoat(e.target.value)}
                  />
                </div>

                <div className="pk-form-actions">
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setShowNewVehicleModal(false)}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                    {busy ? 'Guardando...' : '💾 Registrar Placa'}
                  </button>
                </div>
              </form>
            </PkModal>
          </div>
        </ModuleGate>
      )}

      {currentTab === 'hoja_vida_vehiculos' && (
        <ModuleGate module="hoja_vida_vehiculos">
          <div className="pk-stack">
            <PkViewSwitcher
              title="Directorio de Vehículos y Hoja de Vida"
              subtitle="Consulta el historial técnico por placa, kilometraje y vigencia SOAT o vincula nuevos vehículos."
              mode={vehiclesViewMode}
              onModeChange={setVehiclesViewMode}
              listLabel="📖 Directorio de Placas"
              createLabel="+ Registrar Vehículo"
              count={vehicles.length}
              extraActions={
                vehiclesViewMode === 'list' ? (
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={handleExportVehiclesCsv}
                  >
                    📥 Exportar Flota CSV
                  </button>
                ) : undefined
              }
            />

            {vehiclesViewMode === 'create' ? (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">🚗 Registro de Vehículos y Control de Placas</div>
                  <span className="pk-badge pk-badge-blue">{nextVehicleCode}</span>
                </div>
                <div className="pk-card-body">
                  <form onSubmit={submitCreateVehicle('page')} className="pk-form-grid cols-2">
                    <PkAutoCodeInput label="Código Vehículo" value={nextVehicleCode} />

                    <div className="pk-field">
                      <label>Placa *</label>
                      <input
                        required
                        value={vehPlate}
                        onChange={(e) => setVehPlate(e.target.value.toUpperCase())}
                        placeholder="Ej: JTR920"
                      />
                    </div>

                    <div className="pk-field">
                      <label>Marca y Línea *</label>
                      <input
                        required
                        value={vehBrand}
                        onChange={(e) => setVehBrand(e.target.value)}
                        placeholder="Ej: Chevrolet Tracker Turbo"
                      />
                    </div>

                    <PkSimpleSelect
                      label="Tipo de Vehículo"
                      value={vehType}
                      onChange={setVehType}
                      options={VEHICLE_TYPE_OPTIONS}
                    />

                    {customers.length > 0 && (
                      <PkSelect
                        label="Directorio Clientes (Opcional)"
                        items={customers}
                        value={vehCustomerId}
                        onChange={setVehCustomerId}
                        getValue={(c) => c.id}
                        getLabel={(c) => `${c.name} (${c.nit})`}
                        emptyLabel="Especificar propietario manual"
                        searchable
                      />
                    )}

                    <div className={`pk-field${customers.length === 0 ? ' pk-col-span-full' : ''}`}>
                      <label>Titular / Propietario</label>
                      <input
                        value={vehCustomerName}
                        onChange={(e) => setVehCustomerName(e.target.value)}
                        placeholder="Nombre del titular"
                      />
                    </div>

                    <div className="pk-field">
                      <label>Kilometraje Actual *</label>
                      <input
                        required
                        type="number"
                        min="0"
                        value={vehKm}
                        onChange={(e) => setVehKm(e.target.value)}
                      />
                    </div>

                    <div className="pk-field">
                      <label>Vigencia SOAT</label>
                      <input
                        type="date"
                        value={vehSoat}
                        onChange={(e) => setVehSoat(e.target.value)}
                      />
                    </div>

                    <div className="pk-form-actions">
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline"
                        onClick={() => setVehiclesViewMode('list')}
                        disabled={busy}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                        {busy ? 'Guardando...' : '➕ Guardar Vehículo'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📖 Historial Técnico por Placa</div>
                </div>
                <div className="pk-datatable-toolbar">
                  <input
                    className="pk-input pk-datatable-search"
                    placeholder="🔎 Buscar por placa, marca, clase o propietario..."
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                  />
                </div>
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Placa</th>
                          <th>Marca y Línea</th>
                          <th>Clase</th>
                          <th>Propietario</th>
                          <th>Kilometraje Actual</th>
                          <th>Próximo Aceite</th>
                          <th>Vencimiento SOAT</th>
                          <th>Órdenes</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVehicles.length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 24 }}>
                              No se encontraron vehículos registrados con ese criterio.
                            </td>
                          </tr>
                        ) : (
                          filteredVehicles.map((v) => {
                            const count = orders.filter((o) => o.vehicleId === v.id || o.plate === v.plate).length;
                            return (
                              <tr key={v.id}>
                                <td style={{ fontWeight: 800 }}>{v.plate}</td>
                                <td>{v.brand}</td>
                                <td>{v.vehicleType}</td>
                                <td>{v.customerName}</td>
                                <td>{v.currentKm.toLocaleString('es-CO')} km</td>
                                <td style={{ color: 'var(--pk-amber)', fontWeight: 700 }}>
                                  {v.nextOilKm.toLocaleString('es-CO')} km
                                </td>
                                <td>{v.soatExpiry || 'Sin registro'}</td>
                                <td>{count}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-danger pk-btn-sm"
                                    disabled={busy}
                                    onClick={() => setVehicleToDelete(v)}
                                  >
                                    Eliminar
                                  </button>
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

            <PkConfirmModal
              open={Boolean(vehicleToDelete)}
              title="Eliminar Vehículo del Directorio"
              message={
                vehicleToDelete
                  ? `¿Confirmas eliminar el vehículo de placa ${vehicleToDelete.plate} (${vehicleToDelete.brand})? Solo se permite si no tiene órdenes activas.`
                  : ''
              }
              confirmLabel="Eliminar Placa"
              busy={busy}
              onConfirm={confirmDeleteVehicle}
              onCancel={() => setVehicleToDelete(null)}
            />
          </div>
        </ModuleGate>
      )}

      {currentTab === 'comisiones_tecnicos' && (
        <ModuleGate module="comisiones_tecnicos">
          <div className="pk-stack">
            <PkKpiRow
              items={[
                { label: 'Especialistas Activos', value: String(workers.length), color: 'var(--pk-primary)' },
                {
                  label: 'Mano de Obra por Liquidar',
                  value: formatCop(pendingCommissionsGross),
                  color: 'var(--pk-amber)',
                },
                { label: 'Liquidaciones Emitidas', value: String(settlements.length), color: 'var(--pk-emerald)' },
              ]}
            />

            <PkViewSwitcher
              title="Especialistas Técnicos y Liquidación de Comisiones"
              subtitle="Controla los saldos acumulados por mano de obra facturada, emite liquidaciones o vincula nuevos especialistas."
              mode={workersViewMode}
              onModeChange={setWorkersViewMode}
              listLabel="💸 Comisiones e Historial"
              createLabel="+ Vincular Técnico"
              count={workers.length}
            />

            {workersViewMode === 'create' ? (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">👷 Vincular Técnico o Especialista</div>
                  <span className="pk-badge pk-badge-blue">{nextWorkerCode}</span>
                </div>
                <div className="pk-card-body">
                  <form onSubmit={handleCreateWorker} className="pk-form-grid cols-2">
                    <PkAutoCodeInput label="Código Especialista" value={nextWorkerCode} />

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
                      <label>Documento Identidad</label>
                      <input
                        value={wkDoc}
                        onChange={(e) => setWkDoc(e.target.value)}
                        placeholder="Cédula"
                      />
                    </div>

                    <div className="pk-field">
                      <label>Especialidad Técnica</label>
                      <input
                        value={wkSpecialty}
                        onChange={(e) => setWkSpecialty(e.target.value)}
                        placeholder="Ej: Mecánica General e Inyección"
                      />
                    </div>

                    <div className="pk-field">
                      <label>% Comisión Mano de Obra *</label>
                      <input
                        required
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={wkCommission}
                        onChange={(e) => setWkCommission(e.target.value)}
                      />
                    </div>

                    <div className="pk-field">
                      <label>Teléfono Móvil</label>
                      <input
                        value={wkPhone}
                        onChange={(e) => setWkPhone(e.target.value)}
                        placeholder="Ej: 3005128900"
                      />
                    </div>

                    <div className="pk-form-actions">
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline"
                        onClick={() => setWorkersViewMode('list')}
                        disabled={busy}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                        {busy ? 'Guardando...' : '💾 Registrar Técnico'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <>
                <div className="pk-card">
                  <div className="pk-card-head">
                    <div className="pk-card-title">💸 Saldos Acumulados por Liquidar</div>
                  </div>
                  <div className="pk-card-body">
                    <div className="pk-cards-grid">
                      {workers.map((wk) => {
                        const estPayout = (wk.totalDayGross * wk.commissionPct) / 100;
                        return (
                          <div
                            key={wk.id}
                            style={{
                              border: '1px solid var(--pk-border)',
                              borderRadius: 10,
                              padding: 12,
                              background: '#ffffff',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong>{wk.name}</strong>
                              <span className="pk-badge pk-badge-blue">{wk.code}</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 4 }}>
                              {wk.specialty} · Comisión: <strong>{wk.commissionPct}%</strong>
                            </div>
                            <div style={{ marginTop: 8, fontSize: 12.5 }}>
                              Base facturada: <strong>{formatCop(wk.totalDayGross)}</strong>
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--pk-emerald)', marginTop: 2 }}>
                              Neto Técnico: {formatCop(estPayout)}
                            </div>
                            <div style={{ marginTop: 10 }}>
                              <button
                                type="button"
                                className="pk-btn pk-btn-emerald pk-btn-sm"
                                disabled={busy || wk.totalDayGross <= 0}
                                onClick={() => setWorkerToSettle(wk)}
                              >
                                💸 Liquidar Turno
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pk-card">
                  <div className="pk-card-head">
                    <div className="pk-card-title">📜 Historial de Liquidaciones de Mano de Obra</div>
                  </div>
                  <div className="pk-card-body">
                    <div className="pk-table-wrap">
                      <table className="pk-table">
                        <thead>
                          <tr>
                            <th>Comprobante</th>
                            <th>Fecha</th>
                            <th>Especialista</th>
                            <th>Base Mano de Obra</th>
                            <th>% Comisión</th>
                            <th>Pago Técnico</th>
                            <th>Retención Taller</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {settlements.map((st) => (
                            <tr key={st.id}>
                              <td style={{ fontWeight: 800 }}>{st.id}</td>
                              <td>{st.date}</td>
                              <td>{st.workerName}</td>
                              <td>{formatCop(st.grossLabor)}</td>
                              <td>{st.commissionPct}%</td>
                              <td style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>
                                {formatCop(st.technicianPayout)}
                              </td>
                              <td>{formatCop(st.companyRetention)}</td>
                              <td>
                                <PkPrintButton
                                  label="🖨️ Recibo"
                                  payload={buildSettlementPrintPayload(st)}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}

            <PkConfirmModal
              open={Boolean(workerToSettle)}
              title="Confirmar Liquidación de Comisión"
              message={
                workerToSettle
                  ? `¿Confirmas liquidar la mano de obra acumulada de ${workerToSettle.name} por ${formatCop(
                      (workerToSettle.totalDayGross * workerToSettle.commissionPct) / 100
                    )} y reiniciar su acumulado del turno?`
                  : ''
              }
              confirmLabel="Emitir Liquidación"
              busy={busy}
              onConfirm={confirmSettleWorker}
              onCancel={() => setWorkerToSettle(null)}
            />
          </div>
        </ModuleGate>
      )}
    </div>
  );
};

export default TallerView;
