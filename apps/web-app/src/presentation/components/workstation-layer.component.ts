/**
 * Superficie 4 (`/app`): Plataforma Unificada de Gestión Empresarial para Clientes y Empleados.
 * Cero jerga técnica (`ms:*`, `SQL`), cero cajas JSON; integra 6 Centros Operativos ricos y Componentes conmutables (SOLID SRP).
 */
export function renderWorkstationLayerHtml(options: {
  readonly domainBadge: string;
  readonly initialLandingActive: boolean;
}): string {
  const { domainBadge, initialLandingActive } = options;
  return `
  <header class="topbar">
    <div class="brand" onclick="window.provekoHandleBrandClick()">
      <div class="brand-mark">PK</div>
      <div>
        <div class="brand-title">PROVEKO <span id="topbar-company-name" style="font-weight:600; color:var(--brand-primary); font-size:13.5px;">| Plataforma Empresarial</span></div>
        <div class="brand-sub" id="topbar-subtitle">Sistema Integrado de Gestión · Dominio: <span class="mono">${domainBadge}</span></div>
      </div>
    </div>

    <nav class="surface-switcher" aria-label="Navegación Principal">
      <button type="button" id="tab-surface-landing" class="surface-tab ${initialLandingActive ? 'active' : ''}" onclick="window.provekoSwitchSurface('landing')">
        🌐 Armar Plan y Registro
      </button>
      <button type="button" id="tab-surface-login" class="surface-tab" onclick="window.provekoSwitchSurface('login')">
        🔐 Iniciar Sesión
      </button>
      <button type="button" id="tab-surface-superadmin" class="surface-tab hidden" onclick="window.provekoSwitchSurface('superadmin')">
        👑 Panel SuperAdmin Clientes
      </button>
      <button type="button" id="tab-surface-workstation" class="surface-tab ${!initialLandingActive ? 'active' : ''}" onclick="window.provekoSwitchSurface('workstation')">
        🏢 Plataforma de Gestión
      </button>
    </nav>

    <div class="topbar-controls">
      <div class="ctrl-pill" title="Empresa Cliente Activa">
        <label for="tenant-select">Empresa</label>
        <select id="tenant-select" onchange="window.provekoSwitchActiveTenant(this.value)"></select>
      </div>

      <div class="ctrl-pill" title="Simular o cambiar el Rol del Usuario dentro de la empresa">
        <label for="role-select">Vista de Rol</label>
        <select id="role-select" onchange="window.provekoSwitchActiveRole(this.value)"></select>
      </div>

      <span id="active-user-pill" class="badge badge-emerald">Admin Empresa</span>
    </div>
  </header>

  <div id="surface-workstation" class="workstation-layout ${initialLandingActive ? 'hidden' : ''}">
    <aside class="sidebar" aria-label="Menú de Centros Operativos de la Empresa">
      <div style="padding:8px 10px; background:rgba(30,41,59,0.75); border-radius:9px; border:1px solid #334155;">
        <div style="font-size:10.5px; color:#93C5FD; font-weight:700; text-transform:uppercase;">Empresa Conectada</div>
        <div id="sidebar-company-label" style="font-size:13px; font-weight:800; color:#fff; margin-top:2px;">Grupo Agroindustrial</div>
        <div id="sidebar-role-label" style="font-size:11px; color:#CBD5E1; margin-top:2px;">Rol: Administrador General</div>
      </div>

      <div class="sidebar-section-title">Centros de Gestión</div>
      <div id="sidebar-centers-nav" style="flex:1; overflow-y:auto;"></div>

      <div style="border-top:1px solid #1E293B; padding-top:10px; display:flex; flex-direction:column; gap:6px;">
        <button type="button" id="btn-back-to-superadmin" class="btn btn-outline hidden" style="width:100%; background:#1E293B; color:#93C5FD; border-color:#334155; font-size:11.5px;" onclick="window.provekoSwitchSurface('superadmin')">
          👑 Volver a Consola SuperAdmin
        </button>
        <button type="button" class="btn btn-outline" style="width:100%; background:transparent; color:#94A3B8; border-color:#334155; font-size:11.5px;" onclick="window.provekoSwitchSurface('login')">
          Cambiar de Usuario / Salir
        </button>
      </div>
    </aside>

    <main class="main-stage">
      <!-- Encabezado del Centro Operativo + Barra de Componentes Conmutables en la Misma Pantalla -->
      <div class="card">
        <div class="card-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span id="center-badge-role" class="badge badge-blue">Centro Operativo Integrado</span>
              <span id="center-badge-branch" class="badge badge-emerald">Sede Principal Activa</span>
            </div>
            <h1 id="center-title" style="font-size:20px; font-weight:800;">Facturación, Punto de Venta (POS) y Caja</h1>
            <p id="center-summary" style="font-size:13px; color:var(--text-muted);">Operación unificada en tiempo real.</p>
          </div>
          <div id="center-header-actions" style="display:flex; gap:8px;"></div>
        </div>
        <div id="center-components-bar" class="card-body" style="padding:12px 18px; background:#F8FAFC;"></div>
      </div>

      <!-- Indicadores Ejecutivos del Centro -->
      <section id="center-kpi-strip" class="kpi-strip" aria-label="Indicadores del Centro"></section>

      <!-- Lienzo Dinámico del Centro Operativo Activo -->
      <div id="center-workspace-canvas"></div>
    </main>
  </div>
  `;
}
