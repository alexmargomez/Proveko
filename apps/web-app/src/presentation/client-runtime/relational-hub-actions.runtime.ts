/**
 * Controlador de Transacciones Relacionales Primarias (SOLID SRP <= 200 líneas):
 * POS Híbrido <-> Inventario/Kardex <-> Kanban Taller <-> Comisiones Técnicos <-> Contratos v2 <-> Cartera CxC.
 */
export function renderRelationalHubActionsRuntimeJs(): string {
  return `
  function pkPrintHtmlDocument(title, htmlContent) {
    var win = window.open('', '_blank', 'width=840,height=700');
    if (!win) { pkToast('Permite ventanas emergentes para imprimir el PDF.'); return; }
    win.document.write('<html><head><title>' + pkEsc(title) + '</title>' +
      '<style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#0f172a}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:12px}th{background:#f1f5f9}.head{display:flex;justify-content:space-between;border-bottom:2px solid #1d4ed8;padding-bottom:12px;margin-bottom:14px}</style>' +
      '</head><body>' + htmlContent + '<script>setTimeout(function(){window.print();},350);<\\/script></body></html>');
    win.document.close();
  }

  function pkHandleRelationalHubClick(target) {
    var db = STATE.relDb;
    if (!db) return false;

    if (target.closest('#btn-close-rel-modal')) {
      var m = document.getElementById('pk-relational-modal'); if (m) m.classList.remove('open'); return true;
    }
    var hubBtn = target.closest('[data-ws-hub]');
    if (hubBtn) { STATE.activeConvergedHub = hubBtn.getAttribute('data-ws-hub'); pkRenderWorkstation(); return true; }

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
      STATE.posVehicleId = ''; STATE.activeConvergedHub = 'pos'; pkRenderWorkstation(); return true;
    }

    var loadOrd = target.closest('[data-pos-load-order]');
    if (loadOrd) {
      var wo = pkFindById(db.workOrders, loadOrd.getAttribute('data-pos-load-order'));
      if (wo) {
        STATE.posCustomerId = wo.customerId; STATE.posVehicleId = wo.vehicleId; STATE.posLinkedOrderId = wo.id; STATE.posCart = [];
        for (var s = 0; s < (wo.services || []).length; s++) {
          STATE.posCart.push({ kind: 'SERVICIO', refId: wo.id, code: 'OT-SRV', name: wo.services[s].description + ' (Placa ' + wo.plate + ')', qty: 1, price: Number(wo.services[s].price || 0), taxPct: 0, workerId: wo.workerId, workerName: wo.workerName });
        }
        STATE.activeConvergedHub = 'pos'; pkRenderWorkstation();
        pkToast('Orden Kanban ' + wo.id + ' (' + wo.plate + ') cargada al carrito de Caja POS.');
      }
      return true;
    }

    var loadTbl = target.closest('[data-pos-load-table]');
    if (loadTbl) {
      var tbl = pkFindById(db.diningTables, loadTbl.getAttribute('data-pos-load-table'));
      if (tbl) {
        STATE.posLinkedTableId = tbl.id; STATE.posCart = [];
        for (var ti = 0; ti < tbl.items.length; ti++) {
          STATE.posCart.push({ kind: 'PRODUCTO', refId: tbl.items[ti].productId, code: 'MESA', name: tbl.items[ti].name + ' (' + tbl.name + ')', qty: tbl.items[ti].qty, price: tbl.items[ti].price, taxPct: 8 });
        }
        STATE.activeConvergedHub = 'pos'; pkRenderWorkstation();
        pkToast(tbl.name + ' cargada en Caja POS para cobro.');
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
        pkRenderWorkstation(); pkToast('Producto agregado: ' + prod.name);
      }
      return true;
    }

    if (target.closest('#btn-pos-add-service')) {
      var sDesc = ((document.getElementById('pos-service-desc') || {}).value || '').trim() || 'Mano de Obra Especializada';
      var sPrice = Math.max(1000, Number((document.getElementById('pos-service-price') || {}).value || 65000));
      var wkObj = pkFindById(db.workers, (document.getElementById('pos-select-worker') || {}).value) || db.workers[0];
      STATE.posCart.push({ kind: 'SERVICIO', refId: 'SRV-' + Date.now(), code: 'MO', name: sDesc, qty: 1, price: sPrice, taxPct: 0, workerId: wkObj ? wkObj.id : '', workerName: wkObj ? wkObj.name : 'Técnico' });
      pkRenderWorkstation(); pkToast('Mano de obra enlazada al técnico ' + (wkObj ? wkObj.name : ''));
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

    if (target.closest('#btn-pos-checkout-invoice')) {
      if (STATE.posCart.length === 0) { pkToast('Agrega al menos un producto o servicio al carrito.'); return true; }
      var cust = pkFindById(db.customers, STATE.posCustomerId) || db.customers[0];
      var veh = pkFindById(db.vehicles, STATE.posVehicleId);
      var contract = cust && cust.contractId ? pkFindById(db.contracts, cust.contractId) : null;
      var tariff = cust && cust.tariffId ? pkFindById(db.tariffs, cust.tariffId) : null;
      var discPct = tariff ? Number(tariff.discountPct || 0) : 0;

      var subT = 0; var discT = 0; var taxT = 0;
      for (var c = 0; c < STATE.posCart.length; c++) {
        var item = STATE.posCart[c];
        var gross = item.price * item.qty;
        var disc = Math.round(gross * (discPct / 100));
        var net = gross - disc;
        var tx = Math.round(net * (Number(item.taxPct || 0) / 100));
        subT += gross; discT += disc; taxT += tx;

        if (item.kind === 'PRODUCTO') {
          var prObj = pkFindById(db.products, item.refId);
          if (prObj) {
            prObj.stock = Math.max(0, Number(prObj.stock || 0) - item.qty);
            db.kardexMovements.unshift({
              id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '),
              productId: prObj.id, productName: prObj.name, warehouseId: prObj.warehouseId,
              movementType: 'SALIDA_VENTA', qty: -item.qty, unitCost: prObj.costPrice, balanceAfter: prObj.stock,
              referenceDoc: 'POS-FACT', actor: cust ? cust.name : 'Caja'
            });
          }
        } else if (item.kind === 'SERVICIO' && item.workerId) {
          var wkTarget = pkFindById(db.workers, item.workerId);
          if (wkTarget) wkTarget.totalDayGross = Number(wkTarget.totalDayGross || 0) + net;
        }
      }

      var totalNet = subT - discT + taxT;
      var payMethod = (document.getElementById('pos-payment-method') || {}).value || STATE.posPaymentMethod || 'Efectivo';
      var cashInputVal = Number((document.getElementById('pos-cash-received') || {}).value || 0);
      var isCredit = payMethod === 'Crédito / Cartera CxC';
      var paidNow = isCredit ? Math.min(totalNet, Math.max(0, cashInputVal)) : totalNet;
      var pendingBal = isCredit ? Math.max(0, totalNet - paidNow) : 0;

      if (contract) { contract.consumedAmount += totalNet; contract.availableBalance = Math.max(0, contract.budgetCeiling - contract.consumedAmount); }
      if (cust && pendingBal > 0) cust.currentDebt = Number(cust.currentDebt || 0) + pendingBal;
      if (STATE.posLinkedOrderId) { var linkedWo = pkFindById(db.workOrders, STATE.posLinkedOrderId); if (linkedWo) linkedWo.status = 'Facturado'; STATE.posLinkedOrderId = ''; }
      if (STATE.posLinkedTableId) { var linkedTb = pkFindById(db.diningTables, STATE.posLinkedTableId); if (linkedTb) { linkedTb.status = 'Libre'; linkedTb.items = []; linkedTb.total = 0; linkedTb.diners = 0; } STATE.posLinkedTableId = ''; }

      var invId = 'FEVP-' + (9011 + db.invoices.length);
      var newInv = {
        id: invId, cufe: 'CUFE-DIAN-' + Date.now(), date: new Date().toISOString().slice(0, 16).replace('T', ' '),
        customerId: cust ? cust.id : 'cust-1', customerName: cust ? cust.name : 'Consumidor Final',
        customerNit: cust ? cust.nit : '222222222222', contractId: contract ? contract.id : '',
        vehicleId: veh ? veh.id : '', plate: veh ? veh.plate : 'MOSTRADOR',
        items: STATE.posCart.slice(), subtotal: subT, discountTotal: discT, taxTotal: taxT, total: totalNet,
        paymentMethod: payMethod, amountPaid: paidNow, pendingBalance: pendingBal,
        status: pendingBal > 0 ? 'Pendiente CxC' : 'Pagada', glosaStatus: 'Sin Glosa',
        abonosHistory: paidNow > 0 ? [{ id: 'RC-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 10), amount: paidNow, method: payMethod, note: 'Pago inicial en Caja POS' }] : []
      };
      db.invoices.unshift(newInv); STATE.posCart = [];
      pkPersistRelationalTx('CREATE_INVOICE', { invoiceId: invId, customerName: newInv.customerName, total: totalNet });
      pkRenderWorkstation(); pkToast('Factura ' + invId + ' emitida: Stock descontado, Kardex asentado y comisiones actualizadas.');
      return true;
    }

    return pkHandleSecondaryHubActions(target, db);
  }
`;
}
