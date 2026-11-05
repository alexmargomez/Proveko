/**
 * Estilos de Estructura (Shell) para las 2 Capas del Producto (SOLID SRP):
 * - Capa 1 (`/`): Portada Comercial B2B y Configurador Modular en Vivo.
 * - Capa 2 (`/app`): Estación de Trabajo Privada Multi-Sucursal.
 */
export function renderProvekoLayoutShellCss(): string {
  return `
    /* Barra Superior Institucional */
    .topbar {
      height: 60px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-mark {
      width: 34px; height: 34px; border-radius: 8px;
      background: var(--nav-bg); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 14px; letter-spacing: 0.5px;
      border: 1px solid #334155;
    }
    .brand-title { font-weight: 700; font-size: 16px; letter-spacing: -0.02em; color: var(--text-primary); }
    .brand-sub { font-size: 11px; color: var(--text-muted); font-weight: 500; }

    .surface-switcher {
      display: flex; align-items: center; gap: 6px;
      background: var(--status-slate-bg); padding: 4px; border-radius: 8px;
      border: 1px solid var(--border-hairline);
    }
    .surface-tab {
      border: none; background: transparent; color: var(--text-secondary);
      font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px;
      cursor: pointer; transition: all 0.15s;
    }
    .surface-tab.active {
      background: var(--bg-surface); color: var(--brand-primary);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }

    .topbar-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .ctrl-pill {
      display: flex; align-items: center; gap: 6px;
      background: var(--status-slate-bg); border: 1px solid var(--border-hairline);
      padding: 4px 10px; border-radius: 6px; font-size: 12px;
    }
    .ctrl-pill label { color: var(--text-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; }
    .ctrl-pill select, .ctrl-pill input {
      border: none; background: transparent; font-weight: 600; color: var(--text-primary);
      font-size: 12px; outline: none; font-family: inherit;
    }

    /* Capa 1: Portada Comercial Pública (/) */
    .landing-shell { max-width: 1280px; margin: 0 auto; padding: 28px 24px 56px; }
    .hero-banner {
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
      color: #F8FAFC; border-radius: 14px; padding: 32px;
      display: grid; grid-template-columns: 1.4fr 1fr; gap: 28px;
      border: 1px solid #334155; margin-bottom: 24px;
    }
    .hero-eyebrow {
      display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: #93C5FD; background: rgba(29, 78, 216, 0.35);
      padding: 4px 10px; border-radius: 999px; margin-bottom: 12px;
    }
    .hero-title { font-size: 28px; font-weight: 800; line-height: 1.2; letter-spacing: -0.02em; margin-bottom: 10px; }
    .hero-lead { font-size: 14px; color: #CBD5E1; margin-bottom: 20px; max-width: 640px; }
    .quote-box {
      background: rgba(15, 23, 42, 0.78); border: 1px solid #334155;
      border-radius: 12px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;
    }
    .quote-price { font-size: 28px; font-weight: 800; color: #fff; }

    /* Capa 2: Estación de Trabajo Privada (/app) */
    .workstation-layout { display: grid; grid-template-columns: 285px 1fr; min-height: calc(100vh - 60px); }
    .sidebar {
      background: var(--nav-bg); color: var(--nav-text-active);
      padding: 16px 12px; display: flex; flex-direction: column; gap: 14px;
      border-right: 1px solid #1E293B;
    }
    .sidebar-section-title {
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--nav-text-muted); font-weight: 700; padding: 0 8px;
    }
    .svc-group {
      background: rgba(30, 41, 59, 0.55); border: 1px solid #1E293B;
      border-radius: 8px; overflow: hidden; margin-bottom: 8px;
    }
    .svc-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 10px; background: rgba(15, 23, 42, 0.65);
      font-size: 12px; font-weight: 700; color: #E2E8F0;
    }
    .mod-list { padding: 4px; display: flex; flex-direction: column; gap: 2px; }
    .mod-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 7px 8px; border-radius: 6px; cursor: pointer;
      color: #CBD5E1; font-size: 12px; transition: background 0.12s;
    }
    .mod-item:hover { background: var(--nav-bg-hover); color: #fff; }
    .mod-item.active { background: var(--brand-primary); color: #fff; font-weight: 600; }
    .main-stage { padding: 22px 26px; display: flex; flex-direction: column; gap: 18px; overflow-x: hidden; }
    .kpi-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .workspace-grid { display: grid; grid-template-columns: 410px 1fr; gap: 18px; align-items: start; }
  `;
}
