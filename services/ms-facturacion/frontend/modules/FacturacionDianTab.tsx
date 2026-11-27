import React, { useMemo, useState } from 'react';
import {
  ModuleGate,
  PkDistributionStrip,
  PkKanbanBoard,
  PkKpiRow,
  PkLiveHeader,
  PkModal,
  PkPrintButton,
  PkProcessNodes,
  PkProcessStep,
  PkSimpleSelect,
  PkTicketCard,
  downloadCsvUtf8,
  formatCop,
} from '@platform/ui-sdk';

export type InvoiceTypeKey =
  | 'MOSTRADOR'
  | 'TALLER'
  | 'HOTELERIA'
  | 'COMANDA'
  | 'CORPORATIVA_CXC';

export type DianStageKey = 'SIN_ENVIAR' | 'ENVIADA' | 'ACEPTADA' | 'RECHAZADA';

export interface InvoiceItemRecord {
  productId: string;
  code: string;
  description: string;
  itemType: 'PRODUCTO' | 'SERVICIO';
  quantity: number;
  unitPrice: number;
  taxPct: number;
  subtotal: number;
  workerId?: string;
  workerName?: string;
}

export interface WorkshopMetadataRecord {
  vehicleBrand?: string;
  currentKm?: string;
  nextOilKm?: string;
  workOrderId?: string;
}

export interface InvoiceRecord {
  id: string;
  number?: string;
  invoiceType?: InvoiceTypeKey | string;
  docStatus?: 'BORRADOR' | 'CONFIRMADA' | 'ANULADA_NC' | string;
  issueDate: string;
  date?: string;
  dueDate?: string;
  purchaseOrderRef?: string;
  customerId: string;
  customerName: string;
  customerNit: string;
  customerPhone?: string;
  customerAddress?: string;
  contractId?: string;
  discountPct: number;
  vehicleId?: string;
  plate?: string;
  mechanicId?: string;
  mechanicName?: string;
  workshopMeta?: WorkshopMetadataRecord;
  linkedRoomId?: string;
  linkedTableId?: string;
  layoutVariant?: string;
  cufe?: string;
  dianStatus?: string;
  dianStage?: DianStageKey | string;
  trackId?: string;
  dianSentAt?: string;
  dianRespondedAt?: string;
  rejectionCode?: string;
  rejectionMessage?: string;
  dianAttempts?: number;
  editable?: boolean;
  items: InvoiceItemRecord[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  creditedTotal?: number;
  debitedTotal?: number;
  paymentMethod: string;
  amountPaid: number;
  pendingBalance: number;
  status: string;
  notes?: string;
  actor?: string;
}

export interface AdjustmentNoteRecord {
  id: string;
  number?: string;
  noteKind: 'CREDIT' | 'DEBIT';
  invoiceId: string;
  referencedCufe?: string;
  customerId: string;
  customerName: string;
  customerNit: string;
  reasonCode: string;
  reasonDescription: string;
  restockInventory: boolean;
  docStatus: 'BORRADOR' | 'CONFIRMADA' | string;
  cude?: string;
  dianStage?: DianStageKey | string;
  dianStatus?: string;
  trackId?: string;
  dianSentAt?: string;
  dianRespondedAt?: string;
  rejectionCode?: string;
  rejectionMessage?: string;
  dianAttempts?: number;
  editable?: boolean;
  items: InvoiceItemRecord[];
  subtotal: number;
  taxTotal: number;
  total: number;
  issueDate: string;
  actor?: string;
}

export interface DianTransmissionRecord {
  documentKind: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  documentId: string;
  dianStage: DianStageKey | string;
  cufeOrCude?: string;
  referencedCufe?: string;
  trackId?: string;
  environment?: string;
  sentAt?: string;
  respondedAt?: string;
  rejectionCode?: string;
  rejectionMessage?: string;
  attempts?: number;
}

export function resolveDianStage(
  rawStage?: string,
  cufeOrCude?: string
): DianStageKey {
  const clean = (rawStage || '').trim().toUpperCase();
  if (
    clean === 'ENVIADA' ||
    clean === 'ACEPTADA' ||
    clean === 'RECHAZADA' ||
    clean === 'SIN_ENVIAR'
  ) {
    return clean;
  }
  return cufeOrCude && cufeOrCude.trim() !== '' ? 'ACEPTADA' : 'SIN_ENVIAR';
}

export function buildFourStageNodes(
  docStatus?: string,
  dianStageRaw?: string,
  cufeOrCude?: string,
  hashLabel = 'CUFE'
): PkProcessStep[] {
  const status = (docStatus || 'CONFIRMADA').toUpperCase();
  const stage = resolveDianStage(dianStageRaw, cufeOrCude);

  if (status === 'BORRADOR') {
    return [
      { step: 1, label: 'Borrador', sublabel: 'Editable', status: 'active' },
      { step: 2, label: 'Confirmada', status: 'pending' },
      { step: 3, label: 'Envío DIAN', status: 'pending' },
      { step: 4, label: hashLabel, status: 'pending' },
    ];
  }

  if (stage === 'SIN_ENVIAR') {
    return [
      { step: 1, label: 'Borrador', status: 'done' },
      { step: 2, label: 'Confirmada', sublabel: 'Lista DIAN', status: 'done' },
      { step: 3, label: 'Envío DIAN', sublabel: 'Pendiente', status: 'active' },
      { step: 4, label: hashLabel, status: 'pending' },
    ];
  }

  if (stage === 'ENVIADA') {
    return [
      { step: 1, label: 'Borrador', status: 'done' },
      { step: 2, label: 'Confirmada', status: 'done' },
      { step: 3, label: 'Envío DIAN', sublabel: 'Transmitida', status: 'done' },
      { step: 4, label: hashLabel, sublabel: 'Validando', status: 'active' },
    ];
  }

  if (stage === 'RECHAZADA') {
    return [
      { step: 1, label: 'Borrador', status: 'done' },
      { step: 2, label: 'Confirmada', status: 'done' },
      { step: 3, label: 'Envío DIAN', status: 'done' },
      { step: 4, label: hashLabel, sublabel: 'Rechazada', status: 'error' },
    ];
  }

  return [
    { step: 1, label: 'Borrador', status: 'done' },
    { step: 2, label: 'Confirmada', status: 'done' },
    { step: 3, label: 'Envío DIAN', status: 'done' },
    { step: 4, label: hashLabel, sublabel: 'Validada', status: 'done' },
  ];
}

export function buildDianTwoStepNodes(
  stage: DianStageKey,
  trackId?: string,
  rejectionCode?: string,
  hashType: 'CUFE' | 'CUDE' = 'CUFE'
): PkProcessStep[] {
  if (stage === 'SIN_ENVIAR') {
    return [
      {
        step: 1,
        label: 'Paso 1 · Envío DIAN',
        sublabel: 'Sin transmitir',
        status: 'active',
      },
      {
        step: 2,
        label: `Paso 2 · ${hashType}`,
        sublabel: 'En espera',
        status: 'pending',
      },
    ];
  }
  if (stage === 'ENVIADA') {
    return [
      {
        step: 1,
        label: 'Paso 1 · Envío DIAN',
        sublabel: trackId || 'XML enviado',
        status: 'done',
      },
      {
        step: 2,
        label: `Paso 2 · ${hashType}`,
        sublabel: 'Esperando acuse',
        status: 'active',
      },
    ];
  }
  if (stage === 'RECHAZADA') {
    return [
      {
        step: 1,
        label: 'Paso 1 · Envío DIAN',
        sublabel: trackId || 'Transmitido',
        status: 'done',
      },
      {
        step: 2,
        label: `Paso 2 · ${hashType}`,
        sublabel: rejectionCode || 'Subsanar',
        status: 'error',
      },
    ];
  }
  return [
    {
      step: 1,
      label: 'Paso 1 · Envío DIAN',
      sublabel: trackId || 'Transmitido',
      status: 'done',
    },
    {
      step: 2,
      label: `Paso 2 · ${hashType}`,
      sublabel: `${hashType} firmado`,
      status: 'done',
    },
  ];
}

interface UnifiedFiscalDocument {
  key: string;
  documentKind: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  id: string;
  issueDate: string;
  customerName: string;
  customerNit: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  dianStage: DianStageKey;
  hashValue: string;
  hashType: 'CUFE' | 'CUDE';
  referencedId?: string;
  trackId?: string;
  rejectionCode?: string;
  rejectionMessage?: string;
  attempts: number;
  editable: boolean;
  items: InvoiceItemRecord[];
  rawInvoice?: InvoiceRecord;
  rawNote?: AdjustmentNoteRecord;
}

export interface FacturacionDianTabProps {
  invoices: InvoiceRecord[];
  adjustmentNotes?: AdjustmentNoteRecord[];
  busy?: boolean;
  onSendToDian: (
    documentKind: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE',
    documentId: string
  ) => void;
  onRespondDian: (
    documentKind: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE',
    documentId: string,
    outcome: 'ACCEPTED' | 'REJECTED',
    rejectionCode?: string,
    rejectionMessage?: string
  ) => void;
  onEditInvoice?: (inv: InvoiceRecord) => void;
  onEditNote?: (note: AdjustmentNoteRecord) => void;
  onOpenNoteFromInvoice?: (inv: InvoiceRecord) => void;
  buildPrintPayload: (inv: InvoiceRecord) => Record<string, unknown>;
  buildNotePrintPayload?: (note: AdjustmentNoteRecord) => Record<string, unknown>;
}

const REJECTION_RULE_OPTIONS = [
  {
    value: 'DIAN-RUT-04',
    label: 'DIAN-RUT-04 — Inconsistencia en NIT o dígito de verificación',
  },
  {
    value: 'DIAN-FAD-09',
    label: 'DIAN-FAD-09 — Razón social o dirección fiscal incompleta',
  },
  {
    value: 'DIAN-TAX-12',
    label: 'DIAN-TAX-12 — Diferencia aritmética en base gravable de IVA',
  },
];

const REJECTION_MESSAGES: Record<string, string> = {
  'DIAN-RUT-04':
    'Inconsistencia en datos tributarios o NIT del adquiriente frente al RUT',
  'DIAN-FAD-09':
    'Falta completar razón social exacta o dirección fiscal del adquiriente',
  'DIAN-TAX-12':
    'Discrepancia en tarifa o base gravable del impuesto sobre las ventas',
};

export const FacturacionDianTab: React.FC<FacturacionDianTabProps> = ({
  invoices,
  adjustmentNotes = [],
  busy = false,
  onSendToDian,
  onRespondDian,
  onEditInvoice,
  onEditNote,
  onOpenNoteFromInvoice,
  buildPrintPayload,
  buildNotePrintPayload,
}) => {
  const [displayMode, setDisplayMode] = useState<'board' | 'table'>('board');
  const [activePill, setActivePill] = useState<string>('ALL');
  const [dianSearch, setDianSearch] = useState('');

  const [rejectTarget, setRejectTarget] = useState<{
    documentKind: 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
    documentId: string;
    customerName: string;
  } | null>(null);
  const [rejectRuleCode, setRejectRuleCode] = useState('DIAN-RUT-04');
  const [rejectCustomMsg, setRejectCustomMsg] = useState(
    REJECTION_MESSAGES['DIAN-RUT-04']
  );

  const fiscalDocs = useMemo<UnifiedFiscalDocument[]>(() => {
    const out: UnifiedFiscalDocument[] = [];

    for (const inv of invoices) {
      if ((inv.docStatus || 'CONFIRMADA') === 'BORRADOR') continue;
      const stage = resolveDianStage(inv.dianStage, inv.cufe);
      out.push({
        key: `INVOICE::${inv.id}`,
        documentKind: 'INVOICE',
        id: inv.id,
        issueDate: inv.issueDate || inv.date || '',
        customerName: inv.customerName,
        customerNit: inv.customerNit,
        subtotal: inv.subtotal,
        taxTotal: inv.taxTotal,
        total: inv.total,
        dianStage: stage,
        hashValue: inv.cufe || '',
        hashType: 'CUFE',
        trackId: inv.trackId,
        rejectionCode: inv.rejectionCode,
        rejectionMessage: inv.rejectionMessage,
        attempts: inv.dianAttempts || (inv.cufe ? 1 : 0),
        editable:
          inv.editable ??
          (inv.docStatus !== 'ANULADA_NC' &&
            stage !== 'ENVIADA' &&
            stage !== 'ACEPTADA'),
        items: inv.items || [],
        rawInvoice: inv,
      });
    }

    for (const note of adjustmentNotes) {
      if ((note.docStatus || 'CONFIRMADA') === 'BORRADOR') continue;
      const docKind =
        note.noteKind === 'DEBIT' ? 'DEBIT_NOTE' : 'CREDIT_NOTE';
      const stage = resolveDianStage(note.dianStage, note.cude);
      out.push({
        key: `${docKind}::${note.id}`,
        documentKind: docKind,
        id: note.id,
        issueDate: note.issueDate,
        customerName: note.customerName,
        customerNit: note.customerNit,
        subtotal: note.subtotal,
        taxTotal: note.taxTotal,
        total: note.total,
        dianStage: stage,
        hashValue: note.cude || '',
        hashType: 'CUDE',
        referencedId: note.invoiceId,
        trackId: note.trackId,
        rejectionCode: note.rejectionCode,
        rejectionMessage: note.rejectionMessage,
        attempts: note.dianAttempts || (note.cude ? 1 : 0),
        editable:
          note.editable ?? (stage !== 'ENVIADA' && stage !== 'ACEPTADA'),
        items: note.items || [],
        rawNote: note,
      });
    }

    return out;
  }, [invoices, adjustmentNotes]);

  const counts = useMemo(() => {
    const c = {
      ALL: fiscalDocs.length,
      SIN_ENVIAR: 0,
      ENVIADA: 0,
      ACEPTADA: 0,
      RECHAZADA: 0,
    };
    for (const d of fiscalDocs) {
      c[d.dianStage]++;
    }
    return c;
  }, [fiscalDocs]);

  const filteredDocs = useMemo(() => {
    return fiscalDocs.filter((doc) => {
      if (activePill !== 'ALL' && doc.dianStage !== activePill) return false;
      const q = dianSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        doc.id.toLowerCase().includes(q) ||
        doc.customerName.toLowerCase().includes(q) ||
        (doc.customerNit || '').toLowerCase().includes(q) ||
        (doc.hashValue || '').toLowerCase().includes(q) ||
        (doc.trackId || '').toLowerCase().includes(q)
      );
    });
  }, [fiscalDocs, activePill, dianSearch]);

  const acceptedDocs = fiscalDocs.filter((d) => d.dianStage === 'ACEPTADA');
  const totalBilledAccepted = acceptedDocs
    .filter((d) => d.documentKind === 'INVOICE')
    .reduce((acc, d) => acc + d.total, 0);
  const totalTaxAccepted = acceptedDocs.reduce(
    (acc, d) =>
      acc + (d.documentKind === 'CREDIT_NOTE' ? -d.taxTotal : d.taxTotal),
    0
  );

  const openRejectSimulation = (doc: UnifiedFiscalDocument) => {
    setRejectTarget({
      documentKind: doc.documentKind,
      documentId: doc.id,
      customerName: doc.customerName,
    });
    setRejectRuleCode('DIAN-RUT-04');
    setRejectCustomMsg(REJECTION_MESSAGES['DIAN-RUT-04']);
  };

  const confirmRejectSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTarget) return;
    onRespondDian(
      rejectTarget.documentKind,
      rejectTarget.documentId,
      'REJECTED',
      rejectRuleCode,
      rejectCustomMsg.trim() || REJECTION_MESSAGES[rejectRuleCode]
    );
    setRejectTarget(null);
  };

  const renderDocKindBadge = (kind: UnifiedFiscalDocument['documentKind']) => {
    if (kind === 'CREDIT_NOTE') {
      return { label: 'Nota Crédito NC', tone: 'amber' as const };
    }
    if (kind === 'DEBIT_NOTE') {
      return { label: 'Nota Débito ND', tone: 'purple' as const };
    }
    return { label: 'Factura FEVP', tone: 'blue' as const };
  };

  const handleEditDoc = (doc: UnifiedFiscalDocument) => {
    if (doc.rawInvoice && onEditInvoice) {
      onEditInvoice(doc.rawInvoice);
    } else if (doc.rawNote && onEditNote) {
      onEditNote(doc.rawNote);
    }
  };

  const pendingLane = filteredDocs.filter((d) => d.dianStage === 'SIN_ENVIAR');
  const sentLane = filteredDocs.filter((d) => d.dianStage === 'ENVIADA');
  const acceptedLane = filteredDocs.filter((d) => d.dianStage === 'ACEPTADA');
  const rejectedLane = filteredDocs.filter((d) => d.dianStage === 'RECHAZADA');

  return (
    <ModuleGate module="facturacion_dian">
      <div className="pk-stack">
        <PkKpiRow
          items={[
            {
              label: 'Validados con CUFE / CUDE',
              value: String(counts.ACEPTADA),
              color: 'var(--pk-emerald)',
            },
            {
              label: 'Pendientes o En Transmisión',
              value: String(counts.SIN_ENVIAR + counts.ENVIADA),
              color: 'var(--pk-primary)',
            },
            {
              label: 'Rechazados por Subsanar',
              value: String(counts.RECHAZADA),
              color:
                counts.RECHAZADA > 0 ? 'var(--pk-rose)' : 'var(--pk-muted)',
            },
            {
              label: 'Facturación Electrónica Validada',
              value: formatCop(totalBilledAccepted),
              color: 'var(--pk-navy)',
            },
            {
              label: 'IVA Neto Fiscal DIAN',
              value: formatCop(Math.max(0, totalTaxAccepted)),
            },
          ]}
        />

        <PkDistributionStrip
          title="Distribución del Flujo de Transmisión Electrónica UBL 2.1 (2 Pasos)"
          segments={[
            {
              label: 'Pendientes de Envío',
              value: counts.SIN_ENVIAR,
              displayValue: `${counts.SIN_ENVIAR} docs`,
              color: '#f59e0b',
            },
            {
              label: 'Paso 1 · Enviadas a DIAN',
              value: counts.ENVIADA,
              displayValue: `${counts.ENVIADA} docs`,
              color: '#2563eb',
            },
            {
              label: 'Paso 2A · Aceptadas CUFE/CUDE',
              value: counts.ACEPTADA,
              displayValue: `${counts.ACEPTADA} docs`,
              color: '#10b981',
            },
            {
              label: 'Paso 2B · Rechazadas',
              value: counts.RECHAZADA,
              displayValue: `${counts.RECHAZADA} docs`,
              color: '#e11d48',
            },
          ]}
        />

        <PkLiveHeader
          title="Consola de Transmisión DIAN en 2 Pasos"
          liveLabel="En vivo"
          subtitle="Paso 1: Transmite el documento firmado a la DIAN (bloquea edición). Paso 2: Recibe validación con firma SHA-384 CUFE/CUDE o subsana rechazos."
          pills={[
            { key: 'ALL', label: 'Todas', count: counts.ALL },
            {
              key: 'SIN_ENVIAR',
              label: 'Pendientes de Envío',
              count: counts.SIN_ENVIAR,
            },
            {
              key: 'ENVIADA',
              label: 'Paso 1: Enviadas',
              count: counts.ENVIADA,
            },
            {
              key: 'ACEPTADA',
              label: 'Paso 2A: Aceptadas',
              count: counts.ACEPTADA,
            },
            {
              key: 'RECHAZADA',
              label: 'Paso 2B: Rechazadas',
              count: counts.RECHAZADA,
            },
          ]}
          activePill={activePill}
          onPillChange={setActivePill}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          boardLabel="🎛️ Tablero DIAN en Vivo"
          tableLabel="📋 Libro Fiscal Tabla"
          extraActions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="pk-input"
                style={{ minWidth: 230, minHeight: 38 }}
                placeholder="🔎 Buscar N°, NIT, TrackID o CUFE..."
                value={dianSearch}
                onChange={(e) => setDianSearch(e.target.value)}
              />
              <button
                type="button"
                className="pk-btn pk-btn-outline pk-btn-sm"
                onClick={() =>
                  downloadCsvUtf8(
                    'libro_fiscal_dian_2_pasos.csv',
                    [
                      'TipoDocumento',
                      'Consecutivo',
                      'RefFactura',
                      'Fecha',
                      'Adquiriente',
                      'NIT',
                      'Subtotal',
                      'IVA',
                      'Total',
                      'EtapaDIAN',
                      'TrackID',
                      'CUFE_CUDE',
                    ],
                    fiscalDocs.map((d) => [
                      d.documentKind,
                      d.id,
                      d.referencedId || '',
                      d.issueDate,
                      d.customerName,
                      d.customerNit,
                      d.subtotal,
                      d.taxTotal,
                      d.total,
                      d.dianStage,
                      d.trackId || '',
                      d.hashValue || 'PENDIENTE',
                    ])
                  )
                }
              >
                📥 Exportar Libro (.CSV)
              </button>
            </div>
          }
        />

        {displayMode === 'board' ? (
          <PkKanbanBoard
            columns={[
              {
                key: 'SIN_ENVIAR',
                title: '🟡 Pendientes de Envío',
                dotColor: 'amber',
                count: pendingLane.length,
                emptyText: 'No hay documentos pendientes de transmitir',
                children: pendingLane.map((doc) => (
                  <PkTicketCard
                    key={doc.key}
                    code={doc.id}
                    timeAgo={doc.issueDate}
                    channelBadge={renderDocKindBadge(doc.documentKind)}
                    title={doc.customerName}
                    subtitle={`NIT: ${doc.customerNit}`}
                    metaLine={
                      doc.referencedId
                        ? `Referencia Factura: ${doc.referencedId}`
                        : 'Documento comercial confirmado • Editable antes de enviar'
                    }
                    items={doc.items.slice(0, 2).map((it) => ({
                      qty: it.quantity,
                      name: it.description,
                      amount: formatCop(it.subtotal),
                    }))}
                    totalLabel="TOTAL FISCAL"
                    totalValue={formatCop(doc.total)}
                    processNodes={buildDianTwoStepNodes(
                      'SIN_ENVIAR',
                      doc.trackId,
                      undefined,
                      doc.hashType
                    )}
                    statusPill={{
                      label: 'Lista para Paso 1 DIAN',
                      tone: 'amber',
                    }}
                    primaryAction={{
                      label: '🚀 Paso 1: Enviar a DIAN',
                      tone: 'blue',
                      disabled: busy,
                      onClick: () => onSendToDian(doc.documentKind, doc.id),
                    }}
                    secondaryActions={
                      <>
                        {doc.editable && (
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            onClick={() => handleEditDoc(doc)}
                          >
                            ✏️ Revisar / Editar
                          </button>
                        )}
                        {doc.rawInvoice && (
                          <PkPrintButton
                            label="🖨️ PDF"
                            payload={buildPrintPayload(doc.rawInvoice)}
                          />
                        )}
                      </>
                    }
                  />
                )),
              },
              {
                key: 'ENVIADA',
                title: '🔵 Paso 1 · Enviadas a DIAN',
                dotColor: 'blue',
                count: sentLane.length,
                emptyText: 'Sin documentos esperando acuse de la DIAN',
                children: sentLane.map((doc) => (
                  <PkTicketCard
                    key={doc.key}
                    code={doc.id}
                    timeAgo={doc.issueDate}
                    channelBadge={renderDocKindBadge(doc.documentKind)}
                    title={doc.customerName}
                    subtitle={`NIT: ${doc.customerNit}`}
                    metaLine={`TrackID: ${doc.trackId || 'TRK-EN-CURSO'} • Intento #${Math.max(1, doc.attempts)}`}
                    totalLabel="TOTAL TRANSMITIDO"
                    totalValue={formatCop(doc.total)}
                    processNodes={buildDianTwoStepNodes(
                      'ENVIADA',
                      doc.trackId,
                      undefined,
                      doc.hashType
                    )}
                    statusPill={{
                      label: 'Bloqueado en validación DIAN',
                      tone: 'blue',
                    }}
                    primaryAction={{
                      label: '✅ Paso 2: Recibir Aceptación DIAN',
                      tone: 'emerald',
                      disabled: busy,
                      onClick: () =>
                        onRespondDian(doc.documentKind, doc.id, 'ACCEPTED'),
                    }}
                    secondaryActions={
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        style={{ width: '100%', color: 'var(--pk-rose)', borderColor: '#fecdd3' }}
                        disabled={busy}
                        onClick={() => openRejectSimulation(doc)}
                      >
                        ⚠️ Simular Rechazo DIAN
                      </button>
                    }
                  />
                )),
              },
              {
                key: 'ACEPTADA',
                title: '🟢 Paso 2A · Aceptadas CUFE/CUDE',
                dotColor: 'emerald',
                count: acceptedLane.length,
                emptyText: 'Aún no hay documentos validados con CUFE/CUDE',
                children: acceptedLane.map((doc) => (
                  <PkTicketCard
                    key={doc.key}
                    code={doc.id}
                    timeAgo={doc.issueDate}
                    channelBadge={renderDocKindBadge(doc.documentKind)}
                    title={doc.customerName}
                    subtitle={`NIT: ${doc.customerNit}`}
                    metaLine={
                      doc.referencedId
                        ? `Aplicada sobre ${doc.referencedId}`
                        : `IVA Generado: ${formatCop(doc.taxTotal)}`
                    }
                    extraBody={
                      <div
                        style={{
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          fontSize: 10.5,
                          color: '#065f46',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                        }}
                        title={doc.hashValue}
                      >
                        <strong>{doc.hashType} SHA-384:</strong>{' '}
                        {doc.hashValue.slice(0, 34)}...
                      </div>
                    }
                    totalLabel="TOTAL VALIDADO"
                    totalValue={formatCop(doc.total)}
                    processNodes={buildDianTwoStepNodes(
                      'ACEPTADA',
                      doc.trackId,
                      undefined,
                      doc.hashType
                    )}
                    statusPill={{
                      label: `Aceptada DIAN (${doc.hashType} 96 hex)`,
                      tone: 'emerald',
                    }}
                    secondaryActions={
                      <>
                        {doc.rawInvoice && (
                          <PkPrintButton
                            label="🖨️ PDF Fiscal"
                            payload={buildPrintPayload(doc.rawInvoice)}
                          />
                        )}
                        {doc.rawNote && buildNotePrintPayload && (
                          <PkPrintButton
                            label="🖨️ PDF Nota"
                            payload={buildNotePrintPayload(doc.rawNote)}
                          />
                        )}
                        {doc.rawInvoice &&
                          doc.rawInvoice.docStatus !== 'ANULADA_NC' &&
                          onOpenNoteFromInvoice && (
                            <button
                              type="button"
                              className="pk-btn pk-btn-outline pk-btn-sm"
                              onClick={() =>
                                onOpenNoteFromInvoice(doc.rawInvoice!)
                              }
                            >
                              ↩️ Nota Crédito / Débito
                            </button>
                          )}
                      </>
                    }
                  />
                )),
              },
              {
                key: 'RECHAZADA',
                title: '🔴 Paso 2B · Rechazadas por Subsanar',
                dotColor: 'rose',
                count: rejectedLane.length,
                emptyText: 'Cero rechazos pendientes de subsanar',
                children: rejectedLane.map((doc) => (
                  <PkTicketCard
                    key={doc.key}
                    code={doc.id}
                    timeAgo={doc.issueDate}
                    channelBadge={renderDocKindBadge(doc.documentKind)}
                    title={doc.customerName}
                    subtitle={`NIT: ${doc.customerNit}`}
                    highlightNote={`${doc.rejectionCode || 'DIAN-RUT-04'}: ${doc.rejectionMessage || 'Inconsistencia tributaria'}`}
                    totalLabel="TOTAL OBSERVADO"
                    totalValue={formatCop(doc.total)}
                    processNodes={buildDianTwoStepNodes(
                      'RECHAZADA',
                      doc.trackId,
                      doc.rejectionCode,
                      doc.hashType
                    )}
                    statusPill={{
                      label: 'Desbloqueado para corrección',
                      tone: 'rose',
                    }}
                    primaryAction={{
                      label: '✏️ Corregir Documento',
                      tone: 'coral',
                      disabled: busy,
                      onClick: () => handleEditDoc(doc),
                    }}
                    secondaryActions={
                      <button
                        type="button"
                        className="pk-btn pk-btn-primary pk-btn-sm"
                        style={{ width: '100%' }}
                        disabled={busy}
                        onClick={() => onSendToDian(doc.documentKind, doc.id)}
                      >
                        🚀 Reenviar a DIAN (Intento #{doc.attempts + 1})
                      </button>
                    }
                  />
                )),
              },
            ]}
          />
        ) : (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                📋 Libro Fiscal Electrónico con Nodos DIAN en Vivo
              </div>
              <span className="pk-badge pk-badge-blue">
                {filteredDocs.length} documentos
              </span>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Adquiriente / NIT</th>
                      <th>Total / IVA</th>
                      <th>Flujo DIAN (2 Pasos)</th>
                      <th>TrackID / CUFE · CUDE</th>
                      <th>Acciones Fiscales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((doc) => {
                      const kindBadge = renderDocKindBadge(doc.documentKind);
                      return (
                        <tr key={doc.key}>
                          <td>
                            <strong>{doc.id}</strong>
                            <div style={{ marginTop: 4 }}>
                              <span
                                className={`pk-badge pk-badge-${
                                  kindBadge.tone === 'purple'
                                    ? 'blue'
                                    : kindBadge.tone
                                }`}
                              >
                                {kindBadge.label}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--pk-muted)',
                                marginTop: 2,
                              }}
                            >
                              {doc.issueDate}
                            </div>
                          </td>
                          <td>
                            <strong>{doc.customerName}</strong>
                            <div
                              style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}
                            >
                              NIT: {doc.customerNit}
                            </div>
                            {doc.referencedId && (
                              <div
                                style={{ fontSize: 11, color: 'var(--pk-primary)' }}
                              >
                                Ref: {doc.referencedId}
                              </div>
                            )}
                          </td>
                          <td>
                            <strong>{formatCop(doc.total)}</strong>
                            <div
                              style={{ fontSize: 11, color: 'var(--pk-muted)' }}
                            >
                              IVA: {formatCop(doc.taxTotal)}
                            </div>
                          </td>
                          <td style={{ minWidth: 230 }}>
                            <PkProcessNodes
                              compact
                              steps={buildDianTwoStepNodes(
                                doc.dianStage,
                                doc.trackId,
                                doc.rejectionCode,
                                doc.hashType
                              )}
                            />
                          </td>
                          <td style={{ maxWidth: 230 }}>
                            {doc.dianStage === 'ACEPTADA' ? (
                              <code
                                style={{
                                  display: 'block',
                                  fontSize: 10.5,
                                  color: '#065f46',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={doc.hashValue}
                              >
                                {doc.hashType}: {doc.hashValue}
                              </code>
                            ) : doc.dianStage === 'RECHAZADA' ? (
                              <div style={{ fontSize: 11.5, color: 'var(--pk-rose)' }}>
                                <strong>{doc.rejectionCode}:</strong>{' '}
                                {doc.rejectionMessage}
                              </div>
                            ) : doc.trackId ? (
                              <span className="pk-badge pk-badge-blue">
                                {doc.trackId}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>
                                Sin transmitir
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="pk-row-actions">
                              {doc.dianStage === 'SIN_ENVIAR' && (
                                <button
                                  type="button"
                                  className="pk-btn pk-btn-primary pk-btn-sm"
                                  disabled={busy}
                                  onClick={() =>
                                    onSendToDian(doc.documentKind, doc.id)
                                  }
                                >
                                  🚀 Enviar DIAN
                                </button>
                              )}
                              {doc.dianStage === 'ENVIADA' && (
                                <>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-emerald pk-btn-sm"
                                    disabled={busy}
                                    onClick={() =>
                                      onRespondDian(
                                        doc.documentKind,
                                        doc.id,
                                        'ACCEPTED'
                                      )
                                    }
                                  >
                                    ✅ Aceptar
                                  </button>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-danger pk-btn-sm"
                                    disabled={busy}
                                    onClick={() => openRejectSimulation(doc)}
                                  >
                                    ⚠️ Rechazar
                                  </button>
                                </>
                              )}
                              {doc.dianStage === 'RECHAZADA' && (
                                <>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-amber pk-btn-sm"
                                    onClick={() => handleEditDoc(doc)}
                                  >
                                    ✏️ Corregir
                                  </button>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-primary pk-btn-sm"
                                    disabled={busy}
                                    onClick={() =>
                                      onSendToDian(doc.documentKind, doc.id)
                                    }
                                  >
                                    🚀 Reenviar
                                  </button>
                                </>
                              )}
                              {doc.rawInvoice && (
                                <PkPrintButton
                                  label="🖨️ PDF"
                                  payload={buildPrintPayload(doc.rawInvoice)}
                                />
                              )}
                              {doc.rawNote && buildNotePrintPayload && (
                                <PkPrintButton
                                  label="🖨️ PDF"
                                  payload={buildNotePrintPayload(doc.rawNote)}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredDocs.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{
                            textAlign: 'center',
                            color: 'var(--pk-muted)',
                            padding: 28,
                          }}
                        >
                          No se encontraron documentos fiscales para el filtro seleccionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <PkModal
          open={Boolean(rejectTarget)}
          title={`⚠️ Simular Regla de Rechazo DIAN — ${rejectTarget?.documentId || ''}`}
          onClose={() => setRejectTarget(null)}
          maxWidth={560}
        >
          <form onSubmit={confirmRejectSimulation} className="pk-stack">
            <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
              Al registrar un rechazo de validación previa DIAN sobre{' '}
              <strong>{rejectTarget?.customerName}</strong>, el documento quedará
              desbloqueado automáticamente para que puedas corregir sus datos y
              retransmitirlo sin perder el consecutivo.
            </p>
            <PkSimpleSelect
              label="Regla de Validación DIAN Observada"
              value={rejectRuleCode}
              onChange={(code) => {
                setRejectRuleCode(code);
                if (REJECTION_MESSAGES[code]) {
                  setRejectCustomMsg(REJECTION_MESSAGES[code]);
                }
              }}
              searchable={false}
              options={REJECTION_RULE_OPTIONS}
            />
            <div className="pk-field">
              <label>Detalle Técnico de Subsanación</label>
              <input
                value={rejectCustomMsg}
                onChange={(e) => setRejectCustomMsg(e.target.value)}
                required
              />
            </div>
            <div className="pk-row-actions" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                onClick={() => setRejectTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="pk-btn pk-btn-danger"
                disabled={busy}
              >
                Registrar Rechazo y Habilitar Edición
              </button>
            </div>
          </form>
        </PkModal>
      </div>
    </ModuleGate>
  );
};
