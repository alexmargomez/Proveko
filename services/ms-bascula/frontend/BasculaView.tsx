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
  PkProcessNodes,
  PkTypeCards,
  PkFullscreenDialog,
  PkProgressBar,
  PkDistributionStrip,
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

const AXLE_STUDIO_CARDS = [
  {
    key: 'c2_rigido',
    icon: '🚚',
    title: 'Camión Rígido 2 Ejes',
    description: 'Configuración C2 para carga urbana y regional · Capacidad máx. 17.000 kg.',
    badge: 'C2 · 17t',
  },
  {
    key: 'c3_dobletroque',
    icon: '🚛',
    title: 'Doble Troque 3 Ejes',
    description: 'Volqueta pesada o camión rígido tándem C3 · Capacidad máx. 28.000 kg.',
    badge: 'C3 · 28t',
  },
  {
    key: 'c3s_tractomula',
    icon: '🚜',
    title: 'Tractomula 3S2 / 3S3',
    description: 'Tractocamión articulado de 5 y 6 ejes para granel pesado · Máx. 52.000 kg.',
    badge: '3S2/3S3 · 52t',
  },
];

const FLEET_STUDIO_CARDS = [
  {
    key: 'vehicle',
    icon: '🚛',
    title: 'Tractocamión / Vehículo Pesado',
    description: 'Vincula placa, marca, configuración de ejes y tara certificada de referencia.',
    badge: 'Flota',
  },
  {
    key: 'driver',
    icon: '🪪',
    title: 'Conductor de Carga Pesada',
    description: 'Registra operador con documento de identidad, categoría de licencia y contacto.',
    badge: 'Operador',
  },
  {
    key: 'carrier',
    icon: '🏢',
    title: 'Empresa Transportadora Aliada',
    description: 'Habilita razón social, NIT tributario y sede logística para manifiestos.',
    badge: 'NIT',
  },
];

const LICENSE_OPTIONS = [
  { value: 'C3', label: 'C3 — Articulados Pesados' },
  { value: 'C2', label: 'C2 — Camiones Rígidos' },
  { value: 'C1', label: 'C1 — Servicio Público Liviano' },
];

const ROUTE_COLORS = ['#0284c7', '#10b981', '#8b5cf6', '#f59e0b', '#e11d48', '#0f172a'];

function classifyAxleGroup(axleConfig: string | undefined): 'c2_rigido' | 'c3_dobletroque' | 'c3s_tractomula' {
  const norm = (axleConfig || '').toUpperCase();
  if (norm.includes('C2')) return 'c2_rigido';
  if (norm.includes('C3S')) return 'c3s_tractomula';
  if (norm.includes('C3')) return 'c3_dobletroque';
  return 'c3s_tractomula';
}

function shortAxleBadge(axleConfig: string | undefined): string {
  const group = classifyAxleGroup(axleConfig);
  if (group === 'c2_rigido') return '2 Ejes C2';
  if (group === 'c3_dobletroque') return '3 Ejes C3';
  return 'Tractomula 3S2/3S3';
}

export const BasculaView: React.FC = () => {
  const { activeModuleKey, hasModule, hasFeature, apiGet, apiPost, toast } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [ticketDisplayMode, setTicketDisplayMode] = useState<'board' | 'table'>('board');
  const [ticketPill, setTicketPill] = useState<string>('all');
  const [weighStudioOpen, setWeighStudioOpen] = useState(false);
  const [studioAxleType, setStudioAxleType] = useState<string>('c3s_tractomula');
  const [humidityPct, setHumidityPct] = useState('0.8');
  const [monitoredTicketId, setMonitoredTicketId] = useState<string>('');

  const [ticketSearch, setTicketSearch] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');

  const [fleetDisplayMode, setFleetDisplayMode] = useState<'board' | 'table'>('board');
  const [fleetPill, setFleetPill] = useState<string>('all');
  const [fleetStudioOpen, setFleetStudioOpen] = useState(false);
  const [fleetStudioEntity, setFleetStudioEntity] = useState<string>('vehicle');
  const [fleetSearch, setFleetSearch] = useState('');

  const [routeDisplayMode, setRouteDisplayMode] = useState<'board' | 'table'>('board');
  const [routeStudioOpen, setRouteStudioOpen] = useState(false);
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
      const tList = data.tickets || [];

      setNextTicketCode(data.nextTicketCode || 'BAS-1006');
      setNextVehicleCode(data.nextVehicleCode || 'CAM-303');
      setNextDriverCode(data.nextDriverCode || 'COND-203');
      setNextCarrierCode(data.nextCarrierCode || 'TRN-403');
      setNextRouteCode(data.nextRouteCode || 'CAR-106');

      setTickets(tList);
      setVehicles(vList);
      setDrivers(dList);
      setCarriers(cList);
      setRoutes(rList);

      if (tList.length > 0) {
        setMonitoredTicketId((prev) => (prev && tList.some((t) => t.id === prev) ? prev : tList[0].id));
      }

      setVehicleId((prev) => {
        if (prev && vList.some((v) => v.id === prev)) return prev;
        if (vList.length > 0) {
          setTareKg(String(vList[0].referenceTareKg || 16200));
          setStudioAxleType(classifyAxleGroup(vList[0].axleConfig));
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

  const vehicleMap = useMemo(() => {
    const map = new Map<string, HeavyVehicle>();
    for (const v of vehicles) {
      map.set(v.id, v);
      map.set(v.plate, v);
    }
    return map;
  }, [vehicles]);

  const grossNumeric = Number(grossKg || 0);
  const tareNumeric = Number(tareKg || 0);
  const liveNetKg = grossNumeric > tareNumeric && tareNumeric > 0 ? grossNumeric - tareNumeric : 0;
  const liveNetTons = (liveNetKg / 1000).toFixed(2);
  const maxLegalGrossKg =
    studioAxleType === 'c2_rigido' ? 17000 : studioAxleType === 'c3_dobletroque' ? 28000 : 52000;
  const grossCapacityPct = maxLegalGrossKg > 0 ? (grossNumeric / maxLegalGrossKg) * 100 : 0;

  const totalNetDispatchedKg = tickets.reduce((acc, t) => acc + (t.netKg || 0), 0);
  const totalTons = (totalNetDispatchedKg / 1000).toFixed(2);
  const dualSignatureEnabled = hasFeature('pesaje_camionero', 'tiquete_doble_firma');

  const activeLedTicket = useMemo(() => {
    if (tickets.length === 0) return null;
    return tickets.find((t) => t.id === monitoredTicketId) || tickets[0];
  }, [tickets, monitoredTicketId]);

  const ledGross = activeLedTicket ? activeLedTicket.grossKg : grossNumeric;
  const ledTare = activeLedTicket ? activeLedTicket.tareKg : tareNumeric;
  const ledNet = activeLedTicket ? activeLedTicket.netKg : liveNetKg;

  const handleSelectStudioAxle = (axleKey: string) => {
    setStudioAxleType(axleKey);
    const matching = vehicles.find((v) => classifyAxleGroup(v.axleConfig) === axleKey);
    if (matching) {
      setVehicleId(matching.id);
      if (matching.referenceTareKg > 0) {
        setTareKg(String(matching.referenceTareKg));
      }
      if (axleKey === 'c2_rigido') setGrossKg('15400');
      else if (axleKey === 'c3_dobletroque') setGrossKg('26400');
      else setGrossKg('48500');
    } else {
      if (axleKey === 'c2_rigido') {
        setVehAxle('C2 Camión Sencillo');
        setTareKg('6500');
        setGrossKg('15400');
      } else if (axleKey === 'c3_dobletroque') {
        setVehAxle('C3 Volqueta Dobletroque');
        setTareKg('11200');
        setGrossKg('26400');
      } else {
        setVehAxle('C3S3 Tractocamión 6 Ejes');
        setTareKg('16200');
        setGrossKg('48500');
      }
    }
  };

  const handleSelectVehicle = (id: string) => {
    setVehicleId(id);
    const found = vehicles.find((v) => v.id === id);
    if (found) {
      setStudioAxleType(classifyAxleGroup(found.axleConfig));
      if (found.referenceTareKg > 0) {
        setTareKg(String(found.referenceTareKg));
      }
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
        setMonitoredTicketId(res.ticket.id);
        await reload();
        setWeighStudioOpen(false);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible emitir el tiquete de báscula');
      }
    });
  };

  const submitCreateVehicle = (originMode: 'modal' | 'studio') => (e: React.FormEvent) => {
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
          setFleetStudioOpen(false);
        }
        await reload();
        setVehicleId(res.vehicle.id);
        setTareKg(String(res.vehicle.referenceTareKg));
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al registrar el tractocamión');
      }
    });
  };

  const submitCreateDriver = (originMode: 'modal' | 'studio') => (e: React.FormEvent) => {
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
          setFleetStudioOpen(false);
        }
        await reload();
        setDriverId(res.driver.id);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al registrar el conductor');
      }
    });
  };

  const submitCreateCarrier = (originMode: 'modal' | 'studio') => (e: React.FormEvent) => {
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
          setFleetStudioOpen(false);
        }
        await reload();
        setCarrierId(res.carrier.id);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al registrar la transportadora');
      }
    });
  };

  const submitCreateRoute = (originMode: 'modal' | 'studio') => (e: React.FormEvent) => {
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
          setRouteStudioOpen(false);
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

  const ticketPills = useMemo(() => {
    const countByAxle = (key: 'c2_rigido' | 'c3_dobletroque' | 'c3s_tractomula') =>
      tickets.filter((tk) => {
        const veh = vehicleMap.get(tk.vehicleId) || vehicleMap.get(tk.plate);
        return classifyAxleGroup(veh?.axleConfig) === key;
      }).length;

    const basePills = [
      { key: 'all', label: 'Todos los Pesajes', count: tickets.length },
      { key: 'axle:c3s_tractomula', label: '🚜 Tractomula 3S2 / 3S3', count: countByAxle('c3s_tractomula') },
      { key: 'axle:c3_dobletroque', label: '🚛 Doble Troque 3 Ejes', count: countByAxle('c3_dobletroque') },
      { key: 'axle:c2_rigido', label: '🚚 Rígido 2 Ejes', count: countByAxle('c2_rigido') },
    ];

    const routePills = routes.slice(0, 3).map((r) => ({
      key: `route:${r.id}`,
      label: `📦 ${r.description}`,
      count: tickets.filter((t) => t.cargoId === r.id).length,
    }));

    return [...basePills, ...routePills];
  }, [tickets, routes, vehicleMap]);

  const filteredTickets = tickets.filter((tk) => {
    if (carrierFilter && tk.carrierId !== carrierFilter) return false;
    if (ticketPill.startsWith('axle:')) {
      const targetAxle = ticketPill.slice(5);
      const veh = vehicleMap.get(tk.vehicleId) || vehicleMap.get(tk.plate);
      if (classifyAxleGroup(veh?.axleConfig) !== targetAxle) return false;
    } else if (ticketPill.startsWith('route:')) {
      const targetRoute = ticketPill.slice(6);
      if (tk.cargoId !== targetRoute) return false;
    }
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

  const studioOrderedVehicles = useMemo(() => {
    const matching = vehicles.filter((v) => classifyAxleGroup(v.axleConfig) === studioAxleType);
    const others = vehicles.filter((v) => classifyAxleGroup(v.axleConfig) !== studioAxleType);
    return [...matching, ...others];
  }, [vehicles, studioAxleType]);

  return (
    <div className="pk-stack">
      {currentTab === 'pesaje_camionero' && (
        <ModuleGate module="pesaje_camionero">
          <div className="pk-stack">
            <PkLiveHeader
              title="Terminal Industrial de Pesaje Camionero"
              liveLabel="Báscula en línea"
              subtitle="Monitoreo digital de celdas de carga, destare certificado por configuración de ejes y emisión oficial de tiquetes."
              pills={ticketPills}
              activePill={ticketPill}
              onPillChange={setTicketPill}
              displayMode={ticketDisplayMode}
              onDisplayModeChange={setTicketDisplayMode}
              boardLabel="🎛️ Cabina de Pesaje"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Registrar Pesaje"
              onPrimaryAction={() => setWeighStudioOpen(true)}
              extraActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setShowVehicleModal(true)}
                  >
                    + Camión
                  </button>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => setShowDriverModal(true)}
                  >
                    + Conductor
                  </button>
                  <button type="button" className="pk-btn pk-btn-outline" onClick={handleExportTicketsCsv}>
                    📥 CSV
                  </button>
                </>
              }
            />

            <div
              style={{
                background: 'linear-gradient(145deg, #090d16 0%, #0f172a 65%, #111827 100%)',
                border: '1.5px solid #1e293b',
                borderRadius: 18,
                padding: '20px 24px',
                color: '#f8fafc',
                boxShadow: '0 14px 32px rgba(2, 6, 23, 0.35), inset 0 1px 0 rgba(255,255,255,0.07)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
                  paddingBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '4px 11px',
                      borderRadius: 999,
                      background: 'rgba(16, 185, 129, 0.14)',
                      border: '1px solid rgba(52, 211, 153, 0.4)',
                      color: '#34d399',
                      fontSize: 11.5,
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: '#10b981',
                        boxShadow: '0 0 10px #10b981',
                      }}
                    />
                    PLATAFORMA ESTABLE · CELDAS DIGITALES ZERO-DRIFT
                  </span>
                  <span style={{ fontSize: 12.5, color: '#94a3b8', fontWeight: 600 }}>
                    {activeLedTicket
                      ? `Lectura Tiquete #TIQ-${activeLedTicket.id} · Placa ${activeLedTicket.plate} · ${activeLedTicket.cargoDesc}`
                      : `Próximo consecutivo en cabina: ${nextTicketCode}`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {dualSignatureEnabled && (
                    <span className="pk-badge pk-badge-emerald">✍️ Doble Firma Activa</span>
                  )}
                  <button
                    type="button"
                    className="pk-btn pk-btn-emerald pk-btn-sm"
                    onClick={() => setWeighStudioOpen(true)}
                  >
                    ⚖️ Capturar Nuevo Destare
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    background: '#05080f',
                    border: '1px solid #1e293b',
                    borderRadius: 12,
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em' }}>
                    PESO BRUTO ENTRADA
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 29,
                      fontWeight: 900,
                      color: '#38bdf8',
                      textShadow: '0 0 16px rgba(56, 189, 248, 0.35)',
                      fontVariantNumeric: 'tabular-nums',
                      marginTop: 6,
                    }}
                  >
                    {ledGross.toLocaleString('es-CO')} <span style={{ fontSize: 14, color: '#7dd3fc' }}>KG</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                    Equivalente: {(ledGross / 1000).toFixed(2)} toneladas brutas
                  </div>
                </div>

                <div
                  style={{
                    background: '#05080f',
                    border: '1px solid #1e293b',
                    borderRadius: 12,
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em' }}>
                    PESO TARA VEHICULAR
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 29,
                      fontWeight: 900,
                      color: '#fbbf24',
                      textShadow: '0 0 16px rgba(251, 191, 36, 0.3)',
                      fontVariantNumeric: 'tabular-nums',
                      marginTop: 6,
                    }}
                  >
                    {ledTare.toLocaleString('es-CO')} <span style={{ fontSize: 14, color: '#fcd34d' }}>KG</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                    Equivalente: {(ledTare / 1000).toFixed(2)} toneladas vacío
                  </div>
                </div>

                <div
                  style={{
                    background: 'linear-gradient(180deg, #04130e 0%, #05080f 100%)',
                    border: '1.5px solid rgba(16, 185, 129, 0.5)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    boxShadow: 'inset 0 0 24px rgba(16, 185, 129, 0.08)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#6ee7b7', letterSpacing: '0.08em' }}>
                    PESO NETO CERTIFICADO
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 31,
                      fontWeight: 900,
                      color: '#34d399',
                      textShadow: '0 0 20px rgba(52, 211, 153, 0.5)',
                      fontVariantNumeric: 'tabular-nums',
                      marginTop: 6,
                    }}
                  >
                    {ledNet.toLocaleString('es-CO')} <span style={{ fontSize: 14, color: '#6ee7b7' }}>KG</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#a7f3d0', fontWeight: 700, marginTop: 4 }}>
                    {(ledNet / 1000).toFixed(3)} Toneladas Métricas Netas
                  </div>
                </div>

                <div
                  style={{
                    background: '#05080f',
                    border: '1px solid #1e293b',
                    borderRadius: 12,
                    padding: '14px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em' }}>
                    ACUMULADO TURNO / PLANTA
                  </div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 24,
                      fontWeight: 900,
                      color: '#f8fafc',
                      marginTop: 6,
                    }}
                  >
                    {totalTons} <span style={{ fontSize: 13, color: '#94a3b8' }}>TON</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>
                    {tickets.length} tiquetes · {totalNetDispatchedKg.toLocaleString('es-CO')} kg totales
                  </div>
                </div>
              </div>
            </div>

            <PkKpiRow
              items={[
                { label: 'Tiquetes Certificados', value: String(tickets.length), color: 'var(--pk-primary)' },
                {
                  label: 'Peso Neto Acumulado',
                  value: `${totalNetDispatchedKg.toLocaleString('es-CO')} kg`,
                  color: 'var(--pk-emerald)',
                },
                { label: 'Toneladas Despachadas', value: `${totalTons} Ton`, color: '#0f172a' },
                {
                  label: 'Flota Habilitada',
                  value: `${vehicles.length} camiones · ${drivers.length} cond.`,
                  color: 'var(--pk-amber)',
                },
              ]}
            />

            <div className="pk-card">
              <div className="pk-datatable-toolbar" style={{ borderBottom: 'none' }}>
                <input
                  className="pk-input pk-datatable-search"
                  placeholder="🔎 Filtrar tiquetes por #TIQ, placa, conductor, transportadora o carga..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 'min(100%, 260px)' }}>
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
            </div>

            {ticketDisplayMode === 'board' ? (
              filteredTickets.length === 0 ? (
                <div className="pk-card">
                  <div className="pk-card-body" style={{ textAlign: 'center', padding: 42, color: 'var(--pk-muted)' }}>
                    {tickets.length === 0
                      ? 'No hay pesajes registrados todavía. Usa "+ Registrar Pesaje" para abrir la cabina industrial.'
                      : 'No se encontraron tiquetes de pesaje con los filtros aplicados.'}
                  </div>
                </div>
              ) : (
                <div className="pk-cards-showcase">
                  {filteredTickets.map((tk) => {
                    const veh = vehicleMap.get(tk.vehicleId) || vehicleMap.get(tk.plate);
                    const axleLabel = shortAxleBadge(veh?.axleConfig);
                    const axleGroup = classifyAxleGroup(veh?.axleConfig);
                    const badgeTone =
                      axleGroup === 'c3s_tractomula'
                        ? 'purple'
                        : axleGroup === 'c3_dobletroque'
                        ? 'blue'
                        : 'amber';
                    const isMonitored = activeLedTicket?.id === tk.id;
                    return (
                      <PkTicketCard
                        key={tk.id}
                        code={`#TIQ-${tk.id}`}
                        timeAgo={tk.date}
                        channelBadge={{
                          label: `🚛 ${tk.plate} · ${axleLabel}`,
                          tone: badgeTone,
                        }}
                        title={tk.cargoDesc}
                        subtitle={`Conductor: ${tk.driverName}`}
                        metaLine={`🏢 ${tk.carrierName}`}
                        items={[
                          {
                            name: 'Peso Bruto Plataforma',
                            amount: `${tk.grossKg.toLocaleString('es-CO')} kg`,
                          },
                          {
                            name: 'Peso Tara Destarado',
                            amount: `-${tk.tareKg.toLocaleString('es-CO')} kg`,
                          },
                          {
                            name: 'Humedad / Merma Lab.',
                            amount: '0.0% · Estándar',
                          },
                        ]}
                        totalLabel="PESO NETO"
                        totalValue={`${tk.netKg.toLocaleString('es-CO')} KG (${(tk.netKg / 1000).toFixed(2)} t)`}
                        processNodes={[
                          { step: 1, label: '1. Entrada Bruto', status: 'done' },
                          { step: 2, label: '2. Destare', status: 'done' },
                          { step: 3, label: '3. Tiquete Oficial', status: 'done' },
                        ]}
                        statusPill={{
                          label: tk.status || 'Tiquete Oficial Certificado',
                          tone: 'emerald',
                        }}
                        secondaryActions={
                          <>
                            <button
                              type="button"
                              className={`pk-btn ${isMonitored ? 'pk-btn-emerald' : 'pk-btn-outline'} pk-btn-sm`}
                              onClick={() => setMonitoredTicketId(tk.id)}
                            >
                              {isMonitored ? '📟 En Visor LED' : '📟 Ver en LED'}
                            </button>
                            <PkPrintButton
                              label="🖨️ Imprimir Tiquete"
                              payload={buildTicketPrintPayload(tk)}
                              variant="primary"
                            />
                          </>
                        }
                      />
                    );
                  })}
                </div>
              )
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">🧾 Libro Oficial de Tiquetes de Báscula ({filteredTickets.length})</div>
                </div>
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Tiquete</th>
                          <th>Placa / Ejes / Conductor</th>
                          <th>Transportadora</th>
                          <th>Carga / Ruta</th>
                          <th className="pk-num">Bruto (kg)</th>
                          <th className="pk-num">Tara (kg)</th>
                          <th className="pk-num">Neto (kg)</th>
                          <th>Etapa</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTickets.length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              Sin tiquetes para el criterio seleccionado.
                            </td>
                          </tr>
                        ) : (
                          filteredTickets.map((tk) => {
                            const veh = vehicleMap.get(tk.vehicleId) || vehicleMap.get(tk.plate);
                            return (
                              <tr key={tk.id}>
                                <td>
                                  <div style={{ fontWeight: 800 }}>#TIQ-{tk.id}</div>
                                  <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{tk.date}</div>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 800 }}>
                                    {tk.plate}{' '}
                                    <span className="pk-badge pk-badge-blue">{shortAxleBadge(veh?.axleConfig)}</span>
                                  </div>
                                  <div style={{ fontSize: 11.5, color: '#475569' }}>{tk.driverName}</div>
                                </td>
                                <td>{tk.carrierName}</td>
                                <td>{tk.cargoDesc}</td>
                                <td className="pk-num">{tk.grossKg.toLocaleString('es-CO')}</td>
                                <td className="pk-num">{tk.tareKg.toLocaleString('es-CO')}</td>
                                <td className="pk-num" style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>
                                  {tk.netKg.toLocaleString('es-CO')} kg
                                </td>
                                <td>
                                  <PkProcessNodes
                                    compact
                                    steps={[
                                      { step: 1, label: 'Bruto', status: 'done' },
                                      { step: 2, label: 'Destare', status: 'done' },
                                      { step: 3, label: 'Oficial', status: 'done' },
                                    ]}
                                  />
                                </td>
                                <td>
                                  <PkPrintButton label="🖨️ Tiquete" payload={buildTicketPrintPayload(tk)} />
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
          </div>
        </ModuleGate>
      )}

      {currentTab === 'flota_conductores' && (
        <ModuleGate module="flota_conductores">
          <div className="pk-stack">
            <PkLiveHeader
              title="Centro Logístico de Flota, Conductores y Transportadoras"
              liveLabel="Directorio activo"
              subtitle="Control integral de tractocamiones con tara de referencia, operadores con licencia vigente y empresas de carga."
              pills={[
                { key: 'all', label: 'Visión 360° Flota', count: vehicles.length + drivers.length + carriers.length },
                { key: 'vehicles', label: '🚛 Tractocamiones', count: vehicles.length },
                { key: 'drivers', label: '🪪 Conductores', count: drivers.length },
                { key: 'carriers', label: '🏢 Transportadoras', count: carriers.length },
              ]}
              activePill={fleetPill}
              onPillChange={setFleetPill}
              displayMode={fleetDisplayMode}
              onDisplayModeChange={setFleetDisplayMode}
              boardLabel="🎛️ Tarjetas de Flota"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Vincular en Directorio"
              onPrimaryAction={() => {
                if (fleetPill === 'drivers') setFleetStudioEntity('driver');
                else if (fleetPill === 'carriers') setFleetStudioEntity('carrier');
                else setFleetStudioEntity('vehicle');
                setFleetStudioOpen(true);
              }}
            />

            <PkKpiRow
              items={[
                { label: 'Flota Pesada', value: String(vehicles.length), color: 'var(--pk-primary)' },
                { label: 'Conductores Activos', value: String(drivers.length), color: 'var(--pk-emerald)' },
                { label: 'Transportadoras', value: String(carriers.length), color: 'var(--pk-amber)' },
                { label: 'Próximo Código Flota', value: nextVehicleCode, color: '#0f172a' },
              ]}
            />

            <div className="pk-card">
              <div className="pk-datatable-toolbar" style={{ borderBottom: 'none' }}>
                <input
                  className="pk-input pk-datatable-search"
                  placeholder="🔎 Buscar por placa, marca, configuración de ejes, cédula o empresa transportadora..."
                  value={fleetSearch}
                  onChange={(e) => setFleetSearch(e.target.value)}
                />
                <div className="pk-row-actions">
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    onClick={() => {
                      setFleetStudioEntity('vehicle');
                      setFleetStudioOpen(true);
                    }}
                  >
                    + Tractocamión
                  </button>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    onClick={() => {
                      setFleetStudioEntity('driver');
                      setFleetStudioOpen(true);
                    }}
                  >
                    + Conductor
                  </button>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    onClick={() => {
                      setFleetStudioEntity('carrier');
                      setFleetStudioOpen(true);
                    }}
                  >
                    + Transportadora
                  </button>
                </div>
              </div>
            </div>

            {fleetDisplayMode === 'board' ? (
              <div className="pk-stack">
                {(fleetPill === 'all' || fleetPill === 'vehicles') && (
                  <div className="pk-stack">
                    <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--pk-navy)' }}>
                      🚛 Unidades Pesadas y Tractocamiones ({filteredVehicles.length})
                    </div>
                    <div className="pk-cards-showcase">
                      {filteredVehicles.map((v) => {
                        const trips = tickets.filter((t) => t.vehicleId === v.id || t.plate === v.plate);
                        const netSum = trips.reduce((a, b) => a + b.netKg, 0);
                        return (
                          <PkTicketCard
                            key={v.id}
                            code={v.plate}
                            timeAgo={`Código ${v.code}`}
                            channelBadge={{ label: shortAxleBadge(v.axleConfig), tone: 'blue' }}
                            title={v.brand}
                            subtitle={v.axleConfig}
                            items={[
                              {
                                name: 'Tara Oficial Referencia',
                                amount: `${v.referenceTareKg.toLocaleString('es-CO')} kg`,
                              },
                              { name: 'Pesajes Registrados', amount: `${trips.length} viajes` },
                              { name: 'Carga Neta Movilizada', amount: `${(netSum / 1000).toFixed(2)} t` },
                            ]}
                            statusPill={{ label: 'Habilitado para Báscula', tone: 'emerald' }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {(fleetPill === 'all' || fleetPill === 'drivers') && (
                  <div className="pk-stack">
                    <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--pk-navy)' }}>
                      🪪 Conductores Certificados ({filteredDrivers.length})
                    </div>
                    <div className="pk-cards-showcase">
                      {filteredDrivers.map((d) => (
                        <PkTicketCard
                          key={d.id}
                          code={d.code}
                          channelBadge={{ label: `Licencia ${d.licenseCategory}`, tone: 'emerald' }}
                          title={d.name}
                          subtitle={`Documento: ${d.docNumber}`}
                          metaLine={`📞 Contacto: ${d.phone || 'Sin teléfono registrado'}`}
                          statusPill={{ label: 'Conductor Activo', tone: 'blue' }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {(fleetPill === 'all' || fleetPill === 'carriers') && (
                  <div className="pk-stack">
                    <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--pk-navy)' }}>
                      🏢 Empresas Transportadoras ({filteredCarriers.length})
                    </div>
                    <div className="pk-cards-showcase">
                      {filteredCarriers.map((c) => (
                        <PkTicketCard
                          key={c.id}
                          code={c.code}
                          channelBadge={{ label: c.city || 'Nacional', tone: 'amber' }}
                          title={c.name}
                          subtitle={`NIT: ${c.nit}`}
                          metaLine={`📞 Central: ${c.phone || '—'}`}
                          statusPill={{ label: 'Transportadora Aliada', tone: 'slate' }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="pk-stack">
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
                              <th>Vehículo / Ejes</th>
                              <th className="pk-num">Tara Ref.</th>
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
                                <td className="pk-num">{v.referenceTareKg.toLocaleString('es-CO')} kg</td>
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
            <PkLiveHeader
              title="Corredores Logísticos, Materiales y Manifiestos"
              liveLabel="Despachos activos"
              subtitle="Trazabilidad volumétrica de carga a granel, orígenes, destinos portuarios y tonelaje neto movilizado."
              displayMode={routeDisplayMode}
              onDisplayModeChange={setRouteDisplayMode}
              boardLabel="🎛️ Tarjetas de Corredor"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Nueva Ruta / Carga"
              onPrimaryAction={() => setRouteStudioOpen(true)}
              extraActions={
                <button type="button" className="pk-btn pk-btn-outline" onClick={handleExportRoutesCsv}>
                  📥 Exportar Rutas CSV
                </button>
              }
            />

            {routes.length > 0 && (
              <PkDistributionStrip
                title="Participación de Tonelaje Neto por Corredor / Material"
                segments={routes.map((r, idx) => {
                  const sumKg = tickets
                    .filter((t) => t.cargoId === r.id)
                    .reduce((acc, t) => acc + t.netKg, 0);
                  return {
                    label: `${r.code} · ${r.description}`,
                    value: Math.max(sumKg, 1),
                    displayValue: `${(sumKg / 1000).toFixed(2)} t`,
                    color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
                  };
                })}
              />
            )}

            <div className="pk-card">
              <div className="pk-datatable-toolbar" style={{ borderBottom: 'none' }}>
                <input
                  className="pk-input pk-datatable-search"
                  placeholder="🔎 Buscar corredor por código, material, origen o destino..."
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                />
                <span className="pk-badge pk-badge-slate">{filteredRoutes.length} corredores</span>
              </div>
            </div>

            {routeDisplayMode === 'board' ? (
              <div className="pk-cards-showcase">
                {filteredRoutes.map((r) => {
                  const matched = tickets.filter((t) => t.cargoId === r.id);
                  const sumKg = matched.reduce((acc, t) => acc + t.netKg, 0);
                  const sharePct = totalNetDispatchedKg > 0 ? (sumKg / totalNetDispatchedKg) * 100 : 0;
                  return (
                    <PkTicketCard
                      key={r.id}
                      code={r.code}
                      channelBadge={{ label: `${matched.length} despachos`, tone: 'emerald' }}
                      title={r.description}
                      subtitle={`${r.origin || 'Planta Base'} ➔ ${r.destination || 'Destino Nacional'}`}
                      extraBody={
                        <PkProgressBar
                          label="Participación sobre carga total"
                          valueLabel={`${sharePct.toFixed(1)}%`}
                          pct={sharePct}
                          tone="emerald"
                        />
                      }
                      totalLabel="NETO MOVILIZADO"
                      totalValue={`${sumKg.toLocaleString('es-CO')} kg (${(sumKg / 1000).toFixed(2)} t)`}
                      statusPill={{ label: 'Corredor Habilitado', tone: 'blue' }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📦 Consolidado de Despachos por Ruta y Tipo de Carga</div>
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
                          <th className="pk-num">Despachos</th>
                          <th className="pk-num">Total Neto Despachado</th>
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
                              <td className="pk-num">{matched.length}</td>
                              <td className="pk-num" style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>
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

      <PkFullscreenDialog
        open={weighStudioOpen}
        title="Cabina Industrial de Pesaje y Destare Oficial"
        subtitle="Selecciona la configuración de ejes del vehículo, verifica la lectura LED de plataforma y emite el tiquete certificado."
        badge={{ label: nextTicketCode, tone: 'emerald' }}
        onClose={() => setWeighStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="1. Configuración Vehicular y Capacidad de Ejes en Plataforma"
            options={AXLE_STUDIO_CARDS}
            value={studioAxleType}
            onChange={handleSelectStudioAxle}
          />
        }
        footerLeft={
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span className={`pk-badge ${liveNetKg > 0 ? 'pk-badge-emerald' : 'pk-badge-rose'}`}>
              {liveNetKg > 0
                ? `NETO CERTIFICADO: ${liveNetKg.toLocaleString('es-CO')} KG (${liveNetTons} t)`
                : 'ALERTA: EL PESO BRUTO DEBE SUPERAR LA TARA'}
            </span>
            <span style={{ fontSize: 12.5, color: '#64748b' }}>
              Tope referencial configuración seleccionada: {maxLegalGrossKg.toLocaleString('es-CO')} kg
            </span>
          </div>
        }
        footerActions={
          <>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setWeighStudioOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pk-weigh-studio-form"
              className="pk-btn pk-btn-primary"
              disabled={busy || liveNetKg <= 0}
            >
              {busy ? 'Emitiendo Tiquete...' : '⚖️ Emitir Tiquete Oficial de Báscula'}
            </button>
          </>
        }
      >
        <div
          style={{
            background: '#090d16',
            border: '1.5px solid #1e293b',
            borderRadius: 16,
            padding: '18px 22px',
            color: '#f8fafc',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 18,
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.06em' }}>
              BRUTO EN PLATAFORMA
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 26,
                fontWeight: 900,
                color: '#38bdf8',
                marginTop: 4,
              }}
            >
              {grossNumeric.toLocaleString('es-CO')} KG
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.06em' }}>
              TARA VEHÍCULO VACÍO
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 26,
                fontWeight: 900,
                color: '#fbbf24',
                marginTop: 4,
              }}
            >
              -{tareNumeric.toLocaleString('es-CO')} KG
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#6ee7b7', letterSpacing: '0.06em' }}>
              PESO NETO DESTARADO
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 30,
                fontWeight: 900,
                color: liveNetKg > 0 ? '#34d399' : '#f87171',
                textShadow: '0 0 18px rgba(52, 211, 153, 0.45)',
                marginTop: 4,
              }}
            >
              {liveNetKg.toLocaleString('es-CO')} KG ({liveNetTons} t)
            </div>
          </div>
          <div style={{ background: '#ffffff', borderRadius: 12, padding: '10px 14px' }}>
            <PkProcessNodes
              compact
              steps={[
                { step: 1, label: '1. Entrada Bruto', status: grossNumeric > 0 ? 'done' : 'active' },
                { step: 2, label: '2. Destare', status: liveNetKg > 0 ? 'done' : 'active' },
                { step: 3, label: '3. Tiquete Oficial', status: liveNetKg > 0 ? 'active' : 'pending' },
              ]}
            />
          </div>
        </div>

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">2. Datos de Unidad, Operador, Manifiesto y Lecturas de Celda</div>
            <div style={{ width: 280 }}>
              <PkProgressBar
                label="Ocupación sobre capacidad eje"
                valueLabel={`${Math.min(100, Math.round(grossCapacityPct))}%`}
                pct={grossCapacityPct}
                tone={grossNumeric > maxLegalGrossKg ? 'rose' : 'emerald'}
              />
            </div>
          </div>
          <div className="pk-card-body">
            <form id="pk-weigh-studio-form" onSubmit={handleEmitScaleTicket} className="pk-form-grid">
              <PkAutoCodeInput label="N° Tiquete Báscula" value={nextTicketCode} />

              <PkSelect
                label="Placa Tractocamión *"
                items={studioOrderedVehicles}
                value={vehicleId}
                onChange={handleSelectVehicle}
                getValue={(v) => v.id}
                getLabel={(v) =>
                  `${v.plate} — ${v.brand} · ${shortAxleBadge(v.axleConfig)} (Tara: ${v.referenceTareKg.toLocaleString(
                    'es-CO'
                  )} kg)`
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
                <label>Humedad Referencial Muestra (%)</label>
                <input
                  type="number"
                  min="0"
                  max="45"
                  step="0.1"
                  value={humidityPct}
                  onChange={(e) => setHumidityPct(e.target.value)}
                />
              </div>

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

              <div className="pk-field">
                <label>Lecturas Rápidas de Plataforma</label>
                <div className="pk-row-actions">
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    onClick={() => setGrossKg('16200')}
                  >
                    16.2 t (C2)
                  </button>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    onClick={() => setGrossKg('27500')}
                  >
                    27.5 t (C3)
                  </button>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    onClick={() => setGrossKg('51200')}
                  >
                    51.2 t (3S3)
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </PkFullscreenDialog>

      <PkFullscreenDialog
        open={fleetStudioOpen}
        title="Estudio de Vinculación de Flota, Operadores y Transportadoras"
        subtitle="Selecciona el tipo de ficha logística que deseas habilitar para pesaje en báscula."
        badge={{ label: 'Directorio Logístico', tone: 'blue' }}
        onClose={() => setFleetStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="Tipo de Registro Logístico"
            options={FLEET_STUDIO_CARDS}
            value={fleetStudioEntity}
            onChange={setFleetStudioEntity}
          />
        }
      >
        {fleetStudioEntity === 'vehicle' && (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🚛 Ficha Técnica de Tractocamión / Unidad Pesada</div>
              <span className="pk-badge pk-badge-blue">{nextVehicleCode}</span>
            </div>
            <div className="pk-card-body">
              <form onSubmit={submitCreateVehicle('studio')} className="pk-form-grid cols-2">
                <PkAutoCodeInput label="Código Flota" value={nextVehicleCode} />
                <div className="pk-field">
                  <label>Placa Vehicular *</label>
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
                    onClick={() => setFleetStudioOpen(false)}
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
        )}

        {fleetStudioEntity === 'driver' && (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🪪 Ficha de Conductor de Carga Pesada</div>
              <span className="pk-badge pk-badge-emerald">{nextDriverCode}</span>
            </div>
            <div className="pk-card-body">
              <form onSubmit={submitCreateDriver('studio')} className="pk-form-grid cols-2">
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
                  <label>Cédula / Documento *</label>
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
                    onClick={() => setFleetStudioOpen(false)}
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
        )}

        {fleetStudioEntity === 'carrier' && (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🏢 Ficha Corporativa de Empresa Transportadora</div>
              <span className="pk-badge pk-badge-amber">{nextCarrierCode}</span>
            </div>
            <div className="pk-card-body">
              <form onSubmit={submitCreateCarrier('studio')} className="pk-form-grid cols-2">
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
                    onClick={() => setFleetStudioOpen(false)}
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
        )}
      </PkFullscreenDialog>

      <PkFullscreenDialog
        open={routeStudioOpen}
        title="Estudio de Corredores Logísticos y Materiales a Granel"
        subtitle="Configura nuevos materiales, productos industriales o rutas origen-destino para los tiquetes de pesaje."
        badge={{ label: nextRouteCode, tone: 'emerald' }}
        onClose={() => setRouteStudioOpen(false)}
      >
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">🛣️ Definir Corredor Logístico o Tipo de Carga</div>
          </div>
          <div className="pk-card-body">
            <form onSubmit={submitCreateRoute('studio')} className="pk-form-grid cols-2">
              <PkAutoCodeInput label="Código Carga / Ruta" value={nextRouteCode} />
              <div className="pk-field">
                <label>Descripción de Carga o Material *</label>
                <input
                  required
                  value={routeDesc}
                  onChange={(e) => setRouteDesc(e.target.value)}
                  placeholder="Ej: Carbón Térmico Granulado / Maíz Amarillo a Granel"
                />
              </div>
              <div className="pk-field">
                <label>Origen Logístico</label>
                <input
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Ej: Puerto Buenaventura"
                />
              </div>
              <div className="pk-field">
                <label>Destino Final</label>
                <input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Ej: Planta Industrial Sabana"
                />
              </div>
              <div className="pk-form-actions">
                <button
                  type="button"
                  className="pk-btn pk-btn-outline"
                  onClick={() => setRouteStudioOpen(false)}
                  disabled={busy}
                >
                  Cancelar
                </button>
                <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                  ➕ Guardar Ruta / Carga
                </button>
              </div>
            </form>
          </div>
        </div>
      </PkFullscreenDialog>

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
            <input required value={drvName} onChange={(e) => setDrvName(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Documento / Cédula *</label>
            <input required value={drvDoc} onChange={(e) => setDrvDoc(e.target.value)} />
          </div>
          <PkSimpleSelect
            label="Categoría Licencia"
            value={drvCat}
            onChange={setDrvCat}
            options={LICENSE_OPTIONS}
          />
          <div className="pk-field pk-col-span-full">
            <label>Teléfono</label>
            <input value={drvPhone} onChange={(e) => setDrvPhone(e.target.value)} />
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
            <input required value={carName} onChange={(e) => setCarName(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>NIT *</label>
            <input required value={carNit} onChange={(e) => setCarNit(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Ciudad</label>
            <input value={carCity} onChange={(e) => setCarCity(e.target.value)} />
          </div>
          <div className="pk-field pk-col-span-full">
            <label>Teléfono</label>
            <input value={carPhone} onChange={(e) => setCarPhone(e.target.value)} />
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
            <input required value={routeDesc} onChange={(e) => setRouteDesc(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Origen</label>
            <input value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Destino</label>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} />
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
