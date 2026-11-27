import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  downloadCsvUtf8,
  FeatureGate,
  formatCop,
  ModuleGate,
  PkAutoCodeInput,
  PkConfirmModal,
  PkDistributionStrip,
  PkFullscreenDialog,
  PkKanbanBoard,
  PkKpiRow,
  PkLiveHeader,
  PkModal,
  PkPrintButton,
  PkProgressBar,
  PkSelect,
  PkSimpleSelect,
  PkTicketCard,
  PkTypeCards,
  useAsyncAction,
  usePlatform,
} from '@platform/ui-sdk';

interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string;
  manager: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  warehouseId: string;
  warehouseName: string;
  supplierId: string;
  supplierName: string;
  costPrice: number;
  salePrice: number;
  taxPct: number;
  stock: number;
  minStock: number;
  lotCode: string;
  expiryDate: string;
}

interface KardexMovement {
  id: string;
  date: string;
  type: string;
  productId: string;
  productCode: string;
  productName: string;
  warehouseName: string;
  qty: number;
  unitCost: number;
  balanceAfter: number;
  reference: string;
}

interface SupplyRequest {
  id: string;
  code: string;
  date: string;
  area: string;
  productId: string;
  productName: string;
  qty: number;
  status: string;
  notes: string;
}

interface SupplierRef {
  id: string;
  name: string;
}

interface InventoryAllResponse {
  ok: boolean;
  nextProductCode: string;
  nextWarehouseCode: string;
  nextRequestCode: string;
  products: Product[];
  warehouses: Warehouse[];
  kardex: KardexMovement[];
  requests: SupplyRequest[];
}

type ProductStudioNature = 'FISICO' | 'INSUMO' | 'KIT';
type RequestStudioOrigin = 'OPERACIONES' | 'MANTENIMIENTO' | 'SEDES';

const PRODUCT_NATURE_OPTIONS = [
  {
    key: 'FISICO',
    icon: '📦',
    title: 'Producto Físico Inventariable',
    description: 'Mercancía para comercialización con control de existencias, costo ponderado, lote y vencimiento.',
    badge: 'Comercial',
  },
  {
    key: 'INSUMO',
    icon: '🧪',
    title: 'Insumo Operativo Interno',
    description: 'Material o suministro de consumo interno para áreas de producción, taller, cocina o atención.',
    badge: 'Consumo',
  },
  {
    key: 'KIT',
    icon: '🛠️',
    title: 'Referencia / Kit Comercial',
    description: 'Presentación compuesta o referencia empaquetada con tarifa de venta y margen objetivo.',
    badge: 'Kit',
  },
];

const REQUEST_ORIGIN_OPTIONS = [
  {
    key: 'OPERACIONES',
    icon: '⚙️',
    title: 'Operaciones y Planta',
    description: 'Despacho inmediato de materias primas e insumos para líneas operativas activas.',
    badge: 'Prioritario',
  },
  {
    key: 'MANTENIMIENTO',
    icon: '🛠️',
    title: 'Taller y Mantenimiento',
    description: 'Solicitud de repuestos, lubricantes o herramientas para órdenes técnicas.',
    badge: 'Técnico',
  },
  {
    key: 'SEDES',
    icon: '🏢',
    title: 'Administración y Sedes',
    description: 'Dotación operativa, papelería corporativa o suministros para puntos de atención.',
    badge: 'Interno',
  },
];

const WAREHOUSE_SWATCHES = ['#0284c7', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#0f172a'];

export const InventarioView: React.FC = () => {
  const {
    activeModuleKey,
    apiGet,
    apiPost,
    apiDelete,
    hasService,
    incomingPayload,
    clearIncomingPayload,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [productDisplayMode, setProductDisplayMode] = useState<'board' | 'table'>('board');
  const [productPill, setProductPill] = useState<string>('ALL');
  const [productStudioOpen, setProductStudioOpen] = useState(false);
  const [productNature, setProductNature] = useState<ProductStudioNature>('FISICO');

  const [warehouseDisplayMode, setWarehouseDisplayMode] = useState<'board' | 'table'>('board');

  const [kardexDisplayMode, setKardexDisplayMode] = useState<'board' | 'table'>('board');
  const [kardexPill, setKardexPill] = useState<string>('ALL');

  const [requestDisplayMode, setRequestDisplayMode] = useState<'board' | 'table'>('board');
  const [requestPill, setRequestPill] = useState<string>('ALL');
  const [requestStudioOpen, setRequestStudioOpen] = useState(false);
  const [requestOrigin, setRequestOrigin] = useState<RequestStudioOrigin>('OPERACIONES');

  const [productSearch, setProductSearch] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [kardexSearch, setKardexSearch] = useState('');
  const [requestSearch, setRequestSearch] = useState('');

  const [state, setState] = useState<InventoryAllResponse>({
    ok: true,
    nextProductCode: 'PRD-1011',
    nextWarehouseCode: 'BOD-11',
    nextRequestCode: 'REQ-501',
    products: [],
    warehouses: [],
    kardex: [],
    requests: [],
  });
  const [suppliers, setSuppliers] = useState<SupplierRef[]>([]);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [warehouseId, setWarehouseId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [costPrice, setCostPrice] = useState('0');
  const [salePrice, setSalePrice] = useState('0');
  const [taxPct, setTaxPct] = useState('19');
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState('5');
  const [lotCode, setLotCode] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const [whModalOpen, setWhModalOpen] = useState(false);
  const [whName, setWhName] = useState('');
  const [whLocation, setWhLocation] = useState('');
  const [whManager, setWhManager] = useState('');

  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('10');
  const [restockCost, setRestockCost] = useState('0');
  const [restockLot, setRestockLot] = useState('');
  const [restockExp, setRestockExp] = useState('');

  const [transferTarget, setTransferTarget] = useState<Product | null>(null);
  const [transferWhId, setTransferWhId] = useState('');
  const [transferQty, setTransferQty] = useState('1');
  const [transferNote, setTransferNote] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const [reqArea, setReqArea] = useState('Operaciones');
  const [reqProductId, setReqProductId] = useState('');
  const [reqQty, setReqQty] = useState('1');
  const [reqNotes, setReqNotes] = useState('');

  const currentTab = activeModuleKey || 'productos_stock';

  const reload = useCallback(async () => {
    try {
      const invPromise = apiGet<InventoryAllResponse>('/api/v1/inventario/all');
      const supPromise = hasService('ms-compras')
        ? apiGet<{ suppliers?: SupplierRef[] }>('/api/v1/compras/all').catch(() => ({ suppliers: [] }))
        : Promise.resolve({ suppliers: [] });

      const [invData, supData] = await Promise.all([invPromise, supPromise]);
      setState(invData);
      setSuppliers(supData.suppliers || []);
      if (!warehouseId && invData.warehouses?.length > 0) {
        setWarehouseId(invData.warehouses[0].id);
      }
      if (!reqProductId && invData.products?.length > 0) {
        setReqProductId(invData.products[0].id);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Error cargando inventario');
    }
  }, [apiGet, hasService, reqProductId, toast, warehouseId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!incomingPayload) return;
    if (currentTab === 'solicitudes_insumos') {
      setRequestStudioOpen(true);
    } else if (currentTab === 'productos_stock') {
      setProductStudioOpen(true);
    }
    clearIncomingPayload();
  }, [incomingPayload, currentTab, clearIncomingPayload]);

  const handleProductNatureChange = (nextKey: string) => {
    const key = nextKey as ProductStudioNature;
    setProductNature(key);
    if (key === 'INSUMO') {
      setCategory('Insumos Operativos');
      setSalePrice('0');
    } else if (key === 'KIT') {
      setCategory('Kit Comercial');
      setLotCode('');
      setExpiryDate('');
    } else {
      setCategory('Mercancía General');
    }
  };

  const handleRequestOriginChange = (nextKey: string) => {
    const key = nextKey as RequestStudioOrigin;
    setRequestOrigin(key);
    if (key === 'OPERACIONES') setReqArea('Operaciones');
    else if (key === 'MANTENIMIENTO') setReqArea('Taller y Mantenimiento');
    else setReqArea('Administración y Sedes');
  };

  const metrics = useMemo(() => {
    let costVal = 0;
    let saleVal = 0;
    let lowCount = 0;
    let optimalCount = 0;
    let reorderCount = 0;
    let outCount = 0;
    let optimalCost = 0;
    let riskCost = 0;

    for (const p of state.products) {
      const lineCost = Math.max(0, p.stock) * p.costPrice;
      costVal += lineCost;
      saleVal += Math.max(0, p.stock) * p.salePrice;
      if (p.stock <= p.minStock) {
        lowCount += 1;
        riskCost += lineCost;
      } else {
        optimalCost += lineCost;
      }
      if (p.stock <= 0) {
        outCount += 1;
      } else if (p.stock <= p.minStock) {
        reorderCount += 1;
      } else {
        optimalCount += 1;
      }
    }
    return { costVal, saleVal, lowCount, optimalCount, reorderCount, outCount, optimalCost, riskCost };
  }, [state.products]);

  const valuationSegments = useMemo(() => {
    if (state.warehouses.length > 1) {
      return state.warehouses.map((w, idx) => {
        const whVal = state.products
          .filter((p) => p.warehouseId === w.id)
          .reduce((acc, p) => acc + Math.max(0, p.stock) * p.costPrice, 0);
        return {
          label: w.name,
          value: whVal,
          displayValue: formatCop(whVal),
          color: WAREHOUSE_SWATCHES[idx % WAREHOUSE_SWATCHES.length],
        };
      });
    }
    return [
      {
        label: 'Valorizado en Stock Óptimo',
        value: metrics.optimalCost,
        displayValue: formatCop(metrics.optimalCost),
        color: '#10b981',
      },
      {
        label: 'Valorizado en Nivel de Reorden',
        value: metrics.riskCost,
        displayValue: formatCop(metrics.riskCost),
        color: '#f59e0b',
      },
    ];
  }, [state.warehouses, state.products, metrics.optimalCost, metrics.riskCost]);

  const filteredProducts = useMemo(() => {
    return state.products.filter((p) => {
      if (warehouseFilter && p.warehouseId !== warehouseFilter) return false;
      if (productPill === 'OPTIMAL' && p.stock <= p.minStock) return false;
      if (productPill === 'REORDER' && !(p.stock > 0 && p.stock <= p.minStock)) return false;
      if (productPill === 'OUT' && p.stock > 0) return false;
      const q = productSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.lotCode || '').toLowerCase().includes(q)
      );
    });
  }, [state.products, warehouseFilter, productPill, productSearch]);

  const classifyKardex = (typeStr: string): 'IN' | 'OUT' | 'TRANSFER' => {
    const t = (typeStr || '').toLowerCase();
    if (t.includes('traslad') || t.includes('transfer')) return 'TRANSFER';
    if (t.includes('salid') || t.includes('venta') || t.includes('despach') || t.includes('consum') || t.includes('baja')) {
      return 'OUT';
    }
    return 'IN';
  };

  const filteredKardex = useMemo(() => {
    const q = kardexSearch.trim().toLowerCase();
    return state.kardex.filter((k) => {
      const kind = classifyKardex(k.type);
      if (kardexPill !== 'ALL' && kind !== kardexPill) return false;
      if (!q) return true;
      return (
        k.productCode.toLowerCase().includes(q) ||
        k.productName.toLowerCase().includes(q) ||
        k.type.toLowerCase().includes(q) ||
        (k.reference || '').toLowerCase().includes(q)
      );
    });
  }, [state.kardex, kardexPill, kardexSearch]);

  const filteredRequests = useMemo(() => {
    const q = requestSearch.trim().toLowerCase();
    return state.requests.filter((r) => {
      const st = (r.status || '').toLowerCase();
      const isPending = st.includes('pend') || st.includes('solicit') || st.includes('abiert');
      if (requestPill === 'PENDING' && !isPending) return false;
      if (requestPill === 'DONE' && isPending) return false;
      if (!q) return true;
      return (
        r.code.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q)
      );
    });
  }, [state.requests, requestPill, requestSearch]);

  const openRestockModal = (p: Product) => {
    setRestockTarget(p);
    setRestockQty('10');
    setRestockCost(String(p.costPrice));
    setRestockLot(p.lotCode || '');
    setRestockExp(p.expiryDate || '');
  };

  const openTransferModal = (p: Product) => {
    setTransferTarget(p);
    const other = state.warehouses.find((w) => w.id !== p.warehouseId);
    setTransferWhId(other?.id || '');
    setTransferQty('1');
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const selectedSup = suppliers.find((s) => s.id === supplierId);
      const numericCost = Number(costPrice) || 0;
      const numericSale =
        productNature === 'INSUMO' && (!Number(salePrice) || Number(salePrice) <= 0)
          ? numericCost
          : Number(salePrice) || 0;

      await apiPost('/api/v1/inventario/products', {
        name,
        category,
        warehouseId,
        supplierId,
        supplierName: selectedSup?.name || '',
        costPrice: numericCost,
        salePrice: numericSale,
        taxPct: Number(taxPct) || 0,
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 0,
        lotCode: productNature === 'KIT' ? '' : lotCode,
        expiryDate: productNature === 'KIT' ? '' : expiryDate,
      });
      setName('');
      setCostPrice('0');
      setSalePrice('0');
      setStock('0');
      setLotCode('');
      setExpiryDate('');
      setProductStudioOpen(false);
      toast('Producto registrado en el centro logístico');
      await reload();
    });
  };

  const handleDelta = (product: Product, delta: number) => {
    void run(async () => {
      await apiPost(`/api/v1/inventario/products/${encodeURIComponent(product.id)}/delta`, { delta });
      await reload();
    });
  };

  const handleCreateWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await apiPost<{ warehouse: Warehouse }>('/api/v1/inventario/warehouses', {
        name: whName,
        location: whLocation,
        manager: whManager,
      });
      setWhName('');
      setWhLocation('');
      setWhManager('');
      setWhModalOpen(false);
      if (res.warehouse?.id) {
        setWarehouseId(res.warehouse.id);
      }
      toast('Bodega creada correctamente');
      await reload();
    });
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;
    void run(async () => {
      await apiPost(`/api/v1/inventario/products/${encodeURIComponent(restockTarget.id)}/restock`, {
        qty: Number(restockQty) || 0,
        unitCost: Number(restockCost) || 0,
        lotCode: restockLot,
        expiryDate: restockExp,
      });
      setRestockTarget(null);
      toast('Entrada de mercancía aplicada con costo promedio ponderado');
      await reload();
    });
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget) return;
    void run(async () => {
      await apiPost(`/api/v1/inventario/products/${encodeURIComponent(transferTarget.id)}/transfer`, {
        targetWarehouseId: transferWhId,
        qty: Number(transferQty) || 0,
        note: transferNote,
      });
      setTransferTarget(null);
      setTransferNote('');
      toast('Traslado entre bodegas registrado en Kardex');
      await reload();
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    void run(async () => {
      await apiDelete(`/api/v1/inventario/products/${encodeURIComponent(deleteTarget.id)}`);
      setDeleteTarget(null);
      toast('Producto eliminado del catálogo');
      await reload();
    });
  };

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const prod = state.products.find((p) => p.id === reqProductId);
      await apiPost('/api/v1/inventario/requests', {
        area: reqArea,
        productId: reqProductId,
        productName: prod?.name || '',
        qty: Number(reqQty) || 1,
        notes: reqNotes,
      });
      setReqQty('1');
      setReqNotes('');
      setRequestStudioOpen(false);
      toast('Solicitud interna de insumos registrada');
      await reload();
    });
  };

  const exportInventoryCsv = () => {
    downloadCsvUtf8(
      'inventario_valorizado.csv',
      ['SKU', 'Producto', 'Categoría', 'Bodega', 'Stock', 'Stock Mínimo', 'Costo Unitario', 'Precio Venta', 'Valor Costo Total'],
      state.products.map((p) => [
        p.code,
        p.name,
        p.category,
        p.warehouseName,
        p.stock,
        p.minStock,
        p.costPrice,
        p.salePrice,
        p.stock * p.costPrice,
      ])
    );
  };

  const inventoryPrintPayload = useMemo<Record<string, unknown>>(
    () => ({
      document_type: 'INFORME DE INVENTARIO VALORIZADO',
      document_number: state.nextProductCode,
      customer_name: 'Control Interno de Almacén',
      items: state.products.map((p) => ({
        code: p.code,
        description: `${p.name} (${p.warehouseName})`,
        quantity: p.stock,
        unit_price: p.costPrice,
        tax_pct: p.taxPct,
        subtotal: p.stock * p.costPrice,
      })),
      subtotal: metrics.costVal,
      grand_total: metrics.costVal,
    }),
    [state.nextProductCode, state.products, metrics.costVal]
  );

  const previewMarginPct = useMemo(() => {
    const c = Number(costPrice) || 0;
    const s = Number(salePrice) || 0;
    if (s <= 0) return 0;
    return Math.max(0, Math.min(100, ((s - c) / s) * 100));
  }, [costPrice, salePrice]);

  return (
    <div className="pk-stack">
      <PkKpiRow
        items={[
          { label: 'Referencias Activas', value: String(state.products.length) },
          { label: 'Costo en Bodega', value: formatCop(metrics.costVal) },
          { label: 'Potencial Comercial', value: formatCop(metrics.saleVal), color: 'var(--pk-emerald)' },
          {
            label: 'Alertas Stock Mínimo',
            value: String(metrics.lowCount),
            color: metrics.lowCount > 0 ? '#b45309' : undefined,
          },
        ]}
      />

      {currentTab === 'productos_stock' && (
        <ModuleGate module="productos_stock">
          <div className="pk-stack">
            <PkLiveHeader
              title="Centro Logístico y Existencias"
              liveLabel="Stock en vivo"
              subtitle="Galería operativa de referencias, semáforo de punto de reorden, valorización ponderada y traslados."
              pills={[
                { key: 'ALL', label: 'Todos', count: state.products.length },
                { key: 'OPTIMAL', label: 'Stock Óptimo', count: metrics.optimalCount },
                { key: 'REORDER', label: 'Alerta Reorden', count: metrics.reorderCount },
                { key: 'OUT', label: 'Agotados', count: metrics.outCount },
              ]}
              activePill={productPill}
              onPillChange={setProductPill}
              displayMode={productDisplayMode}
              onDisplayModeChange={setProductDisplayMode}
              boardLabel="🎛️ Galería de Stock"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Nuevo Producto"
              onPrimaryAction={() => setProductStudioOpen(true)}
              extraActions={
                <>
                  <button type="button" className="pk-btn pk-btn-outline" onClick={exportInventoryCsv}>
                    📥 Exportar CSV
                  </button>
                  <PkPrintButton
                    label="🖨️ Imprimir Inventario Valorizado"
                    payload={inventoryPrintPayload}
                    variant="primary"
                  />
                </>
              }
            />

            <PkDistributionStrip
              title={
                state.warehouses.length > 1
                  ? 'Valorización de Inventario Distribuida por Bodega'
                  : 'Valorización de Inventario por Nivel de Disponibilidad'
              }
              segments={valuationSegments}
            />

            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div
                className="pk-datatable-toolbar"
                style={{ borderBottom: productDisplayMode === 'table' ? undefined : 'none' }}
              >
                <input
                  type="search"
                  className="pk-input pk-datatable-search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="🔎 Buscar referencia por SKU, nombre, categoría o lote..."
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 240 }}>
                    <PkSimpleSelect
                      ariaLabel="Filtrar por bodega"
                      value={warehouseFilter}
                      onChange={setWarehouseFilter}
                      allowClear
                      placeholder="Todas las bodegas"
                      options={[
                        { value: '', label: 'Todas las bodegas' },
                        ...state.warehouses.map((w) => ({
                          value: w.id,
                          label: `${w.code} — ${w.name}`,
                          sublabel: w.location,
                        })),
                      ]}
                    />
                  </div>
                  <span className="pk-badge pk-badge-slate">{filteredProducts.length} referencias</span>
                </div>
              </div>

              {productDisplayMode === 'table' && (
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Producto</th>
                          <th>Bodega</th>
                          <th className="num">Stock</th>
                          <th className="num">Costo Prom.</th>
                          <th className="num">Precio Venta</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((p) => {
                          const isLow = p.stock <= p.minStock;
                          return (
                            <tr key={p.id}>
                              <td>
                                <strong>{p.code}</strong>
                              </td>
                              <td>
                                <div style={{ fontWeight: 700 }}>{p.name}</div>
                                <small style={{ opacity: 0.75 }}>
                                  {p.category}
                                  {p.lotCode ? ` · Lote ${p.lotCode}` : ''}
                                </small>
                              </td>
                              <td>{p.warehouseName}</td>
                              <td className="num">
                                <strong>{p.stock}</strong>
                                {isLow && (
                                  <FeatureGate module="productos_stock" feature="alerta_stock_minimo">
                                    <span className="pk-badge pk-badge-amber" style={{ marginLeft: 8 }}>
                                      Bajo Mínimo ({p.minStock})
                                    </span>
                                  </FeatureGate>
                                )}
                              </td>
                              <td className="num">{formatCop(p.costPrice)}</td>
                              <td className="num">{formatCop(p.salePrice)}</td>
                              <td>
                                <div className="pk-row-actions">
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-outline pk-btn-sm"
                                    disabled={busy || p.stock <= 0}
                                    onClick={() => handleDelta(p, -1)}
                                  >
                                    -1
                                  </button>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-outline pk-btn-sm"
                                    disabled={busy}
                                    onClick={() => handleDelta(p, 1)}
                                  >
                                    +1
                                  </button>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-outline pk-btn-sm"
                                    onClick={() => openRestockModal(p)}
                                  >
                                    Surtir
                                  </button>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-outline pk-btn-sm"
                                    onClick={() => openTransferModal(p)}
                                  >
                                    Trasladar
                                  </button>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-danger pk-btn-sm"
                                    onClick={() => setDeleteTarget(p)}
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredProducts.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              No se encontraron referencias para el filtro seleccionado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {productDisplayMode === 'board' && (
              <>
                {filteredProducts.length === 0 ? (
                  <div className="pk-kanban-empty">
                    No existen productos que coincidan con el estado de existencias o búsqueda actual.
                  </div>
                ) : (
                  <div className="pk-cards-showcase">
                    {filteredProducts.map((p) => {
                      const isOut = p.stock <= 0;
                      const isLow = p.stock > 0 && p.stock <= p.minStock;
                      const targetMax = Math.max(p.minStock * 2, 10);
                      const stockPct = isOut ? 0 : Math.min(100, (p.stock / targetMax) * 100);
                      const barTone: 'emerald' | 'amber' | 'rose' = isOut
                        ? 'rose'
                        : isLow
                        ? 'amber'
                        : 'emerald';

                      return (
                        <PkTicketCard
                          key={p.id}
                          code={p.code}
                          timeAgo={
                            p.lotCode
                              ? `Lote ${p.lotCode}${p.expiryDate ? ` · Vence ${p.expiryDate}` : ''}`
                              : `IVA ${p.taxPct}%`
                          }
                          channelBadge={{
                            label: `${p.category || 'General'} · ${p.warehouseName || 'Bodega'}`,
                            tone: isOut ? 'coral' : isLow ? 'amber' : 'blue',
                          }}
                          title={p.name}
                          subtitle={
                            p.supplierName
                              ? `Proveedor habitual: ${p.supplierName}`
                              : `Costo promedio: ${formatCop(p.costPrice)}`
                          }
                          items={[
                            { name: 'Costo Unitario Promedio', amount: formatCop(p.costPrice) },
                            {
                              name: 'Capital en Existencias',
                              amount: formatCop(Math.max(0, p.stock) * p.costPrice),
                            },
                          ]}
                          extraBody={
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <PkProgressBar
                                label="Stock actual vs Mínimo"
                                valueLabel={`${p.stock} uds / Mín ${p.minStock}`}
                                pct={stockPct}
                                tone={barTone}
                              />
                              {(isLow || isOut) && (
                                <FeatureGate module="productos_stock" feature="alerta_stock_minimo">
                                  <span
                                    className={`pk-badge ${isOut ? 'pk-badge-rose' : 'pk-badge-amber'}`}
                                    style={{ alignSelf: 'flex-start' }}
                                  >
                                    {isOut
                                      ? 'Sin existencias disponibles'
                                      : `Punto de reorden alcanzado (${p.minStock} uds)`}
                                  </span>
                                </FeatureGate>
                              )}
                            </div>
                          }
                          totalLabel="PRECIO VENTA"
                          totalValue={formatCop(p.salePrice)}
                          statusPill={{
                            label: isOut ? 'Agotado' : isLow ? 'Alerta Reorden' : 'Stock Óptimo',
                            tone: isOut ? 'rose' : isLow ? 'amber' : 'emerald',
                          }}
                          primaryAction={{
                            label: '+ Entrada Stock',
                            tone: isOut ? 'coral' : isLow ? 'amber' : 'emerald',
                            onClick: () => openRestockModal(p),
                            disabled: busy,
                          }}
                          secondaryActions={
                            <>
                              <div className="pk-row-actions">
                                <button
                                  type="button"
                                  className="pk-btn pk-btn-outline pk-btn-sm"
                                  onClick={() => openTransferModal(p)}
                                  disabled={busy}
                                >
                                  ⇄ Traslado Bodega
                                </button>
                                <button
                                  type="button"
                                  className="pk-btn pk-btn-outline pk-btn-sm"
                                  disabled={busy || p.stock <= 0}
                                  onClick={() => handleDelta(p, -1)}
                                >
                                  -1
                                </button>
                                <button
                                  type="button"
                                  className="pk-btn pk-btn-outline pk-btn-sm"
                                  disabled={busy}
                                  onClick={() => handleDelta(p, 1)}
                                >
                                  +1
                                </button>
                              </div>
                              <button
                                type="button"
                                className="pk-btn pk-btn-danger pk-btn-sm"
                                onClick={() => setDeleteTarget(p)}
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
              </>
            )}
          </div>
        </ModuleGate>
      )}

      {currentTab === 'bodegas_traslados' && (
        <ModuleGate module="bodegas_traslados">
          <div className="pk-stack">
            <PkLiveHeader
              title="Red de Bodegas y Centros de Almacenamiento"
              liveLabel="Almacenes en línea"
              subtitle="Distribución física de mercancías, responsables de custodia y ocupación valorizada por centro."
              displayMode={warehouseDisplayMode}
              onDisplayModeChange={setWarehouseDisplayMode}
              boardLabel="🎛️ Tarjetas de Bodega"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Nueva Bodega"
              onPrimaryAction={() => setWhModalOpen(true)}
            />

            {warehouseDisplayMode === 'board' ? (
              <div className="pk-cards-showcase">
                {state.warehouses.map((w) => {
                  const whProducts = state.products.filter((p) => p.warehouseId === w.id);
                  const whUnits = whProducts.reduce((acc, p) => acc + Math.max(0, p.stock), 0);
                  const whValue = whProducts.reduce(
                    (acc, p) => acc + Math.max(0, p.stock) * p.costPrice,
                    0
                  );
                  const sharePct = metrics.costVal > 0 ? (whValue / metrics.costVal) * 100 : 0;

                  return (
                    <PkTicketCard
                      key={w.id}
                      code={w.code}
                      channelBadge={{ label: `${whProducts.length} SKUs`, tone: 'blue' }}
                      title={w.name}
                      subtitle={`📍 ${w.location || 'Ubicación principal'}`}
                      metaLine={`👤 Responsable: ${w.manager || 'Administración General'}`}
                      items={[
                        { name: 'Unidades Almacenadas', amount: `${whUnits} uds` },
                        { name: 'Referencias Vinculadas', amount: String(whProducts.length) },
                      ]}
                      extraBody={
                        <PkProgressBar
                          label="Participación en Capital de Inventario"
                          valueLabel={`${Math.round(sharePct)}%`}
                          pct={sharePct}
                          tone="blue"
                        />
                      }
                      totalLabel="VALORIZADO BODEGA"
                      totalValue={formatCop(whValue)}
                      statusPill={{ label: 'Centro Operativo Activo', tone: 'emerald' }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">🏢 Bodegas y Centros de Almacenamiento</div>
                </div>
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Nombre de Bodega</th>
                          <th>Ubicación</th>
                          <th>Responsable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.warehouses.map((w) => (
                          <tr key={w.id}>
                            <td>
                              <strong>{w.code}</strong>
                            </td>
                            <td>{w.name}</td>
                            <td>{w.location}</td>
                            <td>{w.manager || 'Administración General'}</td>
                          </tr>
                        ))}
                        {state.warehouses.length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              No hay bodegas registradas todavía.
                            </td>
                          </tr>
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

      {currentTab === 'kardex_lotes' && (
        <ModuleGate module="kardex_lotes">
          <div className="pk-stack">
            <PkLiveHeader
              title="Auditoría Kardex Valorizado y Trazabilidad"
              liveLabel="Kardex continuo"
              subtitle="Secuencia cronológica de entradas, despachos, ajustes de inventario y traslados inter-bodega."
              pills={[
                { key: 'ALL', label: 'Todos', count: state.kardex.length },
                {
                  key: 'IN',
                  label: 'Entradas / Ingresos',
                  count: state.kardex.filter((k) => classifyKardex(k.type) === 'IN').length,
                },
                {
                  key: 'OUT',
                  label: 'Salidas / Consumos',
                  count: state.kardex.filter((k) => classifyKardex(k.type) === 'OUT').length,
                },
                {
                  key: 'TRANSFER',
                  label: 'Traslados',
                  count: state.kardex.filter((k) => classifyKardex(k.type) === 'TRANSFER').length,
                },
              ]}
              activePill={kardexPill}
              onPillChange={setKardexPill}
              displayMode={kardexDisplayMode}
              onDisplayModeChange={setKardexDisplayMode}
              boardLabel="🎛️ Línea de Tiempo"
              tableLabel="📋 Libro Kardex"
            />

            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div
                className="pk-datatable-toolbar"
                style={{ borderBottom: kardexDisplayMode === 'table' ? undefined : 'none' }}
              >
                <input
                  type="search"
                  className="pk-input pk-datatable-search"
                  value={kardexSearch}
                  onChange={(e) => setKardexSearch(e.target.value)}
                  placeholder="🔎 Buscar movimiento por SKU, producto, tipo o documento referencia..."
                />
                <span className="pk-badge pk-badge-slate">{filteredKardex.length} movimientos</span>
              </div>

              {kardexDisplayMode === 'table' && (
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo Movimiento</th>
                          <th>Producto</th>
                          <th>Bodega</th>
                          <th className="num">Cantidad</th>
                          <th className="num">Costo Unitario</th>
                          <th className="num">Saldo</th>
                          <th>Referencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredKardex.map((k) => (
                          <tr key={k.id}>
                            <td>{k.date}</td>
                            <td>
                              <strong>{k.type}</strong>
                            </td>
                            <td>
                              {k.productCode} — {k.productName}
                            </td>
                            <td>{k.warehouseName}</td>
                            <td className="num">{k.qty}</td>
                            <td className="num">{formatCop(k.unitCost)}</td>
                            <td className="num">
                              <strong>{k.balanceAfter}</strong>
                            </td>
                            <td>{k.reference}</td>
                          </tr>
                        ))}
                        {filteredKardex.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              No se encontraron movimientos de Kardex para el criterio consultado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {kardexDisplayMode === 'board' && (
              <>
                {filteredKardex.length === 0 ? (
                  <div className="pk-kanban-empty">
                    No existen registros en la línea de tiempo de Kardex para el filtro actual.
                  </div>
                ) : (
                  <div className="pk-cards-showcase">
                    {filteredKardex.map((k) => {
                      const kind = classifyKardex(k.type);
                      return (
                        <PkTicketCard
                          key={k.id}
                          code={k.productCode}
                          timeAgo={k.date}
                          channelBadge={{
                            label: k.type,
                            tone: kind === 'IN' ? 'emerald' : kind === 'TRANSFER' ? 'purple' : 'amber',
                          }}
                          title={k.productName}
                          subtitle={`🏢 ${k.warehouseName} · Ref: ${k.reference || 'Control interno'}`}
                          items={[
                            { name: 'Unidades Movidas', amount: `${k.qty}` },
                            { name: 'Costo Unitario Ponderado', amount: formatCop(k.unitCost) },
                          ]}
                          processNodes={[
                            { step: 1, label: 'Registro', sublabel: k.date.slice(0, 10), status: 'done' },
                            { step: 2, label: k.type, sublabel: `${k.qty} uds`, status: 'done' },
                            { step: 3, label: 'Saldo Final', sublabel: `${k.balanceAfter} uds`, status: 'done' },
                          ]}
                          totalLabel="SALDO POSTERIOR"
                          totalValue={`${k.balanceAfter} uds`}
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

      {currentTab === 'solicitudes_insumos' && (
        <ModuleGate module="solicitudes_insumos">
          <div className="pk-stack">
            <PkLiveHeader
              title="Requisiciones Internas de Insumos"
              liveLabel="Despachos internos"
              subtitle="Solicitudes operativas de materiales por área funcional con trazabilidad de entrega."
              pills={[
                { key: 'ALL', label: 'Todas', count: state.requests.length },
                {
                  key: 'PENDING',
                  label: 'En Proceso / Pendientes',
                  count: state.requests.filter((r) =>
                    /pend|solicit|abiert/i.test(r.status || '')
                  ).length,
                },
                {
                  key: 'DONE',
                  label: 'Atendidas',
                  count: state.requests.filter(
                    (r) => !/pend|solicit|abiert/i.test(r.status || '')
                  ).length,
                },
              ]}
              activePill={requestPill}
              onPillChange={setRequestPill}
              displayMode={requestDisplayMode}
              onDisplayModeChange={setRequestDisplayMode}
              boardLabel="🎛️ Tablero de Solicitudes"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Nueva Solicitud"
              onPrimaryAction={() => setRequestStudioOpen(true)}
            />

            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div
                className="pk-datatable-toolbar"
                style={{ borderBottom: requestDisplayMode === 'table' ? undefined : 'none' }}
              >
                <input
                  type="search"
                  className="pk-input pk-datatable-search"
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                  placeholder="🔎 Filtrar requisición por consecutivo, área solicitante o insumo..."
                />
                <span className="pk-badge pk-badge-slate">{filteredRequests.length} solicitudes</span>
              </div>

              {requestDisplayMode === 'table' && (
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Fecha</th>
                          <th>Área</th>
                          <th>Insumo</th>
                          <th className="num">Cantidad</th>
                          <th>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRequests.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{r.code}</strong>
                            </td>
                            <td>{r.date}</td>
                            <td>{r.area}</td>
                            <td>{r.productName}</td>
                            <td className="num">{r.qty}</td>
                            <td>
                              <span className="pk-badge pk-badge-blue">{r.status}</span>
                            </td>
                          </tr>
                        ))}
                        {filteredRequests.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              No existen requisiciones registradas para el filtro actual.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {requestDisplayMode === 'board' && (
              <PkKanbanBoard
                columns={[
                  {
                    key: 'req_open',
                    title: 'Solicitudes Registradas / En Alistamiento',
                    dotColor: 'amber',
                    count: filteredRequests.filter((r) => /pend|solicit|abiert/i.test(r.status || '')).length,
                    emptyText: 'Sin requisiciones pendientes de alistamiento',
                    children: filteredRequests
                      .filter((r) => /pend|solicit|abiert/i.test(r.status || ''))
                      .map((r) => (
                        <PkTicketCard
                          key={r.id}
                          code={r.code}
                          timeAgo={r.date}
                          channelBadge={{ label: r.area, tone: 'amber' }}
                          title={r.productName}
                          items={[{ qty: r.qty, name: r.productName }]}
                          highlightNote={r.notes || undefined}
                          statusPill={{ label: r.status || 'Solicitada', tone: 'amber' }}
                        />
                      )),
                  },
                  {
                    key: 'req_dispatched',
                    title: 'Despachadas / Procesadas en Almacén',
                    dotColor: 'emerald',
                    count: filteredRequests.filter((r) => !/pend|solicit|abiert/i.test(r.status || '')).length,
                    emptyText: 'Sin requisiciones procesadas en este filtro',
                    children: filteredRequests
                      .filter((r) => !/pend|solicit|abiert/i.test(r.status || ''))
                      .map((r) => (
                        <PkTicketCard
                          key={r.id}
                          code={r.code}
                          timeAgo={r.date}
                          channelBadge={{ label: r.area, tone: 'emerald' }}
                          title={r.productName}
                          items={[{ qty: r.qty, name: r.productName }]}
                          highlightNote={r.notes || undefined}
                          statusPill={{ label: r.status || 'Atendida', tone: 'emerald' }}
                        />
                      )),
                  },
                ]}
              />
            )}
          </div>
        </ModuleGate>
      )}

      <PkFullscreenDialog
        open={productStudioOpen}
        title="Estudio Maestro de Alta de Producto y Existencias"
        subtitle="Configura la ficha logística, costo inicial, punto de reorden y trazabilidad según la naturaleza del ítem."
        badge={{ label: state.nextProductCode, tone: 'blue' }}
        onClose={() => setProductStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="Naturaleza Logística de la Referencia"
            options={PRODUCT_NATURE_OPTIONS}
            value={productNature}
            onChange={handleProductNatureChange}
          />
        }
        footerLeft={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span className="pk-badge pk-badge-blue">{state.nextProductCode}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              Capital inicial en bodega:{' '}
              {formatCop((Number(stock) || 0) * (Number(costPrice) || 0))}
            </span>
          </div>
        }
        footerActions={
          <>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setProductStudioOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pk-fs-product-form"
              className="pk-btn pk-btn-primary"
              disabled={busy}
            >
              {busy ? 'Guardando...' : '💾 Guardar Referencia en Almacén'}
            </button>
          </>
        }
      >
        <form id="pk-fs-product-form" onSubmit={handleCreateProduct} className="pk-stack">
          <div className="pk-card" style={{ overflow: 'visible' }}>
            <div className="pk-card-head">
              <div className="pk-card-title">
                {productNature === 'INSUMO'
                  ? '🧪 Identificación del Insumo Operativo y Almacén'
                  : productNature === 'KIT'
                  ? '🛠️ Definición del Kit / Referencia Comercial'
                  : '📦 Identificación de Mercancía y Ubicación en Bodega'}
              </div>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid">
                <PkAutoCodeInput label="Código SKU" value={state.nextProductCode} />

                <div className="pk-field">
                  <label>Categoría / Familia</label>
                  <input value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>

                <PkSelect
                  label="Bodega Asignada"
                  items={state.warehouses}
                  value={warehouseId}
                  onChange={setWarehouseId}
                  getValue={(w) => w.id}
                  getLabel={(w) => `${w.code} — ${w.name}`}
                  onCreateNew={() => setWhModalOpen(true)}
                  createLabel="+ Bodega"
                  searchable
                />

                <div className="pk-field pk-col-span-2">
                  <label>Nombre Oficial del Producto o Referencia *</label>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      productNature === 'INSUMO'
                        ? 'Ej. Desengrasante Biodegradable Galón'
                        : productNature === 'KIT'
                        ? 'Ej. Kit Mantenimiento Preventivo 10.000 Km'
                        : 'Ej. Filtro de Aire Industrial Alta Eficiencia'
                    }
                  />
                </div>

                {suppliers.length > 0 && (
                  <PkSelect
                    label="Proveedor Habitual"
                    items={suppliers}
                    value={supplierId}
                    onChange={setSupplierId}
                    getValue={(s) => s.id}
                    getLabel={(s) => s.name}
                    emptyLabel="Sin proveedor asignado"
                    searchable
                  />
                )}
              </div>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">💰 Estructura de Costos, Tarifas y Punto de Reorden</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid">
                <div className="pk-field">
                  <label>Costo Unitario (COP)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                  />
                </div>

                {productNature !== 'INSUMO' && (
                  <div className="pk-field">
                    <label>Precio Venta Comercial (COP)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                    />
                  </div>
                )}

                <div className="pk-field">
                  <label>IVA (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={taxPct}
                    onChange={(e) => setTaxPct(e.target.value)}
                  />
                </div>

                <div className="pk-field">
                  <label>Existencia Inicial</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>

                <div className="pk-field">
                  <label>Stock Mínimo (Alerta Reorden)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                  />
                </div>

                {productNature !== 'KIT' && (
                  <>
                    <div className="pk-field">
                      <label>Código de Lote</label>
                      <input
                        value={lotCode}
                        onChange={(e) => setLotCode(e.target.value)}
                        placeholder="Ej. LT-2026"
                      />
                    </div>

                    <div className="pk-field">
                      <label>Fecha de Vencimiento</label>
                      <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                    </div>
                  </>
                )}

                {productNature !== 'INSUMO' && Number(salePrice) > 0 && (
                  <div className="pk-col-span-full">
                    <PkProgressBar
                      label="Margen Bruto Comercial Estimado"
                      valueLabel={`${previewMarginPct.toFixed(1)}% sobre precio de venta`}
                      pct={previewMarginPct}
                      tone={previewMarginPct >= 25 ? 'emerald' : previewMarginPct >= 10 ? 'blue' : 'amber'}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </PkFullscreenDialog>

      <PkFullscreenDialog
        open={requestStudioOpen}
        title="Estudio de Requisición Interna de Insumos"
        subtitle="Genera órdenes de alistamiento y entrega interna para áreas operativas con descuento controlado."
        badge={{ label: state.nextRequestCode, tone: 'amber' }}
        onClose={() => setRequestStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="Centro Solicitante de Materiales"
            options={REQUEST_ORIGIN_OPTIONS}
            value={requestOrigin}
            onChange={handleRequestOriginChange}
          />
        }
        footerLeft={
          <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
            Requisición {state.nextRequestCode} · Destino: {reqArea}
          </span>
        }
        footerActions={
          <>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setRequestStudioOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pk-fs-request-form"
              className="pk-btn pk-btn-primary"
              disabled={busy}
            >
              {busy ? 'Guardando...' : '💾 Emitir Requisición Interna'}
            </button>
          </>
        }
      >
        <form id="pk-fs-request-form" onSubmit={handleCreateRequest} className="pk-stack">
          <div className="pk-card" style={{ overflow: 'visible' }}>
            <div className="pk-card-head">
              <div className="pk-card-title">📝 Detalle del Material Solicitado a Almacén</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid cols-2">
                <PkAutoCodeInput label="Consecutivo" value={state.nextRequestCode} />
                <div className="pk-field">
                  <label>Área o Frente Solicitante *</label>
                  <input required value={reqArea} onChange={(e) => setReqArea(e.target.value)} />
                </div>
                <PkSelect
                  label="Insumo o Referencia Requerida *"
                  items={state.products}
                  value={reqProductId}
                  onChange={setReqProductId}
                  getValue={(p) => p.id}
                  getLabel={(p) => `${p.code} — ${p.name} (Disp: ${p.stock})`}
                  searchable
                />
                <div className="pk-field">
                  <label>Cantidad Requerida *</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={reqQty}
                    onChange={(e) => setReqQty(e.target.value)}
                  />
                </div>
                <div className="pk-field pk-col-span-full">
                  <label>Observaciones / Orden de Trabajo Destino</label>
                  <input
                    value={reqNotes}
                    onChange={(e) => setReqNotes(e.target.value)}
                    placeholder="Justificación operativa o centro de costo destino"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </PkFullscreenDialog>

      <PkModal open={whModalOpen} title="🏢 Crear Bodega de Almacenamiento" onClose={() => setWhModalOpen(false)}>
        <form onSubmit={handleCreateWarehouse} className="pk-form-grid cols-2">
          <PkAutoCodeInput label="Código Bodega" value={state.nextWarehouseCode} />
          <div className="pk-field">
            <label>Responsable</label>
            <input value={whManager} onChange={(e) => setWhManager(e.target.value)} placeholder="Ej: Jefe de Almacén" />
          </div>
          <div className="pk-field pk-col-span-full">
            <label>Nombre de la Bodega *</label>
            <input required value={whName} onChange={(e) => setWhName(e.target.value)} placeholder="Ej: Bodega Central" />
          </div>
          <div className="pk-field pk-col-span-full">
            <label>Ciudad / Dirección</label>
            <input
              value={whLocation}
              onChange={(e) => setWhLocation(e.target.value)}
              placeholder="Ej: Zona Industrial Montevideo"
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setWhModalOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              {busy ? 'Guardando...' : 'Guardar Bodega'}
            </button>
          </div>
        </form>
      </PkModal>

      <PkModal
        open={Boolean(restockTarget)}
        title={`📥 Entrada de Stock — ${restockTarget?.name || ''}`}
        onClose={() => setRestockTarget(null)}
      >
        <form onSubmit={handleRestockSubmit} className="pk-form-grid cols-2">
          <div className="pk-field">
            <label>Cantidad a Ingresar *</label>
            <input
              type="number"
              min="0.01"
              step="any"
              required
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
            />
          </div>
          <div className="pk-field">
            <label>Costo Unitario de Entrada (COP)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={restockCost}
              onChange={(e) => setRestockCost(e.target.value)}
            />
          </div>
          <div className="pk-field">
            <label>Lote</label>
            <input value={restockLot} onChange={(e) => setRestockLot(e.target.value)} />
          </div>
          <div className="pk-field">
            <label>Fecha de Vencimiento</label>
            <input type="date" value={restockExp} onChange={(e) => setRestockExp(e.target.value)} />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setRestockTarget(null)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              {busy ? 'Procesando...' : 'Confirmar Ingreso'}
            </button>
          </div>
        </form>
      </PkModal>

      <PkModal
        open={Boolean(transferTarget)}
        title={`⇄ Trasladar entre Bodegas — ${transferTarget?.name || ''}`}
        onClose={() => setTransferTarget(null)}
      >
        <form onSubmit={handleTransferSubmit} className="pk-form-grid cols-2">
          <PkSelect
            label="Bodega Destino"
            items={state.warehouses.filter((w) => w.id !== transferTarget?.warehouseId)}
            value={transferWhId}
            onChange={setTransferWhId}
            getValue={(w) => w.id}
            getLabel={(w) => `${w.code} — ${w.name}`}
            searchable
          />
          <div className="pk-field">
            <label>Cantidad a Trasladar *</label>
            <input
              type="number"
              min="0.01"
              step="any"
              required
              value={transferQty}
              onChange={(e) => setTransferQty(e.target.value)}
            />
          </div>
          <div className="pk-field pk-col-span-full">
            <label>Nota de Remisión</label>
            <input
              value={transferNote}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="Motivo del traslado o documento soporte"
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setTransferTarget(null)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              {busy ? 'Procesando...' : 'Ejecutar Traslado'}
            </button>
          </div>
        </form>
      </PkModal>

      <PkConfirmModal
        open={Boolean(deleteTarget)}
        title="Eliminar Referencia de Inventario"
        message={`¿Confirma la eliminación permanente del producto "${deleteTarget?.name || ''}" (${deleteTarget?.code || ''})?`}
        confirmLabel="Eliminar Producto"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
        busy={busy}
      />
    </div>
  );
};

export default InventarioView;
