/**
 * Tokens de Identidad Visual Institucional de Proveko (SOLID SRP).
 * Paleta ejecutiva sobria de alto contraste contable y tipografía tabular.
 */
export function renderProvekoDesignTokensCss(): string {
  return `
    :root {
      --bg-canvas: #F8FAFC;
      --bg-surface: #FFFFFF;
      --border-hairline: #E2E8F0;
      --border-strong: #CBD5E1;
      --nav-bg: #0F172A;
      --nav-bg-hover: #1E293B;
      --nav-text-muted: #94A3B8;
      --nav-text-active: #F8FAFC;
      --brand-primary: #1D4ED8;
      --brand-primary-hover: #1E40AF;
      --brand-primary-soft: #EFF6FF;
      --text-primary: #0F172A;
      --text-secondary: #334155;
      --text-muted: #64748B;
      --status-emerald-fg: #15803D;
      --status-emerald-bg: #DCFCE7;
      --status-amber-fg: #B45309;
      --status-amber-bg: #FEF3C7;
      --status-crimson-fg: #B91C1C;
      --status-crimson-bg: #FEE2E2;
      --status-slate-fg: #475569;
      --status-slate-bg: #F1F5F9;
      --font-sans: 'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif;
      --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-sans);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font-size: 14px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .tabular-nums {
      font-variant-numeric: tabular-nums;
      font-feature-settings: "tnum" 1, "zero" 1;
    }

    .mono {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }

    .hidden {
      display: none !important;
    }
  `;
}
