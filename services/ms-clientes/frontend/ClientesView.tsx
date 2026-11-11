import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkSelect,
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

const VALID_MODULES = ['directorio_clientes', 'cartera_cxc', 'contratos_convenios'] as const;

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
    toast,
  } = usePlatform();

  const { busy, run } = useAsyncAction();

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
    await run(async () => {
      const limit = hasFeature('cartera_cxc', 'cupo_credito_control') ? Number(custCreditLimit || 0) : 0;
      await apiPost<CreatedCustomerResponse>('/api/v1/clientes/customers', {
        name: custName.trim(),
        nit: custNit.trim(),
        phone: custPhone.trim(),
        email: custEmail.trim(),
        address: custAddress.trim(),
        contractId: custContractId,
        tariffId: custTariffId,
        creditLimit: Number.isFinite(limit) && limit > 0 ? limit : 0,
      });
      toast('Cliente registrado en el directorio maestro');
      setCustName('');
      setCustNit('');
      setCustPhone('');
      setCustEmail('');
      setCustAddress('');
      setCustCreditLimit('0');
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

  const handleCreateContractInline = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await reload();
    });
  };

  const handleCreateTariffInline = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      await apiPost<CreatedTariffResponse>('/api/v1/clientes/tariffs', {
        name: tariffName.trim(),
        discountPct: Number(tariffDiscount || 0),
      });
      toast('Tarifa comercial registrada');
      setTariffName('');
      setTariffDiscount('5');
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

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data.customers;
    return data.customers.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.nit.toLowerCase().includes(q) ||
        c.contractCode.toLowerCase().includes(q)
    );
  }, [data.customers, searchQuery]);

  const totalCustomersDebt = useMemo(
    () => data.customers.reduce((acc, c) => acc + c.currentDebt, 0),
    [data.customers]
  );

  const totalCreditLimit = useMemo(
    () => data.customers.reduce((acc, c) => acc + c.creditLimit, 0),
    [data.customers]
  );

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

  return (
    <div>
      {effectiveModule === 'directorio_clientes' && (
        <ModuleGate module="directorio_clientes">
          <PkKpiRow
            items={[
              { label: 'Clientes en Directorio', value: String(data.customers.length) },
              {
                label: 'Clientes con Convenio',
                value: String(data.customers.filter((c) => Boolean(c.contractId)).length),
                color: 'var(--pk-primary)',
              },
              {
                label: 'Cartera Acumulada',
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

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">👤 Registrar Cliente o Tercero Comercial</div>
            </div>
            <div className="pk-card-body">
              <form onSubmit={(e) => void handleCreateCustomer(e)} className="pk-form-grid">
                <PkAutoCodeInput label="Código Cliente" value={data.nextCustomerCode} />

                <div className="pk-field">
                  <label htmlFor="pk-cust-name">Razón Social o Nombre *</label>
                  <input
                    id="pk-cust-name"
                    required
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="Ej: Comercializadora del Oriente S.A.S."
                  />
                </div>

                <div className="pk-field">
                  <label htmlFor="pk-cust-nit">NIT o Documento *</label>
                  <input
                    id="pk-cust-nit"
                    required
                    value={custNit}
                    onChange={(e) => setCustNit(e.target.value)}
                    placeholder="900.512.340-8"
                  />
                </div>

                <div className="pk-field">
                  <label htmlFor="pk-cust-phone">Teléfono</label>
                  <input
                    id="pk-cust-phone"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="6017402200"
                  />
                </div>

                <div className="pk-field">
                  <label htmlFor="pk-cust-email">Correo Electrónico</label>
                  <input
                    id="pk-cust-email"
                    type="email"
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="tesoreria@empresa.co"
                  />
                </div>

                <div className="pk-field">
                  <label htmlFor="pk-cust-address">Dirección Comercial</label>
                  <input
                    id="pk-cust-address"
                    value={custAddress}
                    onChange={(e) => setCustAddress(e.target.value)}
                    placeholder="Calle 72 # 10-34 Of. 502"
                  />
                </div>

                <PkSelect
                  label="Convenio Comercial"
                  items={data.contracts}
                  value={custContractId}
                  onChange={handleSelectCustomerContract}
                  getValue={(c) => c.id}
                  getLabel={(c) => `${c.code} — ${c.name}`}
                  emptyLabel="Particular (Sin convenio)"
                  onCreateNew={hasModule('contratos_convenios') ? () => setShowContractModal(true) : undefined}
                  createLabel="+ Nuevo Convenio"
                  searchable
                />

                <PkSelect
                  label="Tarifa Comercial"
                  items={data.tariffs}
                  value={custTariffId}
                  onChange={setCustTariffId}
                  getValue={(t) => t.id}
                  getLabel={(t) => `${t.code} — ${t.name} (-${t.discountPct}%)`}
                  emptyLabel="Tarifa estándar (0%)"
                  onCreateNew={hasModule('contratos_convenios') ? () => setShowTariffModal(true) : undefined}
                  createLabel="+ Nueva Tarifa"
                />

                <FeatureGate module="cartera_cxc" feature="cupo_credito_control">
                  <div className="pk-field">
                    <label htmlFor="pk-cust-limit">Cupo de Crédito Autorizado ($)</label>
                    <input
                      id="pk-cust-limit"
                      type="number"
                      min={0}
                      step="1000"
                      value={custCreditLimit}
                      onChange={(e) => setCustCreditLimit(e.target.value)}
                    />
                  </div>
                </FeatureGate>

                <div className="pk-field">
                  <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                    {busy ? 'Guardando...' : '➕ Registrar Cliente'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">📋 Directorio Maestro de Clientes</div>
              <div className="pk-row-actions">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por código, nombre o NIT..."
                  aria-label="Filtrar clientes"
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--pk-border)',
                    fontSize: 12.5,
                    minWidth: 230,
                  }}
                />
                <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={exportCustomersCsv}>
                  📥 Exportar CSV
                </button>
              </div>
            </div>
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
                          <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>{c.email || c.address || '—'}</div>
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
                          <span className={`pk-badge ${c.currentDebt > 0 ? 'pk-badge-amber' : 'pk-badge-emerald'}`}>
                            {formatCop(c.currentDebt)}
                          </span>
                        </td>
                        <td>
                          <div className="pk-row-actions">
                            {hasService('ms-facturacion') && (
                              <button
                                type="button"
                                className="pk-btn pk-btn-primary pk-btn-sm"
                                onClick={() => handleBillCustomer(c)}
                              >
                                🛒 Facturar
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
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                          No se encontraron clientes para el criterio consultado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ModuleGate>
      )}

      {effectiveModule === 'cartera_cxc' && (
        <ModuleGate module="cartera_cxc">
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

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">💳 Facturas Pendientes de Recaudo y Abonos</div>
              <div className="pk-row-actions">
                <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={exportReceivablesCsv}>
                  📥 Exportar Cartera CSV
                </button>
                <PkPrintButton
                  label="🖨️ Estado de Cuenta General"
                  payload={globalPortfolioPrintPayload}
                  variant="primary"
                />
              </div>
            </div>
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
                    {data.pendingInvoices.map((inv) => {
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
                    {data.pendingInvoices.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                          No existen facturas con saldo pendiente de cobro en este momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ModuleGate>
      )}

      {effectiveModule === 'contratos_convenios' && (
        <ModuleGate module="contratos_convenios">
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

          <div className="pk-grid-2">
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🤝 Nuevo Convenio o Contrato Comercial</div>
              </div>
              <div className="pk-card-body">
                <form onSubmit={(e) => void handleCreateContractInline(e)} className="pk-form-grid">
                  <PkAutoCodeInput label="Código Convenio" value={data.nextContractCode} />
                  <div className="pk-field">
                    <label htmlFor="pk-cnt-name">Nombre del Convenio / Entidad *</label>
                    <input
                      id="pk-cnt-name"
                      required
                      value={contractName}
                      onChange={(e) => setContractName(e.target.value)}
                      placeholder="Ej: Acuerdo Suministro Industrial del Norte"
                    />
                  </div>
                  <div className="pk-field">
                    <label htmlFor="pk-cnt-nit">NIT Entidad Contratante</label>
                    <input
                      id="pk-cnt-nit"
                      value={contractNit}
                      onChange={(e) => setContractNit(e.target.value)}
                      placeholder="890.211.409-3"
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
                  />
                  <div className="pk-field">
                    <label htmlFor="pk-cnt-ceiling">Tope Presupuestal ($) *</label>
                    <input
                      id="pk-cnt-ceiling"
                      required
                      type="number"
                      min={0}
                      step="1000"
                      value={contractCeiling}
                      onChange={(e) => setContractCeiling(e.target.value)}
                    />
                  </div>
                  <div className="pk-field">
                    <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                      {busy ? 'Guardando...' : '➕ Guardar Convenio'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🏷️ Catálogo de Tarifas y Descuentos</div>
              </div>
              <div className="pk-card-body">
                <form
                  onSubmit={(e) => void handleCreateTariffInline(e)}
                  className="pk-form-grid"
                  style={{ marginBottom: 14 }}
                >
                  <PkAutoCodeInput label="Código Tarifa" value={data.nextTariffCode} />
                  <div className="pk-field">
                    <label htmlFor="pk-trf-name">Nombre de la Tarifa *</label>
                    <input
                      id="pk-trf-name"
                      required
                      value={tariffName}
                      onChange={(e) => setTariffName(e.target.value)}
                      placeholder="Ej: Aliado Corporativo Oro"
                    />
                  </div>
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
                  <div className="pk-field">
                    <button type="submit" className="pk-btn pk-btn-emerald" disabled={busy}>
                      {busy ? 'Guardando...' : '➕ Guardar Tarifa'}
                    </button>
                  </div>
                </form>

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
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">📊 Convenios Vigentes y Control Presupuestal</div>
              <div className="pk-row-actions">
                <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={exportContractsCsv}>
                  📥 Exportar Convenios CSV
                </button>
              </div>
            </div>
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
                    {data.contracts.map((cnt) => (
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
                          <PkPrintButton
                            label="🖨️ Certificado"
                            payload={{
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
                              notes: `Saldo presupuestal disponible para nuevas órdenes: ${formatCop(cnt.availableBalance)}`,
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                    {data.contracts.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                          No hay convenios comerciales registrados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ModuleGate>
      )}

      <PkModal
        open={showContractModal}
        title="🤝 Crear Nuevo Convenio Comercial"
        onClose={() => setShowContractModal(false)}
      >
        <form onSubmit={(e) => void handleCreateContractFromModal(e)} className="pk-form-grid">
          <PkAutoCodeInput label="Código Convenio" value={data.nextContractCode} />
          <div className="pk-field">
            <label htmlFor="pk-modal-cnt-name">Nombre del Convenio *</label>
            <input
              id="pk-modal-cnt-name"
              required
              value={modalContractName}
              onChange={(e) => setModalContractName(e.target.value)}
              placeholder="Ej: Convenio Corporativo Empresarial"
            />
          </div>
          <div className="pk-field">
            <label htmlFor="pk-modal-cnt-nit">NIT Entidad</label>
            <input
              id="pk-modal-cnt-nit"
              value={modalContractNit}
              onChange={(e) => setModalContractNit(e.target.value)}
              placeholder="900.410.220-1"
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
          <div className="pk-row-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
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
        maxWidth={500}
      >
        <form onSubmit={(e) => void handleCreateTariffFromModal(e)} className="pk-form-grid">
          <PkAutoCodeInput label="Código Tarifa" value={data.nextTariffCode} />
          <div className="pk-field">
            <label htmlFor="pk-modal-trf-name">Nombre de la Tarifa *</label>
            <input
              id="pk-modal-trf-name"
              required
              value={modalTariffName}
              onChange={(e) => setModalTariffName(e.target.value)}
              placeholder="Ej: Descuento Institucional"
            />
          </div>
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
          <div className="pk-row-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
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
          <form onSubmit={(e) => void handleSubmitAbono(e)} className="pk-form-grid">
            <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
              <label>Resumen de la Obligación</label>
              <input
                readOnly
                value={`${abonoTarget.customerName} — Saldo Pendiente: ${formatCop(abonoTarget.pendingBalance)}`}
                style={{ background: '#f8fafc', fontWeight: 700 }}
              />
            </div>

            {(abonoTarget.abonos || []).length > 0 && (
              <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--pk-muted)' }}>
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

            <div className="pk-field">
              <label htmlFor="pk-abono-method">Medio de Pago</label>
              <select
                id="pk-abono-method"
                value={abonoMethod}
                onChange={(e) => setAbonoMethod(e.target.value)}
              >
                <option value="Transferencia Bancaria">Transferencia Bancaria / PSE</option>
                <option value="Efectivo en Caja">Efectivo en Caja</option>
                <option value="Billetera Digital">Billetera Digital Corporativa</option>
                <option value="Tarjeta Empresarial">Tarjeta Empresarial</option>
              </select>
            </div>

            <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="pk-abono-note">Referencia / Observación</label>
              <input
                id="pk-abono-note"
                value={abonoNote}
                onChange={(e) => setAbonoNote(e.target.value)}
                placeholder="Ej: Comprobante transferencia ACH #482910"
              />
            </div>

            <div className="pk-row-actions" style={{ gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
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
