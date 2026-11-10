import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  ModuleGate,
  PkAutoCodeInput,
  PkEntitySelect,
  PkEntityDialog,
  PkPrintButton,
  PkKpiRow,
  PucAccount,
  Customer,
  PrintDocumentPayload,
  formatCop,
} from '@proveko/ui-sdk';

interface VoucherRecord {
  id: string;
  createdAt: string;
  moduleKey: string;
  fields: Record<string, string>;
}

interface ContabilidadAllResponse {
  ok: boolean;
  nextVoucherCode: string;
  pucAccounts: PucAccount[];
  customers: Customer[];
  vouchers: VoucherRecord[];
}

export const ContabilidadView: React.FC = () => {
  const { apiGet, apiPost, toast, openQuickDialog, dialogVersion } = useProveko();

  const [nextVoucherCode, setNextVoucherCode] = useState('CMP-906');
  const [pucAccounts, setPucAccounts] = useState<PucAccount[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vouchers, setVouchers] = useState<VoucherRecord[]>([]);

  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [thirdPartyId, setThirdPartyId] = useState('');
  const [concept, setConcept] = useState('');
  const [amount, setAmount] = useState('');

  const [pucModalOpen, setPucModalOpen] = useState(false);
  const [pucTargetSide, setPucTargetSide] = useState<'debit' | 'credit'>('debit');
  const [pucCode, setPucCode] = useState('');
  const [pucName, setPucName] = useState('');
  const [pucCategory, setPucCategory] = useState('Activo');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<ContabilidadAllResponse>('/api/v1/contabilidad/all');
      const accList = data.pucAccounts || [];
      const custList = data.customers || [];

      setNextVoucherCode(data.nextVoucherCode || 'CMP-906');
      setPucAccounts(accList);
      setCustomers(custList);
      setVouchers(data.vouchers || []);

      setDebitAccountId((prev) =>
        prev && accList.some((a) => a.id === prev) ? prev : accList[0]?.id || ''
      );
      setCreditAccountId((prev) =>
        prev && accList.some((a) => a.id === prev)
          ? prev
          : accList[1]?.id || accList[0]?.id || ''
      );
      setThirdPartyId((prev) =>
        prev && custList.some((c) => c.id === prev) ? prev : custList[0]?.id || ''
      );
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void reload();
  }, [reload, dialogVersion]);

  const openNewPucDialog = (side: 'debit' | 'credit') => {
    setPucTargetSide(side);
    setPucModalOpen(true);
  };

  const handleSavePuc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pucCode.trim() || !pucName.trim()) {
      toast('Ingresa el código numérico PUC y la denominación de la cuenta.');
      return;
    }
    const res = await apiPost<{ pucAccount: PucAccount }>('/api/v1/contabilidad/puc', {
      code: pucCode,
      name: pucName,
      category: pucCategory,
    });
    toast(`Cuenta PUC ${pucCode} agregada al catálogo`);
    setPucCode('');
    setPucName('');
    setPucModalOpen(false);
    await reload();
    if (res?.pucAccount?.id) {
      if (pucTargetSide === 'debit') {
        setDebitAccountId(res.pucAccount.id);
      } else {
        setCreditAccountId(res.pucAccount.id);
      }
    }
  };

  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount || 0);
    if (!debitAccountId || !creditAccountId || !concept.trim() || numericAmount <= 0) {
      toast('Completa las cuentas Débito/Crédito, concepto y un valor mayor a cero.');
      return;
    }
    if (debitAccountId === creditAccountId) {
      toast('La cuenta Débito y la cuenta Crédito deben ser distintas para partida doble.');
      return;
    }

    await apiPost('/api/v1/contabilidad/vouchers', {
      debitAccountId,
      creditAccountId,
      thirdPartyId,
      concept,
      amount: numericAmount,
    });
    toast('Comprobante contable asentado en partida doble');
    setConcept('');
    setAmount('');
    await reload();
  };

  const buildVoucherPayload = (v: VoucherRecord): PrintDocumentPayload => {
    const val = Number(v.fields?.amount || 0);
    return {
      document_type: 'COMPROBANTE DE CONTABILIDAD (PARTIDA DOBLE)',
      layout_variant: 'carta_membrete',
      document_number: v.id,
      issue_date: v.createdAt,
      customer_name: v.fields?.thirdPartyName || 'Tercero General',
      customer_nit: v.fields?.thirdPartyNit || '',
      payment_method: 'Asiento Contable PUC',
      extra_fields: {
        Concepto: v.fields?.concept || '',
        'Total Débitos': formatCop(val),
        'Total Créditos': formatCop(val),
        Cuadre: 'SUMAS IGUALES ($0 Diferencia)',
      },
      items: [
        {
          code: v.fields?.debitAccountCode || 'DB',
          description: `[DÉBITO] ${v.fields?.debitAccountName || ''} — ${v.fields?.concept || ''}`,
          quantity: 1,
          unit_price: val,
          subtotal: val,
        },
        {
          code: v.fields?.creditAccountCode || 'CR',
          description: `[CRÉDITO] ${v.fields?.creditAccountName || ''} — ${v.fields?.concept || ''}`,
          quantity: 1,
          unit_price: val,
          subtotal: val,
        },
      ],
      subtotal: val,
      grand_total: val,
      notes: 'Comprobante de diario mayorizado conforme al Plan Único de Cuentas (PUC) Colombia.',
    };
  };

  const totalJournalVolume = vouchers.reduce(
    (acc, v) => acc + Number(v.fields?.amount || 0),
    0
  );

  return (
    <ModuleGate module="comprobantes_puc">
      <PkKpiRow
        items={[
          { label: 'Subcuentas PUC Activas', value: String(pucAccounts.length), color: 'var(--pk-primary)' },
          { label: 'Comprobantes Asentados', value: String(vouchers.length), color: 'var(--pk-emerald)' },
          { label: 'Total Débitos = Créditos', value: formatCop(totalJournalVolume), color: '#0f172a' },
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
            ➕ Crear Subcuenta PUC
          </button>
        </div>
        <div className="pk-card-body">
          <form onSubmit={handleCreateVoucher} className="pk-form-grid">
            <PkAutoCodeInput label="Comprobante Contable" value={nextVoucherCode} />
            <PkEntitySelect
              label="Cuenta PUC Débito (Debe) *"
              items={pucAccounts}
              value={debitAccountId}
              onChange={setDebitAccountId}
              getValue={(a) => a.id}
              getLabel={(a) => `${a.name} [${a.category}]`}
              onCreateNew={() => openNewPucDialog('debit')}
              createLabel="+ Nueva Cuenta PUC"
              searchable
            />
            <PkEntitySelect
              label="Cuenta PUC Crédito (Haber) *"
              items={pucAccounts}
              value={creditAccountId}
              onChange={setCreditAccountId}
              getValue={(a) => a.id}
              getLabel={(a) => `${a.name} [${a.category}]`}
              onCreateNew={() => openNewPucDialog('credit')}
              createLabel="+ Nueva Cuenta PUC"
              searchable
            />
            <PkEntitySelect
              label="Tercero Asociado *"
              items={customers}
              value={thirdPartyId}
              onChange={setThirdPartyId}
              getValue={(c) => c.id}
              getLabel={(c) => `${c.name} (${c.nit})`}
              onCreateNew={() => openQuickDialog('nuevo-cliente', () => void reload())}
              createLabel="+ Nuevo Cliente"
              searchable
            />
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
            <div className="pk-field">
              <button type="submit" className="pk-btn pk-btn-primary">
                ⚖️ Contabilizar Asiento
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📋 Libro Diario de Comprobantes PUC ({vouchers.length})</div>
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
                      No se han asentado comprobantes contables manuales aún.
                    </td>
                  </tr>
                ) : (
                  vouchers.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <span className="pk-badge pk-badge-blue">{v.id}</span>
                      </td>
                      <td>{v.createdAt}</td>
                      <td>
                        <span className="pk-badge pk-badge-emerald">{v.fields?.debitAccountCode}</span>{' '}
                        {v.fields?.debitAccountName}
                      </td>
                      <td>
                        <span className="pk-badge pk-badge-amber">{v.fields?.creditAccountCode}</span>{' '}
                        {v.fields?.creditAccountName}
                      </td>
                      <td style={{ fontWeight: 700 }}>{v.fields?.thirdPartyName}</td>
                      <td>{v.fields?.concept}</td>
                      <td style={{ fontWeight: 800, color: '#0f172a' }}>
                        {formatCop(Number(v.fields?.amount || 0))}
                      </td>
                      <td>
                        <PkPrintButton label="🖨️ Comprobante Contable" payload={buildVoucherPayload(v)} />
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
          <div className="pk-card-title">🗂️ Catálogo Plan Único de Cuentas — PUC ({pucAccounts.length})</div>
        </div>
        <div className="pk-card-body">
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Subcuenta PUC</th>
                  <th>Denominación Oficial</th>
                  <th>Naturaleza / Clase</th>
                </tr>
              </thead>
              <tbody>
                {pucAccounts.map((acc) => (
                  <tr key={acc.id}>
                    <td>
                      <strong>{acc.code}</strong>
                    </td>
                    <td>{acc.name}</td>
                    <td>
                      <span className="pk-badge pk-badge-slate">{acc.category}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PkEntityDialog
        open={pucModalOpen}
        title="➕ Agregar Nueva Subcuenta al Catálogo PUC"
        onClose={() => setPucModalOpen(false)}
      >
        <form onSubmit={handleSavePuc} className="pk-form-grid">
          <div className="pk-field">
            <label>Código Subcuenta PUC (6 dígitos) *</label>
            <input
              required
              value={pucCode}
              onChange={(e) => setPucCode(e.target.value)}
              placeholder="Ej: 513530"
            />
          </div>
          <div className="pk-field">
            <label>Nombre de la Cuenta *</label>
            <input
              required
              value={pucName}
              onChange={(e) => setPucName(e.target.value)}
              placeholder="Ej: Energía Eléctrica y Servicios"
            />
          </div>
          <div className="pk-field">
            <label>Clase / Categoría Contable</label>
            <select value={pucCategory} onChange={(e) => setPucCategory(e.target.value)}>
              <option value="Activo">1 — Activo</option>
              <option value="Pasivo">2 — Pasivo</option>
              <option value="Patrimonio">3 — Patrimonio</option>
              <option value="Ingreso">4 — Ingreso</option>
              <option value="Gasto">5 — Gasto</option>
              <option value="Costo">6 — Costo de Ventas</option>
            </select>
          </div>
          <div className="pk-field">
            <button type="submit" className="pk-btn pk-btn-primary">
              💾 Guardar Subcuenta PUC
            </button>
          </div>
        </form>
      </PkEntityDialog>
    </ModuleGate>
  );
};
