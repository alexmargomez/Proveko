import React, { useState, useEffect, useId, useRef, useCallback } from 'react';
import { useLicensing, useNavigation } from '../context/PlatformContext';

export const ModuleGate: React.FC<{ module: string; children: React.ReactNode }> = ({ module, children }) => {
  const { hasModule } = useLicensing();
  return hasModule(module) ? <>{children}</> : null;
};

export const SubmoduleGate: React.FC<{
  module?: string;
  submodule: string;
  children: React.ReactNode;
}> = ({ module = '', submodule, children }) => {
  const { hasSubmodule } = useLicensing();
  return hasSubmodule(module, submodule) ? <>{children}</> : null;
};

export const FeatureGate: React.FC<{
  module?: string;
  feature: string;
  children: React.ReactNode;
}> = ({ module = '', feature, children }) => {
  const { hasFeature } = useLicensing();
  return hasFeature(module, feature) ? <>{children}</> : null;
};

export const PkAutoCodeInput: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const inputId = useId();
  return (
    <div className="pk-field">
      <label htmlFor={inputId}>
        <span>{label}</span>
        <span style={{ color: 'var(--pk-emerald)', fontSize: 10.5 }}>Automático</span>
      </label>
      <input
        id={inputId}
        type="text"
        value={value}
        readOnly
        style={{ background: '#e2e8f0', fontWeight: 800, color: '#0f172a' }}
      />
    </div>
  );
};

export interface PkSelectProps<T> {
  label: string;
  items: T[];
  value: string;
  onChange: (newValue: string) => void;
  getValue: (item: T) => string;
  getLabel: (item: T) => string;
  onCreateNew?: () => void;
  createLabel?: string;
  searchable?: boolean;
  emptyLabel?: string;
}

export function PkSelect<T>({
  label,
  items,
  value,
  onChange,
  getValue,
  getLabel,
  onCreateNew,
  createLabel = '+ Nuevo',
  searchable = false,
  emptyLabel,
}: PkSelectProps<T>): React.ReactElement {
  const [filter, setFilter] = useState('');
  const selectId = useId();
  const normalized = filter.trim().toLowerCase();
  const filtered = normalized
    ? items.filter((it) => getValue(it) === value || getLabel(it).toLowerCase().includes(normalized))
    : items;

  return (
    <div className="pk-field">
      <label htmlFor={selectId}>
        <span>{label}</span>
        {onCreateNew && (
          <button
            type="button"
            onClick={onCreateNew}
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--pk-primary)',
              fontWeight: 800,
              fontSize: 11,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {createLabel}
          </button>
        )}
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        {searchable && (
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar..."
            aria-label={`Filtrar ${label}`}
            style={{ width: 105 }}
          />
        )}
        <select id={selectId} value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }}>
          {emptyLabel && <option value="">{emptyLabel}</option>}
          {filtered.map((item) => {
            const v = getValue(item);
            return (
              <option key={v} value={v}>
                {getLabel(item)}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
}

export const PkModal: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  maxWidth?: number;
  children: React.ReactNode;
}> = ({ open, title, onClose, maxWidth = 640, children }) => {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="pk-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="pk-modal" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <div className="pk-card-head" style={{ background: '#023047', color: '#fff' }}>
          <div className="pk-card-title" id={titleId}>
            {title}
          </div>
          <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <div className="pk-card-body">{children}</div>
      </div>
    </div>
  );
};

export const PkConfirmModal: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}> = ({ open, title, message, confirmLabel = 'Confirmar', onConfirm, onCancel, busy = false }) => (
  <PkModal open={open} title={title} onClose={onCancel} maxWidth={460}>
    <p style={{ margin: '0 0 16px', fontSize: 13.5, color: '#334155', lineHeight: 1.5 }}>{message}</p>
    <div className="pk-row-actions" style={{ justifyContent: 'flex-end' }}>
      <button type="button" className="pk-btn pk-btn-outline" onClick={onCancel} disabled={busy}>
        Cancelar
      </button>
      <button type="button" className="pk-btn pk-btn-danger" onClick={onConfirm} disabled={busy}>
        {busy ? 'Procesando...' : confirmLabel}
      </button>
    </div>
  </PkModal>
);

export const PkPrintButton: React.FC<{
  label?: string;
  payload: Record<string, unknown>;
  variant?: 'primary' | 'outline';
}> = ({ label = 'Imprimir', payload, variant = 'outline' }) => {
  const { hasPrintCapability } = useLicensing();
  const { requestPrintDocument } = useNavigation();
  const [printing, setPrinting] = useState(false);

  if (!hasPrintCapability) return null;

  const handleClick = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      await requestPrintDocument(payload);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <button
      type="button"
      disabled={printing}
      className={`pk-btn pk-btn-sm ${variant === 'primary' ? 'pk-btn-primary' : 'pk-btn-outline'}`}
      onClick={() => void handleClick()}
    >
      {printing ? 'Generando...' : label}
    </button>
  );
};

export const PkKpiRow: React.FC<{
  items: { label: string; value: string; color?: string }[];
}> = ({ items }) => (
  <div className="pk-kpi-row">
    {items.map((it) => (
      <div className="pk-kpi-card" key={it.label}>
        <div className="pk-kpi-label">{it.label}</div>
        <div className="pk-kpi-value pk-num" style={it.color ? { color: it.color } : undefined}>
          {it.value}
        </div>
      </div>
    ))}
  </div>
);

export function useAsyncAction(): {
  busy: boolean;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
} {
  const [busy, setBusy] = useState(false);
  const lockRef = useRef(false);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (lockRef.current) return undefined;
    lockRef.current = true;
    setBusy(true);
    try {
      return await fn();
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}

export function formatCop(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return '$' + safe.toLocaleString('es-CO');
}

function sanitizeCsvCell(cell: string | number | null | undefined): string {
  if (typeof cell === 'number') {
    return Number.isFinite(cell) ? String(cell) : '0';
  }
  let raw = String(cell ?? '');
  const trimmed = raw.trimStart();
  if (/^[=+\-@\t\r]/.test(trimmed) && !/^-\d+(\.\d+)?$/.test(trimmed)) {
    raw = "'" + raw;
  }
  return `"${raw.replace(/"/g, '""')}"`;
}

export function downloadCsvUtf8(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers.map((h) => sanitizeCsvCell(h)).join(';')];
  for (const r of rows) {
    lines.push(r.map((cell) => sanitizeCsvCell(cell)).join(';'));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
