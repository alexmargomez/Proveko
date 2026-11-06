/**
 * Runtime Cliente (Parte 3): Navegación Lateral, Barra Superior de Secciones,
 * Generador Automático de Consecutivos, Selectores Relacionales Normalizados e Impresión Universal (<= 200 líneas).
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
    if (demoBanner) demoBanner.style.display = (STATE.publicTab === 'demo' && !STATE.session) ? 'flex' : 'none';
    var roleSel = document.getElementById('ws-role-view-selector');
    if (roleSel && roleSel.value !== (STATE.roleViewFilter || 'ALL')) roleSel.value = STATE.roleViewFilter || 'ALL';
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
        nHtml += '<button type="button" class="ws-nav-btn ' + (isCurrent ? 'active' : '') + '" data-ws-service="' + pkEsc(sv.serviceKey) + '"><span class="ws-nav-icon">' + pkEsc(sv.icon) + '</span><span class="ws-nav-title">' + pkEsc(sv.externalPrincipalModuleName) + '</span></button>';
      }
      navEl.innerHTML = nHtml;
    }
    var rbacBtn = document.getElementById('btn-nav-internal-rbac'); var featBtn = document.getElementById('btn-nav-need-feature');
    if (rbacBtn) rbacBtn.className = 'ws-nav-btn ' + (STATE.activeWorkstationPane === 'rbac' ? 'active' : '');
    if (featBtn) featBtn.className = 'ws-nav-btn ' + (STATE.activeWorkstationPane === 'need-feature' ? 'active' : '');
    var paneMod = document.getElementById('ws-pane-module-operation'); var paneRbac = document.getElementById('ws-pane-internal-rbac'); var paneFeat = document.getElementById('ws-pane-need-feature');
    if (paneMod) paneMod.style.display = STATE.activeWorkstationPane === 'module' ? 'block' : 'none';
    if (paneRbac) paneRbac.style.display = STATE.activeWorkstationPane === 'rbac' ? 'block' : 'none';
    if (paneFeat) paneFeat.style.display = STATE.activeWorkstationPane === 'need-feature' ? 'block' : 'none';
    if (STATE.activeWorkstationPane === 'rbac') { pkRenderInternalRbacPane(client); return; }
    if (STATE.activeWorkstationPane === 'need-feature') { pkRenderNeedFeaturePane(client); return; }
    if (!activeSvc) return;
    STATE.activeServiceKey = activeSvc.serviceKey;
    var iconEl = document.getElementById('ws-active-service-icon'); var titleEl = document.getElementById('ws-active-service-title');
    if (iconEl) iconEl.textContent = activeSvc.icon; if (titleEl) titleEl.textContent = activeSvc.externalPrincipalModuleName;
    var availableSubs = []; var activeSub = null;
    for (var j = 0; j < activeSvc.submodules.length; j++) {
      var sm = activeSvc.submodules[j];
      if (!client.activeSubmodules || client.activeSubmodules.length === 0 || client.activeSubmodules.indexOf(sm.moduleKey) !== -1) { availableSubs.push(sm); if (sm.moduleKey === STATE.activeSubmoduleKey) activeSub = sm; }
    }
    if (availableSubs.length === 0) availableSubs = activeSvc.submodules.slice();
    if (!activeSub && availableSubs.length > 0) { activeSub = availableSubs[0]; STATE.activeSubmoduleKey = activeSub.moduleKey; }
    var tabsEl = document.getElementById('ws-submodule-tabs');
    if (tabsEl) {
      var tHtml = '';
      for (var k = 0; k < availableSubs.length; k++) { var subTab = availableSubs[k]; tHtml += '<button type="button" class="ws-subtab-pill ' + (activeSub && subTab.moduleKey === activeSub.moduleKey ? 'active' : '') + '" data-ws-submodule="' + pkEsc(subTab.moduleKey) + '">' + pkEsc(subTab.tabIcon + ' ' + subTab.externalSubmoduleName) + '</button>'; }
      tabsEl.innerHTML = tHtml;
    }
    if (!activeSub) return;
    var mKey = activeSub.moduleKey;
    if (mKey === 'mod-pos') { pkRenderPosHub(); return; }
    if (mKey === 'mod-stock') { pkRenderInventoryHub(); return; }
    if (mKey === 'mod-tables' || mKey === 'mod-kds') { pkRenderGastroHub(mKey); return; }
    if (mKey === 'mod-rooms') { pkRenderHotelHub(); return; }
    if (mKey === 'mod-work-orders-kanban' || mKey === 'mod-vehicles-assets' || mKey === 'mod-worker-commissions') { pkRenderKanbanHub(mKey); return; }
    if (mKey === 'mod-directory' || mKey === 'mod-contracts' || mKey === 'mod-receivables-cxc' || mKey === 'mod-dian' || mKey === 'mod-tech-reception' || mKey === 'mod-lots') { pkRenderLook360Hub(mKey); return; }
    if (mKey === 'mod-petty-cash') { pkRenderPettyCashHub(); return; }
    if (activeSvc.serviceKey === 'srv-reports') { pkRenderReportsAndCashboxHub(); return; }
    pkRenderStandardSectionStage(activeSub, client);
  }

  function pkBuildRelationalFieldHtml(fld, db, nextAutoCode) {
    var lbl = fld.label || ''; var lLow = (lbl + ' ' + fld.key).toLowerCase();
    if (fld.type === 'select' && fld.options && fld.options.length > 0) {
      var sOpts = ''; for (var o = 0; o < fld.options.length; o++) sOpts += '<option value="' + pkEsc(fld.options[o]) + '">' + pkEsc(fld.options[o]) + '</option>';
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><select data-ws-field="' + pkEsc(fld.key) + '">' + sOpts + '</select></div>';
    }
    if (lLow.indexOf('ticket') !== -1 || lLow.indexOf('tiquete') !== -1 || lLow.indexOf('consecutivo') !== -1 || lLow.indexOf('código') !== -1 || lLow.indexOf('codigo') !== -1 || lLow.indexOf('manifiesto') !== -1 || lLow.indexOf('n°') !== -1 || lLow.indexOf('prefijo') !== -1 || lLow.indexOf('qr') !== -1) {
      return '<div class="field"><label>' + pkEsc(lbl) + ' (⚡ Automático)</label><input type="text" data-ws-field="' + pkEsc(fld.key) + '" value="' + pkEsc(nextAutoCode) + '" readonly style="background:#e2e8f0;font-weight:800" /></div>';
    }
    if (lLow.indexOf('conductor') !== -1) {
      var dOpts = ''; for (var d = 0; d < db.drivers.length; d++) dOpts += '<option value="' + pkEsc(db.drivers[d].name + ' — CC ' + db.drivers[d].docNumber + ' (' + db.drivers[d].assignedPlate + ')') + '">' + pkEsc(db.drivers[d].name + ' (CC ' + db.drivers[d].docNumber + ' · Placa ' + db.drivers[d].assignedPlate + ')') + '</option>';
      return '<div class="field"><label style="display:flex;justify-content:space-between"><span>' + pkEsc(lbl) + '</span><a href="javascript:void(0)" data-open-quick-entity="DRIVER" style="color:var(--pk-primary)">+ Nuevo Conductor</a></label><select data-ws-field="' + pkEsc(fld.key) + '">' + dOpts + '</select></div>';
    }
    if (lLow.indexOf('transportista') !== -1) {
      var cOpts = ''; for (var cr = 0; cr < db.carriers.length; cr++) cOpts += '<option value="' + pkEsc(db.carriers[cr].name) + '">' + pkEsc(db.carriers[cr].name + ' (' + db.carriers[cr].nit + ')') + '</option>';
      return '<div class="field"><label style="display:flex;justify-content:space-between"><span>' + pkEsc(lbl) + '</span><a href="javascript:void(0)" data-open-quick-entity="CARRIER" style="color:var(--pk-primary)">+ Nuevo Transportista</a></label><select data-ws-field="' + pkEsc(fld.key) + '">' + cOpts + '</select></div>';
    }
    if (lLow.indexOf('placa') !== -1 || lLow.indexOf('vehículo') !== -1 || lLow.indexOf('vehiculo') !== -1 || lLow.indexOf('tractomula') !== -1 || lLow.indexOf('cabezote') !== -1) {
      var vOpts = ''; for (var v = 0; v < db.vehicles.length; v++) vOpts += '<option value="' + pkEsc(db.vehicles[v].plate + ' — ' + db.vehicles[v].brand) + '">' + pkEsc(db.vehicles[v].plate + ' — ' + db.vehicles[v].brand) + '</option>';
      return '<div class="field"><label style="display:flex;justify-content:space-between"><span>' + pkEsc(lbl) + '</span><a href="javascript:void(0)" data-open-quick-entity="VEHICLE" style="color:var(--pk-primary)">+ Nueva Placa</a></label><select data-ws-field="' + pkEsc(fld.key) + '">' + vOpts + '</select></div>';
    }
    if (lLow.indexOf('cliente') !== -1 || lLow.indexOf('huésped') !== -1 || lLow.indexOf('huesped') !== -1 || lLow.indexOf('paciente') !== -1 || lLow.indexOf('tercero') !== -1 || lLow.indexOf('comprador') !== -1 || lLow.indexOf('visitante') !== -1 || lLow.indexOf('empresa') !== -1 || lLow.indexOf('titular') !== -1) {
      var cuOpts = ''; for (var cu = 0; cu < db.customers.length; cu++) cuOpts += '<option value="' + pkEsc(db.customers[cu].name) + '">' + pkEsc(db.customers[cu].name + ' (' + db.customers[cu].nit + ')') + '</option>';
      return '<div class="field"><label style="display:flex;justify-content:space-between"><span>' + pkEsc(lbl) + '</span><a href="javascript:void(0)" data-open-new-customer-modal="1" style="color:var(--pk-primary)">+ Nuevo Cliente</a></label><select data-ws-field="' + pkEsc(fld.key) + '">' + cuOpts + '</select></div>';
    }
    if (lLow.indexOf('bodega') !== -1 || lLow.indexOf('almacén') !== -1 || lLow.indexOf('sucursal') !== -1) {
      var wOpts = ''; for (var w = 0; w < db.warehouses.length; w++) wOpts += '<option value="' + pkEsc(db.warehouses[w].name) + '">' + pkEsc(db.warehouses[w].name + ' (' + db.warehouses[w].city + ')') + '</option>';
      return '<div class="field"><label style="display:flex;justify-content:space-between"><span>' + pkEsc(lbl) + '</span><a href="javascript:void(0)" data-open-quick-entity="WAREHOUSE" style="color:var(--pk-primary)">+ Nueva Bodega</a></label><select data-ws-field="' + pkEsc(fld.key) + '">' + wOpts + '</select></div>';
    }
    if (lLow.indexOf('proveedor') !== -1) {
      var spOpts = ''; for (var s = 0; s < db.suppliers.length; s++) spOpts += '<option value="' + pkEsc(db.suppliers[s].name) + '">' + pkEsc(db.suppliers[s].name + ' (' + db.suppliers[s].nit + ')') + '</option>';
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><select data-ws-field="' + pkEsc(fld.key) + '">' + spOpts + '</select></div>';
    }
    if (lLow.indexOf('producto') !== -1 || lLow.indexOf('insumo') !== -1 || lLow.indexOf('mercancía') !== -1 || lLow.indexOf('item') !== -1 || lLow.indexOf('ítem') !== -1 || lLow.indexOf('plato') !== -1) {
      var prOpts = ''; for (var p = 0; p < db.products.length; p++) prOpts += '<option value="' + pkEsc(db.products[p].name + ' (' + pkCop(db.products[p].salePrice) + ')') + '">' + pkEsc(db.products[p].name + ' — Stock: ' + db.products[p].stock + ' — ' + pkCop(db.products[p].salePrice)) + '</option>';
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><select data-ws-field="' + pkEsc(fld.key) + '">' + prOpts + '</select></div>';
    }
    if (lLow.indexOf('habitación') !== -1 || lLow.indexOf('habitacion') !== -1 || lLow.indexOf('cabaña') !== -1 || lLow.indexOf('espacio') !== -1) {
      var rmOpts = ''; for (var rm = 0; rm < db.hotelRooms.length; rm++) rmOpts += '<option value="' + pkEsc(db.hotelRooms[rm].roomNumber + ' (' + pkCop(db.hotelRooms[rm].nightlyRate) + ')') + '">' + pkEsc(db.hotelRooms[rm].roomNumber + ' — ' + db.hotelRooms[rm].roomType + ' (' + pkCop(db.hotelRooms[rm].nightlyRate) + ')') + '</option>';
      return '<div class="field"><label style="display:flex;justify-content:space-between"><span>' + pkEsc(lbl) + '</span><a href="javascript:void(0)" data-open-quick-entity="ROOM" style="color:var(--pk-primary)">+ Habitación</a></label><select data-ws-field="' + pkEsc(fld.key) + '">' + rmOpts + '</select></div>';
    }
    if (lLow.indexOf('puc') !== -1 || lLow.indexOf('cuenta contable') !== -1) {
      var pcOpts = ''; for (var pc = 0; pc < db.pucAccounts.length; pc++) pcOpts += '<option value="' + pkEsc(db.pucAccounts[pc].name) + '">' + pkEsc(db.pucAccounts[pc].name) + '</option>';
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><select data-ws-field="' + pkEsc(fld.key) + '">' + pcOpts + '</select></div>';
    }
    if (lLow.indexOf('técnico') !== -1 || lLow.indexOf('profesional') !== -1 || lLow.indexOf('vendedor') !== -1 || lLow.indexOf('empleado') !== -1 || lLow.indexOf('encargado') !== -1 || lLow.indexOf('responsable') !== -1 || lLow.indexOf('mesero') !== -1 || lLow.indexOf('autorizado') !== -1) {
      var wkOpts = ''; for (var wk = 0; wk < db.workers.length; wk++) wkOpts += '<option value="' + pkEsc(db.workers[wk].name) + '">' + pkEsc(db.workers[wk].name + ' — ' + db.workers[wk].specialty) + '</option>';
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><select data-ws-field="' + pkEsc(fld.key) + '">' + wkOpts + '</select></div>';
    }
    if (lLow.indexOf('carga') !== -1 || lLow.indexOf('ruta') !== -1 || lLow.indexOf('origen') !== -1 || lLow.indexOf('destino') !== -1) {
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><select data-ws-field="' + pkEsc(fld.key) + '"><option>Carga General Contenedor — Ruta Nacional</option><option>Granel Agrícola e Insumos — Puerto a Planta</option><option>Acero y Materiales — Bodega Central a Norte</option><option>Mercancía Refrigerada — Cadena de Frío</option><option>Paquetería Consolidada — Distribución Urbana</option></select></div>';
    }
    if (fld.type === 'date' || lLow.indexOf('fecha') !== -1 || lLow.indexOf('vencimiento') !== -1 || lLow.indexOf('vigencia') !== -1) {
      return '<div class="field"><label>' + pkEsc(lbl) + '</label><input type="date" data-ws-field="' + pkEsc(fld.key) + '" value="2026-11-05" /></div>';
    }
    var defVal = fld.type === 'number' ? '1' : '';
    if (lLow.indexOf('bruto') !== -1) defVal = '52400';
    else if (lLow.indexOf('tara') !== -1) defVal = '16800';
    else if (lLow.indexOf('valor') !== -1 || lLow.indexOf('precio') !== -1 || lLow.indexOf('tarifa') !== -1 || lLow.indexOf('monto') !== -1 || lLow.indexOf('costo') !== -1 || lLow.indexOf('total') !== -1 || lLow.indexOf('sueldo') !== -1) defVal = '185000';
    return '<div class="field"><label>' + pkEsc(lbl) + '</label><input type="' + pkEsc(fld.type) + '" data-ws-field="' + pkEsc(fld.key) + '" value="' + defVal + '" placeholder="' + pkEsc(fld.placeholder || '') + '" /></div>';
  }

  function pkRenderStandardSectionStage(activeSub, client) {
    var stage = document.getElementById('ws-module-stage');
    if (!stage) return;
    var db = STATE.relDb;
    var rows = STATE.submoduleRows[activeSub.moduleKey] || [];
    var prefix = activeSub.moduleKey.replace('mod-', '').slice(0, 3).toUpperCase();
    var nextAutoCode = prefix + '-' + (1001 + rows.length);

    var fHtml = '';
    for (var m = 0; m < activeSub.fields.length; m++) {
      fHtml += pkBuildRelationalFieldHtml(activeSub.fields[m], db, nextAutoCode);
    }

    var hHtml = '<tr>';
    for (var h = 0; h < activeSub.tableHeaders.length; h++) hHtml += '<th>' + pkEsc(activeSub.tableHeaders[h]) + '</th>';
    hHtml += '<th>Acciones</th></tr>';

    var qFilter = (STATE.v2FilterText || '').trim().toLowerCase();
    var rHtml = ''; var matchedCount = 0;
    for (var r = 0; r < rows.length; r++) {
      var rowStr = rows[r].join(' ').toLowerCase();
      if (qFilter && rowStr.indexOf(qFilter) === -1) continue;
      matchedCount++;
      rHtml += '<tr>';
      for (var c = 0; c < rows[r].length; c++) rHtml += '<td>' + (c === 0 ? '<strong>' + pkEsc(rows[r][c]) + '</strong>' : pkEsc(rows[r][c])) + '</td>';
      rHtml += '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-std-print-idx="' + r + '">🖨️ Imprimir</button>' +
        '<button type="button" class="btn btn-outline btn-sm" style="color:var(--pk-rose)" data-std-del-idx="' + r + '">🗑️</button>' +
        '</div></td></tr>';
    }

    stage.innerHTML =
      '<div class="card" style="border:2px solid #bfdbfe;background:#f8fafc;margin-bottom:14px">' +
      '<div class="card-head"><div><div class="card-title">➕ ' + pkEsc(activeSub.externalSubmoduleName) + ' (Consecutivo Automático: ' + nextAutoCode + ')</div>' +
      '<div class="card-sub">' + pkEsc(activeSub.summary) + '</div></div>' +
      '<button type="button" class="btn btn-emerald" id="btn-ws-save-record">✓ ' + pkEsc(activeSub.actionButtonLabel) + '</button></div>' +
      '<div id="ws-specialized-widget-slot" style="padding:0 16px"></div>' +
      '<div class="card-body"><div class="form-grid">' + fHtml + '</div></div></div>' +
      '<div class="card"><div class="card-head"><div><div class="card-title">📋 Registros Guardados en ' + pkEsc(activeSub.externalSubmoduleName) + '</div></div>' +
      '<div class="row-actions"><input type="text" id="ws-v2-filter-input" value="' + pkEsc(STATE.v2FilterText || '') + '" placeholder="🔍 Buscar registro..." style="padding:7px 12px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px;min-width:220px" />' +
      '<span class="badge badge-blue">' + matchedCount + ' registros</span>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-std-print-table">🖨️ Imprimir Listado PDF</button></div></div>' +
      '<div class="table-wrap"><table><thead>' + hHtml + '</thead><tbody>' +
      (rHtml || '<tr><td colspan="' + (activeSub.tableHeaders.length + 1) + '" style="text-align:center;color:var(--pk-muted)">Sin registros aún.</td></tr>') +
      '</tbody></table></div></div>';

    pkRenderSpecializedWidget(activeSub, client);
  }
`;
}
