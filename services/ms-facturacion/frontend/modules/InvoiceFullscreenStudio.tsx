import React, { useEffect, useMemo, useState } from 'react';
import {
  FeatureGate,
  PkAutoCodeInput,
  PkFullscreenDialog,
  PkProgressBar,
  PkProcessNodes,
  PkSelect,
  PkSimpleSelect,
  PkTypeCardOption,
  PkTypeCards,
  formatCop,
  usePlatform,
} from '@platform/ui-sdk';
import {
  FacturasTallerBox,
  VehicleOption,
  WorkerOption,
} from './FacturasTallerBox';
import {
  InvoiceItemRecord,
  InvoiceRecord,
  InvoiceTypeKey,
  buildFourStageNodes,
  resolveDianStage,
} from './FacturacionDianTab';

export interface CustomerOption {
  id: string;
  code?: string;
  docType?: string;
  nit: string;
  dv?: string;
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  address?: string;
  contractId?: string;
  tariffId?: string;
  creditLimit?: number;
  currentDebt?: number;
}

export interface ContractOption {
  id: string;
  code: string;
  name: string;
  tariffId?: string;
}

export interface TariffOption {
  id: string;
  name: string;
  discountPct: number;
}

export interface ProductOption {
  id: string;
  code: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  salePrice: number;
  taxPct: number;
}

export interface InvoiceStudioInitialDraft {
  editingInvoice?: InvoiceRecord | null;
  invoiceType?: InvoiceTypeKey;
  customerId?: string;
  customerName?: string;
  customerNit?: string;
  vehicleId?: string;
  plate?: string;
  currentKm?: string;
  nextOilKm?: string;
  mechanicId?: string;
  workOrderId?: string;
  linkedRoomId?: string;
  linkedTableId?: string;
  dueDate?: string;
  purchaseOrderRef?: string;
  items?: InvoiceItemRecord[];
  notes?: string;
}

export interface InvoiceStudioSubmitPayload {
  editingInvoiceId?: string;
  saveMode: 'DRAFT' | 'CONFIRM';
  renderPrint: boolean;
  invoiceType: InvoiceTypeKey;
  dueDate: string;
  purchaseOrderRef: string;
  customerId: string;
  customerName: string;
  customerNit: string;
  customerPhone: string;
  customerAddress: string;
  contractId: string;
  discountPct: number;
  vehicleId: string;
  plate: string;
  mechanicId: string;
  mechanicName: string;
  linkedWorkOrderId: string;
  linkedRoomId: string;
  linkedTableId: string;
  workshopMeta: {
    vehicleBrand: string;
    currentKm: string;
    nextOilKm: string;
    workOrderId: string;
  };
  items: InvoiceItemRecord[];
  paymentMethod: string;
  amountPaid: number;
  notes: string;
}

export interface InvoiceFullscreenStudioProps {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  nextInvoiceNumber: string;
  initialState: InvoiceStudioInitialDraft | null;
  customers: CustomerOption[];
  contracts: ContractOption[];
  tariffs: TariffOption[];
  products: ProductOption[];
  vehicles: VehicleOption[];
  workers: WorkerOption[];
  onOpenNewCustomerModal: () => void;
  onOpenNewVehicleModal: () => void;
  onSubmit: (payload: InvoiceStudioSubmitPayload) => void;
}

function defaultDueDate30Days(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export const InvoiceFullscreenStudio: React.FC<InvoiceFullscreenStudioProps> = ({
  open,
  onClose,
  busy,
  nextInvoiceNumber,
  initialState,
  customers,
  contracts,
  tariffs,
  products,
  vehicles,
  workers,
  onOpenNewCustomerModal,
  onOpenNewVehicleModal,
  onSubmit,
}) => {
  const { hasService, hasModule, hasFeature, toast } = usePlatform();

  const hasClientes = hasService('ms-clientes');
  const hasInventario = hasService('ms-inventario');
  const hasHoteleria = hasService('ms-hoteleria');
  const hasComandas = hasService('ms-comandas');
  const hasTallerModule = hasModule('facturas_taller');
  const canCredit = hasFeature('', 'pagos_mixtos_cxc');
  const canDiscount = hasFeature('', 'descuento_linea');

  const editingInv = initialState?.editingInvoice || null;
  const isConfirmedEdit =
    Boolean(editingInv) &&
    (editingInv?.docStatus || 'CONFIRMADA') === 'CONFIRMADA';
  const editingDianStage = editingInv
    ? resolveDianStage(editingInv.dianStage, editingInv.cufe)
    : 'SIN_ENVIAR';

  const [invoiceType, setInvoiceType] = useState<InvoiceTypeKey>('MOSTRADOR');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerNit, setCustomerNit] = useState('');
  const [contractId, setContractId] = useState('');
  const [discountPct, setDiscountPct] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [isCreditMode, setIsCreditMode] = useState(false);
  const [amountPaidInput, setAmountPaidInput] = useState('0');
  const [dueDate, setDueDate] = useState(defaultDueDate30Days);
  const [purchaseOrderRef, setPurchaseOrderRef] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<InvoiceItemRecord[]>([]);

  const [vehicleId, setVehicleId] = useState('');
  const [plateOverride, setPlateOverride] = useState('');
  const [currentKm, setCurrentKm] = useState('');
  const [nextOilKm, setNextOilKm] = useState('');
  const [mechanicId, setMechanicId] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [linkedRoomId, setLinkedRoomId] = useState('');
  const [linkedTableId, setLinkedTableId] = useState('');

  const [catalogSearch, setCatalogSearch] = useState('');
  const [srvName, setSrvName] = useState('');
  const [srvPrice, setSrvPrice] = useState('85000');
  const [srvTaxPct, setSrvTaxPct] = useState('19');

  useEffect(() => {
    if (!open) return;

    if (editingInv) {
      const inferredType = ((editingInv.invoiceType || '').toUpperCase() ||
        (editingInv.plate || editingInv.vehicleId
          ? 'TALLER'
          : editingInv.linkedRoomId
          ? 'HOTELERIA'
          : editingInv.linkedTableId
          ? 'COMANDA'
          : editingInv.contractId || editingInv.purchaseOrderRef
          ? 'CORPORATIVA_CXC'
          : 'MOSTRADOR')) as InvoiceTypeKey;

      setInvoiceType(inferredType);
      setCustomerId(editingInv.customerId || '');
      setCustomerName(editingInv.customerName || '');
      setCustomerNit(editingInv.customerNit || '');
      setContractId(editingInv.contractId || '');
      setDiscountPct(String(editingInv.discountPct || 0));
      setPaymentMethod(
        editingInv.pendingBalance > 0
          ? 'Efectivo'
          : editingInv.paymentMethod || 'Efectivo'
      );
      setIsCreditMode(
        editingInv.pendingBalance > 0 || inferredType === 'CORPORATIVA_CXC'
      );
      setAmountPaidInput(String(editingInv.amountPaid ?? 0));
      setDueDate(editingInv.dueDate || defaultDueDate30Days());
      setPurchaseOrderRef(editingInv.purchaseOrderRef || '');
      setNotes(editingInv.notes || '');
      setCart((editingInv.items || []).map((it) => ({ ...it })));

      setVehicleId(editingInv.vehicleId || '');
      setPlateOverride(editingInv.plate || '');
      setCurrentKm(editingInv.workshopMeta?.currentKm || '');
      setNextOilKm(editingInv.workshopMeta?.nextOilKm || '');
      setMechanicId(editingInv.mechanicId || '');
      setWorkOrderId(editingInv.workshopMeta?.workOrderId || '');
      setLinkedRoomId(editingInv.linkedRoomId || '');
      setLinkedTableId(editingInv.linkedTableId || '');
      return;
    }

    const initType = initialState?.invoiceType || 'MOSTRADOR';
    setInvoiceType(initType);

    const initCustId = initialState?.customerId || '';
    const foundCust = customers.find((c) => c.id === initCustId);
    setCustomerId(initCustId);
    setCustomerName(
      foundCust?.name || initialState?.customerName || 'Consumidor Final Mostrador'
    );
    setCustomerNit(foundCust?.nit || initialState?.customerNit || '222222222222');
    setContractId(foundCust?.contractId || '');

    if (foundCust && canDiscount) {
      const cnt = contracts.find((ct) => ct.id === foundCust.contractId);
      const trf = tariffs.find(
        (t) => t.id === (cnt?.tariffId || foundCust.tariffId)
      );
      setDiscountPct(trf ? String(trf.discountPct) : '0');
    } else {
      setDiscountPct('0');
    }

    setPaymentMethod('Efectivo');
    setIsCreditMode(initType === 'CORPORATIVA_CXC');
    setAmountPaidInput('0');
    setDueDate(initialState?.dueDate || defaultDueDate30Days());
    setPurchaseOrderRef(initialState?.purchaseOrderRef || '');
    setNotes(initialState?.notes || '');
    setCart((initialState?.items || []).map((it) => ({ ...it })));

    setVehicleId(initialState?.vehicleId || '');
    setPlateOverride(initialState?.plate || '');
    setCurrentKm(initialState?.currentKm || '');
    setNextOilKm(initialState?.nextOilKm || '');
    setMechanicId(initialState?.mechanicId || '');
    setWorkOrderId(initialState?.workOrderId || '');
    setLinkedRoomId(initialState?.linkedRoomId || '');
    setLinkedTableId(initialState?.linkedTableId || '');
  }, [open, editingInv, initialState, customers, contracts, tariffs, canDiscount]);

  const typeOptions = useMemo<PkTypeCardOption[]>(() => {
    const opts: PkTypeCardOption[] = [
      {
        key: 'MOSTRADOR',
        icon: '🛒',
        title: 'Venta Estándar / Mostrador POS',
        description: 'Liquidación rápida de productos y servicios en mostrador.',
      },
    ];
    if (hasTallerModule) {
      opts.push({
        key: 'TALLER',
        icon: '🔧',
        title: 'Factura Automotriz / Taller',
        description: 'Placa, kilometraje, orden de trabajo OT y comisión técnico.',
        badge: 'Automotriz',
      });
    }
    if (hasHoteleria || Boolean(linkedRoomId)) {
      opts.push({
        key: 'HOTELERIA',
        icon: '🏨',
        title: 'Check-Out Hotelero',
        description: 'Cierre de habitación/suite, alojamiento y consumos.',
      });
    }
    if (hasComandas || Boolean(linkedTableId)) {
      opts.push({
        key: 'COMANDA',
        icon: '🍽️',
        title: 'Cuenta Gastronómica',
        description: 'Liquidación de mesa, domicilio o pedido de restaurante.',
      });
    }
    if (canCredit) {
      opts.push({
        key: 'CORPORATIVA_CXC',
        icon: '🏢',
        title: 'Factura Corporativa / Convenio Crédito',
        description: 'Orden de compra, fecha de vencimiento y cartera CxC.',
        badge: 'Crédito CxC',
      });
    }
    return opts;
  }, [hasTallerModule, hasHoteleria, hasComandas, canCredit, linkedRoomId, linkedTableId]);

  const handleSelectCustomer = (custId: string) => {
    setCustomerId(custId);
    const cust = customers.find((c) => c.id === custId);
    if (!cust) {
      setCustomerName('Consumidor Final Mostrador');
      setCustomerNit('222222222222');
      setContractId('');
      setDiscountPct('0');
      return;
    }
    setCustomerName(cust.name);
    setCustomerNit(cust.nit);
    setContractId(cust.contractId || '');
    const cnt = contracts.find((ct) => ct.id === cust.contractId);
    const trf = tariffs.find((t) => t.id === (cnt?.tariffId || cust.tariffId));
    if (trf && canDiscount) {
      setDiscountPct(String(trf.discountPct));
    } else {
      setDiscountPct('0');
    }
  };

  const handleSelectVehicle = (vehId: string) => {
    setVehicleId(vehId);
    const found = vehicles.find((v) => v.id === vehId);
    if (found) {
      setPlateOverride(found.plate);
      const nextKmVal = found.nextOilKm ?? found.nextOilChangeKm ?? 0;
      setCurrentKm(
        found.currentKm ? `${found.currentKm.toLocaleString('es-CO')} km` : ''
      );
      setNextOilKm(
        nextKmVal ? `${nextKmVal.toLocaleString('es-CO')} km` : ''
      );
      if (found.customerId) {
        handleSelectCustomer(found.customerId);
      }
    } else {
      setPlateOverride('');
      setCurrentKm('');
      setNextOilKm('');
    }
  };

  const addProductToCart = (p: ProductOption) => {
    setCart((prev) => {
      const idx = prev.findIndex(
        (it) => it.itemType === 'PRODUCTO' && it.productId === p.id
      );
      if (idx >= 0) {
        const copy = [...prev];
        const nextQty = copy[idx].quantity + 1;
        copy[idx] = {
          ...copy[idx],
          quantity: nextQty,
          subtotal: Math.round(nextQty * copy[idx].unitPrice),
        };
        return copy;
      }
      return [
        ...prev,
        {
          productId: p.id,
          code: p.code,
          description: p.name,
          itemType: 'PRODUCTO',
          quantity: 1,
          unitPrice: p.salePrice,
          taxPct: p.taxPct,
          subtotal: Math.round(p.salePrice),
        },
      ];
    });
  };

  const handleAddQuickService = (e: React.FormEvent) => {
    e.preventDefault();
    const desc = srvName.trim();
    const priceVal = Number(srvPrice || 0);
    const taxVal = Math.max(0, Math.min(100, Number(srvTaxPct || 0)));
    if (!desc || !Number.isFinite(priceVal) || priceVal <= 0) {
      toast('Ingresa la descripción del servicio y un valor mayor a cero');
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        productId: '',
        code: 'SRV-MO',
        description: desc,
        itemType: 'SERVICIO',
        quantity: 1,
        unitPrice: priceVal,
        taxPct: taxVal,
        subtotal: Math.round(priceVal),
        workerId: invoiceType === 'TALLER' ? mechanicId || undefined : undefined,
      },
    ]);
    setSrvName('');
  };

  const updateCartItem = (index: number, patch: Partial<InvoiceItemRecord>) => {
    setCart((prev) => {
      const next = [...prev];
      const updated = { ...next[index], ...patch };
      if (updated.quantity <= 0) {
        next.splice(index, 1);
      } else {
        updated.subtotal = Math.round(updated.quantity * updated.unitPrice);
        next[index] = updated;
      }
      return next;
    });
  };

  const rawSubtotal = cart.reduce(
    (acc, it) => acc + it.quantity * it.unitPrice,
    0
  );
  const effectivePct = canDiscount
    ? Math.min(100, Math.max(0, Number(discountPct || 0)))
    : 0;
  const discountAmount = Math.round((rawSubtotal * effectivePct) / 100);
  const discountRatio = rawSubtotal > 0 ? discountAmount / rawSubtotal : 0;
  const taxAmount = Math.round(
    cart.reduce(
      (acc, it) =>
        acc + it.quantity * it.unitPrice * (1 - discountRatio) * (it.taxPct / 100),
      0
    )
  );
  const grandTotal = Math.round(rawSubtotal - discountAmount + taxAmount);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const effectiveCreditMode = isCreditMode || invoiceType === 'CORPORATIVA_CXC';
  const paidAmount = effectiveCreditMode
    ? Math.min(grandTotal, Math.max(0, Number(amountPaidInput || 0)))
    : grandTotal;
  const pendingBalancePreview = Math.max(0, grandTotal - paidAmount);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, catalogSearch]);

  const customerSelectItems: CustomerOption[] = [
    {
      id: '',
      nit: '222222222222',
      name: 'Consumidor Final Mostrador',
    },
    ...customers,
  ];

  const triggerSubmit = (saveMode: 'DRAFT' | 'CONFIRM', renderPrint: boolean) => {
    if (cart.length === 0) {
      toast('Agrega al menos un producto o servicio al carrito para continuar');
      return;
    }
    if (effectiveCreditMode && pendingBalancePreview > 0.009 && !customerId) {
      toast('Selecciona un cliente identificado para registrar saldo en Cartera CxC');
      return;
    }

    const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
    const selectedWorker = workers.find((w) => w.id === mechanicId);

    const isTaller = invoiceType === 'TALLER';
    const isHotel = invoiceType === 'HOTELERIA';
    const isComanda = invoiceType === 'COMANDA';
    const isCorp = invoiceType === 'CORPORATIVA_CXC';

    onSubmit({
      editingInvoiceId: editingInv?.id,
      saveMode,
      renderPrint,
      invoiceType,
      dueDate: isCorp || effectiveCreditMode ? dueDate : '',
      purchaseOrderRef: isCorp ? purchaseOrderRef.trim() : '',
      customerId,
      customerName: customerName.trim() || 'Consumidor Final Mostrador',
      customerNit: customerNit.trim() || '222222222222',
      customerPhone: selectedCustomer?.phone || editingInv?.customerPhone || '',
      customerAddress: selectedCustomer
        ? `${selectedCustomer.address || ''} ${selectedCustomer.city || ''}`.trim()
        : editingInv?.customerAddress || '',
      contractId: isCorp ? contractId : selectedCustomer?.contractId || '',
      discountPct: effectivePct,
      vehicleId: isTaller ? vehicleId : '',
      plate: isTaller ? selectedVehicle?.plate || plateOverride || '' : '',
      mechanicId: isTaller ? mechanicId : '',
      mechanicName: isTaller ? selectedWorker?.name || '' : '',
      linkedWorkOrderId: isTaller ? workOrderId : '',
      linkedRoomId: isHotel ? linkedRoomId : '',
      linkedTableId: isComanda ? linkedTableId : '',
      workshopMeta: isTaller
        ? {
            vehicleBrand: selectedVehicle
              ? `${selectedVehicle.brand} ${selectedVehicle.modelYear || ''}`.trim()
              : editingInv?.workshopMeta?.vehicleBrand || '',
            currentKm,
            nextOilKm,
            workOrderId,
          }
        : { vehicleBrand: '', currentKm: '', nextOilKm: '', workOrderId: '' },
      items: cart,
      paymentMethod:
        effectiveCreditMode && pendingBalancePreview > 0
          ? 'Crédito / Cartera CxC'
          : paymentMethod,
      amountPaid: paidAmount,
      notes: notes.trim(),
    });
  };

  const processSteps = editingInv
    ? buildFourStageNodes(editingInv.docStatus, editingInv.dianStage, editingInv.cufe)
    : buildFourStageNodes('BORRADOR', 'SIN_ENVIAR', '');

  return (
    <PkFullscreenDialog
      open={open}
      onClose={onClose}
      title={
        editingInv
          ? `✏️ Editar Factura ${editingInv.id}`
          : '🧾 Estudio Modular de Facturación Comercial'
      }
      subtitle={
        editingInv
          ? 'Actualiza líneas, datos tributarios o condiciones de pago antes de transmitir o subsanar ante la DIAN.'
          : 'Selecciona el tipo de operación para desplegar únicamente sus apartados especializados y guarda como borrador o confirma en firme.'
      }
      badge={{
        label: editingInv
          ? editingDianStage === 'RECHAZADA'
            ? 'Subsanación DIAN'
            : editingInv.docStatus === 'BORRADOR'
            ? `Borrador ${editingInv.id}`
            : `Confirmada ${editingInv.id}`
          : `Próxima Oficial: ${nextInvoiceNumber}`,
        tone:
          editingDianStage === 'RECHAZADA'
            ? 'rose'
            : editingInv?.docStatus === 'BORRADOR'
            ? 'amber'
            : 'blue',
      }}
      subheader={
        <div className="pk-stack" style={{ gap: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
              padding: '8px 14px',
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid var(--pk-border)',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--pk-navy)' }}>
              Ciclo Fiscal en 4 Etapas Conectadas
            </div>
            <div style={{ flex: 1, minWidth: 280, maxWidth: 680 }}>
              <PkProcessNodes steps={processSteps} compact />
            </div>
          </div>

          <PkTypeCards
            label="Selecciona la Modalidad Operativa de la Factura"
            options={typeOptions}
            value={invoiceType}
            onChange={(key) => {
              const nextKey = key as InvoiceTypeKey;
              setInvoiceType(nextKey);
              if (nextKey === 'CORPORATIVA_CXC') {
                setIsCreditMode(true);
              }
            }}
          />
        </div>
      }
      footerLeft={
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', fontWeight: 700 }}>
              RESUMEN DEL DOCUMENTO ({cart.length} ÍTEMS)
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--pk-navy)' }}>
              Total: {formatCop(grandTotal)}
              {pendingBalancePreview > 0 && (
                <span
                  style={{
                    marginLeft: 10,
                    fontSize: 13,
                    color: 'var(--pk-amber)',
                    fontWeight: 800,
                  }}
                >
                  • Saldo CxC: {formatCop(pendingBalancePreview)}
                </span>
              )}
            </div>
          </div>
        </div>
      }
      footerActions={
        <>
          <button
            type="button"
            className="pk-btn pk-btn-outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          {!isConfirmedEdit && (
            <button
              type="button"
              className="pk-btn pk-btn-amber"
              disabled={busy}
              onClick={() => triggerSubmit('DRAFT', false)}
            >
              {busy ? 'Guardando...' : '💾 Guardar Borrador'}
            </button>
          )}
          <button
            type="button"
            className="pk-btn pk-btn-primary"
            disabled={busy}
            onClick={() => triggerSubmit('CONFIRM', false)}
          >
            {busy
              ? 'Procesando...'
              : isConfirmedEdit
              ? '💾 Guardar Corrección'
              : '✅ Confirmar Factura'}
          </button>
          <button
            type="button"
            className="pk-btn pk-btn-emerald"
            disabled={busy}
            onClick={() => triggerSubmit('CONFIRM', true)}
          >
            {busy
              ? 'Procesando...'
              : isConfirmedEdit
              ? '🖨️ Guardar e Imprimir'
              : '🖨️ Confirmar e Imprimir'}
          </button>
        </>
      }
    >
      <div className="pk-stack">
        {editingDianStage === 'RECHAZADA' && editingInv && (
          <div
            className="pk-card"
            style={{
              background: '#fff1f2',
              borderColor: '#fda4af',
              padding: '14px 18px',
            }}
          >
            <strong style={{ color: '#be123c', fontSize: 13.5 }}>
              ⚠️ Subsanación de Rechazo DIAN ({editingInv.rejectionCode || 'DIAN-RUT-04'}):{' '}
            </strong>
            <span style={{ fontSize: 13, color: '#9f1239' }}>
              {editingInv.rejectionMessage ||
                'Revisa el NIT, razón social o valores del documento.'}{' '}
              Al guardar los cambios podrás volver a transmitir en el Paso 1 DIAN.
            </span>
          </div>
        )}

        <div className="pk-grid-2" style={{ alignItems: 'start' }}>
          {/* LEFT PANEL: CATALOG + QUICK SERVICE */}
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                📦 Catálogo Visual y Servicios Libres
              </div>
              <input
                className="pk-input"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="🔎 Filtrar por nombre, SKU o categoría..."
                style={{ maxWidth: 260, minHeight: 38 }}
              />
            </div>
            <div className="pk-card-body">
              {filteredCatalog.length > 0 ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                    gap: 12,
                    marginBottom: 20,
                    maxHeight: 430,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {filteredCatalog.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        border: '1px solid var(--pk-border)',
                        borderRadius: 12,
                        padding: '13px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 10,
                        background: '#f8fafc',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 6,
                          }}
                        >
                          <span className="pk-badge pk-badge-slate">{p.code}</span>
                          <span
                            className={`pk-badge ${
                              p.stock > p.minStock
                                ? 'pk-badge-emerald'
                                : 'pk-badge-amber'
                            }`}
                          >
                            Stock: {p.stock}
                          </span>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 13.5, marginTop: 8 }}>
                          {p.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--pk-muted)',
                            marginTop: 2,
                          }}
                        >
                          {p.category} • IVA {p.taxPct}%
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: 6,
                          borderTop: '1px solid #e2e8f0',
                        }}
                      >
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
              ) : (
                <div
                  style={{
                    padding: '14px 0',
                    fontSize: 13,
                    color: 'var(--pk-muted)',
                  }}
                >
                  {hasInventario
                    ? 'No se encontraron productos para el criterio ingresado.'
                    : 'Catálogo de inventario desacoplado; agrega conceptos o servicios libres debajo.'}
                </div>
              )}

              <form
                onSubmit={handleAddQuickService}
                style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    marginBottom: 12,
                    color: 'var(--pk-navy)',
                  }}
                >
                  🛠️ Agregar Servicio Libre / Concepto Personalizado
                </div>
                <div className="pk-form-grid cols-2">
                  <div className="pk-field pk-col-span-full">
                    <label>Descripción del Servicio o Concepto</label>
                    <input
                      value={srvName}
                      onChange={(e) => setSrvName(e.target.value)}
                      placeholder="Ej: Mano de obra especializada, alojamiento o asesoría"
                    />
                  </div>
                  <div className="pk-field">
                    <label>Valor Unitario ($)</label>
                    <input
                      type="number"
                      min={1}
                      value={srvPrice}
                      onChange={(e) => setSrvPrice(e.target.value)}
                    />
                  </div>
                  <PkSimpleSelect
                    label="Tarifa IVA (%)"
                    value={srvTaxPct}
                    onChange={setSrvTaxPct}
                    searchable={false}
                    options={[
                      { value: '0', label: '0% — Excluido / Exento' },
                      { value: '5', label: '5% — Tarifa Reducida' },
                      { value: '8', label: '8% — Impoconsumo Gastronomía' },
                      { value: '19', label: '19% — Tarifa General IVA' },
                    ]}
                  />
                  <div className="pk-form-actions pk-col-span-full">
                    <button type="submit" className="pk-btn pk-btn-outline">
                      + Añadir Concepto al Carrito
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* RIGHT PANEL: MODULAR HEADER + CART + TOTALS */}
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                🧾 Titular Fiscal, Apartado Operativo y Carrito
              </div>
              <span className="pk-badge pk-badge-blue">
                {editingInv ? editingInv.id : nextInvoiceNumber}
              </span>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid cols-2">
                <PkAutoCodeInput
                  label="Numeración Documento"
                  value={editingInv ? editingInv.id : nextInvoiceNumber}
                />
                <PkSelect
                  label="Directorio de Clientes"
                  items={customerSelectItems}
                  value={customerId}
                  onChange={handleSelectCustomer}
                  getValue={(c) => c.id}
                  getLabel={(c) => `${c.name} (${c.nit})`}
                  onCreateNew={hasClientes ? onOpenNewCustomerModal : undefined}
                  createLabel="+ Nuevo Cliente"
                  searchable
                />
                <div className="pk-field">
                  <label>Razón Social / Nombre en Factura</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Consumidor Final Mostrador"
                  />
                </div>
                <div className="pk-field">
                  <label>NIT / Identificación Tributaria</label>
                  <input
                    value={customerNit}
                    onChange={(e) => setCustomerNit(e.target.value)}
                    placeholder="Ej: 901.245.880-1"
                  />
                </div>
              </div>

              {/* STRICTLY MODULAR SECTION BY SELECTED INVOICE TYPE */}
              {invoiceType === 'TALLER' && (
                <FacturasTallerBox
                  vehicles={vehicles}
                  workers={workers}
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
                  onOpenNewVehicleModal={onOpenNewVehicleModal}
                />
              )}

              {invoiceType === 'HOTELERIA' && (
                <div
                  style={{
                    margin: '16px 0',
                    padding: '15px 18px',
                    borderRadius: 12,
                    border: '1px solid #a7f3d0',
                    background: '#ecfdf5',
                  }}
                >
                  <strong style={{ fontSize: 13, color: '#065f46', display: 'block', marginBottom: 10 }}>
                    🏨 Liquidación de Check-Out Hotelero
                  </strong>
                  <div className="pk-form-grid cols-2">
                    <div className="pk-field pk-col-span-full">
                      <label>Habitación o Suite Vinculada</label>
                      <input
                        value={linkedRoomId}
                        onChange={(e) => setLinkedRoomId(e.target.value)}
                        placeholder="Ej: hab-302 / Suite Ejecutiva 401"
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#047857', marginTop: 8 }}>
                    Nota: Al confirmar la factura (Etapa 2), la habitación completará
                    Check-Out automáticamente; en Borrador permanece abierta.
                  </div>
                </div>
              )}

              {invoiceType === 'COMANDA' && (
                <div
                  style={{
                    margin: '16px 0',
                    padding: '15px 18px',
                    borderRadius: 12,
                    border: '1px solid #fed7aa',
                    background: '#fff7ed',
                  }}
                >
                  <strong style={{ fontSize: 13, color: '#9a3412', display: 'block', marginBottom: 10 }}>
                    🍽️ Cierre de Cuenta Gastronómica / Comanda
                  </strong>
                  <div className="pk-form-grid cols-2">
                    <div className="pk-field pk-col-span-full">
                      <label>Mesa / Cuenta Gastronómica Asociada</label>
                      <input
                        value={linkedTableId}
                        onChange={(e) => setLinkedTableId(e.target.value)}
                        placeholder="Ej: mesa-04 / Domicilio #0047"
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#c2410c', marginTop: 8 }}>
                    Nota: La mesa o pedido se liberará únicamente cuando confirmes la
                    factura en firme.
                  </div>
                </div>
              )}

              {invoiceType === 'CORPORATIVA_CXC' && (
                <div
                  style={{
                    margin: '16px 0',
                    padding: '15px 18px',
                    borderRadius: 12,
                    border: '1px solid #c7d2fe',
                    background: '#eef2ff',
                  }}
                >
                  <strong style={{ fontSize: 13, color: '#3730a3', display: 'block', marginBottom: 10 }}>
                    🏢 Condiciones Corporativas, Convenio y Cartera CxC
                  </strong>
                  <div className="pk-form-grid cols-2">
                    <div className="pk-field">
                      <label>Orden de Compra (OC)</label>
                      <input
                        value={purchaseOrderRef}
                        onChange={(e) => setPurchaseOrderRef(e.target.value)}
                        placeholder="Ej: OC-2026-890"
                      />
                    </div>
                    <div className="pk-field">
                      <label>Fecha de Vencimiento Factura</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                    {contracts.length > 0 && (
                      <div className="pk-col-span-full">
                        <PkSelect
                          label="Convenio Comercial Asociado"
                          items={[
                            { id: '', code: '', name: '— Sin convenio específico —' },
                            ...contracts,
                          ]}
                          value={contractId}
                          onChange={setContractId}
                          getValue={(ct) => ct.id}
                          getLabel={(ct) =>
                            ct.id ? `${ct.code} — ${ct.name}` : ct.name
                          }
                        />
                      </div>
                    )}
                    <div className="pk-field pk-col-span-full">
                      <label>Abono Inicial Recibido Hoy ($)</label>
                      <input
                        type="number"
                        min={0}
                        max={grandTotal}
                        value={amountPaidInput}
                        onChange={(e) => setAmountPaidInput(e.target.value)}
                        placeholder="0 para 100% crédito"
                      />
                    </div>
                  </div>
                  {selectedCustomer && (selectedCustomer.creditLimit || 0) > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <PkProgressBar
                        label={`Uso de Cupo Autorizado (${formatCop(selectedCustomer.creditLimit || 0)})`}
                        valueLabel={formatCop(
                          (selectedCustomer.currentDebt || 0) + pendingBalancePreview
                        )}
                        pct={
                          (((selectedCustomer.currentDebt || 0) +
                            pendingBalancePreview) /
                            Math.max(1, selectedCustomer.creditLimit || 1)) *
                          100
                        }
                        tone={
                          (selectedCustomer.currentDebt || 0) +
                            pendingBalancePreview >
                          (selectedCustomer.creditLimit || 0)
                            ? 'rose'
                            : 'blue'
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              {/* CART ITEMS TABLE */}
              <div className="pk-table-wrap" style={{ marginTop: 16 }}>
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Concepto / Ítem</th>
                      <th>Cant.</th>
                      <th>Vr. Unitario</th>
                      <th>Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, idx) => {
                      const lockedCatalogPrice =
                        Boolean(item.productId) && hasInventario;
                      return (
                        <tr key={`${item.code}-${idx}`}>
                          <td>
                            <strong>{item.description}</strong>
                            <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                              {item.code} • {item.itemType} • IVA {item.taxPct}%
                            </div>
                          </td>
                          <td style={{ width: 88 }}>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={(e) =>
                                updateCartItem(idx, {
                                  quantity: Number(e.target.value || 1),
                                })
                              }
                              style={{
                                width: 70,
                                padding: '6px 8px',
                                borderRadius: 8,
                                border: '1px solid var(--pk-border-strong)',
                              }}
                            />
                          </td>
                          <td style={{ width: 126 }}>
                            <input
                              type="number"
                              min={1}
                              value={item.unitPrice}
                              readOnly={lockedCatalogPrice}
                              onChange={(e) =>
                                updateCartItem(idx, {
                                  unitPrice: Number(e.target.value || 0),
                                })
                              }
                              style={{
                                width: 110,
                                padding: '6px 8px',
                                borderRadius: 8,
                                border: '1px solid var(--pk-border-strong)',
                                background: lockedCatalogPrice
                                  ? '#f1f5f9'
                                  : undefined,
                              }}
                            />
                          </td>
                          <td>
                            <strong>
                              {formatCop(item.quantity * item.unitPrice)}
                            </strong>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="pk-btn pk-btn-danger pk-btn-sm"
                              onClick={() => updateCartItem(idx, { quantity: 0 })}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {cart.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            textAlign: 'center',
                            color: 'var(--pk-muted)',
                            padding: 24,
                          }}
                        >
                          Selecciona productos o servicios en el panel izquierdo para
                          construir la factura.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAYMENT & DISCOUNT */}
              <div className="pk-form-grid cols-2" style={{ marginTop: 16 }}>
                <PkSimpleSelect
                  label="Medio de Recaudo Principal"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  searchable={false}
                  options={[
                    { value: 'Efectivo', label: 'Efectivo en Caja' },
                    {
                      value: 'Transferencia / Nequi',
                      label: 'Transferencia / Nequi / PSE',
                    },
                    {
                      value: 'Tarjeta Débito / Crédito',
                      label: 'Tarjeta Débito / Crédito',
                    },
                  ]}
                />

                <FeatureGate feature="descuento_linea">
                  <div className="pk-field">
                    <label>Descuento Comercial (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={discountPct}
                      onChange={(e) => setDiscountPct(e.target.value)}
                    />
                  </div>
                </FeatureGate>

                {invoiceType !== 'CORPORATIVA_CXC' && (
                  <FeatureGate feature="pagos_mixtos_cxc">
                    <div className="pk-field pk-col-span-full">
                      <label>
                        <span>Habilitar Pago Parcial / Cartera CxC</span>
                        <input
                          type="checkbox"
                          checked={isCreditMode}
                          onChange={(e) => {
                            setIsCreditMode(e.target.checked);
                            if (e.target.checked && !amountPaidInput) {
                              setAmountPaidInput('0');
                            }
                          }}
                          style={{ width: 16, height: 16, minHeight: 16 }}
                        />
                      </label>
                      {isCreditMode && (
                        <input
                          type="number"
                          min={0}
                          max={grandTotal}
                          value={amountPaidInput}
                          onChange={(e) => setAmountPaidInput(e.target.value)}
                          placeholder="Valor abonado hoy ($)"
                        />
                      )}
                    </div>
                  </FeatureGate>
                )}

                <div className="pk-field pk-col-span-full">
                  <label>Notas / Observaciones Comerciales</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Condiciones de garantía, entrega o referencia interna..."
                  />
                </div>
              </div>

              {/* TOTALS BOX */}
              <div
                style={{
                  marginTop: 16,
                  padding: '16px 18px',
                  background: '#f8fafc',
                  borderRadius: 12,
                  border: '1px solid var(--pk-border)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    marginBottom: 4,
                  }}
                >
                  <span>Subtotal Bruto:</span>
                  <strong>{formatCop(rawSubtotal)}</strong>
                </div>
                {discountAmount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      color: 'var(--pk-rose)',
                      marginBottom: 4,
                    }}
                  >
                    <span>Descuento ({effectivePct}%):</span>
                    <strong>-{formatCop(discountAmount)}</strong>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                  }}
                >
                  <span>IVA / Impuestos:</span>
                  <strong>{formatCop(taxAmount)}</strong>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 18,
                    fontWeight: 900,
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid #cbd5e1',
                    color: 'var(--pk-primary)',
                  }}
                >
                  <span>TOTAL FACTURA:</span>
                  <span>{formatCop(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PkFullscreenDialog>
  );
};
