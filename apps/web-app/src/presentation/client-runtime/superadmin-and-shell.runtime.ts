/**
 * Runtime Cliente (Parte 5): Consola Global (`superadmin`, `desarrollador`, `auxiliar`),
 * Control de Cuotas de Roles y Usuarios por Cliente, Login de los 4 Roles y Pago Standby.
 */
export function renderSuperAdminAndShellRuntimeJs(): string {
  return `
  function pkRenderSuperAdmin() {
    var kpiEl = document.getElementById('sa-kpi-row');
    if (kpiEl) {
      var realClientsCount = 0;
      for (var c = 0; c < STATE.clients.length; c++) {
        if (STATE.clients[c].tenantId !== 'tnt-demo') realClientsCount++;
      }
      kpiEl.innerHTML =
        '<div class="kpi-box"><div class="kpi-label">Base Principal Control Plane</div><div class="kpi-val" style="font-size:16px">proveko_control_db</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Bases de Datos de Clientes + Demo</div><div class="kpi-val">' + STATE.clients.length + ' BDs PostgreSQL</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Empresas Clientes Registradas</div><div class="kpi-val" style="color:var(--pk-emerald)">' + realClientsCount + '</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Roles Globales Oficiales</div><div class="kpi-val" style="font-size:14px">superadmin · desarrollador · auxiliar · cliente</div></div>';
    }

    var gridEl = document.getElementById('sa-tenants-grid');
    if (gridEl) {
      var gHtml = '';
      for (var i = 0; i < STATE.clients.length; i++) {
        var t = STATE.clients[i];
        gHtml += '<div class="card"><div class="card-head">' +
          '<div><div style="display:flex;align-items:center;gap:8px">' +
          '<strong style="font-size:15px">' + pkEsc(t.companyName) + '</strong>' +
          '<span class="badge badge-blue">NIT: ' + pkEsc(t.nit) + '</span>' +
          '<span class="badge badge-emerald">BD PostgreSQL: ' + pkEsc(t.dbName) + ' (' + pkEsc(t.dbHost + ':' + t.dbPort) + ')</span></div>' +
          '<div style="font-size:12px;color:var(--pk-muted);margin-top:4px">Cuenta Admin generada: <code>' + pkEsc(t.adminUsername) + '</code> · Clave: <code>' + pkEsc(t.adminPasswordHint) + '</code></div></div>' +
          '<div class="row-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" data-sa-regen="' + pkEsc(t.tenantId) + '">🔑 Regenerar Clave Admin</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-sa-open="' + pkEsc(t.tenantId) + '">🏢 Abrir Plataforma</button></div></div>' +
          '<div class="card-body"><div class="grid-2">' +
          '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="font-size:11px;color:var(--pk-muted);font-weight:700">CUOTA MÁXIMA DE ROLES INTERNOS</div>' +
          '<div style="font-size:14px;font-weight:800">Usados: ' + t.internalRoles.length + ' / Máximo permitido: ' + t.maxRolesAllowed + '</div></div>' +
          '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-sa-quota-role="-1" data-sa-tenant="' + pkEsc(t.tenantId) + '">-1</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-sa-quota-role="1" data-sa-tenant="' + pkEsc(t.tenantId) + '">+1</button></div></div>' +
          '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="font-size:11px;color:var(--pk-muted);font-weight:700">CUOTA MÁXIMA DE USUARIOS DEL CLIENTE</div>' +
          '<div style="font-size:14px;font-weight:800">Usados: ' + t.internalUsers.length + ' / Máximo permitido: ' + t.maxUsersAllowed + '</div></div>' +
          '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-sa-quota-user="-1" data-sa-tenant="' + pkEsc(t.tenantId) + '">-1</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-sa-quota-user="1" data-sa-tenant="' + pkEsc(t.tenantId) + '">+1</button></div></div>' +
          '</div></div></div>';
      }
      gridEl.innerHTML = gHtml;
    }

    var reqCount = document.getElementById('sa-requests-count');
    if (reqCount) reqCount.textContent = STATE.featureRequests.length + ' solicitudes';
    var reqBody = document.getElementById('sa-feature-requests-body');
    if (reqBody) {
      if (STATE.featureRequests.length === 0) {
        reqBody.innerHTML = '<div style="font-size:12px;color:var(--pk-muted)">No hay solicitudes pendientes en la pestaña "Necesito otra funcionalidad".</div>';
      } else {
        var rHtml = '<table><thead><tr><th>Empresa</th><th>Tipo</th><th>Solicitud</th><th>Estado</th></tr></thead><tbody>';
        for (var r = 0; r < STATE.featureRequests.length; r++) {
          var rq = STATE.featureRequests[r];
          rHtml += '<tr><td><strong>' + pkEsc(rq.companyName) + '</strong></td><td>' + pkEsc(rq.tier) + '</td><td>' + pkEsc(rq.label) + '</td><td><span class="badge badge-emerald">Activada</span></td></tr>';
        }
        reqBody.innerHTML = rHtml + '</tbody></table>';
      }
    }
  }

  function pkUpdateShellNavigation() {
    var pubNav = document.getElementById('public-nav-tabs');
    var sessBar = document.getElementById('authenticated-session-bar');
    var topCtx = document.getElementById('top-context-label');

    var sShow = document.getElementById('surface-showcase');
    var sAuth = document.getElementById('surface-auth');
    var sSa = document.getElementById('surface-superadmin');
    var sWs = document.getElementById('surface-workstation');
    if (sShow) sShow.classList.remove('active');
    if (sAuth) sAuth.classList.remove('active');
    if (sSa) sSa.classList.remove('active');
    if (sWs) sWs.classList.remove('active');

    if (STATE.session) {
      if (pubNav) pubNav.style.display = 'none';
      if (sessBar) sessBar.style.display = 'flex';
      var rBadge = document.getElementById('session-role-badge');
      var dBadge = document.getElementById('session-db-badge');
      var uLabel = document.getElementById('session-user-label');
      if (STATE.session.role === 'superadmin' || STATE.session.role === 'desarrollador' || STATE.session.role === 'auxiliar') {
        if (rBadge) rBadge.textContent = 'Rol Global: ' + STATE.session.role.toUpperCase();
        if (dBadge) dBadge.textContent = 'BD Principal: proveko_control_db';
        if (uLabel) uLabel.textContent = STATE.session.username;
        if (topCtx) topCtx.textContent = '| Consola Global (' + STATE.session.role + ')';
        if (sSa) sSa.classList.add('active');
        pkRenderSuperAdmin();
      } else {
        var cl = pkGetActiveClient();
        if (rBadge) rBadge.textContent = 'Rol: cliente (' + (STATE.session.internalRoleName || 'Admin') + ')';
        if (dBadge) dBadge.textContent = 'BD Propia: ' + (cl ? cl.dbName : '');
        if (uLabel) uLabel.textContent = (cl ? cl.companyName : '') + ' — ' + STATE.session.username;
        if (topCtx) topCtx.textContent = '| ' + (cl ? cl.companyName : 'Plataforma Cliente');
        if (sWs) sWs.classList.add('active');
        pkRenderWorkstation();
      }
      return;
    }

    if (pubNav) pubNav.style.display = 'flex';
    if (sessBar) sessBar.style.display = 'none';
    var tShow = document.getElementById('tab-nav-showcase');
    var tAuth = document.getElementById('tab-nav-auth');
    var tDemo = document.getElementById('tab-nav-demo');
    if (tShow) tShow.className = 'pk-tab-btn ' + (STATE.publicTab === 'showcase' ? 'active' : '');
    if (tAuth) tAuth.className = 'pk-tab-btn ' + (STATE.publicTab === 'auth' ? 'active' : '');
    if (tDemo) tDemo.className = 'pk-tab-btn ' + (STATE.publicTab === 'demo' ? 'active' : '');

    if (STATE.publicTab === 'showcase') {
      if (topCtx) topCtx.textContent = '| Muestra de la Plataforma';
      if (sShow) sShow.classList.add('active');
      pkRenderShowcase();
    } else if (STATE.publicTab === 'auth') {
      if (topCtx) topCtx.textContent = STATE.authMode === 'register' ? '| Registra tu Negocio' : '| Iniciar Sesión';
      if (sAuth) sAuth.classList.add('active');
      var pLogin = document.getElementById('auth-pane-login');
      var pReg = document.getElementById('auth-pane-register');
      var bLogin = document.getElementById('btn-auth-mode-login');
      var bReg = document.getElementById('btn-auth-mode-register');
      if (pLogin) pLogin.style.display = STATE.authMode === 'login' ? 'block' : 'none';
      if (pReg) pReg.style.display = STATE.authMode === 'register' ? 'block' : 'none';
      if (bLogin) bLogin.className = 'btn ' + (STATE.authMode === 'login' ? 'btn-primary' : 'btn-outline');
      if (bReg) bReg.className = 'btn ' + (STATE.authMode === 'register' ? 'btn-primary' : 'btn-outline');
      pkRenderRegistrationWizard();
    } else if (STATE.publicTab === 'demo') {
      STATE.activeTenantId = 'tnt-demo';
      if (topCtx) topCtx.textContent = '| Demo Interactiva (db_version_prueba)';
      if (sWs) sWs.classList.add('active');
      pkRenderWorkstation();
    }
  }

  function pkHandleSuperAdminAction(target) {
    var qRoleBtn = target.closest('[data-sa-quota-role]');
    if (qRoleBtn) {
      var tidR = qRoleBtn.getAttribute('data-sa-tenant');
      var deltaR = Number(qRoleBtn.getAttribute('data-sa-quota-role'));
      for (var qr = 0; qr < STATE.clients.length; qr++) {
        if (STATE.clients[qr].tenantId === tidR) STATE.clients[qr].maxRolesAllowed = Math.max(1, STATE.clients[qr].maxRolesAllowed + deltaR);
      }
      pkRenderSuperAdmin(); return true;
    }
    var qUserBtn = target.closest('[data-sa-quota-user]');
    if (qUserBtn) {
      var tidU = qUserBtn.getAttribute('data-sa-tenant');
      var deltaU = Number(qUserBtn.getAttribute('data-sa-quota-user'));
      for (var qu = 0; qu < STATE.clients.length; qu++) {
        if (STATE.clients[qu].tenantId === tidU) STATE.clients[qu].maxUsersAllowed = Math.max(1, STATE.clients[qu].maxUsersAllowed + deltaU);
      }
      pkRenderSuperAdmin(); return true;
    }
    var saOpen = target.closest('[data-sa-open]');
    if (saOpen) {
      STATE.activeTenantId = saOpen.getAttribute('data-sa-open');
      STATE.session = { role: 'cliente', username: 'superadmin->cliente', tenantId: STATE.activeTenantId, internalRoleName: 'SuperAdmin Auditando BD' };
      pkUpdateShellNavigation(); return true;
    }
    var saRegen = target.closest('[data-sa-regen]');
    if (saRegen) {
      var tidG = saRegen.getAttribute('data-sa-regen');
      for (var g = 0; g < STATE.clients.length; g++) {
        if (STATE.clients[g].tenantId === tidG) STATE.clients[g].adminPasswordHint = 'PkReset#' + String(Date.now()).slice(-4) + '!';
      }
      pkRenderSuperAdmin(); pkToast('Credencial Admin regenerada.'); return true;
    }
    return false;
  }
`;
}
