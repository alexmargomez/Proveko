/**
 * Superficie Pública — Apartado 1: Página de Muestra de la Plataforma
 * y Asistente por Pasos "Registra tu Negocio" (Paso 1: Tipo de Negocio -> Paso 2: Módulos/Submódulos Adicionales -> Paso 3: Pago Standby).
 */
export function renderLandingLayerHtml(): string {
  return `
  <!-- APARTADO 1: PÁGINA DE MUESTRA DE LA PLATAFORMA -->
  <section class="surface active" id="surface-showcase">
    <div class="hero-banner">
      <div>
        <span class="hero-badge">PLATAFORMA EMPRESARIAL CON BASE DE DATOS AISLADA POR CLIENTE</span>
        <h1 class="hero-title">Un solo sistema integrado para facturar, controlar bodegas, traslados, báscula, comandas y cupos.</h1>
        <p class="hero-sub">
          En <strong>Proveko</strong> cada empresa opera sobre su propia base de datos PostgreSQL independiente.
          Elige tu tipo de negocio con todos los módulos básicos incluidos y agrega submódulos adicionales solo cuando los necesites.
        </p>
        <div class="row-actions" style="margin-top:16px">
          <button type="button" class="btn btn-primary" id="btn-hero-go-register">🚀 Registra tu Negocio</button>
          <button type="button" class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,0.4)" id="btn-hero-go-demo">🧪 Probar Demo Interactiva</button>
          <button type="button" class="btn btn-outline" style="color:#fff;border-color:rgba(255,255,255,0.4)" id="btn-hero-go-login">🔐 Iniciar Sesión</button>
        </div>
      </div>
      <div class="quote-card">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#93c5fd;font-weight:700">Arquitectura Empresarial</div>
        <div style="font-size:18px;font-weight:800;margin:8px 0">Módulos Principales + Submódulos + Funcionalidades</div>
        <div style="font-size:12px;color:#cbd5e1;line-height:1.5;margin-bottom:14px">
          • <strong>Base de Datos Propia:</strong> Aislamiento real por cliente.<br/>
          • <strong>Planes por Giro de Negocio:</strong> Todo lo básico incluido desde el primer día.<br/>
          • <strong>Roles y Usuarios Internos:</strong> Cuenta Admin generada al instante.
        </div>
        <button type="button" class="btn btn-emerald" style="width:100%" id="btn-card-go-register">
          Comenzar Registro de mi Negocio &rarr;
        </button>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head">
        <div>
          <div class="card-title">Módulos Principales y Submódulos de la Plataforma</div>
          <div style="font-size:12px;color:var(--pk-muted)">Cada Módulo Principal integra sus propios Submódulos por pestañas y Funcionalidades especializadas</div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-showcase-mid-register">Registra tu Negocio</button>
      </div>
      <div class="card-body">
        <div class="center-selector-grid" id="showcase-services-grid"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div>
          <div class="card-title">Planes Base por Tipo de Negocio</div>
          <div style="font-size:12px;color:var(--pk-muted)">Al seleccionar tu tipo de negocio ya vienen activados todos los módulos básicos para operar completo</div>
        </div>
      </div>
      <div class="card-body">
        <div class="center-selector-grid" id="showcase-presets-grid"></div>
      </div>
    </div>
  </section>

  <!-- MODAL DE VENTANA DE PAGOS (MICROSERVICIO MS-PAYMENTS EN STANDBY) + ENTREGA DE CUENTA ADMIN -->
  <div class="modal-backdrop" id="standby-payment-modal">
    <div class="modal-box">
      <div class="modal-head">
        <div>
          <span class="badge badge-amber">MICROSERVICIO DE PAGOS (MS-PAYMENTS) · MODO STANDBY</span>
          <h3 style="margin:6px 0 0;font-size:17px">Confirmación de Suscripción y Creación de Base de Datos</h3>
        </div>
        <button type="button" class="btn btn-outline btn-sm" id="btn-close-payment-modal">✕</button>
      </div>
      <div class="modal-body" id="payment-step-checkout">
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:#92400e">
          <strong>Pasarela en Standby:</strong> El microservicio de cobro procesará tu registro en modo pre-autorizado para crear de inmediato tu Base de Datos aislada en PostgreSQL y generar tu cuenta <strong>admin</strong>.
        </div>
        <div class="grid-2" style="margin-bottom:12px">
          <div class="field">
            <label>Empresa a Registrar</label>
            <input type="text" id="pay-modal-company" readonly />
          </div>
          <div class="field">
            <label>Total Mensual (Plan Base + Adicionales)</label>
            <input type="text" id="pay-modal-amount" readonly />
          </div>
        </div>
        <div class="field" style="margin-bottom:14px">
          <label>Método de Pago (Pasarela Standby)</label>
          <select id="pay-modal-method">
            <option value="PSE_EMPRESARIAL">Transferencia PSE Empresarial (Standby)</option>
            <option value="TARJETA_CORPORATIVA">Tarjeta de Crédito Corporativa (Standby)</option>
            <option value="FACTURACION_CONTRATO">Orden de Compra Corporativa (Standby)</option>
          </select>
        </div>
        <button type="button" class="btn btn-emerald" style="width:100%;padding:12px" id="btn-confirm-standby-payment">
          ✅ Confirmar Pago en Standby, Crear Base de Datos y Generar Cuenta Admin
        </button>
      </div>

      <div class="modal-body" id="payment-step-credentials" style="display:none">
        <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:14px;margin-bottom:14px">
          <div style="font-weight:800;color:#065f46;font-size:15px;margin-bottom:4px">🎉 ¡Negocio Registrado y Base de Datos Creada en PostgreSQL!</div>
          <div style="font-size:12px;color:#047857">Guarda las credenciales de tu cuenta <strong>admin</strong> generada automáticamente:</div>
        </div>
        <div class="cred-box" id="generated-credentials-box"></div>
        <div class="row-actions" style="margin-top:16px;justify-content:flex-end">
          <button type="button" class="btn btn-primary" id="btn-enter-with-generated-creds">
            🚀 Entrar Ahora a la Plataforma de mi Empresa
          </button>
        </div>
      </div>
    </div>
  </div>`;
}
