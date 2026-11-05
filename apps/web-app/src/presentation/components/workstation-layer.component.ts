/**
 * Componente de Presentación — Barra Superior y Capa 2 (`/app`):
 * Estación de Trabajo Privada Multi-Usuario con Formularios Guiados, KPIs y Grilla Contable (SOLID SRP).
 */
export function renderWorkstationLayerHtml(options: {
  readonly domainBadge: string;
  readonly initialLandingActive: boolean;
}): string {
  const { domainBadge, initialLandingActive } = options;
  return `
  <header class="topbar">
    <div class="brand">
      <div class="brand-mark">PK</div>
      <div>
        <div class="brand-title">PROVEKO <span style="font-weight:500; color:var(--text-muted); font-size:13px;">| Cloud Empresarial</span></div>
        <div class="brand-sub">Arquitectura Modular Zero-Trust · Nodo: <span class="mono">${domainBadge}</span></div>
      </div>
    </div>

    <nav class="surface-switcher" aria-label="Selector de Superficie del Producto">
      <button type="button" id="tab-surface-landing" class="surface-tab ${initialLandingActive ? 'active' : ''}" onclick="window.provekoSwitchSurface('landing')">
        1. Portada y Configurador (/)
      </button>
      <button type="button" id="tab-surface-workstation" class="surface-tab ${!initialLandingActive ? 'active' : ''}" onclick="window.provekoSwitchSurface('workstation')">
        2. Estación de Trabajo (/app)
      </button>
    </nav>

    <div class="topbar-controls">
      <div class="ctrl-pill" title="Base de datos PostgreSQL aislada por cliente">
        <label for="tenant-select">Base Cliente</label>
        <select id="tenant-select" onchange="window.provekoReissueSession()">
          <option value="db_version_prueba" selected>db_version_prueba (Sandbox)</option>
          <option value="proveko_tenant_a">proveko_tenant_a (Base A)</option>
          <option value="proveko_tenant_b">proveko_tenant_b (Base B)</option>
        </select>
      </div>

      <div class="ctrl-pill" title="Sucursal operativa activa en el token JWT">
        <label for="branch-select">Sucursal</label>
        <select id="branch-select" onchange="window.provekoReissueSession()">
          <option value="br-01" selected>Sede Principal (br-01)</option>
          <option value="br-02">Sucursal Norte (br-02)</option>
        </select>
      </div>

      <span id="jwt-status-badge" class="badge badge-emerald mono">Ed25519 · sub_ver: 1</span>
      <button type="button" class="btn btn-outline" style="padding:5px 10px; font-size:12px;" onclick="window.provekoToggleAuditDrawer()">
        🛡️ Auditoría Zero-Trust
      </button>
    </div>
  </header>

  <div id="surface-workstation" class="workstation-layout ${initialLandingActive ? 'hidden' : ''}">
    <aside class="sidebar" aria-label="Menú de Microservicios y Módulos">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:0 6px;">
        <span class="sidebar-section-title">Microservicios y Módulos</span>
        <button type="button" class="btn btn-outline" style="padding:2px 7px; font-size:10px; background:#1E293B; color:#CBD5E1; border-color:#334155;" onclick="window.provekoSwitchSurface('landing')">
          Configurar Plan
        </button>
      </div>
      <div id="sidebar-catalog" style="overflow-y:auto; flex:1;"></div>
    </aside>

    <main class="main-stage">
      <div class="card">
        <div class="card-header">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:3px;">
              <span id="mod-parent-badge" class="badge badge-slate mono">ms:crm</span>
              <span id="mod-key-badge" class="badge badge-blue mono">mod:crm-directory</span>
              <span id="mod-prefix-badge" class="badge badge-emerald mono">Prefijo SQL: crm_</span>
            </div>
            <h1 id="mod-title" style="font-size:18px; font-weight:800;">Directorio Maestro de Terceros</h1>
            <p id="mod-desc" style="font-size:12.5px; color:var(--text-muted);">Cargando módulo operativo...</p>
          </div>
          <div style="display:flex; gap:8px;">
            <button type="button" id="btn-refresh-list" class="btn btn-outline" onclick="window.provekoExecuteList()">
              ↻ Actualizar Registros (GET)
            </button>
          </div>
        </div>
        <div id="gate-banner-container" style="padding:0 18px 14px;" class="hidden"></div>
      </div>

      <section id="mod-kpi-strip" class="kpi-strip" aria-label="Indicadores Clave del Módulo"></section>

      <div class="workspace-grid">
        <div id="create-panel-card" class="card">
          <div class="card-header">
            <span class="card-title">Registro Operativo Guiado</span>
            <button type="button" id="btn-toggle-json-mode" class="btn btn-outline" style="padding:3px 8px; font-size:11px;" onclick="window.provekoTogglePayloadMode()">
              Modo JSON Avanzado
            </button>
          </div>
          <div class="card-body">
            <div id="guided-form-fields"></div>
            <div id="raw-json-container" class="hidden" style="margin-bottom:12px;">
              <label class="form-label" for="payload-editor">Payload Técnico JSON (Sincronizado)</label>
              <textarea id="payload-editor" class="form-control mono" style="min-height:150px; font-size:12px;"></textarea>
            </div>
            <div style="margin-bottom:10px; font-size:11px; color:var(--text-muted);">
              Ruta API Gateway: <code id="create-endpoint-label" class="mono">/api/v1/crm/directory/contacts</code>
            </div>
            <button type="button" id="btn-create-action" class="btn btn-primary" style="width:100%;" onclick="window.provekoExecuteCreate()">
              Guardar Registro
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">Registros de la Sucursal Activa</span>
            <span id="records-count-badge" class="badge badge-slate mono">0 registros</span>
          </div>
          <div id="records-table-container" style="overflow-x:auto; max-height:420px;"></div>
        </div>
      </div>

      <section id="audit-drawer" class="card hidden" aria-label="Inspector Técnico Zero-Trust y Topología">
        <div class="card-header" style="background:#0F172A; color:#F8FAFC;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="card-title" style="color:#fff;">🛡️ Inspector de Auditoría Técnica Zero-Trust (Ed25519 + HMAC-SHA256)</span>
            <span id="resp-status-badge" class="badge badge-emerald mono">HTTP 200 OK</span>
            <span id="resp-served-by" class="badge badge-blue mono">container:ms-crm</span>
          </div>
          <button type="button" class="btn btn-outline" style="padding:3px 9px; font-size:11px; background:#1E293B; color:#fff; border-color:#334155;" onclick="window.provekoLoadTopology()">
            Ver Topología de Contenedores
          </button>
        </div>
        <div class="card-body" style="background:#0F172A; color:#E2E8F0;">
          <pre id="response-inspector" class="mono" style="font-size:11.5px; max-height:220px; overflow:auto; white-space:pre-wrap;">// Listo para auditar tráfico entre API Gateway y Microservicios...</pre>
          <div id="topology-grid" style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:12px;"></div>
        </div>
      </section>
    </main>
  </div>
  `;
}
