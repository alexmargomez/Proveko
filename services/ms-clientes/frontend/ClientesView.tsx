import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkSelect,
  PkSimpleSelect,
  PkLiveHeader,
  PkKanbanBoard,
  PkTicketCard,
  PkTypeCards,
  PkFullscreenDialog,
  PkProgressBar,
  PkDistributionStrip,
  PkModal,
  PkConfirmModal,
  PkPrintButton,
  PkKpiRow,
  useAsyncAction,
  formatCop,
  downloadCsvUtf8,
} from '@platform/ui-sdk';

interface Customer {
  id: string;
  code: string;
  name: string;
  nit: string;
  phone: string;
  email: string;
  address: string;
  contractId: string;
  contractCode: string;
  tariffId: string;
  tariffName: string;
  creditLimit: number;
  currentDebt: number;
}

interface Tariff {
  id: string;
  code: string;
  name: string;
  discountPct: number;
}

interface Contract {
  id: string;
  code: string;
  name: string;
  entityNit: string;
  tariffId: string;
  tariffName: string;
  budgetCeiling: number;
  consumedAmount: number;
  availableBalance: number;
}

interface AbonoRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
}

interface Receivable {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  customerId: string;
  customerName: string;
  customerNit: string;
  invoiceTotal: number;
  pendingBalance: number;
  abonos: AbonoRecord[];
}

interface ClientesAllResponse {
  ok: boolean;
  nextCustomerCode: string;
  nextContractCode: string;
  nextTariffCode: string;
  customers: Customer[];
  contracts: Contract[];
  tariffs: Tariff[];
  pendingInvoices: Receivable[];
}

interface CreatedCustomerResponse {
  ok: boolean;
  customer: Customer;
}

interface CreatedTariffResponse {
  ok: boolean;
  tariff: Tariff;
}

interface CreatedContractResponse {
  ok: boolean;
  contract: Contract;
}

type CustomerProfileType = 'JURIDICA' | 'NATURAL' | 'CORPORATIVA_CUPO';
type ContractStudioType = 'CORPORATIVO' | 'INSTITUCIONAL' | 'TARIFARIO';

const VALID_MODULES = ['directorio_clientes', 'cartera_cxc', 'contratos_convenios'] as const;

const ABONO_METHOD_OPTIONS = [
  { value: 'Transferencia Bancaria', label: 'Transferencia Bancaria / PSE' },
  { value: 'Efectivo en Caja', label: 'Efectivo en Caja' },
  { value: 'Billetera Digital', label: 'Billetera Digital Corporativa' },
  { value: 'Tarjeta Empresarial', label: 'Tarjeta Empresarial' },
];

const TAX_REGIME_OPTIONS = [
  { value: 'Responsable de IVA — Régimen Ordinario', label: 'Responsable de IVA — Régimen Ordinario' },
  { value: 'Régimen Simple de Tributación (RST)', label: 'Régimen Simple de Tributación (RST)' },
  { value: 'Gran Contribuyente Autoretenedor', label: 'Gran Contribuyente Autoretenedor' },
  { value: 'No Responsable de IVA', label: 'No Responsable de IVA' },
];

const CUSTOMER_TYPE_OPTIONS = [
  {
    key: 'JURIDICA',
    icon: '🏢',
    title: 'Persona Jurídica / Empresa NIT',
    description: 'Sociedades comerciales con NIT, facturación electrónica B2B y condiciones tributarias.',
    badge: 'Empresa',
  },
  {
    key: 'NATURAL',
    icon: '👤',
    title: 'Persona Natural',
    description: 'Cliente individual o profesional independiente con registro ágil y tarifa directa.',
    badge: 'Directo',
  },
  {
    key: 'CORPORATIVA_CUPO',
    icon: '🤝',
    title: 'Cuenta Corporativa con Cupo y Convenio',
    description: 'Entidad vinculada a contrato comercial, escala de descuento pactada y línea rotativa CxC.',
    badge: 'Convenio + CxC',
  },
];

const CONTRACT_STUDIO_OPTIONS = [
  {
    key: 'CORPORATIVO',
    icon: '🏢',
    title: 'Convenio Empresarial Privado',
    description: 'Acuerdo marco con empresa aliada, tope presupuestal controlado y tarifa preferencial.',
    badge: 'B2B',
  },
  {
    key: 'INSTITUCIONAL',
    icon: '🏛️',
    title: 'Contrato Institucional / Licitación',
    description: 'Ejecución presupuestal por bolsa contratada con expedición de certificados de saldo.',
    badge: 'Público / Marco',
  },
  {
    key: 'TARIFARIO',
    icon: '🏷️',
    title: 'Escala Tarifaria y Descuento',
    description: 'Configura una lista porcentual de descuento aplicable a terceros y convenios comerciales.',
    badge: 'Tarifa',
  },
];

export const ClientesView: React.FC = () => {
  const {
    activeModuleKey,
    hasService,
    hasModule,
    hasFeature,
    apiGet,
    apiPost,
    apiDelete,
    navigateTo,
    incomingPayload,
    clearIncomingPayload,
    toast,
  } = usePlatform();

  const { busy, run } = useAsyncAction();

  const [customerDisplayMode, setCustomerDisplayMode] = useState<'board' | 'table'>('board');
  const [customerPill, setCustomerPill] = useState<string>('ALL');
  const [customerStudioOpen, setCustomerStudioOpen] = useState(false);
  const [customerProfileType, setCustomerProfileType] = useState<CustomerProfileType>('JURIDICA');
  const [custTaxRegime, setCustTaxRegime] = useState(TAX_REGIME_OPTIONS[0].value);
  const [custCity, setCustCity] = useState('Bogotá D.C.');

  const [cxcDisplayMode, setCxcDisplayMode] = useState<'board' | 'table'>('board');
  const [cxcPill, setCxcPill] = useState<string>('ALL');

  const [contractDisplayMode, setContractDisplayMode] = useState<'board' | 'table'>('board');
  const [contractPill, setContractPill] = useState<string>('ALL');
  const [contractStudioOpen, setContractStudioOpen] = useState(false);
  const [contractStudioType, setContractStudioType] = useState<ContractStudioType>('CORPORATIVO');

  const [data, setData] = useState<ClientesAllResponse>({
    ok: true,
    nextCustomerCode: 'CLI-104',
    nextContractCode: 'CNV-203',
    nextTariffCode: 'TRF-104',
    customers: [],
    contracts: [],
    tariffs: [],
    pendingInvoices: [],
  });

  const [custName, setCustName] = useState('');
  const [custNit, setCustNit] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custContractId, setCustContractId] = useState('');
  const [custTariffId, setCustTariffId] = useState('');
  const [custCreditLimit, setCustCreditLimit] = useState('0');

  const [searchQuery, setSearchQuery] = useState('');
  const [receivableSearch, setReceivableSearch] = useState('');
  const [contractSearch, setContractSearch] = useState('');

  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const [abonoTarget, setAbonoTarget] = useState<Receivable | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoMethod, setAbonoMethod] = useState('Transferencia Bancaria');
  const [abonoNote, setAbonoNote] = useState('');

  const [contractName, setContractName] = useState('');
  const [contractNit, setContractNit] = useState('');
  const [contractTariffId, setContractTariffId] = useState('');
  const [contractCeiling, setContractCeiling] = useState('15000000');

  const [tariffName, setTariffName] = useState('');
  const [tariffDiscount, setTariffDiscount] = useState('5');

  const [showContractModal, setShowContractModal] = useState(false);
  const [modalContractName, setModalContractName] = useState('');
  const [modalContractNit, setModalContractNit] = useState('');
  const [modalContractTariffId, setModalContractTariffId] = useState('');
  const [modalContractCeiling, setModalContractCeiling] = useState('15000000');

  const [showTariffModal, setShowTariffModal] = useState(false);
  const [modalTariffName, setModalTariffName] = useState('');
  const [modalTariffDiscount, setModalTariffDiscount] = useState('5');

  const reload = useCallback(async () => {
    try {
      const res = await apiGet<ClientesAllResponse>('/api/v1/clientes/all');
      const tariffs = Array.isArray(res.tariffs) ? res.tariffs : [];
      const contracts = Array.isArray(res.contracts) ? res.contracts : [];
      const customers = Array.isArray(res.customers) ? res.customers : [];
      const pendingInvoices = Array.isArray(res.pendingInvoices) ? res.pendingInvoices : [];

      setData({
        ok: true,
        nextCustomerCode: res.nextCustomerCode || 'CLI-104',
        nextContractCode: res.nextContractCode || 'CNV-203',
        nextTariffCode: res.nextTariffCode || 'TRF-104',
        customers,
        contracts,
        tariffs,
        pendingInvoices,
      });

      if (tariffs.length > 0) {
        setCustTariffId((prev) => prev || tariffs[0].id);
        setContractTariffId((prev) => prev || tariffs[0].id);
        setModalContractTariffId((prev) => prev || tariffs[0].id);
      }
    } catch {
      return;
    }
  }, [apiGet]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const effectiveModule = useMemo(() => {
    if (VALID_MODULES.includes(activeModuleKey as (typeof VALID_MODULES)[number]) && hasModule(activeModuleKey)) {
      return activeModuleKey;
    }
    return VALID_MODULES.find((m) => hasModule(m)) || 'directorio_clientes';
  }, [activeModuleKey, hasModule]);

  useEffect(() => {
    if (!incomingPayload) return;
    if (typeof incomingPayload.customerName === 'string' && incomingPayload.customerName) {
      setCustName(incomingPayload.customerName);
    }
    if (typeof incomingPayload.customerNit === 'string' && incomingPayload.customerNit) {
      setCustNit(incomingPayload.customerNit);
    }
    if (effectiveModule === 'contratos_convenios') {
      setContractStudioType('CORPORATIVO');
      setContractStudioOpen(true);
    } else if (effectiveModule === 'directorio_clientes') {
      setCustomerStudioOpen(true);
    }
    clearIncomingPayload();
  }, [incomingPayload, effectiveModule, clearIncomingPayload]);

  const handleProfileTypeChange = (nextKey: string) => {
    const key = nextKey as CustomerProfileType;
    setCustomerProfileType(key);
    if (key === 'NATURAL') {
      setCustContractId('');
      setCustCreditLimit('0');
      setCustTaxRegime('No Responsable de IVA');
    } else if (key === 'CORPORATIVA_CUPO') {
      if (!custContractId && data.contracts.length > 0) {
        const firstCnt = data.contracts[0];
        setCustContractId(firstCnt.id);
        if (firstCnt.tariffId) setCustTariffId(firstCnt.tariffId);
      }
      if (Number(custCreditLimit) <= 0) {
        setCustCreditLimit('10000000');
      }
      setCustTaxRegime(TAX_REGIME_OPTIONS[0].value);
    } else {
      setCustTaxRegime(TAX_REGIME_OPTIONS[0].value);
    }
  };

  const handleSelectCustomerContract = (selectedId: string) => {
    setCustContractId(selectedId);
    if (selectedId) {
      const found = data.contracts.find((c) => c.id === selectedId);
      if (found && found.tariffId) {
        setCustTariffId(found.tariffId);
      }
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custNit.trim()) {
      toast('Completa el documento tributario y el nombre o razón social del cliente');
      return;
    }
    await run(async () => {
      const allowCredit =
        customerProfileType !== 'NATURAL' && hasFeature('cartera_cxc', 'cupo_credito_control');
      const limit = allowCredit ? Number(custCreditLimit || 0) : 0;
      const composedAddress = [custAddress.trim(), custCity.trim()].filter(Boolean).join(' · ');

      await apiPost<CreatedCustomerResponse>('/api/v1/clientes/customers', {
        name: custName.trim(),
        nit: custNit.trim(),
        phone: custPhone.trim(),
        email: custEmail.trim(),
        address: composedAddress,
        contractId: customerProfileType === 'NATURAL' ? '' : custContractId,
        tariffId: custTariffId,
        creditLimit: Number.isFinite(limit) && limit > 0 ? limit : 0,
      });
      toast('Cliente registrado en el directorio maestro 360°');
      setCustName('');
      setCustNit('');
      setCustPhone('');
      setCustEmail('');
      setCustAddress('');
      setCustCreditLimit('0');
      setCustomerStudioOpen(false);
      await reload();
    });
  };

  const handleConfirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    const target = customerToDelete;
    await run(async () => {
      await apiDelete<{ ok: boolean }>(`/api/v1/clientes/customers/${encodeURIComponent(target.id)}`);
      toast(`Cliente ${target.code} eliminado del directorio`);
      setCustomerToDelete(null);
      await reload();
    });
  };

  const handleBillCustomer = (c: Customer) => {
    if (!hasService('ms-facturacion')) {
      toast('El servicio de Facturación y Punto de Venta no está activo en la suscripción');
      return;
    }
    navigateTo('ms-facturacion', 'pos_mostrador', {
      customerId: c.id,
      customerName: c.name,
    });
  };

  const openAbonoModal = (inv: Receivable) => {
    setAbonoTarget(inv);
    setAbonoAmount(String(inv.pendingBalance));
    setAbonoMethod('Transferencia Bancaria');
    setAbonoNote('');
  };

  const handleQuickDebtAction = (c: Customer) => {
    const match = data.pendingInvoices.find(
      (inv) => inv.customerId === c.id || (inv.customerNit && inv.customerNit === c.nit)
    );
    if (match) {
      openAbonoModal(match);
      return;
    }
    if (hasModule('cartera_cxc')) {
      setReceivableSearch(c.nit || c.name);
      navigateTo('ms-clientes', 'cartera_cxc', { customerId: c.id, customerName: c.name });
      return;
    }
    toast('No se encontraron facturas abiertas vinculadas para aplicar abono directo');
  };

  const handleSubmitAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!abonoTarget) return;
    const target = abonoTarget;
    await run(async () => {
      await apiPost(`/api/v1/clientes/receivables/${encodeURIComponent(target.invoiceId)}/abono`, {
        amount: Number(abonoAmount || 0),
        method: abonoMethod,
        note: abonoNote.trim(),
      });
      toast(`Abono registrado sobre factura ${target.invoiceNumber}`);
      setAbonoTarget(null);
      await reload();
    });
  };

  const handleSubmitContractStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contractStudioType === 'TARIFARIO') {
      if (!tariffName.trim()) {
        toast('Indica el nombre comercial de la tarifa');
        return;
      }
      await run(async () => {
        await apiPost<CreatedTariffResponse>('/api/v1/clientes/tariffs', {
          name: tariffName.trim(),
          discountPct: Number(tariffDiscount || 0),
        });
        toast('Tarifa comercial registrada');
        setTariffName('');
        setTariffDiscount('5');
        setContractStudioOpen(false);
        await reload();
      });
      return;
    }

    if (!contractName.trim()) {
      toast('Indica el nombre del convenio o contrato comercial');
      return;
    }
    await run(async () => {
      await apiPost<CreatedContractResponse>('/api/v1/clientes/contracts', {
        name: contractName.trim(),
        entityNit: contractNit.trim(),
        tariffId: contractTariffId,
        budgetCeiling: Number(contractCeiling || 0),
      });
      toast('Convenio comercial registrado');
      setContractName('');
      setContractNit('');
      setContractStudioOpen(false);
      await reload();
    });
  };

  const handleCreateContractFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const res = await apiPost<CreatedContractResponse>('/api/v1/clientes/contracts', {
        name: modalContractName.trim(),
        entityNit: modalContractNit.trim(),
        tariffId: modalContractTariffId,
        budgetCeiling: Number(modalContractCeiling || 0),
      });
      toast(`Convenio ${res.contract.code} creado y seleccionado`);
      setModalContractName('');
      setModalContractNit('');
      setShowContractModal(false);
      await reload();
      setCustContractId(res.contract.id);
      if (res.contract.tariffId) {
        setCustTariffId(res.contract.tariffId);
      }
    });
  };

  const handleCreateTariffFromModal = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const res = await apiPost<CreatedTariffResponse>('/api/v1/clientes/tariffs', {
        name: modalTariffName.trim(),
        discountPct: Number(modalTariffDiscount || 0),
      });
      toast(`Tarifa ${res.tariff.code} creada y seleccionada`);
      setModalTariffName('');
      setModalTariffDiscount('5');
      setShowTariffModal(false);
      await reload();
      setCustTariffId(res.tariff.id);
      setContractTariffId(res.tariff.id);
      setModalContractTariffId(res.tariff.id);
    });
  };

  const customerPillCounts = useMemo(() => {
    let clean = 0;
    let debt = 0;
    let withContract = 0;
    for (const c of data.customers) {
      if (c.currentDebt > 0) debt += 1;
      else clean += 1;
      if (c.contractId) withContract += 1;
    }
    return { clean, debt, withContract };
  }, [data.customers]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.customers.filter((c) => {
      if (customerPill === 'CLEAN' && c.currentDebt > 0) return false;
      if (customerPill === 'DEBT' && c.currentDebt <= 0) return false;
      if (customerPill === 'CONTRACT' && !c.contractId) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.nit.toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        c.contractCode.toLowerCase().includes(q)
      );
    });
  }, [data.customers, customerPill, searchQuery]);

  const filteredReceivables = useMemo(() => {
    const q = receivableSearch.trim().toLowerCase();
    return data.pendingInvoices.filter((inv) => {
      const hasAbonos = (inv.abonos || []).length > 0;
      if (cxcPill === 'NO_ABONOS' && hasAbonos) return false;
      if (cxcPill === 'PARTIAL' && !hasAbonos) return false;
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q) ||
        inv.customerNit.toLowerCase().includes(q)
      );
    });
  }, [data.pendingInvoices, cxcPill, receivableSearch]);

  const filteredContracts = useMemo(() => {
    const q = contractSearch.trim().toLowerCase();
    return data.contracts.filter((c) => {
      const ratio = c.budgetCeiling > 0 ? c.consumedAmount / c.budgetCeiling : 0;
      if (contractPill === 'HIGH_EXEC' && ratio < 0.5) return false;
      if (contractPill === 'AVAILABLE' && c.availableBalance <= 0) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.entityNit || '').toLowerCase().includes(q) ||
        (c.tariffName || '').toLowerCase().includes(q)
      );
    });
  }, [data.contracts, contractPill, contractSearch]);

  const totalCustomersDebt = useMemo(
    () => data.customers.reduce((acc, c) => acc + c.currentDebt, 0),
    [data.customers]
  );

  const totalCreditLimit = useMemo(
    () => data.customers.reduce((acc, c) => acc + c.creditLimit, 0),
    [data.customers]
  );

  const availableGlobalCredit = Math.max(0, totalCreditLimit - totalCustomersDebt);

  const totalPendingReceivables = useMemo(
    () => data.pendingInvoices.reduce((acc, inv) => acc + inv.pendingBalance, 0),
    [data.pendingInvoices]
  );

  const totalAbonosActive = useMemo(
    () =>
      data.pendingInvoices.reduce(
        (acc, inv) => acc + Math.max(0, inv.invoiceTotal - inv.pendingBalance),
        0
      ),
    [data.pendingInvoices]
  );

  const totalBudgetCeiling = useMemo(
    () => data.contracts.reduce((acc, c) => acc + c.budgetCeiling, 0),
    [data.contracts]
  );

  const totalConsumedContractBudget = useMemo(
    () => data.contracts.reduce((acc, c) => acc + c.consumedAmount, 0),
    [data.contracts]
  );

  const totalAvailableContractBalance = useMemo(
    () => data.contracts.reduce((acc, c) => acc + c.availableBalance, 0),
    [data.contracts]
  );

  const exportCustomersCsv = () => {
    downloadCsvUtf8(
      'directorio_clientes.csv',
      [
        'Código',
        'Razón Social / Nombre',
        'NIT / Documento',
        'Teléfono',
        'Correo',
        'Dirección',
        'Convenio',
        'Tarifa',
        'Cupo Crédito',
        'Saldo Cartera',
      ],
      filteredCustomers.map((c) => [
        c.code,
        c.name,
        c.nit,
        c.phone,
        c.email,
        c.address,
        c.contractCode || 'Particular',
        c.tariffName || 'Plena',
        c.creditLimit,
        c.currentDebt,
      ])
    );
  };

  const exportReceivablesCsv = () => {
    downloadCsvUtf8(
      'cartera_cuentas_por_cobrar.csv',
      [
        'Factura',
        'Fecha Emisión',
        'Cliente',
        'NIT',
        'Total Factura',
        'Total Abonado',
        'Saldo Pendiente',
        'Cantidad Abonos',
      ],
      data.pendingInvoices.map((inv) => [
        inv.invoiceNumber,
        inv.issueDate,
        inv.customerName,
        inv.customerNit,
        inv.invoiceTotal,
        Math.max(0, inv.invoiceTotal - inv.pendingBalance),
        inv.pendingBalance,
        (inv.abonos || []).length,
      ])
    );
  };

  const exportContractsCsv = () => {
    downloadCsvUtf8(
      'convenios_comerciales.csv',
      ['Código', 'Convenio', 'NIT Entidad', 'Tarifa', 'Tope Presupuestal', 'Consumido', 'Saldo Disponible'],
      data.contracts.map((c) => [
        c.code,
        c.name,
        c.entityNit,
        c.tariffName || 'General',
        c.budgetCeiling,
        c.consumedAmount,
        c.availableBalance,
      ])
    );
  };

  const buildCustomerPrintPayload = (c: Customer): Record<string, unknown> => ({
    document_type: 'FICHA COMERCIAL DE CLIENTE / TERCERO',
    document_number: c.code,
    customer_name: c.name,
    customer_nit: c.nit,
    customer_phone: c.phone,
    customer_address: c.address,
    extra_fields: {
      Código: c.code,
      Convenio: c.contractCode || 'Particular',
      Tarifa: c.tariffName || 'General',
      'Cupo Autorizado': formatCop(c.creditLimit),
      Correo: c.email || 'No registrado',
    },
    items: [
      {
        code: c.code,
        description: `Estado actual de cartera del cliente ${c.name}`,
        quantity: 1,
        unit_price: c.currentDebt,
        tax_pct: 0,
        subtotal: c.currentDebt,
      },
    ],
    subtotal: c.currentDebt,
    grand_total: c.currentDebt,
    pending_balance: c.currentDebt,
    notes: `Cupo disponible estimado: ${formatCop(Math.max(0, c.creditLimit - c.currentDebt))}`,
  });

  const buildReceivablePrintPayload = (inv: Receivable): Record<string, unknown> => {
    const abonado = Math.max(0, inv.invoiceTotal - inv.pendingBalance);
    const historySummary =
      (inv.abonos || [])
        .map((a) => `${a.id} (${a.date}): ${formatCop(a.amount)} [${a.method}]`)
        .join(' | ') || 'Sin abonos previos registrados.';

    return {
      document_type: 'ESTADO DE CUENTA Y RELACIÓN DE ABONOS',
      document_number: inv.invoiceNumber,
      issue_date: inv.issueDate,
      customer_name: inv.customerName,
      customer_nit: inv.customerNit,
      extra_fields: {
        'Total Facturado': formatCop(inv.invoiceTotal),
        'Total Abonado': formatCop(abonado),
        'Abonos Aplicados': String((inv.abonos || []).length),
      },
      items: [
        {
          code: inv.invoiceNumber,
          description: `Factura ${inv.invoiceNumber} emitida el ${inv.issueDate}`,
          quantity: 1,
          unit_price: inv.invoiceTotal,
          tax_pct: 0,
          subtotal: inv.invoiceTotal,
        },
      ],
      subtotal: inv.invoiceTotal,
      discount_total: abonado,
      grand_total: inv.pendingBalance,
      pending_balance: inv.pendingBalance,
      notes: historySummary,
    };
  };

  const buildContractPrintPayload = (cnt: Contract): Record<string, unknown> => ({
    document_type: 'CERTIFICADO DE EJECUCIÓN DE CONVENIO COMERCIAL',
    document_number: cnt.code,
    customer_name: cnt.name,
    customer_nit: cnt.entityNit,
    extra_fields: {
      Código: cnt.code,
      Tarifa: cnt.tariffName || 'General',
      'Tope Presupuestal': formatCop(cnt.budgetCeiling),
      'Saldo Disponible': formatCop(cnt.availableBalance),
    },
    items: [
      {
        code: cnt.code,
        description: `Consumo acumulado convenio ${cnt.name}`,
        quantity: 1,
        unit_price: cnt.consumedAmount,
        tax_pct: 0,
        subtotal: cnt.consumedAmount,
      },
    ],
    subtotal: cnt.consumedAmount,
    grand_total: cnt.consumedAmount,
    pending_balance: 0,
    notes: `Saldo presupuestal disponible para nuevas órdenes: ${formatCop(cnt.availableBalance)}`,
  });

  const globalPortfolioPrintPayload: Record<string, unknown> = useMemo(
    () => ({
      document_type: 'ESTADO CONSOLIDADO DE CUENTAS POR COBRAR (CXC)',
      document_number: `CXC-${new Date().toISOString().slice(0, 10)}`,
      customer_name: 'Consolidado General de Cartera',
      items: data.pendingInvoices.map((inv) => ({
        code: inv.invoiceNumber,
        description: `${inv.customerName} (${inv.customerNit}) — Emisión ${inv.issueDate}`,
        quantity: 1,
        unit_price: inv.pendingBalance,
        tax_pct: 0,
        subtotal: inv.pendingBalance,
      })),
      subtotal: totalPendingReceivables,
      grand_total: totalPendingReceivables,
      pending_balance: totalPendingReceivables,
      notes: 'Relación oficial de obligaciones comerciales pendientes de recaudo.',
    }),
    [data.pendingInvoices, totalPendingReceivables]
  );

  const cxcNoAbonos = useMemo(
    () => filteredReceivables.filter((inv) => (inv.abonos || []).length === 0),
    [filteredReceivables]
  );
  const cxcWithAbonos = useMemo(
    () => filteredReceivables.filter((inv) => (inv.abonos || []).length > 0),
    [filteredReceivables]
  );

  const renderReceivableTicket = (inv: Receivable) => {
    const paid = Math.max(0, inv.invoiceTotal - inv.pendingBalance);
    const paidPct = inv.invoiceTotal > 0 ? (paid / inv.invoiceTotal) * 100 : 0;
    const abonosList = inv.abonos || [];
    return (
      <PkTicketCard
        key={inv.invoiceId}
        code={inv.invoiceNumber}
        timeAgo={`Emitida: ${inv.issueDate}`}
        channelBadge={{
          label: abonosList.length > 0 ? `${abonosList.length} abono(s)` : 'Saldo íntegro',
          tone: abonosList.length > 0 ? 'blue' : 'amber',
        }}
        title={inv.customerName}
        subtitle={`NIT ${inv.customerNit}`}
        items={[
          { name: 'Total Facturado', amount: formatCop(inv.invoiceTotal) },
          { name: 'Total Abonado', amount: formatCop(paid) },
        ]}
        extraBody={
          <PkProgressBar
            label="Avance de Recaudo"
            valueLabel={`${Math.round(paidPct)}% cubierto`}
            pct={paidPct}
            tone={paidPct >= 60 ? 'emerald' : paidPct > 0 ? 'blue' : 'amber'}
          />
        }
        totalLabel="SALDO POR COBRAR"
        totalValue={formatCop(inv.pendingBalance)}
        statusPill={{
          label: abonosList.length > 0 ? 'Recaudo Parcial' : 'Pendiente de Pago',
          tone: abonosList.length > 0 ? 'blue' : 'amber',
        }}
        primaryAction={{
          label: '💳 Registrar Abono CxC',
          tone: 'emerald',
          onClick: () => openAbonoModal(inv),
          disabled: busy,
        }}
        secondaryActions={
          <PkPrintButton label="🖨️ Estado de Cuenta" payload={buildReceivablePrintPayload(inv)} />
        }
      />
    );
  };

  return (
    <div className="pk-stack">
      {effectiveModule === 'directorio_clientes' && (
        <ModuleGate module="directorio_clientes">
          <div className="pk-stack">
            <PkLiveHeader
              title="CRM Comercial y Terceros 360°"
              liveLabel="Sincronizado"
              subtitle="Directorio inteligente de clientes, convenios activos, tarifas preferenciales y salud crediticia."
              pills={[
                { key: 'ALL', label: 'Todos', count: data.customers.length },
                { key: 'CLEAN', label: 'Al Día', count: customerPillCounts.clean },
                { key: 'DEBT', label: 'Con Cartera Activa', count: customerPillCounts.debt },
                { key: 'CONTRACT', label: 'Con Convenio', count: customerPillCounts.withContract },
              ]}
              activePill={customerPill}
              onPillChange={setCustomerPill}
              displayMode={customerDisplayMode}
              onDisplayModeChange={setCustomerDisplayMode}
              boardLabel="🎛️ Tarjetas 360°"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Nuevo Cliente"
              onPrimaryAction={() => setCustomerStudioOpen(true)}
              extraActions={
                <button type="button" className="pk-btn pk-btn-outline" onClick={exportCustomersCsv}>
                  📥 Exportar CSV
                </button>
              }
            />

            <PkKpiRow
              items={[
                { label: 'Clientes en Directorio', value: String(data.customers.length) },
                {
                  label: 'Clientes con Convenio',
                  value: String(customerPillCounts.withContract),
                  color: 'var(--pk-primary)',
                },
                {
                  label: 'Cartera Utilizada',
                  value: formatCop(totalCustomersDebt),
                  color: 'var(--pk-amber)',
                },
                {
                  label: 'Cupo Total Autorizado',
                  value: formatCop(totalCreditLimit),
                  color: 'var(--pk-emerald)',
                },
              ]}
            />

            <PkDistributionStrip
              title="Exposición Crediticia Global: Cupo Total Disponible vs Cartera Utilizada"
              segments={[
                {
                  label: 'Cupo Total Disponible',
                  value: availableGlobalCredit,
                  displayValue: formatCop(availableGlobalCredit),
                  color: '#10b981',
                },
                {
                  label: 'Cartera Utilizada',
                  value: totalCustomersDebt,
                  displayValue: formatCop(totalCustomersDebt),
                  color: '#f59e0b',
                },
              ]}
            />

            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div className="pk-datatable-toolbar" style={{ borderBottom: customerDisplayMode === 'table' ? undefined : 'none' }}>
                <input
                  type="search"
                  className="pk-input pk-datatable-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔎 Buscar cliente por código, razón social, NIT, ciudad o convenio..."
                  aria-label="Filtrar clientes"
                />
                <span className="pk-badge pk-badge-slate">{filteredCustomers.length} terceros visibles</span>
              </div>

              {customerDisplayMode === 'table' && (
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Cliente / NIT</th>
                          <th>Contacto</th>
                          <th>Convenio / Tarifa</th>
                          <FeatureGate module="cartera_cxc" feature="cupo_credito_control">
                            <th className="num">Cupo Crédito</th>
                          </FeatureGate>
                          <th className="num">Saldo Cartera</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <strong>{c.code}</strong>
                            </td>
                            <td>
                              <strong>{c.name}</strong>
                              <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>NIT {c.nit}</div>
                            </td>
                            <td>
                              <div>{c.phone || '—'}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>
                                {c.email || c.address || '—'}
                              </div>
                            </td>
                            <td>
                              {c.contractCode ? (
                                <span className="pk-badge pk-badge-blue">{c.contractCode}</span>
                              ) : (
                                <span className="pk-badge pk-badge-slate">Particular</span>
                              )}
                              <div style={{ fontSize: 11, color: 'var(--pk-muted)', marginTop: 3 }}>
                                {c.tariffName || 'Tarifa estándar'}
                              </div>
                            </td>
                            <FeatureGate module="cartera_cxc" feature="cupo_credito_control">
                              <td className="num">{formatCop(c.creditLimit)}</td>
                            </FeatureGate>
                            <td className="num">
                              <span
                                className={`pk-badge ${c.currentDebt > 0 ? 'pk-badge-amber' : 'pk-badge-emerald'}`}
                              >
                                {formatCop(c.currentDebt)}
                              </span>
                            </td>
                            <td>
                              <div className="pk-row-actions">
                                {c.currentDebt > 0 && (
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-amber pk-btn-sm"
                                    onClick={() => handleQuickDebtAction(c)}
                                  >
                                    💳 Abono CxC
                                  </button>
                                )}
                                {hasService('ms-facturacion') && (
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-primary pk-btn-sm"
                                    onClick={() => handleBillCustomer(c)}
                                  >
                                    🧾 Facturar
                                  </button>
                                )}
                                <PkPrintButton label="🖨️ Ficha" payload={buildCustomerPrintPayload(c)} />
                                <button
                                  type="button"
                                  className="pk-btn pk-btn-danger pk-btn-sm"
                                  disabled={busy}
                                  onClick={() => setCustomerToDelete(c)}
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {filteredCustomers.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              No se encontraron clientes para el criterio consultado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {customerDisplayMode === 'board' && (
              <>
                {filteredCustomers.length === 0 ? (
                  <div className="pk-kanban-empty">
                    No existen terceros comerciales que coincidan con el filtro seleccionado.
                  </div>
                ) : (
                  <div className="pk-cards-showcase">
                    {filteredCustomers.map((c) => {
                      const hasDebt = c.currentDebt > 0;
                      const usagePct =
                        c.creditLimit > 0
                          ? (c.currentDebt / c.creditLimit) * 100
                          : hasDebt
                          ? 100
                          : 0;
                      const barTone: 'emerald' | 'amber' | 'rose' =
                        usagePct >= 85 ? 'rose' : usagePct >= 45 || hasDebt ? 'amber' : 'emerald';

                      return (
                        <PkTicketCard
                          key={c.id}
                          code={c.code}
                          timeAgo={`NIT ${c.nit}`}
                          channelBadge={
                            c.contractCode
                              ? { label: `🤝 ${c.contractCode}`, tone: 'blue' }
                              : { label: 'Particular', tone: 'slate' }
                          }
                          title={c.name}
                          subtitle={`📍 ${c.address || 'Ubicación comercial general'} · 📞 ${c.phone || 'Sin teléfono'}`}
                          metaLine={`✉️ ${c.email || 'Sin correo'} · 🏷️ ${c.tariffName || 'Tarifa estándar'}`}
                          extraBody={
                            <FeatureGate module="cartera_cxc" feature="cupo_credito_control">
                              <PkProgressBar
                                label="Cupo usado vs Cupo autorizado"
                                valueLabel={`${formatCop(c.currentDebt)} / ${formatCop(c.creditLimit)}`}
                                pct={usagePct}
                                tone={barTone}
                              />
                            </FeatureGate>
                          }
                          totalLabel="SALDO EN CARTERA"
                          totalValue={formatCop(c.currentDebt)}
                          statusPill={
                            hasDebt
                              ? { label: 'Con Cartera Activa', tone: 'amber' }
                              : { label: 'Cuenta al Día', tone: 'emerald' }
                          }
                          primaryAction={
                            hasDebt
                              ? {
                                  label: '💳 Registrar Abono CxC',
                                  tone: 'amber',
                                  onClick: () => handleQuickDebtAction(c),
                                  disabled: busy,
                                }
                              : {
                                  label: '🧾 Ir a Facturar',
                                  tone: 'emerald',
                                  onClick: () => handleBillCustomer(c),
                                  disabled: busy,
                                }
                          }
                          secondaryActions={
                            <>
                              <div className="pk-row-actions">
                                {hasDebt && hasService('ms-facturacion') && (
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-outline pk-btn-sm"
                                    onClick={() => handleBillCustomer(c)}
                                  >
                                    🧾 Facturar
                                  </button>
                                )}
                                <PkPrintButton label="🖨️ Ficha" payload={buildCustomerPrintPayload(c)} />
                              </div>
                              <button
                                type="button"
                                className="pk-btn pk-btn-danger pk-btn-sm"
                                disabled={busy}
                                onClick={() => setCustomerToDelete(c)}
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

      {effectiveModule === 'cartera_cxc' && (
        <ModuleGate module="cartera_cxc">
          <div className="pk-stack">
            <PkLiveHeader
              title="Central de Recaudo y Cartera CxC"
              liveLabel="Recaudo en vivo"
              subtitle="Seguimiento de obligaciones por cobrar, aplicación de abonos parciales y estados de cuenta."
              pills={[
                { key: 'ALL', label: 'Todas', count: data.pendingInvoices.length },
                {
                  key: 'NO_ABONOS',
                  label: 'Sin Abonos Previos',
                  count: data.pendingInvoices.filter((i) => (i.abonos || []).length === 0).length,
                },
                {
                  key: 'PARTIAL',
                  label: 'En Recaudo Parcial',
                  count: data.pendingInvoices.filter((i) => (i.abonos || []).length > 0).length,
                },
              ]}
              activePill={cxcPill}
              onPillChange={setCxcPill}
              displayMode={cxcDisplayMode}
              onDisplayModeChange={setCxcDisplayMode}
              boardLabel="🎛️ Tablero de Cobro"
              tableLabel="📋 Vista Tabla"
              extraActions={
                <>
                  <button type="button" className="pk-btn pk-btn-outline" onClick={exportReceivablesCsv}>
                    📥 Exportar Cartera CSV
                  </button>
                  <PkPrintButton
                    label="🖨️ Estado de Cuenta General"
                    payload={globalPortfolioPrintPayload}
                    variant="primary"
                  />
                </>
              }
            />

            <PkKpiRow
              items={[
                {
                  label: 'Total Cartera por Cobrar',
                  value: formatCop(totalPendingReceivables),
                  color: 'var(--pk-amber)',
                },
                {
                  label: 'Facturas con Saldo Pendiente',
                  value: String(data.pendingInvoices.length),
                },
                {
                  label: 'Abonos Aplicados en Cartera Activa',
                  value: formatCop(totalAbonosActive),
                  color: 'var(--pk-emerald)',
                },
                {
                  label: 'Clientes con Cupo Asignado',
                  value: String(data.customers.filter((c) => c.creditLimit > 0).length),
                  color: 'var(--pk-primary)',
                },
              ]}
            />

            <PkDistributionStrip
              title="Salud de Recaudo sobre Facturación a Crédito Activa"
              segments={[
                {
                  label: 'Abonos Recaudados',
                  value: totalAbonosActive,
                  displayValue: formatCop(totalAbonosActive),
                  color: '#10b981',
                },
                {
                  label: 'Saldo Pendiente por Cobrar',
                  value: totalPendingReceivables,
                  displayValue: formatCop(totalPendingReceivables),
                  color: '#f59e0b',
                },
              ]}
            />

            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div className="pk-datatable-toolbar" style={{ borderBottom: cxcDisplayMode === 'table' ? undefined : 'none' }}>
                <input
                  type="search"
                  className="pk-input pk-datatable-search"
                  value={receivableSearch}
                  onChange={(e) => setReceivableSearch(e.target.value)}
                  placeholder="🔎 Buscar obligación por número de factura, cliente o NIT..."
                  aria-label="Filtrar obligaciones de cartera"
                />
                <span className="pk-badge pk-badge-slate">{filteredReceivables.length} facturas</span>
              </div>

              {cxcDisplayMode === 'table' && (
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Factura</th>
                          <th>Emisión</th>
                          <th>Cliente / NIT</th>
                          <th className="num">Total Factura</th>
                          <th className="num">Abonado</th>
                          <th className="num">Saldo Pendiente</th>
                          <th>Abonos</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReceivables.map((inv) => {
                          const paid = Math.max(0, inv.invoiceTotal - inv.pendingBalance);
                          const abonosCount = (inv.abonos || []).length;
                          return (
                            <tr key={inv.invoiceId}>
                              <td>
                                <strong>{inv.invoiceNumber}</strong>
                              </td>
                              <td>{inv.issueDate}</td>
                              <td>
                                <strong>{inv.customerName}</strong>
                                <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>{inv.customerNit}</div>
                              </td>
                              <td className="num">{formatCop(inv.invoiceTotal)}</td>
                              <td className="num" style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>
                                {formatCop(paid)}
                              </td>
                              <td className="num">
                                <span className="pk-badge pk-badge-amber">{formatCop(inv.pendingBalance)}</span>
                              </td>
                              <td>
                                <span className="pk-badge pk-badge-slate">{abonosCount} registro(s)</span>
                              </td>
                              <td>
                                <div className="pk-row-actions">
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-emerald pk-btn-sm"
                                    disabled={busy}
                                    onClick={() => openAbonoModal(inv)}
                                  >
                                    💵 Registrar Abono
                                  </button>
                                  <PkPrintButton
                                    label="🖨️ Estado de Cuenta"
                                    payload={buildReceivablePrintPayload(inv)}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredReceivables.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              No existen facturas con saldo pendiente de cobro en este momento.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {cxcDisplayMode === 'board' && (
              <PkKanbanBoard
                columns={[
                  {
                    key: 'no_abonos',
                    title: 'Pendientes de Primer Abono',
                    dotColor: 'amber',
                    count: cxcNoAbonos.length,
                    emptyText: 'Sin facturas pendientes de primer recaudo',
                    children: cxcNoAbonos.map(renderReceivableTicket),
                  },
                  {
                    key: 'with_abonos',
                    title: 'En Recaudo Parcial Activo',
                    dotColor: 'blue',
                    count: cxcWithAbonos.length,
                    emptyText: 'Sin obligaciones con abonos parciales en curso',
                    children: cxcWithAbonos.map(renderReceivableTicket),
                  },
                ]}
              />
            )}
          </div>
        </ModuleGate>
      )}

      {effectiveModule === 'contratos_convenios' && (
        <ModuleGate module="contratos_convenios">
          <div className="pk-stack">
            <PkLiveHeader
              title="Convenios Comerciales y Escalas Tarifarias"
              liveLabel="Ejecución activa"
              subtitle="Control presupuestal de acuerdos institucionales, saldos disponibles y listas de descuento."
              pills={[
                { key: 'ALL', label: 'Todos los Convenios', count: data.contracts.length },
                {
                  key: 'AVAILABLE',
                  label: 'Con Cupo Disponible',
                  count: data.contracts.filter((c) => c.availableBalance > 0).length,
                },
                {
                  key: 'HIGH_EXEC',
                  label: 'Ejecución ≥ 50%',
                  count: data.contracts.filter(
                    (c) => c.budgetCeiling > 0 && c.consumedAmount / c.budgetCeiling >= 0.5
                  ).length,
                },
              ]}
              activePill={contractPill}
              onPillChange={setContractPill}
              displayMode={contractDisplayMode}
              onDisplayModeChange={setContractDisplayMode}
              boardLabel="🎛️ Tarjetas de Convenio"
              tableLabel="📋 Vista Tabla"
              primaryActionLabel="+ Nuevo Convenio / Tarifa"
              onPrimaryAction={() => {
                setContractStudioType('CORPORATIVO');
                setContractStudioOpen(true);
              }}
              extraActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => {
                      setContractStudioType('TARIFARIO');
                      setContractStudioOpen(true);
                    }}
                  >
                    🏷️ + Nueva Tarifa ({data.tariffs.length})
                  </button>
                  <button type="button" className="pk-btn pk-btn-outline" onClick={exportContractsCsv}>
                    📥 Exportar Convenios CSV
                  </button>
                </>
              }
            />

            <PkKpiRow
              items={[
                { label: 'Convenios Registrados', value: String(data.contracts.length) },
                {
                  label: 'Tarifarios Oficiales',
                  value: String(data.tariffs.length),
                  color: 'var(--pk-primary)',
                },
                {
                  label: 'Presupuesto Total Contratado',
                  value: formatCop(totalBudgetCeiling),
                },
                {
                  label: 'Saldo Convenios Disponible',
                  value: formatCop(totalAvailableContractBalance),
                  color: 'var(--pk-emerald)',
                },
              ]}
            />

            <PkDistributionStrip
              title="Ejecución Consolidada de Bolsas Presupuestales Contratadas"
              segments={[
                {
                  label: 'Saldo Presupuestal Disponible',
                  value: totalAvailableContractBalance,
                  displayValue: formatCop(totalAvailableContractBalance),
                  color: '#10b981',
                },
                {
                  label: 'Monto Consumido / Facturado',
                  value: totalConsumedContractBudget,
                  displayValue: formatCop(totalConsumedContractBudget),
                  color: '#2563eb',
                },
              ]}
            />

            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div className="pk-datatable-toolbar" style={{ borderBottom: contractDisplayMode === 'table' ? undefined : 'none' }}>
                <input
                  type="search"
                  className="pk-input pk-datatable-search"
                  value={contractSearch}
                  onChange={(e) => setContractSearch(e.target.value)}
                  placeholder="🔎 Filtrar convenios por código, entidad, NIT o tarifa..."
                  aria-label="Filtrar convenios"
                />
                <span className="pk-badge pk-badge-slate">{filteredContracts.length} convenios</span>
              </div>

              {contractDisplayMode === 'table' && (
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Convenio / Entidad</th>
                          <th>Tarifa Aplicable</th>
                          <th className="num">Tope Contratado</th>
                          <th className="num">Consumido</th>
                          <th className="num">Saldo Disponible</th>
                          <th>Certificado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContracts.map((cnt) => (
                          <tr key={cnt.id}>
                            <td>
                              <strong>{cnt.code}</strong>
                            </td>
                            <td>
                              <strong>{cnt.name}</strong>
                              {cnt.entityNit && (
                                <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>NIT {cnt.entityNit}</div>
                              )}
                            </td>
                            <td>
                              <span className="pk-badge pk-badge-blue">{cnt.tariffName || 'General'}</span>
                            </td>
                            <td className="num">{formatCop(cnt.budgetCeiling)}</td>
                            <td className="num">{formatCop(cnt.consumedAmount)}</td>
                            <td className="num" style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>
                              {formatCop(cnt.availableBalance)}
                            </td>
                            <td>
                              <PkPrintButton label="🖨️ Certificado" payload={buildContractPrintPayload(cnt)} />
                            </td>
                          </tr>
                        ))}
                        {filteredContracts.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              No hay convenios comerciales registrados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {contractDisplayMode === 'board' && (
              <div className="pk-cards-showcase">
                {filteredContracts.map((cnt) => {
                  const execPct = cnt.budgetCeiling > 0 ? (cnt.consumedAmount / cnt.budgetCeiling) * 100 : 0;
                  return (
                    <PkTicketCard
                      key={cnt.id}
                      code={cnt.code}
                      timeAgo={cnt.entityNit ? `NIT ${cnt.entityNit}` : 'Convenio Marco'}
                      channelBadge={{ label: `🏷️ ${cnt.tariffName || 'Tarifa General'}`, tone: 'blue' }}
                      title={cnt.name}
                      items={[
                        { name: 'Tope Presupuestal', amount: formatCop(cnt.budgetCeiling) },
                        { name: 'Consumo Acumulado', amount: formatCop(cnt.consumedAmount) },
                      ]}
                      extraBody={
                        <PkProgressBar
                          label="Ejecución de Tope Contratado"
                          valueLabel={`${Math.round(execPct)}% ejecutado`}
                          pct={execPct}
                          tone={execPct >= 85 ? 'rose' : execPct >= 55 ? 'amber' : 'emerald'}
                        />
                      }
                      totalLabel="SALDO DISPONIBLE"
                      totalValue={formatCop(cnt.availableBalance)}
                      statusPill={{
                        label: cnt.availableBalance > 0 ? 'Vigente con Cupo' : 'Tope Agotado',
                        tone: cnt.availableBalance > 0 ? 'emerald' : 'rose',
                      }}
                      secondaryActions={
                        <PkPrintButton label="🖨️ Emitir Certificado" payload={buildContractPrintPayload(cnt)} />
                      }
                    />
                  );
                })}
              </div>
            )}

            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🏷️ Escalas Tarifarias y Descuentos Oficiales ({data.tariffs.length})</div>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  onClick={() => {
                    setContractStudioType('TARIFARIO');
                    setContractStudioOpen(true);
                  }}
                >
                  + Registrar Tarifa
                </button>
              </div>
              <div className="pk-card-body">
                {contractDisplayMode === 'board' ? (
                  <div className="pk-cards-showcase">
                    {data.tariffs.map((t) => (
                      <PkTicketCard
                        key={t.id}
                        code={t.code}
                        channelBadge={{ label: `-${t.discountPct}% Dto.`, tone: 'purple' }}
                        title={t.name}
                        subtitle="Aplicable automáticamente a terceros y convenios vinculados"
                        totalLabel="DESCUENTO COMERCIAL"
                        totalValue={`${t.discountPct}%`}
                        statusPill={{ label: 'Tarifa Activa', tone: 'emerald' }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Tarifa</th>
                          <th className="num">Descuento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.tariffs.map((t) => (
                          <tr key={t.id}>
                            <td>
                              <strong>{t.code}</strong>
                            </td>
                            <td>{t.name}</td>
                            <td className="num">
                              <span className="pk-badge pk-badge-blue">{t.discountPct}%</span>
                            </td>
                          </tr>
                        ))}
                        {data.tariffs.length === 0 && (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              No hay tarifas comerciales registradas.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModuleGate>
      )}

      <PkFullscreenDialog
        open={customerStudioOpen}
        title="Estudio Comercial de Alta de Cliente 360°"
        subtitle="Selecciona la naturaleza jurídica y comercial del tercero para habilitar sus secciones tributarias y crediticias."
        badge={{ label: data.nextCustomerCode, tone: 'blue' }}
        onClose={() => setCustomerStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="Perfil Tributario y Comercial del Tercero"
            options={CUSTOMER_TYPE_OPTIONS}
            value={customerProfileType}
            onChange={handleProfileTypeChange}
          />
        }
        footerLeft={
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span className="pk-badge pk-badge-blue">{data.nextCustomerCode}</span>
            <span style={{ fontSize: 13, color: '#475569', fontWeight: 700 }}>
              Modalidad:{' '}
              {customerProfileType === 'JURIDICA'
                ? 'Persona Jurídica NIT'
                : customerProfileType === 'NATURAL'
                ? 'Persona Natural'
                : 'Cuenta Corporativa con Cupo y Convenio'}
            </span>
          </div>
        }
        footerActions={
          <>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setCustomerStudioOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pk-fs-customer-form"
              className="pk-btn pk-btn-primary"
              disabled={busy}
            >
              {busy ? 'Guardando...' : '💾 Guardar Cliente en Directorio'}
            </button>
          </>
        }
      >
        <form id="pk-fs-customer-form" onSubmit={(e) => void handleCreateCustomer(e)} className="pk-stack">
          <div className="pk-card" style={{ overflow: 'visible' }}>
            <div className="pk-card-head">
              <div className="pk-card-title">
                {customerProfileType === 'NATURAL'
                  ? '👤 Identificación y Contacto del Cliente'
                  : '🏢 Identificación Societaria y Sede Comercial'}
              </div>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid">
                <PkAutoCodeInput label="Código Maestro" value={data.nextCustomerCode} />

                <div className="pk-field">
                  <label htmlFor="pk-cust-nit">
                    {customerProfileType === 'NATURAL' ? 'Documento de Identidad (CC / CE) *' : 'NIT con Dígito de Verificación *'}
                  </label>
                  <input
                    id="pk-cust-nit"
                    required
                    value={custNit}
                    onChange={(e) => setCustNit(e.target.value)}
                    placeholder={customerProfileType === 'NATURAL' ? '1.020.745.881' : '900.512.340-8'}
                  />
                </div>

                <div className="pk-field">
                  <label htmlFor="pk-cust-city">Ciudad / Municipio</label>
                  <input
                    id="pk-cust-city"
                    value={custCity}
                    onChange={(e) => setCustCity(e.target.value)}
                    placeholder="Bogotá D.C."
                  />
                </div>

                <div className="pk-field pk-col-span-2">
                  <label htmlFor="pk-cust-name">
                    {customerProfileType === 'NATURAL' ? 'Nombre Completo del Titular *' : 'Razón Social Legal *'}
                  </label>
                  <input
                    id="pk-cust-name"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder={
                      customerProfileType === 'NATURAL'
                        ? 'Ej: Carolina Méndez Vargas'
                        : 'Ej: Comercializadora del Oriente S.A.S.'
                    }
                  />
                </div>

                <div className="pk-field">
                  <label htmlFor="pk-cust-phone">Teléfono de Contacto</label>
                  <input
                    id="pk-cust-phone"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="6017402200"
                  />
                </div>

                <div className="pk-field">
                  <label htmlFor="pk-cust-email">Correo Recepción Factura Electrónica</label>
                  <input
                    id="pk-cust-email"
                    type="email"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="facturacion@empresa.co"
                  />
                </div>

                <div className="pk-field pk-col-span-2">
                  <label htmlFor="pk-cust-address">Dirección Física / Sede Principal</label>
                  <input
                    id="pk-cust-address"
                    value={custAddress}
                    onChange={(e) => setCustAddress(e.target.value)}
                    placeholder="Calle 72 # 10-34 Of. 502"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pk-card" style={{ overflow: 'visible' }}>
            <div className="pk-card-head">
              <div className="pk-card-title">
                {customerProfileType === 'NATURAL'
                  ? '🏷️ Condición Tarifaria de Mostrador'
                  : '💳 Perfil Tributario, Convenio Marco y Línea de Crédito CxC'}
              </div>
            </div>
            <div className="pk-card-body">
              <div className="pk-form-grid cols-2">
                {customerProfileType !== 'NATURAL' && (
                  <PkSimpleSelect
                    label="Responsabilidad Tributaria"
                    options={TAX_REGIME_OPTIONS}
                    value={custTaxRegime}
                    onChange={setCustTaxRegime}
                    searchable={false}
                  />
                )}

                <PkSelect
                  label="Tarifa Comercial Asignada"
                  items={data.tariffs}
                  value={custTariffId}
                  onChange={setCustTariffId}
                  getValue={(t) => t.id}
                  getLabel={(t) => `${t.code} — ${t.name} (-${t.discountPct}%)`}
                  emptyLabel="Tarifa estándar (0%)"
                  onCreateNew={hasModule('contratos_convenios') ? () => setShowTariffModal(true) : undefined}
                  createLabel="+ Nueva Tarifa"
                  searchable
                />

                {customerProfileType !== 'NATURAL' && (
                  <PkSelect
                    label={
                      customerProfileType === 'CORPORATIVA_CUPO'
                        ? 'Convenio Corporativo Vinculado *'
                        : 'Convenio Comercial (Opcional)'
                    }
                    items={data.contracts}
                    value={custContractId}
                    onChange={handleSelectCustomerContract}
                    getValue={(c) => c.id}
                    getLabel={(c) => `${c.code} — ${c.name} (Disp: ${formatCop(c.availableBalance)})`}
                    emptyLabel="Particular (Sin convenio)"
                    onCreateNew={hasModule('contratos_convenios') ? () => setShowContractModal(true) : undefined}
                    createLabel="+ Nuevo Convenio"
                    searchable
                  />
                )}

                {customerProfileType !== 'NATURAL' && (
                  <FeatureGate module="cartera_cxc" feature="cupo_credito_control">
                    <div className="pk-field">
                      <label htmlFor="pk-cust-limit">Cupo de Crédito Autorizado ($)</label>
                      <input
                        id="pk-cust-limit"
                        type="number"
                        min={0}
                        step="10000"
                        value={custCreditLimit}
                        onChange={(e) => setCustCreditLimit(e.target.value)}
                      />
                    </div>
                  </FeatureGate>
                )}

                {customerProfileType !== 'NATURAL' && Number(custCreditLimit) > 0 && (
                  <div className="pk-col-span-full">
                    <PkProgressBar
                      label="Línea Rotativa Inicial Habilitada"
                      valueLabel={`${formatCop(Number(custCreditLimit) || 0)} disponible (100%)`}
                      pct={100}
                      tone="emerald"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      </PkFullscreenDialog>

      <PkFullscreenDialog
        open={contractStudioOpen}
        title="Estudio de Convenios Institucionales y Tarifas"
        subtitle="Formaliza contratos comerciales con control de techo presupuestal o escalas porcentuales de descuento."
        badge={{
          label: contractStudioType === 'TARIFARIO' ? data.nextTariffCode : data.nextContractCode,
          tone: 'emerald',
        }}
        onClose={() => setContractStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="Tipo de Acuerdo Comercial a Configurar"
            options={CONTRACT_STUDIO_OPTIONS}
            value={contractStudioType}
            onChange={(key) => setContractStudioType(key as ContractStudioType)}
          />
        }
        footerLeft={
          <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
            {contractStudioType === 'TARIFARIO'
              ? `Nueva escala tarifaria ${data.nextTariffCode} con aplicación inmediata`
              : `Techo presupuestal proyectado: ${formatCop(Number(contractCeiling) || 0)}`}
          </span>
        }
        footerActions={
          <>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setContractStudioOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pk-fs-contract-form"
              className="pk-btn pk-btn-emerald"
              disabled={busy}
            >
              {busy
                ? 'Guardando...'
                : contractStudioType === 'TARIFARIO'
                ? '💾 Guardar Tarifa Comercial'
                : '💾 Guardar Convenio Marco'}
            </button>
          </>
        }
      >
        <form id="pk-fs-contract-form" onSubmit={(e) => void handleSubmitContractStudio(e)} className="pk-stack">
          {contractStudioType === 'TARIFARIO' ? (
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🏷️ Parámetros de Escala Tarifaria</div>
              </div>
              <div className="pk-card-body">
                <div className="pk-form-grid cols-2">
                  <PkAutoCodeInput label="Código Tarifa" value={data.nextTariffCode} />
                  <div className="pk-field">
                    <label htmlFor="pk-trf-discount">Descuento Comercial (%) *</label>
                    <input
                      id="pk-trf-discount"
                      required
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={tariffDiscount}
                      onChange={(e) => setTariffDiscount(e.target.value)}
                    />
                  </div>
                  <div className="pk-field pk-col-span-full">
                    <label htmlFor="pk-trf-name">Nombre Oficial de la Tarifa *</label>
                    <input
                      id="pk-trf-name"
                      required
                      value={tariffName}
                      onChange={(e) => setTariffName(e.target.value)}
                      placeholder="Ej: Aliado Corporativo Oro"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div className="pk-card-head">
                <div className="pk-card-title">
                  {contractStudioType === 'INSTITUCIONAL'
                    ? '🏛️ Condiciones del Contrato Institucional y Bolsa Presupuestal'
                    : '🏢 Condiciones del Convenio Corporativo Empresarial'}
                </div>
              </div>
              <div className="pk-card-body">
                <div className="pk-form-grid cols-2">
                  <PkAutoCodeInput label="Código Convenio" value={data.nextContractCode} />
                  <div className="pk-field">
                    <label htmlFor="pk-cnt-nit">NIT Entidad Contratante</label>
                    <input
                      id="pk-cnt-nit"
                      value={contractNit}
                      onChange={(e) => setContractNit(e.target.value)}
                      placeholder="890.211.409-3"
                    />
                  </div>
                  <div className="pk-field pk-col-span-full">
                    <label htmlFor="pk-cnt-name">Nombre del Convenio / Objeto Contractual *</label>
                    <input
                      id="pk-cnt-name"
                      required
                      value={contractName}
                      onChange={(e) => setContractName(e.target.value)}
                      placeholder="Ej: Acuerdo Suministro Industrial del Norte"
                    />
                  </div>
                  <PkSelect
                    label="Tarifa Asociada"
                    items={data.tariffs}
                    value={contractTariffId}
                    onChange={setContractTariffId}
                    getValue={(t) => t.id}
                    getLabel={(t) => `${t.code} — ${t.name} (-${t.discountPct}%)`}
                    emptyLabel="Sin tarifa especial"
                    onCreateNew={() => setShowTariffModal(true)}
                    createLabel="+ Nueva Tarifa"
                    searchable
                  />
                  <div className="pk-field">
                    <label htmlFor="pk-cnt-ceiling">Tope Presupuestal Contratado ($) *</label>
                    <input
                      id="pk-cnt-ceiling"
                      required
                      type="number"
                      min={0}
                      step="10000"
                      value={contractCeiling}
                      onChange={(e) => setContractCeiling(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </PkFullscreenDialog>

      <PkModal
        open={showContractModal}
        title="🤝 Crear Nuevo Convenio Comercial"
        onClose={() => setShowContractModal(false)}
      >
        <form onSubmit={(e) => void handleCreateContractFromModal(e)} className="pk-form-grid cols-2">
          <PkAutoCodeInput label="Código Convenio" value={data.nextContractCode} />
          <div className="pk-field">
            <label htmlFor="pk-modal-cnt-nit">NIT Entidad</label>
            <input
              id="pk-modal-cnt-nit"
              value={modalContractNit}
              onChange={(e) => setModalContractNit(e.target.value)}
              placeholder="900.410.220-1"
            />
          </div>
          <div className="pk-field pk-col-span-full">
            <label htmlFor="pk-modal-cnt-name">Nombre del Convenio *</label>
            <input
              id="pk-modal-cnt-name"
              required
              value={modalContractName}
              onChange={(e) => setModalContractName(e.target.value)}
              placeholder="Ej: Convenio Corporativo Empresarial"
            />
          </div>
          <PkSelect
            label="Tarifa Aplicable"
            items={data.tariffs}
            value={modalContractTariffId}
            onChange={setModalContractTariffId}
            getValue={(t) => t.id}
            getLabel={(t) => `${t.code} — ${t.name} (-${t.discountPct}%)`}
            emptyLabel="Sin tarifa especial"
            searchable
          />
          <div className="pk-field">
            <label htmlFor="pk-modal-cnt-ceiling">Tope Presupuestal ($) *</label>
            <input
              id="pk-modal-cnt-ceiling"
              required
              type="number"
              min={0}
              step="1000"
              value={modalContractCeiling}
              onChange={(e) => setModalContractCeiling(e.target.value)}
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setShowContractModal(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              {busy ? 'Guardando...' : 'Guardar Convenio'}
            </button>
          </div>
        </form>
      </PkModal>

      <PkModal
        open={showTariffModal}
        title="🏷️ Crear Nueva Tarifa Comercial"
        onClose={() => setShowTariffModal(false)}
        maxWidth={560}
      >
        <form onSubmit={(e) => void handleCreateTariffFromModal(e)} className="pk-form-grid cols-2">
          <PkAutoCodeInput label="Código Tarifa" value={data.nextTariffCode} />
          <div className="pk-field">
            <label htmlFor="pk-modal-trf-disc">Porcentaje de Descuento (%) *</label>
            <input
              id="pk-modal-trf-disc"
              required
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={modalTariffDiscount}
              onChange={(e) => setModalTariffDiscount(e.target.value)}
            />
          </div>
          <div className="pk-field pk-col-span-full">
            <label htmlFor="pk-modal-trf-name">Nombre de la Tarifa *</label>
            <input
              id="pk-modal-trf-name"
              required
              value={modalTariffName}
              onChange={(e) => setModalTariffName(e.target.value)}
              placeholder="Ej: Descuento Institucional"
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setShowTariffModal(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-emerald" disabled={busy}>
              {busy ? 'Guardando...' : 'Guardar Tarifa'}
            </button>
          </div>
        </form>
      </PkModal>

      <PkModal
        open={Boolean(abonoTarget)}
        title={`💵 Registrar Abono — Factura ${abonoTarget?.invoiceNumber || ''}`}
        onClose={() => setAbonoTarget(null)}
      >
        {abonoTarget && (
          <form onSubmit={(e) => void handleSubmitAbono(e)} className="pk-form-grid cols-2">
            <div className="pk-field pk-col-span-full">
              <label>Resumen de la Obligación</label>
              <input
                readOnly
                value={`${abonoTarget.customerName} — Saldo Pendiente: ${formatCop(abonoTarget.pendingBalance)}`}
                style={{ background: '#f8fafc', fontWeight: 700 }}
              />
            </div>

            {(abonoTarget.abonos || []).length > 0 && (
              <div className="pk-col-span-full" style={{ fontSize: 12, color: 'var(--pk-muted)' }}>
                <strong>Abonos previos:</strong>{' '}
                {abonoTarget.abonos.map((a) => `${a.id}: ${formatCop(a.amount)} (${a.date})`).join(' · ')}
              </div>
            )}

            <div className="pk-field">
              <label htmlFor="pk-abono-amount">Valor del Abono ($) *</label>
              <input
                id="pk-abono-amount"
                required
                type="number"
                min={0.01}
                max={abonoTarget.pendingBalance}
                step="any"
                value={abonoAmount}
                onChange={(e) => setAbonoAmount(e.target.value)}
              />
            </div>

            <PkSimpleSelect
              label="Medio de Pago"
              options={ABONO_METHOD_OPTIONS}
              value={abonoMethod}
              onChange={setAbonoMethod}
              searchable={false}
            />

            <div className="pk-field pk-col-span-full">
              <label htmlFor="pk-abono-note">Referencia / Observación</label>
              <input
                id="pk-abono-note"
                value={abonoNote}
                onChange={(e) => setAbonoNote(e.target.value)}
                placeholder="Ej: Comprobante transferencia ACH #482910"
              />
            </div>

            <div className="pk-form-actions">
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                onClick={() => setAbonoTarget(null)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button type="submit" className="pk-btn pk-btn-emerald" disabled={busy}>
                {busy ? 'Registrando...' : '💾 Confirmar Abono'}
              </button>
            </div>
          </form>
        )}
      </PkModal>

      <PkConfirmModal
        open={Boolean(customerToDelete)}
        title="Eliminar Cliente del Directorio"
        message={
          customerToDelete
            ? `¿Confirmas eliminar al tercero ${customerToDelete.name} (${customerToDelete.code})? Solo se permite eliminar clientes sin obligaciones activas en cartera.`
            : ''
        }
        confirmLabel="Eliminar Cliente"
        onConfirm={() => void handleConfirmDeleteCustomer()}
        onCancel={() => setCustomerToDelete(null)}
        busy={busy}
      />
    </div>
  );
};

export default ClientesView;
