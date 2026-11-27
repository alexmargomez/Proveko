import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkSimpleSelect,
  PkLiveHeader,
  PkKanbanBoard,
  PkTicketCard,
  PkTypeCards,
  PkFullscreenDialog,
  PkDistributionStrip,
  PkConfirmModal,
  PkPrintButton,
  PkKpiRow,
  useAsyncAction,
  formatCop,
  downloadCsvUtf8,
} from '@platform/ui-sdk';

interface CashIncome {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  responsible: string;
}

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentSource: string;
  responsible: string;
}

interface BankMovement {
  id: string;
  date: string;
  accountName: string;
  movementType: string;
  reference: string;
  concept: string;
  amount: number;
  actor: string;
}

interface CajaSummaryResponse {
  ok: boolean;
  cashIncomes: number;
  digitalIncomes: number;
  cashSales: number;
  digitalSales: number;
  totalExpenses: number;
  cashExpenses: number;
  netCash: number;
  bankInTotal: number;
  bankOutTotal: number;
  nextIncomeCode: string;
  nextExpenseCode: string;
  nextBankCode: string;
  incomes: CashIncome[];
  expenses: Expense[];
  bankMovements: BankMovement[];
}

interface FacturacionSummaryOptional {
  ok?: boolean;
  cashSales?: number;
  digitalSales?: number;
  cashCollected?: number;
  digitalCollected?: number;
}

type TreasuryStudioMode = 'INGRESO' | 'EGRESO' | 'BANCO';

const VALID_MODULES = ['arqueo_gastos', 'bancos_tesoreria'] as const;

const EXPENSE_CATEGORY_OPTIONS = [
  { value: 'Insumos Operativos', label: 'Insumos Operativos' },
  { value: 'Servicios Públicos', label: 'Servicios Públicos' },
  { value: 'Transporte y Mensajería', label: 'Transporte y Mensajería' },
  { value: 'Mantenimiento Locativo', label: 'Mantenimiento Locativo' },
  { value: 'Anticipo Proveedor', label: 'Anticipo Proveedor' },
  { value: 'Otros Gastos', label: 'Otros Gastos' },
];

const PAYMENT_SOURCE_OPTIONS = [
  { value: 'Efectivo Caja', label: 'Efectivo Caja' },
  { value: 'Transferencia Bancaria', label: 'Transferencia Bancaria' },
  { value: 'Nequi / DaviPlata', label: 'Nequi / DaviPlata' },
];

const INCOME_CATEGORY_OPTIONS = [
  { value: 'Base / Apertura de Caja', label: 'Base / Apertura de Caja' },
  { value: 'Recaudo Cartera', label: 'Recaudo Cartera' },
  { value: 'Aporte Operativo', label: 'Aporte Operativo' },
  { value: 'Otros Ingresos', label: 'Otros Ingresos' },
];

const INCOME_METHOD_OPTIONS = [
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Transferencia Bancaria', label: 'Transferencia Bancaria' },
  { value: 'Nequi / DaviPlata', label: 'Nequi / DaviPlata' },
  { value: 'Tarjeta Débito / Crédito', label: 'Tarjeta Débito / Crédito' },
];

const BANK_ACCOUNT_OPTIONS = [
  { value: 'Bancolombia — Cuenta Empresarial', label: 'Bancolombia — Cuenta Empresarial' },
  { value: 'Nequi Negocios', label: 'Nequi Negocios' },
  { value: 'DaviPlata Comercio', label: 'DaviPlata Comercio' },
  { value: 'Davivienda — Ahorros', label: 'Davivienda — Ahorros' },
  { value: 'Banco de Bogotá — Corriente', label: 'Banco de Bogotá — Corriente' },
];

const BANK_MOVEMENT_TYPE_OPTIONS = [
  { value: 'Ingreso', label: 'Ingreso / Consignación' },
  { value: 'Egreso', label: 'Egreso / Giro Proveedor' },
];

export const CajaView: React.FC = () => {
  const {
    activeModuleKey,
    hasService,
    hasModule,
    apiGet,
    apiPost,
    apiDelete,
    incomingPayload,
    clearIncomingPayload,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [cajaDisplayMode, setCajaDisplayMode] = useState<'board' | 'table'>('board');
  const [cajaPill, setCajaPill] = useState<string>('ALL');

  const [bankDisplayMode, setBankDisplayMode] = useState<'board' | 'table'>('board');
  const [bankPill, setBankPill] = useState<string>('ALL');

  const [treasuryStudioOpen, setTreasuryStudioOpen] = useState(false);
  const [treasuryMode, setTreasuryMode] = useState<TreasuryStudioMode>('INGRESO');

  const [cajaSearch, setCajaSearch] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [bankTypeFilter, setBankTypeFilter] = useState('');

  const [cashIncomes, setCashIncomes] = useState(0);
  const [digitalIncomes, setDigitalIncomes] = useState(0);
  const [posCashSales, setPosCashSales] = useState(0);
  const [posDigitalSales, setPosDigitalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [cashExpenses, setCashExpenses] = useState(0);
  const [bankInTotal, setBankInTotal] = useState(0);
  const [bankOutTotal, setBankOutTotal] = useState(0);
  const [nextIncomeCode, setNextIncomeCode] = useState('ING-303');
  const [nextExpenseCode, setNextExpenseCode] = useState('EGR-508');
  const [nextBankCode, setNextBankCode] = useState('BCO-208');
  const [incomes, setIncomes] = useState<CashIncome[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankMovements, setBankMovements] = useState<BankMovement[]>([]);

  const [incCategory, setIncCategory] = useState('Base / Apertura de Caja');
  const [incDescription, setIncDescription] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incPaymentMethod, setIncPaymentMethod] = useState('Efectivo');
  const [incResponsible, setIncResponsible] = useState('Caja Principal');

  const [category, setCategory] = useState('Insumos Operativos');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentSource, setPaymentSource] = useState('Efectivo Caja');
  const [responsible, setResponsible] = useState('Caja Principal');

  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const [accountName, setAccountName] = useState('Bancolombia — Cuenta Empresarial');
  const [movementType, setMovementType] = useState('Ingreso');
  const [reference, setReference] = useState('');
  const [concept, setConcept] = useState('');
  const [bankAmount, setBankAmount] = useState('');

  const currentTab =
    VALID_MODULES.includes(activeModuleKey as (typeof VALID_MODULES)[number]) && hasModule(activeModuleKey)
      ? activeModuleKey
      : VALID_MODULES.find((m) => hasModule(m)) || 'arqueo_gastos';

  const openTreasuryStudio = useCallback(
    (preferred: TreasuryStudioMode) => {
      if (preferred === 'BANCO' && !hasModule('bancos_tesoreria')) {
        setTreasuryMode('EGRESO');
      } else if ((preferred === 'INGRESO' || preferred === 'EGRESO') && !hasModule('arqueo_gastos')) {
        setTreasuryMode('BANCO');
      } else {
        setTreasuryMode(preferred);
      }
      setTreasuryStudioOpen(true);
    },
    [hasModule]
  );

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<CajaSummaryResponse>('/api/v1/caja/summary');
      setCashIncomes(data.cashIncomes || 0);
      setDigitalIncomes(data.digitalIncomes || 0);
      setTotalExpenses(data.totalExpenses || 0);
      setCashExpenses(data.cashExpenses || 0);
      setBankInTotal(data.bankInTotal || 0);
      setBankOutTotal(data.bankOutTotal || 0);
      setNextIncomeCode(data.nextIncomeCode || 'ING-303');
      setNextExpenseCode(data.nextExpenseCode || 'EGR-508');
      setNextBankCode(data.nextBankCode || 'BCO-208');
      setIncomes(data.incomes || []);
      setExpenses(data.expenses || []);
      setBankMovements(data.bankMovements || []);
    } catch {
      // Surface handled by platform context
    }

    if (hasService('ms-facturacion')) {
      try {
        const pos = await apiGet<FacturacionSummaryOptional>('/api/v1/facturacion/summary');
        setPosCashSales(Number(pos.cashSales ?? pos.cashCollected ?? 0) || 0);
        setPosDigitalSales(Number(pos.digitalSales ?? pos.digitalCollected ?? 0) || 0);
      } catch {
        setPosCashSales(0);
        setPosDigitalSales(0);
      }
    } else {
      setPosCashSales(0);
      setPosDigitalSales(0);
    }
  }, [apiGet, hasService]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!incomingPayload) return;
    if (typeof incomingPayload.concept === 'string' && incomingPayload.concept) {
      setConcept(incomingPayload.concept);
      setDescription(incomingPayload.concept);
    }
    if (incomingPayload.amount !== undefined && incomingPayload.amount !== null) {
      const strAmt = String(incomingPayload.amount);
      setBankAmount(strAmt);
      setAmount(strAmt);
      setMovementType('Egreso');
    }
    if (typeof incomingPayload.reference === 'string' && incomingPayload.reference) {
      setReference(incomingPayload.reference);
    }
    if (currentTab === 'bancos_tesoreria') {
      openTreasuryStudio('BANCO');
    } else {
      openTreasuryStudio('EGRESO');
    }
    clearIncomingPayload();
  }, [incomingPayload, currentTab, clearIncomingPayload, openTreasuryStudio]);

  const combinedCashInflow = posCashSales + cashIncomes;
  const combinedDigitalInflow = posDigitalSales + digitalIncomes;
  const netCashDrawer = combinedCashInflow - cashExpenses;
  const reconciledDigitalBalance = combinedDigitalInflow + bankInTotal - bankOutTotal;

  const filteredExpenses = useMemo(() => {
    if (cajaPill === 'INCOME') return [];
    const q = cajaSearch.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter(
      (exp) =>
        exp.id.toLowerCase().includes(q) ||
        exp.category.toLowerCase().includes(q) ||
        exp.description.toLowerCase().includes(q) ||
        exp.paymentSource.toLowerCase().includes(q)
    );
  }, [expenses, cajaPill, cajaSearch]);

  const filteredIncomes = useMemo(() => {
    if (cajaPill === 'EXPENSE') return [];
    const q = cajaSearch.trim().toLowerCase();
    if (!q) return incomes;
    return incomes.filter(
      (inc) =>
        inc.id.toLowerCase().includes(q) ||
        inc.category.toLowerCase().includes(q) ||
        inc.description.toLowerCase().includes(q) ||
        inc.paymentMethod.toLowerCase().includes(q)
    );
  }, [incomes, cajaPill, cajaSearch]);

  const filteredVaultBankMovements = useMemo(() => {
    const q = cajaSearch.trim().toLowerCase();
    return bankMovements.filter((m) => {
      if (cajaPill === 'INCOME' && m.movementType !== 'Ingreso') return false;
      if (cajaPill === 'EXPENSE' && m.movementType !== 'Egreso') return false;
      if (!q) return true;
      return (
        m.id.toLowerCase().includes(q) ||
        m.accountName.toLowerCase().includes(q) ||
        m.concept.toLowerCase().includes(q) ||
        (m.reference || '').toLowerCase().includes(q)
      );
    });
  }, [bankMovements, cajaPill, cajaSearch]);

  const filteredBankMovements = useMemo(() => {
    return bankMovements.filter((m) => {
      if (bankPill === 'INCOME' && m.movementType !== 'Ingreso') return false;
      if (bankPill === 'EXPENSE' && m.movementType !== 'Egreso') return false;
      if (bankTypeFilter && m.movementType !== bankTypeFilter) return false;
      const q = bankSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        m.id.toLowerCase().includes(q) ||
        m.accountName.toLowerCase().includes(q) ||
        m.concept.toLowerCase().includes(q) ||
        (m.reference || '').toLowerCase().includes(q)
      );
    });
  }, [bankMovements, bankPill, bankTypeFilter, bankSearch]);

  const handleSubmitTreasuryStudio = (e: React.FormEvent) => {
    e.preventDefault();

    if (treasuryMode === 'INGRESO') {
      const numericAmount = Number(incAmount || 0);
      if (!incDescription.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        toast('Ingresa una descripción y un monto positivo válido para el ingreso.');
        return;
      }
      void run(async () => {
        await apiPost('/api/v1/caja/incomes', {
          category: incCategory,
          description: incDescription.trim(),
          amount: numericAmount,
          paymentMethod: incPaymentMethod,
          responsible: incResponsible.trim() || 'Caja Principal',
        });
        toast('Recibo de ingreso registrado en bóveda de caja');
        setIncDescription('');
        setIncAmount('');
        setTreasuryStudioOpen(false);
        await reload();
      });
      return;
    }

    if (treasuryMode === 'EGRESO') {
      const numericAmount = Number(amount || 0);
      if (!description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
        toast('Ingresa descripción y un valor positivo válido para el gasto.');
        return;
      }
      void run(async () => {
        await apiPost('/api/v1/caja/expenses', {
          category,
          description: description.trim(),
          amount: numericAmount,
          paymentSource,
          responsible: responsible.trim() || 'Caja Principal',
        });
        toast('Comprobante de egreso registrado en caja');
        setDescription('');
        setAmount('');
        setTreasuryStudioOpen(false);
        await reload();
      });
      return;
    }

    const numericAmount = Number(bankAmount || 0);
    if (!concept.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast('Ingresa el concepto y un valor positivo válido para el movimiento bancario.');
      return;
    }
    void run(async () => {
      await apiPost('/api/v1/caja/bank-movements', {
        accountName,
        movementType,
        reference: reference.trim(),
        concept: concept.trim(),
        amount: numericAmount,
      });
      toast('Movimiento bancario conciliado correctamente');
      setReference('');
      setConcept('');
      setBankAmount('');
      setTreasuryStudioOpen(false);
      await reload();
    });
  };

  const handleConfirmDeleteExpense = () => {
    if (!expenseToDelete) return;
    const target = expenseToDelete;
    void run(async () => {
      await apiDelete(`/api/v1/caja/expenses/${encodeURIComponent(target.id)}`);
      toast(`Comprobante de egreso ${target.id} anulado`);
      setExpenseToDelete(null);
      await reload();
    });
  };

  const handleExportArqueoCsv = () => {
    const rows: (string | number)[][] = [
      ...incomes.map((inc) => [
        'INGRESO',
        inc.id,
        inc.date,
        inc.category,
        inc.description,
        inc.paymentMethod,
        inc.responsible,
        inc.amount,
      ]),
      ...expenses.map((exp) => [
        'EGRESO',
        exp.id,
        exp.date,
        exp.category,
        exp.description,
        exp.paymentSource,
        exp.responsible,
        -exp.amount,
      ]),
    ];
    downloadCsvUtf8(
      `arqueo_caja_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Tipo', 'Consecutivo', 'Fecha', 'Categoría', 'Concepto', 'Medio / Origen', 'Responsable', 'Monto'],
      rows
    );
  };

  const handleExportBancosCsv = () => {
    downloadCsvUtf8(
      `conciliacion_bancos_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Código', 'Fecha', 'Cuenta', 'Tipo', 'Referencia', 'Concepto', 'Monto'],
      bankMovements.map((m) => [
        m.id,
        m.date,
        m.accountName,
        m.movementType,
        m.reference || 'S/R',
        m.concept,
        m.movementType === 'Ingreso' ? m.amount : -m.amount,
      ])
    );
  };

  const arqueoPayload: Record<string, unknown> = {
    document_type: 'RECIBO_CAJA',
    layout_variant: 'carta_membrete',
    document_number: `ARQ-${new Date().toISOString().slice(0, 10)}`,
    issue_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    customer_name: 'Cierre y Arqueo Diario de Caja General',
    payment_method: 'Consolidado Efectivo + Digital',
    extra_fields: {
      'Ventas POS Efectivo': formatCop(posCashSales),
      'Ingresos Manuales Efectivo': formatCop(cashIncomes),
      'Recaudo Digital Consolidado': formatCop(combinedDigitalInflow),
      'Total Gastos Operativos': formatCop(totalExpenses),
      'Efectivo Neto en Gaveta': formatCop(netCashDrawer),
    },
    items: [
      ...(posCashSales > 0
        ? [
            {
              code: 'POS-EFE',
              description: 'Recaudo Ventas POS en Efectivo',
              quantity: 1,
              unit_price: posCashSales,
              subtotal: posCashSales,
            },
          ]
        : []),
      ...(posDigitalSales > 0
        ? [
            {
              code: 'POS-DIG',
              description: 'Recaudo Ventas POS Medios Digitales',
              quantity: 1,
              unit_price: posDigitalSales,
              subtotal: posDigitalSales,
            },
          ]
        : []),
      ...incomes.map((inc) => ({
        code: inc.id,
        description: `INGRESO (${inc.paymentMethod}) — ${inc.category}: ${inc.description}`,
        quantity: 1,
        unit_price: inc.amount,
        subtotal: inc.amount,
      })),
      ...expenses.map((exp) => ({
        code: exp.id,
        description: `EGRESO (${exp.paymentSource}) — ${exp.category}: ${exp.description}`,
        quantity: 1,
        unit_price: -exp.amount,
        subtotal: -exp.amount,
      })),
    ],
    subtotal: combinedCashInflow + combinedDigitalInflow,
    grand_total: netCashDrawer,
    notes: 'Arqueo físico de caja verificado por cajero responsable y administración.',
  };

  const buildIncomeReceipt = (inc: CashIncome): Record<string, unknown> => ({
    document_type: 'RECIBO DE CAJA — INGRESO',
    layout_variant: 'carta_membrete',
    document_number: inc.id,
    issue_date: inc.date,
    customer_name: inc.responsible || 'Caja Principal',
    payment_method: inc.paymentMethod,
    extra_fields: {
      Categoría: inc.category,
      'Medio de Pago': inc.paymentMethod,
      Responsable: inc.responsible,
    },
    items: [
      {
        code: inc.id,
        description: inc.description,
        quantity: 1,
        unit_price: inc.amount,
        subtotal: inc.amount,
      },
    ],
    subtotal: inc.amount,
    grand_total: inc.amount,
    notes: 'Comprobante oficial de apertura o ingreso operativo en bóveda de caja.',
  });

  const buildExpenseReceipt = (exp: Expense): Record<string, unknown> => ({
    document_type: 'COMPROBANTE DE EGRESO',
    layout_variant: 'carta_membrete',
    document_number: exp.id,
    issue_date: exp.date,
    customer_name: exp.responsible || 'Caja Principal',
    payment_method: exp.paymentSource,
    extra_fields: {
      Categoría: exp.category,
      'Fuente de Pago': exp.paymentSource,
      Responsable: exp.responsible,
    },
    items: [
      {
        code: exp.id,
        description: exp.description,
        quantity: 1,
        unit_price: exp.amount,
        subtotal: exp.amount,
      },
    ],
    subtotal: exp.amount,
    grand_total: exp.amount,
    notes: 'Comprobante oficial de salida operativa de caja. Firma de recibido conforme.',
  });

  const buildBankReceipt = (m: BankMovement): Record<string, unknown> => ({
    document_type: 'SOPORTE BANCARIO',
    layout_variant: 'carta_membrete',
    document_number: m.id,
    issue_date: m.date,
    customer_name: m.accountName,
    payment_method: m.movementType,
    extra_fields: {
      Cuenta: m.accountName,
      Referencia: m.reference || 'N/A',
    },
    items: [
      {
        code: m.id,
        description: m.concept,
        quantity: 1,
        unit_price: m.amount,
        subtotal: m.amount,
      },
    ],
    grand_total: m.amount,
  });

  const bankExtractPrintPayload: Record<string, unknown> = {
    document_type: 'EXTRACTO DE TESORERÍA',
    layout_variant: 'carta_membrete',
    document_number: `CONC-${new Date().toISOString().slice(0, 10)}`,
    issue_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    customer_name: 'Conciliación Tesorería Bancos y Billeteras Digitales',
    extra_fields: {
      'Recaudo Digital': formatCop(combinedDigitalInflow),
      'Entradas Conciliadas': formatCop(bankInTotal),
      'Salidas Conciliadas': formatCop(bankOutTotal),
    },
    items: bankMovements.map((m) => {
      const signed = m.movementType === 'Ingreso' ? m.amount : -m.amount;
      return {
        code: m.id,
        description: `${m.accountName} [${m.movementType}] — ${m.concept} (Ref: ${m.reference || 'S/R'})`,
        quantity: 1,
        unit_price: signed,
        subtotal: signed,
      };
    }),
    grand_total: reconciledDigitalBalance,
    notes: 'Extracto interno de movimientos conciliados en cuentas bancarias y billeteras digitales.',
  };

  const treasuryTypeOptions = useMemo(() => {
    const opts = [];
    if (hasModule('arqueo_gastos')) {
      opts.push(
        {
          key: 'INGRESO',
          icon: '💵',
          title: 'Ingreso / Base de Apertura',
          description: 'Registra base inicial del turno, aportes de efectivo o recaudos manuales en gaveta.',
          badge: nextIncomeCode,
        },
        {
          key: 'EGRESO',
          icon: '📤',
          title: 'Egreso / Gasto con Soporte',
          description: 'Emite comprobante numerado de gasto operativo menor o anticipo con responsable.',
          badge: nextExpenseCode,
        }
      );
    }
    if (hasModule('bancos_tesoreria')) {
      opts.push({
        key: 'BANCO',
        icon: '🏦',
        title: 'Movimiento Bancario / Digital',
        description: 'Concilia consignaciones, transferencias empresariales, pagos QR o giros a proveedores.',
        badge: nextBankCode,
      });
    }
    return opts;
  }, [hasModule, nextIncomeCode, nextExpenseCode, nextBankCode]);

  const activeStudioCode =
    treasuryMode === 'INGRESO'
      ? nextIncomeCode
      : treasuryMode === 'EGRESO'
      ? nextExpenseCode
      : nextBankCode;

  const activeStudioAmount =
    treasuryMode === 'INGRESO'
      ? Number(incAmount) || 0
      : treasuryMode === 'EGRESO'
      ? Number(amount) || 0
      : Number(bankAmount) || 0;

  return (
    <div className="pk-stack">
      {currentTab === 'arqueo_gastos' && (
        <ModuleGate module="arqueo_gastos">
          <div className="pk-stack">
            <PkLiveHeader
              title="Bóveda de Tesorería y Turno"
              liveLabel="Turno activo"
              subtitle="Monitoreo en vivo de efectivo en gaveta, aperturas de turno, medios digitales y comprobantes de egreso."
              pills={[
                { key: 'ALL', label: 'Todos', count: incomes.length + expenses.length },
                { key: 'INCOME', label: 'Ingresos', count: incomes.length },
                { key: 'EXPENSE', label: 'Egresos / Gastos', count: expenses.length },
              ]}
              activePill={cajaPill}
              onPillChange={setCajaPill}
              displayMode={cajaDisplayMode}
              onDisplayModeChange={setCajaDisplayMode}
              boardLabel="🎛️ Cabina en Vivo"
              tableLabel="📋 Libro de Caja"
              primaryActionLabel="+ Registrar Movimiento"
              onPrimaryAction={() =>
                openTreasuryStudio(cajaPill === 'EXPENSE' ? 'EGRESO' : 'INGRESO')
              }
              extraActions={
                <>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline"
                    onClick={() => openTreasuryStudio('EGRESO')}
                  >
                    📤 + Gasto ({nextExpenseCode})
                  </button>
                  <button type="button" className="pk-btn pk-btn-outline" onClick={handleExportArqueoCsv}>
                    📥 Exportar CSV
                  </button>
                  <PkPrintButton
                    label="🖨️ Imprimir Arqueo de Caja"
                    payload={arqueoPayload}
                    variant="primary"
                  />
                </>
              }
            />

            <PkKpiRow
              items={[
                {
                  label: 'Efectivo Total (POS + Caja)',
                  value: formatCop(combinedCashInflow),
                  color: 'var(--pk-emerald)',
                },
                {
                  label: 'Recaudo Digital Consolidado',
                  value: formatCop(combinedDigitalInflow),
                  color: 'var(--pk-primary)',
                },
                {
                  label: 'Gastos Operativos',
                  value: formatCop(totalExpenses),
                  color: 'var(--pk-rose)',
                },
                {
                  label: 'Neto en Caja (Gaveta)',
                  value: formatCop(netCashDrawer),
                  color: '#0f172a',
                },
              ]}
            />

            <PkDistributionStrip
              title="Composición de Flujo del Turno: Efectivo en Gaveta vs Medios Digitales vs Egresos"
              segments={[
                {
                  label: 'Efectivo Neto en Gaveta',
                  value: Math.max(0, netCashDrawer),
                  displayValue: formatCop(netCashDrawer),
                  color: '#10b981',
                },
                {
                  label: 'Medios Digitales y Bancos',
                  value: Math.max(0, combinedDigitalInflow + bankInTotal),
                  displayValue: formatCop(combinedDigitalInflow + bankInTotal),
                  color: '#2563eb',
                },
                {
                  label: 'Egresos Operativos',
                  value: Math.max(0, totalExpenses),
                  displayValue: formatCop(totalExpenses),
                  color: '#ef4444',
                },
              ]}
            />

            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div
                className="pk-datatable-toolbar"
                style={{ borderBottom: cajaDisplayMode === 'table' ? undefined : 'none' }}
              >
                <input
                  type="search"
                  className="pk-input pk-datatable-search"
                  value={cajaSearch}
                  onChange={(e) => setCajaSearch(e.target.value)}
                  placeholder="🔎 Filtrar comprobantes de ingreso, egreso o banco por código, categoría o concepto..."
                />
                <span className="pk-badge pk-badge-slate">
                  {filteredIncomes.length + filteredExpenses.length} comprobantes en turno
                </span>
              </div>

              {cajaDisplayMode === 'table' && (
                <div className="pk-card-body">
                  <div className="pk-stack">
                    <div>
                      <div className="pk-card-title" style={{ marginBottom: 12 }}>
                        📤 Comprobantes de Egreso y Gastos ({filteredExpenses.length})
                      </div>
                      <div className="pk-table-wrap">
                        <table className="pk-table">
                          <thead>
                            <tr>
                              <th>Consecutivo</th>
                              <th>Fecha</th>
                              <th>Categoría / Concepto</th>
                              <th>Fuente</th>
                              <th className="num">Valor</th>
                              <th>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredExpenses.length === 0 ? (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 24 }}>
                                  No hay gastos registrados para el filtro seleccionado.
                                </td>
                              </tr>
                            ) : (
                              filteredExpenses.map((exp) => (
                                <tr key={exp.id}>
                                  <td>
                                    <span className="pk-badge pk-badge-slate">{exp.id}</span>
                                  </td>
                                  <td>{exp.date}</td>
                                  <td>
                                    <div style={{ fontWeight: 700 }}>{exp.category}</div>
                                    <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>
                                      {exp.description} · Resp: {exp.responsible}
                                    </div>
                                  </td>
                                  <td>{exp.paymentSource}</td>
                                  <td className="num" style={{ fontWeight: 800, color: 'var(--pk-rose)' }}>
                                    -{formatCop(exp.amount)}
                                  </td>
                                  <td>
                                    <div className="pk-row-actions">
                                      <FeatureGate module="arqueo_gastos" feature="impresion_egreso">
                                        <PkPrintButton label="🖨️ Comprobante" payload={buildExpenseReceipt(exp)} />
                                      </FeatureGate>
                                      <button
                                        type="button"
                                        className="pk-btn pk-btn-danger pk-btn-sm"
                                        disabled={busy}
                                        onClick={() => setExpenseToDelete(exp)}
                                      >
                                        Anular
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

                    <div>
                      <div className="pk-card-title" style={{ marginBottom: 12 }}>
                        💵 Aperturas e Ingresos de Caja ({filteredIncomes.length})
                      </div>
                      <div className="pk-table-wrap">
                        <table className="pk-table">
                          <thead>
                            <tr>
                              <th>Recibo</th>
                              <th>Fecha</th>
                              <th>Concepto</th>
                              <th>Medio</th>
                              <th className="num">Monto</th>
                              <th>Soporte</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredIncomes.length === 0 ? (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 24 }}>
                                  Sin ingresos manuales registrados para este criterio.
                                </td>
                              </tr>
                            ) : (
                              filteredIncomes.map((inc) => (
                                <tr key={inc.id}>
                                  <td>
                                    <span className="pk-badge pk-badge-emerald">{inc.id}</span>
                                  </td>
                                  <td>{inc.date}</td>
                                  <td>
                                    <div style={{ fontWeight: 700 }}>{inc.category}</div>
                                    <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>{inc.description}</div>
                                  </td>
                                  <td>{inc.paymentMethod}</td>
                                  <td className="num" style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>
                                    +{formatCop(inc.amount)}
                                  </td>
                                  <td>
                                    <PkPrintButton label="🖨️ Recibo" payload={buildIncomeReceipt(inc)} />
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {cajaDisplayMode === 'board' && (
              <PkKanbanBoard
                columns={[
                  {
                    key: 'lane_incomes',
                    title: '🟢 Ingresos y Aperturas',
                    dotColor: 'emerald',
                    count:
                      filteredIncomes.length + (cajaPill !== 'EXPENSE' && posCashSales > 0 ? 1 : 0),
                    emptyText: 'Sin recibos de ingreso ni base inicial en este filtro',
                    children: (
                      <>
                        {cajaPill !== 'EXPENSE' && posCashSales > 0 && (
                          <PkTicketCard
                            code="POS-EFE"
                            timeAgo="Sincronizado con Facturación"
                            channelBadge={{ label: 'Ventas Mostrador', tone: 'emerald' }}
                            title="Recaudo Acumulado POS en Efectivo"
                            subtitle="Entradas automáticas desde facturación de contado"
                            totalLabel="RECAUDO EFECTIVO"
                            totalValue={`+${formatCop(posCashSales)}`}
                            statusPill={{ label: 'En Gaveta Activa', tone: 'emerald' }}
                          />
                        )}
                        {filteredIncomes.map((inc) => (
                          <PkTicketCard
                            key={inc.id}
                            code={inc.id}
                            timeAgo={inc.date}
                            channelBadge={{ label: inc.category, tone: 'emerald' }}
                            title={inc.description}
                            subtitle={`👤 ${inc.responsible || 'Caja Principal'}`}
                            paymentLabel={inc.paymentMethod}
                            totalLabel="INGRESO REGISTRADO"
                            totalValue={`+${formatCop(inc.amount)}`}
                            statusPill={{ label: 'Aplicado a Turno', tone: 'emerald' }}
                            secondaryActions={
                              <PkPrintButton label="🖨️ Recibo" payload={buildIncomeReceipt(inc)} />
                            }
                          />
                        ))}
                      </>
                    ),
                  },
                  {
                    key: 'lane_expenses',
                    title: '🔴 Egresos y Gastos Operativos',
                    dotColor: 'rose',
                    count: filteredExpenses.length,
                    emptyText: 'Sin comprobantes de salida de efectivo en el turno',
                    children: filteredExpenses.map((exp) => (
                      <PkTicketCard
                        key={exp.id}
                        code={exp.id}
                        timeAgo={exp.date}
                        channelBadge={{ label: exp.category, tone: 'coral' }}
                        title={exp.description}
                        subtitle={`👤 Autoriza: ${exp.responsible || 'Caja Principal'}`}
                        paymentLabel={exp.paymentSource}
                        totalLabel="SALIDA DE CAJA"
                        totalValue={`-${formatCop(exp.amount)}`}
                        statusPill={{ label: 'Egreso Contabilizado', tone: 'rose' }}
                        secondaryActions={
                          <>
                            <FeatureGate module="arqueo_gastos" feature="impresion_egreso">
                              <PkPrintButton label="🖨️ Comprobante" payload={buildExpenseReceipt(exp)} />
                            </FeatureGate>
                            <button
                              type="button"
                              className="pk-btn pk-btn-danger pk-btn-sm"
                              disabled={busy}
                              onClick={() => setExpenseToDelete(exp)}
                            >
                              Anular
                            </button>
                          </>
                        }
                      />
                    )),
                  },
                  ...(hasModule('bancos_tesoreria')
                    ? [
                        {
                          key: 'lane_banks',
                          title: '🔵 Conciliación Bancaria',
                          dotColor: 'blue' as const,
                          count:
                            filteredVaultBankMovements.length +
                            (cajaPill !== 'EXPENSE' && posDigitalSales > 0 ? 1 : 0),
                          emptyText: 'Sin movimientos bancarios conciliados en este filtro',
                          children: (
                            <>
                              {cajaPill !== 'EXPENSE' && posDigitalSales > 0 && (
                                <PkTicketCard
                                  code="POS-DIG"
                                  timeAgo="Canales Electrónicos"
                                  channelBadge={{ label: 'QR / Datáfono', tone: 'blue' }}
                                  title="Recaudo Ventas POS Medios Digitales"
                                  subtitle="Pagos electrónicos recibidos desde facturación"
                                  totalLabel="TOTAL DIGITAL POS"
                                  totalValue={`+${formatCop(posDigitalSales)}`}
                                  statusPill={{ label: 'Liquidación Digital', tone: 'blue' }}
                                />
                              )}
                              {filteredVaultBankMovements.map((m) => {
                                const isIn = m.movementType === 'Ingreso';
                                return (
                                  <PkTicketCard
                                    key={m.id}
                                    code={m.id}
                                    timeAgo={m.date}
                                    channelBadge={{
                                      label: m.movementType,
                                      tone: isIn ? 'blue' : 'amber',
                                    }}
                                    title={m.concept}
                                    subtitle={m.accountName}
                                    metaLine={m.reference ? `🔗 Ref: ${m.reference}` : undefined}
                                    totalLabel={isIn ? 'CONSIGNACIÓN' : 'GIRO BANCARIO'}
                                    totalValue={`${isIn ? '+' : '-'}${formatCop(m.amount)}`}
                                    statusPill={{ label: 'Conciliado', tone: 'blue' }}
                                    secondaryActions={
                                      <PkPrintButton label="🖨️ Soporte" payload={buildBankReceipt(m)} />
                                    }
                                  />
                                );
                              })}
                            </>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </div>
        </ModuleGate>
      )}

      {currentTab === 'bancos_tesoreria' && (
        <ModuleGate module="bancos_tesoreria">
          <div className="pk-stack">
            <PkLiveHeader
              title="Bóveda de Tesorería y Conciliación Bancaria"
              liveLabel="Turno activo"
              subtitle="Control de cuentas empresariales, billeteras digitales, consignaciones y giros a terceros."
              pills={[
                { key: 'ALL', label: 'Todos', count: bankMovements.length },
                {
                  key: 'INCOME',
                  label: 'Ingresos',
                  count: bankMovements.filter((m) => m.movementType === 'Ingreso').length,
                },
                {
                  key: 'EXPENSE',
                  label: 'Egresos / Gastos',
                  count: bankMovements.filter((m) => m.movementType === 'Egreso').length,
                },
              ]}
              activePill={bankPill}
              onPillChange={setBankPill}
              displayMode={bankDisplayMode}
              onDisplayModeChange={setBankDisplayMode}
              boardLabel="🎛️ Cabina en Vivo"
              tableLabel="📋 Libro de Caja"
              primaryActionLabel="+ Registrar Movimiento"
              onPrimaryAction={() => openTreasuryStudio('BANCO')}
              extraActions={
                <>
                  <button type="button" className="pk-btn pk-btn-outline" onClick={handleExportBancosCsv}>
                    📥 Exportar CSV
                  </button>
                  <PkPrintButton
                    label="🖨️ Imprimir Extracto Conciliación"
                    variant="primary"
                    payload={bankExtractPrintPayload}
                  />
                </>
              }
            />

            <PkKpiRow
              items={[
                {
                  label: 'Recaudo Digital Operativo',
                  value: formatCop(combinedDigitalInflow),
                  color: 'var(--pk-primary)',
                },
                {
                  label: 'Consignaciones / Entradas',
                  value: formatCop(bankInTotal),
                  color: 'var(--pk-emerald)',
                },
                {
                  label: 'Pagos / Salidas Bancos',
                  value: formatCop(bankOutTotal),
                  color: 'var(--pk-rose)',
                },
                {
                  label: 'Saldo Conciliado Digital',
                  value: formatCop(reconciledDigitalBalance),
                  color: '#0f172a',
                },
              ]}
            />

            <PkDistributionStrip
              title="Posición de Liquidez Digital y Bancaria"
              segments={[
                {
                  label: 'Recaudo Digital Operativo',
                  value: Math.max(0, combinedDigitalInflow),
                  displayValue: formatCop(combinedDigitalInflow),
                  color: '#2563eb',
                },
                {
                  label: 'Entradas Conciliadas Bancos',
                  value: Math.max(0, bankInTotal),
                  displayValue: formatCop(bankInTotal),
                  color: '#10b981',
                },
                {
                  label: 'Salidas y Giros Bancarios',
                  value: Math.max(0, bankOutTotal),
                  displayValue: formatCop(bankOutTotal),
                  color: '#ef4444',
                },
              ]}
            />

            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div
                className="pk-datatable-toolbar"
                style={{ borderBottom: bankDisplayMode === 'table' ? undefined : 'none' }}
              >
                <input
                  type="search"
                  className="pk-input pk-datatable-search"
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  placeholder="🔎 Buscar movimiento bancario por código, cuenta, referencia o concepto..."
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 'min(100%, 220px)' }}>
                    <PkSimpleSelect
                      ariaLabel="Filtrar por tipo de movimiento"
                      value={bankTypeFilter}
                      onChange={setBankTypeFilter}
                      allowClear
                      searchable={false}
                      placeholder="Todos los tipos"
                      options={[
                        { value: '', label: 'Todos los tipos' },
                        ...BANK_MOVEMENT_TYPE_OPTIONS,
                      ]}
                    />
                  </div>
                  <span className="pk-badge pk-badge-slate">{filteredBankMovements.length} movimientos</span>
                </div>
              </div>

              {bankDisplayMode === 'table' && (
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Fecha</th>
                          <th>Cuenta / Billetera</th>
                          <th>Tipo</th>
                          <th>Referencia</th>
                          <th>Concepto</th>
                          <th className="num">Valor</th>
                          <th>Comprobante</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBankMovements.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                              Aún no se han registrado movimientos de conciliación bancaria para el filtro seleccionado.
                            </td>
                          </tr>
                        ) : (
                          filteredBankMovements.map((m) => {
                            const isIn = m.movementType === 'Ingreso';
                            return (
                              <tr key={m.id}>
                                <td>
                                  <span className="pk-badge pk-badge-blue">{m.id}</span>
                                </td>
                                <td>{m.date}</td>
                                <td style={{ fontWeight: 700 }}>{m.accountName}</td>
                                <td>
                                  <span className={`pk-badge ${isIn ? 'pk-badge-emerald' : 'pk-badge-amber'}`}>
                                    {m.movementType}
                                  </span>
                                </td>
                                <td>{m.reference || '—'}</td>
                                <td>{m.concept}</td>
                                <td
                                  className="num"
                                  style={{ fontWeight: 800, color: isIn ? 'var(--pk-emerald)' : 'var(--pk-rose)' }}
                                >
                                  {isIn ? '+' : '-'}
                                  {formatCop(m.amount)}
                                </td>
                                <td>
                                  <PkPrintButton label="🖨️ Soporte" payload={buildBankReceipt(m)} />
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {bankDisplayMode === 'board' && (
              <PkKanbanBoard
                columns={[
                  {
                    key: 'bank_in',
                    title: '🟢 Consignaciones y Entradas Digitales',
                    dotColor: 'emerald',
                    count: filteredBankMovements.filter((m) => m.movementType === 'Ingreso').length,
                    emptyText: 'Sin consignaciones bancarias en este criterio',
                    children: filteredBankMovements
                      .filter((m) => m.movementType === 'Ingreso')
                      .map((m) => (
                        <PkTicketCard
                          key={m.id}
                          code={m.id}
                          timeAgo={m.date}
                          channelBadge={{ label: 'Consignación / ACH', tone: 'emerald' }}
                          title={m.concept}
                          subtitle={m.accountName}
                          metaLine={m.reference ? `🔗 Aprobación: ${m.reference}` : undefined}
                          totalLabel="ENTRADA CONCILIADA"
                          totalValue={`+${formatCop(m.amount)}`}
                          statusPill={{ label: 'En Extracto', tone: 'emerald' }}
                          secondaryActions={
                            <PkPrintButton label="🖨️ Soporte" payload={buildBankReceipt(m)} />
                          }
                        />
                      )),
                  },
                  {
                    key: 'bank_out',
                    title: '🔴 Giros y Dispersiones Bancarias',
                    dotColor: 'rose',
                    count: filteredBankMovements.filter((m) => m.movementType === 'Egreso').length,
                    emptyText: 'Sin giros o salidas bancarias registradas',
                    children: filteredBankMovements
                      .filter((m) => m.movementType === 'Egreso')
                      .map((m) => (
                        <PkTicketCard
                          key={m.id}
                          code={m.id}
                          timeAgo={m.date}
                          channelBadge={{ label: 'Giro / Pago', tone: 'coral' }}
                          title={m.concept}
                          subtitle={m.accountName}
                          metaLine={m.reference ? `🔗 Referencia: ${m.reference}` : undefined}
                          totalLabel="SALIDA CONCILIADA"
                          totalValue={`-${formatCop(m.amount)}`}
                          statusPill={{ label: 'Debitado en Banco', tone: 'rose' }}
                          secondaryActions={
                            <PkPrintButton label="🖨️ Soporte" payload={buildBankReceipt(m)} />
                          }
                        />
                      )),
                  },
                ]}
              />
            )}
          </div>
        </ModuleGate>
      )}

      <PkFullscreenDialog
        open={treasuryStudioOpen}
        title="Estudio de Bóveda, Caja y Tesorería"
        subtitle="Selecciona la operación financiera a ejecutar en el turno actual con numeración oficial consecutiva."
        badge={{
          label: activeStudioCode,
          tone: treasuryMode === 'INGRESO' ? 'emerald' : treasuryMode === 'EGRESO' ? 'rose' : 'blue',
        }}
        onClose={() => setTreasuryStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="Naturaleza del Comprobante de Tesorería"
            options={treasuryTypeOptions}
            value={treasuryMode}
            onChange={(key) => setTreasuryMode(key as TreasuryStudioMode)}
          />
        }
        footerLeft={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span className="pk-badge pk-badge-blue">{activeStudioCode}</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
              Importe del Comprobante: {formatCop(activeStudioAmount)}
            </span>
          </div>
        }
        footerActions={
          <>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setTreasuryStudioOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pk-fs-treasury-form"
              className={`pk-btn ${
                treasuryMode === 'INGRESO'
                  ? 'pk-btn-emerald'
                  : treasuryMode === 'EGRESO'
                  ? 'pk-btn-danger'
                  : 'pk-btn-primary'
              }`}
              disabled={busy}
            >
              {busy
                ? 'Procesando...'
                : treasuryMode === 'INGRESO'
                ? '💵 Confirmar Ingreso en Caja'
                : treasuryMode === 'EGRESO'
                ? '📤 Emitir Comprobante de Egreso'
                : '🏦 Conciliar Movimiento Bancario'}
            </button>
          </>
        }
      >
        <form id="pk-fs-treasury-form" onSubmit={handleSubmitTreasuryStudio} className="pk-stack">
          {treasuryMode === 'INGRESO' && (
            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div className="pk-card-head">
                <div className="pk-card-title">💵 Recibo Oficial de Apertura o Ingreso en Gaveta</div>
              </div>
              <div className="pk-card-body">
                <div className="pk-form-grid cols-2">
                  <PkAutoCodeInput label="Recibo de Caja" value={nextIncomeCode} />

                  <PkSimpleSelect
                    label="Categoría del Ingreso"
                    options={INCOME_CATEGORY_OPTIONS}
                    value={incCategory}
                    onChange={setIncCategory}
                    searchable={false}
                  />

                  <div className="pk-field pk-col-span-full">
                    <label>Descripción / Detalle del Ingreso *</label>
                    <input
                      required
                      value={incDescription}
                      onChange={(e) => setIncDescription(e.target.value)}
                      placeholder="Ej: Base inicial de efectivo para apertura turno mañana"
                    />
                  </div>

                  <div className="pk-field">
                    <label>Valor del Ingreso ($) *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      step="any"
                      value={incAmount}
                      onChange={(e) => setIncAmount(e.target.value)}
                      placeholder="Ej: 300000"
                    />
                  </div>

                  <PkSimpleSelect
                    label="Medio de Recaudo"
                    options={INCOME_METHOD_OPTIONS}
                    value={incPaymentMethod}
                    onChange={setIncPaymentMethod}
                    searchable={false}
                  />

                  <div className="pk-field pk-col-span-full">
                    <label>Cajero / Responsable de Custodia</label>
                    <input
                      value={incResponsible}
                      onChange={(e) => setIncResponsible(e.target.value)}
                      placeholder="Caja Principal"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {treasuryMode === 'EGRESO' && (
            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div className="pk-card-head">
                <div className="pk-card-title">📤 Comprobante de Salida Operativa o Gasto con Soporte</div>
              </div>
              <div className="pk-card-body">
                <div className="pk-form-grid cols-2">
                  <PkAutoCodeInput label="Comprobante Egreso" value={nextExpenseCode} />

                  <PkSimpleSelect
                    label="Categoría del Gasto"
                    options={EXPENSE_CATEGORY_OPTIONS}
                    value={category}
                    onChange={setCategory}
                    searchable
                  />

                  <div className="pk-field pk-col-span-full">
                    <label>Descripción / Concepto Soportado *</label>
                    <input
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ej: Compra rollos térmicos 80mm y suministros de atención"
                    />
                  </div>

                  <div className="pk-field">
                    <label>Valor del Egreso ($) *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="Ej: 45000"
                    />
                  </div>

                  <PkSimpleSelect
                    label="Origen de Fondos"
                    options={PAYMENT_SOURCE_OPTIONS}
                    value={paymentSource}
                    onChange={setPaymentSource}
                    searchable={false}
                  />

                  <div className="pk-field pk-col-span-full">
                    <label>Autorizado por / Beneficiario</label>
                    <input
                      value={responsible}
                      onChange={(e) => setResponsible(e.target.value)}
                      placeholder="Caja Principal"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {treasuryMode === 'BANCO' && (
            <div className="pk-card" style={{ overflow: 'visible' }}>
              <div className="pk-card-head">
                <div className="pk-card-title">🏦 Registro y Conciliación en Cuenta Bancaria o Billetera</div>
              </div>
              <div className="pk-card-body">
                <div className="pk-form-grid cols-2">
                  <PkAutoCodeInput label="Consecutivo Banco" value={nextBankCode} />

                  <PkSimpleSelect
                    label="Cuenta Empresarial o Billetera Digital"
                    options={BANK_ACCOUNT_OPTIONS}
                    value={accountName}
                    onChange={setAccountName}
                    searchable
                  />

                  <PkSimpleSelect
                    label="Sentido del Movimiento"
                    options={BANK_MOVEMENT_TYPE_OPTIONS}
                    value={movementType}
                    onChange={setMovementType}
                    searchable={false}
                  />

                  <div className="pk-field">
                    <label>N° Aprobación / Referencia ACH</label>
                    <input
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Ej: CUS-992841"
                    />
                  </div>

                  <div className="pk-field">
                    <label>Concepto Conciliado *</label>
                    <input
                      required
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      placeholder="Ej: Pago QR corporativo / Giro factura proveedor"
                    />
                  </div>

                  <div className="pk-field">
                    <label>Valor Conciliado ($) *</label>
                    <input
                      required
                      type="number"
                      min="1"
                      step="any"
                      value={bankAmount}
                      onChange={(e) => setBankAmount(e.target.value)}
                      placeholder="Ej: 180000"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </PkFullscreenDialog>

      <PkConfirmModal
        open={Boolean(expenseToDelete)}
        title="Confirmar Anulación de Egreso"
        message={
          expenseToDelete
            ? `¿Deseas anular definitivamente el comprobante de gasto ${expenseToDelete.id} (${expenseToDelete.description}) por valor de ${formatCop(expenseToDelete.amount)}?`
            : ''
        }
        confirmLabel="Anular Egreso"
        onConfirm={handleConfirmDeleteExpense}
        onCancel={() => setExpenseToDelete(null)}
        busy={busy}
      />
    </div>
  );
};

export default CajaView;
