import { renderDeveloperGroupsCatalogRuntimeJs } from './developer-groups-catalog.runtime.js';
import { renderDomSanitizerRuntimeJs } from './dom-sanitizer.runtime.js';
import { renderFormAndTableRuntimeJs } from './form-and-table.runtime.js';
import { renderGatewayTransportRuntimeJs } from './gateway-transport.runtime.js';
import { renderPlatformActionsRuntimeJs } from './platform-actions.runtime.js';
import { renderSuperAdminAndShellRuntimeJs } from './superadmin-and-shell.runtime.js';

/**
 * Ensamblador y Controlador de Eventos del Runtime Cliente (Cumpliendo SOLID SRP <= 200 líneas).
 */
export function renderClientRuntimeBundleJs(): string {
  return `(function() {
${renderDomSanitizerRuntimeJs()}
${renderFormAndTableRuntimeJs()}
${renderGatewayTransportRuntimeJs()}
${renderPlatformActionsRuntimeJs()}
${renderDeveloperGroupsCatalogRuntimeJs()}
${renderSuperAdminAndShellRuntimeJs()}

  function pkGoRegister(presetId) {
    if (presetId) {
      STATE.selectedBusinessTypeId = presetId;
      STATE.extraServiceKeys = {};
      STATE.extraSubmoduleKeys = {};
    }
    STATE.publicTab = 'auth';
    STATE.authMode = 'register';
    pkUpdateShellNavigation();
  }

  document.addEventListener('click', function(ev) {
    var target = ev.target;
    if (!target || !target.closest) return;

    if (target.closest('#tab-nav-showcase')) { STATE.publicTab = 'showcase'; pkUpdateShellNavigation(); return; }
    if (target.closest('#tab-nav-auth') || target.closest('#btn-hero-go-login')) {
      STATE.publicTab = 'auth'; STATE.authMode = 'login'; pkUpdateShellNavigation(); return;
    }
    if (target.closest('#tab-nav-demo') || target.closest('#btn-hero-go-demo')) {
      STATE.publicTab = 'demo'; STATE.activeWorkstationPane = 'module'; pkUpdateShellNavigation(); return;
    }
    if (target.closest('#btn-hero-go-register') || target.closest('#btn-card-go-register') ||
        target.closest('#btn-showcase-mid-register') || target.closest('#btn-demo-go-register') ||
        target.closest('#btn-login-switch-to-register') || target.closest('#btn-auth-mode-register')) {
      pkGoRegister(); return;
    }
    if (target.closest('#btn-auth-mode-login')) { STATE.authMode = 'login'; pkUpdateShellNavigation(); return; }
    if (target.closest('#btn-logout-session')) {
      STATE.session = null; STATE.publicTab = 'showcase'; pkUpdateShellNavigation(); pkToast('Sesión cerrada.'); return;
    }

    var shPreset = target.closest('[data-showcase-preset]');
    if (shPreset) { pkGoRegister(shPreset.getAttribute('data-showcase-preset')); return; }

    var bTypeBtn = target.closest('[data-select-btype]');
    if (bTypeBtn) {
      STATE.selectedBusinessTypeId = bTypeBtn.getAttribute('data-select-btype');
      STATE.extraServiceKeys = {}; STATE.extraSubmoduleKeys = {};
      pkRenderRegistrationWizard(); return;
    }

    if (target.closest('#btn-submit-login')) {
      var uVal = ((document.getElementById('login-username') || {}).value || '').trim().toLowerCase();
      if (!uVal) { pkToast('Ingresa tu usuario o correo.'); return; }
      if (uVal.indexOf('superadmin') !== -1) {
        STATE.session = { role: 'superadmin', username: uVal };
      } else if (uVal.indexOf('dev') !== -1 || uVal.indexOf('desarrollador') !== -1) {
        STATE.session = { role: 'desarrollador', username: uVal };
      } else if (uVal.indexOf('aux') !== -1) {
        STATE.session = { role: 'auxiliar', username: uVal };
      } else {
        var matchedClient = STATE.clients[STATE.clients.length - 1] || STATE.clients[0];
        for (var i = 0; i < STATE.clients.length; i++) {
          if (STATE.clients[i].adminUsername.toLowerCase() === uVal) matchedClient = STATE.clients[i];
        }
        STATE.activeTenantId = matchedClient.tenantId;
        STATE.session = { role: 'cliente', username: uVal, tenantId: matchedClient.tenantId, internalRoleName: 'Administrador General' };
      }
      pkUpdateShellNavigation();
      pkToast('Bienvenido a Proveko (' + STATE.session.role + ').');
      return;
    }

    if (target.closest('#btn-open-standby-checkout') || target.closest('#btn-sa-new-client')) {
      var cName = ((document.getElementById('reg-company-name') || {}).value || '').trim() || 'Nueva Empresa Cliente S.A.S.';
      var plan = pkComputeRegistrationPlan();
      document.getElementById('pay-modal-company').value = cName;
      document.getElementById('pay-modal-amount').value = pkCop(plan.totalUsd) + '/mes';
      document.getElementById('payment-step-checkout').style.display = 'block';
      document.getElementById('payment-step-credentials').style.display = 'none';
      document.getElementById('standby-payment-modal').classList.add('open');
      return;
    }
    if (target.closest('#btn-close-payment-modal')) {
      document.getElementById('standby-payment-modal').classList.remove('open'); return;
    }
    if (target.closest('#btn-confirm-standby-payment')) { pkConfirmStandbyCheckout(); return; }
    if (target.closest('#btn-enter-with-generated-creds') && STATE.lastGeneratedClient) {
      var gc = STATE.lastGeneratedClient;
      document.getElementById('standby-payment-modal').classList.remove('open');
      STATE.activeTenantId = gc.tenantId;
      STATE.session = { role: 'cliente', username: gc.adminUsername, tenantId: gc.tenantId, internalRoleName: 'Administrador General (Cuenta Admin)' };
      pkUpdateShellNavigation();
      return;
    }

    var wsSvc = target.closest('[data-ws-service]');
    if (wsSvc) { STATE.activeWorkstationPane = 'module'; STATE.activeServiceKey = wsSvc.getAttribute('data-ws-service'); STATE.activeSubmoduleKey = ''; pkRenderWorkstation(); return; }
    var wsSub = target.closest('[data-ws-submodule]');
    if (wsSub) { STATE.activeSubmoduleKey = wsSub.getAttribute('data-ws-submodule'); pkRenderWorkstation(); return; }
    if (target.closest('#btn-nav-internal-rbac')) { STATE.activeWorkstationPane = 'rbac'; pkRenderWorkstation(); return; }
    if (target.closest('#btn-nav-need-feature')) { STATE.activeWorkstationPane = 'need-feature'; pkRenderWorkstation(); return; }
    if (target.closest('#btn-ws-clear-filter')) {
      STATE.v2FilterText = ''; var fIn = document.getElementById('ws-v2-filter-input'); if (fIn) fIn.value = ''; pkRenderWorkstation(); return;
    }

    if (target.closest('#btn-ws-save-record')) {
      var inputs = document.querySelectorAll('[data-ws-field]');
      var row = ['REG-' + String(Date.now()).slice(-4)];
      for (var f = 0; f < inputs.length; f++) row.push(inputs[f].value || 'Registrado');
      if (!STATE.submoduleRows[STATE.activeSubmoduleKey]) STATE.submoduleRows[STATE.activeSubmoduleKey] = [];
      STATE.submoduleRows[STATE.activeSubmoduleKey].unshift(row);
      pkRenderWorkstation();
      pkToast('Registro guardado en la Base de Datos de tu empresa.');
      return;
    }

    if (target.closest('#btn-create-internal-role')) {
      var clR = pkGetActiveClient();
      if (clR.internalRoles.length >= clR.maxRolesAllowed) {
        pkToast('Has alcanzado el límite máximo de roles (' + clR.maxRolesAllowed + ') permitido por SuperAdmin.'); return;
      }
      var rName = ((document.getElementById('new-role-name') || {}).value || '').trim();
      var rDesc = ((document.getElementById('new-role-desc') || {}).value || '').trim() || 'Rol personalizado';
      if (!rName) { pkToast('Ingresa el nombre del rol.'); return; }
      clR.internalRoles.push({ roleId: 'rol-' + Date.now(), name: rName, description: rDesc, allowedSubmodules: clR.activeSubmodules.slice(0, 3) });
      pkRenderWorkstation(); pkToast('Rol interno creado en ' + clR.dbName); return;
    }

    if (target.closest('#btn-create-internal-user')) {
      var clU = pkGetActiveClient();
      if (clU.internalUsers.length >= clU.maxUsersAllowed) {
        pkToast('Has alcanzado el límite máximo de usuarios (' + clU.maxUsersAllowed + ') permitido por SuperAdmin.'); return;
      }
      var uFull = ((document.getElementById('new-user-fullname') || {}).value || '').trim();
      var uName = ((document.getElementById('new-user-username') || {}).value || '').trim();
      if (!uFull || !uName) { pkToast('Completa nombre y usuario.'); return; }
      clU.internalUsers.push({ userId: 'u-' + Date.now(), username: uName, fullName: uFull, email: uName + '@empresa.co', internalRoleId: 'rol-operador', internalRoleName: 'Rol Asignado', passwordHint: 'Usr#2026!', isClientAdmin: false });
      pkRenderWorkstation(); pkToast('Usuario creado en ' + clU.dbName); return;
    }

    var reqBtn = target.closest('[data-req-key]');
    if (reqBtn) {
      var clF = pkGetActiveClient();
      var rTier = reqBtn.getAttribute('data-req-tier');
      var rKey = reqBtn.getAttribute('data-req-key');
      var rLbl = reqBtn.getAttribute('data-req-label');
      if (rTier === 'SUBMODULO' && clF.activeSubmodules.indexOf(rKey) === -1) clF.activeSubmodules.push(rKey);
      if (rTier === 'FUNCIONALIDAD' && clF.activeFeatures.indexOf(rKey) === -1) clF.activeFeatures.push(rKey);
      STATE.featureRequests.push({ companyName: clF.companyName, tier: rTier, key: rKey, label: rLbl });
      pkRenderWorkstation(); pkToast('Activado: ' + rLbl); return;
    }

    if (pkHandleSuperAdminAction(target)) return;
  });

  document.addEventListener('change', function(ev) {
    var t = ev.target;
    if (!t) return;
    var exSvc = t.getAttribute('data-extra-service');
    if (exSvc) { STATE.extraServiceKeys[exSvc] = !!t.checked; pkRenderRegistrationWizard(); return; }
    var exSub = t.getAttribute('data-extra-submodule');
    if (exSub) { STATE.extraSubmoduleKeys[exSub] = !!t.checked; pkRenderRegistrationWizard(); return; }
  });

  document.addEventListener('input', function(ev) {
    var t = ev.target;
    if (t && t.id === 'ws-v2-filter-input') {
      STATE.v2FilterText = t.value || '';
      pkRenderWorkstation();
      return;
    }
    if (t && (t.id === 'scale-gross-kg' || t.id === 'scale-tare-kg')) {
      var g = Number((document.getElementById('scale-gross-kg') || {}).value || 0);
      var tr = Number((document.getElementById('scale-tare-kg') || {}).value || 0);
      var net = Math.max(0, g - tr);
      var disp = document.getElementById('scale-net-display');
      if (disp) disp.value = net.toLocaleString('es-CO') + ' Kg (' + (net / 1000).toFixed(2) + ' Ton)';
    }
  });

  pkUpdateShellNavigation();
})();`;
}
