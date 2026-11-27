import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkSelect,
  PkSimpleSelect,
  PkModal,
  PkConfirmModal,
  PkPrintButton,
  PkKpiRow,
  PkLiveHeader,
  PkKanbanBoard,
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

type OrderBayKey = 'recepcion' | 'diagnostico' | 'reparacion' | 'entrega';
type OrderIntakeType = 'preventivo' | 'correctivo' | 'peritaje';

const VALID_MODULES = ['tablero_ordenes', 'hoja_vida_vehiculos', 'comisiones_tecnicos'] as const;

const VEHICLE_TYPE_CARDS = [
  {
    key: 'Automóvil',
    icon: '🚗',
    title: 'Automóvil / Sedán',
    description: 'Vehículo liviano particular o ejecutivo de pasajeros.',
  },
  {
    key: 'Camioneta',
    icon: '🚙',
    title: 'Camioneta / SUV',
    description: 'Campero, pick-up doble cabina o SUV multipropósito.',
  },
  {
    key: 'Motocicleta',
    icon: '🏍️',
    title: 'Motocicleta',
    description: 'Dos ruedas urbano, touring o alto cilindraje.',
  },
  {
    key: 'Utilitario / Carga',
    icon: '🚚',
    title: 'Utilitario / Carga',
    description: 'Furgón, van comercial o camión liviano de flota.',
  },
];

const VEHICLE_TYPE_OPTIONS = [
  { value: 'Automóvil', label: 'Automóvil' },
  { value: 'Camioneta', label: 'Camioneta / SUV' },
  { value: 'Motocicleta', label: 'Motocicleta' },
  { value: 'Utilitario / Carga', label: 'Utilitario / Carga' },
];

const ORDER_INTAKE_TYPES = [
  {
    key: 'preventivo',
    icon: '🔧',
    title: 'Mantenimiento Preventivo',
    description: 'Cambio de aceite, filtros, fluidos, alineación y sincronización por kilometraje.',
    badge: 'Rápido',
  },
  {
    key: 'correctivo',
    icon: '⚙️',
    title: 'Reparación Mecánica Correctiva',
    description: 'Intervención de frenos, suspensión, embrague, motor o sistema eléctrico con repuestos.',
    badge: 'Taller',
  },
  {
    key: 'peritaje',
    icon: '🔍',
    title: 'Diagnóstico / Peritaje',
    description: 'Escáner electrónico OBD-II, prueba de compresión e inspección multipunto.',
    badge: 'Escáner',
  },
];

const CORRECTIVE_SYSTEM_OPTIONS = [
  { value: 'Sistema de Frenos y ABS', label: 'Sistema de Frenos y ABS' },
  { value: 'Suspensión y Dirección', label: 'Suspensión y Dirección' },
  { value: 'Motor, Distribución y Refrigeración', label: 'Motor, Distribución y Refrigeración' },
  { value: 'Transmisión y Embrague', label: 'Transmisión y Embrague' },
  { value: 'Inyección Electrónica y Sensores', label: 'Inyección Electrónica y Sensores' },
  { value: 'Aire Acondicionado y Eléctrico', label: 'Aire Acondicionado y Eléctrico' },
];

const DIAGNOSTIC_SCOPE_OPTIONS = [
  { value: 'Escáner Electrónico OBD-II + Códigos DTC', label: 'Escáner Electrónico OBD-II + Códigos DTC' },
  { value: 'Peritaje Integral Compra-Venta (60 puntos)', label: 'Peritaje Integral Compra-Venta (60 puntos)' },
  { value: 'Prueba de Compresión, Fugas y Ruta', label: 'Prueba de Compresión, Fugas y Ruta' },
];

const PREVENTIVE_PACKAGES = [
  { label: '🛢️ Cambio Aceite Sintético + Filtro', desc: 'Cambio de aceite sintético 5W-30, filtro de aceite y revisión de niveles', amount: '210000' },
  { label: '🔩 Mantenimiento 10.000 km', desc: 'Cambio de aceite, filtros de aire/cabina, rotación y balanceo de llantas', amount: '340000' },
  { label: '⚡ Sincronización e Inyectores', desc: 'Lavado ultrasónico de inyectores, cambio de bujías y cuerpo de aceleración', amount: '285000' },
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

  const [ordersDisplayMode, setOrdersDisplayMode] = useState<'board' | 'table'>('board');
  const [vehiclesDisplayMode, setVehiclesDisplayMode] = useState<'board' | 'table'>('board');

  const [orderStudioOpen, setOrderStudioOpen] = useState(false);
  const [vehicleStudioOpen, setVehicleStudioOpen] = useState(false);
  const [workerStudioOpen, setWorkerStudioOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<WorkOrder | null>(null);

  const [orderStagePill, setOrderStagePill] = useState('ALL');
  const [vehicleAlertPill, setVehicleAlertPill] = useState('ALL');
  const [orderSearch, setOrderSearch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  // Sub-etapa local para desdoblar "En Proceso" entre Bahía de Diagnóstico y Bahía de Reparación sin alterar el contrato API
  const [processSubStage, setProcessSubStage] = useState<Record<string, 'diagnostico' | 'reparacion'>>({});

  const [nextOrderCode, setNextOrderCode] = useState('OT-706');
  const [nextWorkerCode, setNextWorkerCode] = useState('TEC-106');
  const [nextVehicleCode, setNextVehicleCode] = useState('VEH-204');
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const [orderIntakeType, setOrderIntakeType] = useState<OrderIntakeType>('preventivo');
  const [vehicleId, setVehicleId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [ownerNameOverride, setOwnerNameOverride] = useState('');
  const [currentKm, setCurrentKm] = useState('45000');
  const [serviceDesc, setServiceDesc] = useState('');
  const [totalEstimated, setTotalEstimated] = useState('210000');

  const [correctiveSystem, setCorrectiveSystem] = useState('Sistema de Frenos y ABS');
  const [laborEstimate, setLaborEstimate] = useState('120000');
  const [partsEstimate, setPartsEstimate] = useState('160000');
  const [diagnosticScope, setDiagnosticScope] = useState('Escáner Electrónico OBD-II + Códigos DTC');
  const [reportedSymptom, setReportedSymptom] = useState('');

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

  const resolveOrderBay = useCallback(
    (ord: WorkOrder): OrderBayKey => {
      if (ord.status === 'Recibido') return 'recepcion';
      if (ord.status === 'En Proceso') {
        const explicit = processSubStage[ord.id];
        if (explicit) return explicit;
        const lower = (ord.serviceDesc || '').toLowerCase();
        if (lower.includes('diagnóstico') || lower.includes('diagnostico') || lower.includes('escáner') || lower.includes('peritaje')) {
          return 'diagnostico';
        }
        return 'reparacion';
      }
      return 'entrega';
    },
    [processSubStage]
  );

  const handleVehicleChange = (newVehId: string) => {
    setVehicleId(newVehId);
    const veh = vehicles.find((v) => v.id === newVehId);
    if (veh) {
      setCurrentKm(String(veh.currentKm || 0));
      setCustomerId(veh.customerId || '');
      setOwnerNameOverride(veh.customerName || '');
    }
  };

  const handleIntakeTypeChange = (key: string) => {
    const nextType = key as OrderIntakeType;
    setOrderIntakeType(nextType);
    if (nextType === 'preventivo') {
      if (!serviceDesc.trim()) {
        setServiceDesc(PREVENTIVE_PACKAGES[0].desc);
      }
      setTotalEstimated('210000');
    } else if (nextType === 'correctivo') {
      const sum = Math.max(0, Number(laborEstimate || 0)) + Math.max(0, Number(partsEstimate || 0));
      setTotalEstimated(String(sum || 280000));
    } else {
      setTotalEstimated('140000');
    }
  };

  const syncCorrectiveTotals = (nextLabor: string, nextParts: string) => {
    setLaborEstimate(nextLabor);
    setPartsEstimate(nextParts);
    const sum = Math.max(0, Number(nextLabor || 0)) + Math.max(0, Number(nextParts || 0));
    setTotalEstimated(String(sum));
  };

  const openOrderStudioForVehicle = (veh?: Vehicle) => {
    if (veh) {
      setVehicleId(veh.id);
      setCurrentKm(String(veh.currentKm || 0));
      setCustomerId(veh.customerId || '');
      setOwnerNameOverride(veh.customerName || '');
    }
    setOrderStudioOpen(true);
  };

  const submitCreateVehicle = (origin: 'modal' | 'studio') => (e: React.FormEvent) => {
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
          setVehicleStudioOpen(false);
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
    let composedDesc = serviceDesc.trim();
    if (!composedDesc) {
      if (orderIntakeType === 'correctivo') {
        composedDesc = `${correctiveSystem}: intervención correctiva y ajuste técnico`;
      } else if (orderIntakeType === 'peritaje') {
        composedDesc = `${diagnosticScope}${reportedSymptom.trim() ? ` — Síntoma: ${reportedSymptom.trim()}` : ''}`;
      }
    } else if (orderIntakeType === 'correctivo' && !composedDesc.toLowerCase().includes(correctiveSystem.toLowerCase().slice(0, 6))) {
      composedDesc = `[${correctiveSystem}] ${composedDesc}`;
    } else if (orderIntakeType === 'peritaje' && reportedSymptom.trim() && !composedDesc.includes(reportedSymptom.trim())) {
      composedDesc = `${composedDesc} — Síntoma: ${reportedSymptom.trim()}`;
    }

    if (!vehicleId || !composedDesc) {
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
          serviceDesc: composedDesc,
          totalEstimated: estNum,
        });
        toast(`Orden de trabajo ${res.order.id} ingresada para placa ${res.order.plate}`);
        setServiceDesc('');
        setReportedSymptom('');
        setOrderStudioOpen(false);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible crear la orden de trabajo');
      }
    });
  };

  const handleAdvanceStage = (order: WorkOrder, status: string, nextSubStage?: 'diagnostico' | 'reparacion') => {
    void run(async () => {
      try {
        await apiPost(`/api/v1/taller/orders/${encodeURIComponent(order.id)}/stage`, { status });
        if (nextSubStage) {
          setProcessSubStage((prev) => ({ ...prev, [order.id]: nextSubStage }));
        }
        toast(
          nextSubStage === 'diagnostico'
            ? `Orden ${order.id} ingresada a Bahía de Diagnóstico`
            : `Orden ${order.id} actualizada a etapa "${status}"`
        );
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible avanzar la etapa de la orden');
      }
    });
  };

  const handleMoveDiagToRepair = (order: WorkOrder) => {
    setProcessSubStage((prev) => ({ ...prev, [order.id]: 'reparacion' }));
    toast(`Orden ${order.id} trasladada a Bahía de Reparación Mecánica`);
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
        setWorkerStudioOpen(false);
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

  const buildOrderProcessSteps = (ord: WorkOrder): PkProcessStep[] => {
    const bay = resolveOrderBay(ord);
    if (ord.status === 'Entregado') {
      return [
        { step: 1, label: 'Recepción', status: 'done' },
        { step: 2, label: 'Diagnóstico', status: 'done' },
        { step: 3, label: 'Reparación', status: 'done' },
        { step: 4, label: 'Entregado', status: 'done' },
      ];
    }
    if (bay === 'entrega') {
      return [
        { step: 1, label: 'Recepción', status: 'done' },
        { step: 2, label: 'Diagnóstico', status: 'done' },
        { step: 3, label: 'Reparación', status: 'done' },
        { step: 4, label: 'Entrega POS', status: 'active' },
      ];
    }
    if (bay === 'reparacion') {
      return [
        { step: 1, label: 'Recepción', status: 'done' },
        { step: 2, label: 'Diagnóstico', status: 'done' },
        { step: 3, label: 'Reparación', status: 'active' },
        { step: 4, label: 'Entrega', status: 'pending' },
      ];
    }
    if (bay === 'diagnostico') {
      return [
        { step: 1, label: 'Recepción', status: 'done' },
        { step: 2, label: 'Diagnóstico', status: 'active' },
        { step: 3, label: 'Reparación', status: 'pending' },
        { step: 4, label: 'Entrega', status: 'pending' },
      ];
    }
    return [
      { step: 1, label: 'Recepción', status: 'active' },
      { step: 2, label: 'Diagnóstico', status: 'pending' },
      { step: 3, label: 'Reparación', status: 'pending' },
      { step: 4, label: 'Entrega', status: 'pending' },
    ];
  };

  const evaluateSoatStatus = (soatDate: string): { label: string; tone: 'emerald' | 'amber' | 'rose'; isAlert: boolean } => {
    if (!soatDate) return { label: 'SOAT sin fecha', tone: 'amber', isAlert: true };
    const today = new Date().toISOString().slice(0, 10);
    if (soatDate < today) return { label: `SOAT Vencido (${soatDate})`, tone: 'rose', isAlert: true };
    const diffDays = Math.ceil((new Date(soatDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 45) return { label: `SOAT vence en ${diffDays}d`, tone: 'amber', isAlert: true };
    return { label: `SOAT vigente (${soatDate})`, tone: 'emerald', isAlert: false };
  };

  const activeOrders = orders.filter((o) => o.status !== 'Entregado');
  const readyOrders = orders.filter((o) => o.status === 'Listo');
  const estimatedPipeline = activeOrders.reduce((acc, o) => acc + (o.totalEstimated || 0), 0);
  const pendingCommissionsGross = workers.reduce((acc, w) => acc + (w.totalDayGross || 0), 0);
  const liveKmNumeric = Math.max(0, Number(currentKm || 0));
  const suggestedNextOilKm = liveKmNumeric + 5000;

  const bayCounts = useMemo(() => {
    let recepcion = 0;
    let diagnostico = 0;
    let reparacion = 0;
    let entrega = 0;
    let entregadas = 0;
    orders.forEach((o) => {
      if (o.status === 'Entregado') {
        entregadas += 1;
        return;
      }
      const b = resolveOrderBay(o);
      if (b === 'recepcion') recepcion += 1;
      else if (b === 'diagnostico') diagnostico += 1;
      else if (b === 'reparacion') reparacion += 1;
      else entrega += 1;
    });
    return { recepcion, diagnostico, reparacion, entrega, entregadas };
  }, [orders, resolveOrderBay]);

  const filteredOrders = useMemo(
    () =>
      orders.filter((ord) => {
        if (orderStagePill !== 'ALL') {
          if (orderStagePill === 'ENTREGADAS') {
            if (ord.status !== 'Entregado') return false;
          } else {
            if (ord.status === 'Entregado') return false;
            if (resolveOrderBay(ord) !== orderStagePill) return false;
          }
        }
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
      }),
    [orders, orderStagePill, orderSearch, resolveOrderBay]
  );

  const kanbanRecepcion = filteredOrders.filter((o) => o.status !== 'Entregado' && resolveOrderBay(o) === 'recepcion');
  const kanbanDiagnostico = filteredOrders.filter((o) => o.status !== 'Entregado' && resolveOrderBay(o) === 'diagnostico');
  const kanbanReparacion = filteredOrders.filter((o) => o.status !== 'Entregado' && resolveOrderBay(o) === 'reparacion');
  const kanbanEntrega = filteredOrders.filter(
    (o) => (o.status !== 'Entregado' && resolveOrderBay(o) === 'entrega') || (orderStagePill === 'ENTREGADAS' && o.status === 'Entregado')
  );

  const filteredVehicles = useMemo(
    () =>
      vehicles.filter((v) => {
        const soatInfo = evaluateSoatStatus(v.soatExpiry);
        const kmRemaining = Math.max(0, (v.nextOilKm || v.currentKm + 5000) - v.currentKm);
        const hasAlert = soatInfo.isAlert || kmRemaining <= 1000;
        if (vehicleAlertPill === 'ALERT' && !hasAlert) return false;
        if (vehicleAlertPill === 'OK' && hasAlert) return false;

        const q = vehicleSearch.trim().toLowerCase();
        if (!q) return true;
        return (
          v.plate.toLowerCase().includes(q) ||
          v.brand.toLowerCase().includes(q) ||
          v.vehicleType.toLowerCase().includes(q) ||
          v.customerName.toLowerCase().includes(q)
        );
      }),
    [vehicles, vehicleAlertPill, vehicleSearch]
  );

  const alertVehiclesCount = useMemo(
    () =>
      vehicles.filter((v) => {
        const soatInfo = evaluateSoatStatus(v.soatExpiry);
        const kmRemaining = Math.max(0, (v.nextOilKm || v.currentKm + 5000) - v.currentKm);
        return soatInfo.isAlert || kmRemaining <= 1000;
      }).length,
    [vehicles]
  );

  const maxWorkerGross = useMemo(
    () => Math.max(500000, ...workers.map((w) => w.totalDayGross || 0)),
    [workers]
  );

  const renderWorkOrderTicket = (ord: WorkOrder, bay: OrderBayKey) => {
    const isDelivered = ord.status === 'Entregado';
    const laborPart = Math.round((ord.totalEstimated || 0) * 0.45);
    const suppliesPart = Math.max(0, (ord.totalEstimated || 0) - laborPart);

    const primaryAction = isDelivered
      ? undefined
      : bay === 'recepcion'
      ? {
          label: '🔎 Iniciar Diagnóstico',
          tone: 'coral' as const,
          disabled: busy,
          onClick: () => handleAdvanceStage(ord, 'En Proceso', 'diagnostico'),
        }
      : bay === 'diagnostico'
      ? {
          label: '🔧 Pasar a Reparación',
          tone: 'blue' as const,
          disabled: busy,
          onClick: () => handleMoveDiagToRepair(ord),
        }
      : bay === 'reparacion'
      ? {
          label: '✅ Control Final / Lista',
          tone: 'purple' as const,
          disabled: busy,
          onClick: () => handleAdvanceStage(ord, 'Listo'),
        }
      : {
          label: '💵 Facturar Orden en POS',
          tone: 'emerald' as const,
          disabled: busy,
          onClick: () => handleSendOrderToPos(ord),
        };

    const statusPill = isDelivered
      ? { label: 'Entregada al Cliente', tone: 'emerald' as const }
      : bay === 'recepcion'
      ? { label: 'Bahía de Recepción', tone: 'amber' as const }
      : bay === 'diagnostico'
      ? { label: 'En Escáner / Diagnóstico', tone: 'blue' as const }
      : bay === 'reparacion'
      ? { label: 'En Bahía Mecánica', tone: 'purple' as const }
      : { label: 'Lista para Entrega', tone: 'emerald' as const };

    return (
      <PkTicketCard
        key={ord.id}
        code={`#${ord.id}`}
        timeAgo={ord.createdAt}
        channelBadge={{
          label: `🚘 ${ord.plate}`,
          tone: bay === 'recepcion' ? 'amber' : bay === 'diagnostico' ? 'blue' : bay === 'reparacion' ? 'purple' : 'emerald',
        }}
        title={ord.vehicleBrand}
        subtitle={`👤 ${ord.customerName} · 🛣️ ${ord.currentKm.toLocaleString('es-CO')} km`}
        metaLine={`👨‍🔧 Técnico: ${ord.workerName || 'Taller General'}`}
        items={[
          { qty: 1, name: 'Mano de obra especializada', amount: formatCop(laborPart) },
          { qty: 1, name: 'Insumos / repuestos estimados', amount: formatCop(suppliesPart) },
        ]}
        highlightNote={ord.serviceDesc}
        extraBody={
          <FeatureGate module="tablero_ordenes" feature="alerta_cambio_aceite">
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#b45309', display: 'flex', justifyContent: 'space-between' }}>
              <span>🛢️ Próximo cambio aceite:</span>
              <span>{ord.nextOilKm.toLocaleString('es-CO')} km</span>
            </div>
          </FeatureGate>
        }
        totalLabel="ESTIMADO ORDEN"
        totalValue={formatCop(ord.totalEstimated)}
        processNodes={buildOrderProcessSteps(ord)}
        statusPill={statusPill}
        primaryAction={primaryAction}
        secondaryActions={
          <>
            <PkPrintButton label="🖨️ Orden" payload={buildOrderPrintPayload(ord)} />
            <div style={{ display: 'flex', gap: 6 }}>
              {ord.status === 'Listo' && (
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  disabled={busy}
                  onClick={() => handleAdvanceStage(ord, 'Entregado')}
                >
                  ✓ Entregado
                </button>
              )}
              <button
                type="button"
                className="pk-btn pk-btn-outline pk-btn-sm"
                onClick={() => setDetailOrder(ord)}
              >
                🔍 Ficha
              </button>
            </div>
          </>
        }
      />
    );
  };

  return (
    <div className="pk-stack">
      {currentTab === 'tablero_ordenes' && (
        <ModuleGate module="tablero_ordenes">
          <div className="pk-stack">
            <PkKpiRow
              items={[
                { label: 'Órdenes Activas en Bahía', value: String(activeOrders.length), color: 'var(--pk-primary)' },
                { label: 'Listas para Facturar', value: String(readyOrders.length), color: 'var(--pk-emerald)' },
                { label: 'Valor en Proceso Taller', value: formatCop(estimatedPipeline), color: 'var(--pk-amber)' },
                { label: 'Flota Vinculada', value: `${vehicles.length} placas` },
              ]}
            />

            <PkDistributionStrip
              title="Ocupación Operativa de Bahías Automotrices"
              segments={[
                { label: 'Recepción', value: bayCounts.recepcion, displayValue: `${bayCounts.recepcion} veh.`, color: '#f59e0b' },
                { label: 'Diagnóstico', value: bayCounts.diagnostico, displayValue: `${bayCounts.diagnostico} veh.`, color: '#2563eb' },
                { label: 'En Reparación', value: bayCounts.reparacion, displayValue: `${bayCounts.reparacion} veh.`, color: '#7c3aed' },
                { label: 'Lista / Entrega', value: bayCounts.entrega, displayValue: `${bayCounts.entrega} veh.`, color: '#10b981' },
              ]}
            />

            <PkLiveHeader
              title="Centro Automotriz y Bahías"
              liveLabel="Taller en vivo"
              subtitle="Monitorea cada vehículo desde la recepción e inspección por escáner hasta la reparación y liquidación en Caja POS."
              displayMode={ordersDisplayMode}
              onDisplayModeChange={setOrdersDisplayMode}
              boardLabel="🎛️ Bahías Kanban"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Nueva Orden de Trabajo"
              onPrimaryAction={() => openOrderStudioForVehicle()}
              pills={[
                { key: 'ALL', label: 'Todas Activas', count: activeOrders.length },
                { key: 'recepcion', label: 'Recepción', count: bayCounts.recepcion },
                { key: 'diagnostico', label: 'Diagnóstico', count: bayCounts.diagnostico },
                { key: 'reparacion', label: 'En Reparación', count: bayCounts.reparacion },
                { key: 'entrega', label: 'Lista para Entrega', count: bayCounts.entrega },
                { key: 'ENTREGADAS', label: 'Historial Entregadas', count: bayCounts.entregadas },
              ]}
              activePill={orderStagePill}
              onPillChange={setOrderStagePill}
              extraActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setShowNewVehicleModal(true)}
                  >
                    + Nueva Placa
                  </button>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={handleExportOrdersCsv}
                  >
                    📥 Exportar CSV
                  </button>
                </>
              }
            />

            <div className="pk-card" style={{ padding: '12px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                <input
                  className="pk-input pk-datatable-search"
                  style={{ flex: 1, minWidth: 260 }}
                  placeholder="🔎 Filtrar en vivo por placa, consecutivo OT, marca, titular, síntoma o especialista..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                />
                <span className="pk-badge pk-badge-slate">{filteredOrders.length} órdenes visibles</span>
              </div>
            </div>

            {ordersDisplayMode === 'board' ? (
              <PkKanbanBoard
                columns={[
                  {
                    key: 'recepcion',
                    title: 'Recepción',
                    dotColor: 'amber',
                    count: kanbanRecepcion.length,
                    emptyText: 'Sin vehículos pendientes en recepción',
                    children: kanbanRecepcion.map((o) => renderWorkOrderTicket(o, 'recepcion')),
                  },
                  {
                    key: 'diagnostico',
                    title: 'Diagnóstico',
                    dotColor: 'blue',
                    count: kanbanDiagnostico.length,
                    emptyText: 'Bahía de escáner y diagnóstico despejada',
                    children: kanbanDiagnostico.map((o) => renderWorkOrderTicket(o, 'diagnostico')),
                  },
                  {
                    key: 'reparacion',
                    title: 'En Reparación',
                    dotColor: 'purple',
                    count: kanbanReparacion.length,
                    emptyText: 'Sin intervenciones mecánicas activas',
                    children: kanbanReparacion.map((o) => renderWorkOrderTicket(o, 'reparacion')),
                  },
                  {
                    key: 'entrega',
                    title: 'Lista para Entrega',
                    dotColor: 'emerald',
                    count: kanbanEntrega.length,
                    emptyText: 'Sin vehículos listos para facturar en POS',
                    children: kanbanEntrega.map((o) => renderWorkOrderTicket(o, 'entrega')),
                  },
                ]}
              />
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📋 Consolidado Tabular de Órdenes de Servicio</div>
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
                          <th>Trazabilidad</th>
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
                          filteredOrders.map((ord) => {
                            const bay = resolveOrderBay(ord);
                            return (
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
                                <td style={{ minWidth: 230 }}>
                                  <PkProcessNodes steps={buildOrderProcessSteps(ord)} compact />
                                </td>
                                <td style={{ fontWeight: 800 }}>{formatCop(ord.totalEstimated)}</td>
                                <td>
                                  <div className="pk-row-actions">
                                    {ord.status === 'Recibido' && (
                                      <button
                                        type="button"
                                        className="pk-btn pk-btn-outline pk-btn-sm"
                                        disabled={busy}
                                        onClick={() => handleAdvanceStage(ord, 'En Proceso', 'diagnostico')}
                                      >
                                        🔎 Diagnóstico
                                      </button>
                                    )}
                                    {ord.status === 'En Proceso' && bay === 'diagnostico' && (
                                      <button
                                        type="button"
                                        className="pk-btn pk-btn-outline pk-btn-sm"
                                        disabled={busy}
                                        onClick={() => handleMoveDiagToRepair(ord)}
                                      >
                                        🔧 A Reparación
                                      </button>
                                    )}
                                    {ord.status === 'En Proceso' && bay === 'reparacion' && (
                                      <button
                                        type="button"
                                        className="pk-btn pk-btn-amber pk-btn-sm"
                                        disabled={busy}
                                        onClick={() => handleAdvanceStage(ord, 'Listo')}
                                      >
                                        ✓ Marcar Lista
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
                                    <PkPrintButton label="🖨️ Orden" payload={buildOrderPrintPayload(ord)} />
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
              open={orderStudioOpen}
              title="Estudio de Recepción Vehicular y Orden de Trabajo"
              subtitle="Selecciona la modalidad de ingreso para habilitar únicamente los controles técnicos requeridos."
              badge={{ label: nextOrderCode, tone: 'blue' }}
              onClose={() => setOrderStudioOpen(false)}
              subheader={
                <PkTypeCards
                  label="1. Modalidad de Ingreso a Bahía"
                  options={ORDER_INTAKE_TYPES}
                  value={orderIntakeType}
                  onChange={handleIntakeTypeChange}
                  disabled={busy}
                />
              }
              footerLeft={
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--pk-muted)', fontWeight: 700 }}>ORDEN</div>
                    <div style={{ fontWeight: 900, color: 'var(--pk-navy)' }}>{nextOrderCode}</div>
                  </div>
                  <FeatureGate module="tablero_ordenes" feature="alerta_cambio_aceite">
                    <span className="pk-badge pk-badge-amber">
                      🛢️ Próximo Aceite: {suggestedNextOilKm.toLocaleString('es-CO')} km
                    </span>
                  </FeatureGate>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--pk-muted)', fontWeight: 700 }}>VALOR ESTIMADO</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--pk-emerald)' }}>
                      {formatCop(Number(totalEstimated || 0))}
                    </div>
                  </div>
                </div>
              }
              footerActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setOrderStudioOpen(false)}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    form="taller-order-studio-form"
                    className="pk-btn pk-btn-primary"
                    disabled={busy}
                  >
                    {busy ? 'Ingresando...' : '🚘 Ingresar Vehículo a Bahía de Recepción'}
                  </button>
                </>
              }
            >
              <form id="taller-order-studio-form" onSubmit={handleCreateOrder} className="pk-stack">
                <div className="pk-card">
                  <div className="pk-card-head">
                    <div className="pk-card-title">2. Identificación del Vehículo, Odómetro y Especialista</div>
                  </div>
                  <div className="pk-card-body">
                    <div className="pk-form-grid">
                      <PkAutoCodeInput label="Consecutivo Orden" value={nextOrderCode} />

                      <PkSelect
                        label="Placa / Vehículo *"
                        items={vehicles}
                        value={vehicleId}
                        onChange={handleVehicleChange}
                        getValue={(v) => v.id}
                        getLabel={(v) => `${v.plate} — ${v.brand} (${v.currentKm.toLocaleString('es-CO')} km)`}
                        onCreateNew={() => setShowNewVehicleModal(true)}
                        createLabel="+ Registrar Nueva Placa"
                        searchable
                      />

                      <PkSelect
                        label="Especialista / Bahía Asignada"
                        items={workers}
                        value={workerId}
                        onChange={setWorkerId}
                        getValue={(w) => w.id}
                        getLabel={(w) => `${w.name} (${w.specialty})`}
                        emptyLabel="Sin asignar / Taller General"
                        searchable
                      />

                      <div className="pk-field">
                        <label>Titular / Empresa Cliente</label>
                        <input
                          value={ownerNameOverride}
                          onChange={(e) => setOwnerNameOverride(e.target.value)}
                          placeholder="Nombre del titular o empresa"
                        />
                      </div>

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
                        <label>Valor Total Estimado (COP) *</label>
                        <input
                          required
                          type="number"
                          min="0"
                          step="1000"
                          value={totalEstimated}
                          onChange={(e) => setTotalEstimated(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {orderIntakeType === 'preventivo' && (
                  <div className="pk-card">
                    <div className="pk-card-head">
                      <div className="pk-card-title">3. Plan de Mantenimiento Preventivo y Lubricación</div>
                    </div>
                    <div className="pk-card-body pk-stack">
                      <div>
                        <div className="pk-label" style={{ marginBottom: 8 }}>Paquetes rápidos de mantenimiento</div>
                        <div className="pk-row-actions">
                          {PREVENTIVE_PACKAGES.map((pkg) => (
                            <button
                              key={pkg.label}
                              type="button"
                              className="pk-btn pk-btn-outline pk-btn-sm"
                              onClick={() => {
                                setServiceDesc(pkg.desc);
                                setTotalEstimated(pkg.amount);
                              }}
                            >
                              {pkg.label} ({formatCop(Number(pkg.amount))})
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="pk-field">
                        <label>Detalle de Fluidos, Filtros y Trabajos Preventivos *</label>
                        <textarea
                          required
                          value={serviceDesc}
                          onChange={(e) => setServiceDesc(e.target.value)}
                          placeholder="Ej: Cambio de aceite sintético 5W-30, filtro de aceite original, inspección de frenos y rotación"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {orderIntakeType === 'correctivo' && (
                  <div className="pk-card">
                    <div className="pk-card-head">
                      <div className="pk-card-title">3. Intervención Mecánica Correctiva y Presupuesto</div>
                    </div>
                    <div className="pk-card-body">
                      <div className="pk-form-grid">
                        <PkSimpleSelect
                          label="Sistema Mecánico Principal"
                          value={correctiveSystem}
                          onChange={setCorrectiveSystem}
                          options={CORRECTIVE_SYSTEM_OPTIONS}
                        />
                        <div className="pk-field">
                          <label>Mano de Obra Estimada (COP)</label>
                          <input
                            type="number"
                            min="0"
                            step="5000"
                            value={laborEstimate}
                            onChange={(e) => syncCorrectiveTotals(e.target.value, partsEstimate)}
                          />
                        </div>
                        <div className="pk-field">
                          <label>Repuestos e Insumos Estimados (COP)</label>
                          <input
                            type="number"
                            min="0"
                            step="5000"
                            value={partsEstimate}
                            onChange={(e) => syncCorrectiveTotals(laborEstimate, e.target.value)}
                          />
                        </div>
                        <div className="pk-field pk-col-span-full">
                          <label>Falla Reportada y Trabajos Correctivos Solicitados *</label>
                          <textarea
                            required
                            value={serviceDesc}
                            onChange={(e) => setServiceDesc(e.target.value)}
                            placeholder="Ej: Cambio de pastillas delanteras cerámicas, rectificación de discos y purga de líquido DOT-4"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {orderIntakeType === 'peritaje' && (
                  <div className="pk-card">
                    <div className="pk-card-head">
                      <div className="pk-card-title">3. Protocolo de Escáner Electrónico y Peritaje</div>
                    </div>
                    <div className="pk-card-body">
                      <div className="pk-form-grid cols-2">
                        <PkSimpleSelect
                          label="Alcance de Diagnóstico"
                          value={diagnosticScope}
                          onChange={(val) => {
                            setDiagnosticScope(val);
                            if (!serviceDesc.trim()) setServiceDesc(val);
                          }}
                          options={DIAGNOSTIC_SCOPE_OPTIONS}
                        />
                        <div className="pk-field">
                          <label>Testigo Encendido / Síntoma en Ruta</label>
                          <input
                            value={reportedSymptom}
                            onChange={(e) => setReportedSymptom(e.target.value)}
                            placeholder="Ej: Check Engine activo y pérdida de potencia en frío"
                          />
                        </div>
                        <div className="pk-field pk-col-span-full">
                          <label>Puntos de Inspección y Observaciones de Recepción *</label>
                          <textarea
                            required
                            value={serviceDesc}
                            onChange={(e) => setServiceDesc(e.target.value)}
                            placeholder="Ej: Lectura completa de módulos OBD-II, medición de compresión y verificación estructural"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </PkFullscreenDialog>

            <PkModal
              open={Boolean(detailOrder)}
              title={detailOrder ? `Ficha Técnica de Orden #${detailOrder.id}` : 'Detalle de Orden'}
              onClose={() => setDetailOrder(null)}
              maxWidth={680}
            >
              {detailOrder && (
                <div className="pk-stack">
                  <PkProcessNodes steps={buildOrderProcessSteps(detailOrder)} />
                  <div className="pk-grid-2">
                    <div className="pk-card" style={{ padding: 14 }}>
                      <div style={{ fontSize: 11, color: 'var(--pk-muted)', fontWeight: 800 }}>VEHÍCULO Y PLACA</div>
                      <div style={{ fontSize: 16, fontWeight: 900, marginTop: 4 }}>
                        {detailOrder.plate} — {detailOrder.vehicleBrand}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4 }}>
                        Ingreso: {detailOrder.currentKm.toLocaleString('es-CO')} km · Próx. aceite: {detailOrder.nextOilKm.toLocaleString('es-CO')} km
                      </div>
                    </div>
                    <div className="pk-card" style={{ padding: 14 }}>
                      <div style={{ fontSize: 11, color: 'var(--pk-muted)', fontWeight: 800 }}>CLIENTE Y ESPECIALISTA</div>
                      <div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{detailOrder.customerName}</div>
                      <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4 }}>
                        Técnico: {detailOrder.workerName || 'Taller General'} · {detailOrder.createdAt}
                      </div>
                    </div>
                  </div>
                  <div className="pk-card" style={{ padding: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--pk-muted)', fontWeight: 800 }}>TRABAJOS Y DIAGNÓSTICO</div>
                    <div style={{ fontSize: 13.5, marginTop: 6 }}>{detailOrder.serviceDesc}</div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--pk-emerald)', marginTop: 10 }}>
                      Total Estimado: {formatCop(detailOrder.totalEstimated)}
                    </div>
                  </div>
                  <div className="pk-row-actions" style={{ justifyContent: 'flex-end' }}>
                    <PkPrintButton label="🖨️ Imprimir Orden" payload={buildOrderPrintPayload(detailOrder)} />
                    {detailOrder.status !== 'Entregado' && (
                      <button
                        type="button"
                        className="pk-btn pk-btn-emerald"
                        onClick={() => {
                          const target = detailOrder;
                          setDetailOrder(null);
                          handleSendOrderToPos(target);
                        }}
                      >
                        💵 Facturar en POS
                      </button>
                    )}
                  </div>
                </div>
              )}
            </PkModal>
          </div>
        </ModuleGate>
      )}

      {currentTab === 'hoja_vida_vehiculos' && (
        <ModuleGate module="hoja_vida_vehiculos">
          <div className="pk-stack">
            <PkKpiRow
              items={[
                { label: 'Vehículos Registrados', value: String(vehicles.length), color: 'var(--pk-primary)' },
                { label: 'Alertas SOAT / Aceite', value: String(alertVehiclesCount), color: 'var(--pk-amber)' },
                { label: 'Flota al Día', value: String(Math.max(0, vehicles.length - alertVehiclesCount)), color: 'var(--pk-emerald)' },
                { label: 'Próximo Código', value: nextVehicleCode },
              ]}
            />

            <PkLiveHeader
              title="Hoja de Vida y Flota Vehicular"
              liveLabel="Control técnico"
              subtitle="Supervisa vigencias de SOAT, alertas tempranas de lubricación por kilometraje e historial de órdenes por placa."
              displayMode={vehiclesDisplayMode}
              onDisplayModeChange={setVehiclesDisplayMode}
              boardLabel="🎛️ Tarjetas de Flota"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Registrar Vehículo"
              onPrimaryAction={() => setVehicleStudioOpen(true)}
              pills={[
                { key: 'ALL', label: 'Toda la Flota', count: vehicles.length },
                { key: 'ALERT', label: 'Alertas SOAT / Aceite', count: alertVehiclesCount },
                { key: 'OK', label: 'Documentación y Aceite al Día', count: Math.max(0, vehicles.length - alertVehiclesCount) },
              ]}
              activePill={vehicleAlertPill}
              onPillChange={setVehicleAlertPill}
              extraActions={
                <button
                  type="button"
                  className="pk-btn pk-btn-outline"
                  onClick={handleExportVehiclesCsv}
                >
                  📥 Exportar Flota CSV
                </button>
              }
            />

            <div className="pk-card" style={{ padding: '12px 18px' }}>
              <input
                className="pk-input pk-datatable-search"
                style={{ width: '100%' }}
                placeholder="🔎 Buscar en hoja de vida por placa, marca, clase de vehículo o propietario..."
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
              />
            </div>

            {vehiclesDisplayMode === 'board' ? (
              <div className="pk-cards-showcase">
                {filteredVehicles.map((v) => {
                  const orderCount = orders.filter((o) => o.vehicleId === v.id || o.plate === v.plate).length;
                  const soatInfo = evaluateSoatStatus(v.soatExpiry);
                  const kmRemaining = Math.max(0, (v.nextOilKm || v.currentKm + 5000) - v.currentKm);
                  const oilLifePct = Math.min(100, Math.round((kmRemaining / 5000) * 100));
                  const oilTone = oilLifePct <= 20 ? 'rose' : oilLifePct <= 45 ? 'amber' : 'emerald';

                  return (
                    <PkTicketCard
                      key={v.id}
                      code={v.plate}
                      timeAgo={`${orderCount} orden(es) en historial`}
                      channelBadge={{ label: v.vehicleType, tone: 'blue' }}
                      title={v.brand}
                      subtitle={`👤 Titular: ${v.customerName}`}
                      items={[
                        { name: 'Odómetro registrado', amount: `${v.currentKm.toLocaleString('es-CO')} km` },
                        { name: 'Próximo cambio aceite', amount: `${v.nextOilKm.toLocaleString('es-CO')} km` },
                      ]}
                      extraBody={
                        <PkProgressBar
                          label="Vida útil estimada de aceite"
                          valueLabel={`${kmRemaining.toLocaleString('es-CO')} km restantes`}
                          pct={oilLifePct}
                          tone={oilTone}
                        />
                      }
                      statusPill={{ label: soatInfo.label, tone: soatInfo.tone }}
                      primaryAction={
                        hasModule('tablero_ordenes')
                          ? {
                              label: '🔧 Crear Orden a esta Placa',
                              tone: 'navy',
                              onClick: () => openOrderStudioForVehicle(v),
                            }
                          : undefined
                      }
                      secondaryActions={
                        <button
                          type="button"
                          className="pk-btn pk-btn-danger pk-btn-sm"
                          disabled={busy}
                          onClick={() => setVehicleToDelete(v)}
                        >
                          🗑️ Eliminar Placa
                        </button>
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📖 Historial Técnico por Placa</div>
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
                          <th>Vigencia SOAT</th>
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
                            const soatInfo = evaluateSoatStatus(v.soatExpiry);
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
                                <td>
                                  <span className={`pk-badge pk-badge-${soatInfo.tone}`}>{soatInfo.label}</span>
                                </td>
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

            <PkFullscreenDialog
              open={vehicleStudioOpen}
              title="Estudio de Vinculación de Flota y Hoja de Vida Vehicular"
              subtitle="Registra la ficha técnica del vehículo, su titular y alertas preventivas de SOAT y lubricación."
              badge={{ label: nextVehicleCode, tone: 'emerald' }}
              onClose={() => setVehicleStudioOpen(false)}
              subheader={
                <PkTypeCards
                  label="1. Clasificación del Vehículo"
                  options={VEHICLE_TYPE_CARDS}
                  value={vehType}
                  onChange={setVehType}
                  disabled={busy}
                />
              }
              footerLeft={
                <span className="pk-badge pk-badge-amber">
                  🛢️ Próximo cambio de aceite calculado automáticamente a +5.000 km
                </span>
              }
              footerActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setVehicleStudioOpen(false)}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    form="taller-vehicle-studio-form"
                    className="pk-btn pk-btn-primary"
                    disabled={busy}
                  >
                    {busy ? 'Guardando...' : '💾 Guardar Hoja de Vida Vehicular'}
                  </button>
                </>
              }
            >
              <form id="taller-vehicle-studio-form" onSubmit={submitCreateVehicle('studio')} className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">2. Datos Técnicos de Placa, Odómetro y Vigencia Legal</div>
                </div>
                <div className="pk-card-body">
                  <div className="pk-form-grid cols-2">
                    <PkAutoCodeInput label="Código Vehículo" value={nextVehicleCode} />

                    <div className="pk-field">
                      <label>Placa del Vehículo *</label>
                      <input
                        required
                        value={vehPlate}
                        onChange={(e) => setVehPlate(e.target.value.toUpperCase())}
                        placeholder="Ej: JTR920"
                      />
                    </div>

                    <div className="pk-field">
                      <label>Marca, Línea y Cilindraje *</label>
                      <input
                        required
                        value={vehBrand}
                        onChange={(e) => setVehBrand(e.target.value)}
                        placeholder="Ej: Chevrolet Tracker Turbo 1.2"
                      />
                    </div>

                    {customers.length > 0 && (
                      <PkSelect
                        label="Vincular desde Directorio Clientes (Opcional)"
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
                      <label>Nombre Titular / Propietario</label>
                      <input
                        value={vehCustomerName}
                        onChange={(e) => setVehCustomerName(e.target.value)}
                        placeholder="Nombre completo o razón social"
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
                      <label>Fecha Vencimiento SOAT</label>
                      <input
                        type="date"
                        value={vehSoat}
                        onChange={(e) => setVehSoat(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </form>
            </PkFullscreenDialog>

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

            <PkLiveHeader
              title="Especialistas y Liquidación de Comisiones"
              liveLabel="Nómina técnica"
              subtitle="Monitorea el rendimiento de mano de obra facturada por cada especialista y liquida turnos con comprobante."
              primaryActionLabel="+ Vincular Técnico"
              onPrimaryAction={() => setWorkerStudioOpen(true)}
            />

            <div className="pk-cards-showcase">
              {workers.map((wk) => {
                const estPayout = (wk.totalDayGross * wk.commissionPct) / 100;
                const assignedOrdersCount = activeOrders.filter((o) => o.workerId === wk.id).length;
                const meterPct = Math.min(100, Math.round(((wk.totalDayGross || 0) / maxWorkerGross) * 100));

                return (
                  <PkTicketCard
                    key={wk.id}
                    code={wk.code}
                    timeAgo={`${assignedOrdersCount} orden(es) en bahía`}
                    channelBadge={{ label: `${wk.commissionPct}% Comisión`, tone: 'purple' }}
                    title={wk.name}
                    subtitle={wk.specialty}
                    metaLine={wk.phone ? `📞 ${wk.phone}${wk.docNumber ? ` · CC ${wk.docNumber}` : ''}` : undefined}
                    items={[
                      { name: 'Base mano de obra turno', amount: formatCop(wk.totalDayGross) },
                      { name: 'Participación taller', amount: formatCop(Math.max(0, wk.totalDayGross - estPayout)) },
                    ]}
                    extraBody={
                      <PkProgressBar
                        label="Productividad acumulada en turno"
                        valueLabel={formatCop(wk.totalDayGross)}
                        pct={meterPct}
                        tone={wk.totalDayGross > 0 ? 'emerald' : 'blue'}
                      />
                    }
                    totalLabel="NETO A LIQUIDAR TÉCNICO"
                    totalValue={formatCop(estPayout)}
                    primaryAction={{
                      label: '💸 Liquidar Comisión del Turno',
                      tone: 'emerald',
                      disabled: busy || wk.totalDayGross <= 0,
                      onClick: () => setWorkerToSettle(wk),
                    }}
                  />
                );
              })}
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
                      {settlements.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 24 }}>
                            Aún no se han emitido comprobantes de liquidación en este periodo.
                          </td>
                        </tr>
                      ) : (
                        settlements.map((st) => (
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
                              <PkPrintButton label="🖨️ Recibo" payload={buildSettlementPrintPayload(st)} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <PkFullscreenDialog
              open={workerStudioOpen}
              title="Estudio de Vinculación de Especialista Automotriz"
              subtitle="Configura el perfil técnico y el esquema porcentual de participación sobre mano de obra facturada."
              badge={{ label: nextWorkerCode, tone: 'blue' }}
              onClose={() => setWorkerStudioOpen(false)}
              footerActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setWorkerStudioOpen(false)}
                    disabled={busy}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    form="taller-worker-studio-form"
                    className="pk-btn pk-btn-primary"
                    disabled={busy}
                  >
                    {busy ? 'Guardando...' : '💾 Vincular Especialista'}
                  </button>
                </>
              }
            >
              <form id="taller-worker-studio-form" onSubmit={handleCreateWorker} className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">Datos del Técnico y Esquema de Comisión</div>
                </div>
                <div className="pk-card-body">
                  <div className="pk-form-grid cols-2">
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
                      <label>Documento de Identidad</label>
                      <input
                        value={wkDoc}
                        onChange={(e) => setWkDoc(e.target.value)}
                        placeholder="Número de identificación"
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
                  </div>
                </div>
              </form>
            </PkFullscreenDialog>

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
  );
};

export default TallerView;
