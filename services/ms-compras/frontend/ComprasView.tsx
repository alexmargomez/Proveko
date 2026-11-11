import React, { useState, useEffect, useCallback } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkAutoCodeInput,
  PkSelect,
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

export const ComprasView: React.FC = () => {
  const {
    activeModuleKey,
    hasService,
    hasModule,
    apiGet,
    apiPost,
    apiDelete,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

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

  const validModules = ['directorio_proveedores', 'ordenes_compra'];
  const currentTab =
    validModules.includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : validModules.find((m) => hasModule(m)) || 'ordenes_compra';

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

  const submitNewSupplier = async (closeModalAfter: boolean) => {
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
      toast('Proveedor registrado en el directorio.');
      setSupNit('');
      setSupName('');
      setSupPhone('');
      setSupEmail('');
      if (closeModalAfter) {
        setSupplierModalOpen(false);
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
    const resolvedProductCode = useCatalogMode ? selectedProd?.code || '' : manualProductCode.trim() || 'INS';
    const resolvedProductName = useCatalogMode ? selectedProd?.name || '' : manualProductName.trim();
    const resolvedWhId = invWarehouses.length > 0 ? selectedWh?.id || '' : '';
    const resolvedWhName = invWarehouses.length > 0 ? selectedWh?.name || 'Bodega Principal' : manualWarehouseName.trim() || 'Bodega Principal';

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
          ? 'Orden de compra registrada y existencias actualizadas en inventario.'
          : 'Orden de compra registrada correctamente.'
      );
      setQty('10');
      setManualProductName('');
      setManualProductCode('');
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
        'Bodega',
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

  const totalPurchasesAmount = orders.reduce((acc, o) => acc + (Number(o.totalCost) || 0), 0);
  const previewTotalOrder = Math.max(0, (Number(qty) || 0) * (Number(unitCost) || 0));

  const buildOrderPrintPayload = (ord: PurchaseOrder): Record<string, unknown> => ({
    document_type: 'ORDEN DE COMPRA E INGRESO DE MERCANCÍA',
    layout_variant: 'carta_membrete',
    document_number: ord.code,
    issue_date: ord.createdAt,
    customer_name: ord.supplierName,
    customer_nit: ord.supplierNit,
    payment_method: 'Orden de Abastecimiento',
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
    <div>
      <PkKpiRow
        items={[
          { label: 'Proveedores Homologados', value: String(suppliers.length), color: 'var(--pk-primary)' },
          { label: 'Órdenes de Compra', value: String(orders.length), color: 'var(--pk-emerald)' },
          { label: 'Volumen de Compras', value: formatCop(totalPurchasesAmount), color: '#0f172a' },
          {
            label: 'Integración Inventario',
            value: inventoryEnabled ? 'Sincronización Automática' : 'Modo Autónomo',
            color: 'var(--pk-amber)',
          },
        ]}
      />

      {currentTab === 'directorio_proveedores' && (
        <ModuleGate module="directorio_proveedores">
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🏢 Registro de Proveedor Nacional o Importador</div>
              <PkPrintButton
                label="🖨️ Imprimir Directorio"
                payload={suppliersDirectoryPrintPayload}
                variant="primary"
              />
            </div>
            <div className="pk-card-body">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitNewSupplier(false);
                }}
                className="pk-form-grid"
              >
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
                <div className="pk-field">
                  <label>Razón Social / Nombre Comercial *</label>
                  <input
                    required
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    placeholder="Ej: Suministros Industriales S.A.S."
                  />
                </div>
                <div className="pk-field">
                  <label>Ciudad</label>
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
                <div className="pk-field">
                  <label>Correo Electrónico</label>
                  <input
                    type="email"
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    placeholder="ventas@proveedor.co"
                  />
                </div>
                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                    {busy ? 'Guardando...' : '💾 Guardar Proveedor'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">📋 Directorio de Proveedores ({suppliers.length})</div>
            </div>
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
                    {suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                          No existen proveedores registrados en el directorio.
                        </td>
                      </tr>
                    ) : (
                      suppliers.map((sup) => (
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
                              <PkPrintButton
                                label="🖨️ Ficha"
                                payload={{
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
                                }}
                              />
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
          </div>
        </ModuleGate>
      )}

      {currentTab === 'ordenes_compra' && (
        <ModuleGate module="ordenes_compra">
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">📦 Emitir Orden de Compra y Recepción de Mercancía</div>
              <div className="pk-row-actions">
                <span className="pk-badge pk-badge-emerald">
                  Total Orden: {formatCop(previewTotalOrder)}
                </span>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  onClick={handleExportOrdersCsv}
                >
                  📥 Exportar CSV
                </button>
              </div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleCreateOrder} className="pk-form-grid">
                <PkAutoCodeInput label="Consecutivo Orden" value={nextOrderCode} />

                <PkSelect
                  label="Proveedor *"
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

                {useCatalogMode ? (
                  <PkSelect
                    label="Producto de Inventario *"
                    items={invProducts}
                    value={productId}
                    onChange={handleProductChange}
                    getValue={(p) => p.id}
                    getLabel={(p) => `${p.code} — ${p.name} (Stock: ${p.stock})`}
                    searchable
                  />
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
                    <div className="pk-field">
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

                {invWarehouses.length > 0 ? (
                  <PkSelect
                    label="Bodega de Recepción *"
                    items={invWarehouses}
                    value={warehouseId}
                    onChange={setWarehouseId}
                    getValue={(w) => w.id}
                    getLabel={(w) => `${w.code} — ${w.name}${w.city ? ` (${w.city})` : ''}`}
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

                <div className="pk-field">
                  <label>Cantidad Recibida *</label>
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
                  <button type="submit" className="pk-btn pk-btn-emerald" disabled={busy}>
                    {busy ? 'Procesando...' : '📥 Registrar Orden de Compra'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🚚 Historial de Órdenes de Compra ({orders.length})</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>N° Orden</th>
                      <th>Fecha</th>
                      <th>Proveedor</th>
                      <th>Producto / Descripción</th>
                      <th>Bodega</th>
                      <th className="num">Cant.</th>
                      <th className="num">Costo Unit.</th>
                      <th className="num">Total OC</th>
                      <th>Kardex</th>
                      <th>Imprimir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                          Aún no se han emitido órdenes de compra.
                        </td>
                      </tr>
                    ) : (
                      orders.map((ord) => (
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
          </div>
        </ModuleGate>
      )}

      <PkModal
        open={supplierModalOpen}
        title="🏢 Nuevo Proveedor"
        onClose={() => setSupplierModalOpen(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitNewSupplier(true);
          }}
          className="pk-form-grid"
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
          <div className="pk-field">
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
          <div className="pk-field">
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
