import React, { useState, useEffect, useCallback } from 'react';
import {
  usePlatform,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkSelect,
  PkModal,
  PkPrintButton,
  PkKpiRow,
  useAsyncAction,
  formatCop,
  downloadCsvUtf8,
} from '@platform/ui-sdk';
import {
  FacturasTallerBox,
  VehicleOption,
  WorkerOption,
} from './modules/FacturasTallerBox';
import {
  FacturacionDianTab,
  InvoiceItemRecord,
  InvoiceRecord,
} from './modules/FacturacionDianTab';

interface CustomerOption {
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

interface ContractOption {
  id: string;
  code: string;
  name: string;
  tariffId?: string;
}

interface TariffOption {
  id: string;
  name: string;
  discountPct: number;
}

interface ProductOption {
  id: string;
  code: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  salePrice: number;
  taxPct: number;
}

interface QuoteRecord {
  id: string;
  createdAt: string;
  customerId: string;
  customerName: string;
  customerNit: string;
  validUntil: string;
  items: InvoiceItemRecord[];
  subtotal: number;
  taxTotal: number;
  total: number;
  status: string;
  notes: string;
}

interface SalesSummary {
  invoiceCount: number;
  quoteCount: number;
  totalSales: number;
  totalDiscount: number;
  totalTax: number;
  totalCollected: number;
  totalPendingReceivables: number;
  cashSales: number;
  digitalSales: number;
  dianAcceptedCount: number;
  workshopInvoiceCount: number;
}

interface PosStateResponse {
  ok: boolean;
  nextInvoiceNumber: string;
  nextQuoteNumber: string;
  invoices: InvoiceRecord[];
  quotes: QuoteRecord[];
  summary?: SalesSummary;
}

interface OptionalCustomersResponse {
  ok?: boolean;
  customers?: CustomerOption[];
  contracts?: ContractOption[];
  tariffs?: TariffOption[];
}

interface OptionalInventoryResponse {
  ok?: boolean;
  products?: ProductOption[];
}

interface OptionalTallerResponse {
  ok?: boolean;
  vehicles?: VehicleOption[];
  workers?: WorkerOption[];
}

const VALID_MODULES = [
  'pos_mostrador',
  'cotizaciones',
  'facturas_taller',
  'facturacion_dian',
] as const;

function defaultValidUntilDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().slice(0, 10);
}

function formatKmText(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return `${Math.round(raw).toLocaleString('es-CO')} km`;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.trim();
  }
  return '';
}

export const FacturacionView: React.FC = () => {
  const {
    activeModuleKey,
    setActiveModuleKey,
    navigateTo,
    apiGet,
    apiPost,
    toast,
    hasService,
    hasModule,
    hasFeature,
    hasPrintCapability,
    openHtmlPrintWindow,
    requestPrintDocument,
    incomingPayload,
    clearIncomingPayload,
  } = usePlatform();

  const { busy, run } = useAsyncAction();

  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('FEVP-9013');
  const [nextQuoteNumber, setNextQuoteNumber] = useState('COT-3012');
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [tariffs, setTariffs] = useState<TariffOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);

  const [catalogSearch, setCatalogSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerNameOverride, setCustomerNameOverride] = useState('');
  const [cart, setCart] = useState<InvoiceItemRecord[]>([]);
  const [discountPct, setDiscountPct] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [isCreditMode, setIsCreditMode] = useState(false);
  const [amountPaidInput, setAmountPaidInput] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  const [vehicleId, setVehicleId] = useState('');
  const [plateOverride, setPlateOverride] = useState('');
  const [currentKm, setCurrentKm] = useState('');
  const [nextOilKm, setNextOilKm] = useState('');
  const [mechanicId, setMechanicId] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [linkedRoomId, setLinkedRoomId] = useState('');
  const [linkedTableId, setLinkedTableId] = useState('');

  const [srvName, setSrvName] = useState('');
  const [srvPrice, setSrvPrice] = useState('85000');
  const [srvTaxPct, setSrvTaxPct] = useState('0');

  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

  const [quoteCustomerId, setQuoteCustomerId] = useState('');
  const [quoteProductId, setQuoteProductId] = useState('');
  const [quoteQty, setQuoteQty] = useState('1');
  const [quoteItems, setQuoteItems] = useState<InvoiceItemRecord[]>([]);
  const [quoteValidUntil, setQuoteValidUntil] = useState(defaultValidUntilDate);
  const [quoteNotes, setQuoteNotes] = useState(
    'Precios sujetos a disponibilidad de inventario.'
  );

  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustNit, setNewCustNit] = useState('');
  const [newCustDocType, setNewCustDocType] = useState('NIT');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustCity, setNewCustCity] = useState('Bogotá D.C.');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustCreditLimit, setNewCustCreditLimit] = useState('5000000');

  const [showNewVehicleModal, setShowNewVehicleModal] = useState(false);
  const [newVehPlate, setNewVehPlate] = useState('');
  const [newVehBrand, setNewVehBrand] = useState('');
  const [newVehType, setNewVehType] = useState('Camioneta');
  const [newVehKm, setNewVehKm] = useState('45000');

  const hasClientes = hasService('ms-clientes');
  const hasInventario = hasService('ms-inventario');
  const hasTaller = hasService('ms-taller');

  const applyCustomerTariff = useCallback(
    (
      custId: string,
      custList: CustomerOption[],
      cntList: ContractOption[],
      trfList: TariffOption[]
    ) => {
      const cust = custList.find((c) => c.id === custId);
      if (!cust) {
        setDiscountPct('0');
        return;
      }
      const cnt = cntList.find((ct) => ct.id === cust.contractId);
      const trfId = cnt?.tariffId || cust.tariffId;
      const trf = trfList.find((t) => t.id === trfId);
      if (trf && hasFeature('', 'descuento_linea')) {
        setDiscountPct(String(trf.discountPct));
      } else {
        setDiscountPct('0');
      }
    },
    [hasFeature]
  );

  const loadAll = useCallback(async () => {
    const [posRes, cliRes, invRes, talRes] = await Promise.allSettled([
      apiGet<PosStateResponse>('/api/v1/facturacion/pos-state'),
      hasClientes
        ? apiGet<OptionalCustomersResponse>('/api/v1/clientes/all')
        : Promise.resolve(null),
      hasInventario
        ? apiGet<OptionalInventoryResponse>('/api/v1/inventario/all')
        : Promise.resolve(null),
      hasTaller
        ? apiGet<OptionalTallerResponse>('/api/v1/taller/all')
        : Promise.resolve(null),
    ]);

    if (posRes.status === 'fulfilled' && posRes.value) {
      setNextInvoiceNumber(posRes.value.nextInvoiceNumber || 'FEVP-9013');
      setNextQuoteNumber(posRes.value.nextQuoteNumber || 'COT-3012');
      setInvoices(posRes.value.invoices || []);
      setQuotes(posRes.value.quotes || []);
    }

    const nextCustomers =
      cliRes.status === 'fulfilled' && cliRes.value?.customers
        ? cliRes.value.customers
        : [];
    const nextContracts =
      cliRes.status === 'fulfilled' && cliRes.value?.contracts
        ? cliRes.value.contracts
        : [];
    const nextTariffs =
      cliRes.status === 'fulfilled' && cliRes.value?.tariffs
        ? cliRes.value.tariffs
        : [];
    const nextProducts =
      invRes.status === 'fulfilled' && invRes.value?.products
        ? invRes.value.products
        : [];
    const nextVehicles =
      talRes.status === 'fulfilled' && talRes.value?.vehicles
        ? talRes.value.vehicles
        : [];
    const nextWorkers =
      talRes.status === 'fulfilled' && talRes.value?.workers
        ? talRes.value.workers
        : [];

    setCustomers(nextCustomers);
    setContracts(nextContracts);
    setTariffs(nextTariffs);
    setProducts(nextProducts);
    setVehicles(nextVehicles);
    setWorkers(nextWorkers);

    if (nextProducts.length > 0) {
      setQuoteProductId((prev) => prev || nextProducts[0].id);
    }
    if (nextCustomers.length > 0) {
      setQuoteCustomerId((prev) => prev || nextCustomers[0].id);
    }
  }, [apiGet, hasClientes, hasInventario, hasTaller]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!incomingPayload) return;

    const rawCustId =
      typeof incomingPayload.customerId === 'string'
        ? incomingPayload.customerId.trim()
        : '';
    const rawCustName =
      typeof incomingPayload.customerName === 'string'
        ? incomingPayload.customerName.trim()
        : typeof incomingPayload.guestName === 'string'
        ? incomingPayload.guestName.trim()
        : '';

    if (rawCustId) {
      setCustomerId(rawCustId);
      setCustomerNameOverride('');
      applyCustomerTariff(rawCustId, customers, contracts, tariffs);
    } else if (rawCustName) {
      setCustomerNameOverride(rawCustName);
    }

    const rawVehId =
      typeof incomingPayload.vehicleId === 'string'
        ? incomingPayload.vehicleId.trim()
        : '';
    const rawPlate =
      typeof incomingPayload.plate === 'string'
        ? incomingPayload.plate.trim().toUpperCase()
        : '';
    if (rawVehId) {
      setVehicleId(rawVehId);
    }
    if (rawPlate) {
      setPlateOverride(rawPlate);
    }

    const kmText = formatKmText(incomingPayload.currentKm);
    const oilText = formatKmText(incomingPayload.nextOilKm);
    if (kmText) setCurrentKm(kmText);
    if (oilText) setNextOilKm(oilText);

    if (typeof incomingPayload.mechanicId === 'string' && incomingPayload.mechanicId) {
      setMechanicId(incomingPayload.mechanicId);
    }
    if (
      typeof incomingPayload.linkedWorkOrderId === 'string' &&
      incomingPayload.linkedWorkOrderId
    ) {
      setWorkOrderId(incomingPayload.linkedWorkOrderId);
    }
    if (
      typeof incomingPayload.linkedRoomId === 'string' &&
      incomingPayload.linkedRoomId
    ) {
      setLinkedRoomId(incomingPayload.linkedRoomId);
    }
    if (
      typeof incomingPayload.linkedTableId === 'string' &&
      incomingPayload.linkedTableId
    ) {
      setLinkedTableId(incomingPayload.linkedTableId);
    }

    if (Array.isArray(incomingPayload.items) && incomingPayload.items.length > 0) {
      const normalized: InvoiceItemRecord[] = [];
      for (const raw of incomingPayload.items) {
        if (!raw || typeof raw !== 'object') continue;
        const rec = raw as Record<string, unknown>;
        const rawKind = String(rec.itemType ?? rec.kind ?? 'PRODUCTO')
          .trim()
          .toUpperCase();
        const isServiceKind = rawKind === 'SERVICIO';
        const candidateProdId = String(rec.productId ?? rec.refId ?? '').trim();
        const matchesCatalog =
          candidateProdId !== '' &&
          products.some((p) => p.id === candidateProdId);

        const resolvedType: 'PRODUCTO' | 'SERVICIO' =
          isServiceKind || (products.length > 0 && candidateProdId !== '' && !matchesCatalog)
            ? 'SERVICIO'
            : 'PRODUCTO';
        const resolvedProdId =
          resolvedType === 'PRODUCTO' && (products.length === 0 || matchesCatalog)
            ? candidateProdId
            : '';

        const qty = Math.max(1, Number(rec.quantity ?? rec.qty ?? 1) || 1);
        const unitPrice = Math.max(
          0,
          Number(rec.unitPrice ?? rec.price ?? 0) || 0
        );
        const taxPct = Math.max(0, Number(rec.taxPct ?? 0) || 0);
        const description = String(
          rec.description ?? rec.name ?? 'Concepto comercial'
        ).trim();
        const code = String(rec.code ?? 'ITEM').trim() || 'ITEM';

        normalized.push({
          productId: resolvedProdId,
          code,
          description,
          itemType: resolvedType,
          quantity: qty,
          unitPrice,
          taxPct,
          subtotal: Math.round(qty * unitPrice),
          workerId:
            typeof rec.workerId === 'string' ? rec.workerId : undefined,
          workerName:
            typeof rec.workerName === 'string' ? rec.workerName : undefined,
        });
      }
      if (normalized.length > 0) {
        setCart(normalized);
      }
    }

    clearIncomingPayload();
    toast('Cuenta recibida en Caja lista para facturar');
  }, [
    incomingPayload,
    clearIncomingPayload,
    customers,
    contracts,
    tariffs,
    products,
    applyCustomerTariff,
    toast,
  ]);

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
        setCustomerId(found.customerId);
        setCustomerNameOverride('');
        applyCustomerTariff(found.customerId, customers, contracts, tariffs);
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
        workerId: mechanicId || undefined,
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
  const effectivePct = hasFeature('', 'descuento_linea')
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

  const buildInvoicePrintPayload = useCallback(
    (inv: InvoiceRecord): Record<string, unknown> => {
      const cust = customers.find((c) => c.id === inv.customerId);
      const extra: Record<string, string> = {};
      if (inv.plate) extra['Placa'] = inv.plate;
      if (inv.workshopMeta?.vehicleBrand) {
        extra['Vehículo'] = inv.workshopMeta.vehicleBrand;
      }
      if (inv.workshopMeta?.currentKm) {
        extra['Kilometraje'] = inv.workshopMeta.currentKm;
      }
      if (inv.workshopMeta?.nextOilKm) {
        extra['Próximo Aceite'] = inv.workshopMeta.nextOilKm;
      }
      if (inv.workshopMeta?.workOrderId) {
        extra['Orden de Servicio'] = inv.workshopMeta.workOrderId;
      }
      if (inv.mechanicName) {
        extra['Técnico / Mecánico'] = inv.mechanicName;
      }
      if (inv.cufe) {
        extra['CUFE'] = inv.cufe;
        extra['Estado DIAN'] = inv.dianStatus || 'ACEPTADA DIAN';
      }

      return {
        document_type: inv.cufe
          ? 'FACTURA ELECTRÓNICA DE VENTA'
          : 'FACTURA DE VENTA POS',
        layout_variant: inv.layoutVariant || undefined,
        document_number: inv.id,
        issue_date: inv.issueDate || inv.date,
        customer_name: inv.customerName,
        customer_nit: inv.customerNit,
        customer_phone: inv.customerPhone || cust?.phone,
        customer_address:
          inv.customerAddress ||
          (cust ? `${cust.address || ''} ${cust.city || ''}`.trim() : undefined),
        payment_method: inv.paymentMethod,
        extra_fields: extra,
        items: inv.items.map((it) => ({
          code: it.code,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          tax_pct: it.taxPct,
          subtotal: it.subtotal,
        })),
        subtotal: inv.subtotal,
        discount_total: inv.discountTotal,
        tax_total: inv.taxTotal,
        grand_total: inv.total,
        pending_balance: inv.pendingBalance,
        notes: inv.notes,
      };
    },
    [customers]
  );

  const submitInvoice = (renderPrint: boolean) => {
    if (cart.length === 0) {
      toast('Agrega al menos un producto o servicio al carrito');
      return;
    }

    const paidValue = isCreditMode ? Number(amountPaidInput || 0) : grandTotal;
    if (isCreditMode && paidValue < grandTotal - 0.009 && !customerId) {
      toast(
        'Selecciona un cliente identificado para registrar saldo en Cartera CxC'
      );
      return;
    }

    const selectedCustomer = customers.find((c) => c.id === customerId);
    const selectedVehicle = vehicles.find((v) => v.id === vehicleId);
    const selectedWorker = workers.find((w) => w.id === mechanicId);

    void run(async () => {
      const res = await apiPost<{
        ok: boolean;
        invoice: InvoiceRecord;
        printHtml?: string;
      }>('/api/v1/facturacion/invoices', {
        customerId,
        customerName:
          selectedCustomer?.name ||
          customerNameOverride ||
          'Consumidor Final Mostrador',
        customerNit: selectedCustomer?.nit || '',
        customerPhone: selectedCustomer?.phone || '',
        customerAddress: selectedCustomer
          ? `${selectedCustomer.address || ''} ${selectedCustomer.city || ''}`.trim()
          : '',
        contractId: selectedCustomer?.contractId || '',
        discountPct: effectivePct,
        vehicleId,
        plate: selectedVehicle?.plate || plateOverride || '',
        mechanicId,
        mechanicName: selectedWorker?.name || '',
        linkedWorkOrderId: workOrderId,
        linkedRoomId,
        linkedTableId,
        workshopMeta: {
          vehicleBrand: selectedVehicle
            ? `${selectedVehicle.brand} ${selectedVehicle.modelYear || ''}`.trim()
            : '',
          currentKm,
          nextOilKm,
          workOrderId,
        },
        items: cart,
        paymentMethod: isCreditMode ? 'Crédito / Cartera CxC' : paymentMethod,
        amountPaid: paidValue,
        notes: invoiceNotes,
        renderPrint,
      });

      toast(`Factura ${res.invoice.id} emitida exitosamente`);
      setCart([]);
      setCustomerNameOverride('');
      setPlateOverride('');
      setWorkOrderId('');
      setLinkedRoomId('');
      setLinkedTableId('');
      setInvoiceNotes('');
      setIsCreditMode(false);
      setAmountPaidInput('');
      await loadAll();

      if (renderPrint) {
        if (res.printHtml) {
          openHtmlPrintWindow(
            res.printHtml,
            `Factura ${res.invoice.id} — ${res.invoice.customerName}`
          );
        } else if (hasPrintCapability) {
          await requestPrintDocument(buildInvoicePrintPayload(res.invoice));
        }
      }
    });
  };

  const handleCreateQuickCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustNit.trim()) {
      toast('El nombre o razón social y el documento/NIT son obligatorios');
      return;
    }
    void run(async () => {
      const res = await apiPost<{ ok: boolean; customer: CustomerOption }>(
        '/api/v1/clientes/customers',
        {
          name: newCustName.trim(),
          nit: newCustNit.trim(),
          docType: newCustDocType,
          phone: newCustPhone.trim(),
          email: newCustEmail.trim(),
          city: newCustCity.trim(),
          address: newCustAddress.trim(),
          creditLimit: Math.max(0, Number(newCustCreditLimit || 0)),
        }
      );
      setShowNewCustomerModal(false);
      setNewCustName('');
      setNewCustNit('');
      setNewCustPhone('');
      setNewCustEmail('');
      setNewCustAddress('');
      await loadAll();
      if (res.customer?.id) {
        setCustomerId(res.customer.id);
        setQuoteCustomerId(res.customer.id);
      }
      toast(`Cliente ${res.customer?.name || ''} registrado y seleccionado`);
    });
  };

  const handleCreateQuickVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehPlate.trim() || !newVehBrand.trim()) {
      toast('La placa y la línea/marca del vehículo son obligatorias');
      return;
    }
    const selectedCustomer = customers.find((c) => c.id === customerId);
    const kmNum = Math.max(0, Math.round(Number(newVehKm || 0)));

    void run(async () => {
      const res = await apiPost<{ ok: boolean; vehicle: VehicleOption }>(
        '/api/v1/taller/vehicles',
        {
          plate: newVehPlate.trim().toUpperCase(),
          brand: newVehBrand.trim(),
          vehicleType: newVehType,
          customerId,
          customerName:
            selectedCustomer?.name || customerNameOverride || 'Cliente Taller',
          currentKm: kmNum,
        }
      );
      setShowNewVehicleModal(false);
      setNewVehPlate('');
      setNewVehBrand('');
      await loadAll();
      if (res.vehicle?.id) {
        setVehicleId(res.vehicle.id);
        setPlateOverride(res.vehicle.plate);
        const oilKm = res.vehicle.nextOilKm ?? res.vehicle.nextOilChangeKm ?? 0;
        setCurrentKm(
          res.vehicle.currentKm
            ? `${res.vehicle.currentKm.toLocaleString('es-CO')} km`
            : ''
        );
        setNextOilKm(oilKm ? `${oilKm.toLocaleString('es-CO')} km` : '');
      }
      toast(`Placa ${res.vehicle?.plate || ''} creada y asignada`);
    });
  };

  const handleAddQuoteLine = () => {
    const prod = products.find((p) => p.id === quoteProductId);
    if (!prod) {
      toast('Selecciona un producto del catálogo para cotizar');
      return;
    }
    const q = Math.max(1, Number(quoteQty || 1));
    setQuoteItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        code: prod.code,
        description: prod.name,
        itemType: 'PRODUCTO',
        quantity: q,
        unitPrice: prod.salePrice,
        taxPct: prod.taxPct,
        subtotal: Math.round(q * prod.salePrice),
      },
    ]);
  };

  const handleSaveQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (quoteItems.length === 0) {
      toast('Agrega al menos un producto a la cotización');
      return;
    }
    const selectedCust = customers.find((c) => c.id === quoteCustomerId);
    void run(async () => {
      await apiPost('/api/v1/facturacion/quotes', {
        customerId: quoteCustomerId,
        customerName: selectedCust?.name || 'Cliente Comercial',
        customerNit: selectedCust?.nit || '',
        validUntil: quoteValidUntil,
        notes: quoteNotes,
        items: quoteItems,
      });
      toast('Cotización comercial generada');
      setQuoteItems([]);
      await loadAll();
    });
  };

  const convertQuoteToInvoice = (q: QuoteRecord) => {
    if (q.customerId) {
      setCustomerId(q.customerId);
      applyCustomerTariff(q.customerId, customers, contracts, tariffs);
    } else if (q.customerName) {
      setCustomerNameOverride(q.customerName);
    }
    setCart(q.items || []);
    setActiveModuleKey('pos_mostrador');
    toast(`Cotización ${q.id} cargada en Caja para facturar`);
  };

  const customerSelectItems: CustomerOption[] = [
    {
      id: '',
      nit: '222222222222',
      name: customerNameOverride
        ? `${customerNameOverride} (Mostrador)`
        : 'Consumidor Final Mostrador',
    },
    ...customers,
  ];

  const currentTab =
    VALID_MODULES.includes(
      activeModuleKey as (typeof VALID_MODULES)[number]
    ) && hasModule(activeModuleKey)
      ? activeModuleKey
      : VALID_MODULES.find((m) => hasModule(m)) || 'pos_mostrador';

  const quickModals = (
    <>
      <PkModal
        open={showNewCustomerModal}
        title="👤 Registro Rápido de Cliente Comercial"
        onClose={() => setShowNewCustomerModal(false)}
      >
        <form onSubmit={handleCreateQuickCustomer}>
          <div className="pk-form-grid">
            <div className="pk-field">
              <label>Tipo Documento</label>
              <select
                value={newCustDocType}
                onChange={(e) => setNewCustDocType(e.target.value)}
              >
                <option value="NIT">NIT Empresarial</option>
                <option value="CC">Cédula de Ciudadanía</option>
                <option value="CE">Cédula de Extranjería</option>
              </select>
            </div>
            <div className="pk-field">
              <label>NIT / Documento *</label>
              <input
                value={newCustNit}
                onChange={(e) => setNewCustNit(e.target.value)}
                placeholder="Ej: 901.482.110-3"
                required
              />
            </div>
            <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
              <label>Razón Social o Nombre Completo *</label>
              <input
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="Ej: Comercializadora del Norte S.A.S."
                required
              />
            </div>
            <div className="pk-field">
              <label>Teléfono / WhatsApp</label>
              <input
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                placeholder="310 555 0192"
              />
            </div>
            <div className="pk-field">
              <label>Correo Facturación Electrónica</label>
              <input
                type="email"
                value={newCustEmail}
                onChange={(e) => setNewCustEmail(e.target.value)}
                placeholder="recepcionfe@empresa.co"
              />
            </div>
            <div className="pk-field">
              <label>Ciudad</label>
              <input
                value={newCustCity}
                onChange={(e) => setNewCustCity(e.target.value)}
              />
            </div>
            <div className="pk-field">
              <label>Cupo de Crédito Autorizado ($)</label>
              <input
                type="number"
                min={0}
                value={newCustCreditLimit}
                onChange={(e) => setNewCustCreditLimit(e.target.value)}
              />
            </div>
            <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
              <label>Dirección Comercial</label>
              <input
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                placeholder="Cra. 15 # 93-40 Of. 302"
              />
            </div>
          </div>
          <div
            className="pk-row-actions"
            style={{ justifyContent: 'flex-end', marginTop: 14 }}
          >
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setShowNewCustomerModal(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="pk-btn pk-btn-primary"
              disabled={busy}
            >
              {busy ? 'Guardando...' : 'Guardar y Seleccionar Cliente'}
            </button>
          </div>
        </form>
      </PkModal>

      <PkModal
        open={showNewVehicleModal}
        title="🚗 Registro Rápido de Placa / Vehículo"
        onClose={() => setShowNewVehicleModal(false)}
      >
        <form onSubmit={handleCreateQuickVehicle}>
          <div className="pk-form-grid">
            <div className="pk-field">
              <label>Placa *</label>
              <input
                value={newVehPlate}
                onChange={(e) => setNewVehPlate(e.target.value.toUpperCase())}
                placeholder="Ej: KLP842"
                required
              />
            </div>
            <div className="pk-field">
              <label>Tipo de Vehículo</label>
              <select
                value={newVehType}
                onChange={(e) => setNewVehType(e.target.value)}
              >
                <option value="Automóvil">Automóvil</option>
                <option value="Camioneta">Camioneta / SUV</option>
                <option value="Motocicleta">Motocicleta</option>
                <option value="Utilitario / Carga">Utilitario / Carga</option>
              </select>
            </div>
            <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
              <label>Marca / Línea / Modelo *</label>
              <input
                value={newVehBrand}
                onChange={(e) => setNewVehBrand(e.target.value)}
                placeholder="Ej: Toyota Hilux 2.8 4x4 2024"
                required
              />
            </div>
            <div className="pk-field">
              <label>Kilometraje Actual</label>
              <input
                type="number"
                min={0}
                value={newVehKm}
                onChange={(e) => setNewVehKm(e.target.value)}
              />
            </div>
          </div>
          <div
            className="pk-row-actions"
            style={{ justifyContent: 'flex-end', marginTop: 14 }}
          >
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setShowNewVehicleModal(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="pk-btn pk-btn-primary"
              disabled={busy}
            >
              {busy ? 'Guardando...' : 'Guardar Placa'}
            </button>
          </div>
        </form>
      </PkModal>
    </>
  );

  if (currentTab === 'facturacion_dian') {
    return (
      <>
        <FacturacionDianTab
          invoices={invoices}
          buildPrintPayload={buildInvoicePrintPayload}
        />
        {quickModals}
      </>
    );
  }

  if (currentTab === 'cotizaciones') {
    const quoteSub = quoteItems.reduce(
      (acc, it) => acc + it.quantity * it.unitPrice,
      0
    );
    return (
      <ModuleGate module="cotizaciones">
        <div>
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                📄 Nueva Cotización Comercial Formal
              </div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleSaveQuote}>
                <div className="pk-form-grid">
                  <PkAutoCodeInput
                    label="N° Cotización"
                    value={nextQuoteNumber}
                  />
                  <PkSelect
                    label="Cliente Destinatario"
                    items={customerSelectItems}
                    value={quoteCustomerId}
                    onChange={setQuoteCustomerId}
                    getValue={(c) => c.id}
                    getLabel={(c) => `${c.name} (${c.nit})`}
                    onCreateNew={
                      hasClientes
                        ? () => setShowNewCustomerModal(true)
                        : undefined
                    }
                    createLabel="+ Nuevo Cliente"
                    searchable
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

                {products.length > 0 && (
                  <div className="pk-form-grid" style={{ marginTop: 12 }}>
                    <PkSelect
                      label="Producto del Catálogo"
                      items={products}
                      value={quoteProductId}
                      onChange={setQuoteProductId}
                      getValue={(p) => p.id}
                      getLabel={(p) =>
                        `${p.code} — ${p.name} (${formatCop(p.salePrice)})`
                      }
                      searchable
                    />
                    <div className="pk-field">
                      <label>Cantidad</label>
                      <input
                        type="number"
                        min={1}
                        value={quoteQty}
                        onChange={(e) => setQuoteQty(e.target.value)}
                      />
                    </div>
                    <div className="pk-field">
                      <label>&nbsp;</label>
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline"
                        onClick={handleAddQuoteLine}
                      >
                        ➕ Agregar Ítem a Cotización
                      </button>
                    </div>
                  </div>
                )}

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
                            <td>{it.description}</td>
                            <td>{it.quantity}</td>
                            <td>{formatCop(it.unitPrice)}</td>
                            <td>
                              <strong>
                                {formatCop(it.quantity * it.unitPrice)}
                              </strong>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="pk-btn pk-btn-danger pk-btn-sm"
                                onClick={() =>
                                  setQuoteItems((prev) =>
                                    prev.filter((_, i) => i !== idx)
                                  )
                                }
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
                    <input
                      value={quoteNotes}
                      onChange={(e) => setQuoteNotes(e.target.value)}
                    />
                  </div>
                  <div
                    className="pk-row-actions"
                    style={{
                      gridColumn: '1 / -1',
                      justifyContent: 'space-between',
                    }}
                  >
                    <strong>Subtotal Cotizado: {formatCop(quoteSub)}</strong>
                    <button
                      type="submit"
                      className="pk-btn pk-btn-primary"
                      disabled={busy}
                    >
                      💾 Guardar Cotización ({nextQuoteNumber})
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
                    {quotes.map((q) => (
                      <tr key={q.id}>
                        <td>
                          <strong>{q.id}</strong>
                        </td>
                        <td>{q.createdAt}</td>
                        <td>{q.customerName}</td>
                        <td>{q.validUntil}</td>
                        <td>
                          <strong>{formatCop(q.total)}</strong>
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
                                customer_name: q.customerName,
                                customer_nit: q.customerNit,
                                extra_fields: {
                                  'Válida Hasta': q.validUntil || '',
                                  Estado: q.status || 'Vigente',
                                },
                                items: (q.items || []).map((it) => ({
                                  code: it.code,
                                  description: it.description,
                                  quantity: it.quantity,
                                  unit_price: it.unitPrice,
                                  tax_pct: it.taxPct,
                                  subtotal: it.subtotal,
                                })),
                                subtotal: q.subtotal,
                                tax_total: q.taxTotal,
                                grand_total: q.total,
                                notes: q.notes,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {quotes.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: 'center',
                            color: 'var(--pk-muted)',
                          }}
                        >
                          Aún no hay cotizaciones registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {quickModals}
        </div>
      </ModuleGate>
    );
  }

  if (currentTab === 'facturas_taller') {
    const workshopInvoices = invoices.filter((inv) =>
      Boolean(inv.plate || inv.vehicleId)
    );
    const workshopTotal = workshopInvoices.reduce(
      (acc, inv) => acc + inv.total,
      0
    );

    return (
      <ModuleGate module="facturas_taller">
        <div>
          <PkKpiRow
            items={[
              {
                label: 'Facturas Automotrices Emitidas',
                value: String(workshopInvoices.length),
                color: 'var(--pk-primary)',
              },
              {
                label: 'Facturación Acumulada Taller',
                value: formatCop(workshopTotal),
                color: 'var(--pk-emerald)',
              },
              {
                label: 'Placas Registradas',
                value: String(vehicles.length),
              },
            ]}
          />

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                🔧 Historial Especializado de Facturas con Placa y Técnico
              </div>
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
                        <td>{inv.issueDate || inv.date}</td>
                        <td>
                          <span className="pk-badge pk-badge-blue">
                            {inv.plate}
                          </span>
                          <div
                            style={{ fontSize: 11, color: 'var(--pk-muted)' }}
                          >
                            {inv.workshopMeta?.vehicleBrand || ''}
                          </div>
                        </td>
                        <td>{inv.customerName}</td>
                        <td>{inv.mechanicName || '— Sin asignar —'}</td>
                        <td>
                          <span className="pk-badge pk-badge-emerald">
                            {inv.layoutVariant === 'factura_taller'
                              ? 'Automotriz'
                              : 'Estándar'}
                          </span>
                        </td>
                        <td>
                          <strong>{formatCop(inv.total)}</strong>
                        </td>
                        <td>
                          <PkPrintButton
                            label="🖨️ Imprimir"
                            payload={buildInvoicePrintPayload(inv)}
                          />
                        </td>
                      </tr>
                    ))}
                    {workshopInvoices.length === 0 && (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            textAlign: 'center',
                            color: 'var(--pk-muted)',
                          }}
                        >
                          No hay facturas con placa emitidas todavía.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {quickModals}
        </div>
      </ModuleGate>
    );
  }

  const filteredCatalog = catalogSearch.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
          p.code.toLowerCase().includes(catalogSearch.toLowerCase()) ||
          p.category.toLowerCase().includes(catalogSearch.toLowerCase())
      )
    : products;

  return (
    <div>
      {(linkedTableId || linkedRoomId || workOrderId) && (
        <div
          className="pk-card"
          style={{
            background: '#ecfdf5',
            borderColor: '#10b981',
            padding: '10px 16px',
            marginBottom: 12,
          }}
        >
          <strong style={{ color: '#065f46', fontSize: 13 }}>
            🔗 Liquidación Operativa Integrada:{' '}
          </strong>
          <span style={{ fontSize: 12.5, color: '#047857' }}>
            {linkedTableId && `Mesa ${linkedTableId} se liberará al facturar. `}
            {linkedRoomId &&
              `Habitación ${linkedRoomId} completará Check-Out al facturar. `}
            {workOrderId &&
              `Orden de Taller ${workOrderId} quedará facturada automáticamente.`}
          </span>
        </div>
      )}

      <div className="pk-grid-2">
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">
              📦 Catálogo Rápido de Productos y Servicios
            </div>
            <input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="🔎 Buscar producto o SKU..."
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--pk-border)',
                fontSize: 12.5,
              }}
            />
          </div>
          <div className="pk-card-body">
            {filteredCatalog.length > 0 ? (
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
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <span className="pk-badge pk-badge-slate">
                          {p.code}
                        </span>
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
                      <div
                        style={{ fontWeight: 800, fontSize: 13, marginTop: 6 }}
                      >
                        {p.name}
                      </div>
                      <div
                        style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}
                      >
                        {p.category} • IVA {p.taxPct}%
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <strong
                        style={{ fontSize: 14.5, color: 'var(--pk-primary)' }}
                      >
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
                  padding: '12px 0',
                  fontSize: 12.5,
                  color: 'var(--pk-muted)',
                }}
              >
                {hasInventario
                  ? 'No se encontraron productos para el filtro ingresado.'
                  : 'Catálogo de inventario desacoplado; puedes facturar servicios libres a continuación.'}
              </div>
            )}

            <form
              onSubmit={handleAddQuickService}
              style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: 12,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  marginBottom: 8,
                  color: '#334155',
                }}
              >
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
                    min={1}
                    value={srvPrice}
                    onChange={(e) => setSrvPrice(e.target.value)}
                  />
                </div>
                <div className="pk-field">
                  <label>IVA (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={srvTaxPct}
                    onChange={(e) => setSrvTaxPct(e.target.value)}
                  />
                </div>
                <div className="pk-field">
                  <label>&nbsp;</label>
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
            <div className="pk-card-title">
              🧾 Liquidación de Venta y Caja Registradora
            </div>
            <span className="pk-badge pk-badge-blue">{nextInvoiceNumber}</span>
          </div>
          <div className="pk-card-body">
            <div className="pk-form-grid">
              <PkAutoCodeInput
                label="Consecutivo Autorizado"
                value={nextInvoiceNumber}
              />
              <PkSelect
                label="Cliente / Adquiriente"
                items={customerSelectItems}
                value={customerId}
                onChange={(val) => {
                  setCustomerId(val);
                  setCustomerNameOverride('');
                  applyCustomerTariff(val, customers, contracts, tariffs);
                }}
                getValue={(c) => c.id}
                getLabel={(c) => `${c.name} (${c.nit})`}
                onCreateNew={
                  hasClientes ? () => setShowNewCustomerModal(true) : undefined
                }
                createLabel="+ Nuevo Cliente"
                searchable
              />
            </div>

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
              onOpenNewVehicleModal={() => setShowNewVehicleModal(true)}
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
                  {cart.map((item, idx) => {
                    const lockedCatalogPrice =
                      Boolean(item.productId) && hasInventario;
                    return (
                      <tr key={`${item.code}-${idx}`}>
                        <td>
                          <strong>{item.description}</strong>
                          <div
                            style={{ fontSize: 10.5, color: 'var(--pk-muted)' }}
                          >
                            {item.itemType} • IVA {item.taxPct}%
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
                              width: 68,
                              padding: '4px 6px',
                              borderRadius: 6,
                              border: '1px solid var(--pk-border)',
                            }}
                          />
                        </td>
                        <td style={{ width: 118 }}>
                          <input
                            type="number"
                            min={1}
                            value={item.unitPrice}
                            readOnly={lockedCatalogPrice}
                            title={
                              lockedCatalogPrice
                                ? 'Precio gobernado por el catálogo central de inventario'
                                : undefined
                            }
                            onChange={(e) =>
                              updateCartItem(idx, {
                                unitPrice: Number(e.target.value || 0),
                              })
                            }
                            style={{
                              width: 104,
                              padding: '4px 6px',
                              borderRadius: 6,
                              border: '1px solid var(--pk-border)',
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
                          padding: 18,
                        }}
                      >
                        Selecciona productos o servicios de la columna izquierda
                        para iniciar la venta.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="pk-form-grid" style={{ marginTop: 14 }}>
              <div className="pk-field">
                <label>Medio de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="Efectivo">Efectivo en Caja</option>
                  <option value="Transferencia / Nequi">
                    Transferencia / Nequi / PSE
                  </option>
                  <option value="Tarjeta Débito / Crédito">
                    Tarjeta Débito / Crédito
                  </option>
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
                        if (e.target.checked && !amountPaidInput) {
                          setAmountPaidInput('0');
                        }
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
                    <input
                      readOnly
                      value="Contado 100%"
                      style={{ background: '#f8fafc' }}
                    />
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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12.5,
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
                    fontSize: 12.5,
                    color: 'var(--pk-rose)',
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
                  fontSize: 12.5,
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12.5,
                    color: 'var(--pk-amber)',
                    marginTop: 4,
                  }}
                >
                  <span>Saldo a Cartera CxC:</span>
                  <strong>
                    {formatCop(
                      Math.max(0, grandTotal - Number(amountPaidInput || 0))
                    )}
                  </strong>
                </div>
              )}
            </div>

            <div className="pk-row-actions" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="pk-btn pk-btn-primary"
                disabled={busy}
                onClick={() => submitInvoice(false)}
              >
                {busy ? 'Procesando...' : '⚡ Emitir Factura'}
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-emerald"
                disabled={busy}
                onClick={() => submitInvoice(true)}
              >
                {busy ? 'Procesando...' : '🖨️ Facturar e Imprimir'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📋 Facturas Emitidas Recientemente</div>
          <button
            type="button"
            className="pk-btn pk-btn-outline pk-btn-sm"
            onClick={() =>
              downloadCsvUtf8(
                'ventas_facturacion.csv',
                [
                  'Factura',
                  'Fecha',
                  'Cliente',
                  'NIT',
                  'MedioPago',
                  'Total',
                  'Pagado',
                  'SaldoCxC',
                  'Estado',
                ],
                invoices.map((inv) => [
                  inv.id,
                  inv.issueDate || inv.date || '',
                  inv.customerName,
                  inv.customerNit,
                  inv.paymentMethod,
                  inv.total,
                  inv.amountPaid,
                  inv.pendingBalance,
                  inv.status,
                ])
              )
            }
          >
            📥 Exportar Ventas (.CSV)
          </button>
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
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.id}</strong>
                    </td>
                    <td>{inv.issueDate || inv.date}</td>
                    <td>
                      <strong>{inv.customerName}</strong>
                      <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                        {inv.customerNit}
                      </div>
                    </td>
                    <td>
                      {inv.plate ? (
                        <div>
                          <span className="pk-badge pk-badge-blue">
                            {inv.plate}
                          </span>
                          {inv.mechanicName && (
                            <div
                              style={{ fontSize: 11, color: 'var(--pk-muted)' }}
                            >
                              {inv.mechanicName}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--pk-muted)' }}>
                          Mostrador
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>{formatCop(inv.total)}</strong>
                    </td>
                    <td>
                      {inv.pendingBalance > 0 ? (
                        <span className="pk-badge pk-badge-amber">
                          {formatCop(inv.pendingBalance)}
                        </span>
                      ) : (
                        <span
                          style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}
                        >
                          $0
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`pk-badge ${
                          inv.pendingBalance > 0
                            ? 'pk-badge-amber'
                            : 'pk-badge-emerald'
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
                        <PkPrintButton
                          label="🖨️ Imprimir"
                          variant="primary"
                          payload={buildInvoicePrintPayload(inv)}
                        />
                        {inv.pendingBalance > 0 && hasClientes && (
                          <button
                            type="button"
                            className="pk-btn pk-btn-amber pk-btn-sm"
                            onClick={() =>
                              navigateTo('ms-clientes', 'cartera_cxc')
                            }
                          >
                            💳 Abonar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{ textAlign: 'center', color: 'var(--pk-muted)' }}
                    >
                      Aún no hay facturas emitidas en este turno.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PkModal
        open={Boolean(selectedInvoice)}
        title={`🧾 Detalle de Factura ${selectedInvoice?.id || ''}`}
        onClose={() => setSelectedInvoice(null)}
      >
        {selectedInvoice && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              <div>
                <strong>Cliente:</strong> {selectedInvoice.customerName} (
                {selectedInvoice.customerNit})
              </div>
              <div>
                <strong>Fecha:</strong>{' '}
                {selectedInvoice.issueDate || selectedInvoice.date}
              </div>
              <div>
                <strong>Medio de Pago:</strong> {selectedInvoice.paymentMethod}
              </div>
              <div>
                <strong>Formato de Documento:</strong>{' '}
                {({
                  carta_membrete: 'Carta Membrete Corporativa',
                  tirilla_80mm: 'Tirilla POS 80 mm',
                  media_carta: 'Media Carta Comercial',
                  factura_taller: 'Orden / Factura de Taller',
                } as Record<string, string>)[selectedInvoice.layoutVariant || 'carta_membrete'] || 'Carta Membrete Corporativa'}
              </div>
              {selectedInvoice.plate && (
                <div>
                  <strong>Placa / Técnico:</strong> {selectedInvoice.plate} —{' '}
                  {selectedInvoice.mechanicName || 'N/A'}
                </div>
              )}
              {selectedInvoice.cufe && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    fontSize: 11,
                    wordBreak: 'break-all',
                    color: 'var(--pk-muted)',
                  }}
                >
                  <strong>CUFE ({selectedInvoice.dianStatus || 'DIAN'}):</strong>{' '}
                  {selectedInvoice.cufe}
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
                      <td>{it.description}</td>
                      <td>{it.quantity}</td>
                      <td>{formatCop(it.unitPrice)}</td>
                      <td>
                        <strong>{formatCop(it.subtotal)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 14,
              }}
            >
              <div>
                <strong>Total: {formatCop(selectedInvoice.total)}</strong> •
                Saldo: {formatCop(selectedInvoice.pendingBalance)}
              </div>
              <PkPrintButton
                label="🖨️ Imprimir Representación Gráfica"
                variant="primary"
                payload={buildInvoicePrintPayload(selectedInvoice)}
              />
            </div>
          </div>
        )}
      </PkModal>

      {quickModals}
    </div>
  );
};

export default FacturacionView;
