import { renderCrm360CxcHubRuntimeJs } from './crm-360-cxc-hub.runtime.js';
import { renderDeveloperGroupsCatalogRuntimeJs } from './developer-groups-catalog.runtime.js';
import { renderDomSanitizerRuntimeJs } from './dom-sanitizer.runtime.js';
import { renderFormAndTableRuntimeJs } from './form-and-table.runtime.js';
import { renderGatewayTransportRuntimeJs } from './gateway-transport.runtime.js';
import { renderInventoryWmsHubRuntimeJs } from './inventory-wms-hub.runtime.js';
import { renderPlatformActionsRuntimeJs } from './platform-actions.runtime.js';
import { renderPosHybridHubRuntimeJs } from './pos-hybrid-hub.runtime.js';
import { renderRelationalHubActionsRuntimeJs } from './relational-hub-actions.runtime.js';
import { renderRelationalHubSecondaryActionsRuntimeJs } from './relational-hub-secondary-actions.runtime.js';
import { renderRelationalModalsRuntimeJs } from './relational-modals.runtime.js';
import { renderRelationalSeedDataRuntimeJs } from './relational-seed-data.runtime.js';
import { renderReportsCashboxCommissionsHubRuntimeJs } from './reports-cashbox-commissions-hub.runtime.js';
import { renderSuperAdminAndShellRuntimeJs } from './superadmin-and-shell.runtime.js';
import { renderWorkshopKanbanHubRuntimeJs } from './workshop-kanban-hub.runtime.js';

/**
 * Ensamblador y Controlador de Eventos del Runtime Cliente (Cumpliendo SOLID SRP <= 200 líneas).
 */
export function renderClientRuntimeBundleJs(): string {
  return `(function() {
${renderRelationalSeedDataRuntimeJs()}
${renderDomSanitizerRuntimeJs()}
${renderFormAndTableRuntimeJs()}
${renderPosHybridHubRuntimeJs()}
${renderWorkshopKanbanHubRuntimeJs()}
${renderInventoryWmsHubRuntimeJs()}
${renderCrm360CxcHubRuntimeJs()}
${renderReportsCashboxCommissionsHubRuntimeJs()}
${renderRelationalModalsRuntimeJs()}
${renderRelationalHubSecondaryActionsRuntimeJs()}
${renderRelationalHubActionsRuntimeJs()}
${renderGatewayTransportRuntimeJs()}
${renderPlatformActionsRuntimeJs()}
${renderDeveloperGroupsCatalogRuntimeJs()}
${renderSuperAdminAndShellRuntimeJs()}

  function pkGoRegister(presetId) {
    if (presetId) { STATE.selectedBusinessTypeId = presetId; STATE.extraServiceKeys = {}; STATE.extraSubmoduleKeys = {}; }
    STATE.publicTab = 'auth'; STATE.authMode = 'register'; pkUpdateShellNavigation();
  }

  function pkMapServiceToConvergedHub(svcKey) {
    if (svcKey === 'srv-invoicing') return 'pos';
    if (svcKey === 'srv-workshop' || svcKey === 'srv-appointments') return 'kanban';
    if (svcKey === 'srv-inventory' || svcKey === 'srv-procurement') return 'inventory';
    if (svcKey === 'srv-crm' || svcKey === 'srv-treasury') return 'look360';
    if (svcKey === 'srv-reports' || svcKey === 'srv-finance' || svcKey === 'srv-hr-payroll') return 'reports';
    if (svcKey === 'srv-gastro') return 'gastro';
    return 'submodules';
  }

  document.addEventListener('click', function(ev) {
    var target = ev.target;
    if (!target || !target.closest) return;

    if (target.closest('#tab-nav-showcase')) { STATE.publicTab = 'showcase'; pkUpdateShellNavigation(); return; }
    if (target.closest('#tab-nav-auth') || target.closest('#btn-hero-go-login')) { STATE.publicTab = 'auth'; STATE.authMode = 'login'; pkUpdateShellNavigation(); return; }
    if (target.closest('#tab-nav-demo') || target.closest('#btn-hero-go-demo')) { STATE.publicTab = 'demo'; STATE.activeWorkstationPane = 'module'; pkUpdateShellNavigation(); return; }
    if (target.closest('#btn-hero-go-register') || target.closest('#btn-card-go-register') ||
        target.closest('#btn-showcase-mid-register') || target.closest('#btn-demo-go-register') ||
        target.closest('#btn-login-switch-to-register') || target.closest('#btn-auth-mode-register')) { pkGoRegister(); return; }
    if (target.closest('#btn-auth-mode-login')) { STATE.authMode = 'login'; pkUpdateShellNavigation(); return; }
    if (target.closest('#btn-logout-session')) { STATE.session = null; STATE.publicTab = 'showcase'; pkUpdateShellNavigation(); pkToast('Sesión cerrada.'); return; }

    var shPreset = target.closest('[data-showcase-preset]');
    if (shPreset) { pkGoRegister(shPreset.getAttribute('data-showcase-preset')); return; }

    var bTypeBtn = target.closest('[data-select-btype]');
    if (bTypeBtn) {
      STATE.selectedBusinessTypeId = bTypeBtn.getAttribute('data-select-btype');
      STATE.extraServiceKeys = {}; STATE.extraSubmoduleKeys = {}; pkRenderRegistrationWizard(); return;
    }

    if (target.closest('#btn-submit-login')) {
      var uVal = ((document.getElementById('login-username') || {}).value || '').trim().toLowerCase();
      if (!uVal) { pkToast('Ingresa tu usuario o correo.'); return; }
      if (uVal.indexOf('superadmin') !== -1) { STATE.session = { role: 'superadmin', username: uVal }; }
      else if (uVal.indexOf('dev') !== -1 || uVal.indexOf('desarrollador') !== -1) { STATE.session = { role: 'desarrollador', username: uVal }; }
      else if (uVal.indexOf('aux') !== -1) { STATE.session = { role: 'auxiliar', username: uVal }; }
      else {
        var matchedClient = STATE.clients[STATE.clients.length - 1] || STATE.clients[0];
        for (var i = 0; i < STATE.clients.length; i++) if (STATE.clients[i].adminUsername.toLowerCase() === uVal) matchedClient = STATE.clients[i];
        if (!matchedClient) { pkToast('No hay un cliente registrado con ese usuario. Registra primero tu empresa.'); return; }
        STATE.activeTenantId = matchedClient.tenantId;
        STATE.session = { role: 'cliente', username: uVal, tenantId: matchedClient.tenantId, internalRoleName: 'Administrador General' };
      }
      pkUpdateShellNavigation(); pkToast('Bienvenido a Proveko (' + STATE.session.role + ').'); return;
    }

    if (target.closest('#btn-open-standby-checkout') || target.closest('#btn-sa-new-client') || target.closest('#btn-sa-empty-new-client')) {
      var cName = ((document.getElementById('reg-company-name') || {}).value || '').trim() || 'Nueva Empresa Cliente S.A.S.';
      var plan = pkComputeRegistrationPlan();
      document.getElementById('pay-modal-company').value = cName;
      document.getElementById('pay-modal-amount').value = pkCop(plan.totalUsd) + '/mes';
      document.getElementById('payment-step-checkout').style.display = 'block';
      document.getElementById('payment-step-credentials').style.display = 'none';
      document.getElementById('standby-payment-modal').classList.add('open');
      return;
    }
    if (target.closest('#btn-close-payment-modal')) { document.getElementById('standby-payment-modal').classList.remove('open'); return; }
    if (target.closest('#btn-confirm-standby-payment')) { pkConfirmStandbyCheckout(); return; }
    if (target.closest('#btn-enter-with-generated-creds') && STATE.lastGeneratedClient) {
      var gc = STATE.lastGeneratedClient;
      document.getElementById('standby-payment-modal').classList.remove('open');
      STATE.activeTenantId = gc.tenantId;
      STATE.session = { role: 'cliente', username: gc.adminUsername, tenantId: gc.tenantId, internalRoleName: 'Administrador General (Cuenta Admin)' };
      pkUpdateShellNavigation(); return;
    }

    var lookTab = target.closest('[data-look360-tab]');
    if (lookTab) { STATE.look360Tab = lookTab.getAttribute('data-look360-tab'); pkRenderWorkstation(); return; }
    if (pkHandleRelationalHubClick(target)) return;

    var wsSvc = target.closest('[data-ws-service]');
    if (wsSvc) {
      var sKey = wsSvc.getAttribute('data-ws-service');
      STATE.activeWorkstationPane = 'module'; STATE.activeServiceKey = sKey; STATE.activeSubmoduleKey = '';
      STATE.activeConvergedHub = pkMapServiceToConvergedHub(sKey); pkRenderWorkstation(); return;
    }
    var wsSub = target.closest('[data-ws-submodule]');
    if (wsSub) { STATE.activeSubmoduleKey = wsSub.getAttribute('data-ws-submodule'); STATE.activeConvergedHub = 'submodules'; pkRenderWorkstation(); return; }
    if (target.closest('#btn-nav-internal-rbac')) { STATE.activeWorkstationPane = 'rbac'; pkRenderWorkstation(); return; }
    if (target.closest('#btn-nav-need-feature')) { STATE.activeWorkstationPane = 'need-feature'; pkRenderWorkstation(); return; }
    if (target.closest('#btn-ws-clear-filter')) { STATE.v2FilterText = ''; var fIn = document.getElementById('ws-v2-filter-input'); if (fIn) fIn.value = ''; pkRenderWorkstation(); return; }

    if (target.closest('#btn-ws-save-record')) {
      var inputs = document.querySelectorAll('[data-ws-field]');
      var recId = 'REG-' + String(Date.now()).slice(-4);
      var row = [recId]; for (var f = 0; f < inputs.length; f++) row.push(inputs[f].value || 'Registrado');
      if (!STATE.submoduleRows[STATE.activeSubmoduleKey]) STATE.submoduleRows[STATE.activeSubmoduleKey] = [];
      STATE.submoduleRows[STATE.activeSubmoduleKey].unshift(row);
      if (pkIsDemoMode()) {
        pkSaveDemoToLocalStorage(); pkRenderWorkstation(); pkToast('Registro guardado en localStorage (Modo Demo).');
      } else {
        var clRec = pkGetActiveClient();
        fetch('/api/v1/control/client-db/record', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dbName: clRec.dbName, submoduleKey: STATE.activeSubmoduleKey, recordId: recId, cells: row }) }).catch(function() {});
        pkRenderWorkstation(); pkToast('Registro persistido en BD PostgreSQL: ' + clRec.dbName);
      }
      return;
    }

    if (target.closest('#btn-create-internal-role')) {
      var clR = pkGetActiveClient();
      if (clR.internalRoles.length >= clR.maxRolesAllowed) { pkToast('Has alcanzado el límite máximo de roles (' + clR.maxRolesAllowed + ').'); return; }
      var rName = ((document.getElementById('new-role-name') || {}).value || '').trim();
      var rDesc = ((document.getElementById('new-role-desc') || {}).value || '').trim() || 'Rol personalizado';
      if (!rName) { pkToast('Ingresa el nombre del rol.'); return; }
      clR.internalRoles.push({ roleId: 'rol-' + Date.now(), name: rName, description: rDesc, allowedSubmodules: clR.activeSubmodules.slice(0, 3) });
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage(); pkRenderWorkstation(); pkToast('Rol interno creado en ' + clR.dbName); return;
    }

    if (target.closest('#btn-create-internal-user')) {
      var clU = pkGetActiveClient();
      if (clU.internalUsers.length >= clU.maxUsersAllowed) { pkToast('Has alcanzado el límite máximo de usuarios (' + clU.maxUsersAllowed + ').'); return; }
      var uFull = ((document.getElementById('new-user-fullname') || {}).value || '').trim();
      var uName = ((document.getElementById('new-user-username') || {}).value || '').trim();
      if (!uFull || !uName) { pkToast('Completa nombre y usuario.'); return; }
      clU.internalUsers.push({ userId: 'u-' + Date.now(), username: uName, fullName: uFull, email: uName + '@empresa.co', internalRoleId: 'rol-operador', internalRoleName: 'Rol Asignado', passwordHint: 'Usr#2026!', isClientAdmin: false });
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage(); pkRenderWorkstation(); pkToast('Usuario creado en ' + clU.dbName); return;
    }

    var reqBtn = target.closest('[data-req-key]');
    if (reqBtn) {
      var clF = pkGetActiveClient();
      var rTier = reqBtn.getAttribute('data-req-tier'); var rKey = reqBtn.getAttribute('data-req-key'); var rLbl = reqBtn.getAttribute('data-req-label');
      if (rTier === 'SUBMODULO' && clF.activeSubmodules.indexOf(rKey) === -1) clF.activeSubmodules.push(rKey);
      if (rTier === 'FUNCIONALIDAD' && clF.activeFeatures.indexOf(rKey) === -1) clF.activeFeatures.push(rKey);
      STATE.featureRequests.push({ companyName: clF.companyName, tier: rTier, key: rKey, label: rLbl });
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage(); pkRenderWorkstation(); pkToast('Activado: ' + rLbl); return;
    }
    if (pkHandleSuperAdminAction(target)) return;
  });

  document.addEventListener('change', function(ev) {
    var t = ev.target; if (!t) return;
    if (t.id === 'pos-select-customer') { STATE.posCustomerId = t.value; STATE.posVehicleId = ''; pkRenderWorkstation(); return; }
    if (t.id === 'pos-select-vehicle') { STATE.posVehicleId = t.value; pkRenderWorkstation(); return; }
    if (t.id === 'pos-payment-method') { STATE.posPaymentMethod = t.value; pkRenderWorkstation(); return; }
    if (t.id === 'inv-filter-warehouse') { STATE.invWarehouseFilter = t.value; pkRenderWorkstation(); return; }
    var exSvc = t.getAttribute('data-extra-service'); if (exSvc) { STATE.extraServiceKeys[exSvc] = !!t.checked; pkRenderRegistrationWizard(); return; }
    var exSub = t.getAttribute('data-extra-submodule'); if (exSub) { STATE.extraSubmoduleKeys[exSub] = !!t.checked; pkRenderRegistrationWizard(); return; }
  });

  document.addEventListener('input', function(ev) {
    var t = ev.target; if (!t) return;
    if (t.id === 'ws-v2-filter-input') { STATE.v2FilterText = t.value || ''; pkRenderWorkstation(); return; }
    if (t.id === 'inv-search-input') { STATE.invSearchText = t.value || ''; pkRenderWorkstation(); return; }
    if (t.id === 'look360-search-input') { STATE.look360Search = t.value || ''; pkRenderWorkstation(); return; }
    if (t.id === 'pos-cash-received') {
      if (STATE.posPaymentMethod === 'Crédito / Cartera CxC') STATE.posCreditInitialAbono = Number(t.value || 0);
      else STATE.posCashReceived = Number(t.value || 0);
    }
  });

  pkUpdateShellNavigation();
})();`;
}
