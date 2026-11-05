/**
 * Runtime Cliente (Parte 3): Renderizador de Interpestañas de Submódulos,
 * Panel de Roles/Usuarios Internos del Cliente (con cuotas) y Pestaña "Necesito otra funcionalidad".
 */
export function renderGatewayTransportRuntimeJs(): string {
  return `
  function pkRenderWorkstation() {
    var client = pkGetActiveClient();
    if (!client) return;

    var demoBanner = document.getElementById('demo-mode-banner');
    if (demoBanner) {
      demoBanner.style.display = (STATE.publicTab === 'demo' && !STATE.session) ? 'flex' : 'none';
    }

    var quotaSub = document.getElementById('ws-rbac-quota-sub');
    if (quotaSub) {
      quotaSub.textContent = 'Roles: ' + client.internalRoles.length + '/' + client.maxRolesAllowed +
        ' · Usuarios: ' + client.internalUsers.length + '/' + client.maxUsersAllowed;
    }

    var navEl = document.getElementById('ws-principal-modules-nav');
    var svcs = BOOT.services || [];
    var activeSvc = null;
    if (navEl) {
      var nHtml = '';
      for (var i = 0; i < svcs.length; i++) {
        var s = svcs[i];
        if (client.activePrincipalServices.indexOf(s.serviceKey) === -1) continue;
        if (!activeSvc || s.serviceKey === STATE.activeServiceKey) activeSvc = s;
        var isCurrent = (STATE.activeWorkstationPane === 'module' && s.serviceKey === STATE.activeServiceKey);
        nHtml += '<button type="button" class="ws-nav-btn ' + (isCurrent ? 'active' : '') + '" data-ws-service="' + pkEsc(s.serviceKey) + '">' +
          '<div class="ws-nav-title">' + pkEsc(s.icon + ' ' + s.externalPrincipalModuleName) + '</div>' +
          '<div class="ws-nav-sub">' + s.submodules.length + ' Submódulos integrados</div></button>';
      }
      navEl.innerHTML = nHtml;
    }

    var rbacBtn = document.getElementById('btn-nav-internal-rbac');
    var featBtn = document.getElementById('btn-nav-need-feature');
    if (rbacBtn) rbacBtn.className = 'ws-nav-btn ' + (STATE.activeWorkstationPane === 'rbac' ? 'active' : '');
    if (featBtn) featBtn.className = 'ws-nav-btn ' + (STATE.activeWorkstationPane === 'need-feature' ? 'active' : '');

    var paneMod = document.getElementById('ws-pane-module-operation');
    var paneRbac = document.getElementById('ws-pane-internal-rbac');
    var paneFeat = document.getElementById('ws-pane-need-feature');
    if (paneMod) paneMod.style.display = STATE.activeWorkstationPane === 'module' ? 'block' : 'none';
    if (paneRbac) paneRbac.style.display = STATE.activeWorkstationPane === 'rbac' ? 'block' : 'none';
    if (paneFeat) paneFeat.style.display = STATE.activeWorkstationPane === 'need-feature' ? 'block' : 'none';

    if (STATE.activeWorkstationPane === 'rbac') {
      pkRenderInternalRbacPane(client);
      return;
    }
    if (STATE.activeWorkstationPane === 'need-feature') {
      pkRenderNeedFeaturePane(client);
      return;
    }
    if (!activeSvc) return;
    STATE.activeServiceKey = activeSvc.serviceKey;

    var iconEl = document.getElementById('ws-active-service-icon');
    var titleEl = document.getElementById('ws-active-service-title');
    var subEl = document.getElementById('ws-active-service-sub');
    var dbEl = document.getElementById('ws-active-db-badge');
    if (iconEl) iconEl.textContent = activeSvc.icon;
    if (titleEl) titleEl.textContent = activeSvc.externalPrincipalModuleName;
    if (subEl) subEl.textContent = activeSvc.subtitle;
    if (dbEl) {
      dbEl.textContent = pkIsDemoMode()
        ? 'Almacenamiento Demo: localStorage (Navegador)'
        : 'BD PostgreSQL Aislada: ' + client.dbName;
    }

    var pillsEl = document.getElementById('ws-active-features-pills');
    if (pillsEl) {
      var pHtml = '';
      for (var fIdx = 0; fIdx < activeSvc.features.length; fIdx++) {
        var feat = activeSvc.features[fIdx];
        if (client.activeFeatures.indexOf(feat.componentKey) !== -1) {
          pHtml += '<span class="badge badge-blue">✓ Funcionalidad: ' + pkEsc(feat.externalName) + '</span>';
        }
      }
      pillsEl.innerHTML = pHtml;
    }

    var tabsEl = document.getElementById('ws-submodule-tabs');
    var activeSub = null;
    var availableSubs = [];
    for (var j = 0; j < activeSvc.submodules.length; j++) {
      var sm = activeSvc.submodules[j];
      if (client.activeSubmodules.indexOf(sm.moduleKey) !== -1) {
        availableSubs.push(sm);
        if (sm.moduleKey === STATE.activeSubmoduleKey) activeSub = sm;
      }
    }
    if (!activeSub && availableSubs.length > 0) {
      activeSub = availableSubs[0];
      STATE.activeSubmoduleKey = activeSub.moduleKey;
    }

    if (tabsEl) {
      var tHtml = '';
      for (var k = 0; k < availableSubs.length; k++) {
        var subTab = availableSubs[k];
        var isTabAct = activeSub && subTab.moduleKey === activeSub.moduleKey;
        tHtml += '<button type="button" class="btn ' + (isTabAct ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-ws-submodule="' + pkEsc(subTab.moduleKey) + '">' +
          pkEsc(subTab.tabIcon + ' ' + subTab.externalSubmoduleName) + '</button>';
      }
      tabsEl.innerHTML = tHtml;
    }

    if (!activeSub) return;
    var sumEl = document.getElementById('ws-submodule-summary');
    if (sumEl) sumEl.textContent = activeSub.summary;

    pkRenderSpecializedWidget(activeSub, client);

    var fieldsEl = document.getElementById('ws-submodule-form-fields');
    if (fieldsEl) {
      var fHtml = '';
      for (var m = 0; m < activeSub.fields.length; m++) {
        var fld = activeSub.fields[m];
        if (fld.requiredFeatureKey && client.activeFeatures.indexOf(fld.requiredFeatureKey) === -1) continue;
        fHtml += '<div class="field"><label>' + pkEsc(fld.label) + '</label>';
        if (fld.type === 'select') {
          fHtml += '<select data-ws-field="' + pkEsc(fld.key) + '">';
          var opts = fld.options || [];
          for (var o = 0; o < opts.length; o++) {
            fHtml += '<option value="' + pkEsc(opts[o]) + '">' + pkEsc(opts[o]) + '</option>';
          }
          fHtml += '</select>';
        } else {
          fHtml += '<input type="' + pkEsc(fld.type) + '" data-ws-field="' + pkEsc(fld.key) + '" placeholder="' + pkEsc(fld.placeholder || '') + '" />';
        }
        fHtml += '</div>';
      }
      fieldsEl.innerHTML = fHtml;
    }

    var saveBtn = document.getElementById('btn-ws-save-record');
    if (saveBtn) saveBtn.textContent = activeSub.actionButtonLabel;

    var thead = document.getElementById('ws-submodule-thead');
    if (thead) {
      var hHtml = '<tr>';
      for (var h = 0; h < activeSub.tableHeaders.length; h++) {
        hHtml += '<th>' + pkEsc(activeSub.tableHeaders[h]) + '</th>';
      }
      hHtml += '</tr>';
      thead.innerHTML = hHtml;
    }

    var tbody = document.getElementById('ws-submodule-tbody');
    if (tbody) {
      var rows = STATE.submoduleRows[activeSub.moduleKey] || [];
      var qFilter = (STATE.v2FilterText || '').trim().toLowerCase();
      var rHtml = '';
      var matchedCount = 0;
      for (var r = 0; r < rows.length; r++) {
        var rowStr = rows[r].join(' ').toLowerCase();
        if (qFilter && rowStr.indexOf(qFilter) === -1) continue;
        matchedCount++;
        rHtml += '<tr>';
        for (var c = 0; c < rows[r].length; c++) {
          rHtml += '<td>' + (c === 0 ? '<strong>' + pkEsc(rows[r][c]) + '</strong>' : pkEsc(rows[r][c])) + '</td>';
        }
        rHtml += '</tr>';
      }
      tbody.innerHTML = rHtml;
      var cntBadge = document.getElementById('ws-v2-count-badge');
      if (cntBadge) cntBadge.textContent = matchedCount + ' / ' + rows.length + ' registros';
    }
  }
`;
}
