/**
 * Runtime Cliente (Parte 4): Gestión de Roles/Usuarios Internos en la BD del Cliente (con cuotas),
 * Pestaña "Necesito otra funcionalidad" y Creación de Cliente + BD desde Ventana de Pago Standby.
 */
export function renderPlatformActionsRuntimeJs(): string {
  return `
  function pkRenderInternalRbacPane(client) {
    var el = document.getElementById('ws-pane-internal-rbac');
    if (!el) return;
    var rRows = '';
    for (var i = 0; i < client.internalRoles.length; i++) {
      var rl = client.internalRoles[i];
      rRows += '<tr><td><strong>' + pkEsc(rl.name) + '</strong></td><td>' + pkEsc(rl.description) + '</td>' +
        '<td><span class="badge badge-blue">' + pkEsc(rl.allowedSubmodules.join(', ')) + '</span></td></tr>';
    }
    var uRows = '';
    for (var j = 0; j < client.internalUsers.length; j++) {
      var u = client.internalUsers[j];
      uRows += '<tr><td><strong>' + pkEsc(u.username) + '</strong></td><td>' + pkEsc(u.fullName) + '</td>' +
        '<td><span class="badge badge-emerald">' + pkEsc(u.internalRoleName) + '</span></td>' +
        '<td><code>' + pkEsc(u.passwordHint) + '</code></td></tr>';
    }
    var roleOpts = '';
    for (var k = 0; k < client.internalRoles.length; k++) {
      roleOpts += '<option value="' + pkEsc(client.internalRoles[k].roleId) + '">' + pkEsc(client.internalRoles[k].name) + '</option>';
    }
    el.innerHTML =
      '<div class="card" style="margin-bottom:14px">' +
      '<div class="card-head"><div><div class="card-title">👥 Roles Internos en tu Base de Datos (' + pkEsc(client.dbName) + ')</div>' +
      '<div style="font-size:12px;color:var(--pk-muted)">Se crean los roles básicos por defecto y puedes modificarlos o agregar nuevos dentro del cupo asignado por SuperAdmin.</div></div>' +
      '<span class="badge badge-blue">Cupo de Roles: ' + client.internalRoles.length + ' / ' + client.maxRolesAllowed + '</span></div>' +
      '<div class="card-body">' +
      '<div class="grid-3" style="margin-bottom:12px">' +
      '<div class="field"><label>Nombre del Nuevo Rol Interno</label><input type="text" id="new-role-name" placeholder="Ej: Auditor de Bodega" /></div>' +
      '<div class="field"><label>Descripción de Permisos</label><input type="text" id="new-role-desc" placeholder="Ej: Revisión de traslados y existencias" /></div>' +
      '<div class="field" style="justify-content:flex-end"><button type="button" class="btn btn-primary" id="btn-create-internal-role">+ Crear Rol Interno</button></div>' +
      '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Rol Interno</th><th>Alcance</th><th>Submódulos Permitidos</th></tr></thead><tbody>' + rRows + '</tbody></table></div>' +
      '</div></div>' +
      '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">🔐 Usuarios de tu Empresa (Conectados a ' + pkEsc(client.dbName) + ')</div>' +
      '<div style="font-size:12px;color:var(--pk-muted)">Cuenta Admin generada automáticamente + usuarios operativos asignados a tus roles internos.</div></div>' +
      '<span class="badge badge-emerald">Cupo de Usuarios: ' + client.internalUsers.length + ' / ' + client.maxUsersAllowed + '</span></div>' +
      '<div class="card-body">' +
      '<div class="grid-3" style="margin-bottom:12px">' +
      '<div class="field"><label>Nombre Completo</label><input type="text" id="new-user-fullname" placeholder="Ej: Camilo Vargas" /></div>' +
      '<div class="field"><label>Usuario de Acceso</label><input type="text" id="new-user-username" placeholder="Ej: cajero.camilo" /></div>' +
      '<div class="field"><label>Rol Interno Asignado</label><select id="new-user-role">' + roleOpts + '</select></div>' +
      '</div>' +
      '<div class="row-actions" style="justify-content:flex-end;margin-bottom:12px"><button type="button" class="btn btn-emerald" id="btn-create-internal-user">+ Crear Usuario en mi Empresa</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Rol Interno</th><th>Credencial</th></tr></thead><tbody>' + uRows + '</tbody></table></div>' +
      '</div></div>';
  }

  function pkRenderNeedFeaturePane(client) {
    var el = document.getElementById('ws-pane-need-feature');
    if (!el) return;
    var cards = '';
    var svcs = BOOT.services || [];
    for (var i = 0; i < svcs.length; i++) {
      var s = svcs[i];
      var subHtml = '';
      for (var j = 0; j < s.submodules.length; j++) {
        var sub = s.submodules[j];
        var hasSub = client.activeSubmodules.indexOf(sub.moduleKey) !== -1;
        subHtml += '<div class="comp-toggle-pill">' +
          '<span>' + pkEsc(sub.tabIcon + ' Submódulo: ' + sub.externalSubmoduleName) + '</span>' +
          (hasSub
            ? '<span class="badge badge-emerald">Activo</span>'
            : '<button type="button" class="btn btn-primary btn-sm" data-req-tier="SUBMODULO" data-req-key="' + pkEsc(sub.moduleKey) + '" data-req-label="' + pkEsc(sub.externalSubmoduleName) + '">Solicitar / Activar (+' + pkCop(sub.monthlyAddonUsd) + ')</button>') +
          '</div>';
      }
      for (var f = 0; f < s.features.length; f++) {
        var feat = s.features[f];
        var hasFeat = client.activeFeatures.indexOf(feat.componentKey) !== -1;
        subHtml += '<div class="comp-toggle-pill">' +
          '<span>✨ Funcionalidad: ' + pkEsc(feat.externalName) + '</span>' +
          (hasFeat
            ? '<span class="badge badge-blue">Activa</span>'
            : '<button type="button" class="btn btn-outline btn-sm" data-req-tier="FUNCIONALIDAD" data-req-key="' + pkEsc(feat.componentKey) + '" data-req-label="' + pkEsc(feat.externalName) + '">Solicitar Funcionalidad (+' + pkCop(feat.monthlyAddonUsd) + ')</button>') +
          '</div>';
      }
      cards += '<div class="center-pick-card">' +
        '<div class="center-pick-head"><div class="center-pick-title">' + pkEsc(s.icon + ' ' + s.externalPrincipalModuleName) + '</div></div>' +
        '<div class="center-pick-desc">' + pkEsc(s.subtitle) + '</div>' +
        '<div class="comp-toggle-list">' + subHtml + '</div></div>';
    }
    el.innerHTML =
      '<div class="card">' +
      '<div class="card-head"><div><span class="badge badge-amber">AMPLIACIÓN DE CAPACIDADES EMPRESARIALES</span>' +
      '<h2 style="margin:4px 0 0;font-size:18px">✨ Necesito otra funcionalidad, Submódulo o Módulo Principal</h2>' +
      '<div style="font-size:12px;color:var(--pk-muted)">Las pantallas operativas permanecen limpias. Desde esta pestaña exclusiva puedes solicitar o activar nuevos Submódulos o Funcionalidades (como Firma de encargado o Seleccionar transportista).</div></div></div>' +
      '<div class="card-body"><div class="center-selector-grid">' + cards + '</div></div></div>';
  }

  function pkConfirmStandbyCheckout() {
    var compName = ((document.getElementById('pay-modal-company') || {}).value || '').trim() || 'Empresa Registrada S.A.S.';
    var nitVal = ((document.getElementById('reg-company-nit') || {}).value || '').trim() || '901.880.110-2';
    var slug = compName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 20) || 'cliente';
    var planInfo = pkComputeRegistrationPlan();
    var newClient = {
      tenantId: 'tnt-' + slug + '-' + String(Date.now()).slice(-3),
      companyName: compName, nit: nitVal,
      businessTypeId: STATE.selectedBusinessTypeId,
      businessTypeName: planInfo.preset ? planInfo.preset.name : 'Plan Empresarial',
      dbName: 'db_' + slug, dbHost: 'db', dbPort: 5432,
      paymentStatus: 'STANDBY_VERIFICADO', monthlyUsd: planInfo.totalUsd,
      adminUsername: 'admin.' + slug,
      adminPasswordHint: 'PkAdmin#' + slug.slice(0, 4).toUpperCase() + '2026!',
      maxRolesAllowed: 5, maxUsersAllowed: 10,
      activePrincipalServices: planInfo.services,
      activeSubmodules: planInfo.submodules,
      activeFeatures: planInfo.features,
      internalRoles: [
        { roleId: 'rol-admin', name: 'Administrador General (Cuenta Admin)', description: 'Control total en la BD del cliente.', allowedSubmodules: ['*'] },
        { roleId: 'rol-cajero', name: 'Cajero y Facturador', description: 'Caja POS y Facturación.', allowedSubmodules: ['mod-pos', 'mod-dian'] },
        { roleId: 'rol-bodega', name: 'Encargado de Bodega', description: 'Existencias, Bodegas y Traslados.', allowedSubmodules: ['mod-stock', 'mod-warehouses', 'mod-transfers'] }
      ],
      internalUsers: [
        { userId: 'u-admin', username: 'admin.' + slug, fullName: 'Administrador ' + compName, email: 'admin@' + slug + '.co', internalRoleId: 'rol-admin', internalRoleName: 'Administrador General (Cuenta Admin)', passwordHint: 'PkAdmin#' + slug.slice(0, 4).toUpperCase() + '2026!', isClientAdmin: true }
      ]
    };
    STATE.clients.push(newClient);
    if (STATE.pgDatabases.indexOf(newClient.dbName) === -1) STATE.pgDatabases.push(newClient.dbName);
    STATE.lastGeneratedClient = newClient;
    try {
      fetch('/api/v1/payments/checkout/standby', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(newClient)
      }).then(function() { pkHydrateClientsFromPostgres(); }).catch(function() {});
    } catch (_e) {}
    document.getElementById('generated-credentials-box').innerHTML =
      '<div>Empresa: <strong>' + pkEsc(newClient.companyName) + '</strong></div>' +
      '<div>Base de Datos PostgreSQL Creada: <strong>' + pkEsc(newClient.dbName) + '</strong></div>' +
      '<div>Rol Global: <strong>cliente</strong> · Cuenta Admin: <strong>' + pkEsc(newClient.adminUsername) + '</strong></div>' +
      '<div>Contraseña Inicial: <strong>' + pkEsc(newClient.adminPasswordHint) + '</strong></div>';
    document.getElementById('payment-step-checkout').style.display = 'none';
    document.getElementById('payment-step-credentials').style.display = 'block';
  }

  function pkHydrateClientsFromPostgres() {
    try {
      fetch('/api/v1/control/databases')
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
          if (!data) return;
          if (Array.isArray(data.databases) && data.databases.length > 0) {
            STATE.pgDatabases = data.databases;
          }
          if (Array.isArray(data.rows)) {
            for (var i = 0; i < data.rows.length; i++) {
              var r = data.rows[i];
              if (!r.db_name || r.db_name === 'db_version_prueba') continue;
              var exists = false;
              for (var j = 0; j < STATE.clients.length; j++) {
                if (STATE.clients[j].dbName === r.db_name) { exists = true; break; }
              }
              if (!exists) {
                STATE.clients.push({
                  tenantId: r.tenant_id || ('tnt-' + r.db_name),
                  companyName: r.company_name || r.db_name,
                  nit: r.nit || '900.000.000-1',
                  businessTypeId: r.business_type || 'comercio-retail',
                  businessTypeName: r.business_type || 'Plan Empresarial',
                  dbName: r.db_name,
                  dbHost: r.db_host || 'db',
                  dbPort: Number(r.db_port) || 5432,
                  paymentStatus: 'STANDBY_VERIFICADO',
                  monthlyUsd: 149000,
                  adminUsername: r.admin_username || 'admin',
                  adminPasswordHint: r.admin_password_hint || 'Prov#2026!',
                  maxRolesAllowed: Number(r.max_roles_allowed) || 5,
                  maxUsersAllowed: Number(r.max_users_allowed) || 10,
                  activePrincipalServices: Array.isArray(r.enabled_services_json) ? r.enabled_services_json : ['srv-invoicing', 'srv-inventory'],
                  activeSubmodules: Array.isArray(r.enabled_submodules_json) ? r.enabled_submodules_json : ['mod-pos', 'mod-stock', 'mod-warehouses'],
                  activeFeatures: Array.isArray(r.enabled_features_json) ? r.enabled_features_json : ['comp-cashier-name', 'comp-manager-signature'],
                  internalRoles: (STATE.demoClient ? STATE.demoClient.internalRoles.slice() : []),
                  internalUsers: [{ userId: 'u-adm', username: r.admin_username || 'admin', fullName: 'Administrador ' + (r.company_name || ''), email: 'admin@empresa.co', internalRoleId: 'rol-admin', internalRoleName: 'Administrador General (Cuenta Admin)', passwordHint: r.admin_password_hint || 'Prov#2026!', isClientAdmin: true }]
                });
              }
            }
          }
          if (STATE.session && (STATE.session.role === 'superadmin' || STATE.session.role === 'desarrollador' || STATE.session.role === 'auxiliar')) {
            pkRenderSuperAdmin();
          }
        })
        .catch(function() {});
    } catch (_e) {}
  }
  setTimeout(pkHydrateClientsFromPostgres, 50);
`;
}
