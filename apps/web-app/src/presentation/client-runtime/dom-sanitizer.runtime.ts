/**
 * Runtime Cliente (Parte 1): Estado Reactivo, Página de Muestra (Apartado 1)
 * y Asistente "Registra tu Negocio" por Tipo de Negocio + Adicionales (Apartado 2B).
 */
export function renderDomSanitizerRuntimeJs(): string {
  return `
  var BOOT = window.__PROVEKO_BOOT__ || {};
  var DEMO_STORAGE_KEY = 'proveko_demo_localstorage_v1';
  var defaultDemoClient = (BOOT.initialClients && BOOT.initialClients[0]) ? JSON.parse(JSON.stringify(BOOT.initialClients[0])) : null;
  if (defaultDemoClient) defaultDemoClient.dbName = 'localStorage (Navegador)';

  var STATE = {
    publicTab: 'showcase', // 'showcase' | 'auth' | 'demo'
    authMode: 'login',     // 'login' | 'register'
    session: null,         // { role: 'superadmin'|'desarrollador'|'auxiliar'|'cliente', username, tenantId, internalRoleName }
    selectedBusinessTypeId: (BOOT.businessTypes && BOOT.businessTypes[0]) ? BOOT.businessTypes[0].id : 'comercio-retail',
    extraServiceKeys: {},
    extraSubmoduleKeys: {},
    demoClient: defaultDemoClient,
    clients: [],
    pgDatabases: ['proveko_control_db', 'proveko_groups_db'],
    activeTenantId: 'tnt-demo',
    activeServiceKey: 'srv-invoicing',
    activeSubmoduleKey: 'mod-pos',
    activeWorkstationPane: 'module', // 'module' | 'rbac' | 'need-feature'
    submoduleRows: JSON.parse(JSON.stringify(BOOT.initialRows || {})),
    featureRequests: [],
    posCart: [
      { name: 'Producto / Servicio Principal', qty: 2, price: 48000, discountPct: 0 },
      { name: 'Insumo Complementario', qty: 1, price: 29000, discountPct: 5 }
    ],
    bomLines: [
      { ingredient: 'Materia Prima Base', qty: '10', unit: 'Kg', cost: 24000 },
      { ingredient: 'Empaque Sellado', qty: '1', unit: 'Und', cost: 2500 }
    ],
    lastGeneratedClient: null
  };

  function pkIsDemoMode() {
    return !STATE.session && STATE.publicTab === 'demo';
  }

  function pkLoadDemoFromLocalStorage() {
    try {
      var raw = window.localStorage ? window.localStorage.getItem(DEMO_STORAGE_KEY) : null;
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.demoClient) STATE.demoClient = parsed.demoClient;
      if (parsed && parsed.submoduleRows) STATE.submoduleRows = parsed.submoduleRows;
    } catch (_e) {}
  }

  function pkSaveDemoToLocalStorage() {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify({
        demoClient: STATE.demoClient,
        submoduleRows: STATE.submoduleRows
      }));
    } catch (_e) {}
  }
  pkLoadDemoFromLocalStorage();

  function pkEsc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pkCop(val) {
    return '$' + Number(val || 0).toLocaleString('es-CO') + ' COP';
  }

  function pkToast(msg) {
    var el = document.getElementById('pk-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(window.__pkToastTimer);
    window.__pkToastTimer = setTimeout(function() { el.classList.remove('show'); }, 3400);
  }

  function pkGetPreset(id) {
    var list = BOOT.businessTypes || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return list[0] || null;
  }

  function pkGetActiveClient() {
    if (pkIsDemoMode()) return STATE.demoClient;
    for (var i = 0; i < STATE.clients.length; i++) {
      if (STATE.clients[i].tenantId === STATE.activeTenantId) return STATE.clients[i];
    }
    return STATE.clients[0] || STATE.demoClient;
  }

  function pkRenderShowcase() {
    var svcGrid = document.getElementById('showcase-services-grid');
    if (svcGrid) {
      var sHtml = '';
      var svcs = BOOT.services || [];
      for (var i = 0; i < svcs.length; i++) {
        var s = svcs[i];
        var subBadges = '';
        for (var j = 0; j < s.submodules.length; j++) {
          subBadges += '<span class="badge badge-slate">' + pkEsc(s.submodules[j].tabIcon + ' ' + s.submodules[j].externalSubmoduleName) + '</span> ';
        }
        sHtml += '<div class="center-pick-card">' +
          '<div class="center-pick-head"><div class="center-pick-title">' + pkEsc(s.icon + ' ' + s.externalPrincipalModuleName) + '</div>' +
          '<span class="badge badge-blue">Módulo Principal</span></div>' +
          '<div class="center-pick-desc">' + pkEsc(s.subtitle) + '</div>' +
          '<div style="font-size:11px;font-weight:700;color:var(--pk-muted);margin-bottom:6px">Submódulos integrados en pestañas:</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:5px">' + subBadges + '</div></div>';
      }
      svcGrid.innerHTML = sHtml;
    }

    var presetGrid = document.getElementById('showcase-presets-grid');
    if (presetGrid) {
      var pHtml = '';
      var presets = BOOT.businessTypes || [];
      for (var k = 0; k < presets.length; k++) {
        var p = presets[k];
        pHtml += '<div class="center-pick-card">' +
          '<div class="center-pick-head"><div class="center-pick-title">' + pkEsc(p.name) + '</div>' +
          '<span class="center-pick-price">' + pkCop(p.baseMonthlyUsd) + '/mes</span></div>' +
          '<div style="margin-bottom:6px"><span class="badge badge-emerald">' + pkEsc(p.badge) + '</span></div>' +
          '<div class="center-pick-desc">' + pkEsc(p.description) + '</div>' +
          '<button type="button" class="btn btn-primary btn-sm" data-showcase-preset="' + pkEsc(p.id) + '">Elegir este Tipo de Negocio &rarr;</button></div>';
      }
      presetGrid.innerHTML = pHtml;
    }
  }

  function pkComputeRegistrationPlan() {
    var preset = pkGetPreset(STATE.selectedBusinessTypeId);
    var baseUsd = preset ? preset.baseMonthlyUsd : 149000;
    var incSvcs = preset ? preset.includedPrincipalServices : [];
    var incSubs = preset ? preset.includedSubmodules : [];
    var incFeats = preset ? preset.includedFeatures : [];
    var extraUsd = 0;
    var finalSvcs = incSvcs.slice();
    var finalSubs = incSubs.slice();

    var svcs = BOOT.services || [];
    for (var i = 0; i < svcs.length; i++) {
      var s = svcs[i];
      if (incSvcs.indexOf(s.serviceKey) === -1 && STATE.extraServiceKeys[s.serviceKey]) {
        extraUsd += s.standaloneMonthlyUsd;
        finalSvcs.push(s.serviceKey);
      }
      for (var j = 0; j < s.submodules.length; j++) {
        var sub = s.submodules[j];
        if (incSubs.indexOf(sub.moduleKey) === -1 && STATE.extraSubmoduleKeys[sub.moduleKey]) {
          extraUsd += sub.monthlyAddonUsd;
          finalSubs.push(sub.moduleKey);
          if (finalSvcs.indexOf(s.serviceKey) === -1) finalSvcs.push(s.serviceKey);
        }
      }
    }
    return {
      preset: preset,
      baseUsd: baseUsd,
      extraUsd: extraUsd,
      totalUsd: baseUsd + extraUsd,
      services: finalSvcs,
      submodules: finalSubs,
      features: incFeats.slice()
    };
  }
`;
}
