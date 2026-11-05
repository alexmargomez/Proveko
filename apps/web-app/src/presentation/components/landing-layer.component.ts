/**
 * Componente de Presentación — Capa 1 (`/`):
 * Portada Comercial B2B y Configurador Modular Interactivo con Cotización en Tiempo Real (SOLID SRP).
 */
export function renderCommercialLandingLayerHtml(initialHidden: boolean): string {
  return `
  <section id="surface-landing" class="landing-shell ${initialHidden ? 'hidden' : ''}" aria-label="Portada Comercial y Configurador Proveko">
    <div class="hero-banner">
      <div>
        <span class="hero-eyebrow">Ecosistema Empresarial Componible · Base Dedicada por Empresa</span>
        <h1 class="hero-title">Activa únicamente los microservicios y módulos que tu operación necesita hoy</h1>
        <p class="hero-lead">
          Desde un mostrador POS con inventario hasta restaurantes con comandera KDS, hoteles con rack de habitaciones
          o corporativos con Facturación Electrónica DIAN y Contabilidad PUC/NIIF de partida doble. Sin perder jamás tu histórico al crecer.
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" onclick="window.provekoSwitchSurface('workstation')">
            Entrar a Estación de Trabajo (/app) →
          </button>
          <button type="button" class="btn btn-outline" style="background:rgba(255,255,255,0.08); color:#fff; border-color:#475569;" onclick="window.provekoApplyPreset('preset:distributor-pharma-lots'); window.provekoSwitchSurface('workstation');">
            Probar Demo Corporativa Completa
          </button>
        </div>
      </div>

      <div class="quote-box">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#93C5FD; font-weight:700;">Cotización Mensual Estimada</span>
            <span id="quote-subver-pill" class="badge badge-blue mono">sub_ver: 1</span>
          </div>
          <div id="quote-total-cop" class="quote-price tabular-nums">$149.000 COP / mes</div>
          <div id="quote-breakdown-text" style="font-size:12px; color:#94A3B8; margin-top:4px;">
            3 Microservicios Contenedores · 4 Módulos Operativos Activos
          </div>
        </div>
        <div style="border-top:1px solid #334155; padding-top:12px; margin-top:14px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:11px; color:#CBD5E1;">Base PostgreSQL Aislada + Firma Ed25519</span>
          <button type="button" class="btn btn-primary" style="padding:6px 12px; font-size:12px;" onclick="window.provekoSwitchSurface('workstation')">
            Operar con esta Selección
          </button>
        </div>
      </div>
    </div>

    <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h2 style="font-size:16px; font-weight:800;">1. Plantillas Pre-Configuradas por Giro de Negocio</h2>
        <p style="font-size:12px; color:var(--text-muted);">Selecciona el giro de tu empresa para pre-cargar los microservicios recomendados en 1 clic.</p>
      </div>
    </div>
    <div id="landing-presets-grid" class="preset-grid"></div>

    <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <h2 style="font-size:16px; font-weight:800;">2. Configurador Modular a la Carta (6 Microservicios · 20 Módulos)</h2>
        <p style="font-size:12px; color:var(--text-muted);">
          Activa o desactiva contenedores padre (<code>ms:*</code>) y módulos hijos (<code>mod:*</code>). Los módulos con evolución automática conservan tu histórico en modo lectura.
        </p>
      </div>
    </div>
    <div id="landing-configurator-grid" class="configurator-grid"></div>
  </section>
  `;
}
