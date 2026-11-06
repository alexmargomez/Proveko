/**
 * Runtime Cliente (Parte 5): Consola Global (`superadmin`, `desarrollador`, `auxiliar`),
 * Control de Cuotas de Roles y Usuarios por Cliente, Login y Navegación Principal (<= 200 líneas).
 */
export function renderSuperAdminAndShellRuntimeJs(): string {
  return `
  function pkRenderSuperAdmin() {
    var kpiEl = document.getElementById('sa-kpi-row');
    if (kpiEl) {
      var pgList = (STATE.pgDatabases && STATE.pgDatabases.length > 0) ? STATE.pgDatabases : ['proveko_control_db', 'proveko_groups_db'];
      kpiEl.innerHTML =
        '<div class="kpi-box"><div class="kpi-label">Bases del Sistema</div><div class="kpi-val" style="font-size:13px">proveko_control_db · proveko_groups_db</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Total Bases Activas</div><div class="kpi-val">' + pgList.length + ' (' + pkEsc(pgList.join(', ')) + ')</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Empresas Clientes</div><div class="kpi-val" style="color:var(--pk-emerald)">' + STATE.clients.length + ' Empresas</div></div>' +
        '<div class="kpi-box"><div class="kpi-label">Solicitudes de Módulos</div><div class="kpi-val" style="font-size:13px;color:var(--pk-primary)">' + STATE.featureRequests.length + ' Solicitudes</div></div>';
    }
    var gridEl = document.getElementById('sa-tenants-grid');
    if (gridEl) {
      var gHtml = '';
      if (STATE.clients.length === 0) {
        gHtml = '<div class="card"><div class="card-body" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
          '<div><strong>Aún no hay empresas registradas.</strong><div style="font-size:12px;color:var(--pk-muted)">Registra la primera empresa cliente para habilitar su cuenta administrativa.</div></div>' +
          '<button type="button" class="btn btn-emerald btn-sm" id="btn-sa-empty-new-client">+ Registrar Primera Empresa</button></div></div>';
      }
      for (var i = 0; i < STATE.clients.length; i++) {
        var t = STATE.clients[i];
        gHtml += '<div class="card"><div class="card-head">' +
          '<div><div style="display:flex;align-items:center;gap:8px"><strong style="font-size:15px">' + pkEsc(t.companyName) + '</strong>' +
          '<span class="badge badge-blue">NIT: ' + pkEsc(t.nit) + '</span><span class="badge badge-emerald">Base: ' + pkEsc(t.dbName) + '</span></div>' +
          '<div style="font-size:12px;color:var(--pk-muted);margin-top:4px">Usuario Admin: <code>' + pkEsc(t.adminUsername) + '</code> · Clave: <code>' + pkEsc(t.adminPasswordHint) + '</code></div></div>' +
          '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-sa-regen="' + pkEsc(t.tenantId) + '">🔑 Nueva Clave</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-sa-open="' + pkEsc(t.tenantId) + '">🏢 Abrir Empresa</button></div></div>' +
          '<div class="card-body"><div class="grid-2">' +
          '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="font-size:11px;color:var(--pk-muted);font-weight:700">CUPO DE ROLES</div><div style="font-size:14px;font-weight:800">Usados: ' + t.internalRoles.length + ' / Máx: ' + t.maxRolesAllowed + '</div></div>' +
          '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-sa-quota-role="-1" data-sa-tenant="' + pkEsc(t.tenantId) + '">-1</button><button type="button" class="btn btn-outline btn-sm" data-sa-quota-role="1" data-sa-tenant="' + pkEsc(t.tenantId) + '">+1</button></div></div>' +
          '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:10px;padding:10px;display:flex;justify-content:space-between;align-items:center">' +
          '<div><div style="font-size:11px;color:var(--pk-muted);font-weight:700">CUPO DE USUARIOS</div><div style="font-size:14px;font-weight:800">Usados: ' + t.internalUsers.length + ' / Máx: ' + t.maxUsersAllowed + '</div></div>' +
          '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-sa-quota-user="-1" data-sa-tenant="' + pkEsc(t.tenantId) + '">-1</button><button type="button" class="btn btn-outline btn-sm" data-sa-quota-user="1" data-sa-tenant="' + pkEsc(t.tenantId) + '">+1</button></div></div>' +
          '</div></div></div>';
      }
      gridEl.innerHTML = gHtml;
    }
    var reqCount = document.getElementById('sa-requests-count'); if (reqCount) reqCount.textContent = STATE.featureRequests.length + ' solicitudes';
    var reqBody = document.getElementById('sa-feature-requests-body');
    if (reqBody) {
      if (STATE.featureRequests.length === 0) reqBody.innerHTML = '<div style="font-size:12px;color:var(--pk-muted)">No hay solicitudes pendientes.</div>';
      else {
        var rHtml = '<table><thead><tr><th>Empresa</th><th>Tipo</th><th>Solicitud</th><th>Estado</th></tr></thead><tbody>';
        for (var r = 0; r < STATE.featureRequests.length; r++) rHtml += '<tr><td><strong>' + pkEsc(STATE.featureRequests[r].companyName) + '</strong></td><td>' + pkEsc(STATE.featureRequests[r].tier) + '</td><td>' + pkEsc(STATE.featureRequests[r].label) + '</td><td><span class="badge badge-emerald">Activada</span></td></tr>';
        reqBody.innerHTML = rHtml + '</tbody></table>';
      }
    }
    if (typeof pkRenderGroupsCatalogAdmin === 'function') pkRenderGroupsCatalogAdmin();
  }

  function pkUpdateShellNavigation() {
    var pubNav = document.getElementById('public-nav-tabs');
    var sessBar = document.getElementById('authenticated-session-bar');
    var topCtx = document.getElementById('top-context-label');
    var sShow = document.getElementById('surface-showcase'); var sAuth = document.getElementById('surface-auth'); var sSa = document.getElementById('surface-superadmin'); var sWs = document.getElementById('surface-workstation');
    if (sShow) sShow.classList.remove('active'); if (sAuth) sAuth.classList.remove('active'); if (sSa) sSa.classList.remove('active'); if (sWs) sWs.classList.remove('active');

    if (STATE.session) {
      if (pubNav) pubNav.style.display = 'none'; if (sessBar) sessBar.style.display = 'flex';
      var rBadge = document.getElementById('session-role-badge'); var dBadge = document.getElementById('session-db-badge'); var uLabel = document.getElementById('session-user-label');
      if (STATE.session.role === 'superadmin' || STATE.session.role === 'desarrollador' || STATE.session.role === 'auxiliar') {
        if (rBadge) rBadge.textContent = 'Perfil: ' + STATE.session.role.toUpperCase(); if (dBadge) dBadge.textContent = 'Administración Central'; if (uLabel) uLabel.textContent = STATE.session.username; if (topCtx) topCtx.textContent = '| Administración Central';
        if (sSa) sSa.classList.add('active'); pkRenderSuperAdmin();
      } else {
        var cl = pkGetActiveClient();
        if (rBadge) rBadge.textContent = STATE.session.internalRoleName || 'Administrador'; if (dBadge) dBadge.textContent = cl ? cl.companyName : 'Mi Empresa'; if (uLabel) uLabel.textContent = STATE.session.username; if (topCtx) topCtx.textContent = '| ' + (cl ? cl.companyName : 'Mi Empresa');
        if (sWs) sWs.classList.add('active'); if (cl && cl.dbName) pkHydrateClientRelationalWorkspace(cl.dbName); pkRenderWorkstation();
      }
      return;
    }

    if (pubNav) pubNav.style.display = 'flex'; if (sessBar) sessBar.style.display = 'none';
    var tShow = document.getElementById('tab-nav-showcase'); var tAuth = document.getElementById('tab-nav-auth'); var tDemo = document.getElementById('tab-nav-demo');
    if (tShow) tShow.className = 'pk-tab-btn ' + (STATE.publicTab === 'showcase' ? 'active' : '');
    if (tAuth) tAuth.className = 'pk-tab-btn ' + (STATE.publicTab === 'auth' ? 'active' : '');
    if (tDemo) tDemo.className = 'pk-tab-btn ' + (STATE.publicTab === 'demo' ? 'active' : '');

    if (STATE.publicTab === 'showcase') { if (topCtx) topCtx.textContent = '| Soluciones para tu Empresa'; if (sShow) sShow.classList.add('active'); pkRenderShowcase(); }
    else if (STATE.publicTab === 'auth') {
      if (topCtx) topCtx.textContent = STATE.authMode === 'register' ? '| Registra tu Negocio' : '| Iniciar Sesión'; if (sAuth) sAuth.classList.add('active');
      var pLogin = document.getElementById('auth-pane-login'); var pReg = document.getElementById('auth-pane-register'); var bLogin = document.getElementById('btn-auth-mode-login'); var bReg = document.getElementById('btn-auth-mode-register');
      if (pLogin) pLogin.style.display = STATE.authMode === 'login' ? 'block' : 'none'; if (pReg) pReg.style.display = STATE.authMode === 'register' ? 'block' : 'none';
      if (bLogin) bLogin.className = 'btn ' + (STATE.authMode === 'login' ? 'btn-primary' : 'btn-outline'); if (bReg) bReg.className = 'btn ' + (STATE.authMode === 'register' ? 'btn-primary' : 'btn-outline');
      pkRenderRegistrationWizard();
    } else if (STATE.publicTab === 'demo') { STATE.activeTenantId = 'tnt-demo'; if (topCtx) topCtx.textContent = '| Plataforma en Vivo'; if (sWs) sWs.classList.add('active'); pkRenderWorkstation(); }
  }

  function pkHandleSuperAdminAction(target) {
    if (target.closest('#btn-create-internal-role')) {
      var clR = pkGetActiveClient(); if (clR.internalRoles.length >= clR.maxRolesAllowed) { pkToast('Cupo máximo de roles alcanzado.'); return true; }
      var rName = ((document.getElementById('new-role-name') || {}).value || '').trim(); if (!rName) { pkToast('Ingresa el nombre del rol.'); return true; }
      clR.internalRoles.push({ roleId: 'rol-' + Date.now(), name: rName, description: ((document.getElementById('new-role-desc') || {}).value || 'Rol operativo').trim(), allowedSubmodules: clR.activeSubmodules.slice(0, 4) });
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage(); pkRenderWorkstation(); pkToast('Rol creado: ' + rName); return true;
    }
    if (target.closest('#btn-create-internal-user')) {
      var clU = pkGetActiveClient(); if (clU.internalUsers.length >= clU.maxUsersAllowed) { pkToast('Cupo máximo de usuarios alcanzado.'); return true; }
      var uFull = ((document.getElementById('new-user-fullname') || {}).value || '').trim(); var uName = ((document.getElementById('new-user-username') || {}).value || '').trim();
      if (!uFull || !uName) { pkToast('Completa nombre y usuario.'); return true; }
      clU.internalUsers.push({ userId: 'u-' + Date.now(), username: uName, fullName: uFull, email: uName + '@empresa.co', internalRoleId: 'rol-operador', internalRoleName: 'Usuario Operativo', passwordHint: 'Usr#2026!', isClientAdmin: false });
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage(); pkRenderWorkstation(); pkToast('Usuario creado: ' + uName); return true;
    }
    var reqBtn = target.closest('[data-req-key]');
    if (reqBtn) {
      var clF = pkGetActiveClient(); var rTier = reqBtn.getAttribute('data-req-tier'); var rKey = reqBtn.getAttribute('data-req-key'); var rLbl = reqBtn.getAttribute('data-req-label');
      if (rTier === 'SUBMODULO' && clF.activeSubmodules.indexOf(rKey) === -1) clF.activeSubmodules.push(rKey);
      if (rTier === 'FUNCIONALIDAD' && clF.activeFeatures.indexOf(rKey) === -1) clF.activeFeatures.push(rKey);
      STATE.featureRequests.push({ companyName: clF.companyName, tier: rTier, key: rKey, label: rLbl });
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage(); pkRenderWorkstation(); pkToast('Módulo activado: ' + rLbl); return true;
    }
    if (typeof pkHandleDeveloperCatalogAction === 'function' && pkHandleDeveloperCatalogAction(target)) return true;
    var qRoleBtn = target.closest('[data-sa-quota-role]');
    if (qRoleBtn) {
      var tidR = qRoleBtn.getAttribute('data-sa-tenant'); var deltaR = Number(qRoleBtn.getAttribute('data-sa-quota-role'));
      for (var qr = 0; qr < STATE.clients.length; qr++) if (STATE.clients[qr].tenantId === tidR) STATE.clients[qr].maxRolesAllowed = Math.max(1, STATE.clients[qr].maxRolesAllowed + deltaR);
      pkRenderSuperAdmin(); return true;
    }
    var qUserBtn = target.closest('[data-sa-quota-user]');
    if (qUserBtn) {
      var tidU = qUserBtn.getAttribute('data-sa-tenant'); var deltaU = Number(qUserBtn.getAttribute('data-sa-quota-user'));
      for (var qu = 0; qu < STATE.clients.length; qu++) if (STATE.clients[qu].tenantId === tidU) STATE.clients[qu].maxUsersAllowed = Math.max(1, STATE.clients[qu].maxUsersAllowed + deltaU);
      pkRenderSuperAdmin(); return true;
    }
    var saOpen = target.closest('[data-sa-open]');
    if (saOpen) { STATE.activeTenantId = saOpen.getAttribute('data-sa-open'); STATE.session = { role: 'cliente', username: 'admin', tenantId: STATE.activeTenantId, internalRoleName: 'Administrador General' }; pkUpdateShellNavigation(); return true; }
    var saRegen = target.closest('[data-sa-regen]');
    if (saRegen) { var tidG = saRegen.getAttribute('data-sa-regen'); for (var g = 0; g < STATE.clients.length; g++) if (STATE.clients[g].tenantId === tidG) STATE.clients[g].adminPasswordHint = 'PkReset#' + String(Date.now()).slice(-4) + '!'; pkRenderSuperAdmin(); pkToast('Nueva clave generada.'); return true; }
    return false;
  }
`;
}
