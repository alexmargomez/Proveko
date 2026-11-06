/**
 * Controlador de Acciones Operativas Secundarias (Facturación, Taller, Cartera, Caja,
 * Liquidación de Técnicos, Impresión y Exportación <= 200 líneas).
 */
export function renderRelationalHubSecondaryActionsRuntimeJs(): string {
  return `
  function pkHandleSecondaryHubActions(target, db) {
    if (pkHandleGastroAndInventoryActions(target, db)) return true;

    if (target.closest('#btn-pos-checkout-invoice')) {
      if (STATE.posCart.length === 0) { pkToast('Agrega al menos un producto o servicio para facturar.'); return true; }
      var cust = pkFindById(db.customers, STATE.posCustomerId) || db.customers[0];
      var veh = pkFindById(db.vehicles, STATE.posVehicleId);
      var contract = cust && cust.contractId ? pkFindById(db.contracts, cust.contractId) : null;
      var tariff = cust && cust.tariffId ? pkFindById(db.tariffs, cust.tariffId) : null;
      var discPct = tariff ? Number(tariff.discountPct || 0) : 0;
      var subT = 0; var discT = 0; var taxT = 0;
      for (var c = 0; c < STATE.posCart.length; c++) {
        var item = STATE.posCart[c]; var gross = item.price * item.qty; var disc = Math.round(gross * (discPct / 100)); var net = gross - disc;
        subT += gross; discT += disc; taxT += Math.round(net * (Number(item.taxPct || 0) / 100));
        if (item.kind === 'PRODUCTO') {
          var prObj = pkFindById(db.products, item.refId);
          if (prObj) { prObj.stock = Math.max(0, Number(prObj.stock || 0) - item.qty); db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: prObj.id, productName: prObj.name, warehouseId: prObj.warehouseId, movementType: 'SALIDA_VENTA', qty: -item.qty, unitCost: prObj.costPrice, balanceAfter: prObj.stock, referenceDoc: 'POS-FACT', actor: cust ? cust.name : 'Caja' }); }
        } else if (item.kind === 'SERVICIO' && item.workerId) {
          var wkTarget = pkFindById(db.workers, item.workerId); if (wkTarget) wkTarget.totalDayGross = Number(wkTarget.totalDayGross || 0) + net;
        }
      }
      var totalNet = subT - discT + taxT;
      var payMethod = (document.getElementById('pos-payment-method') || {}).value || STATE.posPaymentMethod || 'Efectivo';
      var cashInputVal = Number((document.getElementById('pos-cash-received') || {}).value || 0);
      var isCredit = payMethod.indexOf('Crédito') !== -1;
      var paidNow = isCredit ? Math.min(totalNet, Math.max(0, cashInputVal)) : totalNet;
      var pendingBal = isCredit ? Math.max(0, totalNet - paidNow) : 0;
      if (contract) { contract.consumedAmount += totalNet; contract.availableBalance = Math.max(0, contract.budgetCeiling - contract.consumedAmount); }
      if (cust && pendingBal > 0) cust.currentDebt = Number(cust.currentDebt || 0) + pendingBal;
      if (STATE.posLinkedOrderId) { var linkedWo = pkFindById(db.workOrders, STATE.posLinkedOrderId); if (linkedWo) linkedWo.status = 'Facturado'; STATE.posLinkedOrderId = ''; }
      if (STATE.posLinkedTableId) { var linkedTb = pkFindById(db.diningTables, STATE.posLinkedTableId); if (linkedTb) { linkedTb.status = 'Libre'; linkedTb.items = []; linkedTb.total = 0; linkedTb.diners = 0; } STATE.posLinkedTableId = ''; }
      var invId = 'FEVP-' + (9011 + db.invoices.length);
      db.invoices.unshift({ id: invId, cufe: 'CUFE-' + Date.now(), date: new Date().toISOString().slice(0, 16).replace('T', ' '), customerId: cust ? cust.id : 'cust-1', customerName: cust ? cust.name : 'Consumidor Final', customerNit: cust ? cust.nit : '222222222222', contractId: contract ? contract.id : '', vehicleId: veh ? veh.id : '', plate: veh ? veh.plate : 'MOSTRADOR', items: STATE.posCart.slice(), subtotal: subT, discountTotal: discT, taxTotal: taxT, total: totalNet, paymentMethod: payMethod, amountPaid: paidNow, pendingBalance: pendingBal, status: pendingBal > 0 ? 'Pendiente CxC' : 'Pagada', glosaStatus: 'Sin Glosa', abonosHistory: paidNow > 0 ? [{ id: 'RC-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 10), amount: paidNow, method: payMethod, note: 'Pago en Caja' }] : [] });
      STATE.posCart = []; pkPersistRelationalTx('CREATE_INVOICE', { invoiceId: invId, total: totalNet }); pkRenderWorkstation(); pkToast('Factura ' + invId + ' emitida con éxito.');
      return true;
    }

    if (target.closest('#btn-pos-print-quote')) {
      var custQ = pkFindById(db.customers, STATE.posCustomerId) || db.customers[0];
      var rowsQ = ''; var sumQ = 0;
      for (var q = 0; q < STATE.posCart.length; q++) { var itQ = STATE.posCart[q]; var subQ = itQ.qty * itQ.price; sumQ += subQ; rowsQ += '<tr><td>' + pkEsc(itQ.kind) + '</td><td>' + pkEsc(itQ.name) + '</td><td>' + itQ.qty + '</td><td>' + pkCop(itQ.price) + '</td><td>' + pkCop(subQ) + '</td></tr>'; }
      pkPrintHtmlDocument('Cotización Formal', '<div class="head"><div><h2>COTIZACIÓN COMERCIAL</h2></div><div><strong>Cliente:</strong> ' + pkEsc(custQ ? custQ.name : '') + '<br/><strong>NIT/CC:</strong> ' + pkEsc(custQ ? custQ.nit : '') + '</div></div><table><thead><tr><th>Tipo</th><th>Concepto</th><th>Cant.</th><th>Vlr. Unit</th><th>Subtotal</th></tr></thead><tbody>' + rowsQ + '</tbody></table><h3 style="text-align:right;margin-top:16px">Total Cotizado: ' + pkCop(sumQ) + '</h3>');
      return true;
    }
    var prInv = target.closest('[data-print-invoice]');
    if (prInv) {
      var invP = pkFindById(db.invoices, prInv.getAttribute('data-print-invoice'));
      if (invP) {
        var rowsI = '';
        for (var ii = 0; ii < (invP.items || []).length; ii++) { var itI = invP.items[ii]; rowsI += '<tr><td>' + pkEsc(itI.kind) + '</td><td>' + pkEsc(itI.name) + '</td><td>' + itI.qty + '</td><td>' + pkCop(itI.price) + '</td><td>' + pkCop(itI.qty * itI.price) + '</td></tr>'; }
        pkPrintHtmlDocument('Factura ' + invP.id, '<div class="head"><div><h2>FACTURA DE VENTA ' + pkEsc(invP.id) + '</h2></div><div><strong>Cliente:</strong> ' + pkEsc(invP.customerName) + '<br/><strong>NIT:</strong> ' + pkEsc(invP.customerNit) + '</div></div><table><thead><tr><th>Tipo</th><th>Descripción</th><th>Cant.</th><th>Vlr. Unit</th><th>Subtotal</th></tr></thead><tbody>' + rowsI + '</tbody></table><h3 style="text-align:right;margin-top:16px">Total: ' + pkCop(invP.total) + ' | Saldo Pendiente: ' + pkCop(invP.pendingBalance) + '</h3>');
      }
      return true;
    }
    if (target.closest('#btn-pos-whatsapp-quote')) {
      var custW = pkFindById(db.customers, STATE.posCustomerId) || db.customers[0];
      var phoneW = (custW && custW.phone ? custW.phone : '3001234567').replace(/\\D/g, '');
      var totalW = 0; for (var w = 0; w < STATE.posCart.length; w++) totalW += STATE.posCart[w].qty * STATE.posCart[w].price;
      window.open('https://wa.me/57' + phoneW + '?text=' + encodeURIComponent('Hola ' + (custW ? custW.name : '') + ', tu cotización es por valor de ' + pkCop(totalW) + '.'), '_blank');
      return true;
    }
    var woWa = target.closest('[data-wo-whatsapp]');
    if (woWa) {
      var ordW = pkFindById(db.workOrders, woWa.getAttribute('data-wo-whatsapp'));
      if (ordW) window.open('https://wa.me/573104558899?text=' + encodeURIComponent('Hola ' + ordW.customerName + ', tu vehículo placa ' + ordW.plate + ' está en estado: ' + ordW.status + '. Total: ' + pkCop(ordW.totalEstimated)), '_blank');
      return true;
    }
    var prHot = target.closest('[data-print-hotel-room]');
    if (prHot) {
      var rmP = pkFindById(db.hotelRooms, prHot.getAttribute('data-print-hotel-room'));
      if (rmP) { var stayT = (Number(rmP.nights || 1) * Number(rmP.nightlyRate || 0)) + Number(rmP.extrasTotal || 0); pkPrintHtmlDocument('Cuenta Hotelera ' + rmP.roomNumber, '<div class="head"><div><h2>REGISTRO Y ESTADO DE CUENTA HOTELERA</h2><div>' + pkEsc(rmP.roomNumber + ' — ' + rmP.roomType + ' (' + rmP.floor + ')') + '</div></div><div><strong>Estado:</strong> ' + pkEsc(rmP.status) + '<br/><strong>Fecha:</strong> ' + pkEsc(rmP.checkInDate || new Date().toISOString().slice(0, 10)) + '</div></div><table><thead><tr><th>Concepto</th><th>Huésped</th><th>Cant. Noches</th><th>Tarifa / Noche</th><th>Consumos Extra</th><th>Total</th></tr></thead><tbody><tr><td>Alojamiento y Servicios</td><td>' + pkEsc(rmP.guestName || 'Disponible') + '</td><td>' + (rmP.nights || 1) + '</td><td>' + pkCop(rmP.nightlyRate) + '</td><td>' + pkCop(rmP.extrasTotal || 0) + '</td><td><strong>' + pkCop(stayT) + '</strong></td></tr></tbody></table>'); }
      return true;
    }
    var prWo = target.closest('[data-print-wo]');
    if (prWo) { var woP = pkFindById(db.workOrders, prWo.getAttribute('data-print-wo')); if (woP) pkPrintHtmlDocument('Orden de Servicio ' + woP.id, '<div class="head"><div><h2>ORDEN DE TRABAJO ' + pkEsc(woP.id) + '</h2><div>Placa: <strong>' + pkEsc(woP.plate) + '</strong> · ' + pkEsc(woP.vehicleBrand) + '</div></div><div><strong>Cliente:</strong> ' + pkEsc(woP.customerName) + '<br/><strong>Técnico:</strong> ' + pkEsc(woP.workerName) + '</div></div><table><thead><tr><th>Estado</th><th>Km Ingreso</th><th>Próximo Cambio</th><th>Servicio Realizado</th><th>Total Estimado</th></tr></thead><tbody><tr><td>' + pkEsc(woP.status) + '</td><td>' + woP.currentKm + ' km</td><td>' + woP.nextOilKm + ' km</td><td>' + pkEsc((woP.services && woP.services[0]) ? woP.services[0].description : 'Mantenimiento') + '</td><td><strong>' + pkCop(woP.totalEstimated) + '</strong></td></tr></tbody></table>'); return true; }
    var prVeh = target.closest('[data-print-veh]');
    if (prVeh) { var vhP = pkFindById(db.vehicles, prVeh.getAttribute('data-print-veh')); if (vhP) pkPrintHtmlDocument('Ficha Vehículo ' + vhP.plate, '<div class="head"><div><h2>HOJA DE VIDA DE VEHÍCULO — ' + pkEsc(vhP.plate) + '</h2></div><div><strong>Propietario:</strong> ' + pkEsc(vhP.customerName) + '</div></div><table><thead><tr><th>Placa</th><th>Marca / Línea</th><th>Km Actual</th><th>Próx. Aceite</th><th>Venc. SOAT</th><th>Observaciones</th></tr></thead><tbody><tr><td>' + pkEsc(vhP.plate) + '</td><td>' + pkEsc(vhP.brand) + '</td><td>' + vhP.currentKm + ' km</td><td>' + vhP.nextOilChangeKm + ' km</td><td>' + pkEsc(vhP.soatExpiry) + '</td><td>' + pkEsc(vhP.notes) + '</td></tr></tbody></table>'); return true; }
    var prCust = target.closest('[data-print-customer]');
    if (prCust) { var csP = pkFindById(db.customers, prCust.getAttribute('data-print-customer')); if (csP) pkPrintHtmlDocument('Ficha Cliente ' + csP.name, '<div class="head"><div><h2>FICHA Y ESTADO DE CUENTA DE CLIENTE</h2></div><div><strong>Documento:</strong> ' + pkEsc(csP.docType + ' ' + csP.nit) + '</div></div><table><thead><tr><th>Cliente / Razón Social</th><th>Teléfono</th><th>Ciudad</th><th>Cupo Crédito</th><th>Saldo Pendiente CxC</th></tr></thead><tbody><tr><td>' + pkEsc(csP.name) + '</td><td>' + pkEsc(csP.phone) + '</td><td>' + pkEsc(csP.city) + '</td><td>' + pkCop(csP.creditLimit) + '</td><td><strong>' + pkCop(csP.currentDebt) + '</strong></td></tr></tbody></table>'); return true; }
    var prGst = target.closest('[data-print-gastro-table]');
    if (prGst) {
      var tbP = pkFindById(db.diningTables, prGst.getAttribute('data-print-gastro-table'));
      if (tbP) { var rG = ''; for (var gi = 0; gi < (tbP.items || []).length; gi++) { var itG = tbP.items[gi]; rG += '<tr><td>' + pkEsc(itG.name) + '</td><td>' + itG.qty + '</td><td>' + pkEsc(itG.note || 'Estándar') + '</td><td>' + pkCop(itG.price) + '</td><td>' + pkCop(itG.qty * itG.price) + '</td></tr>'; } pkPrintHtmlDocument('Comanda ' + tbP.name, '<div class="head"><div><h2>PRECUENTA / COMANDA — ' + pkEsc(tbP.name) + '</h2></div><div><strong>Mesero:</strong> ' + pkEsc(tbP.waiter || 'Turno') + '</div></div><table><thead><tr><th>Plato / Bebida</th><th>Cant.</th><th>Preparación</th><th>Vlr. Unit</th><th>Subtotal</th></tr></thead><tbody>' + rG + '</tbody></table><h3 style="text-align:right;margin-top:14px">Total Mesa: ' + pkCop(tbP.total) + '</h3>'); }
      return true;
    }
    var prPrd = target.closest('[data-print-product]');
    if (prPrd) { var pdP = pkFindById(db.products, prPrd.getAttribute('data-print-product')); if (pdP) pkPrintHtmlDocument('Ficha Producto ' + pdP.code, '<div class="head"><div><h2>FICHA KARDEX DE PRODUCTO — ' + pkEsc(pdP.code) + '</h2></div></div><table><thead><tr><th>SKU</th><th>Producto</th><th>Costo</th><th>Precio Venta</th><th>Existencia Actual</th></tr></thead><tbody><tr><td>' + pkEsc(pdP.code) + '</td><td>' + pkEsc(pdP.name) + '</td><td>' + pkCop(pdP.costPrice) + '</td><td>' + pkCop(pdP.salePrice) + '</td><td><strong>' + pdP.stock + ' und</strong></td></tr></tbody></table>'); return true; }
    if (target.closest('#btn-print-inventory-all')) {
      var rInvAll = ''; for (var ia = 0; ia < db.products.length; ia++) { var pa = db.products[ia]; rInvAll += '<tr><td>' + pkEsc(pa.code) + '</td><td>' + pkEsc(pa.name) + '</td><td>' + pkCop(pa.costPrice) + '</td><td>' + pkCop(pa.salePrice) + '</td><td>' + pa.stock + ' und</td></tr>'; }
      pkPrintHtmlDocument('Inventario General Valorizado', '<div class="head"><div><h2>REPORTE DE INVENTARIO VALORIZADO</h2></div><div><strong>Total Referencias:</strong> ' + db.products.length + '</div></div><table><thead><tr><th>Código</th><th>Producto</th><th>Costo</th><th>Precio Venta</th><th>Stock</th></tr></thead><tbody>' + rInvAll + '</tbody></table>'); return true;
    }
    if (target.closest('#btn-print-cashbox') || target.closest('[data-print-expense]') || target.closest('[data-print-contract]') || target.closest('[data-print-supplier]') || target.closest('[data-print-worker]')) {
      var mCash = pkComputeCashMetrics(db); pkPrintHtmlDocument('Comprobante Operativo / Arqueo', '<div class="head"><div><h2>COMPROBANTE OFICIAL Y ARQUEO DE OPERACIÓN</h2></div><div><strong>Fecha:</strong> ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '</div></div><table><thead><tr><th>Total Facturado</th><th>Efectivo Neto en Caja</th><th>Pagos Digitales</th><th>Total Gastos</th><th>Cartera CxC</th></tr></thead><tbody><tr><td>' + pkCop(mCash.totalInvoiced) + '</td><td><strong>' + pkCop(mCash.netCash) + '</strong></td><td>' + pkCop(mCash.digitalIn) + '</td><td>-' + pkCop(mCash.totalExpenses) + '</td><td>' + pkCop(mCash.totalCxc) + '</td></tr></tbody></table>'); return true;
    }
    var stdPrRow = target.closest('[data-std-print-idx]');
    if (stdPrRow) {
      var rIdx = Number(stdPrRow.getAttribute('data-std-print-idx')); var rowsList = STATE.submoduleRows[STATE.activeSubmoduleKey] || []; var rData = rowsList[rIdx];
      if (rData) { var bodyCells = ''; for (var rc = 0; rc < rData.length; rc++) bodyCells += '<td>' + pkEsc(rData[rc]) + '</td>'; pkPrintHtmlDocument('Comprobante ' + rData[0], '<div class="head"><div><h2>COMPROBANTE OFICIAL DE REGISTRO — ' + pkEsc(rData[0]) + '</h2></div><div><strong>Fecha Impresión:</strong> ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '</div></div><table><tbody><tr>' + bodyCells + '</tr></tbody></table>'); }
      return true;
    }
    if (target.closest('#btn-std-print-table')) { var tblEl = document.querySelector('#ws-module-stage table'); pkPrintHtmlDocument('Listado Oficial de Módulo', '<div class="head"><div><h2>REPORTE IMPRESO DE MÓDULO</h2></div><div><strong>Fecha:</strong> ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + '</div></div>' + (tblEl ? tblEl.outerHTML : '')); return true; }
    if (target.closest('#btn-wo-suggest-oil')) { var curKm = Number((document.getElementById('wo-current-km') || {}).value || 45000); var nextEl = document.getElementById('wo-next-oil-km'); if (nextEl) nextEl.value = String(curKm + 3000); pkToast('Próximo cambio sugerido a los ' + (curKm + 3000).toLocaleString('es-CO') + ' km.'); return true; }
    if (target.closest('#btn-wo-create-order')) {
      var custObj = pkFindById(db.customers, (document.getElementById('wo-customer-id') || {}).value) || db.customers[0];
      var plate = ((document.getElementById('wo-plate') || {}).value || 'ABC-123').trim().toUpperCase();
      var curK = Number((document.getElementById('wo-current-km') || {}).value || 45000);
      var nxtK = Number((document.getElementById('wo-next-oil-km') || {}).value || (curK + 3000));
      var wkObj = pkFindById(db.workers, (document.getElementById('wo-worker-id') || {}).value) || db.workers[0];
      var rawSvc = ((document.getElementById('wo-service-desc') || {}).value || 'Mantenimiento Preventivo|140000');
      var sDesc = rawSvc.split('|')[0];
      var sPrc = Number((document.getElementById('wo-service-price') || {}).value || rawSvc.split('|')[1] || 140000);
      var vehObj = null;
      for (var v = 0; v < db.vehicles.length; v++) if (db.vehicles[v].plate.toUpperCase() === plate) { vehObj = db.vehicles[v]; break; }
      var brand = vehObj ? vehObj.brand : 'Vehículo Registrado';
      if (vehObj) { vehObj.currentKm = curK; vehObj.nextOilChangeKm = nxtK; }
      var newWoId = 'OT-' + (3043 + db.workOrders.length);
      db.workOrders.unshift({ id: newWoId, createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '), customerId: custObj ? custObj.id : 'cust-1', customerName: custObj ? custObj.name : 'Cliente', vehicleId: vehObj ? vehObj.id : 'veh-1', plate: plate, vehicleBrand: brand, currentKm: curK, nextOilKm: nxtK, workerId: wkObj ? wkObj.id : 'wk-1', workerName: wkObj ? wkObj.name : 'Técnico', status: 'Recibido', services: [{ description: sDesc, price: sPrc }], totalEstimated: sPrc });
      pkPersistRelationalTx('CREATE_WORK_ORDER', { orderId: newWoId, plate: plate }); pkRenderWorkstation(); pkToast('Orden ' + newWoId + ' (' + plate + ') registrada.'); return true;
    }
    var woMove = target.closest('[data-wo-move]');
    if (woMove) {
      var ordM = pkFindById(db.workOrders, woMove.getAttribute('data-wo-move'));
      var nextStg = woMove.getAttribute('data-wo-stage');
      if (ordM && nextStg) { ordM.status = nextStg; pkPersistRelationalTx('MOVE_WORK_ORDER', { orderId: ordM.id, stage: nextStg }); pkRenderWorkstation(); pkToast('Orden ' + ordM.id + ' pasada a: ' + nextStg); }
      return true;
    }
    var invDelta = target.closest('[data-inv-delta]');
    if (invDelta) {
      var prD = pkFindById(db.products, invDelta.getAttribute('data-inv-id'));
      var dStock = Number(invDelta.getAttribute('data-inv-delta'));
      if (prD) {
        prD.stock = Math.max(0, Number(prD.stock || 0) + dStock);
        db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: prD.id, productName: prD.name, warehouseId: prD.warehouseId, movementType: dStock > 0 ? 'ENTRADA_RAPIDA' : 'SALIDA_RAPIDA', qty: dStock, unitCost: prD.costPrice, balanceAfter: prD.stock, referenceDoc: 'AJUSTE', actor: 'Operador' });
        pkPersistRelationalTx('ADJUST_STOCK', { productId: prD.id, stock: prD.stock }); pkRenderWorkstation();
      }
      return true;
    }
    if (target.closest('#btn-inv-register-purchase')) {
      var pSel = (document.getElementById('inv-entry-product-id') || {}).value;
      var supId = (document.getElementById('inv-entry-supplier-id') || {}).value;
      var whId = (document.getElementById('inv-entry-warehouse-id') || {}).value;
      var refDoc = ((document.getElementById('inv-entry-invoice-ref') || {}).value || 'FAC-COMPRA').trim();
      var qtyIn = Math.max(1, Number((document.getElementById('inv-entry-qty') || {}).value || 10));
      var costIn = Math.max(100, Number((document.getElementById('inv-entry-cost') || {}).value || 35000));
      var saleIn = Math.max(costIn, Number((document.getElementById('inv-entry-sale') || {}).value || 58000));
      var targetProd = pkFindById(db.products, pSel) || db.products[0];
      if (targetProd) {
        targetProd.stock = Number(targetProd.stock || 0) + qtyIn; targetProd.costPrice = costIn; targetProd.salePrice = saleIn; targetProd.warehouseId = whId; targetProd.supplierId = supId;
        db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: targetProd.id, productName: targetProd.name, warehouseId: whId, movementType: 'ENTRADA_COMPRA', qty: qtyIn, unitCost: costIn, balanceAfter: targetProd.stock, referenceDoc: refDoc, actor: 'Compras' });
        pkPersistRelationalTx('PURCHASE_ENTRY', { productCode: targetProd.code, productName: targetProd.name, costPrice: costIn, salePrice: saleIn, stock: targetProd.stock });
        pkRenderWorkstation(); pkToast('Compra ingresada: +' + qtyIn + ' und a ' + targetProd.name);
      }
      return true;
    }
    var abConf = target.closest('[data-confirm-abono-inv]');
    if (abConf) {
      var invAb = pkFindById(db.invoices, abConf.getAttribute('data-confirm-abono-inv'));
      if (invAb) {
        var amt = Math.min(invAb.pendingBalance, Math.max(1000, Number((document.getElementById('modal-abono-amount') || {}).value || invAb.pendingBalance)));
        var mth = (document.getElementById('modal-abono-method') || {}).value || 'Efectivo';
        var nt = ((document.getElementById('modal-abono-note') || {}).value || 'Abono').trim();
        invAb.amountPaid = Number(invAb.amountPaid || 0) + amt; invAb.pendingBalance = Math.max(0, Number(invAb.pendingBalance || 0) - amt);
        invAb.status = invAb.pendingBalance === 0 ? 'Pagada' : 'Pendiente CxC';
        if (!invAb.abonosHistory) invAb.abonosHistory = [];
        invAb.abonosHistory.unshift({ id: 'RC-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 10), amount: amt, method: mth, note: nt });
        var custAb = pkFindById(db.customers, invAb.customerId); if (custAb) custAb.currentDebt = Math.max(0, Number(custAb.currentDebt || 0) - amt);
        pkPersistRelationalTx('REGISTER_ABONO', { invoiceId: invAb.id, amount: amt }); pkOpenAbonoModal(invAb.id); pkRenderWorkstation(); pkToast('Abono por ' + pkCop(amt) + ' registrado.');
      }
      return true;
    }
    return false;
  }
`;
}
