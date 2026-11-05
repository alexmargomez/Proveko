/**
 * Superficies 2 y 3 (`/login` y `/superadmin`):
 * - Login Inteligente por Rol (separa SuperAdmin Global de Usuarios de Empresas Clientes).
 * - Consola Maestra del SuperAdmin Global para gestionar clientes, planes, componentes y credenciales (SOLID SRP).
 */
export function renderLoginAndSuperAdminLayerHtml(): string {
  return `
  <!-- Superficie 2: Login Unificado (/login) -->
  <section id="surface-login" class="landing-shell hidden" aria-label="Inicio de Sesión Proveko">
    <div style="max-width:520px; margin:24px auto;" class="card">
      <div class="card-header" style="background:#0F172A; color:#fff;">
        <div>
          <div style="font-size:11px; color:#93C5FD; font-weight:700; text-transform:uppercase;">Acceso Seguro Multi-Empresa</div>
          <div class="card-title" style="color:#fff; font-size:17px;">Iniciar Sesión en Proveko</div>
        </div>
        <span class="badge badge-blue">RBAC Activo</span>
      </div>
      <div class="card-body">
        <p style="font-size:12.5px; color:var(--text-muted); margin-bottom:14px;">
          Si ingresas como <strong>SuperAdmin Global</strong> entrarás al Panel de Control de Clientes. Si ingresas con la <strong>credencial de tu empresa</strong> entrarás directo a tu plataforma operativa sin pasar por la portada.
        </p>
        <div class="form-group">
          <label class="form-label" for="login-username">Usuario o Correo Corporativo</label>
          <input id="login-username" type="text" class="form-control" value="admin@agrovalle.co" placeholder="usuario@empresa.co" />
        </div>
        <div class="form-group">
          <label class="form-label" for="login-password">Contraseña de Acceso</label>
          <input id="login-password" type="password" class="form-control" value="AgroValle2026!" />
        </div>
        <div id="login-feedback" class="hidden" style="margin-bottom:10px; padding:9px 12px; border-radius:7px; font-size:12px;"></div>
        <button type="button" class="btn btn-primary" style="width:100%; margin-bottom:14px;" onclick="window.provekoSubmitLogin()">
          Entrar a Mi Plataforma →
        </button>

        <div style="border-top:1px solid var(--border-hairline); padding-top:12px;">
          <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text-muted); margin-bottom:8px;">
            Accesos Rápidos de Demostración (1 Clic):
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <button type="button" class="btn btn-outline" style="justify-content:space-between;" onclick="window.provekoQuickLogin('SUPERADMIN_GLOBAL')">
              <span>👑 Entrar como <strong>SuperAdmin Global de Proveko</strong></span>
              <span class="badge badge-blue">Consola de Clientes</span>
            </button>
            <button type="button" class="btn btn-outline" style="justify-content:space-between;" onclick="window.provekoQuickLogin('ADMIN_AGROVALLE')">
              <span>🏢 Entrar como <strong>Admin Cliente</strong> (Agroindustrial & Logístico)</span>
              <span class="badge badge-emerald">Todos los Centros</span>
            </button>
            <button type="button" class="btn btn-outline" style="justify-content:space-between;" onclick="window.provekoQuickLogin('CAJERO_AGROVALLE')">
              <span>🧾 Entrar como <strong>Cajero / Facturador</strong> (Vista por Rol)</span>
              <span class="badge badge-amber">Solo Facturación y Terceros</span>
            </button>
            <button type="button" class="btn btn-outline" style="justify-content:space-between;" onclick="window.provekoQuickLogin('BASCULA_AGROVALLE')">
              <span>🚛 Entrar como <strong>Operador de Tractomulas y Báscula</strong></span>
              <span class="badge badge-slate">Solo Patio e Inventario</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Superficie 3: Consola Maestra del SuperAdmin Global (/superadmin) -->
  <section id="surface-superadmin" class="landing-shell hidden" aria-label="Consola Maestra del SuperAdmin Global">
    <div class="card" style="margin-bottom:18px; border-color:#1D4ED8;">
      <div class="card-header" style="background:linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%); color:#fff;">
        <div>
          <span class="badge badge-blue" style="margin-bottom:4px;">ROL: SUPERADMIN GLOBAL PROVEKO</span>
          <h1 style="font-size:20px; font-weight:800; color:#fff;">Consola Maestra de Empresas Clientes, Credenciales y Suscripciones</h1>
          <p style="font-size:12.5px; color:#CBD5E1;">Crea empresas clientes, genera las credenciales de su usuario SuperAdmin, habilita o deshabilita componentes y audita cualquier cuenta.</p>
        </div>
        <button type="button" class="btn btn-emerald" onclick="window.provekoOpenCheckoutModal()">
          + Crear Nueva Empresa Cliente y Generar Credencial
        </button>
      </div>
    </div>

    <div id="superadmin-kpis" class="kpi-strip" style="margin-bottom:18px;"></div>
    <div id="superadmin-tenants-container"></div>
  </section>
  `;
}
