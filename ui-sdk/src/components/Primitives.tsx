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

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
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
    </div>,
    document.body
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

export interface PkProcessStep {
  step: number | string;
  label: string;
  sublabel?: string;
  status: 'done' | 'active' | 'error' | 'pending';
  tooltip?: string;
  onClick?: () => void;
}

export const PkProcessNodes: React.FC<{
  steps: PkProcessStep[];
  compact?: boolean;
}> = ({ steps, compact = false }) => {
  if (!steps.length) return null;
  return (
    <div className={`pk-pnodes${compact ? ' compact' : ''}`}>
      {steps.map((st, idx) => {
        const prev = idx > 0 ? steps[idx - 1] : null;
        const next = idx < steps.length - 1 ? steps[idx + 1] : null;

        let leftLineTone = '';
        if (prev) {
          if (st.status === 'done') leftLineTone = 'done';
          else if (st.status === 'active') leftLineTone = 'active';
          else if (st.status === 'error') leftLineTone = 'error';
        }

        let rightLineTone = '';
        if (next) {
          if (next.status === 'done') rightLineTone = 'done';
          else if (next.status === 'active') rightLineTone = 'active';
          else if (next.status === 'error') rightLineTone = 'error';
        }

        return (
          <div className="pk-pnode-item" key={`${st.step}-${idx}`} title={st.tooltip || st.label}>
            <div className="pk-pnode-track-row">
              <div className={`pk-pnode-line${idx === 0 ? ' hidden' : ''}${leftLineTone ? ` ${leftLineTone}` : ''}`} />
              <button
                type="button"
                disabled={!st.onClick}
                onClick={st.onClick}
                className={`pk-pnode-circle ${st.status}${st.onClick ? ' clickable' : ''}`}
              >
                {st.status === 'done' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : st.status === 'error' ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : (
                  st.step
                )}
              </button>
              <div className={`pk-pnode-line${idx === steps.length - 1 ? ' hidden' : ''}${rightLineTone ? ` ${rightLineTone}` : ''}`} />
            </div>
            <div className="pk-pnode-caption">
              <div className="pk-pnode-label">{st.label}</div>
              {st.sublabel && <div className="pk-pnode-sub">{st.sublabel}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export interface PkLivePillTab {
  key: string;
  label: string;
  count?: number;
}

export const PkLiveHeader: React.FC<{
  title: string;
  liveLabel?: string;
  subtitle?: string;
  pills?: PkLivePillTab[];
  activePill?: string;
  onPillChange?: (key: string) => void;
  displayMode?: 'board' | 'table';
  onDisplayModeChange?: (mode: 'board' | 'table') => void;
  boardLabel?: string;
  tableLabel?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  extraActions?: React.ReactNode;
}> = ({
  title,
  liveLabel = 'En vivo',
  subtitle,
  pills,
  activePill,
  onPillChange,
  displayMode,
  onDisplayModeChange,
  boardLabel = '🎛️ Tablero en Vivo',
  tableLabel = '📋 Vista Tabla',
  primaryActionLabel,
  onPrimaryAction,
  extraActions,
}) => (
  <div className="pk-live-header">
    <div className="pk-live-top">
      <div className="pk-live-title-group">
        <div className="pk-live-title-row">
          <h2 className="pk-live-title">{title}</h2>
          {liveLabel && (
            <span className="pk-live-badge">
              <span className="pk-live-dot" />
              {liveLabel}
            </span>
          )}
        </div>
        {subtitle && <div className="pk-live-sub">{subtitle}</div>}
      </div>

      <div className="pk-live-actions">
        {extraActions}
        {displayMode && onDisplayModeChange && (
          <div className="pk-segmented" role="tablist" aria-label="Modo de visualización">
            <button
              type="button"
              role="tab"
              aria-selected={displayMode === 'board'}
              className={`pk-segmented-btn${displayMode === 'board' ? ' active' : ''}`}
              onClick={() => onDisplayModeChange('board')}
            >
              {boardLabel}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={displayMode === 'table'}
              className={`pk-segmented-btn${displayMode === 'table' ? ' active' : ''}`}
              onClick={() => onDisplayModeChange('table')}
            >
              {tableLabel}
            </button>
          </div>
        )}
        {primaryActionLabel && onPrimaryAction && (
          <button type="button" className="pk-btn pk-btn-primary" onClick={onPrimaryAction}>
            {primaryActionLabel}
          </button>
        )}
      </div>
    </div>

    {pills && pills.length > 0 && onPillChange && (
      <div className="pk-pill-tabs" role="tablist">
        {pills.map((pill) => {
          const isActive = pill.key === activePill;
          return (
            <button
              key={pill.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`pk-pill-tab${isActive ? ' active' : ''}`}
              onClick={() => onPillChange(pill.key)}
            >
              <span>{pill.label}</span>
              {typeof pill.count === 'number' && <span className="pk-pill-tab-count">{pill.count}</span>}
            </button>
          );
        })}
      </div>
    )}
  </div>
);

export interface PkKanbanColumnSpec {
  key: string;
  title: string;
  dotColor: 'amber' | 'blue' | 'purple' | 'emerald' | 'rose' | 'slate';
  count: number;
  emptyText?: string;
  children?: React.ReactNode;
}

export const PkKanbanBoard: React.FC<{
  columns: PkKanbanColumnSpec[];
}> = ({ columns }) => (
  <div
    className="pk-kanban-board"
    style={{ '--pk-kanban-cols': Math.max(1, Math.min(4, columns.length)) } as React.CSSProperties}
  >
    {columns.map((col) => (
      <div className="pk-kanban-col" key={col.key}>
        <div className="pk-kanban-col-head">
          <div className="pk-kanban-col-title">
            <span className={`pk-kanban-dot ${col.dotColor}`} />
            <span>{col.title}</span>
          </div>
          <span className="pk-kanban-count">{col.count}</span>
        </div>
        <div className="pk-kanban-cards">
          {col.count === 0 ? (
            <div className="pk-kanban-empty">{col.emptyText || 'Sin registros en esta etapa'}</div>
          ) : (
            col.children
          )}
        </div>
      </div>
    ))}
  </div>
);

export interface PkTicketLineItem {
  qty?: string | number;
  name: string;
  amount?: string;
}

export interface PkTicketCardProps {
  code: string;
  timeAgo?: string;
  channelBadge?: {
    label: string;
    tone?: 'coral' | 'blue' | 'purple' | 'emerald' | 'amber' | 'slate';
  };
  title: string;
  subtitle?: string;
  metaLine?: string;
  items?: PkTicketLineItem[];
  highlightNote?: string;
  totalLabel?: string;
  totalValue?: string;
  paymentLabel?: string;
  statusPill?: {
    label: string;
    tone: 'amber' | 'blue' | 'purple' | 'emerald' | 'rose' | 'slate';
  };
  processNodes?: PkProcessStep[];
  extraBody?: React.ReactNode;
  primaryAction?: {
    label: string;
    tone: 'coral' | 'blue' | 'purple' | 'emerald' | 'amber' | 'navy';
    onClick: () => void;
    disabled?: boolean;
  };
  secondaryActions?: React.ReactNode;
}

export const PkTicketCard: React.FC<PkTicketCardProps> = ({
  code,
  timeAgo,
  channelBadge,
  title,
  subtitle,
  metaLine,
  items,
  highlightNote,
  totalLabel = 'TOTAL',
  totalValue,
  paymentLabel,
  statusPill,
  processNodes,
  extraBody,
  primaryAction,
  secondaryActions,
}) => (
  <div className="pk-ticket-card">
    <div className="pk-ticket-top">
      <div>
        <div className="pk-ticket-code">{code}</div>
        {timeAgo && <div className="pk-ticket-time">{timeAgo}</div>}
      </div>
      {channelBadge && (
        <span className={`pk-ticket-channel ${channelBadge.tone || 'slate'}`}>
          {channelBadge.label}
        </span>
      )}
    </div>

    <div className="pk-ticket-subject">
      <div className="pk-ticket-title">{title}</div>
      {subtitle && <div className="pk-ticket-sub">{subtitle}</div>}
    </div>

    {metaLine && <div className="pk-ticket-meta">{metaLine}</div>}

    {items && items.length > 0 && (
      <div className="pk-ticket-items">
        {items.map((it, i) => (
          <div className="pk-ticket-item-row" key={`${it.name}-${i}`}>
            <span>
              {it.qty !== undefined && it.qty !== '' && (
                <span className="pk-ticket-item-qty">{it.qty}×</span>
              )}
              <span>{it.name}</span>
            </span>
            {it.amount && <span className="pk-ticket-item-amt">{it.amount}</span>}
          </div>
        ))}
      </div>
    )}

    {highlightNote && <div className="pk-ticket-note">“{highlightNote}”</div>}

    {extraBody}

    {totalValue && (
      <div className="pk-ticket-total-row">
        <span>{totalLabel}</span>
        <span>{totalValue}</span>
      </div>
    )}

    {paymentLabel && <div className="pk-ticket-pay">💳 {paymentLabel}</div>}

    {processNodes && processNodes.length > 0 && (
      <div style={{ paddingTop: 4 }}>
        <PkProcessNodes steps={processNodes} compact />
      </div>
    )}

    {statusPill && (
      <span className={`pk-ticket-status-pill ${statusPill.tone}`}>
        <span>•</span>
        <span>{statusPill.label}</span>
      </span>
    )}

    {primaryAction && (
      <button
        type="button"
        disabled={primaryAction.disabled}
        className={`pk-ticket-cta ${primaryAction.tone}`}
        onClick={primaryAction.onClick}
      >
        {primaryAction.label}
      </button>
    )}

    {secondaryActions && (
      <div className="pk-row-actions" style={{ justifyContent: 'space-between', paddingTop: 2 }}>
        {secondaryActions}
      </div>
    )}
  </div>
);

export interface PkTypeCardOption {
  key: string;
  icon: string;
  title: string;
  description: string;
  badge?: string;
}

export const PkTypeCards: React.FC<{
  label?: string;
  options: PkTypeCardOption[];
  value: string;
  onChange: (key: string) => void;
  disabled?: boolean;
}> = ({ label, options, value, onChange, disabled = false }) => (
  <div>
    {label && <div className="pk-label" style={{ marginBottom: 10 }}>{label}</div>}
    <div className="pk-type-grid">
      {options.map((opt) => {
        const isActive = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            disabled={disabled}
            className={`pk-type-card${isActive ? ' active' : ''}`}
            onClick={() => onChange(opt.key)}
          >
            <span className="pk-type-icon">{opt.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span className="pk-type-title">{opt.title}</span>
                {opt.badge && <span className="pk-badge pk-badge-blue">{opt.badge}</span>}
              </div>
              <div className="pk-type-desc">{opt.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

export const PkFullscreenDialog: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  badge?: { label: string; tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' };
  onClose: () => void;
  subheader?: React.ReactNode;
  footerLeft?: React.ReactNode;
  footerActions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ open, title, subtitle, badge, onClose, subheader, footerLeft, footerActions, children }) => {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !document.querySelector('.pk-modal-backdrop')) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const badgeClass =
    badge?.tone === 'emerald'
      ? 'pk-badge pk-badge-emerald'
      : badge?.tone === 'amber'
      ? 'pk-badge pk-badge-amber'
      : badge?.tone === 'rose'
      ? 'pk-badge pk-badge-rose'
      : badge?.tone === 'slate'
      ? 'pk-badge pk-badge-slate'
      : 'pk-badge pk-badge-blue';

  return createPortal(
    <div className="pk-fs-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="pk-fs-header">
        <div className="pk-fs-header-main">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 className="pk-fs-title" id={titleId}>{title}</h2>
              {badge && <span className={badgeClass}>{badge.label}</span>}
            </div>
            {subtitle && <div className="pk-fs-subtitle">{subtitle}</div>}
          </div>
        </div>
        <button type="button" className="pk-btn pk-btn-hero-outline" onClick={onClose}>
          ✕ Cerrar Estudio
        </button>
      </div>

      {subheader && (
        <div className="pk-fs-subheader">
          <div style={{ maxWidth: 1540, margin: '0 auto' }}>{subheader}</div>
        </div>
      )}

      <div className="pk-fs-body">
        <div className="pk-fs-container">{children}</div>
      </div>

      {(footerLeft || footerActions) && (
        <div className="pk-fs-footer">
          <div>{footerLeft}</div>
          <div className="pk-row-actions">{footerActions}</div>
        </div>
      )}
    </div>,
    document.body
  );
};

export const PkProgressBar: React.FC<{
  label?: string;
  valueLabel?: string;
  pct: number;
  tone?: 'emerald' | 'blue' | 'amber' | 'rose' | 'purple';
}> = ({ label, valueLabel, pct, tone = 'blue' }) => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <div className="pk-meter-wrap">
      {(label || valueLabel) && (
        <div className="pk-meter-head">
          <span>{label || ''}</span>
          <span>{valueLabel || `${Math.round(clamped)}%`}</span>
        </div>
      )}
      <div className="pk-meter-track">
        <div className={`pk-meter-fill ${tone}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
};

export const PkDistributionStrip: React.FC<{
  title?: string;
  segments: { label: string; value: number; displayValue: string; color: string }[];
}> = ({ title, segments }) => {
  const total = segments.reduce((acc, s) => acc + Math.max(0, s.value || 0), 0);
  return (
    <div className="pk-dist-card">
      {title && (
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--pk-navy)' }}>{title}</div>
      )}
      <div className="pk-dist-bar">
        {total <= 0 ? (
          <div style={{ width: '100%', background: '#e2e8f0' }} />
        ) : (
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.label}
                title={`${s.label}: ${s.displayValue}`}
                style={{
                  width: `${Math.max(2, (s.value / total) * 100)}%`,
                  background: s.color,
                }}
              />
            ))
        )}
      </div>
      <div className="pk-dist-legend">
        {segments.map((s) => (
          <div className="pk-dist-legend-item" key={s.label}>
            <span className="pk-dist-swatch" style={{ background: s.color }} />
            <span>{s.label}:</span>
            <strong>{s.displayValue}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

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
