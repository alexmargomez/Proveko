/**
 * Estilos de Componentes Operativos Ricos (Tarjetas, Tablas, Asistente de Registro y Modales) (SOLID SRP <= 200 líneas).
 */
export function renderComponentsStylesCss(): string {
  return `
    .preset-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    .preset-chip {
      border: 1px solid var(--pk-border); background: #fff; border-radius: 999px;
      padding: 7px 14px; font-size: 12px; font-weight: 700; cursor: pointer;
    }
    .preset-chip.active { background: var(--pk-primary); color: #fff; border-color: var(--pk-primary); }
    .center-selector-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .center-pick-card {
      background: #fff; border: 2px solid var(--pk-border); border-radius: 14px;
      padding: 16px; transition: 0.15s;
    }
    .center-pick-card.selected { border-color: var(--pk-primary); background: #f8faff; }
    .center-pick-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px; }
    .center-pick-title { font-weight: 800; font-size: 14px; }
    .center-pick-price { font-size: 12px; font-weight: 800; color: var(--pk-primary); background: #dbeafe; padding: 3px 8px; border-radius: 6px; }
    .center-pick-desc { font-size: 12px; color: var(--pk-muted); margin-bottom: 10px; line-height: 1.4; }
    .comp-toggle-list { display: flex; flex-direction: column; gap: 6px; border-top: 1px dashed var(--pk-border); padding-top: 10px; }
    .comp-toggle-pill {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      font-size: 11px; background: #f8fafc; padding: 6px 9px; border-radius: 7px; border: 1px solid #e2e8f0;
    }
    .card { background: #fff; border: 1px solid var(--pk-border); border-radius: 14px; overflow: hidden; }
    .card-head {
      padding: 14px 18px; border-bottom: 1px solid var(--pk-border);
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
      background: #f8fafc;
    }
    .card-title { font-size: 15px; font-weight: 800; }
    .card-body { padding: 18px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field label { font-size: 11px; font-weight: 700; color: var(--pk-muted); text-transform: uppercase; }
    .field input, .field select {
      padding: 9px 11px; border: 1px solid var(--pk-border); border-radius: 8px;
      font-size: 13px; background: #fff; color: var(--pk-text);
    }
    .btn {
      border: 0; border-radius: 9px; padding: 9px 15px; font-size: 12px; font-weight: 700;
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    }
    .btn-primary { background: var(--pk-primary); color: #fff; }
    .btn-emerald { background: var(--pk-emerald); color: #fff; }
    .btn-outline { background: #fff; border: 1px solid var(--pk-border); color: var(--pk-text); }
    .btn-sm { padding: 5px 10px; font-size: 11px; }
    .badge {
      display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px;
      border-radius: 999px; font-size: 11px; font-weight: 700;
    }
    .badge-emerald { background: #d1fae5; color: #065f46; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-slate { background: #f1f5f9; color: #334155; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      text-align: left; padding: 10px 12px; background: #f1f5f9; color: var(--pk-muted);
      font-size: 11px; text-transform: uppercase; border-bottom: 1px solid var(--pk-border);
    }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    .kpi-box { background: #fff; border: 1px solid var(--pk-border); border-radius: 12px; padding: 14px; }
    .kpi-label { font-size: 11px; color: var(--pk-muted); font-weight: 700; text-transform: uppercase; }
    .kpi-val { font-size: 20px; font-weight: 800; margin-top: 4px; }
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(15,23,42,0.65);
      display: none; align-items: center; justify-content: center; z-index: 80; padding: 20px;
    }
    .modal-backdrop.open { display: flex; }
    .modal-box {
      background: #fff; border-radius: 16px; max-width: 620px; width: 100%;
      border: 1px solid var(--pk-border); overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.25);
    }
    .modal-head { padding: 16px 20px; background: #0f172a; color: #fff; display: flex; justify-content: space-between; align-items: center; }
    .modal-body { padding: 20px; }
    .cred-box {
      background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.6;
    }
    .row-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .toast {
      position: fixed; bottom: 18px; right: 18px; background: #0f172a; color: #fff;
      padding: 12px 18px; border-radius: 10px; font-size: 12px; font-weight: 700;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25); display: none; z-index: 95;
    }
    .toast.show { display: block; }
    @media (max-width: 1024px) {
      .hero-banner, .center-selector-grid, .ws-layout, .grid-2, .grid-3, .kpi-row { grid-template-columns: 1fr; }
    }
  `;
}

export const renderProvekoComponentsCss = renderComponentsStylesCss;
