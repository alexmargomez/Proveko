/**
 * Controlador de Acciones Relacionales Secundarias (Kanban, Compras WMS, Abonos CxC,
 * Liquidación de Comisiones, Gastos Menores, Impresión PDF, WhatsApp y Exportación CSV <= 200 líneas).
 */
export function renderRelationalHubSecondaryActionsRuntimeJs(): string {
  return `
  function pkHandleSecondaryHubActions(target, db) {
    if (target.closest('#btn-pos-print-quote')) {
      var custQ = pkFindById(db.customers, STATE.posCustomerId) || db.customers[0];
      var rowsQ = ''; var sumQ = 0;
      for (var q = 0; q < STATE.posCart.length; q++) { var itQ = STATE.posCart[q]; var subQ = itQ.qty * itQ.price; sumQ += subQ; rowsQ += '<tr><td>' + pkEsc(itQ.kind) + '</td><td>' + pkEsc(itQ.name) + '</td><td>' + itQ.qty + '</td><td>' + pkCop(itQ.price) + '</td><td>' + pkCop(subQ) + '</td></tr>'; }
      pkPrintHtmlDocument('Cotización Formal Proveko', '<div class="head"><div><h2>COTIZACIÓN / PRESUPUESTO COMERCIAL</h2><div>No descuenta inventario · Validez: 15 días</div></div><div><strong>Cliente:</strong> ' + pkEsc(custQ ? custQ.name : '') + '<br/><strong>NIT/CC:</strong> ' + pkEsc(custQ ? custQ.nit : '') + '</div></div><table><thead><tr><th>Tipo</th><th>Concepto</th><th>Cant.</th><th>Vlr. Unit</th><th>Subtotal</th></tr></thead><tbody>' + rowsQ + '</tbody></table><h3 style="text-align:right;margin-top:16px">Total Cotizado: ' + pkCop(sumQ) + '</h3>');
      return true;
    }
    var prInv = target.closest('[data-print-invoice]');
    if (prInv) {
      var invP = pkFindById(db.invoices, prInv.getAttribute('data-print-invoice'));
      if (invP) {
        var rowsI = '';
        for (var ii = 0; ii < (invP.items || []).length; ii++) { var itI = invP.items[ii]; rowsI += '<tr><td>' + pkEsc(itI.kind) + '</td><td>' + pkEsc(itI.name) + '</td><td>' + itI.qty + '</td><td>' + pkCop(itI.price) + '</td><td>' + pkCop(itI.qty * itI.price) + '</td></tr>'; }
        pkPrintHtmlDocument('Factura ' + invP.id, '<div class="head"><div><h2>FACTURA ELECTRÓNICA DE VENTA ' + pkEsc(invP.id) + '</h2><div>CUFE: ' + pkEsc(invP.cufe) + '</div></div><div><strong>Cliente:</strong> ' + pkEsc(invP.customerName) + '<br/><strong>NIT:</strong> ' + pkEsc(invP.customerNit) + '<br/><strong>Placa:</strong> ' + pkEsc(invP.plate) + '</div></div><table><thead><tr><th>Tipo</th><th>Descripción</th><th>Cant.</th><th>Vlr. Unit</th><th>Subtotal</th></tr></thead><tbody>' + rowsI + '</tbody></table><h3 style="text-align:right;margin-top:16px">Total Factura: ' + pkCop(invP.total) + ' | Saldo CxC: ' + pkCop(invP.pendingBalance) + '</h3>');
      }
      return true;
    }
    if (target.closest('#btn-pos-whatsapp-quote')) {
      var custW = pkFindById(db.customers, STATE.posCustomerId) || db.customers[0];
      var phoneW = (custW && custW.phone ? custW.phone : '3001234567').replace(/\\D/g, '');
      var totalW = 0; for (var w = 0; w < STATE.posCart.length; w++) totalW += STATE.posCart[w].qty * STATE.posCart[w].price;
      window.open('https://wa.me/57' + phoneW + '?text=' + encodeURIComponent('Hola ' + (custW ? custW.name : '') + ', te compartimos tu cotización en Proveko por valor de ' + pkCop(totalW) + '.'), '_blank');
      return true;
    }
    var woWa = target.closest('[data-wo-whatsapp]');
    if (woWa) {
      var ordW = pkFindById(db.workOrders, woWa.getAttribute('data-wo-whatsapp'));
      if (ordW) window.open('https://wa.me/573104558899?text=' + encodeURIComponent('Hola ' + ordW.customerName + ', tu vehículo placa ' + ordW.plate + ' (' + ordW.vehicleBrand + ') está en estado: ' + ordW.status + '. Total estimado: ' + pkCop(ordW.totalEstimated)), '_blank');
      return true;
    }
    if (target.closest('#btn-wo-suggest-oil')) {
      var curKm = Number((document.getElementById('wo-current-km') || {}).value || 45000);
      var nextEl = document.getElementById('wo-next-oil-km'); if (nextEl) nextEl.value = String(curKm + 3000);
      pkToast('Próximo cambio de aceite sugerido a los ' + (curKm + 3000).toLocaleString('es-CO') + ' km.');
      return true;
    }
    if (target.closest('#btn-wo-create-order')) {
      var custObj = pkFindById(db.customers, (document.getElementById('wo-customer-id') || {}).value) || db.customers[0];
      var plate = ((document.getElementById('wo-plate') || {}).value || 'NEW-001').trim().toUpperCase();
      var brand = ((document.getElementById('wo-brand') || {}).value || 'Vehículo / Activo').trim();
      var curK = Number((document.getElementById('wo-current-km') || {}).value || 45000);
      var nxtK = Number((document.getElementById('wo-next-oil-km') || {}).value || (curK + 3000));
      var soatD = (document.getElementById('wo-soat-date') || {}).value || '2026-12-31';
      var wkObj = pkFindById(db.workers, (document.getElementById('wo-worker-id') || {}).value) || db.workers[0];
      var sDesc = ((document.getElementById('wo-service-desc') || {}).value || 'Diagnóstico y Mantenimiento General').trim();
      var sPrc = Number((document.getElementById('wo-service-price') || {}).value || 120000);

      var vehObj = null;
      for (var v = 0; v < db.vehicles.length; v++) if (db.vehicles[v].plate.toUpperCase() === plate) { vehObj = db.vehicles[v]; break; }
      if (!vehObj) {
        vehObj = { id: 'veh-' + Date.now(), plate: plate, brand: brand, modelYear: '2025', customerId: custObj ? custObj.id : 'cust-1', customerName: custObj ? custObj.name : 'Cliente', currentKm: curK, nextOilChangeKm: nxtK, soatExpiry: soatD, tecnoExpiry: soatD, notes: sDesc };
        db.vehicles.unshift(vehObj);
      } else { vehObj.currentKm = curK; vehObj.nextOilChangeKm = nxtK; }

      var newWoId = 'OT-' + (3043 + db.workOrders.length);
      db.workOrders.unshift({ id: newWoId, createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '), customerId: custObj ? custObj.id : 'cust-1', customerName: custObj ? custObj.name : 'Cliente', vehicleId: vehObj.id, plate: plate, vehicleBrand: brand, currentKm: curK, nextOilKm: nxtK, workerId: wkObj ? wkObj.id : 'wk-1', workerName: wkObj ? wkObj.name : 'Técnico', status: 'Recibido', services: [{ description: sDesc, price: sPrc }], totalEstimated: sPrc });
      pkPersistRelationalTx('CREATE_WORK_ORDER', { orderId: newWoId, plate: plate });
      pkRenderWorkstation(); pkToast('Orden ' + newWoId + ' (' + plate + ') ingresada al Kanban y enlazada al cliente.');
      return true;
    }

    var woMove = target.closest('[data-wo-move]');
    if (woMove) {
      var ordM = pkFindById(db.workOrders, woMove.getAttribute('data-wo-move'));
      var nextStg = woMove.getAttribute('data-wo-stage');
      if (ordM && nextStg) { ordM.status = nextStg; pkPersistRelationalTx('MOVE_WORK_ORDER', { orderId: ordM.id, stage: nextStg }); pkRenderWorkstation(); pkToast('Orden ' + ordM.id + ' avanzada a: ' + nextStg); }
      return true;
    }

    var invDelta = target.closest('[data-inv-delta]');
    if (invDelta) {
      var prD = pkFindById(db.products, invDelta.getAttribute('data-inv-id'));
      var dStock = Number(invDelta.getAttribute('data-inv-delta'));
      if (prD) {
        prD.stock = Math.max(0, Number(prD.stock || 0) + dStock);
        db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: prD.id, productName: prD.name, warehouseId: prD.warehouseId, movementType: dStock > 0 ? 'AJUSTE_POSITIVO' : 'AJUSTE_NEGATIVO', qty: dStock, unitCost: prD.costPrice, balanceAfter: prD.stock, referenceDoc: 'AJUSTE-RAPIDO', actor: 'Operador' });
        pkPersistRelationalTx('ADJUST_STOCK', { productId: prD.id, stock: prD.stock }); pkRenderWorkstation();
      }
      return true;
    }

    if (target.closest('#btn-inv-register-purchase')) {
      var pSel = (document.getElementById('inv-entry-product-id') || {}).value;
      var supId = (document.getElementById('inv-entry-supplier-id') || {}).value;
      var whId = (document.getElementById('inv-entry-warehouse-id') || {}).value;
      var refDoc = ((document.getElementById('inv-entry-invoice-ref') || {}).value || 'ACTA-REC').trim();
      var qtyIn = Math.max(1, Number((document.getElementById('inv-entry-qty') || {}).value || 10));
      var costIn = Math.max(100, Number((document.getElementById('inv-entry-cost') || {}).value || 35000));
      var saleIn = Math.max(costIn, Number((document.getElementById('inv-entry-sale') || {}).value || 58000));
      var lotIn = ((document.getElementById('inv-entry-lot') || {}).value || 'LOTE-2026').trim();

      var targetProd = pSel !== 'NEW' ? pkFindById(db.products, pSel) : null;
      if (!targetProd) {
        var newSku = ((document.getElementById('inv-entry-sku') || {}).value || ('SKU-' + String(Date.now()).slice(-4))).trim().toUpperCase();
        var newName = ((document.getElementById('inv-entry-name') || {}).value || 'Nuevo Producto Ingresado').trim();
        targetProd = { id: 'prd-' + Date.now(), code: newSku, name: newName, category: 'Compras / Actas v2', warehouseId: whId, supplierId: supId, costPrice: costIn, salePrice: saleIn, taxPct: 19, stock: qtyIn, minStock: 4, lotCode: lotIn, expiryDate: '2028-12-31' };
        db.products.unshift(targetProd);
      } else {
        targetProd.stock = Number(targetProd.stock || 0) + qtyIn; targetProd.costPrice = costIn; targetProd.salePrice = saleIn; targetProd.warehouseId = whId; targetProd.supplierId = supId; targetProd.lotCode = lotIn;
      }
      db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: targetProd.id, productName: targetProd.name, warehouseId: whId, movementType: 'ENTRADA_COMPRA_ACTA', qty: qtyIn, unitCost: costIn, balanceAfter: targetProd.stock, referenceDoc: refDoc, actor: 'Recepción Almacén' });
      pkPersistRelationalTx('PURCHASE_ENTRY', { productCode: targetProd.code, productName: targetProd.name, costPrice: costIn, salePrice: saleIn, stock: targetProd.stock });
      pkRenderWorkstation(); pkToast('Entrada de compra registrada: +' + qtyIn + ' und a ' + targetProd.name);
      return true;
    }

    var abConf = target.closest('[data-confirm-abono-inv]');
    if (abConf) {
      var invAb = pkFindById(db.invoices, abConf.getAttribute('data-confirm-abono-inv'));
      if (invAb) {
        var amt = Math.min(invAb.pendingBalance, Math.max(1000, Number((document.getElementById('modal-abono-amount') || {}).value || invAb.pendingBalance)));
        var mth = (document.getElementById('modal-abono-method') || {}).value || 'Efectivo';
        var nt = ((document.getElementById('modal-abono-note') || {}).value || 'Abono Cartera').trim();
        invAb.amountPaid = Number(invAb.amountPaid || 0) + amt; invAb.pendingBalance = Math.max(0, Number(invAb.pendingBalance || 0) - amt);
        invAb.status = invAb.pendingBalance === 0 ? 'Pagada' : 'Pendiente CxC';
        if (!invAb.abonosHistory) invAb.abonosHistory = [];
        invAb.abonosHistory.unshift({ id: 'RC-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 10), amount: amt, method: mth, note: nt });
        var custAb = pkFindById(db.customers, invAb.customerId); if (custAb) custAb.currentDebt = Math.max(0, Number(custAb.currentDebt || 0) - amt);
        pkPersistRelationalTx('REGISTER_ABONO', { invoiceId: invAb.id, amount: amt }); pkOpenAbonoModal(invAb.id); pkRenderWorkstation(); pkToast('Abono por ' + pkCop(amt) + ' aplicado a ' + invAb.id);
      }
      return true;
    }

    var settleBtn = target.closest('[data-settle-worker]');
    if (settleBtn) {
      var wkS = pkFindById(db.workers, settleBtn.getAttribute('data-settle-worker'));
      if (wkS && wkS.totalDayGross > 0) {
        var g = Number(wkS.totalDayGross); var pay = Math.round(g * (wkS.commissionPct / 100));
        db.settlements.unshift({ id: 'LIQ-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), workerId: wkS.id, workerName: wkS.name, grossLabor: g, commissionPct: wkS.commissionPct, technicianPayout: pay, companyRetention: g - pay });
        wkS.totalDayGross = 0; pkPersistRelationalTx('SETTLE_WORKER', { workerId: wkS.id, payout: pay }); pkRenderWorkstation(); pkToast('Turno liquidado a ' + wkS.name + ' por ' + pkCop(pay));
      }
      return true;
    }

    if (target.closest('#btn-wk-add')) {
      var wName = ((document.getElementById('wk-new-name') || {}).value || '').trim();
      var wSpec = ((document.getElementById('wk-new-spec') || {}).value || 'Técnico Especialista').trim();
      var wPct = Number((document.getElementById('wk-new-pct') || {}).value || 40);
      if (!wName) { pkToast('Ingresa el nombre del técnico.'); return true; }
      db.workers.push({ id: 'wk-' + Date.now(), name: wName, docNumber: '1020' + String(Date.now()).slice(-5), specialty: wSpec, commissionPct: wPct, phone: '3000000000', totalDayGross: 0 });
      pkPersistRelationalTx('ADD_WORKER', { name: wName }); pkRenderWorkstation(); pkToast('Técnico vinculado: ' + wName);
      return true;
    }

    if (target.closest('#btn-exp-add')) {
      var eDesc = ((document.getElementById('exp-new-desc') || {}).value || '').trim();
      var eCat = (document.getElementById('exp-new-cat') || {}).value || 'Insumos Operativos';
      var eSrc = (document.getElementById('exp-new-source') || {}).value || 'Efectivo Caja';
      var eAmt = Math.max(1000, Number((document.getElementById('exp-new-amount') || {}).value || 25000));
      if (!eDesc) { pkToast('Ingresa la descripción del gasto.'); return true; }
      db.expenses.unshift({ id: 'EGR-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), category: eCat, description: eDesc, amount: eAmt, paymentSource: eSrc, responsible: 'Caja' });
      pkPersistRelationalTx('ADD_EXPENSE', { description: eDesc, amount: eAmt }); pkRenderWorkstation(); pkToast('Gasto registrado por ' + pkCop(eAmt));
      return true;
    }

    var csvBtn = target.closest('[data-export-csv]');
    if (csvBtn) {
      var kind = csvBtn.getAttribute('data-export-csv');
      if (kind === 'invoices') { var rInv = []; for (var i1 = 0; i1 < db.invoices.length; i1++) rInv.push([db.invoices[i1].id, db.invoices[i1].date, db.invoices[i1].customerName, db.invoices[i1].plate, db.invoices[i1].total, db.invoices[i1].amountPaid, db.invoices[i1].pendingBalance, db.invoices[i1].status]); pkDownloadCsvUtf8('proveko_facturas_cxc.csv', ['Factura', 'Fecha', 'Cliente', 'Placa', 'Total', 'Pagado', 'Saldo_CxC', 'Estado'], rInv); }
      else if (kind === 'inventory') { var rPrd = []; for (var i2 = 0; i2 < db.products.length; i2++) rPrd.push([db.products[i2].code, db.products[i2].name, db.products[i2].category, db.products[i2].costPrice, db.products[i2].salePrice, db.products[i2].stock]); pkDownloadCsvUtf8('proveko_inventario_valorizado.csv', ['SKU', 'Producto', 'Categoria', 'Costo', 'Precio_Venta', 'Stock'], rPrd); }
      else if (kind === 'expenses') { var rExp = []; for (var i3 = 0; i3 < db.expenses.length; i3++) rExp.push([db.expenses[i3].id, db.expenses[i3].date, db.expenses[i3].category, db.expenses[i3].description, db.expenses[i3].paymentSource, db.expenses[i3].amount]); pkDownloadCsvUtf8('proveko_gastos_caja.csv', ['ID', 'Fecha', 'Categoria', 'Descripcion', 'Origen', 'Monto'], rExp); }
      else if (kind === 'settlements') { var rSt = []; for (var i4 = 0; i4 < db.settlements.length; i4++) rSt.push([db.settlements[i4].id, db.settlements[i4].date, db.settlements[i4].workerName, db.settlements[i4].grossLabor, db.settlements[i4].technicianPayout, db.settlements[i4].companyRetention]); pkDownloadCsvUtf8('proveko_liquidaciones_tecnicos.csv', ['ID', 'Fecha', 'Tecnico', 'Bruto', 'Pago_Tecnico', 'Retencion_Empresa'], rSt); }
      pkToast('Archivo Excel CSV (UTF-8 con BOM) descargado.'); return true;
    }

    var gDemo = target.closest('[data-gastro-add-demo]');
    if (gDemo) {
      var tbD = pkFindById(db.diningTables, gDemo.getAttribute('data-gastro-add-demo'));
      if (tbD) { tbD.status = 'Ocupada'; tbD.diners = 3; tbD.items.push({ productId: 'prd-3', name: 'Menú Ejecutivo / Plato Fuerte', qty: 2, price: 42000 }); tbD.total = Number(tbD.total || 0) + 84000; pkPersistRelationalTx('GASTRO_ORDER', { tableId: tbD.id }); pkRenderWorkstation(); }
      return true;
    }

    if (target.closest('#btn-pos-quick-new-customer')) {
      var newCId = 'cust-' + Date.now();
      db.customers.unshift({ id: newCId, docType: 'NIT', nit: '901' + String(Date.now()).slice(-6), dv: '4', name: 'Empresa Cliente Express #' + (db.customers.length + 1), businessType: 'Jurídica', taxRegime: 'Responsable de IVA (O-48)', phone: '3158899001', email: 'compras@empresa.co', city: 'Bogotá D.C.', address: 'Av. El Dorado # 68B-85', contractId: 'cnt-particular', tariffId: 'trf-plena', creditLimit: 5000000, currentDebt: 0 });
      STATE.posCustomerId = newCId; pkPersistRelationalTx('CREATE_CUSTOMER', { id: newCId }); pkRenderWorkstation(); pkToast('Nuevo Tercero DIAN creado y seleccionado en el POS.');
      return true;
    }
    return false;
  }
`;
}
