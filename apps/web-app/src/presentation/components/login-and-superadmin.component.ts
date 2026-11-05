/**
 * Apartado 2 Público: Login + Asistente por Pasos "Registra tu Negocio"
 * y Consola Maestra para los Roles Globales (`superadmin`, `desarrollador`, `auxiliar`).
 */
export function renderLoginAndSuperAdminHtml(): string {
  return `
  <!-- APARTADO 2: INICIAR SESIÓN O REGISTRA TU NEGOCIO -->
  <section class="surface" id="surface-auth">
    <div style="display:flex;justify-content:center;gap:10px;margin-bottom:18px">
      <button type="button" class="btn btn-primary" id="btn-auth-mode-login">🔐 Iniciar Sesión</button>
      <button type="button" class="btn btn-outline" id="btn-auth-mode-register">🚀 Registra tu Negocio (Paso a Paso)</button>
    </div>

    <!-- MODO 2A: FORMULARIO DE LOGIN PROFESIONAL (CERO SELECTORES EDUCATIVOS) -->
    <div id="auth-pane-login" style="max-width:480px;margin:0 auto">
      <div class="card">
        <div class="card-head">
          <div>
            <span class="badge badge-blue">ACCESO SEGURO MULTI-BASE</span>
            <h2 style="margin:6px 0 0;font-size:18px">Iniciar Sesión en Proveko</h2>
          </div>
        </div>
        <div class="card-body">
          <p style="font-size:12px;color:var(--pk-muted);margin:0 0 14px">
            Ingresa con tu usuario o correo corporativo. El sistema identifica automáticamente tu rol
            (<strong>superadmin</strong>, <strong>desarrollador</strong>, <strong>auxiliar</strong> o <strong>cliente</strong>)
            y conecta con la base de datos aislada de tu empresa.
          </p>
          <div class="field" style="margin-bottom:12px">
            <label>Usuario o Correo Electrónico</label>
            <input type="text" id="login-username" placeholder="Ej: admin@tuempresa.com o superadmin@proveko.com" />
          </div>
          <div class="field" style="margin-bottom:16px">
            <label>Contraseña</label>
            <input type="password" id="login-password" placeholder="••••••••••••" />
          </div>
          <button type="button" class="btn btn-primary" style="width:100%;padding:11px" id="btn-submit-login">
            Ingresar a la Plataforma
          </button>
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--pk-border);display:flex;justify-content:space-between;align-items:center;font-size:12px">
            <span style="color:var(--pk-muted)">¿Aún no tienes cuenta empresarial?</span>
            <button type="button" class="btn btn-outline btn-sm" id="btn-login-switch-to-register">Registra tu Negocio &rarr;</button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODO 2B: ASISTENTE "REGISTRA TU NEGOCIO" (3 PASOS + PAGO AL FINAL) -->
    <div id="auth-pane-register" style="display:none">
      <div class="card" style="margin-bottom:16px">
        <div class="card-head">
          <div>
            <span class="badge badge-emerald">ALTA DE EMPRESA Y BASE DE DATOS PROPIA</span>
            <h2 style="margin:4px 0 0;font-size:18px">Registra tu Negocio en 3 Pasos</h2>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--pk-muted)">Total Mensual Estimado</div>
            <div style="font-size:24px;font-weight:800;color:var(--pk-primary)" id="reg-quote-total">$49 USD/mes</div>
            <div style="font-size:11px;color:var(--pk-muted)" id="reg-quote-breakdown">Plan Base Incluido</div>
          </div>
        </div>
        <div class="card-body">
          <!-- PASO 1: TIPO DE NEGOCIO -->
          <div style="margin-bottom:20px">
            <div style="font-weight:800;font-size:14px;margin-bottom:4px">
              Paso 1. Selecciona tu Tipo de Negocio (Habilita todos los módulos básicos de tu operación)
            </div>
            <div style="font-size:12px;color:var(--pk-muted);margin-bottom:10px">
              El plan base de tu tipo de negocio ya incluye todos los Módulos Principales y Submódulos esenciales para operar sin cobros ocultos.
            </div>
            <div class="preset-row" id="reg-business-types-row"></div>
            <div id="reg-included-summary" style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:10px;padding:12px;font-size:12px"></div>
          </div>

          <!-- PASO 2: ¿QUIERES AGREGAR MÓDULOS PRINCIPALES O SUBMÓDULOS ADICIONALES? -->
          <div style="margin-bottom:20px">
            <div style="font-weight:800;font-size:14px;margin-bottom:4px">
              Paso 2. ¿Quieres agregar Módulos Principales o Submódulos adicionales? (Opcional)
            </div>
            <div style="font-size:12px;color:var(--pk-muted);margin-bottom:10px">
              Solo si necesitas capacidades fuera de tu giro base, selecciona aquí Módulos Principales o Submódulos adicionales (las funcionalidades internas vienen gobernadas por el sistema).
            </div>
            <div class="center-selector-grid" id="reg-addons-grid"></div>
          </div>

          <!-- PASO 3: DATOS DE LA EMPRESA Y PAGO FINAL -->
          <div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:16px">
            <div style="font-weight:800;font-size:14px;margin-bottom:10px">
              Paso 3. Datos de tu Empresa y Pago de Activación
            </div>
            <div class="grid-3">
              <div class="field">
                <label>Razón Social o Nombre del Negocio</label>
                <input type="text" id="reg-company-name" placeholder="Ej: Comercializadora del Norte S.A.S." />
              </div>
              <div class="field">
                <label>NIT / Identificación Fiscal</label>
                <input type="text" id="reg-company-nit" placeholder="Ej: 901.552.310-8" />
              </div>
              <div class="field">
                <label>Correo del Administrador</label>
                <input type="email" id="reg-company-email" placeholder="gerencia@tuempresa.com" />
              </div>
            </div>
            <div class="row-actions" style="margin-top:14px;justify-content:flex-end">
              <button type="button" class="btn btn-emerald" id="btn-open-standby-checkout">
                💳 Ir al Pago y Crear Base de Datos de mi Empresa &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CONSOLA GLOBAL PARA ROLES DE PLATAFORMA: SUPERADMIN, DESARROLLADOR Y AUXILIAR -->
  <section class="surface" id="surface-superadmin">
    <div class="card" style="margin-bottom:16px">
      <div class="card-head">
        <div>
          <span class="badge badge-blue" id="staff-console-badge">ROL GLOBAL: SUPERADMIN</span>
          <h2 style="margin:4px 0 0;font-size:18px" id="staff-console-title">Control Maestro de Clientes, Bases de Datos y Cuotas de Roles/Usuarios</h2>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-sa-new-client">+ Crear Nuevo Cliente y su Base de Datos</button>
      </div>
      <div class="card-body">
        <div class="kpi-row" id="sa-kpi-row"></div>
        <div id="sa-tenants-grid" style="display:grid;gap:14px"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">Solicitudes de Clientes — Pestaña "Necesito otra funcionalidad"</div>
        <span class="badge badge-amber" id="sa-requests-count">0 solicitudes</span>
      </div>
      <div class="card-body" id="sa-feature-requests-body"></div>
    </div>
  </section>`;
}
