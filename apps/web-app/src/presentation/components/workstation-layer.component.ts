/**
 * Superficie Operativa Minimalista del Cliente:
 * - Menú Lateral de Iconos con Títulos Cortos (`#ws-principal-modules-nav`).
 * - Barra Superior de Secciones por Módulo (`#ws-submodule-tabs`) y Selector de Vista según el Rol.
 * - Escenario Único (`#ws-module-stage`) donde cada pestaña renderiza su interfaz propia sin info basura.
 * - Ventana Emergente (`#pk-relational-modal`) para Registrar Nuevo Cliente, Surtir Producto, Abonar a Cartera o Ver Historial.
 */
export function renderWorkstationLayerHtml(): string {
  return `
  <section class="surface" id="surface-workstation">
    <!-- AVISO CORTO EN MODO DEMO -->
    <div id="demo-mode-banner" style="display:none;background:#023047;color:#fff;padding:8px 14px;border-radius:10px;margin-bottom:12px;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div style="font-size:12px">
        <strong>Modo de Prueba Activo:</strong> Puedes facturar, crear productos, tomar comandas, recibir vehículos y registrar clientes o abonos libremente.
      </div>
      <button type="button" class="btn btn-emerald btn-sm" id="btn-demo-go-register">
        Crear Cuenta para mi Negocio &rarr;
      </button>
    </div>

    <div class="ws-layout">
      <!-- MENÚ LATERAL DE ICONOS Y TÍTULOS CORTOS -->
      <aside class="ws-sidebar">
        <div class="ws-nav-head">MENÚ PRINCIPAL</div>
        <div class="ws-nav-list" id="ws-principal-modules-nav"></div>

        <div style="border-top:1px solid rgba(255,255,255,0.12);margin:10px 0;padding-top:8px">
          <div class="ws-nav-head">CONFIGURACIÓN</div>
          <div class="ws-nav-list" id="ws-company-admin-nav">
            <button type="button" class="ws-nav-btn" id="btn-nav-internal-rbac">
              <span class="ws-nav-icon">⚙️</span>
              <span class="ws-nav-title">Usuarios y Roles</span>
            </button>
            <button type="button" class="ws-nav-btn" id="btn-nav-need-feature">
              <span class="ws-nav-icon">➕</span>
              <span class="ws-nav-title">Activar Módulos</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- ÁREA PRINCIPAL -->
      <div class="ws-main">
        <!-- VISTA DE MÓDULOS Y SECCIONES -->
        <div id="ws-pane-module-operation">
          <!-- BARRA SUPERIOR DEL MÓDULO + PESTAÑAS DE SECCIONES -->
          <div class="ws-top-subbar">
            <div class="ws-top-subbar-head">
              <div style="display:flex;align-items:center;gap:10px">
                <span id="ws-active-service-icon" style="font-size:22px">🧾</span>
                <h2 style="margin:0;font-size:18px;font-weight:800;color:#023047" id="ws-active-service-title">Facturar y Punto de Venta</h2>
              </div>
              <div class="row-actions">
                <select id="ws-role-view-selector" style="padding:6px 10px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px;font-weight:700;background:#f8fafc;color:#023047" title="Filtrar vista según el rol del trabajador">
                  <option value="ALL">👤 Vista: Administrador (Todas las secciones)</option>
                  <option value="CAJERO">💵 Vista: Cajero / Facturador</option>
                  <option value="MESERO">🍽️ Vista: Mesero / Salón</option>
                  <option value="COCINA">👨‍🍳 Vista: Cocina / Barra</option>
                  <option value="BODEGA">📦 Vista: Bodega / Almacén</option>
                  <option value="TECNICO">🔧 Vista: Técnico / Recepción</option>
                </select>
                <button type="button" class="btn btn-primary btn-sm" data-open-new-customer-modal="1">+ Nuevo Cliente</button>
              </div>
            </div>
            <!-- PESTAÑAS SUPERIORES PARA NAVEGAR ENTRE LAS SECCIONES DEL MÓDULO -->
            <div class="ws-subtabs-row" id="ws-submodule-tabs"></div>
          </div>

          <!-- CONTENEDOR ÚNICO DONDE SE RENDERIZA LA SECCIÓN ACTIVA -->
          <div id="ws-module-stage" style="margin-top:12px"></div>
        </div>

        <!-- VISTA DE USUARIOS Y ROLES -->
        <div id="ws-pane-internal-rbac" style="display:none"></div>

        <!-- VISTA DE ACTIVAR MÓDULOS ADICIONALES -->
        <div id="ws-pane-need-feature" style="display:none"></div>
      </div>
    </div>

    <!-- DIALOG / MODAL EMERGENTE (NUEVO CLIENTE, SURTIR PRODUCTO, ABONAR, HISTORIAL, FACTURA) -->
    <div class="modal-backdrop" id="pk-relational-modal">
      <div class="modal-box" style="max-width:760px;width:95%">
        <div class="card-head" style="background:#023047;color:#fff;border-radius:12px 12px 0 0;padding:12px 16px">
          <div>
            <div class="card-title" style="color:#fff;font-size:15px" id="pk-rel-modal-title">Ventana</div>
            <div style="font-size:11px;color:#cbd5e1" id="pk-rel-modal-sub"></div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" style="background:#fff;color:#023047" id="btn-close-rel-modal">✕ Cerrar</button>
        </div>
        <div class="card-body" id="pk-rel-modal-body" style="max-height:78vh;overflow-y:auto"></div>
      </div>
    </div>
  </section>`;
}
