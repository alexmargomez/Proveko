/**
 * Runtime Cliente (Parte 6): Gestión de la Base de Datos `proveko_groups_db`
 * (Grupos de Clientes tipo Bares, Comercio, Agro + Creación de Módulos/Submódulos/Funcionalidades por Desarrolladores).
 */
export function renderDeveloperGroupsCatalogRuntimeJs(): string {
  return `
  STATE.editingGroupKey = (BOOT.businessTypes && BOOT.businessTypes[0]) ? BOOT.businessTypes[0].id : 'bares-discotecas';
  STATE.v2FilterText = '';

  function pkRenderGroupsCatalogAdmin() {
    var panel = document.getElementById('sa-groups-catalog-panel');
    if (!panel) return;
    var groups = BOOT.businessTypes || [];
    var svcs = BOOT.services || [];
    var activeGrp = pkGetPreset(STATE.editingGroupKey) || groups[0];
    if (activeGrp) STATE.editingGroupKey = activeGrp.id;

    var grpChips = '';
    for (var g = 0; g < groups.length; g++) {
      var gp = groups[g];
      var isAct = activeGrp && gp.id === activeGrp.id;
      grpChips += '<button type="button" class="preset-chip ' + (isAct ? 'active' : '') + '" data-sa-select-group="' + pkEsc(gp.id) + '">' +
        pkEsc(gp.name) + ' (' + pkCop(gp.baseMonthlyUsd) + ')</button>';
    }

    var svcChecks = ''; var subChecks = ''; var featChecks = '';
    for (var i = 0; i < svcs.length; i++) {
      var s = svcs[i];
      var hasS = activeGrp && activeGrp.includedPrincipalServices.indexOf(s.serviceKey) !== -1;
      svcChecks += '<label class="comp-toggle-pill"><input type="checkbox" data-grp-svc="' + pkEsc(s.serviceKey) + '" ' + (hasS ? 'checked' : '') + '/><span>' + pkEsc(s.icon + ' ' + s.externalPrincipalModuleName) + '</span></label>';
      for (var j = 0; j < s.submodules.length; j++) {
        var sm = s.submodules[j];
        var hasSm = activeGrp && activeGrp.includedSubmodules.indexOf(sm.moduleKey) !== -1;
        subChecks += '<label class="comp-toggle-pill"><input type="checkbox" data-grp-sub="' + pkEsc(sm.moduleKey) + '" ' + (hasSm ? 'checked' : '') + '/><span>' + pkEsc(sm.tabIcon + ' ' + sm.externalSubmoduleName) + '</span></label>';
      }
      for (var f = 0; f < s.features.length; f++) {
        var ft = s.features[f];
        var hasFt = activeGrp && activeGrp.includedFeatures.indexOf(ft.componentKey) !== -1;
        featChecks += '<label class="comp-toggle-pill"><input type="checkbox" data-grp-feat="' + pkEsc(ft.componentKey) + '" ' + (hasFt ? 'checked' : '') + '/><span>✨ ' + pkEsc(ft.externalName) + '</span></label>';
      }
    }

    var grpOpts = '<option value="NONE">-- Solo agregar al catálogo general --</option>';
    for (var k = 0; k < groups.length; k++) {
      grpOpts += '<option value="' + pkEsc(groups[k].id) + '" ' + (groups[k].id === 'bares-discotecas' ? 'selected' : '') + '>Incluir en Plan Básico de: ' + pkEsc(groups[k].name) + '</option>';
    }
    var svcOpts = '';
    for (var m = 0; m < svcs.length; m++) {
      svcOpts += '<option value="' + pkEsc(svcs[m].serviceKey) + '">' + pkEsc(svcs[m].externalPrincipalModuleName) + '</option>';
    }

    panel.innerHTML =
      '<div style="margin-bottom:12px"><div style="font-size:12px;font-weight:800;margin-bottom:6px">1. Selecciona un Grupo de Clientes de proveko_groups_db para ver o editar qué incluye su Plan Básico:</div><div class="preset-row">' + grpChips + '</div></div>' +
      (activeGrp ? (
        '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:14px;margin-bottom:16px">' +
        '<div class="grid-3" style="margin-bottom:12px">' +
        '<div class="field"><label>Clave del Grupo (group_key)</label><input type="text" id="sa-grp-key" value="' + pkEsc(activeGrp.id) + '" /></div>' +
        '<div class="field"><label>Nombre del Grupo de Clientes</label><input type="text" id="sa-grp-name" value="' + pkEsc(activeGrp.name) + '" /></div>' +
        '<div class="field"><label>Precio Base Mensual (COP)</label><input type="number" id="sa-grp-cop" value="' + Number(activeGrp.baseMonthlyUsd || 149000) + '" /></div></div>' +
        '<div class="grid-3">' +
        '<div><div style="font-size:11px;font-weight:800;margin-bottom:6px">MÓDULOS PRINCIPALES DEL GRUPO</div><div class="comp-toggle-list">' + svcChecks + '</div></div>' +
        '<div><div style="font-size:11px;font-weight:800;margin-bottom:6px">SUBMÓDULOS BÁSICOS DEL GRUPO</div><div class="comp-toggle-list" style="max-height:210px;overflow-y:auto">' + subChecks + '</div></div>' +
        '<div><div style="font-size:11px;font-weight:800;margin-bottom:6px">FUNCIONALIDADES BÁSICAS DEL GRUPO</div><div class="comp-toggle-list" style="max-height:210px;overflow-y:auto">' + featChecks + '</div></div></div>' +
        '<div class="row-actions" style="margin-top:12px;justify-content:flex-end"><button type="button" class="btn btn-primary" id="btn-sa-save-group-bundle">💾 Guardar Grupo y su Matriz en proveko_groups_db</button></div></div>'
      ) : '') +
      '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px">' +
      '<div style="font-weight:800;font-size:13px;margin-bottom:8px">🛠️ 2. Desarrollador: Crear Nuevo Submódulo o Funcionalidad y Agregarlo a un Grupo Básico (Ej: Bares)</div>' +
      '<div class="grid-3" style="margin-bottom:10px">' +
      '<div class="field"><label>Nivel a Crear</label><select id="dev-new-tier"><option value="FUNCIONALIDAD">Funcionalidad (Componente mini)</option><option value="SUBMODULO">Submódulo (Pestaña)</option></select></div>' +
      '<div class="field"><label>Módulo Principal Padre</label><select id="dev-new-parent-svc">' + svcOpts + '</select></div>' +
      '<div class="field"><label>Asociar al Plan Básico del Grupo</label><select id="dev-new-target-group">' + grpOpts + '</select></div></div>' +
      '<div class="grid-3">' +
      '<div class="field"><label>Clave Técnica</label><input type="text" id="dev-new-key" placeholder="Ej: comp-bar-botellas" /></div>' +
      '<div class="field"><label>Nombre Público</label><input type="text" id="dev-new-name" placeholder="Ej: Control de Botellas Abiertas (Bares)" /></div>' +
      '<div class="field"><label>Valor Adicional Mensual (COP)</label><input type="number" id="dev-new-cop" value="19000" /></div></div>' +
      '<div class="row-actions" style="margin-top:10px;justify-content:flex-end"><button type="button" class="btn btn-emerald" id="btn-dev-create-catalog-item">+ Registrar en proveko_groups_db y Asociar al Grupo</button></div></div>';
  }

  function pkHandleDeveloperCatalogAction(target) {
    var selGrp = target.closest('[data-sa-select-group]');
    if (selGrp) { STATE.editingGroupKey = selGrp.getAttribute('data-sa-select-group'); pkRenderGroupsCatalogAdmin(); return true; }
    if (target.closest('#btn-sa-save-group-bundle')) {
      var gKey = ((document.getElementById('sa-grp-key') || {}).value || '').trim() || 'grupo-personalizado';
      var gName = ((document.getElementById('sa-grp-name') || {}).value || '').trim() || 'Grupo Empresarial';
      var gCop = Number((document.getElementById('sa-grp-cop') || {}).value || 149000);
      var sChecks = document.querySelectorAll('[data-grp-svc]:checked');
      var mChecks = document.querySelectorAll('[data-grp-sub]:checked');
      var fChecks = document.querySelectorAll('[data-grp-feat]:checked');
      var incS = []; var incM = []; var incF = [];
      for (var i = 0; i < sChecks.length; i++) incS.push(sChecks[i].getAttribute('data-grp-svc'));
      for (var j = 0; j < mChecks.length; j++) incM.push(mChecks[j].getAttribute('data-grp-sub'));
      for (var k = 0; k < fChecks.length; k++) incF.push(fChecks[k].getAttribute('data-grp-feat'));
      var found = pkGetPreset(gKey);
      if (found) { found.name = gName; found.baseMonthlyUsd = gCop; found.includedPrincipalServices = incS; found.includedSubmodules = incM; found.includedFeatures = incF; }
      else { BOOT.businessTypes.push({ id: gKey, name: gName, badge: 'Plan Base Personalizado', description: 'Grupo configurado en proveko_groups_db', baseMonthlyUsd: gCop, includedPrincipalServices: incS, includedSubmodules: incM, includedFeatures: incF }); }
      STATE.editingGroupKey = gKey;
      try { fetch('/api/v1/control/groups-catalog/group', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ groupKey: gKey, groupName: gName, badgeLabel: 'Plan Base Completo', description: 'Grupo configurado en proveko_groups_db', baseMonthlyCop: gCop, includedPrincipalServices: incS, includedSubmodules: incM, includedFeatures: incF }) }).catch(function() {}); } catch (_e) {}
      pkRenderGroupsCatalogAdmin(); pkToast('Grupo "' + gName + '" guardado en proveko_groups_db.'); return true;
    }
    if (target.closest('#btn-dev-create-catalog-item')) {
      var tier = ((document.getElementById('dev-new-tier') || {}).value || 'FUNCIONALIDAD');
      var pSvc = ((document.getElementById('dev-new-parent-svc') || {}).value || 'srv-gastro');
      var tGrp = ((document.getElementById('dev-new-target-group') || {}).value || 'NONE');
      var iKey = ((document.getElementById('dev-new-key') || {}).value || '').trim() || ('comp-dev-' + String(Date.now()).slice(-4));
      var iName = ((document.getElementById('dev-new-name') || {}).value || '').trim();
      var iCop = Number((document.getElementById('dev-new-cop') || {}).value || 19000);
      if (!iName) { pkToast('Ingresa el nombre público del nuevo ítem.'); return true; }
      for (var s = 0; s < BOOT.services.length; s++) {
        if (BOOT.services[s].serviceKey === pSvc) {
          if (tier === 'SUBMODULO') BOOT.services[s].submodules.push({ moduleKey: iKey, parentServiceKey: pSvc, externalSubmoduleName: iName, tabIcon: '✨', summary: 'Submódulo creado en proveko_groups_db', monthlyAddonUsd: iCop, actionButtonLabel: 'Guardar Registro', tableHeaders: ['Código', 'Detalle', 'Estado'], fields: [{ key: 'detail', label: iName, type: 'text', placeholder: 'Valor...' }] });
          else BOOT.services[s].features.push({ componentKey: iKey, externalName: iName, description: 'Funcionalidad creada en proveko_groups_db', parentModuleKey: 'independent', includedByDefault: true, monthlyAddonUsd: iCop });
        }
      }
      if (tGrp !== 'NONE') {
        var grpObj = pkGetPreset(tGrp);
        if (grpObj) {
          if (tier === 'SUBMODULO' && grpObj.includedSubmodules.indexOf(iKey) === -1) grpObj.includedSubmodules.push(iKey);
          if (tier === 'FUNCIONALIDAD' && grpObj.includedFeatures.indexOf(iKey) === -1) grpObj.includedFeatures.push(iKey);
        }
      }
      try { fetch('/api/v1/control/groups-catalog/item', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemTier: tier, itemKey: iKey, parentServiceKey: pSvc, externalName: iName, description: iName, monthlyCop: iCop, targetGroupKey: tGrp }) }).catch(function() {}); } catch (_e) {}
      pkRenderGroupsCatalogAdmin(); pkToast(tier + ' "' + iName + '" guardado en proveko_groups_db.'); return true;
    }
    return false;
  }

  function pkHydrateGroupsCatalogFromPostgres() {
    try {
      fetch('/api/v1/control/groups-catalog').then(function(r) { return r.ok ? r.json() : null; }).then(function(snap) {
        if (!snap || !Array.isArray(snap.groups) || snap.groups.length === 0) return;
        var bundles = Array.isArray(snap.bundleItems) ? snap.bundleItems : [];
        var hydratedGroups = [];
        for (var i = 0; i < snap.groups.length; i++) {
          var g = snap.groups[i]; var gKey = g.group_key; var svcs = []; var subs = []; var feats = [];
          for (var b = 0; b < bundles.length; b++) {
            if (bundles[b].group_key === gKey && bundles[b].included_in_base_plan) {
              if (bundles[b].item_tier === 'MODULO_PRINCIPAL') svcs.push(bundles[b].item_key);
              if (bundles[b].item_tier === 'SUBMODULO') subs.push(bundles[b].item_key);
              if (bundles[b].item_tier === 'FUNCIONALIDAD') feats.push(bundles[b].item_key);
            }
          }
          hydratedGroups.push({ id: gKey, name: g.group_name, badge: g.badge_label || 'Plan Base Completo', description: g.description || '', baseMonthlyUsd: Number(g.base_monthly_cop) || 149000, includedPrincipalServices: svcs, includedSubmodules: subs, includedFeatures: feats });
        }
        BOOT.businessTypes = hydratedGroups;
        if (STATE.publicTab === 'showcase') pkRenderShowcase();
        if (STATE.publicTab === 'auth' && STATE.authMode === 'register') pkRenderRegistrationWizard();
        if (STATE.session && (STATE.session.role === 'superadmin' || STATE.session.role === 'desarrollador' || STATE.session.role === 'auxiliar')) pkRenderGroupsCatalogAdmin();
      }).catch(function() {});
    } catch (_e) {}
  }
  setTimeout(pkHydrateGroupsCatalogFromPostgres, 90);
`;
}
