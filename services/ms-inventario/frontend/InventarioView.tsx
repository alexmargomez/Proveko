import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  FeatureGate,
  PkAutoCodeInput,
  PkEntitySelect,
  PkEntityDialog,
  PkPrintButton,
  PkKpiRow,
  downloadCsvUtf8,
  formatCop,
  Product,
  Warehouse,
  Supplier,
  KardexMovement,
  PrintDocumentPayload,
} from '@proveko/ui-sdk';

interface SupplyRequestRecord {
  id: string;
  createdAt: string;
  moduleKey: string;
  fields: Record<string, string>;
}

interface InventarioAllResponse {
  ok: boolean;
  nextProductCode: string;
  nextWarehouseCode: string;
  nextRequestCode: string;
  products: Product[];
  warehouses: Warehouse[];
  suppliers: Supplier[];
  kardex: KardexMovement[];
  requests: SupplyRequestRecord[];
}

export const InventarioView: React.FC = () => {
  const {
    activeModuleKey,
    apiGet,
    apiPost,
    apiDelete,
    toast,
    openQuickDialog,
    dialogVersion,
    hasFeature,
  } = useProveko();

  const [state, setState] = useState<InventarioAllResponse>({
    ok: true,
    nextProductCode: 'PRD-1011',
    nextWarehouseCode: 'BOD-11',
    nextRequestCode: 'REQ-501',
    products: [],
    warehouses: [],
    suppliers: [],
    kardex: [],
    requests: [],
  });

  const [prodName, setProdName] = useState('');
  const [category, setCategory] = useState('Repuestos e Insumos');
  const [warehouseId, setWarehouseId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [costPrice, setCostPrice] = useState('45000');
  const [salePrice, setSalePrice] = useState('79000');
  const [taxPct, setTaxPct] = useState('19');
  const [initialStock, setInitialStock] = useState('10');
  const [minStock, setMinStock] = useState('5');
  const [lotCode, setLotCode] = useState('LT-2026');
  const [expiryDate, setExpiryDate] = useState('2028-12-31');
  const [searchTerm, setSearchTerm] = useState('');

  const [restockTarget, setRestockTarget] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('12');
  const [restockCost, setRestockCost] = useState('');
  const [restockLot, setRestockLot] = useState('');
  const [restockExpiry, setRestockExpiry] = useState('');

  const [transferTarget, setTransferTarget] = useState<Product | null>(null);
  const [transferWhId, setTransferWhId] = useState('');
  const [transferQty, setTransferQty] = useState('1');
  const [transferNote, setTransferNote] = useState('');

  const [whName, setWhName] = useState('');
  const [whCity, setWhCity] = useState('Bogotá D.C.');
  const [whManager, setWhManager] = useState('');

  const [reqProductId, setReqProductId] = useState('');
  const [reqWarehouseId, setReqWarehouseId] = useState('');
  const [reqQty, setReqQty] = useState('5');
  const [reqRequester, setReqRequester] = useState('');
  const [reqPriority, setReqPriority] = useState('Normal');
  const [reqNotes, setReqNotes] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const res = await apiGet<InventarioAllResponse>('/api/v1/inventario/all');
      setState(res);
      if (!warehouseId && res.warehouses.length > 0) setWarehouseId(res.warehouses[0].id);
      if (!supplierId && res.suppliers.length > 0) setSupplierId(res.suppliers[0].id);
      if (!reqProductId && res.products.length > 0) setReqProductId(res.products[0].id);
      if (!reqWarehouseId && res.warehouses.length > 0) setReqWarehouseId(res.warehouses[0].id);
    } catch {
    }
  }, [apiGet, warehouseId, supplierId, reqProductId, reqWarehouseId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll, dialogVersion]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/inventario/products', {
      name: prodName,
      category,
      warehouseId,
      supplierId,
      costPrice: Number(costPrice || 0),
      salePrice: Number(salePrice || 0),
      taxPct: Number(taxPct || 0),
      stock: Number(initialStock || 0),
      minStock: Number(minStock || 0),
      lotCode,
      expiryDate,
    });
    toast('Producto creado con saldo inicial en Kardex');
    setProdName('');
    await loadAll();
  };

  const handleDeleteProduct = async (id: string) => {
    await apiDelete(`/api/v1/inventario/products/${id}`);
    toast('Producto eliminado del catálogo');
    await loadAll();
  };

  const handleDeltaStock = async (id: string, delta: number) => {
    await apiPost(`/api/v1/inventario/products/${id}/delta`, { delta });
    await loadAll();
  };

  const openRestockModal = (p: Product) => {
    setRestockTarget(p);
    setRestockQty('10');
    setRestockCost(String(p.costPrice));
    setRestockLot(p.lotCode || 'LT-2026');
    setRestockExpiry(p.expiryDate || '2028-12-31');
  };

  const handleConfirmRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockTarget) return;
    await apiPost(`/api/v1/inventario/products/${restockTarget.id}/restock`, {
      qty: Number(restockQty || 0),
      unitCost: Number(restockCost || 0),
      lotCode: restockLot,
      expiryDate: restockExpiry,
    });
    toast(`Entrada de almacén registrada para ${restockTarget.name}`);
    setRestockTarget(null);
    await loadAll();
  };

  const openTransferModal = (p: Product) => {
    setTransferTarget(p);
    const otherWh = state.warehouses.find((w) => w.id !== p.warehouseId);
    setTransferWhId(otherWh ? otherWh.id : p.warehouseId);
    setTransferQty(String(p.stock > 0 ? 1 : 0));
    setTransferNote('');
  };

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTarget) return;
    await apiPost(`/api/v1/inventario/products/${transferTarget.id}/transfer`, {
      targetWarehouseId: transferWhId,
      qty: Number(transferQty || 0),
      note: transferNote,
    });
    toast('Traslado entre bodegas registrado en Kardex');
    setTransferTarget(null);
    await loadAll();
  };

  const handleCreateWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/inventario/warehouses', {
      name: whName,
      city: whCity,
      manager: whManager,
    });
    toast('Bodega creada correctamente');
    setWhName('');
    setWhManager('');
    await loadAll();
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/inventario/requests', {
      productId: reqProductId,
      warehouseId: reqWarehouseId,
      qty: Number(reqQty || 1),
      requester: reqRequester,
      priority: reqPriority,
      notes: reqNotes,
    });
    toast('Solicitud interna de insumos generada');
    setReqNotes('');
    await loadAll();
  };

  const getWarehouseName = (id: string) => state.warehouses.find((w) => w.id === id)?.name || id || 'Principal';

  const totalInventoryCost = state.products.reduce((acc, p) => acc + p.stock * p.costPrice, 0);
  const totalInventorySale = state.products.reduce((acc, p) => acc + p.stock * p.salePrice, 0);
  const lowStockProducts = state.products.filter((p) => p.stock <= p.minStock);

  if (activeModuleKey === 'bodegas_traslados') {
    return (
      <div>
        <PkKpiRow
          items={[
            { label: 'Bodegas Activas', value: String(state.warehouses.length) },
            { label: 'Referencias Totales', value: String(state.products.length) },
            { label: 'Valor Total Valorizado', value: formatCop(totalInventoryCost), color: 'var(--pk-emerald)' },
          ]}
        />

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">🏭 Crear Nueva Bodega o Centro de Distribución</div>
          </div>
          <div className="pk-card-body">
            <form onSubmit={handleCreateWarehouse} className="pk-form-grid">
              <PkAutoCodeInput label="Código Bodega" value={state.nextWarehouseCode} />
              <div className="pk-field">
                <label>Nombre de la Bodega *</label>
                <input
                  required
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder="Ej: Bodega Regional Occidente"
                />
              </div>
              <div className="pk-field">
                <label>Ciudad / Sede</label>
                <input value={whCity} onChange={(e) => setWhCity(e.target.value)} />
              </div>
              <div className="pk-field">
                <label>Responsable / Jefe de Almacén</label>
                <input
                  value={whManager}
                  onChange={(e) => setWhManager(e.target.value)}
                  placeholder="Nombre del encargado"
                />
              </div>
              <div className="pk-field">
                <button type="submit" className="pk-btn pk-btn-primary">
                  💾 Guardar Bodega
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">📦 Existencias Consolidadas por Bodega</div>
          </div>
          <div className="pk-card-body">
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Bodega</th>
                    <th>Ciudad</th>
                    <th>Jefe de Bodega</th>
                    <th>Referencias</th>
                    <th>Valor Costo en Sede</th>
                    <th>Reporte</th>
                  </tr>
                </thead>
                <tbody>
                  {state.warehouses.map((w) => {
                    const whProds = state.products.filter((p) => p.warehouseId === w.id);
                    const whValue = whProds.reduce((acc, p) => acc + p.stock * p.costPrice, 0);
                    return (
                      <tr key={w.id}>
                        <td>
                          <strong>{w.code}</strong>
                        </td>
                        <td>
                          <strong>{w.name}</strong>
                        </td>
                        <td>{w.city}</td>
                        <td>{w.manager || '—'}</td>
                        <td>{whProds.length} ítems</td>
                        <td style={{ fontWeight: 700 }}>{formatCop(whValue)}</td>
                        <td>
                          <PkPrintButton
                            label="🖨️ Acta Bodega"
                            payload={{
                              document_type: 'INVENTARIO VALORIZADO POR BODEGA',
                              document_number: w.code,
                              customer_name: w.name,
                              customer_address: w.city,
                              extra_fields: {
                                Responsable: w.manager || 'No asignado',
                                Referencias: String(whProds.length),
                              },
                              items: whProds.map((p) => ({
                                code: p.code,
                                description: `${p.name} (Lote: ${p.lotCode || 'N/A'})`,
                                quantity: p.stock,
                                unit_price: p.costPrice,
                                subtotal: p.stock * p.costPrice,
                              })),
                              subtotal: whValue,
                              grand_total: whValue,
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
      </div>
    );
  }

  if (activeModuleKey === 'kardex_lotes') {
    const kardexPrintPayload: PrintDocumentPayload = {
      document_type: 'LIBRO AUXILIAR KARDEX VALORIZADO',
      document_number: `KDX-${new Date().toISOString().slice(0, 10)}`,
      customer_name: 'Auditoría Interna de Inventarios',
      items: state.kardex.slice(0, 40).map((m) => ({
        code: m.id,
        description: `[${m.movementType}] ${m.productName} — Ref: ${m.referenceDoc}`,
        quantity: m.qty,
        unit_price: m.unitCost,
        subtotal: Math.abs(m.qty) * m.unitCost,
      })),
      grand_total: totalInventoryCost,
      notes: 'Trazabilidad cronológica de entradas, salidas, ajustes y traslados.',
    };

    return (
      <div>
        <PkKpiRow
          items={[
            { label: 'Movimientos en Kardex', value: String(state.kardex.length) },
            {
              label: 'Lotes Trazables Activos',
              value: String(state.products.filter((p) => Boolean(p.lotCode)).length),
            },
            { label: 'Valor Inventario Costo', value: formatCop(totalInventoryCost), color: 'var(--pk-primary)' },
          ]}
        />

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">📋 Trazabilidad Kardex Valorizado y Control de Lotes</div>
            <div className="pk-row-actions">
              <PkPrintButton label="🖨️ Imprimir Kardex" payload={kardexPrintPayload} variant="primary" />
              <button
                type="button"
                className="pk-btn pk-btn-outline pk-btn-sm"
                onClick={() =>
                  downloadCsvUtf8(
                    'kardex_valorizado_proveko.csv',
                    ['ID', 'Fecha', 'Producto', 'Bodega', 'TipoMovimiento', 'Cantidad', 'CostoUnitario', 'SaldoPosterior', 'Referencia', 'Usuario'],
                    state.kardex.map((k) => [
                      k.id,
                      k.date,
                      k.productName,
                      getWarehouseName(k.warehouseId),
                      k.movementType,
                      k.qty,
                      k.unitCost,
                      k.balanceAfter,
                      k.referenceDoc,
                      k.actor,
                    ])
                  )
                }
              >
                📥 Descargar CSV
              </button>
            </div>
          </div>
          <div className="pk-card-body">
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>ID / Fecha</th>
                    <th>Producto</th>
                    <th>Bodega</th>
                    <th>Tipo Movimiento</th>
                    <th>Cantidad</th>
                    <th>Costo Unit.</th>
                    <th>Saldo Final</th>
                    <th>Documento / Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {state.kardex.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.id}</strong>
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{m.date}</div>
                      </td>
                      <td>{m.productName}</td>
                      <td>{getWarehouseName(m.warehouseId)}</td>
                      <td>
                        <span
                          className={`pk-badge ${
                            m.qty >= 0 ? 'pk-badge-emerald' : 'pk-badge-amber'
                          }`}
                        >
                          {m.movementType}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800, color: m.qty >= 0 ? 'var(--pk-emerald)' : 'var(--pk-rose)' }}>
                        {m.qty > 0 ? `+${m.qty}` : m.qty}
                      </td>
                      <td>{formatCop(m.unitCost)}</td>
                      <td>
                        <strong>{m.balanceAfter}</strong>
                      </td>
                      <td>
                        {m.referenceDoc}
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{m.actor}</div>
                      </td>
                    </tr>
                  ))}
                  {state.kardex.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                        Aún no se han registrado movimientos en el Kardex.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeModuleKey === 'solicitudes_insumos') {
    return (
      <div>
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">📥 Nueva Requisición Interna de Materiales / Insumos</div>
          </div>
          <div className="pk-card-body">
            <form onSubmit={handleCreateRequest} className="pk-form-grid">
              <PkAutoCodeInput label="N° Requisición" value={state.nextRequestCode} />
              <PkEntitySelect
                label="Insumo / Producto Solicitado"
                items={state.products}
                value={reqProductId}
                onChange={setReqProductId}
                getValue={(p) => p.id}
                getLabel={(p) => `${p.code} — ${p.name} (Stock: ${p.stock})`}
                searchable
              />
              <PkEntitySelect
                label="Bodega que Despacha"
                items={state.warehouses}
                value={reqWarehouseId}
                onChange={setReqWarehouseId}
                getValue={(w) => w.id}
                getLabel={(w) => w.name}
              />
              <div className="pk-field">
                <label>Cantidad Requerida *</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={reqQty}
                  onChange={(e) => setReqQty(e.target.value)}
                />
              </div>
              <div className="pk-field">
                <label>Área / Solicitante</label>
                <input
                  value={reqRequester}
                  onChange={(e) => setReqRequester(e.target.value)}
                  placeholder="Ej: Taller Diesel / Cocina"
                />
              </div>
              <div className="pk-field">
                <label>Prioridad</label>
                <select value={reqPriority} onChange={(e) => setReqPriority(e.target.value)}>
                  <option value="Normal">Normal</option>
                  <option value="Alta / Urgente">Alta / Urgente</option>
                  <option value="Programada">Programada</option>
                </select>
              </div>
              <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
                <label>Justificación / Observación</label>
                <input
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  placeholder="Detalle del trabajo u orden donde se empleará el material"
                />
              </div>
              <div className="pk-field">
                <button type="submit" className="pk-btn pk-btn-primary">
                  ➕ Radicar Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">📋 Historial de Solicitudes de Insumos</div>
          </div>
          <div className="pk-card-body">
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Fecha</th>
                    <th>Producto / Insumo</th>
                    <th>Bodega</th>
                    <th>Cantidad</th>
                    <th>Prioridad</th>
                    <th>Solicitante</th>
                    <th>Orden</th>
                  </tr>
                </thead>
                <tbody>
                  {state.requests.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.id}</strong>
                      </td>
                      <td>{r.createdAt}</td>
                      <td>{r.fields.productName}</td>
                      <td>{r.fields.warehouseName}</td>
                      <td>
                        <strong>{r.fields.qty}</strong>
                      </td>
                      <td>
                        <span
                          className={`pk-badge ${
                            r.fields.priority?.includes('Urgente') ? 'pk-badge-amber' : 'pk-badge-blue'
                          }`}
                        >
                          {r.fields.priority}
                        </span>
                      </td>
                      <td>{r.fields.requester}</td>
                      <td>
                        <PkPrintButton
                          label="🖨️ Imprimir"
                          payload={{
                            document_type: 'REQUISICIÓN INTERNA DE INSUMOS',
                            document_number: r.id,
                            issue_date: r.createdAt,
                            customer_name: r.fields.requester || 'Área Operativa',
                            extra_fields: {
                              Bodega: r.fields.warehouseName || '',
                              Prioridad: r.fields.priority || 'Normal',
                              Estado: r.fields.status || 'Pendiente',
                            },
                            items: [
                              {
                                code: r.fields.productId || r.id,
                                description: r.fields.productName || 'Insumo',
                                quantity: Number(r.fields.qty || 1),
                                unit_price: 0,
                                subtotal: 0,
                              },
                            ],
                            grand_total: 0,
                            notes: r.fields.notes || '',
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                  {state.requests.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                        No hay solicitudes internas radicadas todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredProducts = searchTerm.trim()
    ? state.products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.category.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : state.products;

  const generalInventoryPrint: PrintDocumentPayload = {
    document_type: 'REPORTE GENERAL DE INVENTARIO VALORIZADO',
    document_number: `INV-${new Date().toISOString().slice(0, 10)}`,
    customer_name: 'Consolidado General de Almacén',
    extra_fields: {
      'Total Referencias': String(state.products.length),
      'Valor Venta Proyectado': formatCop(totalInventorySale),
    },
    items: state.products.map((p) => ({
      code: p.code,
      description: `${p.name} [${getWarehouseName(p.warehouseId)}]`,
      quantity: p.stock,
      unit_price: p.costPrice,
      tax_pct: p.taxPct,
      subtotal: p.stock * p.costPrice,
    })),
    subtotal: totalInventoryCost,
    grand_total: totalInventoryCost,
    notes: 'Inventario valorizado a costo promedio / último costo de compra.',
  };

  return (
    <div>
      <PkKpiRow
        items={[
          { label: 'Referencias en Catálogo', value: String(state.products.length) },
          { label: 'Valor Inventario (Costo)', value: formatCop(totalInventoryCost), color: 'var(--pk-primary)' },
          { label: 'Valor Proyectado (Venta)', value: formatCop(totalInventorySale), color: 'var(--pk-emerald)' },
          ...(hasFeature('productos_stock', 'alerta_stock_minimo')
            ? [
                {
                  label: 'Alertas Bajo Stock Mínimo',
                  value: String(lowStockProducts.length),
                  color: lowStockProducts.length > 0 ? 'var(--pk-rose)' : 'var(--pk-emerald)',
                },
              ]
            : []),
        ]}
      />

      <FeatureGate module="productos_stock" feature="alerta_stock_minimo">
        {lowStockProducts.length > 0 && (
          <div
            className="pk-card"
            style={{ borderColor: '#f59e0b', background: '#fffbeb', padding: '10px 16px' }}
          >
            <strong style={{ color: '#92400e', fontSize: 13 }}>
              ⚠️ Alerta de Reabastecimiento ({lowStockProducts.length} productos en o bajo mínimo):{' '}
            </strong>
            <span style={{ fontSize: 12.5, color: '#78350f' }}>
              {lowStockProducts.map((p) => `${p.name} (${p.stock}/${p.minStock})`).join(' • ')}
            </span>
          </div>
        )}
      </FeatureGate>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📦 Registrar Nuevo Producto / Repuesto / Insumo</div>
        </div>
        <div className="pk-card-body">
          <form onSubmit={handleCreateProduct} className="pk-form-grid">
            <PkAutoCodeInput label="Código SKU" value={state.nextProductCode} />

            <div className="pk-field">
              <label>Nombre del Producto *</label>
              <input
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="Ej: Batería 12V 800CCA Libre Mantenimiento"
              />
            </div>

            <div className="pk-field">
              <label>Categoría</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>

            <PkEntitySelect
              label="Bodega Inicial"
              items={state.warehouses}
              value={warehouseId}
              onChange={setWarehouseId}
              getValue={(w) => w.id}
              getLabel={(w) => `${w.code} — ${w.name}`}
              onCreateNew={() => openQuickDialog('nueva-bodega')}
              createLabel="+ Nueva Bodega"
            />

            <PkEntitySelect
              label="Proveedor Principal"
              items={state.suppliers}
              value={supplierId}
              onChange={setSupplierId}
              getValue={(s) => s.id}
              getLabel={(s) => `${s.name} (${s.nit})`}
              onCreateNew={() => openQuickDialog('nuevo-proveedor')}
              createLabel="+ Nuevo Proveedor"
            />

            <div className="pk-field">
              <label>Costo Unitario ($)</label>
              <input type="number" min={0} value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
            </div>

            <div className="pk-field">
              <label>Precio de Venta ($) *</label>
              <input
                required
                type="number"
                min={0}
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>

            <div className="pk-field">
              <label>IVA (%)</label>
              <select value={taxPct} onChange={(e) => setTaxPct(e.target.value)}>
                <option value="19">19% — Tarifa General</option>
                <option value="8">8% — Impoconsumo</option>
                <option value="5">5% — Tarifa Reducida</option>
                <option value="0">0% — Exento / Excluido</option>
              </select>
            </div>

            <div className="pk-field">
              <label>Existencia Inicial</label>
              <input type="number" min={0} value={initialStock} onChange={(e) => setInitialStock(e.target.value)} />
            </div>

            <div className="pk-field">
              <label>Stock Mínimo Alerta</label>
              <input type="number" min={0} value={minStock} onChange={(e) => setMinStock(e.target.value)} />
            </div>

            <div className="pk-field">
              <label>Código de Lote</label>
              <input value={lotCode} onChange={(e) => setLotCode(e.target.value)} />
            </div>

            <div className="pk-field">
              <label>Vencimiento</label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>

            <div className="pk-field">
              <button type="submit" className="pk-btn pk-btn-primary">
                💾 Crear Producto
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📋 Catálogo Maestro de Existencias</div>
          <div className="pk-row-actions">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔎 Filtrar SKU, nombre o categoría..."
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--pk-border)', fontSize: 12.5 }}
            />
            <PkPrintButton label="🖨️ Imprimir Inventario" payload={generalInventoryPrint} variant="primary" />
            <button
              type="button"
              className="pk-btn pk-btn-outline pk-btn-sm"
              onClick={() =>
                downloadCsvUtf8(
                  'inventario_existencias_proveko.csv',
                  ['SKU', 'Nombre', 'Categoria', 'Bodega', 'Costo', 'PrecioVenta', 'IVA', 'Stock', 'Minimo', 'Lote', 'Vencimiento'],
                  state.products.map((p) => [
                    p.code,
                    p.name,
                    p.category,
                    getWarehouseName(p.warehouseId),
                    p.costPrice,
                    p.salePrice,
                    p.taxPct,
                    p.stock,
                    p.minStock,
                    p.lotCode,
                    p.expiryDate,
                  ])
                )
              }
            >
              📥 Descargar CSV
            </button>
          </div>
        </div>
        <div className="pk-card-body">
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto / Categoría</th>
                  <th>Bodega / Lote</th>
                  <th>Costo / Venta</th>
                  <th>Stock Actual</th>
                  <th>Operaciones de Almacén</th>
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
                        <strong>{p.name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                          {p.category} • IVA {p.taxPct}%
                        </div>
                      </td>
                      <td>
                        <div>{getWarehouseName(p.warehouseId)}</div>
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                          Lote: {p.lotCode || 'N/A'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>
                          Costo: {formatCop(p.costPrice)}
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--pk-primary)' }}>
                          Venta: {formatCop(p.salePrice)}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            onClick={() => void handleDeltaStock(p.id, -1)}
                          >
                            −
                          </button>
                          <strong style={{ minWidth: 28, textAlign: 'center', fontSize: 14 }}>
                            {p.stock}
                          </strong>
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            onClick={() => void handleDeltaStock(p.id, 1)}
                          >
                            +
                          </button>
                        </div>
                        <FeatureGate module="productos_stock" feature="alerta_stock_minimo">
                          {isLow && (
                            <span className="pk-badge pk-badge-amber" style={{ marginTop: 4 }}>
                              ⚠️ Bajo Mínimo ({p.minStock})
                            </span>
                          )}
                        </FeatureGate>
                      </td>
                      <td>
                        <div className="pk-row-actions">
                          <button
                            type="button"
                            className="pk-btn pk-btn-emerald pk-btn-sm"
                            onClick={() => openRestockModal(p)}
                          >
                            📥 Surtir
                          </button>
                          <button
                            type="button"
                            className="pk-btn pk-btn-amber pk-btn-sm"
                            onClick={() => openTransferModal(p)}
                          >
                            🔄 Trasladar
                          </button>
                          <PkPrintButton
                            label="🖨️ Ficha"
                            payload={{
                              document_type: 'FICHA TÉCNICA DE EXISTENCIA Y VALORIZACIÓN',
                              document_number: p.code,
                              customer_name: getWarehouseName(p.warehouseId),
                              extra_fields: {
                                Categoría: p.category,
                                Lote: p.lotCode || 'N/A',
                                Vencimiento: p.expiryDate || 'N/A',
                                'Precio Venta': formatCop(p.salePrice),
                              },
                              items: [
                                {
                                  code: p.code,
                                  description: p.name,
                                  quantity: p.stock,
                                  unit_price: p.costPrice,
                                  tax_pct: p.taxPct,
                                  subtotal: p.stock * p.costPrice,
                                },
                              ],
                              subtotal: p.stock * p.costPrice,
                              grand_total: p.stock * p.costPrice,
                            }}
                          />
                          <button
                            type="button"
                            className="pk-btn pk-btn-danger pk-btn-sm"
                            onClick={() => void handleDeleteProduct(p.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PkEntityDialog
        open={Boolean(restockTarget)}
        title={`📥 Surtir Entrada de Compra — ${restockTarget?.name || ''}`}
        onClose={() => setRestockTarget(null)}
      >
        {restockTarget && (
          <form onSubmit={handleConfirmRestock} className="pk-form-grid">
            <div className="pk-field">
              <label>Cantidad que Ingresa *</label>
              <input
                required
                type="number"
                min={1}
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
              />
            </div>
            <div className="pk-field">
              <label>Costo Unitario Compra ($)</label>
              <input
                type="number"
                min={0}
                value={restockCost}
                onChange={(e) => setRestockCost(e.target.value)}
              />
            </div>
            <div className="pk-field">
              <label>Lote Recepcionado</label>
              <input value={restockLot} onChange={(e) => setRestockLot(e.target.value)} />
            </div>
            <div className="pk-field">
              <label>Fecha Vencimiento</label>
              <input type="date" value={restockExpiry} onChange={(e) => setRestockExpiry(e.target.value)} />
            </div>
            <div className="pk-row-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
              <button type="submit" className="pk-btn pk-btn-emerald">
                💾 Ingresar al Stock y Kardex
              </button>
            </div>
          </form>
        )}
      </PkEntityDialog>

      <PkEntityDialog
        open={Boolean(transferTarget)}
        title={`🔄 Trasladar entre Bodegas — ${transferTarget?.name || ''}`}
        onClose={() => setTransferTarget(null)}
      >
        {transferTarget && (
          <form onSubmit={handleConfirmTransfer} className="pk-form-grid">
            <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
              <label>Bodega Origen y Saldo Actual</label>
              <input
                readOnly
                value={`${getWarehouseName(transferTarget.warehouseId)} — Disponible: ${transferTarget.stock}`}
                style={{ background: '#f8fafc', fontWeight: 700 }}
              />
            </div>
            <PkEntitySelect
              label="Bodega Destino"
              items={state.warehouses.filter((w) => w.id !== transferTarget.warehouseId)}
              value={transferWhId}
              onChange={setTransferWhId}
              getValue={(w) => w.id}
              getLabel={(w) => `${w.code} — ${w.name} (${w.city})`}
              onCreateNew={() => openQuickDialog('nueva-bodega')}
              createLabel="+ Nueva Bodega"
            />
            <div className="pk-field">
              <label>Cantidad a Trasladar *</label>
              <input
                required
                type="number"
                min={1}
                max={transferTarget.stock}
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
              />
            </div>
            <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
              <label>Guía / Nota de Remisión</label>
              <input
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="Ej: Remisión interna #402"
              />
            </div>
            <div className="pk-row-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
              <button type="submit" className="pk-btn pk-btn-amber">
                🔄 Confirmar Traslado
              </button>
            </div>
          </form>
        )}
      </PkEntityDialog>
    </div>
  );
};
