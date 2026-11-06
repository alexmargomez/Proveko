/**
 * Superficie Pública — Apartado 1: Portada Comercial Limpia y Directa (Sin jerga técnica).
 */
export function renderLandingLayerHtml(): string {
  return `
  <!-- APARTADO 1: PORTADA COMERCIAL -->
  <section class="surface active" id="surface-showcase">
    <div class="hero-banner">
      <div>
        <span class="hero-badge">SISTEMA DE VENTAS, INVENTARIO Y CONTROL DE NEGOCIOS</span>
        <h1 class="hero-title">Administra tu negocio de forma fácil: Facturación, Inventario, Comandas, Taller y Caja en un solo lugar.</h1>
        <p class="hero-sub">
          Selecciona el tipo de negocio que tienes y empieza a vender y controlar tus cuentas hoy mismo.
        </p>
        <div class="row-actions" style="margin-top:16px">
          <button type="button" class="btn btn-primary" id="btn-hero-go-register">🚀 Crear Cuenta para mi Negocio</button>
          <button type="button" class="btn btn-hero-outline" id="btn-hero-go-demo">🖥️ Ver Demostración en Vivo</button>
          <button type="button" class="btn btn-hero-outline" id="btn-hero-go-login">🔐 Iniciar Sesión</button>
        </div>
      </div>
      <div class="quote-card">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#fde68a;font-weight:800">Listo para usar</div>
        <div style="font-size:18px;font-weight:800;margin:6px 0">Todo lo que tu empresa necesita</div>
        <div style="font-size:12px;color:#cbd5e1;line-height:1.6;margin-bottom:12px">
          • Punto de Venta, Cotizaciones y Facturación.<br/>
          • Control de Inventario, Bodegas y Proveedores.<br/>
          • Mesas, Comandas, Taller, Clientes y Cuadre de Caja.
        </div>
        <button type="button" class="btn btn-emerald" style="width:100%" id="btn-card-go-register">
          Empezar Ahora &rarr;
        </button>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-head">
        <div class="card-title">Planes según tu Tipo de Negocio</div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-showcase-mid-register">Elegir Plan</button>
      </div>
      <div class="card-body">
        <div class="center-selector-grid" id="showcase-presets-grid"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">Módulos Disponibles</div>
      </div>
      <div class="card-body">
        <div class="center-selector-grid" id="showcase-services-grid"></div>
      </div>
    </div>
  </section>

  <!-- VENTANA DE ACTIVACIÓN DE CUENTA -->
  <div class="modal-backdrop" id="standby-payment-modal">
    <div class="modal-box">
      <div class="modal-head">
        <div>
          <span class="badge badge-emerald">ACTIVACIÓN INMEDIATA</span>
          <h3 style="margin:6px 0 0;font-size:17px">Confirmar Suscripción y Activar Cuenta</h3>
        </div>
        <button type="button" class="btn btn-hero-outline btn-sm" id="btn-close-payment-modal">✕</button>
      </div>
      <div class="modal-body" id="payment-step-checkout">
        <div class="grid-2" style="margin-bottom:12px">
          <div class="field">
            <label>Nombre del Negocio</label>
            <input type="text" id="pay-modal-company" readonly />
          </div>
          <div class="field">
            <label>Valor Mensual</label>
            <input type="text" id="pay-modal-amount" readonly />
          </div>
        </div>
        <div class="field" style="margin-bottom:14px">
          <label>Medio de Pago</label>
          <select id="pay-modal-method">
            <option value="PSE_EMPRESARIAL">PSE / Transferencia Bancaria</option>
            <option value="TARJETA_CORPORATIVA">Tarjeta Débito o Crédito</option>
            <option value="FACTURACION_CONTRATO">Facturación Empresarial</option>
          </select>
        </div>
        <button type="button" class="btn btn-emerald" style="width:100%;padding:12px" id="btn-confirm-standby-payment">
          ✅ Activar mi Cuenta y Entrar al Sistema
        </button>
      </div>

      <div class="modal-body" id="payment-step-credentials" style="display:none">
        <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:12px;margin-bottom:12px">
          <div style="font-weight:800;color:#065f46;font-size:15px">🎉 ¡Tu cuenta está lista!</div>
          <div style="font-size:12px;color:#047857">Datos de acceso de administrador:</div>
        </div>
        <div class="cred-box" id="generated-credentials-box"></div>
        <div class="row-actions" style="margin-top:14px;justify-content:flex-end">
          <button type="button" class="btn btn-primary" id="btn-enter-with-generated-creds">
            🚀 Entrar a mi Sistema
          </button>
        </div>
      </div>
    </div>
  </div>`;
}
