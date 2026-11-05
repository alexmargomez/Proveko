/**
 * Runtime de Cliente — Estado de la Estación de Trabajo, Conmutador de Capas (`/` vs `/app`)
 * y Orquestación de Capacidades / Presets (SOLID SRP).
 */
export function renderWorkstationControllerRuntimeJs(initialSurface: 'landing' | 'workstation'): string {
  return `
    const STATE = {
      surface: '${initialSurface}',
      tenantId: 'db_version_prueba',
      activeBranchId: 'br-01',
      subVer: 1,
      token: '',
      activePresetKey: 'preset:corporate-erp',
      selectedModuleKey: 'ms:crm-directory',
      showRawJson: false,
      isActionInFlight: false,
      requestSeq: 0,
      enabledServices: {
        'srv:crm': ['ms:crm-directory', 'ms:crm-pipelines', 'ms:crm-loyalty'],
        'srv:invoicing': ['ms:invoicing-pos', 'ms:invoicing-electronic-dian', 'ms:invoicing-quotes'],
        'srv:inventory': ['ms:inventory-stock', 'ms:inventory-recipes', 'ms:inventory-lots', 'ms:inventory-transfers'],
        'srv:gastro': ['ms:gastro-tables', 'ms:gastro-kds', 'ms:gastro-split-check'],
        'srv:hotel': ['ms:hotel-rooms', 'ms:hotel-bookings', 'ms:hotel-frontdesk'],
        'srv:finance': ['ms:finance-ar-ap', 'ms:finance-accounting-puc']
      },
      readonlyMicroservices: ['ms:invoicing-simple-receipt', 'ms:finance-cashbook']
    };

    window.provekoSwitchSurface = function(targetSurface) {
      STATE.surface = targetSurface === 'workstation' ? 'workstation' : 'landing';
      const landingEl = document.getElementById('surface-landing');
      const workstationEl = document.getElementById('surface-workstation');
      const tabLanding = document.getElementById('tab-surface-landing');
      const tabWorkstation = document.getElementById('tab-surface-workstation');
      if (landingEl && workstationEl) {
        landingEl.classList.toggle('hidden', STATE.surface !== 'landing');
        workstationEl.classList.toggle('hidden', STATE.surface !== 'workstation');
      }
      if (tabLanding && tabWorkstation) {
        tabLanding.classList.toggle('active', STATE.surface === 'landing');
        tabWorkstation.classList.toggle('active', STATE.surface === 'workstation');
      }
      if (STATE.surface === 'workstation') {
        renderActiveModulePanel();
        window.provekoExecuteList();
      } else {
        renderLandingConfigurator();
      }
    };

    window.provekoToggleAuditDrawer = function() {
      const drawer = document.getElementById('audit-drawer');
      if (drawer) drawer.classList.toggle('hidden');
    };

    window.provekoTogglePayloadMode = function() {
      STATE.showRawJson = !STATE.showRawJson;
      const rawBox = document.getElementById('raw-json-container');
      const btn = document.getElementById('btn-toggle-json-mode');
      if (rawBox) rawBox.classList.toggle('hidden', !STATE.showRawJson);
      if (btn) btn.textContent = STATE.showRawJson ? 'Ocultar JSON Avanzado' : 'Modo JSON Avanzado';
    };

    window.provekoToggleParentService = async function(svcKey) {
      if (isParentEnabled(svcKey)) {
        delete STATE.enabledServices[svcKey];
      } else {
        const firstChild = MODULES_CATALOG.find((m) => m.parentService === svcKey);
        STATE.enabledServices[svcKey] = firstChild ? [firstChild.key] : [];
      }
      STATE.subVer += 1;
      await window.provekoReissueSession();
    };

    window.provekoToggleModule = async function(svcKey, modKey) {
      if (!isParentEnabled(svcKey)) return;
      const list = STATE.enabledServices[svcKey] || [];
      const modMeta = MODULES_CATALOG.find((m) => m.key === modKey);
      if (list.includes(modKey)) {
        STATE.enabledServices[svcKey] = list.filter((k) => k !== modKey);
      } else {
        let nextList = [...list];
        if (modMeta && modMeta.supersedes) {
          nextList = nextList.filter((k) => k !== modMeta.supersedes);
          if (!STATE.readonlyMicroservices.includes(modMeta.supersedes)) {
            STATE.readonlyMicroservices.push(modMeta.supersedes);
          }
        }
        nextList.push(modKey);
        STATE.enabledServices[svcKey] = nextList;
        STATE.readonlyMicroservices = STATE.readonlyMicroservices.filter((k) => k !== modKey);
      }
      STATE.subVer += 1;
      await window.provekoReissueSession();
    };

    window.provekoApplyPreset = async function(presetKey) {
      const preset = PRESETS_CATALOG.find((p) => p.presetKey === presetKey);
      if (!preset) return;
      STATE.activePresetKey = presetKey;
      const nextServices = {};
      const svcList = preset.enabledServices || preset.services || [];
      const modList = preset.enabledMicroservices || preset.microservices || [];
      svcList.forEach((sKey) => { nextServices[sKey] = []; });
      modList.forEach((mKey) => {
        const m = MODULES_CATALOG.find((item) => item.key === mKey);
        if (m && nextServices[m.parentService]) {
          nextServices[m.parentService].push(mKey);
        }
      });
      STATE.enabledServices = nextServices;
      STATE.readonlyMicroservices = [];
      if (modList.includes('ms:invoicing-electronic-dian')) STATE.readonlyMicroservices.push('ms:invoicing-simple-receipt');
      if (modList.includes('ms:finance-accounting-puc')) STATE.readonlyMicroservices.push('ms:finance-cashbook');
      STATE.subVer += 1;
      if (modList.length > 0) STATE.selectedModuleKey = modList[0];
      await window.provekoReissueSession();
    };

    window.provekoSelectModule = function(modKey) {
      STATE.selectedModuleKey = modKey;
      renderSidebar();
      renderActiveModulePanel();
      window.provekoExecuteList();
    };

    function renderActiveModulePanel() {
      const mod = MODULES_CATALOG.find((m) => m.key === STATE.selectedModuleKey) || MODULES_CATALOG[0];
      const schema = UI_SCHEMAS[mod.key];
      const status = getModuleStatus(mod);
      document.getElementById('mod-parent-badge').textContent = mod.parentService.replace(/^srv:/, 'ms:');
      document.getElementById('mod-key-badge').textContent = schema.moduleNotation;
      document.getElementById('mod-prefix-badge').textContent = schema.badge;
      document.getElementById('mod-title').textContent = schema.title;
      document.getElementById('mod-desc').textContent = schema.description;
      document.getElementById('create-endpoint-label').textContent = 'POST ' + schema.createEndpoint;
      document.getElementById('btn-create-action').textContent = schema.createButtonLabel;
      document.getElementById('payload-editor').value = JSON.stringify(schema.defaultPayload, null, 2);

      const isLockedOrReadonly = status !== 'ACTIVE';
      renderModuleKpis(schema);
      renderGuidedFormFields(schema, isLockedOrReadonly);
      document.getElementById('btn-create-action').disabled = isLockedOrReadonly || STATE.isActionInFlight;

      const bannerBox = document.getElementById('gate-banner-container');
      if (status === 'ACTIVE') {
        bannerBox.className = 'hidden';
        bannerBox.innerHTML = '';
      } else if (status === 'READONLY') {
        bannerBox.className = '';
        bannerBox.innerHTML = '<div class="gate-banner gate-readonly"><span><strong>Modo Archivo Histórico (Solo Lectura):</strong> Este módulo fue reemplazado por un módulo superior. Tus registros históricos siguen disponibles para consulta y auditoría.</span></div>';
      } else {
        bannerBox.className = '';
        bannerBox.innerHTML = '<div class="gate-banner gate-locked"><span><strong>Módulo Desactivado en tu Plan Actual:</strong> Actívalo en un clic para habilitar el registro de operaciones.</span><button type="button" class="btn btn-primary" onclick="window.provekoQuickEnableCurrentModule()">⚡ Activar Ahora</button></div>';
      }
    }

    window.provekoQuickEnableCurrentModule = async function() {
      const mod = MODULES_CATALOG.find((m) => m.key === STATE.selectedModuleKey);
      if (!mod) return;
      if (!isParentEnabled(mod.parentService)) STATE.enabledServices[mod.parentService] = [];
      await window.provekoToggleModule(mod.parentService, mod.key);
    };
  `;
}
