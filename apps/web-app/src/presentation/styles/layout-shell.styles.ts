/**
 * Estilos de Estructura (Shell) para los 3 Apartados Públicos y Plataforma Empresarial de Proveko (SOLID SRP <= 200 líneas).
 */
export function renderLayoutShellStylesCss(): string {
  return `
    :root {
      --pk-bg: #f1f5f9;
      --pk-card: #ffffff;
      --pk-text: #0f172a;
      --pk-muted: #475569;
      --pk-border: #cbd5e1;
      --pk-primary: #1d4ed8;
      --pk-primary-hover: #1e40af;
      --pk-emerald: #059669;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--pk-bg);
      color: var(--pk-text);
    }
    .pk-shell { min-height: 100vh; display: flex; flex-direction: column; }
    .pk-topbar {
      background: #ffffff;
      border-bottom: 1px solid var(--pk-border);
      padding: 10px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      flex-wrap: wrap;
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .pk-brand { display: flex; align-items: center; gap: 10px; }
    .pk-logo {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #1e3a8a, #2563eb);
      color: #fff; font-weight: 800; font-size: 15px;
      display: flex; align-items: center; justify-content: center;
    }
    .pk-title { font-weight: 800; font-size: 16px; letter-spacing: -0.02em; }
    .pk-subtitle { font-size: 11px; color: var(--pk-muted); }
    .pk-surface-tabs {
      display: flex; gap: 6px; background: #f1f5f9; padding: 4px;
      border-radius: 10px; border: 1px solid var(--pk-border);
    }
    .pk-tab-btn {
      border: 0; background: transparent; padding: 7px 13px; border-radius: 7px;
      font-size: 12px; font-weight: 700; color: var(--pk-muted); cursor: pointer;
    }
    .pk-tab-btn.active {
      background: #fff; color: var(--pk-primary);
      box-shadow: 0 1px 3px rgba(15,23,42,0.1);
    }
    .pk-context-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .surface { display: none; padding: 20px; max-width: 1440px; width: 100%; margin: 0 auto; }
    .surface.active { display: block; }
    .hero-banner {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      color: #fff; border-radius: 16px; padding: 26px;
      display: grid; grid-template-columns: 1.5fr 1fr; gap: 22px; margin-bottom: 20px;
    }
    .hero-badge {
      display: inline-block; background: rgba(59,130,246,0.25); border: 1px solid rgba(147,197,253,0.4);
      color: #bfdbfe; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; margin-bottom: 10px;
    }
    .hero-title { font-size: 25px; font-weight: 800; margin: 0 0 8px; line-height: 1.25; }
    .hero-sub { font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5; }
    .quote-card {
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18);
      border-radius: 14px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between;
    }
    .ws-layout { display: grid; grid-template-columns: 280px 1fr; gap: 18px; align-items: start; }
    .ws-sidebar {
      background: #fff; border: 1px solid var(--pk-border); border-radius: 14px;
      padding: 12px; position: sticky; top: 74px;
    }
    .ws-nav-head { font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--pk-muted); padding: 6px 8px; }
    .ws-nav-list { display: flex; flex-direction: column; gap: 5px; }
    .ws-nav-btn {
      text-align: left; border: 1px solid transparent; background: transparent;
      padding: 10px 12px; border-radius: 10px; cursor: pointer; transition: 0.15s;
    }
    .ws-nav-btn:hover { background: #f8fafc; border-color: var(--pk-border); }
    .ws-nav-btn.active { background: #eff6ff; border-color: #93c5fd; color: var(--pk-primary); }
    .ws-nav-title { font-size: 13px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    .ws-nav-sub { font-size: 11px; color: var(--pk-muted); margin-top: 2px; }
    .ws-main { display: flex; flex-direction: column; gap: 16px; }
  `;
}

export const renderProvekoLayoutShellCss = renderLayoutShellStylesCss;
