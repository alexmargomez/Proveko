/**
 * Apartado 2 Público: Iniciar Sesión + Registro de Negocio Limpio
 * y Consola Interna para Administradores de la Plataforma (`superadmin`, `desarrollador`, `auxiliar`).
 */
export function renderLoginAndSuperAdminHtml(): string {
  return `
  <!-- APARTADO 2: INICIAR SESIÓN O CREAR CUENTA -->
  <section class="surface" id="surface-auth">
    <div style="display:flex;justify-content:center;gap:10px;margin-bottom:16px">
      <button type="button" class="btn btn-primary" id="btn-auth-mode-login">🔐 Iniciar Sesión</button>
      <button type="button" class="btn btn-outline" id="btn-auth-mode-register">🚀 Crear Cuenta para mi Negocio</button>
    </div>

    <!-- LOGIN LIMPIO -->
    <div id="auth-pane-login" style="max-width:420px;margin:0 auto">
      <div class="card">
        <div class="card-head">
          <h2 style="margin:0;font-size:17px">Iniciar Sesión</h2>
        </div>
        <div class="card-body">
          <div class="field" style="margin-bottom:12px">
            <label>Usuario o Correo</label>
            <input type="text" id="login-username" placeholder="Ingresa tu usuario" />
          </div>
          <div class="field" style="margin-bottom:14px">
            <label>Contraseña</label>
            <input type="password" id="login-password" placeholder="••••••••" />
          </div>
          <button type="button" class="btn btn-primary" style="width:100%;padding:11px" id="btn-submit-login">
            Entrar
          </button>
          <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--pk-border);display:flex;justify-content:space-between;align-items:center;font-size:12px">
            <span style="color:var(--pk-muted)">¿Nuevo en Proveko?</span>
            <button type="button" class="btn btn-outline btn-sm" id="btn-login-switch-to-register">Crear Cuenta &rarr;</button>
          </div>
        </div>
      </div>
    </div>

    <!-- REGISTRO DE NEGOCIO EN 3 PASOS SIMPLES -->
    <div id="auth-pane-register" style="display:none">
      <div class="card">
        <div class="card-head">
          <div>
            <h2 style="margin:0;font-size:18px">Activa el Sistema para tu Negocio</h2>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--pk-muted)">Valor Mensual</div>
            <div style="font-size:22px;font-weight:800;color:var(--pk-primary)" id="reg-quote-total">$169.000 COP/mes</div>
            <div style="font-size:11px;color:var(--pk-muted)" id="reg-quote-breakdown">Plan Base</div>
          </div>
        </div>
        <div class="card-body">
          <div style="margin-bottom:16px">
            <div style="font-weight:800;font-size:14px;margin-bottom:8px">1. ¿Qué tipo de negocio tienes?</div>
            <div class="preset-row" id="reg-business-types-row"></div>
            <div id="reg-included-summary" style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:10px;padding:10px;font-size:12px"></div>
          </div>

          <div style="margin-bottom:16px">
            <div style="font-weight:800;font-size:14px;margin-bottom:8px">2. Módulos incluidos y adicionales (Opcional)</div>
            <div class="center-selector-grid" id="reg-addons-grid"></div>
          </div>

          <div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:14px">
            <div style="font-weight:800;font-size:14px;margin-bottom:10px">3. Datos de tu Negocio</div>
            <div class="grid-3">
              <div class="field">
                <label>Nombre del Negocio o Empresa</label>
                <input type="text" id="reg-company-name" placeholder="Ej: Ferretería y Repuestos El Sol" />
              </div>
              <div class="field">
                <label>NIT o Cédula</label>
                <input type="text" id="reg-company-nit" placeholder="Ej: 901.552.310-8" />
              </div>
              <div class="field">
                <label>Correo Electrónico</label>
                <input type="email" id="reg-company-email" placeholder="contacto@tunegocio.com" />
              </div>
            </div>
            <div class="row-actions" style="margin-top:12px;justify-content:flex-end">
              <button type="button" class="btn btn-emerald" id="btn-open-standby-checkout">
                ✅ Continuar y Activar mi Cuenta &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- PANEL INTERNO DE ADMINISTRACIÓN (SOLO VISIBLE PARA SUPERADMIN / DESARROLLADOR) -->
  <section class="surface" id="surface-superadmin">
    <div class="card" style="margin-bottom:14px">
      <div class="card-head">
        <div>
          <span class="badge badge-blue" id="staff-console-badge">ADMINISTRACIÓN GLOBAL</span>
          <h2 style="margin:4px 0 0;font-size:18px" id="staff-console-title">Empresas Registradas y Control de Accesos</h2>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btn-sa-new-client">+ Registrar Nueva Empresa</button>
      </div>
      <div class="card-body">
        <div class="kpi-row" id="sa-kpi-row"></div>
        <div id="sa-tenants-grid" style="display:grid;gap:12px"></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-head">
        <div class="card-title">Configuración de Planes por Tipo de Negocio y Módulos</div>
      </div>
      <div class="card-body" id="sa-groups-catalog-panel"></div>
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">Solicitudes de Ampliación de Módulos</div>
        <span class="badge badge-amber" id="sa-requests-count">0</span>
      </div>
      <div class="card-body" id="sa-feature-requests-body"></div>
    </div>
  </section>`;
}
