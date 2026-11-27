import React, { useEffect, useMemo, useState } from 'react';
import {
  FeatureGate,
  PkAutoCodeInput,
  PkFullscreenDialog,
  PkModal,
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

export interface ComandaOrderItemOption {
  itemId: string;
  productId: string;
  name: string;
  qty: number;
  price: number;
  note?: string;
}

export interface ComandaOrderOption {
  id: string;
  name: string;
  zone: string;
  waiter: string;
  status: string;
  orderCode?: string;
  channel?: string;
  orderStage?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  guests?: number;
  paymentHint?: string;
  openedAt?: string;
  items: ComandaOrderItemOption[];
  total: number;
}

export interface ComandaMenuOption {
  id: string;
  code: string;
  name: string;
  category: string;
  salePrice: number;
  taxPct?: number;
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
  comandaOrders?: ComandaOrderOption[];
  comandaMenu?: ComandaMenuOption[];
  onOpenNewCustomerModal: () => void;
  onOpenNewVehicleModal: () => void;
  onSubmit: (payload: InvoiceStudioSubmitPayload) => void;
}

type ItemDialogMode = 'PRODUCTO' | 'SERVICIO';

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
  comandaOrders = [],
  comandaMenu = [],
  onOpenNewCustomerModal,
  onOpenNewVehicleModal,
  onSubmit,
}) => {
  const { hasService, hasModule, hasFeature, toast } = usePlatform();

  const hasClientes = hasService('ms-clientes');
  const hasInventario = hasService('ms-inventario');
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

  // Dedicated Comanda Order Selector Dialog state
  const [comandaDialogOpen, setComandaDialogOpen] = useState(false);
  const [comandaSearch, setComandaSearch] = useState('');
  const [comandaChannelFilter, setComandaChannelFilter] = useState<string>('ALL');

  // Dedicated Item Selector Dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemDialogMode, setItemDialogMode] = useState<ItemDialogMode>('PRODUCTO');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogCategory, setCatalogCategory] = useState('ALL');
  const [qtyDraftByProduct, setQtyDraftByProduct] = useState<Record<string, string>>({});

  const [srvCode, setSrvCode] = useState('SRV-MO');
  const [srvName, setSrvName] = useState('');
  const [srvQty, setSrvQty] = useState('1');
  const [srvPrice, setSrvPrice] = useState('85000');
  const [srvTaxPct, setSrvTaxPct] = useState('19');

  useEffect(() => {
    if (!open) {
      setItemDialogOpen(false);
      setComandaDialogOpen(false);
      return;
    }

    if (editingInv) {
      const rawType = (editingInv.invoiceType || '').toUpperCase();
      const inferredType: InvoiceTypeKey =
        rawType === 'TALLER' || editingInv.plate || editingInv.vehicleId
          ? 'TALLER'
          : rawType === 'COMANDA' || editingInv.linkedTableId
          ? 'COMANDA'
          : rawType === 'CORPORATIVA_CXC' ||
            editingInv.contractId ||
            editingInv.purchaseOrderRef
          ? 'CORPORATIVA_CXC'
          : 'MOSTRADOR';

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
        title: 'Factura Estándar / Mostrador',
        description: 'Liquidación directa de productos y servicios comerciales.',
      },
    ];
    if (hasComandas) {
      opts.push({
        key: 'COMANDA',
        icon: '🍽️',
        title: 'Liquidación de Comanda / Orden',
        description: 'Selecciona la orden o mesa activa y carga sus servicios automáticamente.',
        badge: 'Comandas',
      });
    }
    if (hasTallerModule) {
      opts.push({
        key: 'TALLER',
        icon: '🔧',
        title: 'Factura Automotriz / Taller',
        description: 'Placa, kilometraje, orden de trabajo OT y comisión técnico.',
        badge: 'Automotriz',
      });
    }
    if (canCredit) {
      opts.push({
        key: 'CORPORATIVA_CXC',
        icon: '🏢',
        title: 'Factura Corporativa / Crédito CxC',
        description: 'Orden de compra, fecha de vencimiento y cartera CxC.',
        badge: 'Crédito CxC',
      });
    }
    return opts;
  }, [hasComandas, hasTallerModule, canCredit]);

  const openComandaOrders = useMemo(
    () => comandaOrders.filter((ord) => (ord.items || []).length > 0),
    [comandaOrders]
  );

  const selectedComandaOrder = useMemo(
    () => comandaOrders.find((ord) => ord.id === linkedTableId) || null,
    [comandaOrders, linkedTableId]
  );

  const filteredComandaOrders = useMemo(() => {
    const q = comandaSearch.trim().toLowerCase();
    return openComandaOrders.filter((ord) => {
      const ch = (ord.channel || 'MESA').toUpperCase();
      if (comandaChannelFilter !== 'ALL' && ch !== comandaChannelFilter) {
        return false;
      }
      if (!q) return true;
      const dishesText = (ord.items || [])
        .map((it) => `${it.name} ${it.note || ''}`)
        .join(' ')
        .toLowerCase();
      return (
        (ord.orderCode || '').toLowerCase().includes(q) ||
        ord.name.toLowerCase().includes(q) ||
        (ord.customerName || '').toLowerCase().includes(q) ||
        (ord.waiter || '').toLowerCase().includes(q) ||
        (ord.zone || '').toLowerCase().includes(q) ||
        dishesText.includes(q)
      );
    });
  }, [openComandaOrders, comandaChannelFilter, comandaSearch]);

  const handleSelectComandaOrder = (ord: ComandaOrderOption) => {
    setInvoiceType('COMANDA');
    setLinkedTableId(ord.id);

    if (
      ord.customerName &&
      ord.customerName.trim() !== '' &&
      (!customerId &&
        (customerName.trim() === '' ||
          customerName === 'Consumidor Final Mostrador'))
    ) {
      setCustomerName(ord.customerName.trim());
    }

    const mappedItems: InvoiceItemRecord[] = (ord.items || []).map((it) => {
      const candidateId = (it.productId || '').trim();
      const isMenuDish = !candidateId || candidateId.toLowerCase().startsWith('mnu-');
      const matchedWarehouseProd =
        !isMenuDish && hasInventario
          ? products.find(
              (p) =>
                p.id === candidateId ||
                p.code.toUpperCase() === candidateId.toUpperCase()
            )
          : undefined;
      const menuRef = comandaMenu.find((m) => m.id === candidateId);

      const resolvedProdId = matchedWarehouseProd ? matchedWarehouseProd.id : '';
      const resolvedType: 'PRODUCTO' | 'SERVICIO' =
        resolvedProdId !== '' ? 'PRODUCTO' : 'SERVICIO';
      const qty = Math.max(1, Number(it.qty || 1));
      const unitPrice = Math.max(0, Number(it.price || 0));
      const taxPct = matchedWarehouseProd
        ? matchedWarehouseProd.taxPct
        : menuRef?.taxPct ?? 8;
      const code = matchedWarehouseProd?.code || menuRef?.code || 'GASTRO';
      const description = it.note ? `${it.name} (${it.note})` : it.name;

      return {
        productId: resolvedProdId,
        code,
        description,
        itemType: resolvedType,
        quantity: qty,
        unitPrice,
        taxPct,
        subtotal: Math.round(qty * unitPrice),
      };
    });

    setCart(mappedItems);
    setComandaDialogOpen(false);
    toast(
      `Orden ${ord.orderCode || ord.name} seleccionada (${mappedItems.length} servicio(s) cargados)`
    );
  };

  const openItemDialog = (preferredMode: ItemDialogMode) => {
    const nextMode: ItemDialogMode =
      preferredMode === 'PRODUCTO' && hasInventario ? 'PRODUCTO' : 'SERVICIO';
    setItemDialogMode(nextMode);
    setCatalogSearch('');
    setCatalogCategory('ALL');
    setItemDialogOpen(true);
  };

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

  const addProductToCart = (p: ProductOption, customQty?: number) => {
    const qtyToAdd = Math.max(1, Math.round(customQty || 1));
    setCart((prev) => {
      const idx = prev.findIndex(
        (it) => it.itemType === 'PRODUCTO' && it.productId === p.id
      );
      if (idx >= 0) {
        const copy = [...prev];
        const nextQty = copy[idx].quantity + qtyToAdd;
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
          quantity: qtyToAdd,
          unitPrice: p.salePrice,
          taxPct: p.taxPct,
          subtotal: Math.round(qtyToAdd * p.salePrice),
        },
      ];
    });
    setQtyDraftByProduct((prev) => ({ ...prev, [p.id]: '1' }));
  };

  const appendServiceItem = (closeAfter: boolean) => {
    const desc = srvName.trim();
    const codeClean = srvCode.trim().toUpperCase() || 'SRV-MO';
    const qtyVal = Math.max(1, Math.round(Number(srvQty || 1)));
    const priceVal = Number(srvPrice || 0);
    const taxVal = Math.max(0, Math.min(100, Number(srvTaxPct || 0)));
    if (!desc || !Number.isFinite(priceVal) || priceVal <= 0) {
      toast('Ingresa la descripción del servicio y un valor unitario mayor a cero');
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        productId: '',
        code: codeClean,
        description: desc,
        itemType: 'SERVICIO',
        quantity: qtyVal,
        unitPrice: priceVal,
        taxPct: taxVal,
        subtotal: Math.round(qtyVal * priceVal),
        workerId: invoiceType === 'TALLER' ? mechanicId || undefined : undefined,
      },
    ]);
    setSrvName('');
    setSrvQty('1');
    if (closeAfter) {
      setItemDialogOpen(false);
    } else {
      toast(`Concepto "${desc}" agregado a la factura`);
    }
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

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    }
    return [
      { value: 'ALL', label: 'Todas las categorías' },
      ...Array.from(set)
        .sort((a, b) => a.localeCompare(b, 'es'))
        .map((cat) => ({ value: cat, label: cat })),
    ];
  }, [products]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (catalogCategory !== 'ALL' && p.category !== catalogCategory) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, catalogSearch, catalogCategory]);

  const cartQtyByProductId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of cart) {
      if (it.productId) {
        map[it.productId] = (map[it.productId] || 0) + it.quantity;
      }
    }
    return map;
  }, [cart]);

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
      toast('Agrega al menos un producto o servicio a la factura para continuar');
      return;
    }
    if (effectiveCreditMode && pendingBalancePreview > 0.009 && !customerId) {
      toast('Selecciona un cliente identificado para registrar saldo en Cartera CxC');
      return;
    }

    const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
    const selectedWorker = workers.find((w) => w.id === mechanicId);

    const isTaller = invoiceType === 'TALLER';
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
      linkedRoomId,
      linkedTableId,
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
    <>
      <PkFullscreenDialog
        open={open}
        onClose={onClose}
        title={
          editingInv
            ? `✏️ Editar Factura ${editingInv.id}`
            : '🧾 Crear Factura de Venta'
        }
        subtitle={
          editingInv
            ? 'Actualiza datos del adquiriente, conceptos o condiciones de pago antes de enviar o subsanar ante la DIAN.'
            : 'Completa los datos principales de la factura, agrega productos o servicios desde el selector y guarda en borrador o confirma en firme.'
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
                Estado del Documento
              </div>
              <div style={{ flex: 1, minWidth: 'min(100%, 260px)', maxWidth: 680 }}>
                <PkProcessNodes steps={processSteps} compact />
              </div>
            </div>

            {typeOptions.length > 1 && (
              <PkTypeCards
                label="Tipo de Factura"
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
            )}
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
        <div
          className="pk-stack"
          style={{ maxWidth: 1320, margin: '0 auto', width: '100%' }}
        >
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

          {linkedRoomId && (
            <div
              className="pk-card"
              style={{
                background: '#ecfdf5',
                borderColor: '#a7f3d0',
                padding: '12px 18px',
                fontSize: 13,
                color: '#065f46',
              }}
            >
              <strong>🔗 Liquidación integrada:</strong> Habitación {linkedRoomId}{' '}
              registrará Check-Out al confirmar la factura.
            </div>
          )}

          {/* SECTION 1: PROTAGONIST CLIENT & DOCUMENT HEADER */}
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                🧾 1. Datos Principales del Adquiriente y Encabezado
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

              {(invoiceType === 'COMANDA' || linkedTableId !== '') && (
                <div
                  style={{
                    marginTop: 18,
                    padding: '16px 18px',
                    borderRadius: 12,
                    border: '1px solid #fcd34d',
                    background: '#fffbeb',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <strong
                        style={{
                          fontSize: 13.5,
                          color: '#92400e',
                          display: 'block',
                        }}
                      >
                        🍽️ Orden / Cuenta Gastronómica Asociada
                      </strong>
                      {linkedTableId ? (
                        <div style={{ marginTop: 6 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span className="pk-badge pk-badge-emerald">
                              ✓ Orden Seleccionada
                            </span>
                            <strong style={{ fontSize: 14.5, color: '#0f172a' }}>
                              {selectedComandaOrder
                                ? `${selectedComandaOrder.name}${
                                    selectedComandaOrder.orderCode
                                      ? ` (${selectedComandaOrder.orderCode})`
                                      : ''
                                  }`
                                : linkedTableId}
                            </strong>
                            {selectedComandaOrder?.customerName && (
                              <span style={{ fontSize: 13, color: '#475569' }}>
                                • {selectedComandaOrder.customerName}
                              </span>
                            )}
                            {selectedComandaOrder && (
                              <span className="pk-badge pk-badge-amber">
                                {selectedComandaOrder.items.length} servicio(s) •{' '}
                                {formatCop(selectedComandaOrder.total)}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: '#b45309',
                              marginTop: 4,
                            }}
                          >
                            La mesa o pedido se liberará automáticamente al confirmar
                            la factura en firme.
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            fontSize: 12.5,
                            color: '#92400e',
                            marginTop: 4,
                          }}
                        >
                          Selecciona una orden activa desde el diálogo para cargar
                          automáticamente sus platos y servicios en la factura.
                        </div>
                      )}
                    </div>

                    <div className="pk-row-actions">
                      <button
                        type="button"
                        className={
                          linkedTableId
                            ? 'pk-btn pk-btn-outline pk-btn-sm'
                            : 'pk-btn pk-btn-amber-brand'
                        }
                        onClick={() => {
                          setComandaSearch('');
                          setComandaChannelFilter('ALL');
                          setComandaDialogOpen(true);
                        }}
                      >
                        {linkedTableId
                          ? '🔄 Cambiar Orden'
                          : `🍽️ Seleccionar Orden Activa (${openComandaOrders.length})`}
                      </button>
                      {linkedTableId && (
                        <button
                          type="button"
                          className="pk-btn pk-btn-outline pk-btn-sm"
                          onClick={() => setLinkedTableId('')}
                        >
                          ✕ Quitar Orden
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

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

              {invoiceType === 'CORPORATIVA_CXC' && (
                <div
                  style={{
                    marginTop: 16,
                    padding: '16px 18px',
                    borderRadius: 12,
                    border: '1px solid #c7d2fe',
                    background: '#eef2ff',
                  }}
                >
                  <strong
                    style={{
                      fontSize: 13,
                      color: '#3730a3',
                      display: 'block',
                      marginBottom: 12,
                    }}
                  >
                    🏢 Condiciones Corporativas, Convenio y Cartera CxC
                  </strong>
                  <div className="pk-form-grid">
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
                    <div className="pk-field">
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
            </div>
          </div>

          {/* SECTION 2: FULL-WIDTH INVOICE LINES TABLE + DIALOG TRIGGERS */}
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                🛒 2. Productos y Servicios de la Factura ({cart.length})
              </div>
              <div className="pk-row-actions">
                {hasInventario && (
                  <button
                    type="button"
                    className="pk-btn pk-btn-primary"
                    onClick={() => openItemDialog('PRODUCTO')}
                  >
                    📦 + Seleccionar Producto
                  </button>
                )}
                <button
                  type="button"
                  className={
                    hasInventario
                      ? 'pk-btn pk-btn-outline'
                      : 'pk-btn pk-btn-primary'
                  }
                  onClick={() => openItemDialog('SERVICIO')}
                >
                  🛠️ + Agregar Servicio o Concepto
                </button>
              </div>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Descripción del Producto o Servicio</th>
                      <th>Tipo</th>
                      <th>IVA / Imp.</th>
                      <th style={{ width: 150 }}>Cantidad</th>
                      <th style={{ width: 150 }}>Vr. Unitario</th>
                      <th style={{ width: 150 }}>Subtotal</th>
                      <th style={{ width: 70 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, idx) => {
                      const lockedCatalogPrice =
                        Boolean(item.productId) && hasInventario;
                      return (
                        <tr key={`${item.code}-${idx}`}>
                          <td>
                            <span className="pk-badge pk-badge-slate">
                              {item.code}
                            </span>
                          </td>
                          <td>
                            <strong style={{ fontSize: 13.5 }}>
                              {item.description}
                            </strong>
                          </td>
                          <td>
                            <span
                              className={`pk-badge ${
                                item.itemType === 'PRODUCTO'
                                  ? 'pk-badge-blue'
                                  : 'pk-badge-emerald'
                              }`}
                            >
                              {item.itemType === 'PRODUCTO'
                                ? 'Producto'
                                : 'Servicio'}
                            </span>
                          </td>
                          <td>{item.taxPct}%</td>
                          <td>
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <button
                                type="button"
                                className="pk-btn pk-btn-outline pk-btn-sm"
                                style={{ padding: '4px 9px', minHeight: 32 }}
                                onClick={() =>
                                  updateCartItem(idx, {
                                    quantity: Math.max(0, item.quantity - 1),
                                  })
                                }
                              >
                                −
                              </button>
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
                                  width: 64,
                                  textAlign: 'center',
                                  padding: '6px 8px',
                                  borderRadius: 8,
                                  border: '1px solid var(--pk-border-strong)',
                                }}
                              />
                              <button
                                type="button"
                                className="pk-btn pk-btn-outline pk-btn-sm"
                                style={{ padding: '4px 9px', minHeight: 32 }}
                                onClick={() =>
                                  updateCartItem(idx, {
                                    quantity: item.quantity + 1,
                                  })
                                }
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td>
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
                                width: 128,
                                padding: '6px 10px',
                                borderRadius: 8,
                                border: '1px solid var(--pk-border-strong)',
                                background: lockedCatalogPrice
                                  ? '#f1f5f9'
                                  : undefined,
                              }}
                            />
                          </td>
                          <td>
                            <strong style={{ fontSize: 14 }}>
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
                          colSpan={8}
                          style={{
                            textAlign: 'center',
                            padding: '36px 20px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: 'var(--pk-navy)',
                              marginBottom: 6,
                            }}
                          >
                            Aún no has agregado productos ni servicios a esta factura
                          </div>
                          <div
                            style={{
                              fontSize: 12.5,
                              color: 'var(--pk-muted)',
                              marginBottom: 16,
                            }}
                          >
                            Usa los botones para abrir el selector de catálogo o registrar un servicio personalizado.
                          </div>
                          <div
                            style={{
                              display: 'inline-flex',
                              gap: 10,
                              flexWrap: 'wrap',
                              justifyContent: 'center',
                            }}
                          >
                            {hasInventario && (
                              <button
                                type="button"
                                className="pk-btn pk-btn-primary"
                                onClick={() => openItemDialog('PRODUCTO')}
                              >
                                📦 + Seleccionar Producto del Catálogo
                              </button>
                            )}
                            <button
                              type="button"
                              className="pk-btn pk-btn-outline"
                              onClick={() => openItemDialog('SERVICIO')}
                            >
                              🛠️ + Agregar Servicio o Concepto
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECTION 3: PAYMENT TERMS & FINANCIAL LIQUIDATION */}
          <div className="pk-grid-2" style={{ alignItems: 'stretch' }}>
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">
                  💳 3. Medio de Recaudo y Observaciones
                </div>
              </div>
              <div className="pk-card-body">
                <div className="pk-form-grid cols-2">
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
              </div>
            </div>

            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">
                  📊 4. Liquidación Tributaria y Total
                </div>
              </div>
              <div
                className="pk-card-body"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                }}
              >
                <div className="pk-stack" style={{ gap: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: 'var(--pk-muted)' }}>Subtotal Bruto:</span>
                    <strong>{formatCop(rawSubtotal)}</strong>
                  </div>
                  {discountAmount > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 14,
                        color: 'var(--pk-rose)',
                      }}
                    >
                      <span>Descuento Comercial ({effectivePct}%):</span>
                      <strong>-{formatCop(discountAmount)}</strong>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: 'var(--pk-muted)' }}>
                      IVA / Impuestos Liquidados:
                    </span>
                    <strong>{formatCop(taxAmount)}</strong>
                  </div>
                  {effectiveCreditMode && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 13.5,
                        color: 'var(--pk-amber)',
                        paddingTop: 6,
                        borderTop: '1px dashed var(--pk-border)',
                      }}
                    >
                      <span>Saldo Pendiente Cartera CxC:</span>
                      <strong>{formatCop(pendingBalancePreview)}</strong>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 18px',
                    background: '#f8fafc',
                    borderRadius: 12,
                    border: '1px solid var(--pk-border-strong)',
                    fontSize: 20,
                    fontWeight: 900,
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
      </PkFullscreenDialog>

      {/* DEDICATED DIALOG FOR SELECTING CATALOG PRODUCTS OR CUSTOM SERVICES */}
      <PkModal
        open={itemDialogOpen}
        title="📦 Seleccionar Producto del Catálogo o Servicio"
        onClose={() => setItemDialogOpen(false)}
        maxWidth={920}
      >
        <div className="pk-stack">
          {hasInventario && (
            <div className="pk-segmented-2">
              <button
                type="button"
                className={
                  itemDialogMode === 'PRODUCTO'
                    ? 'pk-btn pk-btn-primary'
                    : 'pk-btn pk-btn-outline'
                }
                style={{ justifyContent: 'center' }}
                onClick={() => setItemDialogMode('PRODUCTO')}
              >
                📦 Catálogo de Productos ({products.length})
              </button>
              <button
                type="button"
                className={
                  itemDialogMode === 'SERVICIO'
                    ? 'pk-btn pk-btn-primary'
                    : 'pk-btn pk-btn-outline'
                }
                style={{ justifyContent: 'center' }}
                onClick={() => setItemDialogMode('SERVICIO')}
              >
                🛠️ Servicio o Concepto Personalizado
              </button>
            </div>
          )}

          {itemDialogMode === 'PRODUCTO' && hasInventario ? (
            <div className="pk-stack">
              <div className="pk-form-grid cols-2">
                <div className="pk-field">
                  <label>Buscar Producto</label>
                  <input
                    autoFocus
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="🔎 Buscar por nombre, código SKU o categoría..."
                  />
                </div>
                <PkSimpleSelect
                  label="Filtrar por Categoría"
                  value={catalogCategory}
                  onChange={setCatalogCategory}
                  options={categoryOptions}
                  searchable={categoryOptions.length > 6}
                />
              </div>

              <div
                className="pk-table-wrap"
                style={{
                  maxHeight: 380,
                  overflowY: 'auto',
                  border: '1px solid var(--pk-border)',
                  borderRadius: 12,
                }}
              >
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Producto / Categoría</th>
                      <th>Stock</th>
                      <th>IVA</th>
                      <th>Precio Unitario</th>
                      <th style={{ width: 110 }}>Cant.</th>
                      <th style={{ width: 130 }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalog.map((p) => {
                      const draftQty = qtyDraftByProduct[p.id] ?? '1';
                      const inCartQty = cartQtyByProductId[p.id] || 0;
                      return (
                        <tr key={p.id}>
                          <td>
                            <span className="pk-badge pk-badge-slate">
                              {p.code}
                            </span>
                          </td>
                          <td>
                            <strong>{p.name}</strong>
                            <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>
                              {p.category}
                              {inCartQty > 0 && (
                                <span
                                  style={{
                                    marginLeft: 8,
                                    color: 'var(--pk-emerald)',
                                    fontWeight: 800,
                                  }}
                                >
                                  • En factura: {inCartQty} und.
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`pk-badge ${
                                p.stock > p.minStock
                                  ? 'pk-badge-emerald'
                                  : 'pk-badge-amber'
                              }`}
                            >
                              {p.stock}
                            </span>
                          </td>
                          <td>{p.taxPct}%</td>
                          <td>
                            <strong>{formatCop(p.salePrice)}</strong>
                          </td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              value={draftQty}
                              onChange={(e) =>
                                setQtyDraftByProduct((prev) => ({
                                  ...prev,
                                  [p.id]: e.target.value,
                                }))
                              }
                              style={{
                                width: 76,
                                padding: '6px 8px',
                                borderRadius: 8,
                                border: '1px solid var(--pk-border-strong)',
                              }}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="pk-btn pk-btn-primary pk-btn-sm"
                              onClick={() =>
                                addProductToCart(p, Number(draftQty || 1))
                              }
                            >
                              + Agregar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCatalog.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          style={{
                            textAlign: 'center',
                            color: 'var(--pk-muted)',
                            padding: 28,
                          }}
                        >
                          No se encontraron productos para el filtro actual.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                  paddingTop: 8,
                  borderTop: '1px solid var(--pk-border)',
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--pk-muted)' }}>
                  Ítems en la factura: <strong>{cart.length}</strong> • Subtotal:{' '}
                  <strong style={{ color: 'var(--pk-navy)' }}>
                    {formatCop(rawSubtotal)}
                  </strong>
                </div>
                <button
                  type="button"
                  className="pk-btn pk-btn-emerald"
                  onClick={() => setItemDialogOpen(false)}
                >
                  ✅ Listo, volver a la factura
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                appendServiceItem(true);
              }}
              className="pk-stack"
            >
              <div className="pk-form-grid cols-2">
                <div className="pk-field pk-col-span-full">
                  <label>Descripción del Servicio o Concepto</label>
                  <input
                    autoFocus
                    value={srvName}
                    onChange={(e) => setSrvName(e.target.value)}
                    placeholder="Ej: Mano de obra especializada, asesoría técnica o servicio operativo"
                  />
                </div>
                <div className="pk-field">
                  <label>Código / Referencia</label>
                  <input
                    value={srvCode}
                    onChange={(e) => setSrvCode(e.target.value)}
                    placeholder="SRV-MO"
                  />
                </div>
                <div className="pk-field">
                  <label>Cantidad</label>
                  <input
                    type="number"
                    min={1}
                    value={srvQty}
                    onChange={(e) => setSrvQty(e.target.value)}
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
                  label="Tarifa IVA / Impuesto (%)"
                  value={srvTaxPct}
                  onChange={setSrvTaxPct}
                  searchable={false}
                  options={[
                    { value: '0', label: '0% — Excluido / Exento' },
                    { value: '5', label: '5% — Tarifa Reducida' },
                    { value: '8', label: '8% — Impoconsumo' },
                    { value: '19', label: '19% — Tarifa General IVA' },
                  ]}
                />
              </div>

              <div className="pk-form-actions">
                <button
                  type="button"
                  className="pk-btn pk-btn-outline"
                  onClick={() => setItemDialogOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline"
                  onClick={() => appendServiceItem(false)}
                >
                  + Agregar y crear otro
                </button>
                <button type="submit" className="pk-btn pk-btn-primary">
                  ✅ Agregar a la Factura
                </button>
              </div>
            </form>
          )}
        </div>
      </PkModal>

      {/* DEDICATED DIALOG FOR SELECTING AN ACTIVE COMANDA / GASTRONOMIC ORDER */}
      <PkModal
        open={comandaDialogOpen}
        title="🍽️ Seleccionar Orden / Cuenta Activa de Comandas"
        onClose={() => setComandaDialogOpen(false)}
        maxWidth={900}
      >
        <div className="pk-stack">
          <div className="pk-form-grid cols-2">
            <div className="pk-field">
              <label>Buscar Orden, Mesa o Cliente</label>
              <input
                value={comandaSearch}
                onChange={(e) => setComandaSearch(e.target.value)}
                placeholder="🔎 Buscar por #orden, mesa, cliente, mesero o plato..."
              />
            </div>
            <PkSimpleSelect
              label="Filtrar por Canal"
              value={comandaChannelFilter}
              onChange={setComandaChannelFilter}
              searchable={false}
              options={[
                { value: 'ALL', label: `Todas las Órdenes (${openComandaOrders.length})` },
                { value: 'MESA', label: '🪑 Servicio en Salón / Mesas' },
                { value: 'DOMICILIO', label: '🛵 Domicilios' },
                { value: 'PARA_LLEVAR', label: '🛍️ Para Llevar' },
              ]}
            />
          </div>

          <div
            className="pk-table-wrap"
            style={{
              maxHeight: 390,
              overflowY: 'auto',
              border: '1px solid var(--pk-border)',
              borderRadius: 12,
            }}
          >
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Canal</th>
                  <th>Mesa / Cliente</th>
                  <th>Platos y Servicios</th>
                  <th>Total</th>
                  <th style={{ width: 140 }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredComandaOrders.map((ord) => {
                  const ch = (ord.channel || 'MESA').toUpperCase();
                  const isCurrent = ord.id === linkedTableId;
                  const chLabel =
                    ch === 'DOMICILIO'
                      ? '🛵 Domicilio'
                      : ch === 'PARA_LLEVAR'
                      ? '🛍️ Para llevar'
                      : '🪑 Salón';
                  return (
                    <tr key={ord.id}>
                      <td>
                        <strong>{ord.orderCode || ord.id}</strong>
                      </td>
                      <td>
                        <span
                          className={`pk-badge ${
                            ch === 'DOMICILIO'
                              ? 'pk-badge-rose'
                              : ch === 'PARA_LLEVAR'
                              ? 'pk-badge-amber'
                              : 'pk-badge-blue'
                          }`}
                        >
                          {chLabel}
                        </span>
                      </td>
                      <td>
                        <strong>{ord.name}</strong>
                        <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>
                          {ord.customerName
                            ? `${ord.customerName} • `
                            : ''}
                          {ord.zone}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5 }}>
                          {(ord.items || [])
                            .slice(0, 3)
                            .map((it) => `${it.qty}x ${it.name}`)
                            .join(', ')}
                          {(ord.items || []).length > 3 &&
                            ` (+${ord.items.length - 3} más)`}
                        </div>
                      </td>
                      <td>
                        <strong>{formatCop(ord.total)}</strong>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={
                            isCurrent
                              ? 'pk-btn pk-btn-emerald pk-btn-sm'
                              : 'pk-btn pk-btn-primary pk-btn-sm'
                          }
                          onClick={() => handleSelectComandaOrder(ord)}
                        >
                          {isCurrent ? '✓ Recargar' : '✅ Seleccionar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredComandaOrders.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: 'center',
                        color: 'var(--pk-muted)',
                        padding: 28,
                      }}
                    >
                      No hay órdenes de comandas abiertas con consumos pendientes para este filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pk-form-actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setComandaDialogOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      </PkModal>
    </>
  );
};
