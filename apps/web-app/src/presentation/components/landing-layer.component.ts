/**
 * Superficie 1 (`/`): Portada Pública, Armador de Plan por Centros y Componentes,
 * Ventana de Pagos en Standby (`ms-payments`) y Certificado de Credenciales del Cliente (SOLID SRP).
 */
export function renderCommercialLandingLayerHtml(initialHidden: boolean): string {
  return `
  <section id="surface-landing" class="landing-shell ${initialHidden ? 'hidden' : ''}" aria-label="Portada y Constructor de Plan Proveko">
    <div class="hero-banner">
      <div>
        <span class="hero-eyebrow">Plataforma Empresarial Integrada · Todo tu Negocio en Un Solo Lugar</span>
        <h1 class="hero-title">Arma el sistema exacto para tu empresa, activa sus componentes y empieza a operar en minutos</h1>
        <p class="hero-lead">
          Facturación y POS, Inventario y Recetas, Comandas y Reserva de Cupos, Control de Tractomulas y Báscula,
          Terceros y Finanzas en una sola plataforma unificada. Elige qué centros y qué funciones necesitas hoy.
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button type="button" class="btn btn-emerald" onclick="window.provekoOpenCheckoutModal()">
            💳 Registrar Empresa e Ir a Ventana de Pago →
          </button>
          <button type="button" class="btn btn-outline" style="background:rgba(255,255,255,0.1); color:#fff; border-color:#60A5FA;" onclick="window.provekoSwitchSurface('login')">
            🔐 Ya tengo cuenta · Iniciar Sesión
          </button>
        </div>
      </div>

      <div class="quote-box">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:11px; text-transform:uppercase; letter-spacing:0.06em; color:#93C5FD; font-weight:700;">Resumen de Tu Plan Personalizado</span>
            <span class="badge badge-emerald">Pasarela en Standby</span>
          </div>
          <div id="quote-total-cop" class="quote-price tabular-nums">$253.000 COP / mes</div>
          <div id="quote-breakdown-text" style="font-size:12.5px; color:#CBD5E1; margin-top:6px;">
            5 Centros Operativos · 16 Componentes Funcionales Activos
          </div>
        </div>
        <div style="border-top:1px solid #334155; padding-top:14px; margin-top:14px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
          <span style="font-size:11.5px; color:#93C5FD;">Genera tu credencial de SuperAdmin de Empresa al instante</span>
          <button type="button" class="btn btn-primary" onclick="window.provekoOpenCheckoutModal()">
            Contratar y Generar Credenciales
          </button>
        </div>
      </div>
    </div>

    <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
      <div>
        <h2 style="font-size:18px; font-weight:800;">1. Elige los Centros Operativos y Componentes para tu Empresa</h2>
        <p style="font-size:12.5px; color:var(--text-muted);">
          Marca o desmarca tanto los módulos principales como los componentes específicos dentro de cada pantalla (ej. nombre de cajero, propina, báscula, recetas o reserva de cupos).
        </p>
      </div>
      <div style="display:flex; gap:8px;">
        <button type="button" class="btn btn-outline" onclick="window.provekoSelectBuilderPreset('ALL')">Activar Todo</button>
        <button type="button" class="btn btn-outline" onclick="window.provekoSelectBuilderPreset('GASTRO')">Giro Restaurante / Eventos</button>
        <button type="button" class="btn btn-outline" onclick="window.provekoSelectBuilderPreset('LOGISTICS')">Giro Agro / Tractomulas</button>
      </div>
    </div>

    <div id="landing-configurator-grid" class="form-grid-2"></div>
  </section>

  <!-- Modal Ventana de Pagos (Microservicio de Pagos en Standby) + Generador de Credenciales del Cliente -->
  <div id="checkout-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true">
    <div class="modal-box">
      <div class="card-header" style="background:#0F172A; color:#fff;">
        <div>
          <div style="font-size:11px; color:#93C5FD; font-weight:700; text-transform:uppercase;">Microservicio de Pagos · Modo Standby Activo</div>
          <div class="card-title" style="color:#fff; font-size:16px;">Registro de Empresa y Ventana de Pago de Suscripción</div>
        </div>
        <button type="button" class="btn btn-outline" style="padding:4px 10px; background:#1E293B; color:#fff; border-color:#334155;" onclick="window.provekoCloseCheckoutModal()">✕ Cerrar</button>
      </div>
      <div id="checkout-modal-body" class="card-body"></div>
    </div>
  </div>
  `;
}
