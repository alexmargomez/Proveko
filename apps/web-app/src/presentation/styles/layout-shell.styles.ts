/**
 * Estilos de Estructura (Shell) para las 4 Superficies de Proveko (SOLID SRP):
 * 1. Portada Pública y Armador de Plan (`/`)
 * 2. Login Inteligente (`/login`)
 * 3. Consola Maestra del SuperAdmin Global (`/superadmin`)
 * 4. Plataforma Unificada de Gestión Empresarial (`/app`)
 */
export function renderProvekoLayoutShellCss(): string {
  return `
    .topbar {
      height: 62px;
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 22px;
      position: sticky;
      top: 0;
      z-index: 40;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
    }
    .brand { display: flex; align-items: center; gap: 12px; cursor: pointer; }
    .brand-mark {
      width: 36px; height: 36px; border-radius: 9px;
      background: linear-gradient(135deg, #1D4ED8 0%, #0F172A 100%);
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 14px; letter-spacing: 0.5px;
    }
    .brand-title { font-weight: 800; font-size: 16px; letter-spacing: -0.02em; color: var(--text-primary); }
    .brand-sub { font-size: 11.5px; color: var(--text-muted); font-weight: 500; }

    .surface-switcher {
      display: flex; align-items: center; gap: 5px;
      background: var(--status-slate-bg); padding: 4px; border-radius: 9px;
      border: 1px solid var(--border-hairline);
    }
    .surface-tab {
      border: none; background: transparent; color: var(--text-secondary);
      font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px;
      cursor: pointer; transition: all 0.15s;
    }
    .surface-tab.active {
      background: var(--bg-surface); color: var(--brand-primary);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08); font-weight: 700;
    }

    .topbar-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .ctrl-pill {
      display: flex; align-items: center; gap: 6px;
      background: var(--status-slate-bg); border: 1px solid var(--border-hairline);
      padding: 5px 11px; border-radius: 7px; font-size: 12px;
    }
    .ctrl-pill label { color: var(--text-muted); font-weight: 700; font-size: 10.5px; text-transform: uppercase; }
    .ctrl-pill select {
      border: none; background: transparent; font-weight: 700; color: var(--text-primary);
      font-size: 12px; outline: none; font-family: inherit; cursor: pointer;
    }

    /* Superficie 1: Portada Comercial y Armador de Plan */
    .landing-shell { max-width: 1320px; margin: 0 auto; padding: 26px 24px 60px; }
    .hero-banner {
      background: linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%);
      color: #F8FAFC; border-radius: 16px; padding: 34px;
      display: grid; grid-template-columns: 1.45fr 1fr; gap: 28px;
      border: 1px solid #334155; margin-bottom: 26px;
    }
    .hero-eyebrow {
      display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: #93C5FD; background: rgba(255, 255, 255, 0.1);
      padding: 4px 12px; border-radius: 999px; margin-bottom: 12px;
    }
    .hero-title { font-size: 29px; font-weight: 800; line-height: 1.2; letter-spacing: -0.02em; margin-bottom: 10px; }
    .hero-lead { font-size: 14px; color: #DBEAFE; margin-bottom: 20px; max-width: 660px; }
    .quote-box {
      background: rgba(15, 23, 42, 0.84); border: 1px solid #3B82F6;
      border-radius: 12px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;
    }
    .quote-price { font-size: 30px; font-weight: 800; color: #fff; }

    /* Superficie 4: Plataforma de Gestión Empresarial Unificada (/app) */
    .workstation-layout { display: grid; grid-template-columns: 270px 1fr; min-height: calc(100vh - 62px); }
    .sidebar {
      background: var(--nav-bg); color: var(--nav-text-active);
      padding: 18px 12px; display: flex; flex-direction: column; gap: 14px;
      border-right: 1px solid #1E293B;
    }
    .sidebar-section-title {
      font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--nav-text-muted); font-weight: 700; padding: 0 10px;
    }
    .center-nav-btn {
      width: 100%; text-align: left; border: 1px solid transparent;
      background: rgba(30, 41, 59, 0.45); color: #CBD5E1;
      padding: 11px 12px; border-radius: 9px; cursor: pointer;
      display: flex; align-items: center; gap: 10px; transition: all 0.14s;
      margin-bottom: 6px; font-family: inherit;
    }
    .center-nav-btn:hover { background: var(--nav-bg-hover); color: #fff; }
    .center-nav-btn.active {
      background: var(--brand-primary); color: #fff; font-weight: 700;
      box-shadow: 0 4px 12px rgba(29, 78, 216, 0.35);
    }
    .main-stage { padding: 22px 26px; display: flex; flex-direction: column; gap: 18px; overflow-x: hidden; }
    .kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  `;
}
