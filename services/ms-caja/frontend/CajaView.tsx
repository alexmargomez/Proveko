import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkPrintButton,
  PkKpiRow,
  Expense,
  PrintDocumentPayload,
  formatCop,
} from '@proveko/ui-sdk';

interface BankMovementRecord {
  id: string;
  createdAt: string;
  moduleKey: string;
  fields: Record<string, string>;
}

interface CajaSummaryResponse {
  ok: boolean;
  cashSales: number;
  digitalSales: number;
  totalExpenses: number;
  netCash: number;
  nextExpenseCode: string;
  nextBankCode: string;
  expenses: Expense[];
  bankMovements: BankMovementRecord[];
}

export const CajaView: React.FC = () => {
  const { activeModuleKey, hasModule, apiGet, apiPost, apiDelete, toast, dialogVersion } = useProveko();

  const [cashSales, setCashSales] = useState(0);
  const [digitalSales, setDigitalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [netCash, setNetCash] = useState(0);
  const [nextExpenseCode, setNextExpenseCode] = useState('EGR-506');
  const [nextBankCode, setNextBankCode] = useState('BCO-206');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankMovements, setBankMovements] = useState<BankMovementRecord[]>([]);

  const [category, setCategory] = useState('Insumos Operativos');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentSource, setPaymentSource] = useState('Efectivo Caja');
  const [responsible, setResponsible] = useState('Caja Principal');

  const [accountName, setAccountName] = useState('Bancolombia — Cuenta Empresarial');
  const [movementType, setMovementType] = useState('Ingreso');
  const [reference, setReference] = useState('');
  const [concept, setConcept] = useState('');
  const [bankAmount, setBankAmount] = useState('');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<CajaSummaryResponse>('/api/v1/caja/summary');
      setCashSales(data.cashSales || 0);
      setDigitalSales(data.digitalSales || 0);
      setTotalExpenses(data.totalExpenses || 0);
      setNetCash(data.netCash || 0);
      setNextExpenseCode(data.nextExpenseCode || 'EGR-506');
      setNextBankCode(data.nextBankCode || 'BCO-206');
      setExpenses(data.expenses || []);
      setBankMovements(data.bankMovements || []);
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void reload();
  }, [reload, dialogVersion]);

  const validModules = ['arqueo_gastos', 'bancos_tesoreria'];
  const currentTab =
    validModules.includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : validModules.find((m) => hasModule(m)) || 'arqueo_gastos';

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount || 0);
    if (!description.trim() || numericAmount <= 0) {
      toast('Ingresa descripción y un valor válido para el gasto.');
      return;
    }
    await apiPost('/api/v1/caja/expenses', {
      category,
      description,
      amount: numericAmount,
      paymentSource,
      responsible,
    });
    toast('Comprobante de gasto registrado en caja');
    setDescription('');
    setAmount('');
    await reload();
  };

  const handleDeleteExpense = async (id: string) => {
    await apiDelete(`/api/v1/caja/expenses/${id}`);
    toast(`Egreso ${id} eliminado`);
    await reload();
  };

  const handleSaveBankMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(bankAmount || 0);
    if (!concept.trim() || numericAmount <= 0) {
      toast('Ingresa el concepto y el valor del movimiento.');
      return;
    }
    await apiPost('/api/v1/caja/bank-movements', {
      accountName,
      movementType,
      reference,
      concept,
      amount: numericAmount,
    });
    toast('Movimiento bancario / billetera conciliado');
    setReference('');
    setConcept('');
    setBankAmount('');
    await reload();
  };

  const arqueoPayload: PrintDocumentPayload = {
    document_type: 'RECIBO_CAJA',
    layout_variant: 'carta_membrete',
    document_number: `ARQ-${new Date().toISOString().slice(0, 10)}`,
    issue_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    customer_name: 'Cierre y Arqueo Diario de Caja General',
    payment_method: 'Consolidado Efectivo + Digital',
    extra_fields: {
      'Ventas en Efectivo': formatCop(cashSales),
      'Ingresos Digitales': formatCop(digitalSales),
      'Total Gastos Operativos': formatCop(totalExpenses),
      'Efectivo Neto en Gaveta': formatCop(netCash),
    },
    items: [
      {
        code: 'ING-EFE',
        description: 'Recaudo Ventas y Abonos en Efectivo',
        quantity: 1,
        unit_price: cashSales,
        subtotal: cashSales,
      },
      {
        code: 'ING-DIG',
        description: 'Recaudo Transferencias, Tarjetas, Nequi y DaviPlata',
        quantity: 1,
        unit_price: digitalSales,
        subtotal: digitalSales,
      },
      ...expenses.map((exp) => ({
        code: exp.id,
        description: `EGRESO (${exp.paymentSource}) — ${exp.category}: ${exp.description}`,
        quantity: 1,
        unit_price: -exp.amount,
        subtotal: -exp.amount,
      })),
    ],
    subtotal: cashSales + digitalSales,
    grand_total: netCash,
    notes: 'Arqueo físico verificado por cajero responsable y administración.',
  };

  const buildExpenseReceipt = (exp: Expense): PrintDocumentPayload => ({
    document_type: 'RECIBO_CAJA',
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
    notes: 'Comprobante interno de egreso de caja. Firma de recibido conforme.',
  });

  const bankInTotal = bankMovements
    .filter((m) => m.fields?.movementType === 'Ingreso')
    .reduce((acc, m) => acc + Number(m.fields?.amount || 0), 0);
  const bankOutTotal = bankMovements
    .filter((m) => m.fields?.movementType !== 'Ingreso')
    .reduce((acc, m) => acc + Number(m.fields?.amount || 0), 0);

  return (
    <div>
      {currentTab === 'arqueo_gastos' && (
        <ModuleGate module="arqueo_gastos">
          <PkKpiRow
            items={[
              { label: 'Ventas Efectivo', value: formatCop(cashSales), color: 'var(--pk-emerald)' },
              { label: 'Ventas Digitales', value: formatCop(digitalSales), color: 'var(--pk-primary)' },
              { label: 'Gastos Operativos', value: formatCop(totalExpenses), color: 'var(--pk-rose)' },
              { label: 'Neto en Caja (Gaveta)', value: formatCop(netCash), color: '#0f172a' },
            ]}
          />

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">💰 Registrar Salida / Gasto de Caja</div>
              <PkPrintButton label="🖨️ Imprimir Arqueo de Caja" payload={arqueoPayload} variant="primary" />
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
                  <button type="submit" className="pk-btn pk-btn-primary">
                    ➕ Registrar Egreso
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🧾 Historial de Comprobantes de Egreso ({expenses.length})</div>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Consecutivo</th>
                      <th>Fecha</th>
                      <th>Categoría</th>
                      <th>Concepto</th>
                      <th>Fuente</th>
                      <th>Responsable</th>
                      <th>Valor</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
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
                          <td>{exp.category}</td>
                          <td>{exp.description}</td>
                          <td>{exp.paymentSource}</td>
                          <td>{exp.responsible}</td>
                          <td style={{ fontWeight: 800, color: 'var(--pk-rose)' }}>{formatCop(exp.amount)}</td>
                          <td>
                            <div className="pk-row-actions">
                              <FeatureGate module="arqueo_gastos" feature="impresion_egreso">
                                <PkPrintButton label="🖨️ Comprobante" payload={buildExpenseReceipt(exp)} />
                              </FeatureGate>
                              <button
                                type="button"
                                className="pk-btn pk-btn-danger pk-btn-sm"
                                onClick={() => void handleDeleteExpense(exp.id)}
                              >
                                🗑️ Eliminar
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

      {currentTab === 'bancos_tesoreria' && (
        <ModuleGate module="bancos_tesoreria">
          <PkKpiRow
            items={[
              { label: 'Recaudo Digital POS', value: formatCop(digitalSales), color: 'var(--pk-primary)' },
              { label: 'Consignaciones / Entradas', value: formatCop(bankInTotal), color: 'var(--pk-emerald)' },
              { label: 'Pagos / Salidas Bancos', value: formatCop(bankOutTotal), color: 'var(--pk-rose)' },
              {
                label: 'Saldo Conciliado Digital',
                value: formatCop(digitalSales + bankInTotal - bankOutTotal),
                color: '#0f172a',
              },
            ]}
          />

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">🏦 Conciliación de Cuentas Bancarias, Nequi y DaviPlata</div>
              <PkPrintButton
                label="🖨️ Imprimir Extracto Conciliación"
                variant="primary"
                payload={{
                  document_type: 'REPORTE_TABLA',
                  layout_variant: 'carta_membrete',
                  document_number: `CONC-${new Date().toISOString().slice(0, 10)}`,
                  issue_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
                  customer_name: 'Conciliación Tesorería Bancos y Billeteras Digitales',
                  extra_fields: {
                    'Ventas Digitales POS': formatCop(digitalSales),
                    'Entradas Conciliadas': formatCop(bankInTotal),
                    'Salidas Conciliadas': formatCop(bankOutTotal),
                  },
                  items: bankMovements.map((m) => {
                    const val = Number(m.fields?.amount || 0);
                    const signed = m.fields?.movementType === 'Ingreso' ? val : -val;
                    return {
                      code: m.id,
                      description: `${m.fields?.accountName || ''} [${m.fields?.movementType || ''}] — ${m.fields?.concept || ''} (Ref: ${m.fields?.reference || 'S/R'})`,
                      quantity: 1,
                      unit_price: signed,
                      subtotal: signed,
                    };
                  }),
                  grand_total: digitalSales + bankInTotal - bankOutTotal,
                  notes: 'Extracto interno de movimientos conciliados en cuentas bancarias y billeteras.',
                }}
              />
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
                    value={bankAmount}
                    onChange={(e) => setBankAmount(e.target.value)}
                    placeholder="Ej: 180000"
                  />
                </div>
                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-emerald">
                    💾 Registrar Movimiento
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
                      <th>Valor</th>
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
                        const val = Number(m.fields?.amount || 0);
                        const isIn = m.fields?.movementType === 'Ingreso';
                        return (
                          <tr key={m.id}>
                            <td>
                              <span className="pk-badge pk-badge-blue">{m.id}</span>
                            </td>
                            <td>{m.createdAt}</td>
                            <td style={{ fontWeight: 700 }}>{m.fields?.accountName}</td>
                            <td>
                              <span className={`pk-badge ${isIn ? 'pk-badge-emerald' : 'pk-badge-amber'}`}>
                                {m.fields?.movementType}
                              </span>
                            </td>
                            <td>{m.fields?.reference || '—'}</td>
                            <td>{m.fields?.concept}</td>
                            <td style={{ fontWeight: 800, color: isIn ? 'var(--pk-emerald)' : 'var(--pk-rose)' }}>
                              {isIn ? '+' : '-'}
                              {formatCop(val)}
                            </td>
                            <td>
                              <PkPrintButton
                                label="🖨️ Soporte"
                                payload={{
                                  document_type: 'RECIBO_CAJA',
                                  layout_variant: 'carta_membrete',
                                  document_number: m.id,
                                  issue_date: m.createdAt,
                                  customer_name: m.fields?.accountName || 'Tesorería',
                                  payment_method: m.fields?.movementType || 'Bancario',
                                  extra_fields: {
                                    Cuenta: m.fields?.accountName || '',
                                    Referencia: m.fields?.reference || 'N/A',
                                  },
                                  items: [
                                    {
                                      code: m.id,
                                      description: m.fields?.concept || 'Movimiento bancario',
                                      quantity: 1,
                                      unit_price: val,
                                      subtotal: val,
                                    },
                                  ],
                                  grand_total: val,
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
