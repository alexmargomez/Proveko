import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ModuleGate,
  PkAutoCodeInput,
  PkDistributionStrip,
  PkFullscreenDialog,
  PkKanbanBoard,
  PkKpiRow,
  PkLiveHeader,
  PkModal,
  PkPrintButton,
  PkProcessNodes,
  PkSelect,
  PkSimpleSelect,
  PkTicketCard,
  downloadCsvUtf8,
  formatCop,
  useAsyncAction,
  usePlatform,
} from '@platform/ui-sdk';
import {
  VehicleOption,
  WorkerOption,
} from './modules/FacturasTallerBox';
import {
  AdjustmentNoteRecord,
  DianTransmissionRecord,
  FacturacionDianTab,
  InvoiceItemRecord,
  InvoiceRecord,
  InvoiceTypeKey,
  buildFourStageNodes,
  resolveDianStage,
} from './modules/FacturacionDianTab';
import {
  ContractOption,
  CustomerOption,
  InvoiceFullscreenStudio,
  InvoiceStudioInitialDraft,
  InvoiceStudioSubmitPayload,
  ProductOption,
  TariffOption,
} from './modules/InvoiceFullscreenStudio';
import {
  AdjustmentNoteStudioDialog,
  AdjustmentNoteSubmitPayload,
  AdjustmentNotesTab,
} from './modules/AdjustmentNotesTab';

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
  nextCreditNoteNumber?: string;
  nextDebitNoteNumber?: string;
  invoices: InvoiceRecord[];
  quotes: QuoteRecord[];
  adjustmentNotes?: AdjustmentNoteRecord[];
  dianTransmissions?: DianTransmissionRecord[];
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
  'notas_ajuste',
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

function channelBadgeForInvoice(inv: InvoiceRecord): {
  label: string;
  tone: 'coral' | 'blue' | 'purple' | 'emerald' | 'amber' | 'slate';
} {
  const t = (inv.invoiceType || '').toUpperCase();
  if (t === 'TALLER' || inv.plate || inv.vehicleId) {
    return {
      label: inv.plate ? `🔧 Placa ${inv.plate}` : '🔧 Automotriz',
      tone: 'blue',
    };
  }
  if (t === 'HOTELERIA' || inv.linkedRoomId) {
    return {
      label: inv.linkedRoomId ? `🏨 Hab. ${inv.linkedRoomId}` : '🏨 Hotelería',
      tone: 'emerald',
    };
  }
  if (t === 'COMANDA' || inv.linkedTableId) {
    return {
      label: inv.linkedTableId ? `🍽️ ${inv.linkedTableId}` : '🍽️ Gastronomía',
      tone: 'coral',
    };
  }
  if (t === 'CORPORATIVA_CXC' || inv.contractId || inv.purchaseOrderRef) {
    return { label: '🏢 Corporativa CxC', tone: 'purple' };
  }
  return { label: '🛒 Mostrador POS', tone: 'slate' };
}

export const FacturacionView: React.FC = () => {
  const {
    activeModuleKey,
    setActiveModuleKey,
    navigateTo,
    apiGet,
    apiPost,
    apiPut,
    toast,
    hasService,
    hasModule,
    hasPrintCapability,
    openHtmlPrintWindow,
    requestPrintDocument,
    incomingPayload,
    clearIncomingPayload,
  } = usePlatform();

  const { busy, run } = useAsyncAction();

  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('FEVP-9013');
  const [nextQuoteNumber, setNextQuoteNumber] = useState('COT-3012');
  const [nextCreditNoteNumber, setNextCreditNoteNumber] = useState('NC-1002');
  const [nextDebitNoteNumber, setNextDebitNoteNumber] = useState('ND-2001');
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [adjustmentNotes, setAdjustmentNotes] = useState<AdjustmentNoteRecord[]>(
    []
  );

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [tariffs, setTariffs] = useState<TariffOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);

  // Main Invoices Board / Table state
  const [invoiceDisplayMode, setInvoiceDisplayMode] = useState<
    'board' | 'table'
  >('board');
  const [invoicePill, setInvoicePill] = useState<string>('ALL');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(
    null
  );

  // Full-Screen Invoice Studio state
  const [invoiceStudioOpen, setInvoiceStudioOpen] = useState(false);
  const [invoiceStudioDraft, setInvoiceStudioDraft] =
    useState<InvoiceStudioInitialDraft | null>(null);

  // Full-Screen Adjustment Note Studio state
  const [noteStudioOpen, setNoteStudioOpen] = useState(false);
  const [noteStudioPreselectedInvId, setNoteStudioPreselectedInvId] = useState<
    string | undefined
  >(undefined);
  const [editingNote, setEditingNote] = useState<AdjustmentNoteRecord | null>(
    null
  );

  // Quotes Studio & View state
  const [quoteDisplayMode, setQuoteDisplayMode] = useState<'board' | 'table'>(
    'board'
  );
  const [quoteStudioOpen, setQuoteStudioOpen] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteCustomerId, setQuoteCustomerId] = useState('');
  const [quoteProductId, setQuoteProductId] = useState('');
  const [quoteQty, setQuoteQty] = useState('1');
  const [quoteItems, setQuoteItems] = useState<InvoiceItemRecord[]>([]);
  const [quoteValidUntil, setQuoteValidUntil] = useState(defaultValidUntilDate);
  const [quoteNotes, setQuoteNotes] = useState(
    'Precios sujetos a disponibilidad de inventario.'
  );

  // Quick Auxiliary Modals (New Customer / New Vehicle)
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
  const hasDianModule = hasModule('facturacion_dian');
  const hasNotasModule = hasModule('notas_ajuste');

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
      setNextCreditNoteNumber(posRes.value.nextCreditNoteNumber || 'NC-1002');
      setNextDebitNoteNumber(posRes.value.nextDebitNoteNumber || 'ND-2001');
      setInvoices(posRes.value.invoices || []);
      setQuotes(posRes.value.quotes || []);
      setAdjustmentNotes(posRes.value.adjustmentNotes || []);
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

  // Auto-open InvoiceFullscreenStudio when incomingPayload arrives from Comandas / Taller / Hotelería
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
    const rawCustNit =
      typeof incomingPayload.customerNit === 'string'
        ? incomingPayload.customerNit.trim()
        : '';

    const rawVehId =
      typeof incomingPayload.vehicleId === 'string'
        ? incomingPayload.vehicleId.trim()
        : '';
    const rawPlate =
      typeof incomingPayload.plate === 'string'
        ? incomingPayload.plate.trim().toUpperCase()
        : '';
    const kmText = formatKmText(incomingPayload.currentKm);
    const oilText = formatKmText(incomingPayload.nextOilKm);
    const rawMechId =
      typeof incomingPayload.mechanicId === 'string'
        ? incomingPayload.mechanicId
        : '';
    const rawOrderId =
      typeof incomingPayload.linkedWorkOrderId === 'string'
        ? incomingPayload.linkedWorkOrderId
        : '';
    const rawRoomId =
      typeof incomingPayload.linkedRoomId === 'string'
        ? incomingPayload.linkedRoomId
        : '';
    const rawTableId =
      typeof incomingPayload.linkedTableId === 'string'
        ? incomingPayload.linkedTableId
        : '';

    let detectedType: InvoiceTypeKey = 'MOSTRADOR';
    if (rawTableId) {
      detectedType = 'COMANDA';
    } else if (rawRoomId) {
      detectedType = 'HOTELERIA';
    } else if (rawPlate || rawVehId || rawOrderId) {
      detectedType = 'TALLER';
    }

    const normalizedItems: InvoiceItemRecord[] = [];
    if (Array.isArray(incomingPayload.items) && incomingPayload.items.length > 0) {
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
          isServiceKind ||
          (products.length > 0 && candidateProdId !== '' && !matchesCatalog)
            ? 'SERVICIO'
            : 'PRODUCTO';
        const resolvedProdId =
          resolvedType === 'PRODUCTO' &&
          (products.length === 0 || matchesCatalog)
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

        normalizedItems.push({
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
    }

    setInvoiceStudioDraft({
      editingInvoice: null,
      invoiceType: detectedType,
      customerId: rawCustId,
      customerName: rawCustName,
      customerNit: rawCustNit,
      vehicleId: rawVehId,
      plate: rawPlate,
      currentKm: kmText,
      nextOilKm: oilText,
      mechanicId: rawMechId,
      workOrderId: rawOrderId,
      linkedRoomId: rawRoomId,
      linkedTableId: rawTableId,
      items: normalizedItems,
    });
    setActiveModuleKey('pos_mostrador');
    setInvoiceStudioOpen(true);
    clearIncomingPayload();
    toast('Cuenta operativa cargada en el Estudio de Facturación');
  }, [
    incomingPayload,
    clearIncomingPayload,
    products,
    setActiveModuleKey,
    toast,
  ]);

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
      if (inv.purchaseOrderRef) {
        extra['Orden de Compra'] = inv.purchaseOrderRef;
      }
      if (inv.dueDate) {
        extra['Vencimiento'] = inv.dueDate;
      }
      if (inv.cufe) {
        extra['CUFE'] = inv.cufe;
        extra['Estado DIAN'] = inv.dianStatus || 'ACEPTADA DIAN';
      }

      return {
        document_type: inv.cufe
          ? 'FACTURA ELECTRÓNICA DE VENTA'
          : inv.docStatus === 'BORRADOR'
          ? 'BORRADOR DE FACTURA COMERCIAL'
          : 'FACTURA DE VENTA COMERCIAL',
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

  const buildNotePrintPayload = useCallback(
    (note: AdjustmentNoteRecord): Record<string, unknown> => ({
      document_type:
        note.noteKind === 'DEBIT'
          ? 'NOTA DÉBITO ELECTRÓNICA'
          : 'NOTA CRÉDITO ELECTRÓNICA',
      document_number: note.id,
      issue_date: note.issueDate,
      customer_name: note.customerName,
      customer_nit: note.customerNit,
      extra_fields: {
        'Factura Referenciada': note.invoiceId,
        'Causal DIAN': `${note.reasonCode} — ${note.reasonDescription}`,
        ...(note.cude ? { CUDE: note.cude } : {}),
        ...(note.referencedCufe
          ? { 'CUFE Factura': note.referencedCufe }
          : {}),
      },
      items: (note.items || []).map((it) => ({
        code: it.code,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        tax_pct: it.taxPct,
        subtotal: it.subtotal,
      })),
      subtotal: note.subtotal,
      tax_total: note.taxTotal,
      grand_total: note.total,
      notes: note.reasonDescription,
    }),
    []
  );

  const openCreateInvoiceStudio = (presetType: InvoiceTypeKey = 'MOSTRADOR') => {
    setInvoiceStudioDraft({
      editingInvoice: null,
      invoiceType: presetType,
      items: [],
    });
    setInvoiceStudioOpen(true);
  };

  const openEditInvoiceStudio = (inv: InvoiceRecord) => {
    setInvoiceStudioDraft({
      editingInvoice: inv,
    });
    setInvoiceStudioOpen(true);
  };

  const handleInvoiceStudioSubmit = (payload: InvoiceStudioSubmitPayload) => {
    void run(async () => {
      const body = {
        saveMode: payload.saveMode,
        invoiceType: payload.invoiceType,
        dueDate: payload.dueDate,
        purchaseOrderRef: payload.purchaseOrderRef,
        customerId: payload.customerId,
        customerName: payload.customerName,
        customerNit: payload.customerNit,
        customerPhone: payload.customerPhone,
        customerAddress: payload.customerAddress,
        contractId: payload.contractId,
        discountPct: payload.discountPct,
        vehicleId: payload.vehicleId,
        plate: payload.plate,
        mechanicId: payload.mechanicId,
        mechanicName: payload.mechanicName,
        linkedWorkOrderId: payload.linkedWorkOrderId,
        linkedRoomId: payload.linkedRoomId,
        linkedTableId: payload.linkedTableId,
        workshopMeta: payload.workshopMeta,
        items: payload.items,
        paymentMethod: payload.paymentMethod,
        amountPaid: payload.amountPaid,
        notes: payload.notes,
        renderPrint: payload.renderPrint,
      };

      const res = payload.editingInvoiceId
        ? await apiPut<{
            ok: boolean;
            invoice: InvoiceRecord;
            printHtml?: string;
          }>(`/api/v1/facturacion/invoices/${payload.editingInvoiceId}`, body)
        : await apiPost<{
            ok: boolean;
            invoice: InvoiceRecord;
            printHtml?: string;
          }>('/api/v1/facturacion/invoices', body);

      setInvoiceStudioOpen(false);
      await loadAll();

      if (payload.saveMode === 'DRAFT') {
        toast(`Borrador ${res.invoice.id} guardado (editable, sin descontar stock)`);
      } else if (payload.editingInvoiceId) {
        toast(`Factura ${res.invoice.id} actualizada exitosamente`);
      } else {
        toast(`Factura ${res.invoice.id} confirmada comercialmente`);
      }

      if (payload.renderPrint) {
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

  const handleConfirmDraftInvoice = (invoiceId: string) => {
    void run(async () => {
      const res = await apiPost<{
        ok: boolean;
        invoice: InvoiceRecord;
      }>(`/api/v1/facturacion/invoices/${invoiceId}/confirm`, {
        renderPrint: false,
      });
      await loadAll();
      toast(
        `Borrador promovido a factura oficial ${res.invoice.id} — lista para Paso 1 DIAN`
      );
    });
  };

  const handleSendToDian = (
    documentKind: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE',
    documentId: string
  ) => {
    void run(async () => {
      const res = await apiPost<{
        ok: boolean;
        transmission: DianTransmissionRecord;
      }>('/api/v1/facturacion/dian/send', {
        documentKind,
        documentId,
      });
      await loadAll();
      toast(
        `Paso 1 DIAN completado: ${documentId} transmitido (${res.transmission.trackId || 'XML UBL 2.1'})`
      );
    });
  };

  const handleRespondDian = (
    documentKind: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE',
    documentId: string,
    outcome: 'ACCEPTED' | 'REJECTED',
    rejectionCode?: string,
    rejectionMessage?: string
  ) => {
    void run(async () => {
      await apiPost('/api/v1/facturacion/dian/respond', {
        documentKind,
        documentId,
        outcome,
        rejectionCode,
        rejectionMessage,
      });
      await loadAll();
      if (outcome === 'ACCEPTED') {
        toast(
          `Paso 2 DIAN: ${documentId} validado exitosamente con firma SHA-384`
        );
      } else {
        toast(
          `Documento ${documentId} marcado como rechazado DIAN — habilitado para corrección`
        );
      }
    });
  };

  const openNoteStudioForInvoice = (invoiceId?: string) => {
    setEditingNote(null);
    setNoteStudioPreselectedInvId(invoiceId);
    setNoteStudioOpen(true);
  };

  const openEditNoteStudio = (note: AdjustmentNoteRecord) => {
    setEditingNote(note);
    setNoteStudioPreselectedInvId(note.invoiceId);
    setNoteStudioOpen(true);
  };

  const handleNoteStudioSubmit = (payload: AdjustmentNoteSubmitPayload) => {
    void run(async () => {
      const body = {
        saveMode: payload.saveMode,
        noteKind: payload.noteKind,
        invoiceId: payload.invoiceId,
        customerName: payload.customerName,
        customerNit: payload.customerNit,
        reasonCode: payload.reasonCode,
        reasonDescription: payload.reasonDescription,
        restockInventory: payload.restockInventory,
        items: payload.items,
      };
      const res = payload.editingNoteId
        ? await apiPut<{ ok: boolean; adjustmentNote: AdjustmentNoteRecord }>(
            `/api/v1/facturacion/notes/${payload.editingNoteId}`,
            body
          )
        : await apiPost<{ ok: boolean; adjustmentNote: AdjustmentNoteRecord }>(
            '/api/v1/facturacion/notes',
            body
          );
      setNoteStudioOpen(false);
      await loadAll();
      toast(
        payload.saveMode === 'DRAFT'
          ? `Borrador de nota ${res.adjustmentNote.id} guardado`
          : `Nota ${res.adjustmentNote.id} confirmada sobre ${res.adjustmentNote.invoiceId}`
      );
    });
  };

  const handleConfirmNote = (noteId: string) => {
    void run(async () => {
      const res = await apiPost<{
        ok: boolean;
        adjustmentNote: AdjustmentNoteRecord;
      }>(`/api/v1/facturacion/notes/${noteId}/confirm`, {});
      await loadAll();
      toast(`Nota oficial ${res.adjustmentNote.id} confirmada exitosamente`);
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
        setQuoteCustomerId(res.customer.id);
      }
      toast(`Cliente ${res.customer?.name || ''} registrado`);
    });
  };

  const handleCreateQuickVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehPlate.trim() || !newVehBrand.trim()) {
      toast('La placa y la línea/marca del vehículo son obligatorias');
      return;
    }
    const kmNum = Math.max(0, Math.round(Number(newVehKm || 0)));
    void run(async () => {
      const res = await apiPost<{ ok: boolean; vehicle: VehicleOption }>(
        '/api/v1/taller/vehicles',
        {
          plate: newVehPlate.trim().toUpperCase(),
          brand: newVehBrand.trim(),
          vehicleType: newVehType,
          customerId: '',
          customerName: 'Cliente Taller',
          currentKm: kmNum,
        }
      );
      setShowNewVehicleModal(false);
      setNewVehPlate('');
      setNewVehBrand('');
      await loadAll();
      toast(`Placa ${res.vehicle?.plate || ''} registrada`);
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

  const handleSaveQuote = () => {
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
      setQuoteStudioOpen(false);
      await loadAll();
    });
  };

  const convertQuoteToInvoice = (q: QuoteRecord) => {
    setInvoiceStudioDraft({
      editingInvoice: null,
      invoiceType: 'MOSTRADOR',
      customerId: q.customerId,
      customerName: q.customerName,
      customerNit: q.customerNit,
      items: (q.items || []).map((it) => ({ ...it })),
      notes: `Facturada según cotización ${q.id}`,
    });
    setActiveModuleKey('pos_mostrador');
    setInvoiceStudioOpen(true);
    toast(`Cotización ${q.id} cargada en el Estudio de Facturación`);
  };

  const currentTab =
    VALID_MODULES.includes(
      activeModuleKey as (typeof VALID_MODULES)[number]
    ) && hasModule(activeModuleKey)
      ? activeModuleKey
      : VALID_MODULES.find((m) => hasModule(m)) || 'pos_mostrador';

  const sharedOverlays = (
    <>
      <InvoiceFullscreenStudio
        open={invoiceStudioOpen}
        onClose={() => setInvoiceStudioOpen(false)}
        busy={busy}
        nextInvoiceNumber={nextInvoiceNumber}
        initialState={invoiceStudioDraft}
        customers={customers}
        contracts={contracts}
        tariffs={tariffs}
        products={products}
        vehicles={vehicles}
        workers={workers}
        onOpenNewCustomerModal={() => setShowNewCustomerModal(true)}
        onOpenNewVehicleModal={() => setShowNewVehicleModal(true)}
        onSubmit={handleInvoiceStudioSubmit}
      />

      <AdjustmentNoteStudioDialog
        open={noteStudioOpen}
        onClose={() => setNoteStudioOpen(false)}
        busy={busy}
        invoices={invoices}
        nextCreditNoteNumber={nextCreditNoteNumber}
        nextDebitNoteNumber={nextDebitNoteNumber}
        preselectedInvoiceId={noteStudioPreselectedInvId}
        editingNote={editingNote}
        onSubmit={handleNoteStudioSubmit}
      />

      <PkModal
        open={showNewCustomerModal}
        title="👤 Registro Rápido de Cliente Comercial"
        onClose={() => setShowNewCustomerModal(false)}
        maxWidth={700}
      >
        <form onSubmit={handleCreateQuickCustomer}>
          <div className="pk-form-grid cols-2">
            <PkSimpleSelect
              label="Tipo Documento"
              value={newCustDocType}
              onChange={setNewCustDocType}
              options={[
                { value: 'NIT', label: 'NIT Empresarial' },
                { value: 'CC', label: 'Cédula de Ciudadanía' },
                { value: 'CE', label: 'Cédula de Extranjería' },
              ]}
            />
            <div className="pk-field">
              <label>NIT / Documento *</label>
              <input
                value={newCustNit}
                onChange={(e) => setNewCustNit(e.target.value)}
                placeholder="Ej: 901.482.110-3"
                required
              />
            </div>
            <div className="pk-field pk-col-span-full">
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
            <div className="pk-field pk-col-span-full">
              <label>Dirección Comercial</label>
              <input
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                placeholder="Cra. 15 # 93-40 Of. 302"
              />
            </div>
            <div className="pk-form-actions">
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
                {busy ? 'Guardando...' : 'Guardar Cliente'}
              </button>
            </div>
          </div>
        </form>
      </PkModal>

      <PkModal
        open={showNewVehicleModal}
        title="🚗 Registro Rápido de Placa / Vehículo"
        onClose={() => setShowNewVehicleModal(false)}
        maxWidth={640}
      >
        <form onSubmit={handleCreateQuickVehicle}>
          <div className="pk-form-grid cols-2">
            <div className="pk-field">
              <label>Placa *</label>
              <input
                value={newVehPlate}
                onChange={(e) => setNewVehPlate(e.target.value.toUpperCase())}
                placeholder="Ej: KLP842"
                required
              />
            </div>
            <PkSimpleSelect
              label="Tipo de Vehículo"
              value={newVehType}
              onChange={setNewVehType}
              options={[
                { value: 'Automóvil', label: 'Automóvil' },
                { value: 'Camioneta', label: 'Camioneta / SUV' },
                { value: 'Motocicleta', label: 'Motocicleta' },
                { value: 'Utilitario / Carga', label: 'Utilitario / Carga' },
              ]}
            />
            <div className="pk-field pk-col-span-full">
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
            <div className="pk-form-actions">
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
          </div>
        </form>
      </PkModal>

      <PkModal
        open={Boolean(selectedInvoice)}
        title={`🧾 Expediente de Factura ${selectedInvoice?.id || ''}`}
        onClose={() => setSelectedInvoice(null)}
        maxWidth={720}
      >
        {selectedInvoice && (
          <div className="pk-stack">
            <PkProcessNodes
              steps={buildFourStageNodes(
                selectedInvoice.docStatus,
                selectedInvoice.dianStage,
                selectedInvoice.cufe
              )}
              compact
            />

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                fontSize: 13,
              }}
            >
              <div>
                <strong>Cliente:</strong> {selectedInvoice.customerName} (
                {selectedInvoice.customerNit})
              </div>
              <div>
                <strong>Emisión:</strong>{' '}
                {selectedInvoice.issueDate || selectedInvoice.date}
              </div>
              <div>
                <strong>Medio de Pago:</strong> {selectedInvoice.paymentMethod}
              </div>
              <div>
                <strong>Estado Comercial:</strong> {selectedInvoice.status}
              </div>
              {selectedInvoice.plate && (
                <div>
                  <strong>Placa / Técnico:</strong> {selectedInvoice.plate} —{' '}
                  {selectedInvoice.mechanicName || 'N/A'}
                </div>
              )}
              {selectedInvoice.purchaseOrderRef && (
                <div>
                  <strong>Orden de Compra:</strong>{' '}
                  {selectedInvoice.purchaseOrderRef}
                </div>
              )}
              {selectedInvoice.cufe && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    fontSize: 11,
                    wordBreak: 'break-all',
                    color: '#065f46',
                    fontFamily: 'monospace',
                    background: '#ecfdf5',
                    padding: '8px 10px',
                    borderRadius: 8,
                  }}
                >
                  <strong>CUFE ({selectedInvoice.dianStatus || 'ACEPTADA DIAN'}):</strong>{' '}
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
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <strong>Total: {formatCop(selectedInvoice.total)}</strong> •
                Saldo CxC: {formatCop(selectedInvoice.pendingBalance)}
                {(selectedInvoice.creditedTotal || 0) > 0 && (
                  <span style={{ color: 'var(--pk-rose)', marginLeft: 8 }}>
                    • Acreditado NC: {formatCop(selectedInvoice.creditedTotal || 0)}
                  </span>
                )}
              </div>
              <div className="pk-row-actions">
                {selectedInvoice.editable && (
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    onClick={() => {
                      const target = selectedInvoice;
                      setSelectedInvoice(null);
                      openEditInvoiceStudio(target);
                    }}
                  >
                    ✏️ Editar
                  </button>
                )}
                <PkPrintButton
                  label="🖨️ Imprimir Representación Gráfica"
                  variant="primary"
                  payload={buildInvoicePrintPayload(selectedInvoice)}
                />
              </div>
            </div>
          </div>
        )}
      </PkModal>
    </>
  );

  // TAB: FACTURACIÓN ELECTRÓNICA DIAN (2 PASOS)
  if (currentTab === 'facturacion_dian') {
    return (
      <>
        <FacturacionDianTab
          invoices={invoices}
          adjustmentNotes={adjustmentNotes}
          busy={busy}
          onSendToDian={handleSendToDian}
          onRespondDian={handleRespondDian}
          onEditInvoice={openEditInvoiceStudio}
          onEditNote={openEditNoteStudio}
          onOpenNoteFromInvoice={(inv) => openNoteStudioForInvoice(inv.id)}
          buildPrintPayload={buildInvoicePrintPayload}
          buildNotePrintPayload={buildNotePrintPayload}
        />
        {sharedOverlays}
      </>
    );
  }

  // TAB: NOTAS CRÉDITO Y DÉBITO
  if (currentTab === 'notas_ajuste') {
    return (
      <>
        <AdjustmentNotesTab
          notes={adjustmentNotes}
          invoices={invoices}
          nextCreditNoteNumber={nextCreditNoteNumber}
          nextDebitNoteNumber={nextDebitNoteNumber}
          busy={busy}
          onOpenCreateNote={(invId) => openNoteStudioForInvoice(invId)}
          onEditNote={openEditNoteStudio}
          onConfirmNote={handleConfirmNote}
          onSendNoteToDian={(note) =>
            handleSendToDian(
              note.noteKind === 'DEBIT' ? 'DEBIT_NOTE' : 'CREDIT_NOTE',
              note.id
            )
          }
          buildNotePrintPayload={buildNotePrintPayload}
        />
        {sharedOverlays}
      </>
    );
  }

  // TAB: COTIZACIONES COMERCIALES
  if (currentTab === 'cotizaciones') {
    const quoteSub = quoteItems.reduce(
      (acc, it) => acc + it.quantity * it.unitPrice,
      0
    );
    const totalQuotedCop = quotes.reduce((acc, q) => acc + q.total, 0);
    const filteredQuotes = quoteSearch.trim()
      ? quotes.filter((q) => {
          const term = quoteSearch.trim().toLowerCase();
          return (
            q.id.toLowerCase().includes(term) ||
            q.customerName.toLowerCase().includes(term) ||
            (q.customerNit || '').toLowerCase().includes(term)
          );
        })
      : quotes;

    const customerSelectItems: CustomerOption[] = [
      { id: '', nit: '222222222222', name: 'Cliente Comercial General' },
      ...customers,
    ];

    return (
      <ModuleGate module="cotizaciones">
        <div className="pk-stack">
          <PkKpiRow
            items={[
              {
                label: 'Cotizaciones Emitidas',
                value: String(quotes.length),
                color: 'var(--pk-primary)',
              },
              {
                label: 'Valor Comercial Cotizado',
                value: formatCop(totalQuotedCop),
                color: 'var(--pk-emerald)',
              },
              {
                label: 'Próximo Consecutivo',
                value: nextQuoteNumber,
              },
            ]}
          />

          <PkLiveHeader
            title="Cotizaciones Comerciales"
            liveLabel="En vivo"
            subtitle="Propuestas formales con vigencia controlada listas para convertirse en factura en un clic."
            displayMode={quoteDisplayMode}
            onDisplayModeChange={setQuoteDisplayMode}
            boardLabel="🎛️ Tablero de Propuestas"
            tableLabel="📋 Vista Tabla"
            primaryActionLabel="+ Nueva Cotización"
            onPrimaryAction={() => setQuoteStudioOpen(true)}
            extraActions={
              <input
                className="pk-input"
                style={{ minWidth: 220, minHeight: 38 }}
                placeholder="🔎 Buscar cotización o cliente..."
                value={quoteSearch}
                onChange={(e) => setQuoteSearch(e.target.value)}
              />
            }
          />

          {quoteDisplayMode === 'board' ? (
            <PkKanbanBoard
              columns={[
                {
                  key: 'VIGENTES',
                  title: '🔵 Propuestas Vigentes',
                  dotColor: 'blue',
                  count: filteredQuotes.length,
                  emptyText: 'Aún no hay cotizaciones registradas',
                  children: filteredQuotes.map((q) => (
                    <PkTicketCard
                      key={q.id}
                      code={q.id}
                      timeAgo={q.createdAt}
                      channelBadge={{ label: 'Propuesta Comercial', tone: 'blue' }}
                      title={q.customerName}
                      subtitle={`NIT: ${q.customerNit || 'N/A'} • Válida hasta ${q.validUntil}`}
                      items={(q.items || []).slice(0, 3).map((it) => ({
                        qty: it.quantity,
                        name: it.description,
                        amount: formatCop(it.subtotal),
                      }))}
                      highlightNote={q.notes}
                      totalLabel="TOTAL COTIZADO"
                      totalValue={formatCop(q.total)}
                      primaryAction={{
                        label: '🛒 Convertir en Factura',
                        tone: 'emerald',
                        onClick: () => convertQuoteToInvoice(q),
                      }}
                      secondaryActions={
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
                      }
                    />
                  ))}
              ]}
            />
          ) : (
            <div className="pk-card">
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
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuotes.map((q) => (
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
                                label="🖨️ Imprimir"
                                payload={{
                                  document_type: 'COTIZACIÓN COMERCIAL',
                                  document_number: q.id,
                                  issue_date: q.createdAt,
                                  customer_name: q.customerName,
                                  customer_nit: q.customerNit,
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
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <PkFullscreenDialog
            open={quoteStudioOpen}
            onClose={() => setQuoteStudioOpen(false)}
            title="📄 Estudio de Propuesta y Cotización Comercial"
            subtitle="Elabora propuestas comerciales formales con precios del catálogo central y vigencia controlada."
            badge={{ label: nextQuoteNumber, tone: 'blue' }}
            footerLeft={
              <strong style={{ fontSize: 18, color: 'var(--pk-navy)' }}>
                Subtotal Cotizado: {formatCop(quoteSub)}
              </strong>
            }
            footerActions={
              <>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline"
                  onClick={() => setQuoteStudioOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="pk-btn pk-btn-primary"
                  disabled={busy}
                  onClick={handleSaveQuote}
                >
                  💾 Guardar Cotización ({nextQuoteNumber})
                </button>
              </>
            }
          >
            <div className="pk-card">
              <div className="pk-card-body pk-stack">
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
                  <div className="pk-form-grid">
                    <div className="pk-col-span-2">
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
                    </div>
                    <div className="pk-field">
                      <label>Cantidad</label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <input
                          type="number"
                          min={1}
                          value={quoteQty}
                          onChange={(e) => setQuoteQty(e.target.value)}
                        />
                        <button
                          type="button"
                          className="pk-btn pk-btn-primary"
                          onClick={handleAddQuoteLine}
                        >
                          + Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {quoteItems.length > 0 && (
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Descripción</th>
                          <th>Cant.</th>
                          <th>Vr. Unitario</th>
                          <th>Subtotal</th>
                          <th></th>
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

                <div className="pk-field">
                  <label>Condiciones Comerciales y Validez</label>
                  <input
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </PkFullscreenDialog>

          {sharedOverlays}
        </div>
      </ModuleGate>
    );
  }

  // TAB: APARTADO FACTURAS DE TALLER
  if (currentTab === 'facturas_taller') {
    const workshopInvoices = invoices.filter(
      (inv) =>
        Boolean(inv.plate || inv.vehicleId) ||
        (inv.invoiceType || '').toUpperCase() === 'TALLER'
    );
    const workshopTotal = workshopInvoices
      .filter((inv) => inv.docStatus !== 'BORRADOR')
      .reduce((acc, inv) => acc + inv.total, 0);

    return (
      <ModuleGate module="facturas_taller">
        <div className="pk-stack">
          <PkKpiRow
            items={[
              {
                label: 'Facturas Automotrices',
                value: String(workshopInvoices.length),
                color: 'var(--pk-primary)',
              },
              {
                label: 'Facturación Confirmada Taller',
                value: formatCop(workshopTotal),
                color: 'var(--pk-emerald)',
              },
              {
                label: 'Placas Registradas',
                value: String(vehicles.length),
              },
            ]}
          />

          <PkLiveHeader
            title="Facturación Especializada Automotriz"
            liveLabel="En vivo"
            subtitle="Liquidación de placas, kilometraje, órdenes de trabajo y comisiones técnicas."
            primaryActionLabel="+ Crear Factura Automotriz"
            onPrimaryAction={() => openCreateInvoiceStudio('TALLER')}
          />

          <div className="pk-card">
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Factura</th>
                      <th>Placa / Vehículo</th>
                      <th>Cliente</th>
                      <th>Técnico</th>
                      <th>Ciclo 4 Etapas</th>
                      <th>Total</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workshopInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td>
                          <strong>{inv.id}</strong>
                          <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                            {inv.issueDate || inv.date}
                          </div>
                        </td>
                        <td>
                          <span className="pk-badge pk-badge-blue">
                            {inv.plate || 'TALLER'}
                          </span>
                          <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                            {inv.workshopMeta?.vehicleBrand || ''}
                          </div>
                        </td>
                        <td>{inv.customerName}</td>
                        <td>{inv.mechanicName || '— Sin asignar —'}</td>
                        <td style={{ minWidth: 230 }}>
                          <PkProcessNodes
                            compact
                            steps={buildFourStageNodes(
                              inv.docStatus,
                              inv.dianStage,
                              inv.cufe
                            )}
                          />
                        </td>
                        <td>
                          <strong>{formatCop(inv.total)}</strong>
                        </td>
                        <td>
                          <div className="pk-row-actions">
                            {inv.editable && (
                              <button
                                type="button"
                                className="pk-btn pk-btn-outline pk-btn-sm"
                                onClick={() => openEditInvoiceStudio(inv)}
                              >
                                ✏️ Editar
                              </button>
                            )}
                            <PkPrintButton
                              label="🖨️ Imprimir"
                              payload={buildInvoicePrintPayload(inv)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {workshopInvoices.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          style={{
                            textAlign: 'center',
                            color: 'var(--pk-muted)',
                            padding: 24,
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

          {sharedOverlays}
        </div>
      </ModuleGate>
    );
  }

  // MAIN TAB: FACTURAS COMERCIALES / POS MOSTRADOR
  const activeConfirmed = invoices.filter(
    (iv) =>
      (iv.docStatus || 'CONFIRMADA') !== 'BORRADOR' &&
      iv.docStatus !== 'ANULADA_NC'
  );
  const draftsCount = invoices.filter(
    (iv) => iv.docStatus === 'BORRADOR'
  ).length;
  const confirmedCount = invoices.filter(
    (iv) => (iv.docStatus || 'CONFIRMADA') === 'CONFIRMADA'
  ).length;
  const cxcCount = activeConfirmed.filter((iv) => iv.pendingBalance > 0).length;
  const workshopCount = invoices.filter(
    (iv) =>
      Boolean(iv.plate || iv.vehicleId) ||
      (iv.invoiceType || '').toUpperCase() === 'TALLER'
  ).length;

  const totalInvoicedAmount = activeConfirmed.reduce(
    (acc, iv) =>
      acc + Math.max(0, iv.total - (iv.creditedTotal || 0) + (iv.debitedTotal || 0)),
    0
  );
  const totalCollectedAmount = activeConfirmed.reduce(
    (acc, iv) => acc + iv.amountPaid,
    0
  );
  const totalPendingAmount = activeConfirmed.reduce(
    (acc, iv) => acc + iv.pendingBalance,
    0
  );
  const draftsTotalAmount = invoices
    .filter((iv) => iv.docStatus === 'BORRADOR')
    .reduce((acc, iv) => acc + iv.total, 0);

  const filteredInvoices = invoices.filter((inv) => {
    const docSt = inv.docStatus || 'CONFIRMADA';
    if (invoicePill === 'BORRADOR' && docSt !== 'BORRADOR') return false;
    if (invoicePill === 'CONFIRMADA' && docSt !== 'CONFIRMADA') return false;
    if (invoicePill === 'CXC' && (docSt === 'BORRADOR' || inv.pendingBalance <= 0))
      return false;
    if (
      invoicePill === 'TALLER' &&
      !inv.plate &&
      !inv.vehicleId &&
      (inv.invoiceType || '').toUpperCase() !== 'TALLER'
    ) {
      return false;
    }

    const q = invoiceSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      inv.id.toLowerCase().includes(q) ||
      inv.customerName.toLowerCase().includes(q) ||
      (inv.customerNit || '').toLowerCase().includes(q) ||
      (inv.plate || '').toLowerCase().includes(q)
    );
  });

  const stage1Drafts = filteredInvoices.filter(
    (iv) => iv.docStatus === 'BORRADOR'
  );
  const stage2ConfirmedSinEnviar = filteredInvoices.filter(
    (iv) =>
      (iv.docStatus || 'CONFIRMADA') === 'CONFIRMADA' &&
      resolveDianStage(iv.dianStage, iv.cufe) === 'SIN_ENVIAR'
  );
  const stage3DianTransitOrRejected = filteredInvoices.filter((iv) => {
    if ((iv.docStatus || 'CONFIRMADA') !== 'CONFIRMADA') return false;
    const st = resolveDianStage(iv.dianStage, iv.cufe);
    return st === 'ENVIADA' || st === 'RECHAZADA';
  });
  const stage4AcceptedOrClosed = filteredInvoices.filter((iv) => {
    if (iv.docStatus === 'BORRADOR') return false;
    if (iv.docStatus === 'ANULADA_NC') return true;
    return resolveDianStage(iv.dianStage, iv.cufe) === 'ACEPTADA';
  });

  return (
    <div className="pk-stack">
      <PkKpiRow
        items={[
          {
            label: 'Facturas Confirmadas',
            value: String(confirmedCount),
            color: 'var(--pk-primary)',
          },
          {
            label: 'Facturación Neta Activa',
            value: formatCop(totalInvoicedAmount),
            color: 'var(--pk-navy)',
          },
          {
            label: 'Recaudo en Caja / Digital',
            value: formatCop(totalCollectedAmount),
            color: 'var(--pk-emerald)',
          },
          {
            label: 'Saldo en Cartera CxC',
            value: formatCop(totalPendingAmount),
            color:
              totalPendingAmount > 0 ? 'var(--pk-amber)' : 'var(--pk-muted)',
          },
          {
            label: 'Borradores Abiertos',
            value: String(draftsCount),
            color: draftsCount > 0 ? 'var(--pk-amber)' : 'var(--pk-muted)',
          },
        ]}
      />

      <PkDistributionStrip
        title="Composición Financiera de Cartera, Recaudo y Borradores"
        segments={[
          {
            label: 'Recaudado Pagado',
            value: totalCollectedAmount,
            displayValue: formatCop(totalCollectedAmount),
            color: '#10b981',
          },
          {
            label: 'Cartera CxC Pendiente',
            value: totalPendingAmount,
            displayValue: formatCop(totalPendingAmount),
            color: '#f59e0b',
          },
          {
            label: 'En Borrador (Sin afectar stock)',
            value: draftsTotalAmount,
            displayValue: formatCop(draftsTotalAmount),
            color: '#64748b',
          },
        ]}
      />

      <PkLiveHeader
        title="Facturas Comerciales"
        liveLabel="En vivo"
        subtitle="Ciclo comercial y fiscal de 4 etapas: 1. Borrador editable → 2. Confirmada (inventario y CxC) → 3. Envío DIAN → 4. Validación CUFE."
        pills={[
          { key: 'ALL', label: 'Todas', count: invoices.length },
          { key: 'BORRADOR', label: 'Borradores', count: draftsCount },
          { key: 'CONFIRMADA', label: 'Confirmadas', count: confirmedCount },
          { key: 'CXC', label: 'Con Saldo CxC', count: cxcCount },
          { key: 'TALLER', label: 'Automotriz', count: workshopCount },
        ]}
        activePill={invoicePill}
        onPillChange={setInvoicePill}
        displayMode={invoiceDisplayMode}
        onDisplayModeChange={setInvoiceDisplayMode}
        boardLabel="🎛️ Tablero de Tiquetes"
        tableLabel="📋 Vista Tabla"
        primaryActionLabel="+ Crear Factura"
        onPrimaryAction={() => openCreateInvoiceStudio('MOSTRADOR')}
        extraActions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="pk-input"
              style={{ minWidth: 220, minHeight: 38 }}
              placeholder="🔎 Buscar N°, cliente, NIT o placa..."
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
            />
            <button
              type="button"
              className="pk-btn pk-btn-outline pk-btn-sm"
              onClick={() =>
                downloadCsvUtf8(
                  'ventas_facturacion_4_etapas.csv',
                  [
                    'Consecutivo',
                    'Modalidad',
                    'EtapaComercial',
                    'EtapaDIAN',
                    'Fecha',
                    'Cliente',
                    'NIT',
                    'Total',
                    'Pagado',
                    'SaldoCxC',
                    'CUFE',
                  ],
                  invoices.map((inv) => [
                    inv.id,
                    inv.invoiceType || 'MOSTRADOR',
                    inv.docStatus || 'CONFIRMADA',
                    resolveDianStage(inv.dianStage, inv.cufe),
                    inv.issueDate || inv.date || '',
                    inv.customerName,
                    inv.customerNit,
                    inv.total,
                    inv.amountPaid,
                    inv.pendingBalance,
                    inv.cufe || '',
                  ])
                )
              }
            >
              📥 CSV
            </button>
          </div>
        }
      />

      {invoiceDisplayMode === 'board' ? (
        <PkKanbanBoard
          columns={[
            {
              key: 'BORRADOR',
              title: '🟡 1. Borradores Editables',
              dotColor: 'amber',
              count: stage1Drafts.length,
              emptyText: 'Sin facturas en borrador',
              children: stage1Drafts.map((inv) => (
                <PkTicketCard
                  key={inv.id}
                  code={inv.id}
                  timeAgo={inv.issueDate || inv.date}
                  channelBadge={channelBadgeForInvoice(inv)}
                  title={inv.customerName}
                  subtitle={`NIT: ${inv.customerNit}`}
                  metaLine="Borrador abierto • No descuenta stock ni cartera aún"
                  items={inv.items.slice(0, 3).map((it) => ({
                    qty: it.quantity,
                    name: it.description,
                    amount: formatCop(it.subtotal),
                  }))}
                  highlightNote={inv.notes}
                  totalValue={formatCop(inv.total)}
                  paymentLabel={inv.paymentMethod}
                  processNodes={buildFourStageNodes(
                    inv.docStatus,
                    inv.dianStage,
                    inv.cufe
                  )}
                  statusPill={{ label: 'Borrador Editable', tone: 'amber' }}
                  primaryAction={{
                    label: '✅ Confirmar Factura',
                    tone: 'emerald',
                    disabled: busy,
                    onClick: () => handleConfirmDraftInvoice(inv.id),
                  }}
                  secondaryActions={
                    <>
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        onClick={() => openEditInvoiceStudio(inv)}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        👁️ Ver
                      </button>
                    </>
                  }
                />
              )),
            },
            {
              key: 'CONFIRMADA',
              title: '🔵 2. Confirmadas (Sin Enviar DIAN)',
              dotColor: 'blue',
              count: stage2ConfirmedSinEnviar.length,
              emptyText: 'Sin facturas pendientes de envío DIAN',
              children: stage2ConfirmedSinEnviar.map((inv) => {
                const isEditable =
                  inv.editable ?? inv.docStatus !== 'ANULADA_NC';
                return (
                  <PkTicketCard
                    key={inv.id}
                    code={inv.id}
                    timeAgo={inv.issueDate || inv.date}
                    channelBadge={channelBadgeForInvoice(inv)}
                    title={inv.customerName}
                    subtitle={`NIT: ${inv.customerNit}`}
                    metaLine={
                      inv.pendingBalance > 0
                        ? `Saldo Cartera CxC: ${formatCop(inv.pendingBalance)}`
                        : 'Stock y pago confirmados'
                    }
                    items={inv.items.slice(0, 3).map((it) => ({
                      qty: it.quantity,
                      name: it.description,
                      amount: formatCop(it.subtotal),
                    }))}
                    highlightNote={inv.notes}
                    totalValue={formatCop(inv.total)}
                    paymentLabel={inv.paymentMethod}
                    processNodes={buildFourStageNodes(
                      inv.docStatus,
                      inv.dianStage,
                      inv.cufe
                    )}
                    statusPill={{
                      label: inv.status,
                      tone: inv.pendingBalance > 0 ? 'amber' : 'blue',
                    }}
                    primaryAction={
                      hasDianModule
                        ? {
                            label: '🚀 Paso 1: Enviar a DIAN',
                            tone: 'blue',
                            disabled: busy,
                            onClick: () => handleSendToDian('INVOICE', inv.id),
                          }
                        : undefined
                    }
                    secondaryActions={
                      <>
                        {isEditable && (
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            onClick={() => openEditInvoiceStudio(inv)}
                          >
                            ✏️ Editar
                          </button>
                        )}
                        <PkPrintButton
                          label="🖨️ PDF"
                          payload={buildInvoicePrintPayload(inv)}
                        />
                      </>
                    }
                  />
                );
              }),
            },
            {
              key: 'DIAN_TRANSIT',
              title: '🟣 3. En Validación / Rechazo DIAN',
              dotColor: 'purple',
              count: stage3DianTransitOrRejected.length,
              emptyText: 'Sin facturas en espera o rechazo DIAN',
              children: stage3DianTransitOrRejected.map((inv) => {
                const st = resolveDianStage(inv.dianStage, inv.cufe);
                return (
                  <PkTicketCard
                    key={inv.id}
                    code={inv.id}
                    timeAgo={inv.issueDate || inv.date}
                    channelBadge={channelBadgeForInvoice(inv)}
                    title={inv.customerName}
                    subtitle={`NIT: ${inv.customerNit}`}
                    highlightNote={
                      st === 'RECHAZADA'
                        ? `${inv.rejectionCode || 'DIAN'}: ${inv.rejectionMessage || 'Subsanar datos'}`
                        : `TrackID: ${inv.trackId || 'Transmitida'}`
                    }
                    totalValue={formatCop(inv.total)}
                    processNodes={buildFourStageNodes(
                      inv.docStatus,
                      inv.dianStage,
                      inv.cufe
                    )}
                    statusPill={{
                      label:
                        st === 'RECHAZADA'
                          ? 'Rechazada DIAN (Editable)'
                          : 'Enviada a DIAN (Bloqueada)',
                      tone: st === 'RECHAZADA' ? 'rose' : 'purple',
                    }}
                    primaryAction={
                      st === 'RECHAZADA'
                        ? {
                            label: '✏️ Editar y Subsanar',
                            tone: 'coral',
                            onClick: () => openEditInvoiceStudio(inv),
                          }
                        : {
                            label: '✅ Paso 2: Recibir Aceptación DIAN',
                            tone: 'emerald',
                            disabled: busy,
                            onClick: () =>
                              handleRespondDian('INVOICE', inv.id, 'ACCEPTED'),
                          }
                    }
                    secondaryActions={
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        style={{ width: '100%' }}
                        onClick={() => setActiveModuleKey('facturacion_dian')}
                      >
                        ⚡ Abrir Consola DIAN
                      </button>
                    }
                  />
                );
              }),
            },
            {
              key: 'ACEPTADA',
              title: '🟢 4. Aceptadas CUFE / Cerradas',
              dotColor: 'emerald',
              count: stage4AcceptedOrClosed.length,
              emptyText: 'Aún no hay facturas aceptadas con CUFE',
              children: stage4AcceptedOrClosed.map((inv) => {
                const isAnulada = inv.docStatus === 'ANULADA_NC';
                return (
                  <PkTicketCard
                    key={inv.id}
                    code={inv.id}
                    timeAgo={inv.issueDate || inv.date}
                    channelBadge={channelBadgeForInvoice(inv)}
                    title={inv.customerName}
                    subtitle={`NIT: ${inv.customerNit}`}
                    metaLine={
                      inv.pendingBalance > 0
                        ? `Saldo CxC: ${formatCop(inv.pendingBalance)}`
                        : (inv.creditedTotal || 0) > 0
                        ? `Notas Crédito aplicadas: -${formatCop(inv.creditedTotal || 0)}`
                        : undefined
                    }
                    items={inv.items.slice(0, 2).map((it) => ({
                      qty: it.quantity,
                      name: it.description,
                      amount: formatCop(it.subtotal),
                    }))}
                    totalValue={formatCop(inv.total)}
                    paymentLabel={inv.paymentMethod}
                    processNodes={buildFourStageNodes(
                      inv.docStatus,
                      inv.dianStage,
                      inv.cufe
                    )}
                    statusPill={{
                      label: isAnulada
                        ? 'Anulada por Nota Crédito'
                        : 'Validada CUFE DIAN',
                      tone: isAnulada ? 'rose' : 'emerald',
                    }}
                    secondaryActions={
                      <>
                        <button
                          type="button"
                          className="pk-btn pk-btn-outline pk-btn-sm"
                          onClick={() => setSelectedInvoice(inv)}
                        >
                          👁️ Ver
                        </button>
                        <PkPrintButton
                          label="🖨️ PDF"
                          payload={buildInvoicePrintPayload(inv)}
                        />
                        {!isAnulada && hasNotasModule && (
                          <button
                            type="button"
                            className="pk-btn pk-btn-amber pk-btn-sm"
                            onClick={() => openNoteStudioForInvoice(inv.id)}
                          >
                            ↩️ Nota Crédito / Débito
                          </button>
                        )}
                      </>
                    }
                  />
                );
              }),
            },
          ]}
        />
      ) : (
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">
              📋 Listado General de Facturas Comerciales ({filteredInvoices.length})
            </div>
            <span className="pk-badge pk-badge-blue">
              Próxima Oficial: {nextInvoiceNumber}
            </span>
          </div>
          <div className="pk-card-body">
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Adquiriente / NIT</th>
                    <th>Modalidad</th>
                    <th>Progreso 4 Etapas</th>
                    <th>Total / Saldo CxC</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => {
                    const st = resolveDianStage(inv.dianStage, inv.cufe);
                    const isDraft = inv.docStatus === 'BORRADOR';
                    const isAnulada = inv.docStatus === 'ANULADA_NC';
                    const isEditable =
                      inv.editable ??
                      (!isAnulada && st !== 'ENVIADA' && st !== 'ACEPTADA');
                    const badge = channelBadgeForInvoice(inv);
                    return (
                      <tr key={inv.id}>
                        <td>
                          <strong>{inv.id}</strong>
                          <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                            {inv.issueDate || inv.date}
                          </div>
                        </td>
                        <td>
                          <strong>{inv.customerName}</strong>
                          <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>
                            {inv.customerNit}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`pk-badge pk-badge-${
                              badge.tone === 'coral'
                                ? 'amber'
                                : badge.tone === 'purple'
                                ? 'blue'
                                : badge.tone
                            }`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ minWidth: 250 }}>
                          <PkProcessNodes
                            compact
                            steps={buildFourStageNodes(
                              inv.docStatus,
                              inv.dianStage,
                              inv.cufe
                            )}
                          />
                        </td>
                        <td>
                          <strong>{formatCop(inv.total)}</strong>
                          {inv.pendingBalance > 0 && !isDraft && (
                            <div style={{ fontSize: 11, color: 'var(--pk-amber)', fontWeight: 700 }}>
                              CxC: {formatCop(inv.pendingBalance)}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`pk-badge ${
                              isAnulada
                                ? 'pk-badge-rose'
                                : isDraft
                                ? 'pk-badge-amber'
                                : inv.pendingBalance > 0
                                ? 'pk-badge-amber'
                                : 'pk-badge-emerald'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td>
                          <div className="pk-row-actions">
                            {isDraft && (
                              <button
                                type="button"
                                className="pk-btn pk-btn-emerald pk-btn-sm"
                                disabled={busy}
                                onClick={() => handleConfirmDraftInvoice(inv.id)}
                              >
                                ✅ Confirmar
                              </button>
                            )}
                            {isEditable && (
                              <button
                                type="button"
                                className="pk-btn pk-btn-outline pk-btn-sm"
                                onClick={() => openEditInvoiceStudio(inv)}
                              >
                                ✏️ Editar
                              </button>
                            )}
                            {st === 'ACEPTADA' && !isAnulada && hasNotasModule && (
                              <button
                                type="button"
                                className="pk-btn pk-btn-amber pk-btn-sm"
                                onClick={() => openNoteStudioForInvoice(inv.id)}
                              >
                                ↩️ Nota Crédito / Débito
                              </button>
                            )}
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
                            {inv.pendingBalance > 0 && !isDraft && hasClientes && (
                              <button
                                type="button"
                                className="pk-btn pk-btn-outline pk-btn-sm"
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
                    );
                  })}
                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: 'center',
                          color: 'var(--pk-muted)',
                          padding: 28,
                        }}
                      >
                        No se encontraron facturas para los filtros actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {sharedOverlays}
    </div>
  );
};

export default FacturacionView;
