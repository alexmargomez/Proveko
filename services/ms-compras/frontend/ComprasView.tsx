import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  ModuleGate,
  PkAutoCodeInput,
  PkEntitySelect,
  PkPrintButton,
  PkKpiRow,
  Supplier,
  Product,
  Warehouse,
  PrintDocumentPayload,
  formatCop,
} from '@proveko/ui-sdk';

interface PurchaseOrderRecord {
  id: string;
  createdAt: string;
  moduleKey: string;
  fields: Record<string, string>;
}

interface ComprasAllResponse {
  ok: boolean;
  nextSupplierCode: string;
  nextOrderCode: string;
  suppliers: Supplier[];
  products: Product[];
  warehouses: Warehouse[];
  orders: PurchaseOrderRecord[];
}

export const ComprasView: React.FC = () => {
  const { activeModuleKey, hasModule, apiGet, apiPost, toast, openQuickDialog, dialogVersion } = useProveko();

  const [nextSupplierCode, setNextSupplierCode] = useState('PRV-206');
  const [nextOrderCode, setNextOrderCode] = useState('OC-806');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);

  const [supNit, setSupNit] = useState('');
  const [supName, setSupName] = useState('');
  const [supCity, setSupCity] = useState('Bogotá D.C.');
  const [supPhone, setSupPhone] = useState('');

  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [qty, setQty] = useState('10');
  const [unitCost, setUnitCost] = useState('');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<ComprasAllResponse>('/api/v1/compras/all');
      const supList = data.suppliers || [];
      const prdList = data.products || [];
      const whList = data.warehouses || [];

      setNextSupplierCode(data.nextSupplierCode || 'PRV-206');
      setNextOrderCode(data.nextOrderCode || 'OC-806');
      setSuppliers(supList);
      setProducts(prdList);
      setWarehouses(whList);
      setOrders(data.orders || []);

      setSupplierId((prev) => (prev && supList.some((s) => s.id === prev) ? prev : supList[0]?.id || ''));
      setWarehouseId((prev) => (prev && whList.some((w) => w.id === prev) ? prev : whList[0]?.id || ''));
      setProductId((prev) => {
        const chosen = prev && prdList.some((p) => p.id === prev) ? prev : prdList[0]?.id || '';
        const found = prdList.find((p) => p.id === chosen);
        if (found) {
          setUnitCost((cur) => (cur ? cur : String(found.costPrice || 0)));
        }
        return chosen;
      });
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void reload();
  }, [reload, dialogVersion]);

  const validModules = ['directorio_proveedores', 'ordenes_compra'];
  const currentTab =
    validModules.includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : validModules.find((m) => hasModule(m)) || 'ordenes_compra';

  const handleProductChange = (newProductId: string) => {
    setProductId(newProductId);
    const prod = products.find((p) => p.id === newProductId);
    if (prod) {
      setUnitCost(String(prod.costPrice || 0));
      if (prod.warehouseId) {
        setWarehouseId(prod.warehouseId);
      }
      if (prod.supplierId && suppliers.some((s) => s.id === prod.supplierId)) {
        setSupplierId(prod.supplierId);
      }
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supNit.trim() || !supName.trim()) {
      toast('Completa el NIT y la razón social del proveedor.');
      return;
    }
    await apiPost('/api/v1/compras/suppliers', {
      nit: supNit,
      name: supName,
      city: supCity,
      phone: supPhone,
    });
    toast('Proveedor agregado al directorio');
    setSupNit('');
    setSupName('');
    setSupPhone('');
    await reload();
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = Number(qty || 0);
    const numCost = Number(unitCost || 0);
    if (!supplierId || !productId || numQty <= 0) {
      toast('Selecciona proveedor, producto y una cantidad válida mayor a cero.');
      return;
    }
    await apiPost('/api/v1/compras/orders', {
      supplierId,
      productId,
      warehouseId,
      qty: numQty,
      unitCost: numCost,
    });
    toast('Orden de compra registrada y existencias sumadas al Kardex');
    setQty('10');
    await reload();
  };

  const totalPurchasesAmount = orders.reduce(
    (acc, o) => acc + Number(o.fields?.totalCost || 0),
    0
  );

  const suppliersDirectoryPayload: PrintDocumentPayload = {
    document_type: 'DIRECTORIO DE PROVEEDORES',
    layout_variant: 'carta_membrete',
    document_number: `DIR-PRV-${new Date().toISOString().slice(0, 10)}`,
    issue_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    customer_name: 'Catálogo Oficial de Proveedores Activos',
    extra_fields: {
      'Total Proveedores': String(suppliers.length),
      'Órdenes Emitidas': String(orders.length),
    },
    items: suppliers.map((s) => ({
      code: s.code,
      description: `${s.name} — NIT: ${s.nit} (${s.city} | Tel: ${s.phone || 'N/A'})`,
      quantity: 1,
      unit_price: 0,
      subtotal: 0,
    })),
    grand_total: 0,
    notes: 'Directorio maestro de proveedores autorizados para abastecimiento.',
  };

  const buildOrderPayload = (ord: PurchaseOrderRecord): PrintDocumentPayload => {
    const qtyNum = Number(ord.fields?.qty || 0);
    const costNum = Number(ord.fields?.unitCost || 0);
    const totalNum = Number(ord.fields?.totalCost || qtyNum * costNum);
    return {
      document_type: 'ORDEN DE COMPRA E INGRESO A BODEGA',
      layout_variant: 'carta_membrete',
      document_number: ord.id,
      issue_date: ord.createdAt,
      customer_name: ord.fields?.supplierName || 'Proveedor',
      customer_nit: ord.fields?.supplierNit || '',
      payment_method: 'Abastecimiento / Factura de Compra',
      extra_fields: {
        'Código Proveedor': ord.fields?.supplierCode || '—',
        'Bodega Destino': ord.fields?.warehouseName || 'Bodega Principal',
        'Estado Recepción': ord.fields?.status || 'Recibida en Bodega',
        'Saldo Stock Posterior': `${ord.fields?.balanceAfter || '—'} unds`,
      },
      items: [
        {
          code: ord.fields?.productCode || ord.fields?.productId || 'PRD',
          description: ord.fields?.productName || 'Producto ingresado',
          quantity: qtyNum,
          unit_price: costNum,
          subtotal: totalNum,
        },
      ],
      subtotal: totalNum,
      grand_total: totalNum,
      notes: 'Mercancía recibida a conformidad e ingresada automáticamente al Kardex valorizado.',
    };
  };

  const previewTotalOrder = Number(qty || 0) * Number(unitCost || 0);

  return (
    <div>
      <PkKpiRow
        items={[
          { label: 'Proveedores Activos', value: String(suppliers.length), color: 'var(--pk-primary)' },
          { label: 'Órdenes de Compra', value: String(orders.length), color: 'var(--pk-emerald)' },
          { label: 'Total Abastecimiento', value: formatCop(totalPurchasesAmount), color: '#0f172a' },
          { label: 'Bodegas Habilitadas', value: String(warehouses.length), color: 'var(--pk-amber)' },
        ]}
      />

      {currentTab === 'directorio_proveedores' && (
        <ModuleGate module="directorio_proveedores">
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🏢 Alta de Proveedor Nacional / Importador</div>
              <PkPrintButton
                label="🖨️ Imprimir Directorio Proveedores"
                payload={suppliersDirectoryPayload}
                variant="primary"
              />
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleCreateSupplier} className="pk-form-grid">
                <PkAutoCodeInput label="Código Proveedor" value={nextSupplierCode} />
                <div className="pk-field">
                  <label>NIT / Identificación Tributaria *</label>
                  <input
                    required
                    value={supNit}
                    onChange={(e) => setSupNit(e.target.value)}
                    placeholder="Ej: 860025147-1"
                  />
                </div>
                <div className="pk-field">
                  <label>Razón Social / Nombre Comercial *</label>
                  <input
                    required
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    placeholder="Ej: Importadora Andina de Suministros S.A.S."
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
                  <label>Teléfono / Ejecutivo Comercial</label>
                  <input
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="Ej: 3102223344"
                  />
                </div>
                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-primary">
                    💾 Guardar Proveedor
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
                      <th>Teléfono</th>
                      <th>Ficha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                          No hay proveedores registrados todavía.
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
                          <td>{sup.phone || '—'}</td>
                          <td>
                            <PkPrintButton
                              label="🖨️ Ficha Proveedor"
                              payload={{
                                document_type: 'FICHA DE PROVEEDOR',
                                layout_variant: 'carta_membrete',
                                document_number: sup.code,
                                customer_name: sup.name,
                                customer_nit: sup.nit,
                                customer_phone: sup.phone,
                                customer_address: sup.city,
                                items: [
                                  {
                                    code: sup.code,
                                    description: `Proveedor homologado — Ciudad: ${sup.city} — Contacto: ${sup.phone || 'N/A'}`,
                                    quantity: 1,
                                    unit_price: 0,
                                    subtotal: 0,
                                  },
                                ],
                                grand_total: 0,
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

      {currentTab === 'ordenes_compra' && (
        <ModuleGate module="ordenes_compra">
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">📦 Emitir Orden de Compra e Ingresar Mercancía al Stock</div>
              <span className="pk-badge pk-badge-emerald">
                Total Orden Actual: {formatCop(previewTotalOrder)}
              </span>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleCreateOrder} className="pk-form-grid">
                <PkAutoCodeInput label="Orden de Compra" value={nextOrderCode} />
                <PkEntitySelect
                  label="Proveedor *"
                  items={suppliers}
                  value={supplierId}
                  onChange={setSupplierId}
                  getValue={(s) => s.id}
                  getLabel={(s) => `${s.code} — ${s.name} (${s.nit})`}
                  onCreateNew={() => openQuickDialog('nuevo-proveedor', () => void reload())}
                  createLabel="+ Nuevo Proveedor"
                  searchable
                />
                <PkEntitySelect
                  label="Producto a Surtir *"
                  items={products}
                  value={productId}
                  onChange={handleProductChange}
                  getValue={(p) => p.id}
                  getLabel={(p) => `${p.code} — ${p.name} (Stock: ${p.stock})`}
                  searchable
                />
                <PkEntitySelect
                  label="Bodega de Recepción *"
                  items={warehouses}
                  value={warehouseId}
                  onChange={setWarehouseId}
                  getValue={(w) => w.id}
                  getLabel={(w) => `${w.code} — ${w.name} (${w.city})`}
                  onCreateNew={() => openQuickDialog('nueva-bodega', () => void reload())}
                  createLabel="+ Nueva Bodega"
                />
                <div className="pk-field">
                  <label>Cantidad que Ingresa *</label>
                  <input
                    required
                    type="number"
                    min="1"
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
                    min="0"
                    step="any"
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                  />
                </div>
                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-emerald">
                    📥 Registrar Compra y Sumar Stock
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🚚 Órdenes de Compra y Entradas a Bodega ({orders.length})</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>N° Orden</th>
                      <th>Fecha</th>
                      <th>Proveedor</th>
                      <th>Producto</th>
                      <th>Bodega</th>
                      <th>Cantidad</th>
                      <th>Costo Unit.</th>
                      <th>Total OC</th>
                      <th>Imprimir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                          Aún no se han emitido órdenes de compra en este periodo.
                        </td>
                      </tr>
                    ) : (
                      orders.map((ord) => (
                        <tr key={ord.id}>
                          <td>
                            <span className="pk-badge pk-badge-emerald">{ord.id}</span>
                          </td>
                          <td>{ord.createdAt}</td>
                          <td style={{ fontWeight: 700 }}>{ord.fields?.supplierName}</td>
                          <td>
                            {ord.fields?.productCode} — {ord.fields?.productName}
                          </td>
                          <td>{ord.fields?.warehouseName}</td>
                          <td style={{ fontWeight: 800 }}>+{ord.fields?.qty}</td>
                          <td>{formatCop(Number(ord.fields?.unitCost || 0))}</td>
                          <td style={{ fontWeight: 800, color: 'var(--pk-primary)' }}>
                            {formatCop(Number(ord.fields?.totalCost || 0))}
                          </td>
                          <td>
                            <PkPrintButton label="🖨️ Orden de Compra" payload={buildOrderPayload(ord)} />
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
