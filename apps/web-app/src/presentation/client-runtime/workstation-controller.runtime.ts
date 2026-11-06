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

    var shPreset = target.closest('[data-showcase-preset]'); if (shPreset) { pkGoRegister(shPreset.getAttribute('data-showcase-preset')); return; }
    var bTypeBtn = target.closest('[data-select-btype]');
    if (bTypeBtn) { STATE.selectedBusinessTypeId = bTypeBtn.getAttribute('data-select-btype'); STATE.extraServiceKeys = {}; STATE.extraSubmoduleKeys = {}; pkRenderRegistrationWizard(); return; }

    if (target.closest('#btn-submit-login')) {
      var uVal = ((document.getElementById('login-username') || {}).value || '').trim().toLowerCase();
      if (!uVal) { pkToast('Ingresa tu usuario o correo.'); return; }
      if (uVal.indexOf('superadmin') !== -1) STATE.session = { role: 'superadmin', username: uVal };
      else if (uVal.indexOf('dev') !== -1 || uVal.indexOf('desarrollador') !== -1) STATE.session = { role: 'desarrollador', username: uVal };
      else if (uVal.indexOf('aux') !== -1) STATE.session = { role: 'auxiliar', username: uVal };
      else {
        var matchedClient = STATE.clients[STATE.clients.length - 1] || STATE.clients[0];
        for (var i = 0; i < STATE.clients.length; i++) if (STATE.clients[i].adminUsername.toLowerCase() === uVal) matchedClient = STATE.clients[i];
        if (!matchedClient) { pkToast('No hay una empresa registrada con ese usuario.'); return; }
        STATE.activeTenantId = matchedClient.tenantId;
        STATE.session = { role: 'cliente', username: uVal, tenantId: matchedClient.tenantId, internalRoleName: 'Administrador General' };
      }
      pkUpdateShellNavigation(); pkToast('Bienvenido a Proveko.'); return;
    }

    if (target.closest('#btn-open-standby-checkout') || target.closest('#btn-sa-new-client') || target.closest('#btn-sa-empty-new-client')) {
      var cName = ((document.getElementById('reg-company-name') || {}).value || '').trim() || 'Nueva Empresa Cliente S.A.S.';
      var plan = pkComputeRegistrationPlan();
      document.getElementById('pay-modal-company').value = cName; document.getElementById('pay-modal-amount').value = pkCop(plan.totalUsd) + '/mes';
      document.getElementById('payment-step-checkout').style.display = 'block'; document.getElementById('payment-step-credentials').style.display = 'none';
      document.getElementById('standby-payment-modal').classList.add('open'); return;
    }
    if (target.closest('#btn-close-payment-modal')) { document.getElementById('standby-payment-modal').classList.remove('open'); return; }
    if (target.closest('#btn-confirm-standby-payment')) { pkConfirmStandbyCheckout(); return; }
    if (target.closest('#btn-enter-with-generated-creds') && STATE.lastGeneratedClient) {
      var gc = STATE.lastGeneratedClient; document.getElementById('standby-payment-modal').classList.remove('open');
      STATE.activeTenantId = gc.tenantId; STATE.session = { role: 'cliente', username: gc.adminUsername, tenantId: gc.tenantId, internalRoleName: 'Administrador General' };
      pkUpdateShellNavigation(); return;
    }

    if (pkHandleRelationalHubClick(target)) return;

    var db = STATE.relDb;
    if (db) {
      var settleBtn = target.closest('[data-settle-worker]');
      if (settleBtn) {
        var wkS = pkFindById(db.workers, settleBtn.getAttribute('data-settle-worker'));
        if (wkS && wkS.totalDayGross > 0) {
          var g = Number(wkS.totalDayGross); var pay = Math.round(g * (wkS.commissionPct / 100));
          db.settlements.unshift({ id: 'LIQ-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), workerId: wkS.id, workerName: wkS.name, grossLabor: g, commissionPct: wkS.commissionPct, technicianPayout: pay, companyRetention: g - pay });
          wkS.totalDayGross = 0; pkPersistRelationalTx('SETTLE_WORKER', { workerId: wkS.id, payout: pay }); pkRenderWorkstation(); pkToast('Liquidado ' + wkS.name + ' por ' + pkCop(pay));
        }
        return;
      }
      if (target.closest('#btn-wk-add')) {
        var wName = ((document.getElementById('wk-new-name') || {}).value || '').trim(); if (!wName) { pkToast('Ingresa el nombre del técnico.'); return; }
        db.workers.push({ id: 'wk-' + Date.now(), name: wName, docNumber: '1020' + String(Date.now()).slice(-5), specialty: ((document.getElementById('wk-new-spec') || {}).value || 'Técnico').trim(), commissionPct: Number((document.getElementById('wk-new-pct') || {}).value || 40), phone: '3000000000', totalDayGross: 0 });
        pkRenderWorkstation(); pkToast('Técnico agregado: ' + wName); return;
      }
      if (target.closest('#btn-exp-add')) {
        var eDesc = ((document.getElementById('exp-new-desc') || {}).value || '').trim(); if (!eDesc) { pkToast('Ingresa el concepto del gasto.'); return; }
        var eAmt = Math.max(1000, Number((document.getElementById('exp-new-amount') || {}).value || 25000));
        db.expenses.unshift({ id: 'EGR-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), category: (document.getElementById('exp-new-cat') || {}).value || 'Gastos Operativos', description: eDesc, amount: eAmt, paymentSource: (document.getElementById('exp-new-source') || {}).value || 'Efectivo Caja', responsible: 'Caja' });
        pkPersistRelationalTx('ADD_EXPENSE', { description: eDesc, amount: eAmt }); pkRenderWorkstation(); pkToast('Gasto registrado por ' + pkCop(eAmt)); return;
      }
      if (target.closest('#btn-cnt-add')) {
        var cCode = ((document.getElementById('cnt-new-code') || {}).value || ('CNV-' + String(Date.now()).slice(-3))).trim();
        var cEnt = ((document.getElementById('cnt-new-entity') || {}).value || 'Empresa Convenio').trim();
        var cCeil = Math.max(100000, Number((document.getElementById('cnt-new-ceiling') || {}).value || 15000000));
        db.contracts.unshift({ id: 'cnt-' + Date.now(), code: cCode, entityName: cEnt, tariffName: (document.getElementById('cnt-new-tariff') || {}).value || 'Tarifa Preferencial (-15%)', budgetCeiling: cCeil, consumedAmount: 0, availableBalance: cCeil, status: 'Activo' });
        pkRenderWorkstation(); pkToast('Convenio creado: ' + cCode); return;
      }
      if (target.closest('#btn-sup-add')) {
        var sName = ((document.getElementById('sup-new-name') || {}).value || '').trim(); if (!sName) { pkToast('Escribe la razón social del proveedor.'); return; }
        db.suppliers.unshift({ id: 'sup-' + Date.now(), nit: ((document.getElementById('sup-new-nit') || {}).value || '900123456-1').trim(), name: sName, city: ((document.getElementById('sup-new-city') || {}).value || 'Bogotá').trim(), phone: ((document.getElementById('sup-new-phone') || {}).value || '3100000000').trim() });
        pkRenderWorkstation(); pkToast('Proveedor guardado: ' + sName); return;
      }
      var delCust = target.closest('[data-cust-delete-id]'); if (delCust) { var cid = delCust.getAttribute('data-cust-delete-id'); for (var dc = 0; dc < db.customers.length; dc++) if (db.customers[dc].id === cid) { db.customers.splice(dc, 1); break; } pkRenderWorkstation(); return; }
      var delVeh = target.closest('[data-veh-delete-id]'); if (delVeh) { var vid = delVeh.getAttribute('data-veh-delete-id'); for (var dv = 0; dv < db.vehicles.length; dv++) if (db.vehicles[dv].id === vid) { db.vehicles.splice(dv, 1); break; } pkRenderWorkstation(); return; }
      var delExp = target.closest('[data-exp-delete-id]'); if (delExp) { var eid = delExp.getAttribute('data-exp-delete-id'); for (var de = 0; de < db.expenses.length; de++) if (db.expenses[de].id === eid) { db.expenses.splice(de, 1); break; } pkRenderWorkstation(); return; }
      var delSup = target.closest('[data-sup-delete-id]'); if (delSup) { var sid = delSup.getAttribute('data-sup-delete-id'); for (var ds = 0; ds < db.suppliers.length; ds++) if (db.suppliers[ds].id === sid) { db.suppliers.splice(ds, 1); break; } pkRenderWorkstation(); return; }
      var csvBtn = target.closest('[data-export-csv]');
      if (csvBtn) {
        var kind = csvBtn.getAttribute('data-export-csv');
        if (kind === 'invoices') { var rInv = []; for (var i1 = 0; i1 < db.invoices.length; i1++) rInv.push([db.invoices[i1].id, db.invoices[i1].date, db.invoices[i1].customerName, db.invoices[i1].total, db.invoices[i1].amountPaid, db.invoices[i1].pendingBalance, db.invoices[i1].status]); pkDownloadCsvUtf8('facturas_y_cartera.csv', ['Factura', 'Fecha', 'Cliente', 'Total', 'Pagado', 'Saldo', 'Estado'], rInv); }
        else if (kind === 'inventory') { var rPrd = []; for (var i2 = 0; i2 < db.products.length; i2++) rPrd.push([db.products[i2].code, db.products[i2].name, db.products[i2].category, db.products[i2].costPrice, db.products[i2].salePrice, db.products[i2].stock]); pkDownloadCsvUtf8('inventario_productos.csv', ['Codigo', 'Producto', 'Categoria', 'Costo', 'Precio_Venta', 'Existencia'], rPrd); }
        else if (kind === 'expenses') { var rExp = []; for (var i3 = 0; i3 < db.expenses.length; i3++) rExp.push([db.expenses[i3].id, db.expenses[i3].date, db.expenses[i3].category, db.expenses[i3].description, db.expenses[i3].paymentSource, db.expenses[i3].amount]); pkDownloadCsvUtf8('gastos_caja.csv', ['ID', 'Fecha', 'Categoria', 'Concepto', 'Medio', 'Valor'], rExp); }
        pkToast('Archivo Excel CSV descargado.'); return;
      }
    }

    var stdDel = target.closest('[data-std-del-idx]');
    if (stdDel) { var listStd = STATE.submoduleRows[STATE.activeSubmoduleKey]; if (listStd) { listStd.splice(Number(stdDel.getAttribute('data-std-del-idx')), 1); pkRenderWorkstation(); pkToast('Registro eliminado.'); } return; }
    var wsSvc = target.closest('[data-ws-service]');
    if (wsSvc) { STATE.activeWorkstationPane = 'module'; STATE.activeServiceKey = wsSvc.getAttribute('data-ws-service'); STATE.activeSubmoduleKey = ''; pkRenderWorkstation(); return; }
    var wsSub = target.closest('[data-ws-submodule]');
    if (wsSub) { STATE.activeSubmoduleKey = wsSub.getAttribute('data-ws-submodule'); pkRenderWorkstation(); return; }
    if (target.closest('#btn-nav-internal-rbac')) { STATE.activeWorkstationPane = 'rbac'; pkRenderWorkstation(); return; }
    if (target.closest('#btn-nav-need-feature')) { STATE.activeWorkstationPane = 'need-feature'; pkRenderWorkstation(); return; }
    if (target.closest('#btn-ws-save-record')) {
      var inputs = document.querySelectorAll('[data-ws-field]');
      var isAuto0 = inputs.length > 0 && inputs[0].hasAttribute('readonly');
      var recId = isAuto0 ? inputs[0].value : ('REG-' + String(Date.now()).slice(-4));
      var row = isAuto0 ? [] : [recId]; for (var f = 0; f < inputs.length; f++) row.push(inputs[f].value || 'Registrado');
      if (!STATE.submoduleRows[STATE.activeSubmoduleKey]) STATE.submoduleRows[STATE.activeSubmoduleKey] = [];
      STATE.submoduleRows[STATE.activeSubmoduleKey].unshift(row);
      if (pkIsDemoMode()) pkSaveDemoToLocalStorage();
      else { var clRec = pkGetActiveClient(); fetch('/api/v1/control/client-db/record', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dbName: clRec.dbName, submoduleKey: STATE.activeSubmoduleKey, recordId: recId, cells: row }) }).catch(function() {}); }
      pkRenderWorkstation(); pkToast('✓ Registro guardado: ' + recId); return;
    }
    if (pkHandleSuperAdminAction(target)) return;
  });

  document.addEventListener('change', function(ev) {
    var t = ev.target; if (!t) return;
    if (t.id === 'ws-role-view-selector') {
      STATE.roleViewFilter = t.value;
      if (t.value === 'MESERO') { STATE.activeServiceKey = 'srv-gastro'; STATE.activeSubmoduleKey = 'mod-tables'; }
      else if (t.value === 'COCINA') { STATE.activeServiceKey = 'srv-gastro'; STATE.activeSubmoduleKey = 'mod-kds'; }
      else if (t.value === 'CAJERO') { STATE.activeServiceKey = 'srv-invoicing'; STATE.activeSubmoduleKey = 'mod-pos'; }
      else if (t.value === 'BODEGA') { STATE.activeServiceKey = 'srv-inventory'; STATE.activeSubmoduleKey = 'mod-stock'; }
      else if (t.value === 'TECNICO') { STATE.activeServiceKey = 'srv-workshop'; STATE.activeSubmoduleKey = 'mod-work-orders-kanban'; }
      else if (t.value === 'RECEPCION') { STATE.activeServiceKey = 'srv-hospitality'; STATE.activeSubmoduleKey = 'mod-rooms'; }
      pkRenderWorkstation(); return;
    }
    if (t.id === 'wo-service-desc') { var prcEl = document.getElementById('wo-service-price'); if (prcEl && t.value.indexOf('|') !== -1) prcEl.value = t.value.split('|')[1]; return; }
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
      if (STATE.posPaymentMethod.indexOf('Crédito') !== -1) STATE.posCreditInitialAbono = Number(t.value || 0);
      else STATE.posCashReceived = Number(t.value || 0);
    }
  });

  pkUpdateShellNavigation();
})();`;
}
