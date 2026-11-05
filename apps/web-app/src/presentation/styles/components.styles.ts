/**
 * Estilos de Componentes Operativos Ricos (Tablas Dinámicas, Switches de Componentes, Modales de Pago y Credenciales) (SOLID SRP).
 */
export function renderProvekoComponentsCss(): string {
  return `
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
      overflow: hidden;
    }
    .card-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border-hairline);
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    }
    .card-title { font-weight: 800; font-size: 14.5px; color: var(--text-primary); }
    .card-body { padding: 18px; }

    .kpi-card {
      background: var(--bg-surface); border: 1px solid var(--border-hairline);
      border-radius: 11px; padding: 14px 16px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .kpi-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); }
    .kpi-value { font-size: 20px; font-weight: 800; color: var(--text-primary); }
    .kpi-sub { font-size: 11.5px; color: var(--text-muted); }

    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700;
    }
    .badge-emerald { background: var(--status-emerald-bg); color: var(--status-emerald-fg); }
    .badge-amber { background: var(--status-amber-bg); color: var(--status-amber-fg); }
    .badge-crimson { background: var(--status-crimson-bg); color: var(--status-crimson-fg); }
    .badge-slate { background: var(--status-slate-bg); color: var(--status-slate-fg); }
    .badge-blue { background: var(--brand-primary-soft); color: var(--brand-primary); }

    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 7px;
      padding: 8px 14px; border-radius: 8px; font-weight: 700; font-size: 12.5px;
      cursor: pointer; border: 1px solid transparent; transition: all 0.15s; font-family: inherit;
    }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-primary { background: var(--brand-primary); color: #fff; }
    .btn-primary:hover:not(:disabled) { background: var(--brand-primary-hover); }
    .btn-emerald { background: #15803D; color: #fff; }
    .btn-emerald:hover:not(:disabled) { background: #166534; }
    .btn-outline { background: #fff; border-color: var(--border-strong); color: var(--text-secondary); }
    .btn-outline:hover:not(:disabled) { background: var(--status-slate-bg); }

    .form-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .form-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .form-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .form-group { margin-bottom: 10px; }
    .form-label { display: block; font-size: 11.5px; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px; }
    .form-control {
      width: 100%; padding: 8px 10px; border: 1px solid var(--border-strong);
      border-radius: 7px; font-size: 13px; font-family: inherit; color: var(--text-primary); background: #fff;
    }
    .form-control:focus { outline: 2px solid var(--brand-primary); border-color: transparent; }

    /* Barra de Componentes Conmutables en la Misma Vista */
    .comp-toggles-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      background: #F8FAFC; border: 1px solid var(--border-hairline);
      padding: 10px 14px; border-radius: 10px;
    }
    .comp-chip {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 10px; border-radius: 7px; font-size: 12px; font-weight: 600;
      border: 1px solid var(--border-strong); background: #fff; cursor: pointer;
    }
    .comp-chip.on {
      border-color: var(--brand-primary); background: var(--brand-primary-soft); color: var(--brand-primary);
    }

    .data-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .data-table th {
      text-align: left; padding: 10px 12px; background: var(--status-slate-bg);
      color: var(--text-secondary); font-weight: 700; font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border-hairline);
    }
    .data-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-hairline); color: var(--text-primary); vertical-align: middle; }
    .data-table tr:hover td { background: #F8FAFC; }

    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65);
      display: flex; align-items: center; justify-content: center; z-index: 90; padding: 20px;
    }
    .modal-box {
      background: #fff; border-radius: 14px; max-width: 680px; width: 100%;
      border: 1px solid var(--border-hairline); box-shadow: 0 20px 45px rgba(15, 23, 42, 0.25);
      overflow: hidden; max-height: 90vh; overflow-y: auto;
    }

    @media (max-width: 1024px) {
      .hero-banner, .workstation-layout, .kpi-strip, .form-grid-2, .form-grid-3, .form-grid-4 {
        grid-template-columns: 1fr;
      }
    }
  `;
}
