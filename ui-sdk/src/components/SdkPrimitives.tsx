import React, { useState } from 'react';
import { useProveko } from '../context/ProvekoContext';
import { PrintDocumentPayload } from '../types/domain';

export const ModuleGate: React.FC<{ module: string; children: React.ReactNode }> = ({ module, children }) => {
  const { hasModule } = useProveko();
  return hasModule(module) ? <>{children}</> : null;
};

export const FeatureGate: React.FC<{
  module?: string;
  feature: string;
  children: React.ReactNode;
}> = ({ module = '', feature, children }) => {
  const { hasFeature } = useProveko();
  return hasFeature(module, feature) ? <>{children}</> : null;
};

export const PkAutoCodeInput: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="pk-field">
    <label>
      <span>{label}</span>
      <span style={{ color: 'var(--pk-emerald)', fontSize: 10.5 }}>⚡ Automático</span>
    </label>
    <input
      type="text"
      value={value}
      readOnly
      style={{ background: '#e2e8f0', fontWeight: 800, color: '#0f172a' }}
    />
  </div>
);

export interface PkEntitySelectProps<T> {
  label: string;
  items: T[];
  value: string;
  onChange: (newValue: string) => void;
  getValue: (item: T) => string;
  getLabel: (item: T) => string;
  onCreateNew?: () => void;
  createLabel?: string;
  searchable?: boolean;
}

export function PkEntitySelect<T>({
  label,
  items,
  value,
  onChange,
  getValue,
  getLabel,
  onCreateNew,
  createLabel = '+ Nuevo',
  searchable = false,
}: PkEntitySelectProps<T>): React.ReactElement {
  const [filter, setFilter] = useState('');
  const filtered = filter.trim()
    ? items.filter((it) => getLabel(it).toLowerCase().includes(filter.toLowerCase()))
    : items;

  return (
    <div className="pk-field">
      <label>
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
            placeholder="🔎 Filtrar..."
            style={{ width: 105 }}
          />
        )}
        <select value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }}>
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

export const PkEntityDialog: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="pk-modal-backdrop" onClick={onClose}>
      <div className="pk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pk-card-head" style={{ background: '#023047', color: '#fff' }}>
          <div className="pk-card-title">{title}</div>
          <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={onClose}>
            ✕ Cerrar
          </button>
        </div>
        <div className="pk-card-body">{children}</div>
      </div>
    </div>
  );
};

export const PkPrintButton: React.FC<{
  label?: string;
  payload: PrintDocumentPayload;
  variant?: 'primary' | 'outline';
}> = ({ label = '🖨️ Imprimir', payload, variant = 'outline' }) => {
  const { printViaService } = useProveko();
  return (
    <button
      type="button"
      className={`pk-btn pk-btn-sm ${variant === 'primary' ? 'pk-btn-primary' : 'pk-btn-outline'}`}
      onClick={() => void printViaService(payload)}
    >
      {label}
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
        <div className="pk-kpi-value" style={it.color ? { color: it.color } : undefined}>
          {it.value}
        </div>
      </div>
    ))}
  </div>
);

export function downloadCsvUtf8(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [headers.join(';')];
  for (const r of rows) {
    lines.push(r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
