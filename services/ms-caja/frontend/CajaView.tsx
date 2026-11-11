import React, { useState, useEffect, useCallback } from 'react';
import {
  usePlatform,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkModal,
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

const VALID_MODULES = ['arqueo_gastos', 'bancos_tesoreria'] as const;

export const CajaView: React.FC = () => {
  const { activeModuleKey, hasService, hasModule, apiGet, apiPost, apiDelete, toast } = usePlatform();
  const { busy, run } = useAsyncAction();

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

  const [showIncomeModal, setShowIncomeModal] = useState(false);
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

  const currentTab =
    VALID_MODULES.includes(activeModuleKey as (typeof VALID_MODULES)[number]) && hasModule(activeModuleKey)
      ? activeModuleKey
      : VALID_MODULES.find((m) => hasModule(m)) || 'arqueo_gastos';

  const combinedCashInflow = posCashSales + cashIncomes;
  const combinedDigitalInflow = posDigitalSales + digitalIncomes;
  const netCashDrawer = combinedCashInflow - cashExpenses;
  const reconciledDigitalBalance = combinedDigitalInflow + bankInTotal - bankOutTotal;

  const handleSaveIncome = (e: React.FormEvent) => {
    e.preventDefault();
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
      toast('Recibo de ingreso registrado en caja');
      setIncDescription('');
      setIncAmount('');
      setShowIncomeModal(false);
      await reload();
    });
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
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
      toast('Comprobante de gasto registrado en caja');
      setDescription('');
      setAmount('');
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

  const handleSaveBankMovement = (e: React.FormEvent) => {
    e.preventDefault();
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
      await reload();
    });
  };

  const handleExportArqueoCsv = () => {
    const rows: (string | number)[][] = [
      ...incomes.map((inc) => ['INGRESO', inc.id, inc.date, inc.category, inc.description, inc.paymentMethod, inc.responsible, inc.amount]),
      ...expenses.map((exp) => ['EGRESO', exp.id, exp.date, exp.category, exp.description, exp.paymentSource, exp.responsible, -exp.amount]),
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

  return (
    <div>
      {currentTab === 'arqueo_gastos' && (
        <ModuleGate module="arqueo_gastos">
          <PkKpiRow
            items={[
              { label: 'Efectivo Total (POS + Caja)', value: formatCop(combinedCashInflow), color: 'var(--pk-emerald)' },
              { label: 'Recaudo Digital Consolidado', value: formatCop(combinedDigitalInflow), color: 'var(--pk-primary)' },
              { label: 'Gastos Operativos', value: formatCop(totalExpenses), color: 'var(--pk-rose)' },
              { label: 'Neto en Caja (Gaveta)', value: formatCop(netCashDrawer), color: '#0f172a' },
            ]}
          />

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">💰 Registrar Salida / Gasto de Caja</div>
              <div className="pk-row-actions">
                <button
                  type="button"
                  className="pk-btn pk-btn-emerald pk-btn-sm"
                  onClick={() => setShowIncomeModal(true)}
                >
                  ➕ Ingreso / Apertura ({nextIncomeCode})
                </button>
                <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportArqueoCsv}>
                  📥 Exportar CSV
                </button>
                <PkPrintButton label="🖨️ Imprimir Arqueo de Caja" payload={arqueoPayload} variant="primary" />
              </div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleSaveExpense} className="pk-form-grid">
                <PkAutoCodeInput label="Comprobante Egreso" value={nextExpenseCode} />
                <div className="pk-field">
                  <label>Categoría del Gasto</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="Insumos Operativos">Insumos Operativos</option>
                    <option value="Servicios Públicos">Servicios Públicos</option>
                    <option value="Transporte y Mensajería">Transporte y Mensajería</option>
                    <option value="Mantenimiento Locativo">Mantenimiento Locativo</option>
                    <option value="Anticipo Proveedor">Anticipo Proveedor</option>
                    <option value="Otros Gastos">Otros Gastos</option>
                  </select>
                </div>
                <div className="pk-field">
                  <label>Descripción / Concepto *</label>
                  <input
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej: Compra rollos térmicos 80mm y cafetería"
                  />
                </div>
                <div className="pk-field">
                  <label>Valor del Gasto ($) *</label>
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
                <div className="pk-field">
                  <label>Origen de Fondos</label>
                  <select value={paymentSource} onChange={(e) => setPaymentSource(e.target.value)}>
                    <option value="Efectivo Caja">Efectivo Caja</option>
                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                    <option value="Nequi / DaviPlata">Nequi / DaviPlata</option>
                  </select>
                </div>
                <div className="pk-field">
                  <label>Responsable / Autorizado por</label>
                  <input
                    value={responsible}
                    onChange={(e) => setResponsible(e.target.value)}
                    placeholder="Caja Principal"
                  />
                </div>
                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                    {busy ? 'Guardando...' : '➕ Registrar Egreso'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-grid-2">
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🧾 Comprobantes de Egreso ({expenses.length})</div>
              </div>
              <div className="pk-card-body">
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
                      {expenses.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                            No hay gastos registrados en el turno actual.
                          </td>
                        </tr>
                      ) : (
                        expenses.map((exp) => (
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
                              {formatCop(exp.amount)}
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
            </div>

            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">💵 Aperturas e Ingresos de Caja ({incomes.length})</div>
              </div>
              <div className="pk-card-body">
                <div className="pk-table-wrap">
                  <table className="pk-table">
                    <thead>
                      <tr>
                        <th>Recibo</th>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th>Medio</th>
                        <th className="num">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomes.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                            Sin ingresos manuales registrados.
                          </td>
                        </tr>
                      ) : (
                        incomes.map((inc) => (
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
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <PkModal
            open={showIncomeModal}
            title="➕ Registrar Apertura o Ingreso Manual en Caja"
            onClose={() => setShowIncomeModal(false)}
          >
            <form onSubmit={handleSaveIncome} className="pk-form-grid">
              <PkAutoCodeInput label="Recibo de Caja" value={nextIncomeCode} />
              <div className="pk-field">
                <label>Categoría</label>
                <select value={incCategory} onChange={(e) => setIncCategory(e.target.value)}>
                  <option value="Base / Apertura de Caja">Base / Apertura de Caja</option>
                  <option value="Recaudo Cartera">Recaudo Cartera</option>
                  <option value="Aporte Operativo">Aporte Operativo</option>
                  <option value="Otros Ingresos">Otros Ingresos</option>
                </select>
              </div>
              <div className="pk-field">
                <label>Descripción / Detalle *</label>
                <input
                  required
                  value={incDescription}
                  onChange={(e) => setIncDescription(e.target.value)}
                  placeholder="Ej: Base inicial de efectivo turno mañana"
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
              <div className="pk-field">
                <label>Medio de Ingreso</label>
                <select value={incPaymentMethod} onChange={(e) => setIncPaymentMethod(e.target.value)}>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Nequi / DaviPlata">Nequi / DaviPlata</option>
                  <option value="Tarjeta Débito / Crédito">Tarjeta Débito / Crédito</option>
                </select>
              </div>
              <div className="pk-field">
                <label>Responsable</label>
                <input
                  value={incResponsible}
                  onChange={(e) => setIncResponsible(e.target.value)}
                  placeholder="Caja Principal"
                />
              </div>
              <div className="pk-field">
                <button type="submit" className="pk-btn pk-btn-emerald" disabled={busy}>
                  {busy ? 'Guardando...' : '💾 Guardar Ingreso'}
                </button>
              </div>
            </form>
          </PkModal>

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
        </ModuleGate>
      )}

      {currentTab === 'bancos_tesoreria' && (
        <ModuleGate module="bancos_tesoreria">
          <PkKpiRow
            items={[
              { label: 'Recaudo Digital Operativo', value: formatCop(combinedDigitalInflow), color: 'var(--pk-primary)' },
              { label: 'Consignaciones / Entradas', value: formatCop(bankInTotal), color: 'var(--pk-emerald)' },
              { label: 'Pagos / Salidas Bancos', value: formatCop(bankOutTotal), color: 'var(--pk-rose)' },
              { label: 'Saldo Conciliado Digital', value: formatCop(reconciledDigitalBalance), color: '#0f172a' },
            ]}
          />

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🏦 Conciliación de Cuentas Bancarias y Billeteras Digitales</div>
              <div className="pk-row-actions">
                <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportBancosCsv}>
                  📥 Exportar CSV
                </button>
                <PkPrintButton
                  label="🖨️ Imprimir Extracto Conciliación"
                  variant="primary"
                  payload={{
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
                  }}
                />
              </div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleSaveBankMovement} className="pk-form-grid">
                <PkAutoCodeInput label="Consecutivo Banco" value={nextBankCode} />
                <div className="pk-field">
                  <label>Cuenta o Billetera Digital</label>
                  <select value={accountName} onChange={(e) => setAccountName(e.target.value)}>
                    <option value="Bancolombia — Cuenta Empresarial">Bancolombia — Cuenta Empresarial</option>
                    <option value="Nequi Negocios">Nequi Negocios</option>
                    <option value="DaviPlata Comercio">DaviPlata Comercio</option>
                    <option value="Davivienda — Ahorros">Davivienda — Ahorros</option>
                    <option value="Banco de Bogotá — Corriente">Banco de Bogotá — Corriente</option>
                  </select>
                </div>
                <div className="pk-field">
                  <label>Tipo Movimiento</label>
                  <select value={movementType} onChange={(e) => setMovementType(e.target.value)}>
                    <option value="Ingreso">Ingreso / Consignación</option>
                    <option value="Egreso">Egreso / Giro Proveedor</option>
                  </select>
                </div>
                <div className="pk-field">
                  <label>N° Aprobación / Referencia</label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ej: CUS-992841"
                  />
                </div>
                <div className="pk-field">
                  <label>Concepto *</label>
                  <input
                    required
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Ej: Pago QR cliente / Transferencia proveedor"
                  />
                </div>
                <div className="pk-field">
                  <label>Valor ($) *</label>
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
                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-emerald" disabled={busy}>
                    {busy ? 'Guardando...' : '💾 Registrar Movimiento'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">📋 Movimientos Bancarios y Billeteras ({bankMovements.length})</div>
            </div>
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
                    {bankMovements.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                          Aún no se han registrado movimientos de conciliación bancaria.
                        </td>
                      </tr>
                    ) : (
                      bankMovements.map((m) => {
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
                            <td className="num" style={{ fontWeight: 800, color: isIn ? 'var(--pk-emerald)' : 'var(--pk-rose)' }}>
                              {isIn ? '+' : '-'}
                              {formatCop(m.amount)}
                            </td>
                            <td>
                              <PkPrintButton
                                label="🖨️ Soporte"
                                payload={{
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
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })
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

export default CajaView;
