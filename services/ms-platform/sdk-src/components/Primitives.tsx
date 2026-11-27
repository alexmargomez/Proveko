import React, { useState, useEffect, useId, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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

function normalizeSearchToken(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

interface Select2Entry {
  value: string;
  label: string;
  sublabel?: string;
  searchText: string;
}

interface InternalSelect2ControlProps {
  id: string;
  ariaLabel: string;
  entries: Select2Entry[];
  value: string;
  onChange: (newValue: string) => void;
  placeholder: string;
  allowClear: boolean;
  searchable: boolean;
  disabled?: boolean;
  compact?: boolean;
  onCreateNew?: () => void;
  createLabel?: string;
}

const InternalSelect2Control: React.FC<InternalSelect2ControlProps> = ({
  id,
  ariaLabel,
  entries,
  value,
  onChange,
  placeholder,
  allowClear,
  searchable,
  disabled = false,
  compact = false,
  onCreateNew,
  createLabel = '+ Nuevo',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; flipUp: boolean }>({
    top: 0,
    left: 0,
    width: 280,
    flipUp: false,
  });

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedEntry = useMemo(() => entries.find((e) => e.value === value) || null, [entries, value]);

  const filteredEntries = useMemo(() => {
    const q = normalizeSearchToken(query);
    if (!q) return entries;
    const words = q.split(/\s+/).filter(Boolean);
    return entries.filter((entry) => words.every((w) => entry.searchText.includes(w)));
  }, [entries, query]);

  const recomputePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight || 800;
    const viewportW = window.innerWidth || 1280;
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const flipUp = spaceBelow < 250 && spaceAbove > spaceBelow;
    const desiredWidth = Math.min(Math.max(rect.width, 260), Math.max(260, viewportW - 24));
    const clampedLeft = Math.max(12, Math.min(rect.left, viewportW - desiredWidth - 12));
    setCoords({
      top: flipUp ? rect.top - 6 : rect.bottom + 6,
      left: clampedLeft,
      width: desiredWidth,
      flipUp,
    });
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    recomputePosition();
    setQuery('');
    const currentIdx = entries.findIndex((e) => e.value === value);
    setHighlightIdx(currentIdx >= 0 ? currentIdx : 0);
    setOpen(true);
  }, [disabled, entries, recomputePosition, value]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => {
      if (searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    });
    const handlePointerDown = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      closeMenu();
    };
    const handleScrollOrResize = (ev: Event) => {
      if (ev.type === 'scroll' && popoverRef.current && ev.target instanceof Node && popoverRef.current.contains(ev.target)) {
        return;
      }
      recomputePosition();
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open, searchable, closeMenu, recomputePosition]);

  useEffect(() => {
    if (!open) return;
    const btn = optionRefs.current[highlightIdx];
    if (btn && typeof btn.scrollIntoView === 'function') {
      btn.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx, open]);

  const selectValue = (nextVal: string) => {
    onChange(nextVal);
    closeMenu();
    triggerRef.current?.focus();
  };

  const handleKeyDown = (ev: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        openMenu();
      }
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      closeMenu();
      triggerRef.current?.focus();
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setHighlightIdx((prev) => (filteredEntries.length === 0 ? 0 : (prev + 1) % filteredEntries.length));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setHighlightIdx((prev) =>
        filteredEntries.length === 0 ? 0 : (prev - 1 + filteredEntries.length) % filteredEntries.length
      );
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const target = filteredEntries[highlightIdx];
      if (target) {
        selectValue(target.value);
      }
    } else if (ev.key === 'Tab') {
      closeMenu();
    }
  };

  const popoverStyle: React.CSSProperties = coords.flipUp
    ? {
        left: coords.left,
        width: coords.width,
        bottom: Math.max(12, (window.innerHeight || 800) - coords.top),
      }
    : {
        top: coords.top,
        left: coords.left,
        width: coords.width,
      };

  return (
    <div className="pk-s2-root">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`pk-s2-trigger${open ? ' open' : ''}${compact ? ' compact' : ''}`}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        {selectedEntry ? (
          <span className="pk-s2-value" title={selectedEntry.label}>
            {selectedEntry.label}
          </span>
        ) : (
          <span className="pk-s2-placeholder">{placeholder}</span>
        )}
        <span className="pk-s2-indicators">
          {allowClear && value !== '' && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              title="Limpiar selección"
              className="pk-s2-clear"
              onClick={(ev) => {
                ev.stopPropagation();
                onChange('');
              }}
            >
              ×
            </span>
          )}
          <svg
            className="pk-s2-chevron"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            className="pk-s2-popover"
            style={popoverStyle}
            role="listbox"
            aria-label={ariaLabel}
            onKeyDown={handleKeyDown}
          >
            {searchable && (
              <div className="pk-s2-search-wrap">
                <svg
                  className="pk-s2-search-icon"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="pk-s2-search"
                  placeholder="Buscar por nombre, código o identificación..."
                  value={query}
                  onChange={(ev) => {
                    setQuery(ev.target.value);
                    setHighlightIdx(0);
                  }}
                />
              </div>
            )}

            <div className="pk-s2-options">
              {filteredEntries.length === 0 ? (
                <div className="pk-s2-empty">
                  {query.trim() ? `Sin resultados para "${query.trim()}"` : 'No hay opciones disponibles'}
                </div>
              ) : (
                filteredEntries.map((entry, idx) => {
                  const isSelected = entry.value === value;
                  const isHighlighted = idx === highlightIdx;
                  return (
                    <button
                      key={`${entry.value}__${idx}`}
                      ref={(el) => {
                        optionRefs.current[idx] = el;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`pk-s2-option${isSelected ? ' selected' : ''}${isHighlighted ? ' highlighted' : ''}`}
                      onMouseEnter={() => setHighlightIdx(idx)}
                      onClick={() => selectValue(entry.value)}
                    >
                      <span className="pk-s2-option-text">
                        <span>{entry.label}</span>
                        {entry.sublabel && <span className="pk-s2-option-sub">{entry.sublabel}</span>}
                      </span>
                      {isSelected && (
                        <svg
                          className="pk-s2-check"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {onCreateNew && (
              <div className="pk-s2-footer">
                <button
                  type="button"
                  className="pk-s2-create-btn"
                  onClick={() => {
                    closeMenu();
                    onCreateNew();
                  }}
                >
                  {createLabel}
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
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
  placeholder?: string;
  disabled?: boolean;
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
  searchable = true,
  emptyLabel,
  placeholder,
  disabled = false,
}: PkSelectProps<T>): React.ReactElement {
  const selectId = useId();
  const entries = useMemo<Select2Entry[]>(() => {
    const list: Select2Entry[] = [];
    if (emptyLabel !== undefined) {
      list.push({
        value: '',
        label: emptyLabel,
        searchText: normalizeSearchToken(emptyLabel),
      });
    }
    for (const item of items) {
      const v = getValue(item);
      const lbl = getLabel(item);
      list.push({
        value: v,
        label: lbl,
        searchText: normalizeSearchToken(`${lbl} ${v}`),
      });
    }
    return list;
  }, [items, emptyLabel, getValue, getLabel]);

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
              textTransform: 'none',
            }}
          >
            {createLabel}
          </button>
        )}
      </label>
      <InternalSelect2Control
        id={selectId}
        ariaLabel={label}
        entries={entries}
        value={value}
        onChange={onChange}
        placeholder={placeholder || emptyLabel || 'Seleccionar opción...'}
        allowClear={emptyLabel !== undefined}
        searchable={searchable}
        disabled={disabled}
        onCreateNew={onCreateNew}
        createLabel={createLabel}
      />
    </div>
  );
}

export interface PkSimpleOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface PkSimpleSelectProps {
  label?: string;
  ariaLabel?: string;
  options: PkSimpleOption[];
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  allowClear?: boolean;
  searchable?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onCreateNew?: () => void;
  createLabel?: string;
}

export const PkSimpleSelect: React.FC<PkSimpleSelectProps> = ({
  label,
  ariaLabel,
  options,
  value,
  onChange,
  placeholder = 'Seleccionar opción...',
  allowClear = false,
  searchable = true,
  disabled = false,
  compact = false,
  onCreateNew,
  createLabel = '+ Nuevo',
}) => {
  const selectId = useId();
  const entries = useMemo<Select2Entry[]>(
    () =>
      options.map((opt) => ({
        value: opt.value,
        label: opt.label,
        sublabel: opt.sublabel,
        searchText: normalizeSearchToken(`${opt.label} ${opt.sublabel || ''} ${opt.value}`),
      })),
    [options]
  );

  const control = (
    <InternalSelect2Control
      id={selectId}
      ariaLabel={label || ariaLabel || placeholder}
      entries={entries}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      allowClear={allowClear}
      searchable={searchable}
      disabled={disabled}
      compact={compact}
      onCreateNew={onCreateNew}
      createLabel={createLabel}
    />
  );

  if (!label) {
    return control;
  }

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
              textTransform: 'none',
            }}
          >
            {createLabel}
          </button>
        )}
      </label>
      {control}
    </div>
  );
};

export const PkViewSwitcher: React.FC<{
  title: string;
  subtitle?: string;
  mode: 'list' | 'create';
  onModeChange: (mode: 'list' | 'create') => void;
  listLabel?: string;
  createLabel?: string;
  count?: number;
  extraActions?: React.ReactNode;
}> = ({
  title,
  subtitle,
  mode,
  onModeChange,
  listLabel = 'Listado y Registros',
  createLabel = '+ Nuevo Registro',
  count,
  extraActions,
}) => (
  <div className="pk-view-switcher">
    <div className="pk-view-switcher-meta">
      <div className="pk-view-switcher-title">
        <span>{title}</span>
        {typeof count === 'number' && <span className="pk-badge pk-badge-blue">{count} registros</span>}
      </div>
      {subtitle && <div className="pk-view-switcher-sub">{subtitle}</div>}
    </div>
    <div className="pk-view-switcher-controls">
      {extraActions}
      <div className="pk-segmented" role="tablist" aria-label={title}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'list'}
          className={`pk-segmented-btn${mode === 'list' ? ' active' : ''}`}
          onClick={() => onModeChange('list')}
        >
          <span>{listLabel}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'create'}
          className={`pk-segmented-btn${mode === 'create' ? ' active' : ''}`}
          onClick={() => onModeChange('create')}
        >
          <span>{createLabel}</span>
        </button>
      </div>
      {mode === 'list' ? (
        <button type="button" className="pk-btn pk-btn-primary" onClick={() => onModeChange('create')}>
          {createLabel}
        </button>
      ) : (
        <button type="button" className="pk-btn pk-btn-outline" onClick={() => onModeChange('list')}>
          ← Volver al Listado
        </button>
      )}
    </div>
  </div>
);

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
        <div className="pk-card-head" style={{ background: '#023047', color: '#ffffff' }}>
          <div className="pk-card-title" id={titleId} style={{ color: '#ffffff' }}>
            {title}
          </div>
          <button type="button" className="pk-btn pk-btn-hero-outline pk-btn-sm" onClick={onClose}>
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
