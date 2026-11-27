import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkAutoCodeInput,
  PkSelect,
  PkSimpleSelect,
  PkLiveHeader,
  PkTicketCard,
  PkTypeCards,
  PkFullscreenDialog,
  PkProgressBar,
  PkDistributionStrip,
  PkModal,
  PkConfirmModal,
  PkPrintButton,
  PkKpiRow,
  useAsyncAction,
  formatCop,
  downloadCsvUtf8,
} from '@platform/ui-sdk';

interface Supplier {
  id: string;
  code: string;
  nit: string;
  name: string;
  city: string;
  phone: string;
  email: string;
  createdAt: string;
}

interface PurchaseOrder {
  id: string;
  code: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  supplierNit: string;
  productId: string;
  productCode: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  inventorySynced: boolean;
  status: string;
  createdBy: string;
  createdAt: string;
}

interface InventoryProductItem {
  id: string;
  code: string;
  name: string;
  stock: number;
  costPrice: number;
  warehouseId?: string;
}

interface InventoryWarehouseItem {
  id: string;
  code: string;
  name: string;
  city?: string;
}

interface ComprasAllResponse {
  ok: boolean;
  nextSupplierCode: string;
  nextOrderCode: string;
  suppliers: Supplier[];
  orders: PurchaseOrder[];
}

interface InventarioAllResponse {
  ok?: boolean;
  products?: InventoryProductItem[];
  warehouses?: InventoryWarehouseItem[];
}

type OrderStudioType = 'ABASTECIMIENTO' | 'INSUMOS_GASTO' | 'CREDITO_CXP';
type SupplierStudioType = 'MAYORISTA' | 'IMPORTADOR' | 'INSUMOS';

const ORDER_STUDIO_OPTIONS = [
  {
    key: 'ABASTECIMIENTO',
    icon: '📥',
    title: 'Abastecimiento de Inventario',
    description: 'Compra de mercancía de contado con ingreso inmediato a bodega y recálculo de costo promedio.',
    badge: 'Contado + Kardex',
  },
  {
    key: 'INSUMOS_GASTO',
    icon: '🧾',
    title: 'Compra de Insumos / Gasto',
    description: 'Adquisición de suministros internos, materiales operativos o elementos de dotación.',
    badge: 'Operativo',
  },
  {
    key: 'CREDITO_CXP',
    icon: '🏦',
    title: 'Orden Corporativa a Crédito CxP',
    description: 'Orden de abastecimiento con plazo financiero pactado ante proveedor y obligación CxP.',
    badge: 'Crédito CxP',
  },
];

const SUPPLIER_STUDIO_OPTIONS = [
  {
    key: 'MAYORISTA',
    icon: '🏭',
    title: 'Proveedor Mayorista Nacional',
    description: 'Fabricante o distribuidor local homologado para suministro recurrente de inventario.',
    badge: 'Nacional',
  },
  {
    key: 'IMPORTADOR',
    icon: '🚢',
    title: 'Importador / Marca Especializada',
    description: 'Comercializador mayorista de líneas técnicas, repuestos originales o equipamiento.',
    badge: 'Especializado',
  },
  {
    key: 'INSUMOS',
    icon: '🛠️',
    title: 'Aliado de Insumos y Dotación',
    description: 'Proveedor de consumibles operativos, empaques, papelería o servicios conexos.',
    badge: 'Insumos',
  },
];

const CREDIT_TERM_OPTIONS = [
  { value: '15 días', label: 'Plazo Corporativo 15 días' },
  { value: '30 días', label: 'Plazo Corporativo 30 días' },
  { value: '45 días', label: 'Plazo Corporativo 45 días' },
  { value: '60 días', label: 'Plazo Corporativo 60 días' },
];

const isOrderCreditCxP = (ord: PurchaseOrder): boolean =>
  /cxp|cr[eé]dito|plazo|pendiente/i.test(`${ord.warehouseName || ''} ${ord.status || ''} ${ord.productName || ''}`);

export const ComprasView: React.FC = () => {
  const {
    activeModuleKey,
    hasService,
    hasModule,
    apiGet,
    apiPost,
    apiDelete,
    navigateTo,
    incomingPayload,
    clearIncomingPayload,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [orderDisplayMode, setOrderDisplayMode] = useState<'board' | 'table'>('board');
  const [orderPill, setOrderPill] = useState<string>('ALL');
  const [orderStudioOpen, setOrderStudioOpen] = useState(false);
  const [orderStudioType, setOrderStudioType] = useState<OrderStudioType>('ABASTECIMIENTO');
  const [creditTerm, setCreditTerm] = useState('30 días');
  const [costCenterNote, setCostCenterNote] = useState('Operación Principal');

  const [supplierDisplayMode, setSupplierDisplayMode] = useState<'board' | 'table'>('board');
  const [supplierPill, setSupplierPill] = useState<string>('ALL');
  const [supplierStudioOpen, setSupplierStudioOpen] = useState(false);
  const [supplierStudioType, setSupplierStudioType] = useState<SupplierStudioType>('MAYORISTA');

  const [supplierSearch, setSupplierSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderSupplierFilter, setOrderSupplierFilter] = useState('');

  const [nextSupplierCode, setNextSupplierCode] = useState('PRV-203');
  const [nextOrderCode, setNextOrderCode] = useState('OC-802');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);

  const [invProducts, setInvProducts] = useState<InventoryProductItem[]>([]);
  const [invWarehouses, setInvWarehouses] = useState<InventoryWarehouseItem[]>([]);

  const [supNit, setSupNit] = useState('');
  const [supName, setSupName] = useState('');
  const [supCity, setSupCity] = useState('Bogotá D.C.');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [manualProductCode, setManualProductCode] = useState('');
  const [manualProductName, setManualProductName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [manualWarehouseName, setManualWarehouseName] = useState('Bodega Principal');
  const [qty, setQty] = useState('10');
  const [unitCost, setUnitCost] = useState('25000');

  const inventoryEnabled = hasService('ms-inventario');

  const validModules = ['directorio_proveedores', 'ordenes_compra'];
  const currentTab =
    validModules.includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : validModules.find((m) => hasModule(m)) || 'ordenes_compra';

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<ComprasAllResponse>('/api/v1/compras/all');
      const supList = data.suppliers || [];
      const ordList = data.orders || [];
      setNextSupplierCode(data.nextSupplierCode || 'PRV-203');
      setNextOrderCode(data.nextOrderCode || 'OC-802');
      setSuppliers(supList);
      setOrders(ordList);
      setSupplierId((prev) => (prev && supList.some((s) => s.id === prev) ? prev : supList[0]?.id || ''));
    } catch {
      // Handled by platform session layer
    }

    if (inventoryEnabled) {
      try {
        const inv = await apiGet<InventarioAllResponse>('/api/v1/inventario/all');
        const prdList = inv.products || [];
        const whList = inv.warehouses || [];
        setInvProducts(prdList);
        setInvWarehouses(whList);
        setWarehouseId((prev) => (prev && whList.some((w) => w.id === prev) ? prev : whList[0]?.id || ''));
        setProductId((prev) => {
          const nextProd = prev && prdList.some((p) => p.id === prev) ? prev : prdList[0]?.id || '';
          const match = prdList.find((p) => p.id === nextProd);
          if (match && match.costPrice > 0) {
            setUnitCost(String(match.costPrice));
          }
          return nextProd;
        });
      } catch {
        setInvProducts([]);
        setInvWarehouses([]);
      }
    } else {
      setInvProducts([]);
      setInvWarehouses([]);
    }
  }, [apiGet, inventoryEnabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!incomingPayload) return;
    if (typeof incomingPayload.supplierId === 'string' && incomingPayload.supplierId) {
      setSupplierId(incomingPayload.supplierId);
    }
    if (typeof incomingPayload.productId === 'string' && incomingPayload.productId) {
      setProductId(incomingPayload.productId);
    }
    if (currentTab === 'directorio_proveedores') {
      setSupplierStudioOpen(true);
    } else {
      setOrderStudioOpen(true);
    }
    clearIncomingPayload();
  }, [incomingPayload, currentTab, clearIncomingPayload]);

  const handleProductChange = (newProdId: string) => {
    setProductId(newProdId);
    const found = invProducts.find((p) => p.id === newProdId);
    if (found) {
      if (found.costPrice > 0) {
        setUnitCost(String(found.costPrice));
      }
      if (found.warehouseId && invWarehouses.some((w) => w.id === found.warehouseId)) {
        setWarehouseId(found.warehouseId);
      }
    }
  };

  const submitNewSupplier = async (fromQuickModal: boolean) => {
    if (!supNit.trim() || !supName.trim()) {
      toast('Ingresa el NIT y la razón social del proveedor.');
      return;
    }
    await run(async () => {
      const resp = await apiPost<{ ok: boolean; supplier: Supplier }>('/api/v1/compras/suppliers', {
        nit: supNit.trim(),
        name: supName.trim(),
        city: supCity.trim() || 'Bogotá D.C.',
        phone: supPhone.trim(),
        email: supEmail.trim(),
      });
      toast('Proveedor homologado registrado en el directorio.');
      setSupNit('');
      setSupName('');
      setSupPhone('');
      setSupEmail('');
      if (fromQuickModal) {
        setSupplierModalOpen(false);
      } else {
        setSupplierStudioOpen(false);
      }
      await reload();
      if (resp?.supplier?.id) {
        setSupplierId(resp.supplier.id);
      }
    });
  };

  const handleConfirmDeleteSupplier = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    void run(async () => {
      await apiDelete(`/api/v1/compras/suppliers/${encodeURIComponent(target.id)}`);
      toast(`Proveedor ${target.code} eliminado.`);
      setDeleteTarget(null);
      await reload();
    });
  };

  const useCatalogMode = inventoryEnabled && invProducts.length > 0;

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = Number(qty || 0);
    const numCost = Number(unitCost || 0);
    if (!supplierId) {
      toast('Selecciona un proveedor autorizado.');
      return;
    }
    if (!Number.isFinite(numQty) || numQty <= 0 || !Number.isFinite(numCost) || numCost <= 0) {
      toast('La cantidad y el costo unitario deben ser mayores a cero.');
      return;
    }

    const selectedProd = invProducts.find((p) => p.id === productId);
    const selectedWh = invWarehouses.find((w) => w.id === warehouseId);

    const resolvedProductId = useCatalogMode ? selectedProd?.id || '' : manualProductCode.trim();
    const resolvedProductCode = useCatalogMode
      ? selectedProd?.code || ''
      : manualProductCode.trim() || (orderStudioType === 'INSUMOS_GASTO' ? 'GAS' : 'INS');
    const resolvedProductName = useCatalogMode ? selectedProd?.name || '' : manualProductName.trim();
    const resolvedWhId = invWarehouses.length > 0 ? selectedWh?.id || '' : '';
    const baseWhName =
      invWarehouses.length > 0
        ? selectedWh?.name || 'Bodega Principal'
        : manualWarehouseName.trim() || 'Bodega Principal';

    const resolvedWhName =
      orderStudioType === 'CREDITO_CXP'
        ? `${baseWhName} · Crédito CxP (${creditTerm})`
        : orderStudioType === 'INSUMOS_GASTO'
        ? `${baseWhName} · Insumos (${costCenterNote.trim() || 'Operación'})`
        : baseWhName;

    if (!resolvedProductName) {
      toast('Selecciona un producto o ingresa la descripción del artículo.');
      return;
    }

    void run(async () => {
      await apiPost('/api/v1/compras/orders', {
        supplierId,
        productId: resolvedProductId,
        productCode: resolvedProductCode,
        productName: resolvedProductName,
        warehouseId: resolvedWhId,
        warehouseName: resolvedWhName,
        qty: numQty,
        unitCost: numCost,
      });
      toast(
        useCatalogMode
          ? 'Orden de compra emitida y existencias actualizadas en almacén.'
          : 'Orden de compra registrada correctamente.'
      );
      setQty('10');
      setManualProductName('');
      setManualProductCode('');
      setOrderStudioOpen(false);
      await reload();
    });
  };

  const handleExportOrdersCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsvUtf8(
      `ordenes_compra_${stamp}.csv`,
      [
        'Orden',
        'Fecha',
        'Codigo Proveedor',
        'Proveedor',
        'NIT',
        'Producto',
        'Bodega / Condición',
        'Cantidad',
        'Costo Unitario',
        'Costo Total',
        'Sincronizado Inventario',
      ],
      orders.map((o) => [
        o.code,
        o.createdAt,
        o.supplierCode,
        o.supplierName,
        o.supplierNit,
        `${o.productCode ? o.productCode + ' - ' : ''}${o.productName}`,
        o.warehouseName,
        o.qty,
        o.unitCost,
        o.totalCost,
        o.inventorySynced ? 'SI' : 'NO',
      ])
    );
    toast('Reporte CSV de órdenes de compra descargado.');
  };

  const orderSummary = useMemo(() => {
    let contadoTotal = 0;
    let cxpTotal = 0;
    let contadoCount = 0;
    let cxpCount = 0;
    for (const o of orders) {
      const val = Number(o.totalCost) || 0;
      if (isOrderCreditCxP(o)) {
        cxpTotal += val;
        cxpCount += 1;
      } else {
        contadoTotal += val;
        contadoCount += 1;
      }
    }
    return {
      total: contadoTotal + cxpTotal,
      contadoTotal,
      cxpTotal,
      contadoCount,
      cxpCount,
    };
  }, [orders]);

  const supplierOrderStats = useMemo(() => {
    const map = new Map<string, { count: number; volume: number; cxpVolume: number }>();
    for (const o of orders) {
      const prev = map.get(o.supplierId) || { count: 0, volume: 0, cxpVolume: 0 };
      const amt = Number(o.totalCost) || 0;
      prev.count += 1;
      prev.volume += amt;
      if (isOrderCreditCxP(o)) prev.cxpVolume += amt;
      map.set(o.supplierId, prev);
    }
    return map;
  }, [orders]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    return suppliers.filter((s) => {
      const st = supplierOrderStats.get(s.id);
      if (supplierPill === 'WITH_ORDERS' && (!st || st.count === 0)) return false;
      if (supplierPill === 'WITH_CXP' && (!st || st.cxpVolume <= 0)) return false;
      if (!q) return true;
      return (
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.nit.toLowerCase().includes(q) ||
        (s.city || '').toLowerCase().includes(q)
      );
    });
  }, [suppliers, supplierPill, supplierSearch, supplierOrderStats]);

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      if (orderSupplierFilter && ord.supplierId !== orderSupplierFilter) return false;
      const isCxP = isOrderCreditCxP(ord);
      if (orderPill === 'CONTADO' && isCxP) return false;
      if (orderPill === 'CXP' && !isCxP) return false;
      const q = orderSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        ord.code.toLowerCase().includes(q) ||
        ord.supplierName.toLowerCase().includes(q) ||
        (ord.supplierNit || '').toLowerCase().includes(q) ||
        ord.productName.toLowerCase().includes(q) ||
        (ord.productCode || '').toLowerCase().includes(q)
      );
    });
  }, [orders, orderSupplierFilter, orderPill, orderSearch]);

  const previewTotalOrder = Math.max(0, (Number(qty) || 0) * (Number(unitCost) || 0));

  const buildOrderPrintPayload = (ord: PurchaseOrder): Record<string, unknown> => ({
    document_type: 'ORDEN DE COMPRA E INGRESO DE MERCANCÍA',
    layout_variant: 'carta_membrete',
    document_number: ord.code,
    issue_date: ord.createdAt,
    customer_name: ord.supplierName,
    customer_nit: ord.supplierNit,
    payment_method: isOrderCreditCxP(ord) ? 'Crédito Proveedor CxP' : 'Orden de Abastecimiento Contado',
    extra_fields: {
      'Código Proveedor': ord.supplierCode,
      'Bodega Destino': ord.warehouseName,
      'Estado Recepción': ord.status,
      'Sincronización Kardex': ord.inventorySynced ? 'Actualización Automática de Bodega' : 'Registro Documental',
    },
    items: [
      {
        code: ord.productCode || 'OC',
        description: ord.productName,
        quantity: ord.qty,
        unit_price: ord.unitCost,
        tax_pct: 0,
        subtotal: ord.totalCost,
      },
    ],
    subtotal: ord.totalCost,
    grand_total: ord.totalCost,
    notes: 'Documento oficial de abastecimiento y recepción de mercancía.',
  });

  const buildSupplierPrintPayload = (sup: Supplier): Record<string, unknown> => ({
    document_type: 'FICHA DE HOMOLOGACIÓN DE PROVEEDOR',
    layout_variant: 'carta_membrete',
    document_number: sup.code,
    issue_date: sup.createdAt,
    customer_name: sup.name,
    customer_nit: sup.nit,
    customer_phone: sup.phone,
    customer_address: sup.city,
    items: [
      {
        code: sup.code,
        description: `Proveedor activo — Ciudad: ${sup.city} — Contacto: ${sup.phone || 'N/A'} ${sup.email || ''}`,
        quantity: 1,
        unit_price: 0,
        tax_pct: 0,
        subtotal: 0,
      },
    ],
    grand_total: 0,
  });

  const suppliersDirectoryPrintPayload: Record<string, unknown> = {
    document_type: 'DIRECTORIO OFICIAL DE PROVEEDORES',
    layout_variant: 'carta_membrete',
    document_number: `DIR-PRV-${new Date().toISOString().slice(0, 10)}`,
    issue_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    customer_name: 'Catálogo Corporativo de Proveedores Homologados',
    extra_fields: {
      'Proveedores Activos': String(suppliers.length),
      'Órdenes Registradas': String(orders.length),
    },
    items: suppliers.map((s) => ({
      code: s.code,
      description: `${s.name} — NIT: ${s.nit} (${s.city}${s.phone ? ' · Tel: ' + s.phone : ''})`,
      quantity: 1,
      unit_price: 0,
      tax_pct: 0,
      subtotal: 0,
    })),
    grand_total: 0,
    notes: 'Listado vigente de proveedores autorizados.',
  };

  return (
    <div className="pk-stack">
      <PkKpiRow
        items={[
          { label: 'Proveedores Homologados', value: String(suppliers.length), color: 'var(--pk-primary)' },
          { label: 'Órdenes Emitidas', value: String(orders.length), color: 'var(--pk-emerald)' },
          { label: 'Volumen Total Compras', value: formatCop(orderSummary.total), color: '#0f172a' },
          {
            label: 'Cuentas por Pagar CxP',
            value: formatCop(orderSummary.cxpTotal),
            color: orderSummary.cxpTotal > 0 ? 'var(--pk-amber)' : 'var(--pk-emerald)',
          },
        ]}
      />

      {currentTab === 'ordenes_compra' && (
        <ModuleGate module="ordenes_compra">
          <div className="pk-stack">
            <PkLiveHeader
              title="Abastecimiento y Compras"
              liveLabel="Cadena activa"
              subtitle="Emisión de órdenes a proveedores, ingreso sincronizado a almacén y seguimiento de obligaciones CxP."
              pills={[
                { key: 'ALL', label: 'Todas', count: orders.length },
                { key: 'CONTADO', label: 'Contado', count: orderSummary.contadoCount },
                { key: 'CXP', label: 'Crédito CxP', count: orderSummary.cxpCount },
              ]}
              activePill={orderPill}
              onPillChange={setOrderPill}
              displayMode={orderDisplayMode}
              onDisplayModeChange={setOrderDisplayMode}
              boardLabel="🎛️ Tablero de Órdenes"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Nueva Orden de Compra"
              onPrimaryAction={() => setOrderStudioOpen(true)}
              extraActions={
                <button type="button" className="pk-btn pk-btn-outline" onClick={handleExportOrdersCsv}>
                  📥 Exportar CSV
                </button>
              }
            />

            <PkDistributionStrip
              title="Estructura Financiera de Abastecimiento: Compras de Contado vs Cuentas por Pagar CxP"
              segments={[
                {
                  label: 'Compras de Contado / Liquidación Directa',
                  value: orderSummary.contadoTotal,
                  displayValue: formatCop(orderSummary.contadoTotal),
                  color: '#10b981',
                },
                {
                  label: 'Cuentas por Pagar Proveedores (CxP)',
                  value: orderSummary.cxpTotal,
                  displayValue: formatCop(orderSummary.cxpTotal),
                  color: '#f59e0b',
                },
              ]}
            />

            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div
                className="pk-datatable-toolbar"
                style={{ borderBottom: orderDisplayMode === 'table' ? undefined : 'none' }}
              >
                <input
                  type="search"
                  className="pk-input pk-datatable-search"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="🔎 Buscar orden por consecutivo, proveedor, NIT o referencia..."
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 250 }}>
                    <PkSimpleSelect
                      ariaLabel="Filtrar por proveedor"
                      value={orderSupplierFilter}
                      onChange={setOrderSupplierFilter}
                      allowClear
                      placeholder="Todos los proveedores"
                      options={[
                        { value: '', label: 'Todos los proveedores' },
                        ...suppliers.map((s) => ({
                          value: s.id,
                          label: `${s.code} — ${s.name}`,
                          sublabel: s.nit,
                        })),
                      ]}
                    />
                  </div>
                  <span className="pk-badge pk-badge-slate">{filteredOrders.length} órdenes</span>
                </div>
              </div>

              {orderDisplayMode === 'table' && (
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>N° Orden</th>
                          <th>Fecha</th>
                          <th>Proveedor</th>
                          <th>Producto / Descripción</th>
                          <th>Bodega / Modalidad</th>
                          <th className="num">Cant.</th>
                          <th className="num">Costo Unit.</th>
                          <th className="num">Total OC</th>
                          <th>Kardex</th>
                          <th>Imprimir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={10} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              No se encontraron órdenes de compra para el criterio seleccionado.
                            </td>
                          </tr>
                        ) : (
                          filteredOrders.map((ord) => (
                            <tr key={ord.id}>
                              <td>
                                <span className="pk-badge pk-badge-emerald">{ord.code}</span>
                              </td>
                              <td>{ord.createdAt}</td>
                              <td>
                                <div style={{ fontWeight: 700 }}>{ord.supplierName}</div>
                                <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>NIT {ord.supplierNit}</div>
                              </td>
                              <td>
                                {ord.productCode ? `${ord.productCode} — ` : ''}
                                {ord.productName}
                              </td>
                              <td>{ord.warehouseName}</td>
                              <td className="num" style={{ fontWeight: 800 }}>
                                +{ord.qty}
                              </td>
                              <td className="num">{formatCop(ord.unitCost)}</td>
                              <td className="num" style={{ fontWeight: 800, color: 'var(--pk-primary)' }}>
                                {formatCop(ord.totalCost)}
                              </td>
                              <td>
                                <span
                                  className={`pk-badge ${
                                    ord.inventorySynced ? 'pk-badge-blue' : 'pk-badge-slate'
                                  }`}
                                >
                                  {ord.inventorySynced ? 'Sincronizado' : 'Documental'}
                                </span>
                              </td>
                              <td>
                                <PkPrintButton label="🖨️ Orden" payload={buildOrderPrintPayload(ord)} />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {orderDisplayMode === 'board' && (
              <>
                {filteredOrders.length === 0 ? (
                  <div className="pk-kanban-empty">
                    No existen órdenes de compra registradas bajo la modalidad seleccionada.
                  </div>
                ) : (
                  <div className="pk-cards-showcase">
                    {filteredOrders.map((ord) => {
                      const isCxP = isOrderCreditCxP(ord);
                      return (
                        <PkTicketCard
                          key={ord.id}
                          code={ord.code}
                          timeAgo={ord.createdAt}
                          channelBadge={{
                            label: isCxP ? '🏦 Crédito CxP' : '💵 Contado',
                            tone: isCxP ? 'amber' : 'emerald',
                          }}
                          title={ord.supplierName}
                          subtitle={`NIT ${ord.supplierNit} · Cód: ${ord.supplierCode}`}
                          metaLine={`🏢 Destino: ${ord.warehouseName}`}
                          items={[
                            {
                              qty: ord.qty,
                              name: `${ord.productCode ? `[${ord.productCode}] ` : ''}${ord.productName}`,
                              amount: formatCop(ord.totalCost),
                            },
                            {
                              name: 'Costo Unitario Negociado',
                              amount: formatCop(ord.unitCost),
                            },
                          ]}
                          totalLabel="TOTAL ORDEN"
                          totalValue={formatCop(ord.totalCost)}
                          processNodes={[
                            {
                              step: 1,
                              label: '1. Orden Emitida',
                              sublabel: ord.code,
                              status: 'done',
                            },
                            {
                              step: 2,
                              label: '2. Ingreso Bodega',
                              sublabel: ord.inventorySynced ? 'Kardex OK' : 'Documental',
                              status: 'done',
                            },
                            {
                              step: 3,
                              label: '3. Pago / CxP',
                              sublabel: isCxP ? 'CxP Activa' : 'Liquidada',
                              status: isCxP ? 'active' : 'done',
                            },
                          ]}
                          statusPill={{
                            label: ord.inventorySynced ? 'Sincronizada con Almacén' : ord.status || 'Emitida',
                            tone: isCxP ? 'amber' : 'emerald',
                          }}
                          primaryAction={
                            isCxP && hasService('ms-caja')
                              ? {
                                  label: '🏦 Conciliar Giro en Tesorería',
                                  tone: 'amber',
                                  onClick: () =>
                                    navigateTo('ms-caja', 'bancos_tesoreria', {
                                      concept: `Pago OC ${ord.code} — ${ord.supplierName}`,
                                      amount: ord.totalCost,
                                      reference: ord.code,
                                    }),
                                }
                              : undefined
                          }
                          secondaryActions={
                            <PkPrintButton label="🖨️ Imprimir Orden" payload={buildOrderPrintPayload(ord)} />
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </ModuleGate>
      )}

      {currentTab === 'directorio_proveedores' && (
        <ModuleGate module="directorio_proveedores">
          <div className="pk-stack">
            <PkLiveHeader
              title="Abastecimiento y Proveedores Homologados"
              liveLabel="Cadena activa"
              subtitle="Directorio corporativo de aliados nacionales e importadores con historial de abastecimiento."
              pills={[
                { key: 'ALL', label: 'Todos', count: suppliers.length },
                {
                  key: 'WITH_ORDERS',
                  label: 'Con Órdenes Emitidas',
                  count: suppliers.filter((s) => (supplierOrderStats.get(s.id)?.count || 0) > 0).length,
                },
                {
                  key: 'WITH_CXP',
                  label: 'Con Crédito CxP',
                  count: suppliers.filter((s) => (supplierOrderStats.get(s.id)?.cxpVolume || 0) > 0).length,
                },
              ]}
              activePill={supplierPill}
              onPillChange={setSupplierPill}
              displayMode={supplierDisplayMode}
              onDisplayModeChange={setSupplierDisplayMode}
              boardLabel="🎛️ Tarjetas Proveedor"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Nuevo Proveedor"
              onPrimaryAction={() => setSupplierStudioOpen(true)}
              extraActions={
                <PkPrintButton
                  label="🖨️ Imprimir Directorio"
                  payload={suppliersDirectoryPrintPayload}
                  variant="primary"
                />
              }
            />

            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div
                className="pk-datatable-toolbar"
                style={{ borderBottom: supplierDisplayMode === 'table' ? undefined : 'none' }}
              >
                <input
                  type="search"
                  className="pk-input pk-datatable-search"
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  placeholder="🔎 Buscar proveedor por código, razón social, NIT o ciudad..."
                />
                <span className="pk-badge pk-badge-slate">{filteredSuppliers.length} proveedores</span>
              </div>

              {supplierDisplayMode === 'table' && (
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>NIT</th>
                          <th>Razón Social</th>
                          <th>Ciudad</th>
                          <th>Contacto</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSuppliers.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              No existen proveedores registrados para el criterio consultado.
                            </td>
                          </tr>
                        ) : (
                          filteredSuppliers.map((sup) => (
                            <tr key={sup.id}>
                              <td>
                                <span className="pk-badge pk-badge-blue">{sup.code}</span>
                              </td>
                              <td>{sup.nit}</td>
                              <td style={{ fontWeight: 700 }}>{sup.name}</td>
                              <td>{sup.city}</td>
                              <td>
                                <div>{sup.phone || '—'}</div>
                                {sup.email && (
                                  <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{sup.email}</div>
                                )}
                              </td>
                              <td>
                                <div className="pk-row-actions">
                                  {hasModule('ordenes_compra') && (
                                    <button
                                      type="button"
                                      className="pk-btn pk-btn-primary pk-btn-sm"
                                      onClick={() => {
                                        setSupplierId(sup.id);
                                        setOrderStudioOpen(true);
                                      }}
                                    >
                                      📥 Emitir OC
                                    </button>
                                  )}
                                  <PkPrintButton label="🖨️ Ficha" payload={buildSupplierPrintPayload(sup)} />
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-danger pk-btn-sm"
                                    onClick={() => setDeleteTarget(sup)}
                                    disabled={busy}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {supplierDisplayMode === 'board' && (
              <div className="pk-cards-showcase">
                {filteredSuppliers.map((sup) => {
                  const st = supplierOrderStats.get(sup.id) || { count: 0, volume: 0, cxpVolume: 0 };
                  const sharePct = orderSummary.total > 0 ? (st.volume / orderSummary.total) * 100 : 0;
                  return (
                    <PkTicketCard
                      key={sup.id}
                      code={sup.code}
                      timeAgo={`NIT ${sup.nit}`}
                      channelBadge={{ label: `📍 ${sup.city}`, tone: 'blue' }}
                      title={sup.name}
                      subtitle={`📞 ${sup.phone || 'Sin teléfono'} · ✉️ ${sup.email || 'Sin correo'}`}
                      items={[
                        { name: 'Órdenes Emitidas', amount: `${st.count} OC` },
                        { name: 'Saldo CxP Asociado', amount: formatCop(st.cxpVolume) },
                      ]}
                      extraBody={
                        <PkProgressBar
                          label="Participación en Compras"
                          valueLabel={`${Math.round(sharePct)}% del volumen`}
                          pct={sharePct}
                          tone={st.cxpVolume > 0 ? 'amber' : 'emerald'}
                        />
                      }
                      totalLabel="VOLUMEN ACUMULADO"
                      totalValue={formatCop(st.volume)}
                      statusPill={{ label: 'Proveedor Homologado', tone: 'emerald' }}
                      primaryAction={
                        hasModule('ordenes_compra')
                          ? {
                              label: '+ Emitir Orden a este Proveedor',
                              tone: 'navy',
                              onClick: () => {
                                setSupplierId(sup.id);
                                setOrderStudioOpen(true);
                              },
                            }
                          : undefined
                      }
                      secondaryActions={
                        <>
                          <PkPrintButton label="🖨️ Ficha" payload={buildSupplierPrintPayload(sup)} />
                          <button
                            type="button"
                            className="pk-btn pk-btn-danger pk-btn-sm"
                            onClick={() => setDeleteTarget(sup)}
                            disabled={busy}
                          >
                            Eliminar
                          </button>
                        </>
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </ModuleGate>
      )}

      <PkFullscreenDialog
        open={orderStudioOpen}
        title="Estudio de Emisión de Orden de Compra y Recepción"
        subtitle="Selecciona la modalidad de abastecimiento para sincronizar existencias en bodega o programar obligación CxP."
        badge={{ label: nextOrderCode, tone: 'emerald' }}
        onClose={() => setOrderStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="Modalidad Operativa y Financiera de la Orden"
            options={ORDER_STUDIO_OPTIONS}
            value={orderStudioType}
            onChange={(key) => setOrderStudioType(key as OrderStudioType)}
          />
        }
        footerLeft={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span className="pk-badge pk-badge-blue">{nextOrderCode}</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
              Total Orden: {formatCop(previewTotalOrder)}
            </span>
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
              form="pk-fs-order-form"
              className="pk-btn pk-btn-emerald"
              disabled={busy}
            >
              {busy ? 'Procesando...' : '📥 Emitir Orden de Compra'}
            </button>
          </>
        }
      >
        <form id="pk-fs-order-form" onSubmit={handleCreateOrder} className="pk-stack">
          <div className="pk-card" style={{ overflow: 'visible' }}>
            <div className="pk-card-head">
              <div className="pk-card-title">🏢 Proveedor Adjudicado y Centro de Recepción</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid">
                <PkAutoCodeInput label="Consecutivo Orden" value={nextOrderCode} />

                <PkSelect
                  label="Proveedor Homologado *"
                  items={suppliers}
                  value={supplierId}
                  onChange={setSupplierId}
                  getValue={(s) => s.id}
                  getLabel={(s) => `${s.code} — ${s.name} (${s.nit})`}
                  onCreateNew={
                    hasModule('directorio_proveedores') ? () => setSupplierModalOpen(true) : undefined
                  }
                  createLabel="+ Nuevo Proveedor"
                  searchable
                />

                {invWarehouses.length > 0 ? (
                  <PkSelect
                    label="Bodega de Recepción *"
                    items={invWarehouses}
                    value={warehouseId}
                    onChange={setWarehouseId}
                    getValue={(w) => w.id}
                    getLabel={(w) => `${w.code} — ${w.name}${w.city ? ` (${w.city})` : ''}`}
                    searchable
                  />
                ) : (
                  <div className="pk-field">
                    <label>Bodega / Centro Destino</label>
                    <input
                      value={manualWarehouseName}
                      onChange={(e) => setManualWarehouseName(e.target.value)}
                      placeholder="Bodega Principal"
                    />
                  </div>
                )}

                {orderStudioType === 'CREDITO_CXP' && (
                  <PkSimpleSelect
                    label="Plazo Financiero Pactado (CxP)"
                    options={CREDIT_TERM_OPTIONS}
                    value={creditTerm}
                    onChange={setCreditTerm}
                    searchable={false}
                  />
                )}

                {orderStudioType === 'INSUMOS_GASTO' && (
                  <div className="pk-field">
                    <label>Centro de Costo / Área Destino</label>
                    <input
                      value={costCenterNote}
                      onChange={(e) => setCostCenterNote(e.target.value)}
                      placeholder="Operación Principal"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pk-card" style={{ overflow: 'visible' }}>
            <div className="pk-card-head">
              <div className="pk-card-title">📦 Ítem Negociado, Cantidades y Costo Unitario</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid">
                {useCatalogMode ? (
                  <div className="pk-col-span-full">
                    <PkSelect
                      label="Referencia del Catálogo de Almacén *"
                      items={invProducts}
                      value={productId}
                      onChange={handleProductChange}
                      getValue={(p) => p.id}
                      getLabel={(p) => `${p.code} — ${p.name} (Stock actual: ${p.stock})`}
                      searchable
                    />
                  </div>
                ) : (
                  <>
                    <div className="pk-field">
                      <label>Referencia / Código Artículo</label>
                      <input
                        value={manualProductCode}
                        onChange={(e) => setManualProductCode(e.target.value)}
                        placeholder="Ej: INS-010"
                      />
                    </div>
                    <div className="pk-field pk-col-span-2">
                      <label>Descripción del Producto o Insumo *</label>
                      <input
                        required
                        value={manualProductName}
                        onChange={(e) => setManualProductName(e.target.value)}
                        placeholder="Ej: Caja de resmas corporativas carta"
                      />
                    </div>
                  </>
                )}

                <div className="pk-field">
                  <label>Cantidad a Ingresar *</label>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="any"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </div>

                <div className="pk-field">
                  <label>Costo Unitario Compra ($) *</label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="any"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                  />
                </div>

                <div className="pk-field">
                  <label>Subtotal Liquidado</label>
                  <input
                    readOnly
                    value={formatCop(previewTotalOrder)}
                    style={{ background: '#f8fafc', fontWeight: 800 }}
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </PkFullscreenDialog>

      <PkFullscreenDialog
        open={supplierStudioOpen}
        title="Estudio de Homologación de Proveedor"
        subtitle="Registra aliados comerciales nacionales o importadores habilitados para órdenes de abastecimiento."
        badge={{ label: nextSupplierCode, tone: 'blue' }}
        onClose={() => setSupplierStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="Categoría de Proveedor a Homologar"
            options={SUPPLIER_STUDIO_OPTIONS}
            value={supplierStudioType}
            onChange={(key) => setSupplierStudioType(key as SupplierStudioType)}
          />
        }
        footerLeft={
          <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
            Ficha oficial {nextSupplierCode} · Categoría:{' '}
            {supplierStudioType === 'IMPORTADOR'
              ? 'Importador Especializado'
              : supplierStudioType === 'INSUMOS'
              ? 'Aliado de Insumos'
              : 'Mayorista Nacional'}
          </span>
        }
        footerActions={
          <>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setSupplierStudioOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pk-fs-supplier-form"
              className="pk-btn pk-btn-primary"
              disabled={busy}
            >
              {busy ? 'Guardando...' : '💾 Homologar Proveedor'}
            </button>
          </>
        }
      >
        <form
          id="pk-fs-supplier-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submitNewSupplier(false);
          }}
          className="pk-stack"
        >
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🏢 Datos Tributarios y Contacto de Abastecimiento</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid cols-2">
                <PkAutoCodeInput label="Código Proveedor" value={nextSupplierCode} />
                <div className="pk-field">
                  <label>NIT / Identificación Tributaria *</label>
                  <input
                    required
                    value={supNit}
                    onChange={(e) => setSupNit(e.target.value)}
                    placeholder="Ej: 860.025.147-1"
                  />
                </div>
                <div className="pk-field pk-col-span-full">
                  <label>Razón Social / Nombre Comercial *</label>
                  <input
                    required
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    placeholder="Ej: Suministros Industriales S.A.S."
                  />
                </div>
                <div className="pk-field">
                  <label>Ciudad Sede</label>
                  <input
                    value={supCity}
                    onChange={(e) => setSupCity(e.target.value)}
                    placeholder="Bogotá D.C."
                  />
                </div>
                <div className="pk-field">
                  <label>Teléfono Comercial</label>
                  <input
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="Ej: 3102223344"
                  />
                </div>
                <div className="pk-field pk-col-span-full">
                  <label>Correo Electrónico de Pedidos</label>
                  <input
                    type="email"
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    placeholder="ventas@proveedor.co"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </PkFullscreenDialog>

      <PkModal
        open={supplierModalOpen}
        title="🏢 Nuevo Proveedor Homologado"
        onClose={() => setSupplierModalOpen(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitNewSupplier(true);
          }}
          className="pk-form-grid cols-2"
        >
          <PkAutoCodeInput label="Código Proveedor" value={nextSupplierCode} />
          <div className="pk-field">
            <label>NIT / Identificación *</label>
            <input
              required
              value={supNit}
              onChange={(e) => setSupNit(e.target.value)}
              placeholder="Ej: 901.334.550-8"
            />
          </div>
          <div className="pk-field pk-col-span-full">
            <label>Razón Social *</label>
            <input
              required
              value={supName}
              onChange={(e) => setSupName(e.target.value)}
              placeholder="Ej: Comercializadora Central S.A.S."
            />
          </div>
          <div className="pk-field">
            <label>Ciudad</label>
            <input value={supCity} onChange={(e) => setSupCity(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Teléfono</label>
            <input value={supPhone} onChange={(e) => setSupPhone(e.target.value)} />
          </div>
          <div className="pk-field pk-col-span-full">
            <label>Correo Electrónico</label>
            <input
              type="email"
              value={supEmail}
              onChange={(e) => setSupEmail(e.target.value)}
              placeholder="ventas@proveedor.co"
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setSupplierModalOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              {busy ? 'Guardando...' : '💾 Guardar Proveedor'}
            </button>
          </div>
        </form>
      </PkModal>

      <PkConfirmModal
        open={Boolean(deleteTarget)}
        title="Eliminar Proveedor"
        message={
          deleteTarget
            ? `¿Confirmas eliminar al proveedor ${deleteTarget.name} (${deleteTarget.code}) del directorio?`
            : ''
        }
        confirmLabel="Eliminar Proveedor"
        onConfirm={handleConfirmDeleteSupplier}
        onCancel={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
};

export default ComprasView;
