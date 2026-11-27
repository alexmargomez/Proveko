import React, { useEffect, useMemo, useState } from 'react';
import {
  ModuleGate,
  PkAutoCodeInput,
  PkFullscreenDialog,
  PkKpiRow,
  PkLiveHeader,
  PkPrintButton,
  PkProcessNodes,
  PkSelect,
  PkSimpleSelect,
  PkTypeCards,
  downloadCsvUtf8,
  formatCop,
  usePlatform,
} from '@platform/ui-sdk';
import {
  AdjustmentNoteRecord,
  InvoiceItemRecord,
  InvoiceRecord,
  buildFourStageNodes,
  resolveDianStage,
} from './FacturacionDianTab';

export interface AdjustmentNoteSubmitPayload {
  editingNoteId?: string;
  saveMode: 'DRAFT' | 'CONFIRM';
  noteKind: 'CREDIT' | 'DEBIT';
  invoiceId: string;
  customerName: string;
  customerNit: string;
  reasonCode: string;
  reasonDescription: string;
  restockInventory: boolean;
  items: InvoiceItemRecord[];
}

const CREDIT_REASONS = [
  {
    value: '1',
    label: '1 — Devolución parcial de bienes o no aceptación de servicio',
  },
  {
    value: '2',
    label: '2 — Anulación total de factura electrónica',
  },
  {
    value: '3',
    label: '3 — Rebaja o descuento comercial posterior',
  },
  {
    value: '4',
    label: '4 — Ajuste de precio unitario facturado',
  },
  {
    value: '5',
    label: '5 — Otros conceptos de ajuste crédito',
  },
];

const DEBIT_REASONS = [
  {
    value: '1',
    label: '1 — Intereses moratorios o financieros causados',
  },
  {
    value: '2',
    label: '2 — Gastos adicionales por cobrar (fletes, seguros)',
  },
  {
    value: '3',
    label: '3 — Mayor valor comercial pactado posterior',
  },
  {
    value: '4',
    label: '4 — Otros conceptos de ajuste débito',
  },
];

function defaultReasonLabel(kind: 'CREDIT' | 'DEBIT', code: string): string {
  const list = kind === 'DEBIT' ? DEBIT_REASONS : CREDIT_REASONS;
  const match = list.find((r) => r.value === code);
  if (!match) return '';
  return match.label.replace(/^\d+\s*—\s*/, '');
}

export interface AdjustmentNoteStudioDialogProps {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  invoices: InvoiceRecord[];
  nextCreditNoteNumber: string;
  nextDebitNoteNumber: string;
  preselectedInvoiceId?: string;
  editingNote?: AdjustmentNoteRecord | null;
  onSubmit: (payload: AdjustmentNoteSubmitPayload) => void;
}

export const AdjustmentNoteStudioDialog: React.FC<
  AdjustmentNoteStudioDialogProps
> = ({
  open,
  onClose,
  busy,
  invoices,
  nextCreditNoteNumber,
  nextDebitNoteNumber,
  preselectedInvoiceId,
  editingNote,
  onSubmit,
}) => {
  const { toast, hasService } = usePlatform();
  const hasInventario = hasService('ms-inventario');

  const eligibleInvoices = useMemo(
    () =>
      invoices.filter(
        (inv) =>
          (inv.docStatus || 'CONFIRMADA') === 'CONFIRMADA' ||
          inv.id === editingNote?.invoiceId
      ),
    [invoices, editingNote]
  );

  const [noteKind, setNoteKind] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [invoiceId, setInvoiceId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerNit, setCustomerNit] = useState('');
  const [reasonCode, setReasonCode] = useState('1');
  const [reasonDescription, setReasonDescription] = useState(
    defaultReasonLabel('CREDIT', '1')
  );
  const [restockInventory, setRestockInventory] = useState(true);
  const [items, setItems] = useState<InvoiceItemRecord[]>([]);

  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('35000');
  const [newTaxPct, setNewTaxPct] = useState('19');

  useEffect(() => {
    if (!open) return;

    if (editingNote) {
      setNoteKind(editingNote.noteKind);
      setInvoiceId(editingNote.invoiceId);
      setCustomerName(editingNote.customerName);
      setCustomerNit(editingNote.customerNit);
      setReasonCode(editingNote.reasonCode || '1');
      setReasonDescription(editingNote.reasonDescription || '');
      setRestockInventory(Boolean(editingNote.restockInventory));
      setItems((editingNote.items || []).map((it) => ({ ...it })));
      return;
    }

    const initialInv =
      eligibleInvoices.find((iv) => iv.id === preselectedInvoiceId) ||
      eligibleInvoices[0];

    setNoteKind('CREDIT');
    setReasonCode('1');
    setReasonDescription(defaultReasonLabel('CREDIT', '1'));
    setRestockInventory(true);

    if (initialInv) {
      setInvoiceId(initialInv.id);
      setCustomerName(initialInv.customerName);
      setCustomerNit(initialInv.customerNit);
      setItems((initialInv.items || []).map((it) => ({ ...it })));
    } else {
      setInvoiceId('');
      setCustomerName('');
      setCustomerNit('');
      setItems([]);
    }
  }, [open, editingNote, preselectedInvoiceId, eligibleInvoices]);

  const selectedInvoice = eligibleInvoices.find((iv) => iv.id === invoiceId);
  const isConfirmedEdit =
    Boolean(editingNote) && editingNote?.docStatus === 'CONFIRMADA';
  const editingStage = editingNote
    ? resolveDianStage(editingNote.dianStage, editingNote.cude)
    : 'SIN_ENVIAR';

  const handleSelectInvoice = (nextId: string) => {
    setInvoiceId(nextId);
    const inv = eligibleInvoices.find((iv) => iv.id === nextId);
    if (inv) {
      setCustomerName(inv.customerName);
      setCustomerNit(inv.customerNit);
      if (noteKind === 'CREDIT') {
        setItems((inv.items || []).map((it) => ({ ...it })));
      }
    }
  };

  const handleChangeKind = (nextKind: 'CREDIT' | 'DEBIT') => {
    setNoteKind(nextKind);
    setReasonCode('1');
    setReasonDescription(defaultReasonLabel(nextKind, '1'));
    if (nextKind === 'DEBIT') {
      setRestockInventory(false);
      if (!editingNote) {
        setItems([
          {
            productId: '',
            code: 'AJ-ND',
            description: 'Cargo adicional sobre factura comercial',
            itemType: 'SERVICIO',
            quantity: 1,
            unitPrice: 50000,
            taxPct: 19,
            subtotal: 50000,
          },
        ]);
      }
    } else if (selectedInvoice && !editingNote) {
      setRestockInventory(true);
      setItems((selectedInvoice.items || []).map((it) => ({ ...it })));
    }
  };

  const updateItem = (idx: number, patch: Partial<InvoiceItemRecord>) => {
    setItems((prev) => {
      const copy = [...prev];
      const next = { ...copy[idx], ...patch };
      if (next.quantity <= 0) {
        copy.splice(idx, 1);
      } else {
        next.subtotal = Math.round(next.quantity * next.unitPrice);
        copy[idx] = next;
      }
      return copy;
    });
  };

  const addCustomConcept = (e: React.FormEvent) => {
    e.preventDefault();
    const desc = newDesc.trim();
    const price = Number(newPrice || 0);
    const tax = Math.max(0, Math.min(100, Number(newTaxPct || 0)));
    if (!desc || price <= 0) {
      toast('Ingresa descripción y valor mayor a cero para el concepto de ajuste');
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        productId: '',
        code: noteKind === 'DEBIT' ? 'AJ-ND' : 'AJ-NC',
        description: desc,
        itemType: 'SERVICIO',
        quantity: 1,
        unitPrice: price,
        taxPct: tax,
        subtotal: Math.round(price),
      },
    ]);
    setNewDesc('');
  };

  const subtotal = items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);
  const taxTotal = Math.round(
    items.reduce(
      (acc, it) => acc + it.quantity * it.unitPrice * (it.taxPct / 100),
      0
    )
  );
  const grandTotal = Math.round(subtotal + taxTotal);

  const nextOfficialCode = editingNote
    ? editingNote.id
    : noteKind === 'DEBIT'
    ? nextDebitNoteNumber
    : nextCreditNoteNumber;

  const submit = (saveMode: 'DRAFT' | 'CONFIRM') => {
    if (!invoiceId) {
      toast('Selecciona una factura confirmada de referencia');
      return;
    }
    if (items.length === 0) {
      toast('Agrega al menos un concepto o ítem en la nota');
      return;
    }
    onSubmit({
      editingNoteId: editingNote?.id,
      saveMode,
      noteKind,
      invoiceId,
      customerName: customerName.trim(),
      customerNit: customerNit.trim(),
      reasonCode,
      reasonDescription:
        reasonDescription.trim() || defaultReasonLabel(noteKind, reasonCode),
      restockInventory: noteKind === 'CREDIT' && restockInventory,
      items,
    });
  };

  const steps = editingNote
    ? buildFourStageNodes(
        editingNote.docStatus,
        editingNote.dianStage,
        editingNote.cude,
        'CUDE'
      )
    : buildFourStageNodes('BORRADOR', 'SIN_ENVIAR', '', 'CUDE');

  return (
    <PkFullscreenDialog
      open={open}
      onClose={onClose}
      title={
        editingNote
          ? `✏️ Editar Nota ${editingNote.id}`
          : '↩️ Estudio Electrónico de Notas Crédito y Notas Débito'
      }
      subtitle="Referencia una factura comercial confirmada, selecciona la causal DIAN y define el impacto en inventario, cartera CxC y firma CUDE."
      badge={{
        label: `Consecutivo: ${nextOfficialCode}`,
        tone:
          editingStage === 'RECHAZADA'
            ? 'rose'
            : noteKind === 'DEBIT'
            ? 'blue'
            : 'amber',
      }}
      subheader={
        <div className="pk-stack" style={{ gap: 12 }}>
          <div
            style={{
              padding: '8px 14px',
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid var(--pk-border)',
            }}
          >
            <PkProcessNodes steps={steps} compact />
          </div>
          <PkTypeCards
            label="Naturaleza Contable y Fiscal del Documento de Ajuste"
            disabled={isConfirmedEdit}
            value={noteKind}
            onChange={(v) => handleChangeKind(v as 'CREDIT' | 'DEBIT')}
            options={[
              {
                key: 'CREDIT',
                icon: '↩️',
                title: 'Nota Crédito Electrónica (NC)',
                description:
                  'Disminuye saldo CxC / valor facturado y permite reingresar unidades devueltas a inventario.',
                badge: nextCreditNoteNumber,
              },
              {
                key: 'DEBIT',
                icon: '📈',
                title: 'Nota Débito Electrónica (ND)',
                description:
                  'Incrementa el valor comercial exigible por intereses, fletes o ajustes posteriores.',
                badge: nextDebitNoteNumber,
              },
            ]}
          />
        </div>
      }
      footerLeft={
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', fontWeight: 700 }}>
            IMPACTO TOTAL DE LA NOTA ({noteKind === 'CREDIT' ? 'CRÉDITO' : 'DÉBITO'})
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--pk-navy)' }}>
            {formatCop(grandTotal)}
          </div>
        </div>
      }
      footerActions={
        <>
          <button
            type="button"
            className="pk-btn pk-btn-outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          {!isConfirmedEdit && (
            <button
              type="button"
              className="pk-btn pk-btn-amber"
              disabled={busy}
              onClick={() => submit('DRAFT')}
            >
              💾 Guardar Borrador
            </button>
          )}
          <button
            type="button"
            className="pk-btn pk-btn-primary"
            disabled={busy}
            onClick={() => submit('CONFIRM')}
          >
            {isConfirmedEdit
              ? '💾 Guardar Corrección Fiscal'
              : `✅ Confirmar ${noteKind === 'DEBIT' ? 'Nota Débito' : 'Nota Crédito'}`}
          </button>
        </>
      }
    >
      <div className="pk-grid-2" style={{ alignItems: 'start' }}>
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">
              🔗 Factura Origen, Causal DIAN e Inventario
            </div>
          </div>
          <div className="pk-card-body pk-stack">
            <div className="pk-form-grid cols-2">
              <PkAutoCodeInput
                label="Consecutivo Nota"
                value={nextOfficialCode}
              />
              <PkSelect
                label="Factura Comercial Referenciada"
                disabled={isConfirmedEdit}
                items={eligibleInvoices}
                value={invoiceId}
                onChange={handleSelectInvoice}
                getValue={(iv) => iv.id}
                getLabel={(iv) =>
                  `${iv.id} — ${iv.customerName} (${formatCop(iv.total)})`
                }
                searchable
              />
              <div className="pk-field">
                <label>Adquiriente / Razón Social</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="pk-field">
                <label>NIT Tributario</label>
                <input
                  value={customerNit}
                  onChange={(e) => setCustomerNit(e.target.value)}
                />
              </div>
            </div>

            {selectedInvoice && (
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid var(--pk-border)',
                  fontSize: 12.5,
                }}
              >
                <div>
                  <strong>Factura Base:</strong> {selectedInvoice.id} • Total:{' '}
                  <strong>{formatCop(selectedInvoice.total)}</strong> • Saldo CxC:{' '}
                  <strong>{formatCop(selectedInvoice.pendingBalance)}</strong>
                </div>
                {selectedInvoice.cufe && (
                  <div
                    style={{
                      fontSize: 10.5,
                      color: '#065f46',
                      fontFamily: 'monospace',
                      marginTop: 4,
                      wordBreak: 'break-all',
                    }}
                  >
                    CUFE Referenciado: {selectedInvoice.cufe}
                  </div>
                )}
              </div>
            )}

            <PkSimpleSelect
              label="Código Concepto Estándar DIAN"
              value={reasonCode}
              onChange={(code) => {
                setReasonCode(code);
                setReasonDescription(defaultReasonLabel(noteKind, code));
                if (noteKind === 'CREDIT' && code === '2' && selectedInvoice) {
                  setItems((selectedInvoice.items || []).map((it) => ({ ...it })));
                }
              }}
              searchable={false}
              options={noteKind === 'DEBIT' ? DEBIT_REASONS : CREDIT_REASONS}
            />

            <div className="pk-field">
              <label>Sustento Detallado del Ajuste</label>
              <input
                value={reasonDescription}
                onChange={(e) => setReasonDescription(e.target.value)}
                placeholder="Describe el motivo comercial o técnico..."
              />
            </div>

            {noteKind === 'CREDIT' && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: restockInventory ? '#ecfdf5' : '#f8fafc',
                  border: `1px solid ${restockInventory ? '#6ee7b7' : '#cbd5e1'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <strong style={{ fontSize: 13, color: 'var(--pk-navy)' }}>
                    📦 Reingresar unidades al inventario de bodega
                  </strong>
                  <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>
                    {hasInventario
                      ? 'Al confirmar la Nota Crédito se generará entrada automática de stock para los productos devueltos.'
                      : 'Se registrará la marca logística de devolución de mercancía.'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={isConfirmedEdit}
                  checked={restockInventory}
                  onChange={(e) => setRestockInventory(e.target.checked)}
                  style={{ width: 20, height: 20 }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">
              📋 Conceptos e Ítems Objeto de Ajuste
            </div>
            {noteKind === 'CREDIT' && selectedInvoice && !isConfirmedEdit && (
              <button
                type="button"
                className="pk-btn pk-btn-outline pk-btn-sm"
                onClick={() =>
                  setItems((selectedInvoice.items || []).map((it) => ({ ...it })))
                }
              >
                🔄 Cargar Ítems de {selectedInvoice.id}
              </button>
            )}
          </div>
          <div className="pk-card-body pk-stack">
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th>Cant.</th>
                    <th>Vr. Unitario</th>
                    <th>Subtotal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={`${it.code}-${idx}`}>
                      <td>
                        <strong>{it.description}</strong>
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                          {it.code} • IVA {it.taxPct}%
                          {it.productId ? ' • Producto Catálogo' : ''}
                        </div>
                      </td>
                      <td style={{ width: 84 }}>
                        <input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) =>
                            updateItem(idx, {
                              quantity: Number(e.target.value || 1),
                            })
                          }
                          style={{
                            width: 68,
                            padding: '6px 8px',
                            borderRadius: 8,
                            border: '1px solid var(--pk-border-strong)',
                          }}
                        />
                      </td>
                      <td style={{ width: 124 }}>
                        <input
                          type="number"
                          min={1}
                          value={it.unitPrice}
                          onChange={(e) =>
                            updateItem(idx, {
                              unitPrice: Number(e.target.value || 0),
                            })
                          }
                          style={{
                            width: 108,
                            padding: '6px 8px',
                            borderRadius: 8,
                            border: '1px solid var(--pk-border-strong)',
                          }}
                        />
                      </td>
                      <td>
                        <strong>{formatCop(it.quantity * it.unitPrice)}</strong>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pk-btn pk-btn-danger pk-btn-sm"
                          onClick={() => updateItem(idx, { quantity: 0 })}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: 'center',
                          color: 'var(--pk-muted)',
                          padding: 20,
                        }}
                      >
                        Agrega un concepto o carga los ítems de la factura.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <form
              onSubmit={addCustomConcept}
              style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14 }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  color: 'var(--pk-navy)',
                  marginBottom: 10,
                }}
              >
                ➕ Agregar Línea de Ajuste Libre
              </div>
              <div className="pk-form-grid cols-2">
                <div className="pk-field pk-col-span-full">
                  <label>Descripción del Concepto</label>
                  <input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Ej: Descuento pronto pago / Recargo flete"
                  />
                </div>
                <div className="pk-field">
                  <label>Valor ($)</label>
                  <input
                    type="number"
                    min={1}
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                  />
                </div>
                <PkSimpleSelect
                  label="IVA (%)"
                  value={newTaxPct}
                  onChange={setNewTaxPct}
                  searchable={false}
                  options={[
                    { value: '0', label: '0% — Sin IVA' },
                    { value: '5', label: '5% — Reducido' },
                    { value: '19', label: '19% — General' },
                  ]}
                />
                <div className="pk-form-actions pk-col-span-full">
                  <button type="submit" className="pk-btn pk-btn-outline pk-btn-sm">
                    + Añadir Línea a la Nota
                  </button>
                </div>
              </div>
            </form>

            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: '#f8fafc',
                border: '1px solid var(--pk-border)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                }}
              >
                <span>Subtotal Base:</span>
                <strong>{formatCop(subtotal)}</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                <span>IVA Ajuste:</span>
                <strong>{formatCop(taxTotal)}</strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 17,
                  fontWeight: 900,
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px solid #cbd5e1',
                  color: 'var(--pk-primary)',
                }}
              >
                <span>TOTAL NOTA:</span>
                <span>{formatCop(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PkFullscreenDialog>
  );
};

export interface AdjustmentNotesTabProps {
  notes: AdjustmentNoteRecord[];
  invoices: InvoiceRecord[];
  nextCreditNoteNumber: string;
  nextDebitNoteNumber: string;
  busy: boolean;
  onOpenCreateNote: (invoiceId?: string) => void;
  onEditNote: (note: AdjustmentNoteRecord) => void;
  onConfirmNote: (noteId: string) => void;
  onSendNoteToDian: (note: AdjustmentNoteRecord) => void;
  buildNotePrintPayload: (note: AdjustmentNoteRecord) => Record<string, unknown>;
}

export const AdjustmentNotesTab: React.FC<AdjustmentNotesTabProps> = ({
  notes,
  busy,
  onOpenCreateNote,
  onEditNote,
  onConfirmNote,
  onSendNoteToDian,
  buildNotePrintPayload,
}) => {
  const { hasModule } = usePlatform();
  const hasDian = hasModule('facturacion_dian');

  const [activePill, setActivePill] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const creditNotes = notes.filter(
    (n) => n.noteKind === 'CREDIT' && n.docStatus === 'CONFIRMADA'
  );
  const debitNotes = notes.filter(
    (n) => n.noteKind === 'DEBIT' && n.docStatus === 'CONFIRMADA'
  );
  const draftsCount = notes.filter((n) => n.docStatus === 'BORRADOR').length;
  const totalCredited = creditNotes.reduce((acc, n) => acc + n.total, 0);
  const totalDebited = debitNotes.reduce((acc, n) => acc + n.total, 0);

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (activePill === 'CREDIT' && n.noteKind !== 'CREDIT') return false;
      if (activePill === 'DEBIT' && n.noteKind !== 'DEBIT') return false;
      if (activePill === 'BORRADOR' && n.docStatus !== 'BORRADOR') return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        n.id.toLowerCase().includes(q) ||
        n.invoiceId.toLowerCase().includes(q) ||
        n.customerName.toLowerCase().includes(q) ||
        (n.customerNit || '').toLowerCase().includes(q)
      );
    });
  }, [notes, activePill, search]);

  return (
    <ModuleGate module="notas_ajuste">
      <div className="pk-stack">
        <PkKpiRow
          items={[
            {
              label: 'Notas Crédito Confirmadas (NC)',
              value: String(creditNotes.length),
              color: 'var(--pk-amber)',
            },
            {
              label: 'Valor Total Acreditado',
              value: formatCop(totalCredited),
              color: 'var(--pk-rose)',
            },
            {
              label: 'Notas Débito Confirmadas (ND)',
              value: String(debitNotes.length),
              color: 'var(--pk-primary)',
            },
            {
              label: 'Valor Total Debitado',
              value: formatCop(totalDebited),
              color: 'var(--pk-emerald)',
            },
          ]}
        />

        <PkLiveHeader
          title="Notas Crédito y Notas Débito"
          liveLabel="En línea"
          subtitle="Gestiona devoluciones, anulaciones, descuentos posteriores y notas de cargo vinculadas a facturas electrónicas con firma CUDE."
          pills={[
            { key: 'ALL', label: 'Todas', count: notes.length },
            {
              key: 'CREDIT',
              label: 'Notas Crédito (NC)',
              count: notes.filter((n) => n.noteKind === 'CREDIT').length,
            },
            {
              key: 'DEBIT',
              label: 'Notas Débito (ND)',
              count: notes.filter((n) => n.noteKind === 'DEBIT').length,
            },
            {
              key: 'BORRADOR',
              label: 'Borradores',
              count: draftsCount,
            },
          ]}
          activePill={activePill}
          onPillChange={setActivePill}
          primaryActionLabel="+ Emitir Nota Crédito / Débito"
          onPrimaryAction={() => onOpenCreateNote()}
          extraActions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="pk-input"
                style={{ minWidth: 210, minHeight: 38 }}
                placeholder="🔎 Buscar NC, ND o factura..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="button"
                className="pk-btn pk-btn-outline pk-btn-sm"
                onClick={() =>
                  downloadCsvUtf8(
                    'notas_credito_debito.csv',
                    [
                      'Nota',
                      'Tipo',
                      'FacturaRef',
                      'Cliente',
                      'NIT',
                      'Motivo',
                      'Total',
                      'Estado',
                      'EtapaDIAN',
                      'CUDE',
                    ],
                    notes.map((n) => [
                      n.id,
                      n.noteKind,
                      n.invoiceId,
                      n.customerName,
                      n.customerNit,
                      n.reasonDescription,
                      n.total,
                      n.docStatus,
                      resolveDianStage(n.dianStage, n.cude),
                      n.cude || '',
                    ])
                  )
                }
              >
                📥 CSV
              </button>
            </div>
          }
        />

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">
              📋 Registro General de Notas Crédito y Notas Débito
            </div>
            <span className="pk-badge pk-badge-blue">
              {filtered.length} notas
            </span>
          </div>
          <div className="pk-card-body">
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>N° Nota</th>
                    <th>Tipo</th>
                    <th>Factura Origen</th>
                    <th>Adquiriente</th>
                    <th>Causal DIAN</th>
                    <th>Total</th>
                    <th>Progreso 4 Etapas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((n) => {
                    const st = resolveDianStage(n.dianStage, n.cude);
                    const isEditable =
                      n.editable ??
                      (n.docStatus === 'BORRADOR' ||
                        (st !== 'ENVIADA' && st !== 'ACEPTADA'));
                    return (
                      <tr key={n.id}>
                        <td>
                          <strong>{n.id}</strong>
                          <div
                            style={{ fontSize: 11, color: 'var(--pk-muted)' }}
                          >
                            {n.issueDate}
                          </div>
                        </td>
                        <td>
                          <span
                            className={`pk-badge ${
                              n.noteKind === 'DEBIT'
                                ? 'pk-badge-blue'
                                : 'pk-badge-amber'
                            }`}
                          >
                            {n.noteKind === 'DEBIT'
                              ? 'Nota Débito'
                              : 'Nota Crédito'}
                          </span>
                        </td>
                        <td>
                          <strong>{n.invoiceId}</strong>
                        </td>
                        <td>
                          <strong>{n.customerName}</strong>
                          <div
                            style={{ fontSize: 11, color: 'var(--pk-muted)' }}
                          >
                            {n.customerNit}
                          </div>
                        </td>
                        <td style={{ maxWidth: 220, fontSize: 12 }}>
                          {n.reasonDescription}
                        </td>
                        <td>
                          <strong>{formatCop(n.total)}</strong>
                        </td>
                        <td style={{ minWidth: 240 }}>
                          <PkProcessNodes
                            compact
                            steps={buildFourStageNodes(
                              n.docStatus,
                              n.dianStage,
                              n.cude,
                              'CUDE'
                            )}
                          />
                        </td>
                        <td>
                          <div className="pk-row-actions">
                            {n.docStatus === 'BORRADOR' && (
                              <button
                                type="button"
                                className="pk-btn pk-btn-emerald pk-btn-sm"
                                disabled={busy}
                                onClick={() => onConfirmNote(n.id)}
                              >
                                ✅ Confirmar
                              </button>
                            )}
                            {isEditable && (
                              <button
                                type="button"
                                className="pk-btn pk-btn-outline pk-btn-sm"
                                onClick={() => onEditNote(n)}
                              >
                                ✏️ Editar
                              </button>
                            )}
                            {n.docStatus === 'CONFIRMADA' &&
                              st === 'SIN_ENVIAR' &&
                              hasDian && (
                                <button
                                  type="button"
                                  className="pk-btn pk-btn-primary pk-btn-sm"
                                  disabled={busy}
                                  onClick={() => onSendNoteToDian(n)}
                                >
                                  🚀 DIAN
                                </button>
                              )}
                            <PkPrintButton
                              label="🖨️ PDF"
                              payload={buildNotePrintPayload(n)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          textAlign: 'center',
                          color: 'var(--pk-muted)',
                          padding: 28,
                        }}
                      >
                        No hay notas crédito o débito registradas para el filtro actual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ModuleGate>
  );
};
