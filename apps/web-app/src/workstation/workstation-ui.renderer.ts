import {
  SEED_INDUSTRY_PRESETS,
  SEED_MICROSERVICES_CATALOG,
  SEED_SERVICES_CATALOG,
  toModuleNotation,
  toParentMicroserviceNotation,
} from '@proveko/shared-kernel';

export interface RenderWorkstationUiOptions {
  appUrl?: string;
  appDomain?: string;
}

/**
 * Renderiza la aplicación web completa de Proveko (Portada Comercial + Configurador Modular
 * en Vivo + Estación de Trabajo Operativa `Proveko Workstation` conectada a `/api/v1/*`).
 *
 * Cumple con la Sección 6 de `arquitectura_proveko.md`:
 * - Superficie institucional `--pk-surface-canvas: #F8FAFC`, tarjetas `#FFFFFF`, bordes `#E2E8F0`
 * - Sidebar ejecutiva azul marino `--pk-sidebar-bg: #0F172A` colapsable
 * - Disciplina numérica `tabular-nums` y códigos en fuente monoespaciada
 * - `<CapabilityGate>`, `<ReadonlyArchiveBanner />`, selector de Base de Datos por Cliente (`db_version_prueba` / `coreDB`)
 *   y consola de ejecución real contra los 6 contenedores de microservicios (`ms:*`) y sus 20 módulos (`mod:*`).
 */
export function renderProvekoWorkstationHtml(options: RenderWorkstationUiOptions = {}): string {
  const initialCatalog = {
    microservices: SEED_SERVICES_CATALOG.map((s) => ({
      ...s,
      microserviceKey: toParentMicroserviceNotation(s.key),
    })),
    modules: SEED_MICROSERVICES_CATALOG.map((m) => ({
      ...m,
      parentMicroserviceKey: toParentMicroserviceNotation(m.parentService),
      moduleKey: toModuleNotation(m.key),
    })),
    presets: SEED_INDUSTRY_PRESETS,
  };

  const serializedCatalog = JSON.stringify(initialCatalog).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proveko — Plataforma SaaS Modular Multi-Tenant & Estación de Trabajo</title>
  <style>
    :root {
      --pk-surface-canvas: #F8FAFC;
      --pk-surface-card: #FFFFFF;
      --pk-border-subtle: #E2E8F0;
      --pk-border-strong: #CBD5E1;
      --pk-sidebar-bg: #0F172A;
      --pk-sidebar-hover: #1E293B;
      --pk-text-main: #0F172A;
      --pk-text-muted: #475569;
      --pk-text-light: #64748B;
      --pk-primary: #1D4ED8;
      --pk-primary-hover: #1E40AF;
      --pk-primary-soft: #EFF6FF;
      --pk-emerald: #15803D;
      --pk-emerald-bg: #DCFCE7;
      --pk-amber: #B45309;
      --pk-amber-bg: #FEF3C7;
      --pk-red: #B91C1C;
      --pk-red-bg: #FEE2E2;
      --pk-archive: #475569;
      --pk-archive-bg: #F1F5F9;
      --pk-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --pk-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--pk-sans);
      background-color: var(--pk-surface-canvas);
      color: var(--pk-text-main);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .tabular-nums {
      font-variant-numeric: tabular-nums;
    }

    .mono {
      font-family: var(--pk-mono);
    }

    /* TOPBAR EJECUTIVA */
    .topbar {
      height: 60px;
      background: var(--pk-surface-card);
      border-bottom: 1px solid var(--pk-border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 1.25rem;
      flex-shrink: 0;
      z-index: 20;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .brand-badge {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-weight: 800;
      font-size: 1.1rem;
      color: var(--pk-sidebar-bg);
      letter-spacing: -0.02em;
    }

    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 7px;
      background: var(--pk-primary);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 0.95rem;
    }

    .mode-tabs {
      display: flex;
      background: #F1F5F9;
      padding: 3px;
      border-radius: 8px;
      border: 1px solid var(--pk-border-subtle);
      margin-left: 0.5rem;
    }

    .mode-tab {
      border: none;
      background: transparent;
      padding: 0.4rem 0.85rem;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--pk-text-muted);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .mode-tab.active {
      background: var(--pk-surface-card);
      color: var(--pk-primary);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .ctx-pill {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background: #F8FAFC;
      border: 1px solid var(--pk-border-subtle);
      border-radius: 6px;
      padding: 0.3rem 0.6rem;
      font-size: 0.78rem;
      color: var(--pk-text-muted);
    }

    .ctx-pill select {
      border: none;
      background: transparent;
      font-weight: 600;
      color: var(--pk-text-main);
      font-size: 0.78rem;
      font-family: var(--pk-mono);
      cursor: pointer;
      outline: none;
    }

    .security-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: var(--pk-emerald-bg);
      color: var(--pk-emerald);
      padding: 0.3rem 0.65rem;
      border-radius: 999px;
      font-size: 0.74rem;
      font-weight: 700;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.48rem 0.9rem;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
    }

    .btn-primary {
      background: var(--pk-primary);
      color: #FFFFFF;
    }

    .btn-primary:hover {
      background: var(--pk-primary-hover);
    }

    .btn-outline {
      background: var(--pk-surface-card);
      border-color: var(--pk-border-strong);
      color: var(--pk-text-main);
    }

    .btn-outline:hover {
      background: #F1F5F9;
    }

    /* LAYOUT PRINCIPAL */
    .workspace-shell {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    /* SIDEBAR EJECUTIVA AZUL MARINO (#0F172A) */
    .sidebar {
      width: 290px;
      background: var(--pk-sidebar-bg);
      color: #F8FAFC;
      display: flex;
      flex-direction: column;
      border-right: 1px solid #1E293B;
      flex-shrink: 0;
      transition: width 0.2s ease;
      overflow-y: auto;
    }

    .sidebar.collapsed {
      width: 64px;
    }

    .sidebar.collapsed .sidebar-hide-text {
      display: none;
    }

    .sidebar-header {
      padding: 0.9rem 1rem;
      border-bottom: 1px solid #1E293B;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #94A3B8;
      font-weight: 700;
    }

    .srv-group {
      border-bottom: 1px solid #1E293B;
      padding: 0.5rem 0;
    }

    .srv-group-header {
      padding: 0.45rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.78rem;
      font-weight: 700;
      color: #E2E8F0;
    }

    .srv-key-tag {
      font-family: var(--pk-mono);
      font-size: 0.68rem;
      color: #93C5FD;
      background: rgba(29, 78, 216, 0.25);
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
    }

    .mod-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.48rem 1rem 0.48rem 1.35rem;
      font-size: 0.8rem;
      color: #CBD5E1;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background 0.12s;
    }

    .mod-item:hover {
      background: var(--pk-sidebar-hover);
      color: #FFFFFF;
    }

    .mod-item.selected {
      background: #1E293B;
      color: #FFFFFF;
      border-left-color: #3B82F6;
      font-weight: 600;
    }

    .badge-state {
      font-size: 0.64rem;
      font-weight: 700;
      padding: 0.12rem 0.42rem;
      border-radius: 4px;
      text-transform: uppercase;
      font-family: var(--pk-mono);
      flex-shrink: 0;
    }

    .badge-active {
      background: rgba(21, 128, 61, 0.25);
      color: #4ADE80;
      border: 1px solid rgba(74, 222, 128, 0.3);
    }

    .badge-archive {
      background: rgba(148, 163, 184, 0.2);
      color: #CBD5E1;
      border: 1px solid rgba(148, 163, 184, 0.35);
    }

    .badge-off {
      background: rgba(185, 28, 28, 0.2);
      color: #FCA5A5;
      border: 1px solid rgba(252, 165, 165, 0.25);
    }

    /* CONTENIDO CENTRAL */
    .main-canvas {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .card {
      background: var(--pk-surface-card);
      border: 1px solid var(--pk-border-subtle);
      border-radius: 10px;
      padding: 1.25rem;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
      padding-bottom: 0.85rem;
      border-bottom: 1px solid var(--pk-border-subtle);
    }

    .card-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--pk-text-main);
    }

    .card-subtitle {
      font-size: 0.82rem;
      color: var(--pk-text-muted);
      margin-top: 0.25rem;
    }

    /* BANNERS DE ESTADO (READONLY_ARCHIVE / LOCKED) */
    .banner-archive {
      background: var(--pk-archive-bg);
      border: 1px solid #94A3B8;
      border-left: 4px solid var(--pk-archive);
      color: var(--pk-text-main);
      padding: 0.9rem 1.1rem;
      border-radius: 8px;
      font-size: 0.84rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .banner-locked {
      background: #FEF2F2;
      border: 1px solid #FECACA;
      border-left: 4px solid var(--pk-red);
      color: #7F1D1D;
      padding: 1rem 1.15rem;
      border-radius: 8px;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    /* GRILLAS Y TABLAS CONTABLES */
    .grid-2 {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 1.25rem;
    }

    .presets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 0.9rem;
    }

    .preset-card {
      border: 1px solid var(--pk-border-subtle);
      border-radius: 8px;
      padding: 1rem;
      background: #FFFFFF;
      cursor: pointer;
      transition: all 0.15s;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.65rem;
    }

    .preset-card:hover, .preset-card.active {
      border-color: var(--pk-primary);
      background: var(--pk-primary-soft);
    }

    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1rem;
    }

    .form-group {
      margin-bottom: 0.85rem;
    }

    .form-label {
      display: block;
      font-size: 0.76rem;
      font-weight: 700;
      color: var(--pk-text-muted);
      margin-bottom: 0.35rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .form-control, .form-textarea {
      width: 100%;
      padding: 0.55rem 0.75rem;
      border: 1px solid var(--pk-border-strong);
      border-radius: 6px;
      font-size: 0.84rem;
      font-family: var(--pk-mono);
      background: #FFFFFF;
      color: var(--pk-text-main);
    }

    .form-textarea {
      min-height: 135px;
      resize: vertical;
    }

    table.pk-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
    }

    table.pk-table th {
      text-align: left;
      padding: 0.6rem 0.75rem;
      background: #F8FAFC;
      border-bottom: 1px solid var(--pk-border-subtle);
      color: var(--pk-text-muted);
      font-weight: 700;
      font-size: 0.74rem;
      text-transform: uppercase;
    }

    table.pk-table td {
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid var(--pk-border-subtle);
      color: var(--pk-text-main);
    }

    .text-right {
      text-align: right !important;
    }

    .inspector-box {
      background: #0F172A;
      color: #E2E8F0;
      border-radius: 8px;
      padding: 1rem;
      font-family: var(--pk-mono);
      font-size: 0.77rem;
      overflow-x: auto;
      line-height: 1.5;
    }

    .switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 0;
      border-bottom: 1px dashed var(--pk-border-subtle);
      font-size: 0.82rem;
    }

    .switch-row:last-child {
      border-bottom: none;
    }

    @media (max-width: 1024px) {
      .grid-2 {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <!-- TOPBAR EJECUTIVA -->
  <header class="topbar">
    <div class="topbar-left">
      <button class="btn btn-outline" id="btnToggleSidebar" title="Colapsar/Expandir Sidebar">☰</button>
      <div class="brand-badge">
        <div class="brand-logo">P</div>
        <span>Proveko Workstation</span>
      </div>
      <div class="mode-tabs">
        <button class="mode-tab active" id="tabWorkstation" onclick="switchMainView('workstation')">
          Estación Operativa (/app)
        </button>
        <button class="mode-tab" id="tabConfigurator" onclick="switchMainView('configurator')">
          Configurador Modular On/Off & Presets
        </button>
        <button class="mode-tab" id="tabCluster" onclick="switchMainView('cluster')">
          Topología de Contenedores & DBs
        </button>
      </div>
    </div>

    <div class="topbar-right">
      <div class="ctx-pill" title="Base de Datos PostgreSQL aislada por cliente">
        <span>DB Cliente:</span>
        <select id="selectTenantDb" onchange="onTenantOrBranchChange()">
          <option value="db_version_prueba">db_version_prueba (Sandbox Demo)</option>
          <option value="db_tenant_comercial_andina">db_tenant_comercial_andina</option>
          <option value="db_tenant_gastro_parrilla">db_tenant_gastro_parrilla</option>
          <option value="db_tenant_hotel_mirador">db_tenant_hotel_mirador</option>
        </select>
      </div>
      <div class="ctx-pill" title="Sucursal operativa activa en el JWT">
        <span>Sede:</span>
        <select id="selectBranch" onchange="onTenantOrBranchChange()">
          <option value="br-01">br-01 (Sede Principal)</option>
          <option value="br-02">br-02 (Sucursal Norte)</option>
        </select>
      </div>
      <div class="ctx-pill mono" id="subVerPill">sub_ver: 1</div>
      <div class="security-badge" id="securityStatusBadge">
        ● Ed25519 + HMAC-SHA256 Activo
      </div>
    </div>
  </header>

  <!-- SHELL PRINCIPAL -->
  <div class="workspace-shell">
    <!-- SIDEBAR AZUL MARINO INSTITUCIONAL -->
    <aside class="sidebar" id="mainSidebar">
      <div class="sidebar-header">
        <span class="sidebar-hide-text">Microservicios (ms:*) y Módulos</span>
      </div>
      <div id="sidebarCatalogContainer"></div>
    </aside>

    <!-- LIENZO PRINCIPAL -->
    <main class="main-canvas">
      <!-- VISTA 1: ESTACIÓN DE TRABAJO OPERATIVA -->
      <div id="viewWorkstation">
        <div id="capabilityBannerZone" style="margin-bottom: 1rem;"></div>

        <div class="grid-2">
          <!-- Tarjeta Izquierda: Operación del Módulo Seleccionado -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title" id="activeModuleTitle">Cargando módulo...</div>
                <div class="card-subtitle" id="activeModuleMeta"></div>
              </div>
              <span class="badge-state badge-active" id="activeModuleStateBadge">ACTIVO</span>
            </div>

            <div class="form-group">
              <label class="form-label">Ruta en el API Gateway (Ruteo Dinámico al Contenedor del Microservicio)</label>
              <input type="text" class="form-control" id="inputApiEndpoint" readonly />
            </div>

            <div class="form-group">
              <label class="form-label">Payload JSON de la Operación (Editable — Precisión Decimal Exacta)</label>
              <textarea class="form-textarea" id="inputJsonPayload"></textarea>
            </div>

            <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
              <button class="btn btn-primary" id="btnExecutePost" onclick="executeModuleAction('POST')">
                ▶ Ejecutar Operación en Microservicio (POST)
              </button>
              <button class="btn btn-outline" id="btnExecuteGet" onclick="executeModuleAction('GET')">
                ↻ Consultar Registros del Módulo (GET)
              </button>
              <button class="btn btn-outline" id="btnQuickToggleMod" onclick="toggleCurrentSelectedModule()">
                ⚡ Prender / Apagar este Módulo
              </button>
            </div>

            <div style="margin-top: 1.25rem;">
              <div class="form-label">Registros Operativos Devueltos por el Microservicio</div>
              <div id="moduleRecordsTableContainer" style="overflow-x: auto; border: 1px solid var(--pk-border-subtle); border-radius: 6px; padding: 0.5rem;">
                <span style="font-size: 0.8rem; color: var(--pk-text-muted);">Ejecuta una operación o consulta para ver los registros en vivo.</span>
              </div>
            </div>
          </div>

          <!-- Tarjeta Derecha: Inspector de Red Zero-Trust (Gateway -> Microservicio) -->
          <div class="card">
            <div class="card-header">
              <div>
                <div class="card-title">Inspector en Vivo: API Gateway → Contenedor Microservicio</div>
                <div class="card-subtitle">Muestra las cabeceras verificadas, el contenedor que respondió y el sello HMAC-SHA256</div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; margin-bottom: 1rem;">
              <div class="ctx-pill">
                <span>Contenedor Destino:</span>
                <strong class="mono" id="inspServedBy">—</strong>
              </div>
              <div class="ctx-pill">
                <span>Upstream URL:</span>
                <strong class="mono" id="inspBaseUrl">—</strong>
              </div>
              <div class="ctx-pill">
                <span>Microservicio Padre:</span>
                <strong class="mono" id="inspParentMs">—</strong>
              </div>
              <div class="ctx-pill">
                <span>HTTP Status:</span>
                <strong class="mono" id="inspHttpStatus">—</strong>
              </div>
            </div>

            <div class="form-label">Respuesta JSON + Cabeceras del Contenedor</div>
            <pre class="inspector-box" id="inspectorOutput">// Haz clic en "Ejecutar Operación en Microservicio (POST)" o "Consultar Registros (GET)" para inspeccionar el tráfico real entre contenedores.</pre>
          </div>
        </div>
      </div>

      <!-- VISTA 2: CONFIGURADOR INTERACTIVO DE MICROSERVICIOS Y MÓDULOS ON/OFF -->
      <div id="viewConfigurator" style="display: none;">
        <div class="card" style="margin-bottom: 1.25rem;">
          <div class="card-header">
            <div>
              <div class="card-title">1. Presets Comerciales por Giro de Negocio (Activación en 1 Clic)</div>
              <div class="card-subtitle">Selecciona un giro para configurar automáticamente sus Microservicios Padres (ms:*) y Módulos (mod:*)</div>
            </div>
            <div class="ctx-pill tabular-nums" style="font-size: 0.9rem; font-weight: 800; color: var(--pk-primary);">
              Cotización Mensual Activa: <span id="lblMonthlyTotalCop">$0 COP</span>
            </div>
          </div>
          <div class="presets-grid" id="presetsGridContainer"></div>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">2. Interruptores por Microservicio Padre (<code>ms:*</code>) y Módulo Interno (<code>mod:*</code>)</div>
              <div class="card-subtitle">
                Reglas del Grafo en vivo: Prerrequisitos (<code>requires</code>), Exclusión Mutua (<code>mutex_group</code>) y Reemplazo Automático a Archivo Histórico (<code>READONLY_ARCHIVE</code>).
              </div>
            </div>
          </div>
          <div class="config-grid" id="configuratorGridContainer"></div>
        </div>
      </div>

      <!-- VISTA 3: TOPOLOGÍA EN VIVO DE CONTENEDORES Y BASES DE DATOS -->
      <div id="viewCluster" style="display: none;">
        <div class="card" style="margin-bottom: 1.25rem;">
          <div class="card-header">
            <div>
              <div class="card-title">Arquitectura Multi-Base de Datos (<code>coreDB</code> + <code>db_version_prueba</code> + <code>db_tenant_&lt;cliente&gt;</code>)</div>
              <div class="card-subtitle">Separación física de migraciones en <code>migrations/core/</code> y <code>migrations/clients/</code></div>
            </div>
            <button class="btn btn-outline" onclick="refreshClusterTopology()">↻ Actualizar Topología en Vivo</button>
          </div>
          <table class="pk-table">
            <thead>
              <tr>
                <th>Base de Datos PostgreSQL</th>
                <th>Rol en el Sistema</th>
                <th>Carpeta de Migraciones</th>
                <th>Cuándo se migra</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="mono"><strong>proveko_control_db (coreDB)</strong></td>
                <td>Base Maestra de Control: Lista de Clientes y sus DBs (<code>control_plane.tenants.db_name</code>), Celdas y Suscripciones</td>
                <td class="mono">libs/tenant-db-resolver/migrations/core/</td>
                <td>Al iniciar el sistema (<code>npm run db:migrate:core</code>)</td>
              </tr>
              <tr>
                <td class="mono"><strong>db_version_prueba</strong></td>
                <td>Base de Datos de Versión Prueba / Sandbox inicial con los 6 esquemas <code>srv_*</code></td>
                <td class="mono">libs/tenant-db-resolver/migrations/clients/</td>
                <td>Al iniciar el sistema (<code>bootstrapOnSystemStartup</code>)</td>
              </tr>
              <tr>
                <td class="mono"><strong>db_tenant_&lt;cliente&gt;</strong></td>
                <td>Base de Datos dedicada por cada Cliente registrado (aislamiento total de datos)</td>
                <td class="mono">libs/tenant-db-resolver/migrations/clients/</td>
                <td>Al registrarse el cliente o con <code>db:migrate:clients</code> / <code>db:migrate:client</code></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">Mapa de Ruteo en Vivo del API Gateway (<code>/api/v1/topology</code>)</div>
              <div class="card-subtitle">Estado actual de los contenedores <code>ms-crm</code>, <code>ms-inventory</code>, <code>ms-invoicing</code>, <code>ms-gastro</code>, <code>ms-hotel</code> y <code>ms-finance</code></div>
            </div>
          </div>
          <div style="overflow-x: auto;">
            <table class="pk-table" id="topologyTable">
              <thead>
                <tr>
                  <th>Microservicio Padre</th>
                  <th>Módulo Interno</th>
                  <th>Prefijo Tablas</th>
                  <th>Contenedor / Upstream URL</th>
                  <th>Modo de Ruteo</th>
                </tr>
              </thead>
              <tbody id="topologyTableBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  </div>

  <script>
    const INITIAL_CATALOG = ${serializedCatalog};

    // Configuraciones operativas reales (Rutas y Payloads de ejemplo) para los 20 Módulos
    const MODULE_OPERATIONS = {
      'ms:crm-directory': {
        getPath: '/contacts',
        postPath: '/contacts',
        sampleBody: {
          taxIdType: 'NIT',
          taxIdNumber: '901456789-1',
          legalName: 'Inversiones Comerciales Andina S.A.S.',
          email: 'facturacion@comercialandina.co',
          creditLimit: '15000000.0000',
          customFields: { sector: 'Corporativo', plazoDias: 30 }
        }
      },
      'ms:crm-pipelines': {
        getPath: '/deals',
        postPath: '/deals',
        sampleBody: {
          contactId: 'dir-client-01',
          stageKey: 'PROPOSAL',
          expectedValue: '4850000.0000'
        }
      },
      'ms:crm-loyalty': {
        getPath: '/wallets',
        postPath: '/accrue',
        sampleBody: {
          contactId: 'dir-client-01',
          invoiceAmount: '250000.0000'
        }
      },
      'ms:invoicing-pos': {
        getPath: '/shifts',
        postPath: '/checkout',
        sampleBody: {
          contactId: 'dir-client-01',
          lines: [
            { sku: 'SKU-CAFE-ESP', quantity: '2.0000', unitPrice: '18500.0000', taxPercent: '19.00' },
            { sku: 'SKU-PASTEL-ALM', quantity: '1.0000', unitPrice: '14000.0000', taxPercent: '19.00' }
          ]
        }
      },
      'ms:invoicing-simple-receipt': {
        getPath: '/receipts',
        postPath: '/receipts',
        sampleBody: {
          consecutiveNumber: 'POS-REC-00045',
          customerName: 'Consumidor Final Mostrador',
          totalAmount: '51000.0000'
        }
      },
      'ms:invoicing-electronic-dian': {
        getPath: '/invoices',
        postPath: '/invoices/emit',
        sampleBody: {
          prefixAndNumber: 'SETP990001024',
          issuerNit: '901999888',
          customerNit: '901456789',
          subtotal: '350000.0000',
          ivaPercent: '19.00'
        }
      },
      'ms:invoicing-quotes': {
        getPath: '/quotes',
        postPath: '/quotes',
        sampleBody: {
          contactId: 'dir-client-01',
          quoteNumber: 'COT-2026-0089',
          totalAmount: '1250000.0000'
        }
      },
      'ms:inventory-stock': {
        getPath: '/items',
        postPath: '/movements',
        sampleBody: {
          sku: 'SKU-CAFE-ESP',
          movementType: 'INBOUND',
          currentQty: '25.0000',
          quantityDelta: '15.0000',
          unitCost: '9200.0000'
        }
      },
      'ms:inventory-recipes': {
        getPath: '/recipes',
        postPath: '/recipes/explode-cost',
        sampleBody: {
          finishedProductSku: 'PLATO-LOMO-FINO',
          soldQuantity: '2.0000',
          ingredients: [
            { ingredientSku: 'INS-LOMO-RES-KG', quantityRequired: '0.3500', unitCost: '42000.0000' },
            { ingredientSku: 'INS-MANTEQUILLA-GR', quantityRequired: '0.0500', unitCost: '18000.0000' }
          ]
        }
      },
      'ms:inventory-lots': {
        getPath: '/batches',
        postPath: '/batches/allocate-fefo',
        sampleBody: {
          sku: 'INS-LACTEO-CREMA',
          requestedQty: '8.0000',
          referenceDate: '2026-11-05',
          batches: [
            { batchCode: 'LOTE-2026-A', expirationDate: '2026-11-20', availableQty: '5.0000' },
            { batchCode: 'LOTE-2026-B', expirationDate: '2026-12-15', availableQty: '10.0000' }
          ]
        }
      },
      'ms:inventory-transfers': {
        getPath: '/transfers',
        postPath: '/transfers',
        sampleBody: {
          toBranchId: 'br-02',
          sku: 'SKU-CAFE-ESP',
          quantity: '5.0000'
        }
      },
      'ms:gastro-tables': {
        getPath: '/tables',
        postPath: '/tables/occupy',
        sampleBody: {
          tableCode: 'MESA-TERRAZA-04',
          guestsCount: 4
        }
      },
      'ms:gastro-kds': {
        getPath: '/tickets',
        postPath: '/tickets/dispatch',
        sampleBody: {
          stationKey: 'GRILL',
          tableCode: 'MESA-TERRAZA-04',
          items: [
            { sku: 'PLATO-LOMO-FINO', qty: 2, notes: 'Término 3/4, sin sal' }
          ]
        }
      },
      'ms:gastro-split-check': {
        getPath: '/checks/split-by-seats',
        postPath: '/checks/split-by-seats',
        sampleBody: {
          tableCode: 'MESA-TERRAZA-04',
          tipRatePercent: '10.00',
          seatSubtotals: [
            { seatNumber: 1, subtotal: '65000.0000' },
            { seatNumber: 2, subtotal: '48000.0000' }
          ]
        }
      },
      'ms:hotel-rooms': {
        getPath: '/rooms',
        postPath: '/rooms',
        sampleBody: {
          roomNumber: 'SUITE-301',
          roomCategory: 'DELUXE_OCEAN',
          nightlyRate: '280000.0000'
        }
      },
      'ms:hotel-bookings': {
        getPath: '/reservations',
        postPath: '/reservations',
        sampleBody: {
          guestContactId: 'dir-client-01',
          roomNumber: 'SUITE-301',
          nightsCount: 3,
          nightlyRate: '280000.0000'
        }
      },
      'ms:hotel-frontdesk': {
        getPath: '/folios/post-charge',
        postPath: '/folios/post-charge',
        sampleBody: {
          roomNumber: 'SUITE-301',
          currentBalance: '840000.0000',
          newChargeAmount: '62000.0000'
        }
      },
      'ms:finance-cashbook': {
        getPath: '/entries',
        postPath: '/entries',
        sampleBody: {
          entryType: 'INCOME',
          concept: 'Cierre de Turno Caja Principal',
          amount: '980000.0000'
        }
      },
      'ms:finance-ar-ap': {
        getPath: '/ledgers/apply-payment',
        postPath: '/ledgers/apply-payment',
        sampleBody: {
          contactId: 'dir-client-01',
          ledgerType: 'RECEIVABLE_CXC',
          outstandingBalance: '1500000.0000',
          paymentAmount: '500000.0000'
        }
      },
      'ms:finance-accounting-puc': {
        getPath: '/journal/post-voucher',
        postPath: '/journal/post-voucher',
        sampleBody: {
          voucherNumber: 'CBTE-2026-00412',
          lines: [
            { pucAccountCode: '110505', thirdPartyContactId: 'dir-client-01', debit: '238000.0000', credit: '0.0000' },
            { pucAccountCode: '413501', thirdPartyContactId: 'dir-client-01', debit: '0.0000', credit: '200000.0000' },
            { pucAccountCode: '240801', thirdPartyContactId: 'dir-client-01', debit: '0.0000', credit: '38000.0000' }
          ]
        }
      }
    };

    // Estado reactivo en el cliente
    let state = {
      tenantId: 'db_version_prueba',
      activeBranchId: 'br-01',
      subVer: 1,
      jwtToken: '',
      selectedModuleKey: 'ms:invoicing-electronic-dian',
      selectedPresetKey: 'preset:enterprise-erp',
      // Por defecto arrancamos con el Preset Corporativo para poder probar todos los módulos de inmediato
      services: {
        'srv:crm': ['ms:crm-directory', 'ms:crm-pipelines', 'ms:crm-loyalty'],
        'srv:invoicing': ['ms:invoicing-pos', 'ms:invoicing-electronic-dian', 'ms:invoicing-quotes'],
        'srv:inventory': ['ms:inventory-stock', 'ms:inventory-recipes', 'ms:inventory-lots', 'ms:inventory-transfers'],
        'srv:gastro': ['ms:gastro-tables', 'ms:gastro-kds', 'ms:gastro-split-check'],
        'srv:hotel': ['ms:hotel-rooms', 'ms:hotel-bookings', 'ms:hotel-frontdesk'],
        'srv:finance': ['ms:finance-ar-ap', 'ms:finance-accounting-puc']
      },
      readonlyMicroservices: ['ms:invoicing-simple-receipt', 'ms:finance-cashbook']
    };

    document.getElementById('btnToggleSidebar').addEventListener('click', () => {
      document.getElementById('mainSidebar').classList.toggle('collapsed');
    });

    function switchMainView(viewName) {
      document.getElementById('viewWorkstation').style.display = viewName === 'workstation' ? 'block' : 'none';
      document.getElementById('viewConfigurator').style.display = viewName === 'configurator' ? 'block' : 'none';
      document.getElementById('viewCluster').style.display = viewName === 'cluster' ? 'block' : 'none';

      document.getElementById('tabWorkstation').classList.toggle('active', viewName === 'workstation');
      document.getElementById('tabConfigurator').classList.toggle('active', viewName === 'configurator');
      document.getElementById('tabCluster').classList.toggle('active', viewName === 'cluster');

      if (viewName === 'cluster') {
        refreshClusterTopology();
      }
    }

    function getModuleDef(modKey) {
      return INITIAL_CATALOG.modules.find((m) => m.key === modKey);
    }

    function getParentDef(srvKey) {
      return INITIAL_CATALOG.microservices.find((s) => s.key === srvKey);
    }

    function getModuleStatus(modKey) {
      const def = getModuleDef(modKey);
      if (!def) return 'OFF';
      const parentList = state.services[def.parentService];
      if (!Array.isArray(parentList)) return 'PARENT_OFF';
      if (parentList.includes(modKey)) return 'ACTIVE';
      if (state.readonlyMicroservices.includes(modKey)) return 'READONLY_ARCHIVE';
      return 'OFF';
    }

    async function syncJwtSessionWithGateway() {
      try {
        const res = await fetch('/api/v1/control/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            tenantId: state.tenantId,
            activeBranchId: state.activeBranchId,
            subVer: state.subVer,
            services: state.services,
            readonlyMicroservices: state.readonlyMicroservices
          })
        });
        const data = await res.json();
        if (data && data.token) {
          state.jwtToken = data.token;
          document.getElementById('subVerPill').textContent = 'sub_ver: ' + state.subVer;
        }
      } catch (err) {
        console.error('Error sincronizando sesión JWT:', err);
      }
    }

    async function onTenantOrBranchChange() {
      state.tenantId = document.getElementById('selectTenantDb').value;
      state.activeBranchId = document.getElementById('selectBranch').value;
      state.subVer += 1;
      await syncJwtSessionWithGateway();
      renderAll();
    }

    function renderSidebar() {
      const container = document.getElementById('sidebarCatalogContainer');
      let html = '';

      for (const srv of INITIAL_CATALOG.microservices) {
        const isParentEnabled = Array.isArray(state.services[srv.key]);
        const childModules = INITIAL_CATALOG.modules.filter((m) => m.parentService === srv.key);

        html += '<div class="srv-group">';
        html += '<div class="srv-group-header">';
        html += '<span class="sidebar-hide-text">' + srv.name + '</span>';
        html += '<span class="srv-key-tag">' + srv.microserviceKey + (isParentEnabled ? '' : ' [OFF]') + '</span>';
        html += '</div>';

        for (const mod of childModules) {
          const status = getModuleStatus(mod.key);
          const isSelected = state.selectedModuleKey === mod.key;
          let badgeClass = 'badge-off';
          let badgeText = 'OFF';
          if (status === 'ACTIVE') {
            badgeClass = 'badge-active';
            badgeText = 'ON';
          } else if (status === 'READONLY_ARCHIVE') {
            badgeClass = 'badge-archive';
            badgeText = 'HIST';
          }

          html += '<div class="mod-item ' + (isSelected ? 'selected' : '') + '" onclick="selectModule(\\'' + mod.key + '\\')">';
          html += '<span class="sidebar-hide-text">' + mod.name + '</span>';
          html += '<span class="badge-state ' + badgeClass + '">' + badgeText + '</span>';
          html += '</div>';
        }

        html += '</div>';
      }

      container.innerHTML = html;
    }

    function selectModule(modKey) {
      state.selectedModuleKey = modKey;
      const def = getModuleDef(modKey);
      const op = MODULE_OPERATIONS[modKey];
      if (def && op) {
        document.getElementById('inputApiEndpoint').value =
          '/api/v1/' + def.parentMicroserviceKey + '/' + def.moduleKey + op.postPath;
        document.getElementById('inputJsonPayload').value = JSON.stringify(op.sampleBody, null, 2);
      }
      switchMainView('workstation');
      renderAll();
    }

    function renderActiveWorkstationCard() {
      const def = getModuleDef(state.selectedModuleKey);
      const parentDef = def ? getParentDef(def.parentService) : null;
      const op = MODULE_OPERATIONS[state.selectedModuleKey];
      if (!def || !parentDef || !op) return;

      const status = getModuleStatus(def.key);
      document.getElementById('activeModuleTitle').textContent =
        def.name + ' (' + def.moduleKey + ')';
      document.getElementById('activeModuleMeta').innerHTML =
        'Microservicio Padre: <code class="mono">' +
        def.parentMicroserviceKey +
        '</code> · Esquema PG: <code class="mono">' +
        parentDef.schemaName +
        '</code> · Prefijo Tablas: <code class="mono">' +
        def.tablePrefix +
        '</code> · Base Cliente: <code class="mono">' +
        state.tenantId +
        '</code>';

      const stateBadge = document.getElementById('activeModuleStateBadge');
      const bannerZone = document.getElementById('capabilityBannerZone');

      if (status === 'ACTIVE') {
        stateBadge.className = 'badge-state badge-active';
        stateBadge.textContent = 'ACTIVO (FULL_INTERACTIVE)';
        bannerZone.innerHTML = '';
      } else if (status === 'READONLY_ARCHIVE') {
        stateBadge.className = 'badge-state badge-archive';
        stateBadge.textContent = 'READONLY_ARCHIVE';
        bannerZone.innerHTML =
          '<div class="banner-archive">' +
          '<div><strong>Modo Archivo Histórico (Solo Lectura — READONLY_ARCHIVE):</strong> Este módulo (<code class="mono">' +
          def.moduleKey +
          '</code>) fue reemplazado por un módulo superior de su grupo (<code class="mono">mutex_group: ' +
          (def.mutexGroup || 'N/A') +
          '</code>). Las consultas históricas (GET) están permitidas, pero cualquier intento de escritura (POST) será rechazado con <code>403 ERR_MICROSERVICE_READONLY_ARCHIVE</code>.</div>' +
          '<button class="btn btn-outline" onclick="toggleCurrentSelectedModule()">Reactivar como Principal</button>' +
          '</div>';
      } else {
        stateBadge.className = 'badge-state badge-off';
        stateBadge.textContent = status === 'PARENT_OFF' ? 'MICROSERVICIO PADRE APAGADO' : 'MÓDULO APAGADO (OFF)';
        bannerZone.innerHTML =
          '<div class="banner-locked">' +
          '<div><strong>Módulo Desactivado en la Suscripción Actual:</strong> Si intentas enviar una petición ahora mismo, el API Gateway o el Microservicio la bloqueará con <code>403 Forbidden</code>. Puedes probar el bloqueo o encender el módulo en caliente.</div>' +
          '<button class="btn btn-primary" onclick="toggleCurrentSelectedModule()">⚡ Encender Módulo en Caliente</button>' +
          '</div>';
      }

      const currentEndpointInput = document.getElementById('inputApiEndpoint');
      if (!currentEndpointInput.value || !currentEndpointInput.value.includes(def.moduleKey)) {
        currentEndpointInput.value =
          '/api/v1/' + def.parentMicroserviceKey + '/' + def.moduleKey + op.postPath;
        document.getElementById('inputJsonPayload').value = JSON.stringify(op.sampleBody, null, 2);
      }
    }

    async function executeModuleAction(httpMethod) {
      const def = getModuleDef(state.selectedModuleKey);
      const op = MODULE_OPERATIONS[state.selectedModuleKey];
      if (!def || !op) return;

      const subPath = httpMethod === 'GET' ? op.getPath : op.postPath;
      const endpointUrl = '/api/v1/' + def.parentMicroserviceKey + '/' + def.moduleKey + subPath;
      document.getElementById('inputApiEndpoint').value = endpointUrl;

      let parsedBody = undefined;
      if (httpMethod !== 'GET') {
        try {
          parsedBody = JSON.parse(document.getElementById('inputJsonPayload').value);
        } catch (err) {
          alert('El JSON del payload no es válido: ' + err.message);
          return;
        }
      }

      document.getElementById('inspectorOutput').textContent = 'Enviando petición a ' + endpointUrl + '...';

      try {
        const res = await fetch(endpointUrl, {
          method: httpMethod,
          headers: {
            'content-type': 'application/json',
            'authorization': 'Bearer ' + state.jwtToken
          },
          body: httpMethod !== 'GET' ? JSON.stringify(parsedBody) : undefined
        });

        const servedBy = res.headers.get('x-proveko-served-by') || res.headers.get('x-proveko-gateway-routed-to') || 'api-gateway';
        const baseUrl = res.headers.get('x-proveko-gateway-base-url') || 'local';
        const parentMs = res.headers.get('x-proveko-parent-microservice') || def.parentMicroserviceKey;

        document.getElementById('inspServedBy').textContent = servedBy;
        document.getElementById('inspBaseUrl').textContent = baseUrl;
        document.getElementById('inspParentMs').textContent = parentMs;
        document.getElementById('inspHttpStatus').textContent = res.status + ' ' + res.statusText;
        document.getElementById('inspHttpStatus').style.color =
          res.status >= 200 && res.status < 300 ? '#15803D' : '#B91C1C';

        const respBody = await res.json().catch(() => ({}));

        const headerDump = {};
        res.headers.forEach((v, k) => {
          if (k.startsWith('x-proveko-') || k === 'content-type') {
            headerDump[k] = v;
          }
        });

        document.getElementById('inspectorOutput').textContent = JSON.stringify(
          {
            request: {
              method: httpMethod,
              url: endpointUrl,
              tenantDatabase: state.tenantId,
              activeBranchId: state.activeBranchId,
              subVer: state.subVer
            },
            responseStatus: res.status,
            zeroTrustHeaders: headerDump,
            responseBody: respBody
          },
          null,
          2
        );

        renderRecordsTable(respBody);
      } catch (err) {
        document.getElementById('inspectorOutput').textContent =
          'Error de red al invocar microservicio: ' + err.message;
      }
    }

    function renderRecordsTable(data) {
      const container = document.getElementById('moduleRecordsTableContainer');
      const rows = Array.isArray(data)
        ? data
        : data && Array.isArray(data.items)
        ? data.items
        : data && Array.isArray(data.allocations)
        ? data.allocations
        : data && Array.isArray(data.deductions)
        ? data.deductions
        : data && Array.isArray(data.splits)
        ? data.splits
        : data && typeof data === 'object'
        ? [data]
        : [];

      if (rows.length === 0) {
        container.innerHTML = '<span style="font-size: 0.8rem; color: var(--pk-text-muted);">Sin registros devueltos.</span>';
        return;
      }

      const keys = Object.keys(rows[0]).slice(0, 6);
      let html = '<table class="pk-table"><thead><tr>';
      for (const k of keys) {
        html += '<th>' + k + '</th>';
      }
      html += '</tr></thead><tbody>';

      for (const r of rows) {
        html += '<tr>';
        for (const k of keys) {
          const val = r[k];
          const formatted =
            typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '');
          const isNumeric = /^-?\\d+\\.\\d+$/.test(formatted);
          html += '<td class="' + (isNumeric ? 'tabular-nums text-right mono' : 'mono') + '">' + formatted + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function applyIndustryPreset(presetKey) {
      const preset = INITIAL_CATALOG.presets.find((p) => p.key === presetKey);
      if (!preset) return;

      state.selectedPresetKey = presetKey;
      const newServices = {};
      const newReadonly = [];

      for (const srvKey of preset.enabledServices) {
        newServices[srvKey] = [];
      }

      for (const modKey of preset.enabledMicroservices) {
        const def = getModuleDef(modKey);
        if (!def) continue;
        if (!Array.isArray(newServices[def.parentService])) {
          newServices[def.parentService] = [];
        }
        newServices[def.parentService].push(modKey);
        for (const sup of def.supersedes || []) {
          if (!newReadonly.includes(sup)) {
            newReadonly.push(sup);
          }
        }
      }

      state.services = newServices;
      state.readonlyMicroservices = newReadonly;
      state.subVer += 1;
      syncJwtSessionWithGateway().then(() => renderAll());
    }

    function toggleParentService(srvKey) {
      if (Array.isArray(state.services[srvKey])) {
        delete state.services[srvKey];
      } else {
        const defaultMods = INITIAL_CATALOG.modules
          .filter((m) => m.parentService === srvKey && (!m.mutexGroup || m.supersedes.length > 0))
          .map((m) => m.key);
        state.services[srvKey] = defaultMods;
      }
      state.subVer += 1;
      syncJwtSessionWithGateway().then(() => renderAll());
    }

    function toggleModuleCapability(modKey) {
      const def = getModuleDef(modKey);
      if (!def) return;

      // Asegurar que el Microservicio Padre esté encendido
      if (!Array.isArray(state.services[def.parentService])) {
        state.services[def.parentService] = [];
      }

      const list = state.services[def.parentService];
      const idx = list.indexOf(modKey);

      if (idx >= 0) {
        // Apagar módulo
        list.splice(idx, 1);
      } else {
        // Encender también sus prerrequisitos automáticamente para facilitar la prueba
        for (const reqSrv of def.requiresServices || []) {
          if (!Array.isArray(state.services[reqSrv])) {
            state.services[reqSrv] = [];
          }
        }
        for (const reqMod of def.requiresMicroservices || []) {
          const reqDef = getModuleDef(reqMod);
          if (reqDef) {
            if (!Array.isArray(state.services[reqDef.parentService])) {
              state.services[reqDef.parentService] = [];
            }
            if (!state.services[reqDef.parentService].includes(reqMod)) {
              state.services[reqDef.parentService].push(reqMod);
            }
          }
        }

        // Manejar mutexGroup y supersedes -> READONLY_ARCHIVE
        if (def.mutexGroup) {
          const siblingsInMutex = INITIAL_CATALOG.modules.filter(
            (m) => m.mutexGroup === def.mutexGroup && m.key !== modKey
          );
          for (const sib of siblingsInMutex) {
            const sibParentList = state.services[sib.parentService];
            if (Array.isArray(sibParentList)) {
              const sibIdx = sibParentList.indexOf(sib.key);
              if (sibIdx >= 0) {
                sibParentList.splice(sibIdx, 1);
                if (!state.readonlyMicroservices.includes(sib.key)) {
                  state.readonlyMicroservices.push(sib.key);
                }
              }
            }
          }
        }

        state.readonlyMicroservices = state.readonlyMicroservices.filter((k) => k !== modKey);
        list.push(modKey);
      }

      state.subVer += 1;
      syncJwtSessionWithGateway().then(() => renderAll());
    }

    function toggleCurrentSelectedModule() {
      toggleModuleCapability(state.selectedModuleKey);
    }

    function renderConfigurator() {
      // 1. Renderizar Presets
      const presetsContainer = document.getElementById('presetsGridContainer');
      let presetsHtml = '';
      for (const p of INITIAL_CATALOG.presets) {
        const isActive = state.selectedPresetKey === p.key;
        presetsHtml +=
          '<div class="preset-card ' +
          (isActive ? 'active' : '') +
          '" onclick="applyIndustryPreset(\\'' +
          p.key +
          '\\')">' +
          '<div>' +
          '<div style="font-weight: 700; font-size: 0.92rem; color: var(--pk-text-main);">' +
          p.name +
          '</div>' +
          '<div style="font-size: 0.78rem; color: var(--pk-text-muted); margin-top: 0.25rem;">' +
          p.targetAudience +
          '</div>' +
          '</div>' +
          '<div class="mono" style="font-size: 0.72rem; color: var(--pk-primary);">' +
          p.enabledServices.length +
          ' Microservicios · ' +
          p.enabledMicroservices.length +
          ' Módulos →</div>' +
          '</div>';
      }
      presetsContainer.innerHTML = presetsHtml;

      // 2. Calcular cotización mensual y renderizar interruptores por Microservicio y Módulo
      let totalCop = 0;
      const gridContainer = document.getElementById('configuratorGridContainer');
      let gridHtml = '';

      for (const srv of INITIAL_CATALOG.microservices) {
        const isParentOn = Array.isArray(state.services[srv.key]);
        const childMods = INITIAL_CATALOG.modules.filter((m) => m.parentService === srv.key);

        gridHtml += '<div class="card" style="padding: 1rem;">';
        gridHtml +=
          '<div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.65rem; margin-bottom: 0.65rem; border-bottom: 1px solid var(--pk-border-subtle);">' +
          '<div>' +
          '<div style="font-weight: 700; font-size: 0.92rem;">' +
          srv.name +
          '</div>' +
          '<div class="mono" style="font-size: 0.72rem; color: var(--pk-text-muted);">' +
          srv.microserviceKey +
          ' · Esquema: ' +
          srv.schemaName +
          '</div>' +
          '</div>' +
          '<button class="btn ' +
          (isParentOn ? 'btn-primary' : 'btn-outline') +
          '" onclick="toggleParentService(\\'' +
          srv.key +
          '\\')">' +
          (isParentOn ? 'Gatekeeper ON' : 'Gatekeeper OFF') +
          '</button>' +
          '</div>';

        for (const mod of childMods) {
          const status = getModuleStatus(mod.key);
          const priceNum = Number(mod.baseMonthlyPriceCop || 0);
          if (status === 'ACTIVE') {
            totalCop += priceNum;
          }

          gridHtml +=
            '<div class="switch-row">' +
            '<div>' +
            '<div style="font-weight: 600;">' +
            mod.name +
            '</div>' +
            '<div class="mono" style="font-size: 0.7rem; color: var(--pk-text-light);">' +
            mod.moduleKey +
            ' (' +
            mod.tablePrefix +
            ') · $' +
            priceNum.toLocaleString('es-CO') +
            ' COP</div>' +
            '</div>' +
            '<button class="btn ' +
            (status === 'ACTIVE' ? 'btn-primary' : 'btn-outline') +
            '" style="padding: 0.3rem 0.65rem; font-size: 0.74rem;" onclick="toggleModuleCapability(\\'' +
            mod.key +
            '\\')">' +
            (status === 'ACTIVE'
              ? 'ACTIVO'
              : status === 'READONLY_ARCHIVE'
              ? 'HISTÓRICO'
              : 'APAGADO') +
            '</button>' +
            '</div>';
        }

        gridHtml += '</div>';
      }

      gridContainer.innerHTML = gridHtml;
      document.getElementById('lblMonthlyTotalCop').textContent =
        '$' + totalCop.toLocaleString('es-CO') + ' COP / mes';
    }

    async function refreshClusterTopology() {
      const tbody = document.getElementById('topologyTableBody');
      try {
        const res = await fetch('/api/v1/topology');
        const data = await res.json();
        const list = (data && data.topology) || [];
        let html = '';
        for (const item of list) {
          const def = getModuleDef(item.microserviceKey);
          html +=
            '<tr>' +
            '<td class="mono"><strong>' +
            (def ? def.parentMicroserviceKey : item.parentService) +
            '</strong></td>' +
            '<td class="mono">' +
            (def ? def.moduleKey : item.microserviceKey) +
            '</td>' +
            '<td class="mono">' +
            (def ? def.tablePrefix : '—') +
            '</td>' +
            '<td class="mono" style="color: var(--pk-primary);">' +
            (item.targetBaseUrl || 'En Memoria') +
            '</td>' +
            '<td><span class="badge-state badge-active">' +
            item.resolvedMode +
            '</span></td>' +
            '</tr>';
        }
        tbody.innerHTML = html;
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5">Error consultando /api/v1/topology: ' + err.message + '</td></tr>';
      }
    }

    function renderAll() {
      renderSidebar();
      renderActiveWorkstationCard();
      renderConfigurator();
    }

    // Inicialización automática al cargar la estación de trabajo
    (async function initWorkstation() {
      await syncJwtSessionWithGateway();
      selectModule(state.selectedModuleKey);
    })();
  </script>
</body>
</html>`;
}
