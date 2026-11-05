/**
 * Runtime de Cliente — Centro 5 (Terceros, Cartera CxC/CxP y Contabilidad),
 * Centro 6 (Usuarios, Roles y Componentes) y Consola SuperAdmin Global (`/superadmin`) (SOLID SRP).
 */
export function renderGatewayTransportRuntimeJs(): string {
  return `
    function renderCrmAndFinanceCenter() {
      const showPortfolio = hasComponent('comp:credit-portfolio');
      const showPuc = hasComponent('comp:double-entry-puc');
      const totalReceivable = STATE.db.thirdParties.reduce((a, b) => a + b.balanceDue, 0);

      document.getElementById('center-kpi-strip').innerHTML =
        '<div class="kpi-card"><span class="kpi-label">Terceros Registrados</span><div class="kpi-value tabular-nums">' + STATE.db.thirdParties.length + ' Fichas</div><span class="kpi-sub">Clientes, Proveedores y Conductores</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Saldo Total Cartera</span><div class="kpi-value tabular-nums" style="color:#B45309;">' + formatCop(totalReceivable) + '</div><span class="kpi-sub">Control de cupos y vencimientos</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Asientos Contables</span><div class="kpi-value">' + (showPuc ? STATE.db.journalVouchers.length + ' Comprobantes' : 'Caja Directa') + '</div><span class="kpi-sub">Partida doble verificada</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Estado de Tesorería</span><div class="kpi-value" style="color:#15803D;">Al Día</div><span class="kpi-sub">Conciliado con Facturación</span></div>';

      const canvas = document.getElementById('center-workspace-canvas');
      canvas.innerHTML =
        '<div class="card" style="margin-bottom:16px;"><div class="card-header"><span class="card-title">🏦 Directorio Maestro de Terceros (Clientes, Proveedores y Conductores) y Cartera</span><button type="button" class="btn btn-primary" onclick="window.provekoCreateThirdParty()">+ Guardar Tercero</button></div>' +
          '<div class="card-body"><div class="form-grid-3" style="margin-bottom:12px;">' +
            '<div class="form-group"><label class="form-label">NIT / Cédula</label><input id="tp-nit" class="form-control mono" value="901.552.109-4" /></div>' +
            '<div class="form-group"><label class="form-label">Razón Social o Nombre Completo</label><input id="tp-name" class="form-control" value="Distribuidora Mayorista del Cauca S.A.S." /></div>' +
            '<div class="form-group"><label class="form-label">Vinculación</label><select id="tp-type" class="form-control"><option value="CLIENTE">Cliente Comercial</option><option value="PROVEEDOR">Proveedor de Insumos / Carga</option><option value="CONDUCTOR_TRANSPORTADOR">Conductor / Transportador</option></select></div>' +
            '<div class="form-group"><label class="form-label">Teléfono / WhatsApp</label><input id="tp-phone" class="form-control" value="+57 316 552 1094" /></div>' +
            '<div class="form-group"><label class="form-label">Ciudad</label><input id="tp-city" class="form-control" value="Popayán" /></div>' +
            (showPortfolio ? '<div class="form-group"><label class="form-label">Cupo de Crédito Autorizado ($)</label><input id="tp-limit" type="number" class="form-control tabular-nums" value="30000000" /></div>' : '') +
          '</div>' +
          '<table class="data-table"><thead><tr><th>NIT / CC</th><th>Razón Social / Tercero</th><th>Rol</th><th>Teléfono / Ciudad</th>' + (showPortfolio ? '<th>Cupo Crédito</th><th>Saldo Pendiente</th><th>Abonar</th>' : '') + '</tr></thead><tbody>' +
            STATE.db.thirdParties.map((tp, idx) =>
              '<tr><td class="mono" style="font-weight:700;">' + escapeHtml(tp.taxId) + '</td><td style="font-weight:700;">' + escapeHtml(tp.legalName) + '</td><td><span class="badge badge-blue">' + escapeHtml(tp.thirdPartyType) + '</span></td><td>' + escapeHtml(tp.phone) + ' · ' + escapeHtml(tp.city) + '</td>' +
              (showPortfolio ? '<td class="tabular-nums">' + formatCop(tp.creditLimit) + '</td><td class="tabular-nums" style="font-weight:800; color:' + (tp.balanceDue > 0 ? '#B45309' : '#15803D') + ';">' + formatCop(tp.balanceDue) + '</td><td>' + (tp.balanceDue > 0 ? '<button type="button" class="btn btn-outline" style="padding:3px 8px; font-size:11px;" onclick="window.provekoApplyQuickPayment(' + idx + ')">Registrar Abono</button>' : '<span class="badge badge-emerald">Paz y Salvo</span>') + '</td>' : '') +
              '</tr>'
            ).join('') +
          '</tbody></table></div></div>';
    }

    function renderUsersAndRbacCenter() {
      const tenant = getActiveTenant();
      const tenantUsers = STATE.db.users.filter((u) => u.tenantId === tenant.tenantId);
      document.getElementById('center-kpi-strip').innerHTML =
        '<div class="kpi-card"><span class="kpi-label">Usuarios de la Empresa</span><div class="kpi-value tabular-nums">' + tenantUsers.length + ' Usuarios</div><span class="kpi-sub">Con acceso por Rol RBAC</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Perfiles de Rol</span><div class="kpi-value tabular-nums">' + ROLES_CATALOG.length + ' Roles</div><span class="kpi-sub">Segregación operativa</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Componentes Activos</span><div class="kpi-value tabular-nums">' + tenant.enabledComponents.length + ' Funciones</div><span class="kpi-sub">Conmutables en caliente</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Usuario SuperAdmin Cliente</span><div class="kpi-value mono" style="font-size:14px;">' + escapeHtml(tenant.adminUsername) + '</div><span class="kpi-sub">Credencial principal activa</span></div>';

      const canvas = document.getElementById('center-workspace-canvas');
      canvas.innerHTML =
        '<div class="card"><div class="card-header"><span class="card-title">🔐 Gestión de Usuarios, Roles Operativos y Credenciales de la Empresa</span><button type="button" class="btn btn-primary" onclick="window.provekoCreateTenantUser()">+ Crear Usuario para Empleado</button></div>' +
          '<div class="card-body"><div class="form-grid-4" style="margin-bottom:12px;">' +
            '<div class="form-group"><label class="form-label">Nombre Completo del Empleado</label><input id="usr-name" class="form-control" value="Natalia Pineda" /></div>' +
            '<div class="form-group"><label class="form-label">Usuario / Correo de Ingreso</label><input id="usr-email" class="form-control mono" value="inventario@empresa.co" /></div>' +
            '<div class="form-group"><label class="form-label">Contraseña Asignada</label><input id="usr-pass" class="form-control mono" value="Bodega2026!" /></div>' +
            '<div class="form-group"><label class="form-label">Rol y Permisos en la Plataforma</label><select id="usr-role" class="form-control">' +
              ROLES_CATALOG.map((r) => '<option value="' + r.roleKey + '">' + escapeHtml(r.label) + '</option>').join('') +
            '</select></div>' +
          '</div>' +
          '<table class="data-table"><thead><tr><th>Nombre Completo</th><th>Usuario de Acceso</th><th>Contraseña</th><th>Rol Asignado</th><th>Sucursal</th><th>Estado</th></tr></thead><tbody>' +
            tenantUsers.map((u) => '<tr><td style="font-weight:700;">' + escapeHtml(u.fullName) + '</td><td class="mono">' + escapeHtml(u.username) + '</td><td class="mono">' + escapeHtml(u.password) + '</td><td><span class="badge badge-blue">' + escapeHtml(u.roleKey) + '</span></td><td>' + escapeHtml(u.branch) + '</td><td><span class="badge badge-emerald">Activo</span></td></tr>').join('') +
          '</tbody></table></div></div>';
    }

    window.provekoRegenerateTenantCreds = function(tenantId) {
      const t = STATE.db.tenants.find((item) => item.tenantId === tenantId);
      if (!t) return;
      t.adminPassword = 'Prov#' + Math.floor(1000 + Math.random() * 8999) + '!';
      window.provekoRenderSuperAdmin();
    };

    window.provekoRenderSuperAdmin = function() {
      const totalMrr = STATE.db.tenants.reduce((a, b) => a + b.monthlyCop, 0);
      document.getElementById('superadmin-kpis').innerHTML =
        '<div class="kpi-card"><span class="kpi-label">Empresas Clientes Activas</span><div class="kpi-value tabular-nums">' + STATE.db.tenants.length + ' Empresas</div><span class="kpi-sub">Aislamiento por cuenta</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Facturación Recurrente (MRR)</span><div class="kpi-value tabular-nums" style="color:#15803D;">' + formatCop(totalMrr) + '</div><span class="kpi-sub">Pagos en modo Standby aprobados</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Usuarios Totales Creados</span><div class="kpi-value tabular-nums">' + STATE.db.users.length + ' Usuarios</div><span class="kpi-sub">Con credenciales generadas</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Microservicio de Pagos</span><div class="kpi-value" style="color:#1D4ED8;">Standby Activo</div><span class="kpi-sub">Aprovisionamiento automático</span></div>';

      document.getElementById('superadmin-tenants-container').innerHTML =
        '<div class="card"><div class="card-header"><span class="card-title">🏢 Directorio de Empresas Clientes, Credenciales del SuperAdmin Cliente y Estado de Pagos</span></div>' +
        '<table class="data-table"><thead><tr><th>Empresa Cliente / NIT</th><th>Ciudad</th><th>Plan y Pago</th><th>Usuario SuperAdmin Cliente</th><th>Contraseña Generada</th><th>Centros / Componentes</th><th>Acciones de Control</th></tr></thead><tbody>' +
          STATE.db.tenants.map((t) =>
            '<tr>' +
              '<td><strong>' + escapeHtml(t.companyName) + '</strong><div class="mono" style="font-size:11px; color:var(--text-muted);">' + escapeHtml(t.nit) + ' · ID: ' + escapeHtml(t.tenantId) + '</div></td>' +
              '<td>' + escapeHtml(t.city) + '</td>' +
              '<td><span class="badge badge-amber">' + escapeHtml(t.paymentStatus) + '</span><div class="tabular-nums" style="font-weight:700; margin-top:3px;">' + formatCop(t.monthlyCop) + ' / mes</div></td>' +
              '<td class="mono" style="font-weight:700; color:#1D4ED8;">' + escapeHtml(t.adminUsername) + '</td>' +
              '<td class="mono" style="font-weight:800; color:#15803D;">' + escapeHtml(t.adminPassword) + '</td>' +
              '<td><span class="badge badge-blue">' + t.enabledCenters.length + ' Centros</span> <span class="badge badge-slate">' + t.enabledComponents.length + ' Componentes</span></td>' +
              '<td style="display:flex; gap:6px;">' +
                '<button type="button" class="btn btn-outline" style="padding:4px 8px; font-size:11px;" onclick="window.provekoRegenerateTenantCreds(\\'' + escapeHtml(t.tenantId) + '\\')">🔑 Nueva Clave</button>' +
                '<button type="button" class="btn btn-primary" style="padding:4px 10px; font-size:11px;" onclick="window.provekoEnterAsTenant(\\'' + escapeHtml(t.tenantId) + '\\')">Entrar a Gestionar →</button>' +
              '</td>' +
            '</tr>'
          ).join('') +
        '</tbody></table></div>';
    };
  `;
}
