import React, { useState, useEffect, useCallback } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkAutoCodeInput,
  PkSelect,
  PkModal,
  PkPrintButton,
  PkKpiRow,
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

export const ContabilidadView: React.FC = () => {
  const { apiGet, apiPost, toast, hasService } = usePlatform();
  const { busy, run } = useAsyncAction();

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
        prev && accList.some((a) => a.id === prev) ? prev : accList[0]?.id || '',
      );
      setCreditAccountId((prev) =>
        prev && accList.some((a) => a.id === prev) ? prev : accList[1]?.id || accList[0]?.id || '',
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
    if (!debitAccountId || !creditAccountId || !concept.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
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
      ]),
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

  return (
    <ModuleGate module="comprobantes_puc">
      <PkKpiRow
        items={[
          { label: 'Subcuentas PUC Activas', value: String(pucAccounts.length), color: 'var(--pk-primary)' },
          { label: 'Comprobantes Asentados', value: String(vouchers.length), color: 'var(--pk-emerald)' },
          { label: 'Sumas Iguales (Debe = Haber)', value: formatCop(totalJournalVolume), color: '#0f172a' },
          { label: 'Próximo Comprobante', value: nextVoucherCode, color: 'var(--pk-amber)' },
        ]}
      />

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📘 Asentar Comprobante Contable de Partida Doble (PUC)</div>
          <button
            type="button"
            className="pk-btn pk-btn-outline pk-btn-sm"
            onClick={() => openNewPucDialog('debit')}
          >
            + Nueva Cuenta PUC
          </button>
        </div>
        <div className="pk-card-body">
          <form onSubmit={handleCreateVoucher} className="pk-form-grid">
            <PkAutoCodeInput label="Comprobante Contable" value={nextVoucherCode} />

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

            <div className="pk-field">
              <label>Concepto Contable *</label>
              <input
                required
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ej: Causación honorarios / Consignación recaudo diario"
              />
            </div>

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

            <div className="pk-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                ⚖️ Contabilizar Asiento
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📊 Balance Rápido de Prueba por Subcuenta PUC ({balances.length})</div>
        </div>
        <div className="pk-card-body">
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Código PUC</th>
                  <th>Subcuenta</th>
                  <th>Clase</th>
                  <th>Mov. Débitos</th>
                  <th>Mov. Créditos</th>
                  <th>Saldo Neto</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((bal) => (
                  <tr key={bal.accountId}>
                    <td><strong>{bal.code}</strong></td>
                    <td>{bal.name}</td>
                    <td><span className="pk-badge pk-badge-slate">{bal.category}</span></td>
                    <td style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>{formatCop(bal.totalDebits)}</td>
                    <td style={{ color: 'var(--pk-amber)', fontWeight: 700 }}>{formatCop(bal.totalCredits)}</td>
                    <td style={{ fontWeight: 800, color: bal.netBalance >= 0 ? '#0f172a' : 'var(--pk-rose)' }}>
                      {formatCop(bal.netBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📋 Libro Diario de Comprobantes PUC ({vouchers.length})</div>
          <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportCsv}>
            📥 Exportar CSV
          </button>
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
                  <th>Valor</th>
                  <th>Imprimir</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                      No se han asentado comprobantes contables aún.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v) => (
                    <tr key={v.id}>
                      <td><span className="pk-badge pk-badge-blue">{v.code}</span></td>
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
                      <td style={{ fontWeight: 800, color: '#0f172a' }}>{formatCop(v.amount)}</td>
                      <td>
                        <PkPrintButton label="🖨️ Comprobante" payload={buildVoucherPayload(v)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PkModal
        open={pucModalOpen}
        title="Agregar Nueva Subcuenta al Catálogo PUC"
        onClose={() => setPucModalOpen(false)}
      >
        <form onSubmit={handleSavePuc} className="pk-form-grid">
          <div className="pk-field">
            <label>Código Subcuenta PUC (Numérico) *</label>
            <input
              required
              value={pucCode}
              onChange={(e) => setPucCode(e.target.value)}
              placeholder="Ej: 513535"
            />
          </div>
          <div className="pk-field">
            <label>Denominación Oficial de la Cuenta *</label>
            <input
              required
              value={pucName}
              onChange={(e) => setPucName(e.target.value)}
              placeholder="Ej: Acueducto y Alcantarillado"
            />
          </div>
          <div className="pk-field">
            <label>Clase / Naturaleza Contable</label>
            <select value={pucCategory} onChange={(e) => setPucCategory(e.target.value)}>
              <option value="Activo">1 — Activo</option>
              <option value="Pasivo">2 — Pasivo</option>
              <option value="Patrimonio">3 — Patrimonio</option>
              <option value="Ingreso">4 — Ingreso</option>
              <option value="Gasto">5 — Gasto</option>
              <option value="Costo">6 — Costo de Ventas</option>
            </select>
          </div>
          <div className="pk-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              Guardar Cuenta PUC
            </button>
          </div>
        </form>
      </PkModal>
    </ModuleGate>
  );
};

export default ContabilidadView;
