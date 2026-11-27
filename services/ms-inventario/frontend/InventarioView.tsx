import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  downloadCsvUtf8,
  FeatureGate,
  formatCop,
  ModuleGate,
  PkAutoCodeInput,
  PkConfirmModal,
  PkKpiRow,
  PkModal,
  PkPrintButton,
  PkSelect,
  PkSimpleSelect,
  PkViewSwitcher,
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

  const [productViewMode, setProductViewMode] = useState<'list' | 'create'>('list');
  const [requestViewMode, setRequestViewMode] = useState<'list' | 'create'>('list');

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
      setRequestViewMode('create');
    } else if (currentTab === 'productos_stock') {
      setProductViewMode('create');
    }
    clearIncomingPayload();
  }, [incomingPayload, currentTab, clearIncomingPayload]);

  const metrics = useMemo(() => {
    let costVal = 0;
    let saleVal = 0;
    let lowCount = 0;
    for (const p of state.products) {
      costVal += p.stock * p.costPrice;
      saleVal += p.stock * p.salePrice;
      if (p.stock <= p.minStock) {
        lowCount += 1;
      }
    }
    return { costVal, saleVal, lowCount };
  }, [state.products]);

  const filteredProducts = useMemo(() => {
    return state.products.filter((p) => {
      if (warehouseFilter && p.warehouseId !== warehouseFilter) return false;
      const q = productSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.lotCode || '').toLowerCase().includes(q)
      );
    });
  }, [state.products, warehouseFilter, productSearch]);

  const filteredKardex = useMemo(() => {
    const q = kardexSearch.trim().toLowerCase();
    if (!q) return state.kardex;
    return state.kardex.filter(
      (k) =>
        k.productCode.toLowerCase().includes(q) ||
        k.productName.toLowerCase().includes(q) ||
        k.type.toLowerCase().includes(q) ||
        (k.reference || '').toLowerCase().includes(q)
    );
  }, [state.kardex, kardexSearch]);

  const filteredRequests = useMemo(() => {
    const q = requestSearch.trim().toLowerCase();
    if (!q) return state.requests;
    return state.requests.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.area.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q)
    );
  }, [state.requests, requestSearch]);

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const selectedSup = suppliers.find((s) => s.id === supplierId);
      await apiPost('/api/v1/inventario/products', {
        name,
        category,
        warehouseId,
        supplierId,
        supplierName: selectedSup?.name || '',
        costPrice: Number(costPrice) || 0,
        salePrice: Number(salePrice) || 0,
        taxPct: Number(taxPct) || 0,
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 0,
        lotCode,
        expiryDate,
      });
      setName('');
      setCostPrice('0');
      setSalePrice('0');
      setStock('0');
      setLotCode('');
      setExpiryDate('');
      setProductViewMode('list');
      toast('Producto registrado en inventario');
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
      setRequestViewMode('list');
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

  return (
    <div className="pk-stack">
      <PkKpiRow
        items={[
          { label: 'Referencias Activas', value: String(state.products.length) },
          { label: 'Costo en Bodega', value: formatCop(metrics.costVal) },
          { label: 'Potencial Comercial', value: formatCop(metrics.saleVal) },
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
            <PkViewSwitcher
              title="Catálogo Maestro de Existencias"
              subtitle="Administra referencias de inventario, costos ponderados, lotes y niveles mínimos de reposición."
              mode={productViewMode}
              onModeChange={setProductViewMode}
              listLabel="📦 Catálogo de Productos"
              createLabel="+ Nueva Referencia"
              count={state.products.length}
              extraActions={
                productViewMode === 'list' ? (
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
                ) : undefined
              }
            />

            {productViewMode === 'create' ? (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📦 Alta de Referencia de Inventario</div>
                  <span className="pk-badge pk-badge-blue">{state.nextProductCode}</span>
                </div>
                <div className="pk-card-body">
                  <form onSubmit={handleCreateProduct} className="pk-form-grid cols-2">
                    <PkAutoCodeInput label="Código SKU" value={state.nextProductCode} />

                    <div className="pk-field">
                      <label>Categoría</label>
                      <input value={category} onChange={(e) => setCategory(e.target.value)} />
                    </div>

                    <div className="pk-field pk-col-span-full">
                      <label>Nombre del Producto *</label>
                      <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej. Filtro de Aire Industrial"
                      />
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

                    {suppliers.length > 0 ? (
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
                    ) : (
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
                    )}

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

                    <div className="pk-field">
                      <label>Precio Venta (COP)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value)}
                      />
                    </div>

                    {suppliers.length > 0 && (
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
                    )}

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
                      <label>Stock Mínimo</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={minStock}
                        onChange={(e) => setMinStock(e.target.value)}
                      />
                    </div>

                    <div className="pk-field">
                      <label>Lote</label>
                      <input
                        value={lotCode}
                        onChange={(e) => setLotCode(e.target.value)}
                        placeholder="Ej. LT-2026"
                      />
                    </div>

                    <div className="pk-field">
                      <label>Vencimiento</label>
                      <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                    </div>

                    <div className="pk-form-actions">
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline"
                        onClick={() => setProductViewMode('list')}
                        disabled={busy}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                        {busy ? 'Guardando...' : '💾 Guardar Producto'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📋 Catálogo Maestro de Existencias</div>
                </div>
                <div className="pk-datatable-toolbar">
                  <input
                    type="search"
                    className="pk-input pk-datatable-search"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="🔎 Buscar por SKU, nombre, categoría o lote..."
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
                                    onClick={() => {
                                      setRestockTarget(p);
                                      setRestockQty('10');
                                      setRestockCost(String(p.costPrice));
                                      setRestockLot(p.lotCode || '');
                                      setRestockExp(p.expiryDate || '');
                                    }}
                                  >
                                    Surtir
                                  </button>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-outline pk-btn-sm"
                                    onClick={() => {
                                      setTransferTarget(p);
                                      const other = state.warehouses.find((w) => w.id !== p.warehouseId);
                                      setTransferWhId(other?.id || '');
                                      setTransferQty('1');
                                    }}
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
              </div>
            )}
          </div>
        </ModuleGate>
      )}

      {currentTab === 'bodegas_traslados' && (
        <ModuleGate module="bodegas_traslados">
          <div className="pk-stack">
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🏢 Bodegas y Centros de Almacenamiento</div>
                <button type="button" className="pk-btn pk-btn-primary" onClick={() => setWhModalOpen(true)}>
                  + Nueva Bodega
                </button>
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
          </div>
        </ModuleGate>
      )}

      {currentTab === 'kardex_lotes' && (
        <ModuleGate module="kardex_lotes">
          <div className="pk-stack">
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">📊 Libro Kardex Valorizado</div>
              </div>
              <div className="pk-datatable-toolbar">
                <input
                  type="search"
                  className="pk-input pk-datatable-search"
                  value={kardexSearch}
                  onChange={(e) => setKardexSearch(e.target.value)}
                  placeholder="🔎 Buscar por SKU, producto, tipo de movimiento o referencia..."
                />
                <span className="pk-badge pk-badge-slate">{filteredKardex.length} movimientos</span>
              </div>
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
            </div>
          </div>
        </ModuleGate>
      )}

      {currentTab === 'solicitudes_insumos' && (
        <ModuleGate module="solicitudes_insumos">
          <div className="pk-stack">
            <PkViewSwitcher
              title="Requisiciones Internas de Insumos"
              subtitle="Registra y consulta solicitudes internas de despacho de materiales por área operativa."
              mode={requestViewMode}
              onModeChange={setRequestViewMode}
              listLabel="📋 Solicitudes Registradas"
              createLabel="+ Nueva Solicitud"
              count={state.requests.length}
            />

            {requestViewMode === 'create' ? (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📝 Nueva Requisición Interna de Insumos</div>
                  <span className="pk-badge pk-badge-blue">{state.nextRequestCode}</span>
                </div>
                <div className="pk-card-body">
                  <form onSubmit={handleCreateRequest} className="pk-form-grid cols-2">
                    <PkAutoCodeInput label="Consecutivo" value={state.nextRequestCode} />
                    <div className="pk-field">
                      <label>Área Solicitante *</label>
                      <input required value={reqArea} onChange={(e) => setReqArea(e.target.value)} />
                    </div>
                    <PkSelect
                      label="Insumo Requerido *"
                      items={state.products}
                      value={reqProductId}
                      onChange={setReqProductId}
                      getValue={(p) => p.id}
                      getLabel={(p) => `${p.code} — ${p.name}`}
                      searchable
                    />
                    <div className="pk-field">
                      <label>Cantidad *</label>
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
                      <label>Observaciones</label>
                      <input
                        value={reqNotes}
                        onChange={(e) => setReqNotes(e.target.value)}
                        placeholder="Justificación o centro de costo destino"
                      />
                    </div>
                    <div className="pk-form-actions">
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline"
                        onClick={() => setRequestViewMode('list')}
                        disabled={busy}
                      >
                        Cancelar
                      </button>
                      <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                        {busy ? 'Guardando...' : '💾 Registrar Solicitud'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">📋 Solicitudes Registradas</div>
                </div>
                <div className="pk-datatable-toolbar">
                  <input
                    type="search"
                    className="pk-input pk-datatable-search"
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                    placeholder="🔎 Filtrar por consecutivo, área o insumo..."
                  />
                  <span className="pk-badge pk-badge-slate">{filteredRequests.length} solicitudes</span>
                </div>
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
              </div>
            )}
          </div>
        </ModuleGate>
      )}

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
            <input value={whLocation} onChange={(e) => setWhLocation(e.target.value)} placeholder="Ej: Zona Industrial Montevideo" />
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
        title={`📥 Surtir Mercancía — ${restockTarget?.name || ''}`}
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
        title={`🔄 Trasladar entre Bodegas — ${transferTarget?.name || ''}`}
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
