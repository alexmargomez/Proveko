/**
 * Controlador de Transacciones Operativas Primarias (SOLID SRP <= 200 líneas):
 * POS, Modales de Nuevo Cliente, Surtir/Trasladar Inventario, Cargar Orden/Comanda a Caja y Facturar.
 */
export function renderRelationalHubActionsRuntimeJs(): string {
  return `
  function pkPrintHtmlDocument(title, htmlContent) {
    var win = window.open('', '_blank', 'width=840,height=700');
    if (!win) { pkToast('Permite ventanas emergentes para imprimir.'); return; }
    win.document.write('<html><head><title>' + pkEsc(title) + '</title>' +
      '<style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:12px}th{background:#f1f5f9}.head{display:flex;justify-content:space-between;border-bottom:2px solid #1d4ed8;padding-bottom:12px;margin-bottom:14px}</style>' +
      '</head><body>' + htmlContent + '<script>setTimeout(function(){window.print();},350);<\\/script></body></html>');
    win.document.close();
  }

  function pkCloseRelModal() {
    var m = document.getElementById('pk-relational-modal');
    if (m) m.classList.remove('open');
  }

  function pkHandleRelationalHubClick(target) {
    var db = STATE.relDb;
    if (!db) return false;

    if (target.closest('#btn-close-rel-modal')) { pkCloseRelModal(); return true; }
    if (target.closest('[data-open-new-customer-modal]')) { pkOpenNewCustomerModal(); return true; }

    if (target.closest('#btn-modal-save-customer')) {
      var dType = (document.getElementById('modal-cust-doctype') || {}).value || 'CC';
      var nitVal = ((document.getElementById('modal-cust-nit') || {}).value || ('901' + String(Date.now()).slice(-6))).trim();
      var nameVal = ((document.getElementById('modal-cust-name') || {}).value || '').trim();
      if (!nameVal) { pkToast('Escribe el nombre del cliente.'); return true; }
      var phoneVal = ((document.getElementById('modal-cust-phone') || {}).value || '3001234567').trim();
      var emailVal = ((document.getElementById('modal-cust-email') || {}).value || 'cliente@correo.com').trim();
      var addrVal = ((document.getElementById('modal-cust-address') || {}).value || 'Ciudad Principal').trim();
      var cntId = (document.getElementById('modal-cust-contract') || {}).value || 'cnt-particular';
      var trfId = (document.getElementById('modal-cust-tariff') || {}).value || 'trf-plena';
      var credLim = Number((document.getElementById('modal-cust-credit') || {}).value || 2000000);
      var newCId = 'cust-' + Date.now();
      db.customers.unshift({ id: newCId, docType: dType, nit: nitVal, dv: dType === 'NIT' ? '4' : '', name: nameVal, businessType: dType === 'NIT' ? 'Jurídica' : 'Natural', taxRegime: dType === 'NIT' ? 'Responsable de IVA' : 'No Responsable', phone: phoneVal, email: emailVal, city: addrVal.split('—')[0].trim(), address: addrVal, contractId: cntId, tariffId: trfId, creditLimit: credLim, currentDebt: 0 });
      STATE.posCustomerId = newCId;
      pkPersistRelationalTx('CREATE_CUSTOMER', { id: newCId, name: nameVal });
      pkCloseRelModal(); pkRenderWorkstation(); pkToast('Cliente registrado y seleccionado: ' + nameVal);
      return true;
    }

    var restockOpen = target.closest('[data-open-restock-modal]');
    if (restockOpen) { pkOpenRestockModal(restockOpen.getAttribute('data-open-restock-modal')); return true; }

    var restockConf = target.closest('[data-confirm-restock-id]');
    if (restockConf) {
      var prR = pkFindById(db.products, restockConf.getAttribute('data-confirm-restock-id'));
      if (prR) {
        var qIn = Math.max(1, Number((document.getElementById('modal-restock-qty') || {}).value || 10));
        var cIn = Math.max(100, Number((document.getElementById('modal-restock-cost') || {}).value || prR.costPrice));
        var sIn = Math.max(cIn, Number((document.getElementById('modal-restock-sale') || {}).value || prR.salePrice));
        var supIn = (document.getElementById('modal-restock-sup') || {}).value || prR.supplierId;
        var refIn = ((document.getElementById('modal-restock-ref') || {}).value || 'ENTRADA-INV').trim();
        prR.stock = Number(prR.stock || 0) + qIn; prR.costPrice = cIn; prR.salePrice = sIn; prR.supplierId = supIn;
        db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: prR.id, productName: prR.name, warehouseId: prR.warehouseId, movementType: 'ENTRADA_COMPRA', qty: qIn, unitCost: cIn, balanceAfter: prR.stock, referenceDoc: refIn, actor: 'Inventario' });
        pkPersistRelationalTx('PURCHASE_ENTRY', { productCode: prR.code, productName: prR.name, costPrice: cIn, salePrice: sIn, stock: prR.stock });
        pkCloseRelModal(); pkRenderWorkstation(); pkToast('Se agregaron +' + qIn + ' unidades a ' + prR.name);
      }
      return true;
    }

    var trfOpen = target.closest('[data-open-transfer-modal]');
    if (trfOpen) { pkOpenTransferModal(trfOpen.getAttribute('data-open-transfer-modal')); return true; }

    var trfConf = target.closest('[data-confirm-transfer-id]');
    if (trfConf) {
      var prT = pkFindById(db.products, trfConf.getAttribute('data-confirm-transfer-id'));
      if (prT) {
        var whDest = (document.getElementById('modal-transfer-wh') || {}).value || prT.warehouseId;
        var qTrf = Math.max(1, Number((document.getElementById('modal-transfer-qty') || {}).value || 1));
        var ntTrf = ((document.getElementById('modal-transfer-note') || {}).value || 'Traslado').trim();
        prT.warehouseId = whDest;
        db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: prT.id, productName: prT.name, warehouseId: whDest, movementType: 'TRASLADO_BODEGA', qty: qTrf, unitCost: prT.costPrice, balanceAfter: prT.stock, referenceDoc: ntTrf, actor: 'Bodega' });
        pkCloseRelModal(); pkRenderWorkstation(); pkToast('Producto trasladado a la bodega seleccionada.');
      }
      return true;
    }

    var c360 = target.closest('[data-open-customer-360]');
    if (c360) { pkOpenCustomer360Modal(c360.getAttribute('data-open-customer-360')); return true; }
    var v360 = target.closest('[data-open-vehicle-360]');
    if (v360) { pkOpenVehicle360Modal(v360.getAttribute('data-open-vehicle-360')); return true; }
    var abOpen = target.closest('[data-open-abono-modal]');
    if (abOpen) { pkOpenAbonoModal(abOpen.getAttribute('data-open-abono-modal')); return true; }
    var invOpen = target.closest('[data-open-invoice-modal]');
    if (invOpen) { pkOpenInvoiceModal(invOpen.getAttribute('data-open-invoice-modal')); return true; }

    var goCustPos = target.closest('[data-pos-select-cust-go]');
    if (goCustPos) {
      STATE.posCustomerId = goCustPos.getAttribute('data-pos-select-cust-go');
      STATE.posVehicleId = ''; STATE.activeServiceKey = 'srv-invoicing'; STATE.activeSubmoduleKey = 'mod-pos'; pkRenderWorkstation(); return true;
    }

    var loadOrd = target.closest('[data-pos-load-order]');
    if (loadOrd) {
      var wo = pkFindById(db.workOrders, loadOrd.getAttribute('data-pos-load-order'));
      if (wo) {
        STATE.posCustomerId = wo.customerId; STATE.posVehicleId = wo.vehicleId; STATE.posLinkedOrderId = wo.id; STATE.posCart = [];
        for (var s = 0; s < (wo.services || []).length; s++) {
          STATE.posCart.push({ kind: 'SERVICIO', refId: wo.id, code: 'OT-SRV', name: wo.services[s].description + ' (Placa ' + wo.plate + ')', qty: 1, price: Number(wo.services[s].price || 0), taxPct: 0, workerId: wo.workerId, workerName: wo.workerName });
        }
        STATE.activeServiceKey = 'srv-invoicing'; STATE.activeSubmoduleKey = 'mod-pos'; pkRenderWorkstation();
        pkToast('Orden ' + wo.id + ' (' + wo.plate + ') lista para cobrar en Caja.');
      }
      return true;
    }

    var loadTbl = target.closest('[data-pos-load-table]');
    if (loadTbl) {
      var tbl = pkFindById(db.diningTables, loadTbl.getAttribute('data-pos-load-table'));
      if (tbl) {
        if (!tbl.items || tbl.items.length === 0) { pkToast('Agrega primero platos o bebidas a la comanda de ' + tbl.name); return true; }
        STATE.posLinkedTableId = tbl.id; STATE.posCart = [];
        for (var ti = 0; ti < tbl.items.length; ti++) {
          STATE.posCart.push({ kind: 'PRODUCTO', refId: tbl.items[ti].productId, code: 'MESA', name: tbl.items[ti].name + ' (' + tbl.name + ')', qty: tbl.items[ti].qty, price: tbl.items[ti].price, taxPct: 8 });
        }
        STATE.activeServiceKey = 'srv-invoicing'; STATE.activeSubmoduleKey = 'mod-pos'; pkRenderWorkstation();
        pkToast('Cuenta de ' + tbl.name + ' cargada en Caja para facturar.');
      }
      return true;
    }

    if (target.closest('#btn-pos-add-product')) {
      var skuVal = ((document.getElementById('pos-sku-input') || {}).value || '').trim().toUpperCase();
      var selProdId = (document.getElementById('pos-select-product') || {}).value;
      var qtyP = Math.max(1, Number((document.getElementById('pos-product-qty') || {}).value || 1));
      var prod = null;
      if (skuVal) {
        for (var pi = 0; pi < db.products.length; pi++) if (db.products[pi].code.toUpperCase() === skuVal) { prod = db.products[pi]; break; }
      }
      if (!prod) prod = pkFindById(db.products, selProdId) || db.products[0];
      if (prod) {
        STATE.posCart.push({ kind: 'PRODUCTO', refId: prod.id, code: prod.code, name: prod.name, qty: qtyP, price: prod.salePrice, taxPct: prod.taxPct || 19 });
        pkRenderWorkstation(); pkToast('Agregado: ' + prod.name);
      }
      return true;
    }

    if (target.closest('#btn-pos-add-service')) {
      var sDesc = ((document.getElementById('pos-service-desc') || {}).value || '').trim() || 'Mano de Obra / Servicio';
      var sPrice = Math.max(1000, Number((document.getElementById('pos-service-price') || {}).value || 65000));
      var wkObj = pkFindById(db.workers, (document.getElementById('pos-select-worker') || {}).value) || db.workers[0];
      STATE.posCart.push({ kind: 'SERVICIO', refId: 'SRV-' + Date.now(), code: 'MO', name: sDesc, qty: 1, price: sPrice, taxPct: 0, workerId: wkObj ? wkObj.id : '', workerName: wkObj ? wkObj.name : 'Técnico' });
      pkRenderWorkstation(); pkToast('Servicio agregado al carrito.');
      return true;
    }

    var qDelta = target.closest('[data-pos-qty-delta]');
    if (qDelta) {
      var idxQ = Number(qDelta.getAttribute('data-pos-idx'));
      if (STATE.posCart[idxQ]) { STATE.posCart[idxQ].qty = Math.max(1, STATE.posCart[idxQ].qty + Number(qDelta.getAttribute('data-pos-qty-delta'))); pkRenderWorkstation(); }
      return true;
    }

    var delCart = target.closest('[data-pos-del-idx]');
    if (delCart) { STATE.posCart.splice(Number(delCart.getAttribute('data-pos-del-idx')), 1); pkRenderWorkstation(); return true; }

    return pkHandleSecondaryHubActions(target, db);
  }
`;
}
