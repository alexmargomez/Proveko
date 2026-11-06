/**
 * Superficie Operativa del Cliente (`/app`) y Apartado 3 Público (`Demo`):
 * - Integra el Motor Relacional Convergente estilo FactuPOS (FixMotor) + HC Version2 (v2) con Foreign Keys reales.
 * - En una sola vista convergen Clientes, Contratos/Tarifarios v2, Vehículos/Activos con Alertas SOAT/Aceite,
 *   Catálogo de Inventario Valorizado con Lector SKU, Mano de Obra con Técnico Comisionista, Pagos Mixtos,
 *   Cartera CxC con Abonos, Tablero Kanban de 5 Columnas, Expediente 360°, Arqueo de Caja y Exportación CSV.
 */
export function renderWorkstationLayerHtml(): string {
  return `
  <section class="surface" id="surface-workstation">
    <!-- BANNER EXCLUSIVO CUANDO SE NAVEGA EN EL APARTADO 3: DEMO -->
    <div id="demo-mode-banner" style="display:none;background:linear-gradient(90deg,#023047,#1d4ed8);color:#fff;padding:10px 16px;border-radius:12px;margin-bottom:14px;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="font-size:12px">
        <strong>🧪 DEMO INTERACTIVA RELACIONAL (FactuPOS + Version2):</strong> Todas las tablas están enlazadas con <strong>Foreign Keys (FK)</strong> en vivo: si creas un cliente, producto, orden Kanban o factura, impacta automáticamente el Stock, Kardex, Cartera CxC, Comisiones de Técnicos y Arqueo de Caja.
      </div>
      <button type="button" class="btn btn-emerald btn-sm" id="btn-demo-go-register">
        🚀 Registra tu Negocio y obtén tu propia Base de Datos PostgreSQL &rarr;
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

      <!-- ÁREA CENTRAL DE OPERACIÓN CONVERGENTE -->
      <div class="ws-main">
        <!-- VISTA 1: OPERACIÓN RELACIONAL CONVERGENTE (FACTUPOS + VERSION2) -->
        <div id="ws-pane-module-operation">
          <!-- BARRA SUPERIOR DE CENTROS DE CONVERGENCIA RELACIONAL -->
          <div class="card" style="margin-bottom:14px;border:2px solid #cbd5e1">
            <div class="card-head" style="background:linear-gradient(90deg,#0f172a,#1e293b);color:#fff;border-radius:12px 12px 0 0">
              <div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span id="ws-active-service-icon" style="font-size:20px">🛒</span>
                  <h2 style="margin:0;font-size:17px;color:#fff" id="ws-active-service-title">Centro Operativo Relacional</h2>
                  <span class="badge badge-emerald" id="ws-active-db-badge">BD Relacional Activa</span>
                </div>
                <div style="font-size:12px;color:#cbd5e1;margin-top:3px" id="ws-active-service-sub"></div>
              </div>
              <div id="ws-active-features-pills" style="display:flex;gap:6px;flex-wrap:wrap"></div>
            </div>

            <!-- SELECTOR RÁPIDO DE FLUJOS CONVERGENTES (ENLAZADOS POR FOREIGN KEYS) -->
            <div style="padding:10px 14px;background:#f1f5f9;border-bottom:1px solid var(--pk-border);display:flex;gap:6px;flex-wrap:wrap;align-items:center" id="ws-converged-hub-bar">
              <span style="font-size:11px;font-weight:800;color:#023047;text-transform:uppercase;margin-right:4px">🔗 Flujos Integrados (FK):</span>
              <button type="button" class="btn btn-sm" data-hub-mode="pos" id="hub-btn-pos">🛒 1. POS Híbrido, Facturación y Cotizaciones</button>
              <button type="button" class="btn btn-sm" data-hub-mode="kanban" id="hub-btn-kanban">🛠️ 2. Recepción, Vehículos y Kanban en Vivo</button>
              <button type="button" class="btn btn-sm" data-hub-mode="inventory" id="hub-btn-inventory">📦 3. Inventario Valorizado, Compras y Actas v2</button>
              <button type="button" class="btn btn-sm" data-hub-mode="look360" id="hub-btn-look360">🔍 4. Consultas 360°, Clientes, Contratos y Cartera CxC</button>
              <button type="button" class="btn btn-sm" data-hub-mode="reports" id="hub-btn-reports">📊 5. Arqueo Caja, Gastos, Comisiones y CSV</button>
              <button type="button" class="btn btn-sm" data-hub-mode="gastro" id="hub-btn-gastro">🍽️ 6. Mesas, KDS y Cuenta a Caja</button>
              <button type="button" class="btn btn-sm" data-hub-mode="submodules" id="hub-btn-submodules">📑 7. Submódulos Específicos</button>
            </div>

            <!-- CONTENEDOR PRINCIPAL DEL MOTOR CONVERGENTE -->
            <div class="card-body" id="ws-converged-hub-container"></div>

            <!-- SECCIÓN DE SUBMÓDULOS ESPECÍFICOS (CUANDO SE ELIGE MODO SUBMÓDULOS) -->
            <div id="ws-legacy-submodule-wrapper" style="display:none;border-top:1px solid var(--pk-border)">
              <div style="padding:10px 18px;background:#f8fafc;border-bottom:1px solid var(--pk-border);display:flex;gap:8px;flex-wrap:wrap" id="ws-submodule-tabs"></div>
              <div class="card-body">
                <div style="margin-bottom:12px;font-size:12px;color:var(--pk-muted)" id="ws-submodule-summary"></div>
                <div id="ws-specialized-widget-slot" style="margin-bottom:16px"></div>
                <div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:14px;margin-bottom:16px">
                  <div class="grid-3" id="ws-submodule-form-fields"></div>
                  <div class="row-actions" style="margin-top:12px;justify-content:flex-end">
                    <button type="button" class="btn btn-primary" id="btn-ws-save-record">Guardar Registro</button>
                  </div>
                </div>
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
                <div class="table-wrap">
                  <table>
                    <thead id="ws-submodule-thead"></thead>
                    <tbody id="ws-submodule-tbody"></tbody>
                  </table>
                </div>
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

    <!-- MODAL RELACIONAL UNIVERSAL (EXPEDIENTE 360° CLIENTE, HOJA DE VIDA VEHÍCULO, ABONOS CXC, VISOR FACTURA) -->
    <div class="modal-backdrop" id="pk-relational-modal">
      <div class="modal-box" style="max-width:860px;width:95%">
        <div class="card-head" style="background:#023047;color:#fff;border-radius:12px 12px 0 0">
          <div class="card-title" style="color:#fff" id="pk-rel-modal-title">Expediente Relacional</div>
          <button type="button" class="btn btn-outline btn-sm" style="background:#fff;color:#023047" id="btn-close-rel-modal">✕ Cerrar</button>
        </div>
        <div class="card-body" id="pk-rel-modal-body" style="max-height:78vh;overflow-y:auto"></div>
      </div>
    </div>
  </section>`;
}
