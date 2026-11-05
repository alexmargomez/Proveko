/**
 * Superficie Operativa del Cliente (`/app`) y Apartado 3 Público (`Demo` sobre `db_version_prueba`):
 * - Cero switches o checkboxes de funcionalidades en las pantallas de trabajo.
 * - Navegación lateral por Módulos Principales + Interpestañas superiores por Submódulos.
 * - Incluye pestaña de Roles/Usuarios internos del cliente (con límites de cuota) y pestaña "Necesito otra funcionalidad".
 */
export function renderWorkstationLayerHtml(): string {
  return `
  <section class="surface" id="surface-workstation">
    <!-- BANNER EXCLUSIVO CUANDO SE NAVEGA EN EL APARTADO 3: DEMO (db_version_prueba) -->
    <div id="demo-mode-banner" style="display:none;background:linear-gradient(90deg,#1e3a8a,#1d4ed8);color:#fff;padding:10px 16px;border-radius:12px;margin-bottom:14px;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="font-size:12px">
        <strong>🧪 APARTADO DEMO INTERACTIVA:</strong> Estás probando todos los Módulos Principales y Submódulos sobre la base de datos de demostración (<code>db_version_prueba</code>).
      </div>
      <button type="button" class="btn btn-emerald btn-sm" id="btn-demo-go-register">
        🚀 Registra tu Negocio y obtén tu propia Base de Datos &rarr;
      </button>
    </div>

    <div class="ws-layout">
      <!-- BARRA LATERAL: MÓDULOS PRINCIPALES + ROLES/USUARIOS + "NECESITO OTRA FUNCIONALIDAD" -->
      <aside class="ws-sidebar">
        <div class="ws-nav-head" id="ws-tenant-sidebar-head">MÓDULOS PRINCIPALES</div>
        <div class="ws-nav-list" id="ws-principal-modules-nav"></div>
        <div style="border-top:1px solid var(--pk-border);margin:8px 0;padding-top:8px">
          <div class="ws-nav-head">ADMINISTRACIÓN DE EMPRESA</div>
          <div class="ws-nav-list" id="ws-company-admin-nav">
            <button type="button" class="ws-nav-btn" id="btn-nav-internal-rbac">
              <div class="ws-nav-title">👥 Roles y Usuarios Internos</div>
              <div class="ws-nav-sub" id="ws-rbac-quota-sub">Cuenta Admin y permisos en tu BD</div>
            </button>
            <button type="button" class="ws-nav-btn" id="btn-nav-need-feature">
              <div class="ws-nav-title">✨ Necesito otra funcionalidad</div>
              <div class="ws-nav-sub">Solicitar o ampliar módulos y funciones</div>
            </button>
          </div>
        </div>
      </aside>

      <!-- ÁREA CENTRAL DE OPERACIÓN -->
      <div class="ws-main">
        <!-- VISTA 1: OPERACIÓN DE UN MÓDULO PRINCIPAL Y SUS INTERPESTAÑAS DE SUBMÓDULOS -->
        <div id="ws-pane-module-operation">
          <div class="card" style="margin-bottom:14px">
            <div class="card-head">
              <div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span id="ws-active-service-icon" style="font-size:20px">📦</span>
                  <h2 style="margin:0;font-size:18px" id="ws-active-service-title">Módulo Principal</h2>
                  <span class="badge badge-emerald" id="ws-active-db-badge">BD: db_version_prueba</span>
                </div>
                <div style="font-size:12px;color:var(--pk-muted);margin-top:3px" id="ws-active-service-sub"></div>
              </div>
              <div id="ws-active-features-pills" style="display:flex;gap:6px;flex-wrap:wrap"></div>
            </div>
            <!-- BARRA DE INTERPESTAÑAS DE SUBMÓDULOS -->
            <div style="padding:10px 18px;background:#f8fafc;border-bottom:1px solid var(--pk-border);display:flex;gap:8px;flex-wrap:wrap" id="ws-submodule-tabs"></div>

            <div class="card-body">
              <div style="margin-bottom:12px;font-size:12px;color:var(--pk-muted)" id="ws-submodule-summary"></div>

              <!-- WIDGETS ESPECIALIZADOS DEL SUBMÓDULO (POS / RECETAS / BÁSCULA) -->
              <div id="ws-specialized-widget-slot" style="margin-bottom:16px"></div>

              <!-- FORMULARIO LIMPIO DEL SUBMÓDULO (CON LOS CAMPOS DE SUS FUNCIONALIDADES ACTIVAS) -->
              <div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:14px;margin-bottom:16px">
                <div class="grid-3" id="ws-submodule-form-fields"></div>
                <div class="row-actions" style="margin-top:12px;justify-content:flex-end">
                  <button type="button" class="btn btn-primary" id="btn-ws-save-record">Guardar Registro</button>
                </div>
              </div>

              <!-- BARRA DE FILTROS MULTICRITERIO ESTILO VERSION2 (v2) -->
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px;padding:10px 12px;background:#f1f5f9;border:1px solid var(--pk-border);border-radius:10px">
                <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:240px">
                  <span style="font-size:12px;font-weight:800;color:var(--pk-text)">🔍 Filtro Rápido (v2):</span>
                  <input type="text" id="ws-v2-filter-input" placeholder="Buscar por NIT, cliente, código, bodega, placa o estado..." style="flex:1;padding:7px 10px;border:1px solid var(--pk-border);border-radius:7px;font-size:12px;background:#fff" />
                </div>
                <div class="row-actions">
                  <span class="badge badge-blue" id="ws-v2-count-badge">0 registros</span>
                  <button type="button" class="btn btn-outline btn-sm" id="btn-ws-clear-filter">Limpiar Filtro</button>
                </div>
              </div>

              <!-- TABLA DE REGISTROS DEL SUBMÓDULO -->
              <div class="table-wrap">
                <table>
                  <thead id="ws-submodule-thead"></thead>
                  <tbody id="ws-submodule-tbody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- VISTA 2: ROLES Y USUARIOS INTERNOS EN LA BD DEL CLIENTE -->
        <div id="ws-pane-internal-rbac" style="display:none"></div>

        <!-- VISTA 3: PESTAÑA "NECESITO OTRA FUNCIONALIDAD" -->
        <div id="ws-pane-need-feature" style="display:none"></div>
      </div>
    </div>
  </section>`;
}
