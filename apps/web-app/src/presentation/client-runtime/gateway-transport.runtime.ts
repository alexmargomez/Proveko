/**
 * Runtime Cliente (Parte 3): Navegación Lateral de Iconos + Títulos, Barra Superior de Secciones,
 * Selector de Vista por Rol y Despachador Unificado de Plantillas en `#ws-module-stage` (<= 200 líneas).
 */
export function renderGatewayTransportRuntimeJs(): string {
  return `
  function pkGetRoleAllowedServices(roleView) {
    if (roleView === 'CAJERO') return ['srv-invoicing', 'srv-treasury', 'srv-crm', 'srv-reports'];
    if (roleView === 'MESERO' || roleView === 'COCINA') return ['srv-gastro', 'srv-invoicing'];
    if (roleView === 'BODEGA') return ['srv-inventory', 'srv-procurement', 'srv-fleet'];
    if (roleView === 'TECNICO') return ['srv-workshop', 'srv-inventory', 'srv-appointments'];
    if (roleView === 'RECEPCION') return ['srv-hospitality', 'srv-appointments', 'srv-ticketing', 'srv-crm'];
    return null;
  }

  function pkRenderWorkstation() {
    var client = pkGetActiveClient();
    if (!client) return;

    var demoBanner = document.getElementById('demo-mode-banner');
    if (demoBanner) {
      demoBanner.style.display = (STATE.publicTab === 'demo' && !STATE.session) ? 'flex' : 'none';
    }

    var roleSel = document.getElementById('ws-role-view-selector');
    if (roleSel && roleSel.value !== (STATE.roleViewFilter || 'ALL')) {
      roleSel.value = STATE.roleViewFilter || 'ALL';
    }

    var navEl = document.getElementById('ws-principal-modules-nav');
    var svcs = BOOT.services || [];
    var roleFilterList = pkGetRoleAllowedServices(STATE.roleViewFilter || 'ALL');
    var activeSvc = null;
    if (navEl) {
      var nHtml = '';
      for (var i = 0; i < svcs.length; i++) {
        var s = svcs[i];
        if (client.activePrincipalServices && client.activePrincipalServices.length > 0 && client.activePrincipalServices.indexOf(s.serviceKey) === -1) continue;
        if (roleFilterList && roleFilterList.indexOf(s.serviceKey) === -1) continue;
        if (!activeSvc || s.serviceKey === STATE.activeServiceKey) activeSvc = s;
      }
      if (!activeSvc && svcs.length > 0) activeSvc = svcs[0];
      for (var n = 0; n < svcs.length; n++) {
        var sv = svcs[n];
        if (client.activePrincipalServices && client.activePrincipalServices.length > 0 && client.activePrincipalServices.indexOf(sv.serviceKey) === -1) continue;
        if (roleFilterList && roleFilterList.indexOf(sv.serviceKey) === -1) continue;
        var isCurrent = (STATE.activeWorkstationPane === 'module' && activeSvc && sv.serviceKey === activeSvc.serviceKey);
        nHtml += '<button type="button" class="ws-nav-btn ' + (isCurrent ? 'active' : '') + '" data-ws-service="' + pkEsc(sv.serviceKey) + '">' +
          '<span class="ws-nav-icon">' + pkEsc(sv.icon) + '</span>' +
          '<span class="ws-nav-title">' + pkEsc(sv.externalPrincipalModuleName) + '</span></button>';
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

    if (STATE.activeWorkstationPane === 'rbac') { pkRenderInternalRbacPane(client); return; }
    if (STATE.activeWorkstationPane === 'need-feature') { pkRenderNeedFeaturePane(client); return; }
    if (!activeSvc) return;
    STATE.activeServiceKey = activeSvc.serviceKey;

    var iconEl = document.getElementById('ws-active-service-icon');
    var titleEl = document.getElementById('ws-active-service-title');
    if (iconEl) iconEl.textContent = activeSvc.icon;
    if (titleEl) titleEl.textContent = activeSvc.externalPrincipalModuleName;

    var availableSubs = [];
    var activeSub = null;
    for (var j = 0; j < activeSvc.submodules.length; j++) {
      var sm = activeSvc.submodules[j];
      if (!client.activeSubmodules || client.activeSubmodules.length === 0 || client.activeSubmodules.indexOf(sm.moduleKey) !== -1) {
        availableSubs.push(sm);
        if (sm.moduleKey === STATE.activeSubmoduleKey) activeSub = sm;
      }
    }
    if (availableSubs.length === 0) availableSubs = activeSvc.submodules.slice();
    if (!activeSub && availableSubs.length > 0) {
      activeSub = availableSubs[0];
      STATE.activeSubmoduleKey = activeSub.moduleKey;
    }

    var tabsEl = document.getElementById('ws-submodule-tabs');
    if (tabsEl) {
      var tHtml = '';
      for (var k = 0; k < availableSubs.length; k++) {
        var subTab = availableSubs[k];
        var isTabAct = activeSub && subTab.moduleKey === activeSub.moduleKey;
        tHtml += '<button type="button" class="ws-subtab-pill ' + (isTabAct ? 'active' : '') + '" data-ws-submodule="' + pkEsc(subTab.moduleKey) + '">' +
          pkEsc(subTab.tabIcon + ' ' + subTab.externalSubmoduleName) + '</button>';
      }
      tabsEl.innerHTML = tHtml;
    }

    if (!activeSub) return;
    var mKey = activeSub.moduleKey;
    if (mKey === 'mod-pos') { pkRenderPosHub(); return; }
    if (mKey === 'mod-stock') { pkRenderInventoryHub(); return; }
    if (mKey === 'mod-tables' || mKey === 'mod-kds') { pkRenderGastroHub(mKey); return; }
    if (mKey === 'mod-work-orders-kanban' || mKey === 'mod-vehicles-assets' || mKey === 'mod-worker-commissions') { pkRenderKanbanHub(mKey); return; }
    if (mKey === 'mod-directory' || mKey === 'mod-contracts' || mKey === 'mod-receivables-cxc' || mKey === 'mod-dian' || mKey === 'mod-tech-reception' || mKey === 'mod-lots') { pkRenderLook360Hub(mKey); return; }
    if (mKey === 'mod-petty-cash') { pkRenderPettyCashHub(); return; }
    if (activeSvc.serviceKey === 'srv-reports') { pkRenderReportsAndCashboxHub(); return; }

    pkRenderStandardSectionStage(activeSub, client);
  }

  function pkRenderStandardSectionStage(activeSub, client) {
    var stage = document.getElementById('ws-module-stage');
    if (!stage) return;

    var fHtml = '';
    for (var m = 0; m < activeSub.fields.length; m++) {
      var fld = activeSub.fields[m];
      fHtml += '<div class="field"><label>' + pkEsc(fld.label) + '</label>';
      if (fld.type === 'select') {
        fHtml += '<select data-ws-field="' + pkEsc(fld.key) + '">';
        var opts = fld.options || [];
        for (var o = 0; o < opts.length; o++) fHtml += '<option value="' + pkEsc(opts[o]) + '">' + pkEsc(opts[o]) + '</option>';
        fHtml += '</select>';
      } else {
        fHtml += '<input type="' + pkEsc(fld.type) + '" data-ws-field="' + pkEsc(fld.key) + '" placeholder="' + pkEsc(fld.placeholder || '') + '" />';
      }
      fHtml += '</div>';
    }

    var hHtml = '<tr>';
    for (var h = 0; h < activeSub.tableHeaders.length; h++) hHtml += '<th>' + pkEsc(activeSub.tableHeaders[h]) + '</th>';
    hHtml += '<th>Acciones</th></tr>';

    var rows = STATE.submoduleRows[activeSub.moduleKey] || [];
    var qFilter = (STATE.v2FilterText || '').trim().toLowerCase();
    var rHtml = ''; var matchedCount = 0;
    for (var r = 0; r < rows.length; r++) {
      var rowStr = rows[r].join(' ').toLowerCase();
      if (qFilter && rowStr.indexOf(qFilter) === -1) continue;
      matchedCount++;
      rHtml += '<tr>';
      for (var c = 0; c < rows[r].length; c++) {
        rHtml += '<td>' + (c === 0 ? '<strong>' + pkEsc(rows[r][c]) + '</strong>' : pkEsc(rows[r][c])) + '</td>';
      }
      rHtml += '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" style="color:var(--pk-rose)" data-std-del-idx="' + r + '">🗑️ Eliminar</button>' +
        '</div></td></tr>';
    }

    stage.innerHTML =
      '<div class="card" style="border:2px solid #bfdbfe;background:#f8fafc;margin-bottom:14px">' +
      '<div class="card-head"><div><div class="card-title">➕ ' + pkEsc(activeSub.externalSubmoduleName) + '</div>' +
      '<div class="card-sub">' + pkEsc(activeSub.summary) + '</div></div>' +
      '<button type="button" class="btn btn-emerald" id="btn-ws-save-record">✓ ' + pkEsc(activeSub.actionButtonLabel) + '</button></div>' +
      '<div id="ws-specialized-widget-slot" style="margin-bottom:10px"></div>' +
      '<div class="form-grid">' + fHtml + '</div></div>' +
      '<div class="card"><div class="card-head"><div><div class="card-title">📋 Registros en ' + pkEsc(activeSub.externalSubmoduleName) + '</div></div>' +
      '<div class="row-actions"><input type="text" id="ws-v2-filter-input" value="' + pkEsc(STATE.v2FilterText || '') + '" placeholder="🔍 Buscar registro..." style="padding:7px 12px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px;min-width:220px" />' +
      '<span class="badge badge-blue">' + matchedCount + ' registros</span></div></div>' +
      '<div class="table-wrap"><table><thead>' + hHtml + '</thead><tbody>' +
      (rHtml || '<tr><td colspan="' + (activeSub.tableHeaders.length + 1) + '" style="text-align:center;color:var(--pk-muted)">Sin registros aún. Usa el formulario superior para agregar el primero.</td></tr>') +
      '</tbody></table></div></div>';

    pkRenderSpecializedWidget(activeSub, client);
  }
`;
}
