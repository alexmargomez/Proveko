/**
 * Estilos de Componentes Operativos (Formularios Guiados, Grillas Contables, Badges y Drawer Zero-Trust) (SOLID SRP).
 */
export function renderProvekoComponentsCss(): string {
  return `
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-hairline);
      border-radius: 10px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
      overflow: hidden;
    }
    .card-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border-hairline);
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .card-title { font-weight: 700; font-size: 14px; color: var(--text-primary); }
    .card-body { padding: 16px 18px; }

    /* Tarjetas KPI */
    .kpi-card {
      background: var(--bg-surface); border: 1px solid var(--border-hairline);
      border-radius: 10px; padding: 14px 16px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .kpi-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); }
    .kpi-value { font-size: 18px; font-weight: 800; color: var(--text-primary); }
    .kpi-sub { font-size: 11px; color: var(--text-muted); }

    /* Badges Semánticos */
    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
    }
    .badge-emerald { background: var(--status-emerald-bg); color: var(--status-emerald-fg); }
    .badge-amber { background: var(--status-amber-bg); color: var(--status-amber-fg); }
    .badge-crimson { background: var(--status-crimson-bg); color: var(--status-crimson-fg); }
    .badge-slate { background: var(--status-slate-bg); color: var(--status-slate-fg); }
    .badge-blue { background: var(--brand-primary-soft); color: var(--brand-primary); }

    /* Botones */
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 8px 14px; border-radius: 7px; font-weight: 600; font-size: 13px;
      cursor: pointer; border: 1px solid transparent; transition: all 0.15s; font-family: inherit;
    }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-primary { background: var(--brand-primary); color: #fff; }
    .btn-primary:hover:not(:disabled) { background: var(--brand-primary-hover); }
    .btn-outline { background: #fff; border-color: var(--border-strong); color: var(--text-secondary); }
    .btn-outline:hover:not(:disabled) { background: var(--status-slate-bg); }

    /* Formularios Guiados de Negocio */
    .form-group { margin-bottom: 12px; }
    .form-label {
      display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;
    }
    .form-control {
      width: 100%; padding: 8px 10px; border: 1px solid var(--border-strong);
      border-radius: 6px; font-size: 13px; font-family: inherit; color: var(--text-primary);
      background: #fff;
    }
    .form-control:focus { outline: 2px solid var(--brand-primary); border-color: transparent; }
    .form-helper { font-size: 11px; color: var(--text-muted); margin-top: 3px; }

    /* Banners de Capacidad (<CapabilityGate> / <ReadonlyArchiveBanner>) */
    .gate-banner {
      padding: 13px 16px; border-radius: 8px; font-size: 13px;
      display: flex; align-items: center; justify-content: space-between; gap: 14px;
    }
    .gate-readonly { background: var(--status-amber-bg); color: var(--status-amber-fg); border: 1px solid #FCD34D; }
    .gate-locked { background: var(--status-crimson-bg); color: var(--status-crimson-fg); border: 1px solid #FCA5A5; }

    /* Grilla Contable de Alta Densidad */
    .data-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .data-table th {
      text-align: left; padding: 10px 12px; background: var(--status-slate-bg);
      color: var(--text-secondary); font-weight: 700; font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--border-hairline);
    }
    .data-table td { padding: 10px 12px; border-bottom: 1px solid var(--border-hairline); color: var(--text-primary); }
    .data-table tr:hover td { background: #F8FAFC; }

    /* Presets y Configurador en Portada */
    .preset-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 22px; }
    .preset-card {
      background: #fff; border: 1px solid var(--border-hairline); border-radius: 10px;
      padding: 16px; cursor: pointer; transition: all 0.15s; text-align: left;
    }
    .preset-card:hover, .preset-card.active {
      border-color: var(--brand-primary); box-shadow: 0 4px 12px rgba(29, 78, 216, 0.10);
    }
    .configurator-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }

    @media (max-width: 1024px) {
      .hero-banner, .workstation-layout, .workspace-grid, .preset-grid, .configurator-grid, .kpi-strip {
        grid-template-columns: 1fr;
      }
    }
  `;
}
