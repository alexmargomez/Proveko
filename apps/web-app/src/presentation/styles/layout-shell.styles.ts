/**
 * Estilos de Estructura (Shell) 100% Pantalla Completa para Proveko:
 * Menú Lateral Fijo a la Izquierda (`#023047`) y Área Operativa al 100% del Ancho (SOLID SRP <= 200 líneas).
 */
export function renderLayoutShellStylesCss(): string {
  return `
    :root {
      --pk-bg: #f1f5f9;
      --pk-card: #ffffff;
      --pk-text: #0f172a;
      --pk-muted: #475569;
      --pk-border: #cbd5e1;
      --pk-primary: #023047;
      --pk-primary-hover: #1e40af;
      --pk-emerald: #059669;
      --pk-amber: #d97706;
      --pk-rose: #e11d48;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 100vh;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--pk-bg);
      color: var(--pk-text);
    }
    .pk-shell { width: 100%; min-height: 100vh; display: flex; flex-direction: column; }
    .pk-topbar {
      background: #ffffff;
      border-bottom: 1px solid var(--pk-border);
      padding: 8px 20px;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .pk-brand { display: flex; align-items: center; gap: 10px; }
    .pk-logo {
      width: 34px; height: 34px; border-radius: 9px;
      background: #ffb703;
      color: #023047; font-weight: 900; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
    }
    .pk-title { font-weight: 800; font-size: 15px; letter-spacing: -0.02em; color: #023047; }
    .pk-subtitle { font-size: 11px; color: var(--pk-muted); }
    .pk-surface-tabs {
      display: flex; gap: 4px; background: #f1f5f9; padding: 3px;
      border-radius: 9px; border: 1px solid var(--pk-border);
    }
    .pk-tab-btn {
      border: 0; background: transparent; padding: 6px 12px; border-radius: 7px;
      font-size: 12px; font-weight: 700; color: var(--pk-muted); cursor: pointer;
    }
    .pk-tab-btn.active {
      background: #023047; color: #fff;
      box-shadow: 0 1px 3px rgba(15,23,42,0.12);
    }
    .pk-context-bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .surface { display: none; padding: 16px 22px; width: 100%; max-width: 100%; margin: 0; flex: 1; }
    .surface.active { display: block; }
    #surface-workstation.surface { padding: 0; }
    #demo-mode-banner { border-radius: 0 !important; margin-bottom: 0 !important; padding: 8px 20px !important; }
    .hero-banner {
      background: linear-gradient(135deg, #023047 0%, #1e3a8a 100%);
      color: #fff; border-radius: 16px; padding: 24px;
      display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; margin-bottom: 18px;
    }
    .hero-badge {
      display: inline-block; background: rgba(255,183,3,0.2); border: 1px solid rgba(255,183,3,0.45);
      color: #fde68a; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; margin-bottom: 10px;
    }
    .hero-title { font-size: 24px; font-weight: 800; margin: 0 0 8px; line-height: 1.25; }
    .hero-sub { font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5; }
    .quote-card {
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18);
      border-radius: 14px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between;
    }
    .ws-layout {
      display: grid;
      grid-template-columns: 235px minmax(0, 1fr);
      gap: 0;
      width: 100%;
      min-height: calc(100vh - 52px);
      align-items: stretch;
    }
    .ws-sidebar {
      background: #023047; color: #fff;
      padding: 14px 10px;
      min-height: calc(100vh - 52px);
      border-right: 1px solid rgba(255,255,255,0.1);
    }
    .ws-nav-head { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #94a3b8; padding: 4px 8px; letter-spacing: 0.05em; }
    .ws-nav-list { display: flex; flex-direction: column; gap: 4px; }
    .ws-nav-btn {
      text-align: left; border: 0; background: transparent; color: #e2e8f0;
      padding: 9px 11px; border-radius: 10px; cursor: pointer; transition: 0.15s;
      display: flex; align-items: center; gap: 10px; width: 100%;
    }
    .ws-nav-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .ws-nav-btn.active { background: #ffb703; color: #023047; font-weight: 800; box-shadow: 0 2px 6px rgba(0,0,0,0.2); }
    .ws-nav-icon { font-size: 18px; line-height: 1; flex-shrink: 0; }
    .ws-nav-title { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ws-main { display: flex; flex-direction: column; gap: 12px; min-width: 0; width: 100%; padding: 14px 20px; }
    .ws-top-subbar {
      background: #fff; border: 1px solid var(--pk-border); border-radius: 12px;
      padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; width: 100%;
    }
    .ws-top-subbar-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
    .ws-subtabs-row { display: flex; gap: 6px; flex-wrap: wrap; padding-top: 8px; border-top: 1px solid #e2e8f0; }
    .ws-subtab-pill {
      border: 1px solid #cbd5e1; background: #f8fafc; color: #334155;
      padding: 7px 13px; border-radius: 9px; font-size: 12px; font-weight: 700;
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: 0.15s;
    }
    .ws-subtab-pill:hover { background: #e2e8f0; }
    .ws-subtab-pill.active { background: #023047; color: #fff; border-color: #023047; }
  `;
}

export const renderProvekoLayoutShellCss = renderLayoutShellStylesCss;
