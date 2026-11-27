import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkAutoCodeInput,
  PkSelect,
  PkSimpleSelect,
  PkModal,
  PkPrintButton,
  PkKpiRow,
  PkLiveHeader,
  PkTicketCard,
  PkProcessNodes,
  PkTypeCards,
  PkFullscreenDialog,
  PkProgressBar,
  PkDistributionStrip,
  useAsyncAction,
  formatCop,
  downloadCsvUtf8,
} from '@platform/ui-sdk';

interface PucAccount {
  id: string;
  code: string;
  name: string;
  category: string;
  createdAt: string;
}

interface AccountingVoucher {
  id: string;
  code: string;
  debitAccountId: string;
  debitAccountCode: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountCode: string;
  creditAccountName: string;
  thirdPartyId: string;
  thirdPartyName: string;
  thirdPartyNit: string;
  concept: string;
  amount: number;
  createdAt: string;
}

interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  category: string;
  totalDebits: number;
  totalCredits: number;
  netBalance: number;
}

interface ContabilidadAllResponse {
  ok: boolean;
  nextCode: string;
  nextVoucherCode: string;
  pucAccounts: PucAccount[];
  vouchers: AccountingVoucher[];
  balances: AccountBalance[];
}

interface RemoteCustomer {
  id: string;
  name: string;
  nit: string;
}

const PUC_CATEGORY_OPTIONS = [
  { value: 'Activo', label: '1 — Activo' },
  { value: 'Pasivo', label: '2 — Pasivo' },
  { value: 'Patrimonio', label: '3 — Patrimonio' },
  { value: 'Ingreso', label: '4 — Ingreso' },
  { value: 'Gasto', label: '5 — Gasto' },
  { value: 'Costo', label: '6 — Costo de Ventas' },
];

const VOUCHER_STUDIO_CARDS = [
  {
    key: 'diario',
    icon: '📘',
    title: 'Comprobante de Diario',
    description: 'Causaciones ordinarias NIIF, reconocimiento de ingresos, provisiones y traslados contables.',
    badge: 'CD · Diario',
  },
  {
    key: 'egreso',
    icon: '💸',
    title: 'Comprobante de Egreso / Pago',
    description: 'Desembolsos a proveedores, pago de honorarios, arrendamientos y obligaciones financieras.',
    badge: 'CE · Egreso',
  },
  {
    key: 'ajuste',
    icon: '⚖️',
    title: 'Nota de Ajuste Contable',
    description: 'Reclasificaciones de saldos PUC, depreciaciones, amortizaciones y cierres de periodo.',
    badge: 'NA · Ajuste',
  },
];

const PUC_CLASS_COLORS: Record<string, string> = {
  Activo: '#0284c7',
  Pasivo: '#f59e0b',
  Patrimonio: '#8b5cf6',
  Ingreso: '#10b981',
  Gasto: '#ef4444',
  Costo: '#0f172a',
};

export const ContabilidadView: React.FC = () => {
  const { apiGet, apiPost, toast, hasService } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [activePill, setActivePill] = useState<string>('diario');
  const [displayMode, setDisplayMode] = useState<'board' | 'table'>('board');
  const [voucherStudioOpen, setVoucherStudioOpen] = useState(false);
  const [voucherTypeKey, setVoucherTypeKey] = useState<string>('diario');

  const [voucherSearch, setVoucherSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [nextVoucherCode, setNextVoucherCode] = useState('CMP-901');
  const [pucAccounts, setPucAccounts] = useState<PucAccount[]>([]);
  const [vouchers, setVouchers] = useState<AccountingVoucher[]>([]);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [customers, setCustomers] = useState<RemoteCustomer[]>([]);

  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [selectedThirdPartyId, setSelectedThirdPartyId] = useState('');
  const [thirdPartyName, setThirdPartyName] = useState('Tercero General');
  const [thirdPartyNit, setThirdPartyNit] = useState('222222222222');
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');

  const [pucModalOpen, setPucModalOpen] = useState(false);
  const [pucTargetSide, setPucTargetSide] = useState<'debit' | 'credit'>('debit');
  const [pucCode, setPucCode] = useState('');
  const [pucName, setPucName] = useState('');
  const [pucCategory, setPucCategory] = useState('Activo');

  const hasClientes = hasService('ms-clientes');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<ContabilidadAllResponse>('/api/v1/contabilidad/all');
      const accList = data.pucAccounts || [];
      setNextVoucherCode(data.nextVoucherCode || data.nextCode || 'CMP-901');
      setPucAccounts(accList);
      setVouchers(data.vouchers || []);
      setBalances(data.balances || []);

      setDebitAccountId((prev) =>
        prev && accList.some((a) => a.id === prev) ? prev : accList[0]?.id || ''
      );
      setCreditAccountId((prev) =>
        prev && accList.some((a) => a.id === prev) ? prev : accList[1]?.id || accList[0]?.id || ''
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No fue posible cargar el libro contable');
    }

    if (hasClientes) {
      try {
        const cliData = await apiGet<{ customers?: RemoteCustomer[] }>('/api/v1/clientes/all');
        setCustomers(cliData.customers || []);
      } catch {
        setCustomers([]);
      }
    }
  }, [apiGet, hasClientes, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handlePillChange = (pillKey: string) => {
    setActivePill(pillKey);
    if (pillKey === 'Activo' || pillKey === 'Pasivo' || pillKey === 'Ingreso' || pillKey === 'Gasto') {
      setCategoryFilter(pillKey);
    } else if (pillKey === 'puc') {
      setCategoryFilter('');
    }
  };

  const handleSelectVoucherType = (typeKey: string) => {
    setVoucherTypeKey(typeKey);
    if (!concept.trim()) {
      if (typeKey === 'diario') setConcept('Causación contable de operaciones del periodo');
      else if (typeKey === 'egreso') setConcept('Comprobante de egreso y pago a proveedor');
      else setConcept('Nota de ajuste y reclasificación NIIF');
    }
  };

  const openNewPucDialog = (side: 'debit' | 'credit') => {
    setPucTargetSide(side);
    setPucModalOpen(true);
  };

  const handleSelectThirdParty = (cliId: string) => {
    setSelectedThirdPartyId(cliId);
    const found = customers.find((c) => c.id === cliId);
    if (found) {
      setThirdPartyName(found.name);
      setThirdPartyNit(found.nit);
    } else {
      setThirdPartyName('Tercero General');
      setThirdPartyNit('222222222222');
    }
  };

  const handleSavePuc = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = pucCode.trim();
    if (!/^\d{2,12}$/.test(cleanCode) || !pucName.trim()) {
      toast('Ingresa un código PUC numérico válido (2 a 12 dígitos) y la denominación de la cuenta.');
      return;
    }
    void run(async () => {
      try {
        const res = await apiPost<{ ok: boolean; pucAccount: PucAccount }>('/api/v1/contabilidad/puc', {
          code: cleanCode,
          name: pucName.trim(),
          category: pucCategory,
        });
        toast(`Subcuenta PUC ${res.pucAccount.code} agregada al catálogo`);
        setPucCode('');
        setPucName('');
        setPucModalOpen(false);
        await reload();
        if (res.pucAccount?.id) {
          if (pucTargetSide === 'debit') {
            setDebitAccountId(res.pucAccount.id);
          } else {
            setCreditAccountId(res.pucAccount.id);
          }
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible registrar la cuenta PUC');
      }
    });
  };

  const handleCreateVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount || 0);
    if (
      !debitAccountId ||
      !creditAccountId ||
      !concept.trim() ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      toast('Completa las cuentas Débito y Crédito, el concepto y un valor mayor a cero.');
      return;
    }
    if (debitAccountId === creditAccountId) {
      toast('La cuenta débito y la cuenta crédito deben ser distintas para cumplir partida doble');
      return;
    }
    void run(async () => {
      try {
        await apiPost('/api/v1/contabilidad/vouchers', {
          debitAccountId,
          creditAccountId,
          thirdPartyId: selectedThirdPartyId,
          thirdPartyName: thirdPartyName.trim() || 'Tercero General',
          thirdPartyNit: thirdPartyNit.trim() || '222222222222',
          concept: concept.trim(),
          amount: numericAmount,
        });
        toast('Comprobante contable asentado en partida doble');
        setConcept('');
        setAmount('');
        await reload();
        setVoucherStudioOpen(false);
        setActivePill('diario');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error asentando comprobante contable');
      }
    });
  };

  const handleExportCsv = () => {
    downloadCsvUtf8(
      'contabilidad_libro_diario.csv',
      [
        'Comprobante',
        'Fecha',
        'Código Débito',
        'Cuenta Débito',
        'Código Crédito',
        'Cuenta Crédito',
        'Tercero',
        'NIT',
        'Concepto',
        'Valor',
      ],
      vouchers.map((v) => [
        v.code,
        v.createdAt,
        v.debitAccountCode,
        v.debitAccountName,
        v.creditAccountCode,
        v.creditAccountName,
        v.thirdPartyName,
        v.thirdPartyNit,
        v.concept,
        v.amount,
      ])
    );
  };

  const buildVoucherPayload = (v: AccountingVoucher): Record<string, unknown> => ({
    document_type: 'COMPROBANTE DE CONTABILIDAD (PARTIDA DOBLE)',
    layout_variant: 'carta_membrete',
    document_number: v.code,
    issue_date: v.createdAt,
    customer_name: v.thirdPartyName || 'Tercero General',
    customer_nit: v.thirdPartyNit || '',
    payment_method: 'Asiento Contable PUC',
    extra_fields: {
      Concepto: v.concept,
      'Total Débitos': formatCop(v.amount),
      'Total Créditos': formatCop(v.amount),
      Cuadre: 'SUMAS IGUALES ($0 Diferencia)',
    },
    items: [
      {
        code: v.debitAccountCode,
        description: `[DÉBITO] ${v.debitAccountCode} — ${v.debitAccountName} · ${v.concept}`,
        quantity: 1,
        unit_price: v.amount,
        subtotal: v.amount,
      },
      {
        code: v.creditAccountCode,
        description: `[CRÉDITO] ${v.creditAccountCode} — ${v.creditAccountName} · ${v.concept}`,
        quantity: 1,
        unit_price: v.amount,
        subtotal: v.amount,
      },
    ],
    subtotal: v.amount,
    grand_total: v.amount,
    notes: 'Comprobante de diario mayorizado conforme al Plan Único de Cuentas (PUC).',
  });

  const totalJournalVolume = vouchers.reduce((acc, v) => acc + Number(v.amount || 0), 0);

  const classDistribution = useMemo(() => {
    const order = ['Activo', 'Pasivo', 'Patrimonio', 'Ingreso', 'Gasto', 'Costo'];
    return order.map((cat) => {
      const sumMov = balances
        .filter((b) => b.category === cat)
        .reduce((acc, b) => acc + Math.abs(b.totalDebits) + Math.abs(b.totalCredits), 0);
      return {
        label: cat,
        value: Math.max(sumMov, 0),
        displayValue: formatCop(sumMov),
        color: PUC_CLASS_COLORS[cat] || '#64748b',
      };
    });
  }, [balances]);

  const classPrefixFilter =
    activePill === 'Activo'
      ? '1'
      : activePill === 'Pasivo'
      ? '2'
      : activePill === 'Ingreso'
      ? '4'
      : activePill === 'Gasto'
      ? '5'
      : '';

  const filteredVouchers = vouchers.filter((v) => {
    if (
      classPrefixFilter &&
      !v.debitAccountCode.startsWith(classPrefixFilter) &&
      !v.creditAccountCode.startsWith(classPrefixFilter)
    ) {
      return false;
    }
    const q = voucherSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      v.code.toLowerCase().includes(q) ||
      v.debitAccountCode.toLowerCase().includes(q) ||
      v.debitAccountName.toLowerCase().includes(q) ||
      v.creditAccountCode.toLowerCase().includes(q) ||
      v.creditAccountName.toLowerCase().includes(q) ||
      v.thirdPartyName.toLowerCase().includes(q) ||
      v.concept.toLowerCase().includes(q)
    );
  });

  const effectiveCatFilter =
    activePill === 'Activo' || activePill === 'Pasivo' || activePill === 'Ingreso' || activePill === 'Gasto'
      ? activePill
      : categoryFilter;

  const filteredBalances = balances.filter((bal) => {
    if (effectiveCatFilter && bal.category !== effectiveCatFilter) return false;
    const q = voucherSearch.trim().toLowerCase();
    if (!q) return true;
    return bal.code.toLowerCase().includes(q) || bal.name.toLowerCase().includes(q);
  });

  const liveAmountNum = Math.max(0, Number(amount || 0));
  const selectedDebitObj = pucAccounts.find((a) => a.id === debitAccountId);
  const selectedCreditObj = pucAccounts.find((a) => a.id === creditAccountId);
  const isDoubleEntryBalanced =
    liveAmountNum > 0 && Boolean(debitAccountId) && Boolean(creditAccountId) && debitAccountId !== creditAccountId;

  const countByCat = (cat: string) => balances.filter((b) => b.category === cat).length;

  return (
    <ModuleGate module="comprobantes_puc">
      <div className="pk-stack">
        <PkLiveHeader
          title="Centro Contable NIIF y Partida Doble"
          liveLabel="Mayor cuadrado"
          subtitle="Asientos contables en partida doble (Debe = Haber), libro diario oficial y explorador analítico por clases PUC."
          pills={[
            { key: 'diario', label: '📘 Libro Diario', count: vouchers.length },
            { key: 'puc', label: '📊 Balance PUC', count: balances.length },
            { key: 'Activo', label: 'Activos (1)', count: countByCat('Activo') },
            { key: 'Pasivo', label: 'Pasivos (2)', count: countByCat('Pasivo') },
            { key: 'Ingreso', label: 'Ingresos (4)', count: countByCat('Ingreso') },
            { key: 'Gasto', label: 'Gastos (5)', count: countByCat('Gasto') },
          ]}
          activePill={activePill}
          onPillChange={handlePillChange}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          boardLabel="🎛️ Vista Ejecutiva"
          tableLabel="📋 Tabla Mayor"
          primaryActionLabel="+ Nuevo Comprobante"
          onPrimaryAction={() => setVoucherStudioOpen(true)}
          extraActions={
            <>
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                onClick={() => openNewPucDialog('debit')}
              >
                + Cuenta PUC
              </button>
              <button type="button" className="pk-btn pk-btn-outline" onClick={handleExportCsv}>
                📥 Exportar CSV
              </button>
            </>
          }
        />

        <PkKpiRow
          items={[
            { label: 'Subcuentas PUC Activas', value: String(pucAccounts.length), color: 'var(--pk-primary)' },
            { label: 'Comprobantes Mayorizados', value: String(vouchers.length), color: 'var(--pk-emerald)' },
            { label: 'Sumas Iguales (Debe = Haber)', value: formatCop(totalJournalVolume), color: '#0f172a' },
            { label: 'Próximo Comprobante', value: nextVoucherCode, color: 'var(--pk-amber)' },
          ]}
        />

        <PkDistributionStrip
          title="Distribución de Movimiento Contable Acumulado por Clases del PUC"
          segments={classDistribution}
        />

        <div className="pk-card">
          <div className="pk-datatable-toolbar" style={{ borderBottom: 'none' }}>
            <input
              className="pk-input pk-datatable-search"
              placeholder="🔎 Filtrar comprobantes o subcuentas por código PUC, tercero, NIT o concepto..."
              value={voucherSearch}
              onChange={(e) => setVoucherSearch(e.target.value)}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {activePill === 'puc' && (
                <div style={{ minWidth: 240 }}>
                  <PkSimpleSelect
                    ariaLabel="Filtrar subcuentas por naturaleza contable"
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    allowClear
                    placeholder="Todas las clases PUC"
                    options={[
                      { value: '', label: 'Todas las clases PUC' },
                      ...PUC_CATEGORY_OPTIONS,
                    ]}
                  />
                </div>
              )}
              <span className="pk-badge pk-badge-emerald">⚖️ Diferencia Libro Mayor: $0</span>
            </div>
          </div>
        </div>

        {activePill === 'diario' ? (
          displayMode === 'board' ? (
            filteredVouchers.length === 0 ? (
              <div className="pk-card">
                <div className="pk-card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--pk-muted)' }}>
                  {vouchers.length === 0
                    ? 'Aún no hay asientos registrados. Haz clic en "+ Nuevo Comprobante" para contabilizar en partida doble.'
                    : 'No se encontraron comprobantes con el criterio buscado.'}
                </div>
              </div>
            ) : (
              <div className="pk-cards-showcase">
                {filteredVouchers.map((v) => (
                  <PkTicketCard
                    key={v.id}
                    code={`#${v.code}`}
                    timeAgo={v.createdAt}
                    channelBadge={{ label: 'Partida Doble · $0 Dif.', tone: 'emerald' }}
                    title={v.concept}
                    subtitle={`Tercero: ${v.thirdPartyName}`}
                    metaLine={`🏢 NIT / CC: ${v.thirdPartyNit || '222222222222'}`}
                    items={[
                      {
                        qty: 'DEBE',
                        name: `${v.debitAccountCode} · ${v.debitAccountName}`,
                        amount: formatCop(v.amount),
                      },
                      {
                        qty: 'HABER',
                        name: `${v.creditAccountCode} · ${v.creditAccountName}`,
                        amount: formatCop(v.amount),
                      },
                    ]}
                    totalLabel="SUMAS IGUALES"
                    totalValue={formatCop(v.amount)}
                    processNodes={[
                      { step: 1, label: '1. Captura', status: 'done' },
                      { step: 2, label: '2. Partida Cuadrada', status: 'done' },
                      { step: 3, label: '3. Mayorizado', status: 'done' },
                    ]}
                    statusPill={{ label: 'Mayorizado en Libro Oficial', tone: 'emerald' }}
                    secondaryActions={
                      <PkPrintButton
                        label="🖨️ Imprimir Comprobante"
                        payload={buildVoucherPayload(v)}
                        variant="primary"
                      />
                    }
                  />
                ))}
              </div>
            )
          ) : (
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">📋 Libro Diario de Comprobantes PUC ({filteredVouchers.length})</div>
              </div>
              <div className="pk-card-body">
                <div className="pk-table-wrap">
                  <table className="pk-table">
                    <thead>
                      <tr>
                        <th>Comprobante</th>
                        <th>Fecha</th>
                        <th>Cuenta Débito (Debe)</th>
                        <th>Cuenta Crédito (Haber)</th>
                        <th>Tercero</th>
                        <th>Concepto</th>
                        <th className="pk-num">Valor</th>
                        <th>Estado</th>
                        <th>Imprimir</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVouchers.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <span className="pk-badge pk-badge-blue">{v.code}</span>
                          </td>
                          <td>{v.createdAt}</td>
                          <td>
                            <span className="pk-badge pk-badge-emerald">{v.debitAccountCode}</span>{' '}
                            {v.debitAccountName}
                          </td>
                          <td>
                            <span className="pk-badge pk-badge-amber">{v.creditAccountCode}</span>{' '}
                            {v.creditAccountName}
                          </td>
                          <td style={{ fontWeight: 700 }}>{v.thirdPartyName}</td>
                          <td>{v.concept}</td>
                          <td className="pk-num" style={{ fontWeight: 800, color: '#0f172a' }}>
                            {formatCop(v.amount)}
                          </td>
                          <td>
                            <PkProcessNodes
                              compact
                              steps={[
                                { step: 1, label: 'Captura', status: 'done' },
                                { step: 2, label: 'Cuadre', status: 'done' },
                                { step: 3, label: 'Mayor', status: 'done' },
                              ]}
                            />
                          </td>
                          <td>
                            <PkPrintButton label="🖨️ Voucher" payload={buildVoucherPayload(v)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        ) : displayMode === 'board' ? (
          <div className="pk-stack">
            <div className="pk-cards-showcase">
              {filteredBalances.map((bal) => {
                const maxMov = Math.max(1, bal.totalDebits + bal.totalCredits);
                const debitShare = (bal.totalDebits / maxMov) * 100;
                return (
                  <PkTicketCard
                    key={bal.accountId}
                    code={`PUC ${bal.code}`}
                    channelBadge={{
                      label: bal.category,
                      tone:
                        bal.category === 'Ingreso'
                          ? 'emerald'
                          : bal.category === 'Pasivo'
                          ? 'amber'
                          : bal.category === 'Gasto'
                          ? 'coral'
                          : 'blue',
                    }}
                    title={bal.name}
                    subtitle={`Subcuenta Oficial Clase ${bal.code.charAt(0)}`}
                    items={[
                      { name: 'Movimientos Débito (Debe)', amount: formatCop(bal.totalDebits) },
                      { name: 'Movimientos Crédito (Haber)', amount: formatCop(bal.totalCredits) },
                    ]}
                    extraBody={
                      <PkProgressBar
                        label="Proporción Débito vs Crédito"
                        valueLabel={`${Math.round(debitShare)}% Debe`}
                        pct={debitShare}
                        tone={bal.netBalance >= 0 ? 'emerald' : 'amber'}
                      />
                    }
                    totalLabel="SALDO NETO MAYOR"
                    totalValue={formatCop(bal.netBalance)}
                    primaryAction={{
                      label: '⚡ Imputar en Nuevo Comprobante',
                      tone: 'navy',
                      onClick: () => {
                        setDebitAccountId(bal.accountId);
                        setVoucherStudioOpen(true);
                      },
                    }}
                  />
                );
              })}
            </div>

            {classPrefixFilter && filteredVouchers.length > 0 && (
              <div className="pk-stack">
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--pk-navy)' }}>
                  📘 Asientos Relacionados con {activePill} ({filteredVouchers.length})
                </div>
                <div className="pk-cards-showcase">
                  {filteredVouchers.map((v) => (
                    <PkTicketCard
                      key={v.id}
                      code={`#${v.code}`}
                      timeAgo={v.createdAt}
                      channelBadge={{ label: activePill, tone: 'blue' }}
                      title={v.concept}
                      subtitle={v.thirdPartyName}
                      items={[
                        { qty: 'DEBE', name: `${v.debitAccountCode} · ${v.debitAccountName}`, amount: formatCop(v.amount) },
                        { qty: 'HABER', name: `${v.creditAccountCode} · ${v.creditAccountName}`, amount: formatCop(v.amount) },
                      ]}
                      totalLabel="VALOR ASIENTO"
                      totalValue={formatCop(v.amount)}
                      secondaryActions={
                        <PkPrintButton label="🖨️ Imprimir Voucher" payload={buildVoucherPayload(v)} />
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                📊 Balance de Prueba Mayorizado por Subcuenta PUC ({filteredBalances.length})
              </div>
              <button
                type="button"
                className="pk-btn pk-btn-outline pk-btn-sm"
                onClick={() => openNewPucDialog('debit')}
              >
                + Nueva Cuenta PUC
              </button>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Código PUC</th>
                      <th>Subcuenta</th>
                      <th>Clase</th>
                      <th className="pk-num">Mov. Débitos</th>
                      <th className="pk-num">Mov. Créditos</th>
                      <th className="pk-num">Saldo Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBalances.map((bal) => (
                      <tr key={bal.accountId}>
                        <td>
                          <strong>{bal.code}</strong>
                        </td>
                        <td>{bal.name}</td>
                        <td>
                          <span className="pk-badge pk-badge-slate">{bal.category}</span>
                        </td>
                        <td className="pk-num" style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>
                          {formatCop(bal.totalDebits)}
                        </td>
                        <td className="pk-num" style={{ color: 'var(--pk-amber)', fontWeight: 700 }}>
                          {formatCop(bal.totalCredits)}
                        </td>
                        <td
                          className="pk-num"
                          style={{
                            fontWeight: 800,
                            color: bal.netBalance >= 0 ? '#0f172a' : 'var(--pk-rose)',
                          }}
                        >
                          {formatCop(bal.netBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <PkFullscreenDialog
        open={voucherStudioOpen}
        title="Estudio de Contabilización NIIF en Partida Doble"
        subtitle="Selecciona la clase de comprobante, imputa las subcuentas Débito y Crédito y verifica el equilibrio en vivo."
        badge={{ label: nextVoucherCode, tone: 'blue' }}
        onClose={() => setVoucherStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="1. Naturaleza del Comprobante Contable"
            options={VOUCHER_STUDIO_CARDS}
            value={voucherTypeKey}
            onChange={handleSelectVoucherType}
          />
        }
        footerLeft={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className={`pk-badge ${isDoubleEntryBalanced ? 'pk-badge-emerald' : 'pk-badge-amber'}`}>
              {isDoubleEntryBalanced
                ? `✓ PARTIDA DOBLE CUADRADA: DEBE ${formatCop(liveAmountNum)} = HABER ${formatCop(liveAmountNum)}`
                : debitAccountId && debitAccountId === creditAccountId
                ? '⚠️ LA SUBCUENTA DÉBITO Y CRÉDITO DEBEN SER DIFERENTES'
                : 'INGRESA MONTO > $0 Y SUBCUENTAS DISTINTAS PARA MAYORIZAR'}
            </span>
          </div>
        }
        footerActions={
          <>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setVoucherStudioOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pk-voucher-studio-form"
              className="pk-btn pk-btn-primary"
              disabled={busy || !isDoubleEntryBalanced}
            >
              {busy ? 'Mayorizando...' : '⚖️ Asentar y Mayorizar Comprobante'}
            </button>
          </>
        }
      >
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #dbe3ee',
            borderRadius: 16,
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 14, color: 'var(--pk-navy)' }}>
              ⚖️ Barra de Equilibrio de Partida Doble en Vivo (Total Débito vs Total Crédito)
            </div>
            <div style={{ minWidth: 260 }}>
              <PkProcessNodes
                compact
                steps={[
                  { step: 1, label: '1. Captura', status: liveAmountNum > 0 ? 'done' : 'active' },
                  {
                    step: 2,
                    label: '2. Partida Cuadrada',
                    status: isDoubleEntryBalanced
                      ? 'done'
                      : debitAccountId && debitAccountId === creditAccountId
                      ? 'error'
                      : 'pending',
                  },
                  { step: 3, label: '3. Mayorizado', status: isDoubleEntryBalanced ? 'active' : 'pending' },
                ]}
              />
            </div>
          </div>

          <div className="pk-grid-2">
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: 12,
                padding: '12px 16px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>
                TOTAL DÉBITO (DEBE)
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#047857', marginTop: 4 }}>
                {formatCop(liveAmountNum)}
              </div>
              <div style={{ fontSize: 12, color: '#065f46', marginTop: 2 }}>
                {selectedDebitObj
                  ? `${selectedDebitObj.code} — ${selectedDebitObj.name}`
                  : 'Selecciona subcuenta débito'}
              </div>
            </div>

            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 12,
                padding: '12px 16px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
                TOTAL CRÉDITO (HABER)
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#1d4ed8', marginTop: 4 }}>
                {formatCop(liveAmountNum)}
              </div>
              <div style={{ fontSize: 12, color: '#1e40af', marginTop: 2 }}>
                {selectedCreditObj
                  ? `${selectedCreditObj.code} — ${selectedCreditObj.name}`
                  : 'Selecciona subcuenta crédito'}
              </div>
            </div>
          </div>

          <PkDistributionStrip
            segments={[
              {
                label: 'Imputación Débito (50%)',
                value: Math.max(liveAmountNum, 1),
                displayValue: formatCop(liveAmountNum),
                color: '#10b981',
              },
              {
                label: 'Contrapartida Crédito (50%)',
                value: Math.max(liveAmountNum, 1),
                displayValue: formatCop(liveAmountNum),
                color: '#2563eb',
              },
            ]}
          />
        </div>

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">2. Imputación de Subcuentas PUC, Tercero y Concepto Oficial</div>
            <button
              type="button"
              className="pk-btn pk-btn-outline pk-btn-sm"
              onClick={() => openNewPucDialog('debit')}
            >
              + Crear Subcuenta PUC
            </button>
          </div>
          <div className="pk-card-body">
            <form id="pk-voucher-studio-form" onSubmit={handleCreateVoucher} className="pk-form-grid cols-2">
              <PkAutoCodeInput label="Comprobante Contable" value={nextVoucherCode} />

              <div className="pk-field">
                <label>Valor del Asiento ($) *</label>
                <input
                  required
                  type="number"
                  min="1"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ej: 850000"
                />
              </div>

              <PkSelect
                label="Cuenta PUC Débito (Debe) *"
                items={pucAccounts}
                value={debitAccountId}
                onChange={setDebitAccountId}
                getValue={(a) => a.id}
                getLabel={(a) => `${a.code} — ${a.name} [${a.category}]`}
                onCreateNew={() => openNewPucDialog('debit')}
                createLabel="+ Nueva Cuenta PUC"
                searchable
              />

              <PkSelect
                label="Cuenta PUC Crédito (Haber) *"
                items={pucAccounts}
                value={creditAccountId}
                onChange={setCreditAccountId}
                getValue={(a) => a.id}
                getLabel={(a) => `${a.code} — ${a.name} [${a.category}]`}
                onCreateNew={() => openNewPucDialog('credit')}
                createLabel="+ Nueva Cuenta PUC"
                searchable
              />

              {hasClientes && customers.length > 0 && (
                <PkSelect
                  label="Tercero Registrado (Opcional)"
                  items={customers}
                  value={selectedThirdPartyId}
                  onChange={handleSelectThirdParty}
                  getValue={(c) => c.id}
                  getLabel={(c) => `${c.name} (${c.nit})`}
                  emptyLabel="Tercero General / Manual"
                  searchable
                />
              )}

              <div className="pk-field">
                <label>Nombre Tercero *</label>
                <input
                  required
                  value={thirdPartyName}
                  onChange={(e) => setThirdPartyName(e.target.value)}
                  placeholder="Tercero General"
                />
              </div>

              <div className="pk-field">
                <label>NIT / Documento Tercero</label>
                <input
                  value={thirdPartyNit}
                  onChange={(e) => setThirdPartyNit(e.target.value)}
                  placeholder="222222222222"
                />
              </div>

              <div className="pk-field pk-col-span-full">
                <label>Concepto Contable *</label>
                <input
                  required
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  placeholder="Ej: Causación honorarios / Consignación recaudo diario"
                />
              </div>
            </form>
          </div>
        </div>
      </PkFullscreenDialog>

      <PkModal
        open={pucModalOpen}
        title="Agregar Nueva Subcuenta al Catálogo PUC"
        onClose={() => setPucModalOpen(false)}
      >
        <form onSubmit={handleSavePuc} className="pk-form-grid cols-2">
          <div className="pk-field">
            <label>Código Subcuenta PUC (Numérico) *</label>
            <input
              required
              value={pucCode}
              onChange={(e) => setPucCode(e.target.value)}
              placeholder="Ej: 513535"
            />
          </div>
          <PkSimpleSelect
            label="Clase / Naturaleza Contable"
            value={pucCategory}
            onChange={setPucCategory}
            options={PUC_CATEGORY_OPTIONS}
          />
          <div className="pk-field pk-col-span-full">
            <label>Denominación Oficial de la Cuenta *</label>
            <input
              required
              value={pucName}
              onChange={(e) => setPucName(e.target.value)}
              placeholder="Ej: Acueducto y Alcantarillado"
            />
          </div>
          <div className="pk-form-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setPucModalOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              {busy ? 'Guardando...' : 'Guardar Cuenta PUC'}
            </button>
          </div>
        </form>
      </PkModal>
    </ModuleGate>
  );
};

export default ContabilidadView;
