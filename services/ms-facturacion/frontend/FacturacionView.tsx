import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  FeatureGate,
  PkAutoCodeInput,
  PkEntitySelect,
  PkEntityDialog,
  PkPrintButton,
  PkKpiRow,
  formatCop,
  Customer,
  Product,
  Contract,
  Tariff,
  Vehicle,
  Worker,
  Invoice,
  InvoiceItem,
  PrintDocumentPayload,
} from '@proveko/ui-sdk';
import { FacturasTallerBox } from './modules/FacturasTallerBox';
import { FacturacionDianTab } from './modules/FacturacionDianTab';

interface QuoteRecord {
  id: string;
  createdAt: string;
  moduleKey: string;
  fields: Record<string, string>;
}

interface PosStateResponse {
  ok: boolean;
  nextInvoiceNumber: string;
  nextQuoteNumber: string;
  customers: Customer[];
  products: Product[];
  contracts: Contract[];
  tariffs: Tariff[];
  vehicles: Vehicle[];
  workers: Worker[];
  invoices: Invoice[];
  quotes: QuoteRecord[];
}

export const FacturacionView: React.FC = () => {
  const {
    activeModuleKey,
    setActiveModuleKey,
    setActiveServiceKey,
    apiGet,
    apiPost,
    toast,
    openQuickDialog,
    dialogVersion,
    printViaService,
    posTransfer,
    clearPosTransfer,
    hasFeature,
  } = useProveko();

  const [posState, setPosState] = useState<PosStateResponse>({
    ok: true,
    nextInvoiceNumber: 'FEVP-9012',
    nextQuoteNumber: 'COT-3011',
    customers: [],
    products: [],
    contracts: [],
    tariffs: [],
    vehicles: [],
    workers: [],
    invoices: [],
    quotes: [],
  });

  const [catalogSearch, setCatalogSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [discountPct, setDiscountPct] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [isCreditMode, setIsCreditMode] = useState(false);
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  const [vehicleId, setVehicleId] = useState('');
  const [currentKm, setCurrentKm] = useState('');
  const [nextOilKm, setNextOilKm] = useState('');
  const [mechanicId, setMechanicId] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [linkedRoomId, setLinkedRoomId] = useState('');
  const [linkedTableId, setLinkedTableId] = useState('');

  const [srvName, setSrvName] = useState('');
  const [srvPrice, setSrvPrice] = useState('85000');

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const [quoteCustomerId, setQuoteCustomerId] = useState('');
  const [quoteProductId, setQuoteProductId] = useState('');
  const [quoteQty, setQuoteQty] = useState('1');
  const [quoteItems, setQuoteItems] = useState<InvoiceItem[]>([]);
  const [quoteValidUntil, setQuoteValidUntil] = useState('2026-12-15');
  const [quoteNotes, setQuoteNotes] = useState('Precios sujetos a disponibilidad de inventario.');

  const applyCustomerTariff = useCallback(
    (custId: string, customers: Customer[], contracts: Contract[], tariffs: Tariff[]) => {
      const cust = customers.find((c) => c.id === custId);
      if (!cust) return;
      const cnt = contracts.find((ct) => ct.id === cust.contractId);
      const trfId = cnt?.tariffId || cust.tariffId;
      const trf = tariffs.find((t) => t.id === trfId);
      if (trf && hasFeature('', 'descuento_linea')) {
        setDiscountPct(String(trf.discountPct));
      } else {
        setDiscountPct('0');
      }
    },
    [hasFeature]
  );

  const loadPosState = useCallback(async () => {
    try {
      const res = await apiGet<PosStateResponse>('/api/v1/facturacion/pos-state');
      setPosState(res);
      if (!customerId && res.customers.length > 0) {
        const firstCust = res.customers[0].id;
        setCustomerId(firstCust);
        applyCustomerTariff(firstCust, res.customers, res.contracts, res.tariffs);
      }
      if (!quoteCustomerId && res.customers.length > 0) setQuoteCustomerId(res.customers[0].id);
      if (!quoteProductId && res.products.length > 0) setQuoteProductId(res.products[0].id);
    } catch {
    }
  }, [apiGet, customerId, quoteCustomerId, quoteProductId, applyCustomerTariff]);

  useEffect(() => {
    void loadPosState();
  }, [loadPosState, dialogVersion]);

  useEffect(() => {
    if (!posTransfer) return;
    if (posTransfer.customerId) {
      setCustomerId(posTransfer.customerId);
      applyCustomerTariff(posTransfer.customerId, posState.customers, posState.contracts, posState.tariffs);
    }
    if (posTransfer.vehicleId) {
      setVehicleId(posTransfer.vehicleId);
      const veh = posState.vehicles.find((v) => v.id === posTransfer.vehicleId);
      if (veh) {
        setCurrentKm(veh.currentKm ? `${veh.currentKm.toLocaleString('es-CO')} km` : '');
        setNextOilKm(veh.nextOilChangeKm ? `${veh.nextOilChangeKm.toLocaleString('es-CO')} km` : '');
      }
    }
    if (posTransfer.mechanicId) setMechanicId(posTransfer.mechanicId);
    if (posTransfer.linkedWorkOrderId) setWorkOrderId(posTransfer.linkedWorkOrderId);
    if (posTransfer.linkedRoomId) setLinkedRoomId(posTransfer.linkedRoomId);
    if (posTransfer.linkedTableId) setLinkedTableId(posTransfer.linkedTableId);
    if (posTransfer.items && posTransfer.items.length > 0) {
      setCart(posTransfer.items);
    }
    clearPosTransfer();
    toast('Cuenta recibida en Caja lista para facturar');
  }, [posTransfer, clearPosTransfer, posState.customers, posState.contracts, posState.tariffs, posState.vehicles, applyCustomerTariff, toast]);

  const handleSelectVehicle = (vehId: string) => {
    setVehicleId(vehId);
    const found = posState.vehicles.find((v) => v.id === vehId);
    if (found) {
      setCurrentKm(found.currentKm ? `${found.currentKm.toLocaleString('es-CO')} km` : '');
      setNextOilKm(found.nextOilChangeKm ? `${found.nextOilChangeKm.toLocaleString('es-CO')} km` : '');
      if (found.customerId) {
        setCustomerId(found.customerId);
        applyCustomerTariff(found.customerId, posState.customers, posState.contracts, posState.tariffs);
      }
    } else {
      setCurrentKm('');
      setNextOilKm('');
    }
  };

  const addProductToCart = (p: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((it) => it.kind === 'PRODUCTO' && it.refId === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          kind: 'PRODUCTO',
          refId: p.id,
          code: p.code,
          name: p.name,
          qty: 1,
          price: p.salePrice,
          taxPct: p.taxPct,
        },
      ];
    });
  };

  const handleAddQuickService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName.trim()) return;
    setCart((prev) => [
      ...prev,
      {
        kind: 'SERVICIO',
        refId: workOrderId || 'SRV',
        code: 'SRV-MO',
        name: srvName.trim(),
        qty: 1,
        price: Number(srvPrice || 0),
        taxPct: 0,
        workerId: mechanicId || undefined,
      },
    ]);
    setSrvName('');
  };

  const updateCartItem = (index: number, patch: Partial<InvoiceItem>) => {
    setCart((prev) => {
      const next = [...prev];
      const updated = { ...next[index], ...patch };
      if (updated.qty <= 0) {
        next.splice(index, 1);
      } else {
        next[index] = updated;
      }
      return next;
    });
  };

  const rawSubtotal = cart.reduce((acc, it) => acc + it.qty * it.price, 0);
  const effectivePct = hasFeature('', 'descuento_linea') ? Math.min(100, Math.max(0, Number(discountPct || 0))) : 0;
  const discountAmount = Math.round((rawSubtotal * effectivePct) / 100);
  const discountRatio = rawSubtotal > 0 ? discountAmount / rawSubtotal : 0;
  const taxAmount = Math.round(
    cart.reduce((acc, it) => acc + it.qty * it.price * (1 - discountRatio) * (it.taxPct / 100), 0)
  );
  const grandTotal = Math.round(rawSubtotal - discountAmount + taxAmount);

  const buildInvoicePrintPayload = (inv: Invoice): PrintDocumentPayload => {
    const cust = posState.customers.find((c) => c.id === inv.customerId);
    const extra: Record<string, string> = { ...(inv.workshopMeta || {}) };
    if (inv.plate && !extra['Placa']) extra['Placa'] = inv.plate;
    if (inv.mechanicName && !extra['Técnico / Mecánico']) extra['Técnico / Mecánico'] = inv.mechanicName;
    if (inv.cufe) extra['CUFE'] = inv.cufe;

    return {
      document_type: 'FACTURA ELECTRÓNICA DE VENTA',
      layout_variant: inv.layoutVariant || undefined,
      document_number: inv.id,
      issue_date: inv.date,
      customer_name: inv.customerName,
      customer_nit: inv.customerNit,
      customer_phone: cust?.phone,
      customer_address: cust ? `${cust.address} ${cust.city}`.trim() : undefined,
      payment_method: inv.paymentMethod,
      extra_fields: extra,
      items: inv.items.map((it) => ({
        code: it.code,
        description: it.name,
        quantity: it.qty,
        unit_price: it.price,
        tax_pct: it.taxPct,
        subtotal: it.qty * it.price,
      })),
      subtotal: inv.subtotal,
      discount_total: inv.discountTotal,
      tax_total: inv.taxTotal,
      grand_total: inv.total,
      pending_balance: inv.pendingBalance,
    };
  };

  const submitInvoice = async (renderPrint: boolean) => {
    if (cart.length === 0) {
      toast('Agrega al menos un producto o servicio al carrito');
      return;
    }

    const paidValue = isCreditMode ? Number(amountPaidInput || 0) : grandTotal;
    const selectedVehicle = posState.vehicles.find((v) => v.id === vehicleId);

    const res = await apiPost<{ ok: boolean; invoice: Invoice; printHtml?: string }>(
      '/api/v1/facturacion/invoices',
      {
        customerId,
        discountPct: effectivePct,
        vehicleId,
        plate: selectedVehicle?.plate || '',
        mechanicId,
        linkedWorkOrderId: workOrderId,
        linkedRoomId,
        linkedTableId,
        workshopMeta: {
          vehicleBrand: selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.modelYear}`.trim() : '',
          currentKm,
          nextOilKm,
          workOrderId,
        },
        items: cart,
        paymentMethod: isCreditMode ? 'Crédito / Cartera CxC' : paymentMethod,
        amountPaid: paidValue,
        notes: invoiceNotes,
        renderPrint,
      }
    );

    toast(`Factura ${res.invoice.id} emitida exitosamente`);
    setCart([]);
    setWorkOrderId('');
    setLinkedRoomId('');
    setLinkedTableId('');
    setInvoiceNotes('');
    setIsCreditMode(false);
    setAmountPaidInput('');
    await loadPosState();

    if (renderPrint) {
      if (res.printHtml) {
        const win = window.open('', '_blank', 'width=880,height=740');
        if (win) {
          win.document.write(res.printHtml);
          win.document.close();
        } else {
          toast('Habilita las ventanas emergentes para ver la factura impresa');
        }
      } else {
        await printViaService(buildInvoicePrintPayload(res.invoice));
      }
    }
  };

  const handleAddQuoteLine = () => {
    const prod = posState.products.find((p) => p.id === quoteProductId);
    if (!prod) return;
    const q = Math.max(1, Number(quoteQty || 1));
    setQuoteItems((prev) => [
      ...prev,
      {
        kind: 'PRODUCTO',
        refId: prod.id,
        code: prod.code,
        name: prod.name,
        qty: q,
        price: prod.salePrice,
        taxPct: prod.taxPct,
      },
    ]);
  };

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quoteItems.length === 0) {
      toast('Agrega al menos un producto a la cotización');
      return;
    }
    await apiPost('/api/v1/facturacion/quotes', {
      customerId: quoteCustomerId,
      validUntil: quoteValidUntil,
      notes: quoteNotes,
      items: quoteItems,
    });
    toast('Cotización comercial generada');
    setQuoteItems([]);
    await loadPosState();
  };

  const convertQuoteToInvoice = (q: QuoteRecord) => {
    try {
      const parsed = JSON.parse(q.fields.itemsJson || '[]') as InvoiceItem[];
      if (q.fields.customerId) setCustomerId(q.fields.customerId);
      setCart(parsed);
      setActiveModuleKey('pos_mostrador');
      toast(`Cotización ${q.id} cargada en Caja para facturar`);
    } catch {
      toast('No fue posible cargar los ítems de la cotización');
    }
  };

  if (activeModuleKey === 'facturacion_dian') {
    return (
      <FacturacionDianTab
        invoices={posState.invoices}
        onPrintInvoice={(inv) => void printViaService(buildInvoicePrintPayload(inv))}
      />
    );
  }

  if (activeModuleKey === 'cotizaciones') {
    const quoteSub = quoteItems.reduce((acc, it) => acc + it.qty * it.price, 0);
    return (
      <div>
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">📄 Nueva Cotización Comercial Formal</div>
          </div>
          <div className="pk-card-body">
            <form onSubmit={handleSaveQuote}>
              <div className="pk-form-grid">
                <PkAutoCodeInput label="N° Cotización" value={posState.nextQuoteNumber} />
                <PkEntitySelect
                  label="Cliente Destinatario"
                  items={posState.customers}
                  value={quoteCustomerId}
                  onChange={setQuoteCustomerId}
                  getValue={(c) => c.id}
                  getLabel={(c) => `${c.name} (${c.nit})`}
                  onCreateNew={() => openQuickDialog('nuevo-cliente')}
                  createLabel="+ Nuevo Cliente"
                />
                <div className="pk-field">
                  <label>Válida Hasta</label>
                  <input
                    type="date"
                    value={quoteValidUntil}
                    onChange={(e) => setQuoteValidUntil(e.target.value)}
                  />
                </div>
              </div>

              <div className="pk-form-grid" style={{ marginTop: 12 }}>
                <PkEntitySelect
                  label="Producto / Servicio del Catálogo"
                  items={posState.products}
                  value={quoteProductId}
                  onChange={setQuoteProductId}
                  getValue={(p) => p.id}
                  getLabel={(p) => `${p.code} — ${p.name} (${formatCop(p.salePrice)})`}
                  searchable
                />
                <div className="pk-field">
                  <label>Cantidad</label>
                  <input type="number" min={1} value={quoteQty} onChange={(e) => setQuoteQty(e.target.value)} />
                </div>
                <div className="pk-field">
                  <button type="button" className="pk-btn pk-btn-outline" onClick={handleAddQuoteLine}>
                    ➕ Agregar Ítem a Cotización
                  </button>
                </div>
              </div>

              {quoteItems.length > 0 && (
                <div className="pk-table-wrap" style={{ marginTop: 12 }}>
                  <table className="pk-table">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Descripción</th>
                        <th>Cant.</th>
                        <th>Vr. Unitario</th>
                        <th>Subtotal</th>
                        <th>Quitar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteItems.map((it, idx) => (
                        <tr key={`${it.code}-${idx}`}>
                          <td>{it.code}</td>
                          <td>{it.name}</td>
                          <td>{it.qty}</td>
                          <td>{formatCop(it.price)}</td>
                          <td>
                            <strong>{formatCop(it.qty * it.price)}</strong>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="pk-btn pk-btn-danger pk-btn-sm"
                              onClick={() => setQuoteItems((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="pk-form-grid" style={{ marginTop: 12 }}>
                <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Condiciones Comerciales y Validez</label>
                  <input value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} />
                </div>
                <div className="pk-row-actions" style={{ gridColumn: '1 / -1', justifyContent: 'space-between' }}>
                  <strong>Subtotal Cotizado: {formatCop(quoteSub)}</strong>
                  <button type="submit" className="pk-btn pk-btn-primary">
                    💾 Guardar Cotización ({posState.nextQuoteNumber})
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">📋 Cotizaciones Emitidas</div>
          </div>
          <div className="pk-card-body">
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>N° Cotización</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Vigencia</th>
                    <th>Total</th>
                    <th>Acciones Comerciales</th>
                  </tr>
                </thead>
                <tbody>
                  {posState.quotes.map((q) => {
                    let parsedItems: InvoiceItem[] = [];
                    try {
                      parsedItems = JSON.parse(q.fields.itemsJson || '[]') as InvoiceItem[];
                    } catch {
                      parsedItems = [];
                    }
                    const qTotal = Number(q.fields.total || 0);
                    return (
                      <tr key={q.id}>
                        <td>
                          <strong>{q.id}</strong>
                        </td>
                        <td>{q.createdAt}</td>
                        <td>{q.fields.customerName}</td>
                        <td>{q.fields.validUntil}</td>
                        <td>
                          <strong>{formatCop(qTotal)}</strong>
                        </td>
                        <td>
                          <div className="pk-row-actions">
                            <button
                              type="button"
                              className="pk-btn pk-btn-emerald pk-btn-sm"
                              onClick={() => convertQuoteToInvoice(q)}
                            >
                              🛒 Pasar a Factura
                            </button>
                            <PkPrintButton
                              label="🖨️ Imprimir Cotización"
                              payload={{
                                document_type: 'COTIZACIÓN COMERCIAL',
                                document_number: q.id,
                                issue_date: q.createdAt,
                                customer_name: q.fields.customerName,
                                customer_nit: q.fields.customerNit,
                                extra_fields: {
                                  'Válida Hasta': q.fields.validUntil || '',
                                  Estado: q.fields.status || 'Vigente',
                                },
                                items: parsedItems.map((it) => ({
                                  code: it.code,
                                  description: it.name,
                                  quantity: it.qty,
                                  unit_price: it.price,
                                  tax_pct: it.taxPct,
                                  subtotal: it.qty * it.price,
                                })),
                                subtotal: Number(q.fields.subtotal || qTotal),
                                tax_total: Number(q.fields.taxTotal || 0),
                                grand_total: qTotal,
                                notes: q.fields.notes,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {posState.quotes.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                        Aún no hay cotizaciones registradas.
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

  if (activeModuleKey === 'facturas_taller') {
    const workshopInvoices = posState.invoices.filter((inv) => Boolean(inv.plate || inv.vehicleId));
    const workshopTotal = workshopInvoices.reduce((acc, inv) => acc + inv.total, 0);

    return (
      <div>
        <PkKpiRow
          items={[
            { label: 'Facturas Automotrices Emitidas', value: String(workshopInvoices.length), color: 'var(--pk-primary)' },
            { label: 'Facturación Acumulada Taller', value: formatCop(workshopTotal), color: 'var(--pk-emerald)' },
            { label: 'Placas Registradas', value: String(posState.vehicles.length) },
          ]}
        />

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">🔧 Historial Especializado de Facturas con Placa y Técnico</div>
            <button
              type="button"
              className="pk-btn pk-btn-primary pk-btn-sm"
              onClick={() => setActiveModuleKey('pos_mostrador')}
            >
              🛒 Ir al POS Automotriz para Facturar Vehículo
            </button>
          </div>
          <div className="pk-card-body">
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Factura</th>
                    <th>Fecha</th>
                    <th>Placa / Vehículo</th>
                    <th>Cliente</th>
                    <th>Técnico Asignado</th>
                    <th>Formato PDF</th>
                    <th>Total</th>
                    <th>Imprimir</th>
                  </tr>
                </thead>
                <tbody>
                  {workshopInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <strong>{inv.id}</strong>
                      </td>
                      <td>{inv.date}</td>
                      <td>
                        <span className="pk-badge pk-badge-blue">{inv.plate}</span>
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                          {inv.workshopMeta?.['Vehículo'] || inv.workshopMeta?.vehicleBrand || ''}
                        </div>
                      </td>
                      <td>{inv.customerName}</td>
                      <td>{inv.mechanicName || '— Sin asignar —'}</td>
                      <td>
                        <span className="pk-badge pk-badge-emerald">
                          {inv.layoutVariant === 'factura_taller' ? 'Automotriz' : 'Estándar'}
                        </span>
                      </td>
                      <td>
                        <strong>{formatCop(inv.total)}</strong>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pk-btn pk-btn-outline pk-btn-sm"
                          onClick={() => void printViaService(buildInvoicePrintPayload(inv))}
                        >
                          🖨️ Imprimir
                        </button>
                      </td>
                    </tr>
                  ))}
                  {workshopInvoices.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                        No hay facturas con placa emitidas todavía.
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

  const filteredCatalog = catalogSearch.trim()
    ? posState.products.filter(
        (p) =>
          p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
          p.code.toLowerCase().includes(catalogSearch.toLowerCase()) ||
          p.category.toLowerCase().includes(catalogSearch.toLowerCase())
      )
    : posState.products;

  return (
    <div>
      {(linkedTableId || linkedRoomId || workOrderId) && (
        <div
          className="pk-card"
          style={{ background: '#ecfdf5', borderColor: '#10b981', padding: '10px 16px', marginBottom: 12 }}
        >
          <strong style={{ color: '#065f46', fontSize: 13 }}>
            🔗 Liquidación Conectada por gRPC:{' '}
          </strong>
          <span style={{ fontSize: 12.5, color: '#047857' }}>
            {linkedTableId && `Mesa ${linkedTableId} se liberará al facturar. `}
            {linkedRoomId && `Habitación ${linkedRoomId} completará Check-Out al facturar. `}
            {workOrderId && `Orden de Taller ${workOrderId} quedará facturada automáticamente.`}
          </span>
        </div>
      )}

      <div className="pk-grid-2">
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">📦 Catálogo Rápido de Productos y Servicios</div>
            <input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="🔎 Buscar producto o SKU..."
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--pk-border)', fontSize: 12.5 }}
            />
          </div>
          <div className="pk-card-body">
            <div className="pk-cards-grid" style={{ marginBottom: 14 }}>
              {filteredCatalog.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: '1px solid var(--pk-border)',
                    borderRadius: 10,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 8,
                    background: '#f8fafc',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span className="pk-badge pk-badge-slate">{p.code}</span>
                      <span
                        className={`pk-badge ${
                          p.stock > p.minStock ? 'pk-badge-emerald' : 'pk-badge-amber'
                        }`}
                      >
                        Stock: {p.stock}
                      </span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 13, marginTop: 6 }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>
                      {p.category} • IVA {p.taxPct}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 14.5, color: 'var(--pk-primary)' }}>
                      {formatCop(p.salePrice)}
                    </strong>
                    <button
                      type="button"
                      className="pk-btn pk-btn-primary pk-btn-sm"
                      onClick={() => addProductToCart(p)}
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddQuickService}
              style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: 12,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: '#334155' }}>
                🛠️ Agregar Servicio Libre / Mano de Obra Especializada
              </div>
              <div className="pk-form-grid">
                <div className="pk-field">
                  <label>Descripción del Servicio</label>
                  <input
                    value={srvName}
                    onChange={(e) => setSrvName(e.target.value)}
                    placeholder="Ej: Mano de Obra Diagnóstico / Instalación"
                  />
                </div>
                <div className="pk-field">
                  <label>Valor ($)</label>
                  <input
                    type="number"
                    min={0}
                    value={srvPrice}
                    onChange={(e) => setSrvPrice(e.target.value)}
                  />
                </div>
                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-outline">
                    ➕ Añadir Servicio
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">🧾 Liquidación de Venta y Caja Registradora</div>
            <span className="pk-badge pk-badge-blue">{posState.nextInvoiceNumber}</span>
          </div>
          <div className="pk-card-body">
            <div className="pk-form-grid">
              <PkAutoCodeInput label="Consecutivo Autorizado" value={posState.nextInvoiceNumber} />
              <PkEntitySelect
                label="Cliente / Adquiriente"
                items={posState.customers}
                value={customerId}
                onChange={(val) => {
                  setCustomerId(val);
                  applyCustomerTariff(val, posState.customers, posState.contracts, posState.tariffs);
                }}
                getValue={(c) => c.id}
                getLabel={(c) => `${c.name} (${c.nit})`}
                onCreateNew={() => openQuickDialog('nuevo-cliente')}
                createLabel="+ Nuevo Cliente"
                searchable
              />
            </div>

            <FacturasTallerBox
              vehicles={posState.vehicles}
              workers={posState.workers}
              vehicleId={vehicleId}
              onVehicleChange={handleSelectVehicle}
              currentKm={currentKm}
              onCurrentKmChange={setCurrentKm}
              nextOilKm={nextOilKm}
              onNextOilKmChange={setNextOilKm}
              mechanicId={mechanicId}
              onMechanicChange={setMechanicId}
              workOrderId={workOrderId}
              onWorkOrderIdChange={setWorkOrderId}
            />

            <div className="pk-table-wrap" style={{ marginTop: 10 }}>
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Detalle</th>
                    <th>Cant.</th>
                    <th>Precio Unit.</th>
                    <th>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={`${item.code}-${idx}`}>
                      <td>
                        <strong>{item.name}</strong>
                        <div style={{ fontSize: 10.5, color: 'var(--pk-muted)' }}>
                          {item.kind} • IVA {item.taxPct}%
                        </div>
                      </td>
                      <td style={{ width: 88 }}>
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => updateCartItem(idx, { qty: Number(e.target.value || 1) })}
                          style={{ width: 68, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--pk-border)' }}
                        />
                      </td>
                      <td style={{ width: 118 }}>
                        <input
                          type="number"
                          min={0}
                          value={item.price}
                          onChange={(e) => updateCartItem(idx, { price: Number(e.target.value || 0) })}
                          style={{ width: 104, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--pk-border)' }}
                        />
                      </td>
                      <td>
                        <strong>{formatCop(item.qty * item.price)}</strong>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pk-btn pk-btn-danger pk-btn-sm"
                          onClick={() => updateCartItem(idx, { qty: 0 })}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cart.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 18 }}>
                        Selecciona productos o servicios de la columna izquierda para iniciar la venta.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pk-form-grid" style={{ marginTop: 14 }}>
              <div className="pk-field">
                <label>Medio de Pago</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="Efectivo">Efectivo en Caja</option>
                  <option value="Transferencia / Nequi">Transferencia / Nequi / PSE</option>
                  <option value="Tarjeta Débito / Crédito">Tarjeta Débito / Crédito</option>
                </select>
              </div>

              <FeatureGate feature="descuento_linea">
                <div className="pk-field">
                  <label>Descuento Convenio / Tarifa (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={discountPct}
                    onChange={(e) => setDiscountPct(e.target.value)}
                  />
                </div>
              </FeatureGate>

              <FeatureGate feature="pagos_mixtos_cxc">
                <div className="pk-field">
                  <label>
                    <span>Modalidad Cartera CxC</span>
                    <input
                      type="checkbox"
                      checked={isCreditMode}
                      onChange={(e) => {
                        setIsCreditMode(e.target.checked);
                        if (e.target.checked && !amountPaidInput) setAmountPaidInput('0');
                      }}
                      style={{ width: 16, height: 16 }}
                    />
                  </label>
                  {isCreditMode ? (
                    <input
                      type="number"
                      min={0}
                      max={grandTotal}
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      placeholder="Abono hoy ($)"
                    />
                  ) : (
                    <input readOnly value="Contado 100%" style={{ background: '#f8fafc' }} />
                  )}
                </div>
              </FeatureGate>

              <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
                <label>Observaciones en Factura</label>
                <input
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="Opcional: orden de compra, garantía o nota de entrega"
                />
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                background: '#f8fafc',
                borderRadius: 10,
                border: '1px solid var(--pk-border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span>Subtotal Bruto:</span>
                <strong>{formatCop(rawSubtotal)}</strong>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--pk-rose)' }}>
                  <span>Descuento ({effectivePct}%):</span>
                  <strong>-{formatCop(discountAmount)}</strong>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span>IVA / Impuestos:</span>
                <strong>{formatCop(taxAmount)}</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 18,
                  fontWeight: 900,
                  marginTop: 6,
                  paddingTop: 6,
                  borderTop: '1px solid #cbd5e1',
                  color: 'var(--pk-primary)',
                }}
              >
                <span>TOTAL A PAGAR:</span>
                <span>{formatCop(grandTotal)}</span>
              </div>
              {isCreditMode && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--pk-amber)', marginTop: 4 }}>
                  <span>Saldo a Cartera CxC:</span>
                  <strong>{formatCop(Math.max(0, grandTotal - Number(amountPaidInput || 0)))}</strong>
                </div>
              )}
            </div>

            <div className="pk-row-actions" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="pk-btn pk-btn-primary"
                onClick={() => void submitInvoice(false)}
              >
                ⚡ Emitir Factura
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-emerald"
                onClick={() => void submitInvoice(true)}
              >
                🖨️ Facturar e Imprimir
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📋 Facturas Emitidas Recientemente</div>
        </div>
        <div className="pk-card-body">
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Placa / Taller</th>
                  <th>Total</th>
                  <th>Saldo CxC</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {posState.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.id}</strong>
                    </td>
                    <td>{inv.date}</td>
                    <td>
                      <strong>{inv.customerName}</strong>
                      <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{inv.customerNit}</div>
                    </td>
                    <td>
                      {inv.plate ? (
                        <div>
                          <span className="pk-badge pk-badge-blue">{inv.plate}</span>
                          {inv.mechanicName && (
                            <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{inv.mechanicName}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--pk-muted)' }}>Mostrador</span>
                      )}
                    </td>
                    <td>
                      <strong>{formatCop(inv.total)}</strong>
                    </td>
                    <td>
                      {inv.pendingBalance > 0 ? (
                        <span className="pk-badge pk-badge-amber">{formatCop(inv.pendingBalance)}</span>
                      ) : (
                        <span style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>$0</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`pk-badge ${
                          inv.pendingBalance > 0 ? 'pk-badge-amber' : 'pk-badge-emerald'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <div className="pk-row-actions">
                        <button
                          type="button"
                          className="pk-btn pk-btn-outline pk-btn-sm"
                          onClick={() => setSelectedInvoice(inv)}
                        >
                          👁️ Ver
                        </button>
                        <button
                          type="button"
                          className="pk-btn pk-btn-primary pk-btn-sm"
                          onClick={() => void printViaService(buildInvoicePrintPayload(inv))}
                        >
                          🖨️ Imprimir
                        </button>
                        {inv.pendingBalance > 0 && (
                          <button
                            type="button"
                            className="pk-btn pk-btn-amber pk-btn-sm"
                            onClick={() => {
                              setActiveServiceKey('ms-clientes');
                              setActiveModuleKey('cartera_cxc');
                            }}
                          >
                            💳 Abonar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PkEntityDialog
        open={Boolean(selectedInvoice)}
        title={`🧾 Detalle de Factura ${selectedInvoice?.id || ''}`}
        onClose={() => setSelectedInvoice(null)}
      >
        {selectedInvoice && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, marginBottom: 12 }}>
              <div>
                <strong>Cliente:</strong> {selectedInvoice.customerName} ({selectedInvoice.customerNit})
              </div>
              <div>
                <strong>Fecha:</strong> {selectedInvoice.date}
              </div>
              <div>
                <strong>Medio de Pago:</strong> {selectedInvoice.paymentMethod}
              </div>
              <div>
                <strong>Formato PDF:</strong> {selectedInvoice.layoutVariant || 'carta_membrete'}
              </div>
              {selectedInvoice.plate && (
                <div>
                  <strong>Placa / Técnico:</strong> {selectedInvoice.plate} — {selectedInvoice.mechanicName || 'N/A'}
                </div>
              )}
              {selectedInvoice.cufe && (
                <div style={{ gridColumn: '1 / -1', fontSize: 11, wordBreak: 'break-all', color: 'var(--pk-muted)' }}>
                  <strong>CUFE:</strong> {selectedInvoice.cufe}
                </div>
              )}
            </div>

            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Cant.</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items.map((it, i) => (
                    <tr key={`${it.code}-${i}`}>
                      <td>{it.code}</td>
                      <td>{it.name}</td>
                      <td>{it.qty}</td>
                      <td>{formatCop(it.price)}</td>
                      <td>
                        <strong>{formatCop(it.qty * it.price)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <div>
                <strong>Total: {formatCop(selectedInvoice.total)}</strong> • Saldo:{' '}
                {formatCop(selectedInvoice.pendingBalance)}
              </div>
              <button
                type="button"
                className="pk-btn pk-btn-primary"
                onClick={() => void printViaService(buildInvoicePrintPayload(selectedInvoice))}
              >
                🖨️ Imprimir Representación Gráfica
              </button>
            </div>
          </div>
        )}
      </PkEntityDialog>
    </div>
  );
};
