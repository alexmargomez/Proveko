/**
 * Plantilla Operativa 2 (`mod-stock`): Productos y Existencias en Inventario + Acciones de Inventario y Comandas (<= 200 líneas).
 */
export function renderInventoryWmsHubRuntimeJs(): string {
  return `
  function pkRenderInventoryHub() {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;

    var totalCostVal = 0; var totalSaleVal = 0; var lowStockCount = 0;
    var whFilter = STATE.invWarehouseFilter || 'ALL';
    var qSearch = (STATE.invSearchText || '').trim().toLowerCase();

    var whOpts = '<option value="ALL">Todas las Bodegas (' + db.warehouses.length + ')</option>';
    var whSelectForm = '';
    for (var w = 0; w < db.warehouses.length; w++) {
      var wh = db.warehouses[w];
      whOpts += '<option value="' + pkEsc(wh.id) + '" ' + (whFilter === wh.id ? 'selected' : '') + '>' + pkEsc(wh.name) + '</option>';
      whSelectForm += '<option value="' + pkEsc(wh.id) + '">' + pkEsc(wh.name) + '</option>';
    }

    var supOpts = '<option value="">Sin proveedor específico</option>';
    for (var s = 0; s < db.suppliers.length; s++) {
      var sp = db.suppliers[s];
      supOpts += '<option value="' + pkEsc(sp.id) + '">' + pkEsc(sp.name) + '</option>';
    }

    var rowsHtml = '';
    for (var i = 0; i < db.products.length; i++) {
      var p = db.products[i];
      totalCostVal += Number(p.costPrice || 0) * Number(p.stock || 0);
      totalSaleVal += Number(p.salePrice || 0) * Number(p.stock || 0);
      if (Number(p.stock || 0) <= Number(p.minStock || 5)) lowStockCount++;

      if (whFilter !== 'ALL' && p.warehouseId !== whFilter) continue;
      if (qSearch && (p.code + ' ' + p.name + ' ' + p.category).toLowerCase().indexOf(qSearch) === -1) continue;

      var whObj = pkFindById(db.warehouses, p.warehouseId);
      var supObj = pkFindById(db.suppliers, p.supplierId);
      var unitProfit = Number(p.salePrice || 0) - Number(p.costPrice || 0);
      var marginPct = p.salePrice > 0 ? Math.round((unitProfit / p.salePrice) * 100) : 0;
      var isLow = Number(p.stock || 0) <= Number(p.minStock || 5);

      rowsHtml += '<tr>' +
        '<td><code>' + pkEsc(p.code) + '</code></td>' +
        '<td><strong>' + pkEsc(p.name) + '</strong>' +
        '<div style="font-size:11px;color:var(--pk-muted)">🚚 ' + pkEsc(supObj ? supObj.name : 'Directo') + ' · 🏭 ' + pkEsc(whObj ? whObj.name : 'Principal') + '</div></td>' +
        '<td>' + pkCop(p.costPrice) + '</td>' +
        '<td><strong>' + pkCop(p.salePrice) + '</strong></td>' +
        '<td><span class="badge badge-emerald">+' + pkCop(unitProfit) + ' (' + marginPct + '%)</span></td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" title="Quitar 1 unidad" data-inv-delta="-1" data-inv-id="' + pkEsc(p.id) + '">➖</button>' +
        '<span class="badge ' + (isLow ? 'badge-amber' : 'badge-blue') + '" style="font-size:13px;min-width:64px;text-align:center">' + p.stock + ' und' + (isLow ? ' ⚠️' : '') + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" title="Agregar 1 unidad" data-inv-delta="1" data-inv-id="' + pkEsc(p.id) + '">➕</button>' +
        '</div></td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-emerald btn-sm" data-open-restock-modal="' + pkEsc(p.id) + '">📥 Surtir</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-open-transfer-modal="' + pkEsc(p.id) + '">🔄 Trasladar</button>' +
        '<button type="button" class="btn btn-outline btn-sm" title="Imprimir Ficha" data-print-product="' + pkEsc(p.id) + '">🖨️</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-inv-delete-id="' + pkEsc(p.id) + '">🗑️</button>' +
        '</div></td></tr>';
    }
    if (!rowsHtml) {
      rowsHtml = '<tr><td colspan="7" style="text-align:center;color:var(--pk-muted);padding:18px">No se encontraron productos con ese filtro.</td></tr>';
    }

    var potentialProfit = Math.max(0, totalSaleVal - totalCostVal);
    var nextSku = 'PRD-' + (105 + db.products.length);

    stage.innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Capital en Bodega (Costo)</div><div class="kpi-val">' + pkCop(totalCostVal) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Valor Comercial (Venta)</div><div class="kpi-val" style="color:var(--pk-primary)">' + pkCop(totalSaleVal) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Ganancia Estimada</div><div class="kpi-val" style="color:var(--pk-emerald)">' + pkCop(potentialProfit) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Productos por Agotarse</div><div class="kpi-val" style="color:' + (lowStockCount > 0 ? 'var(--pk-amber)' : 'var(--pk-emerald)') + '">' + lowStockCount + ' productos</div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><div class="card-title">➕ Agregar Nuevo Producto al Inventario (' + nextSku + ')</div>' +
      '<button type="button" class="btn btn-outline btn-sm" data-open-quick-entity="WAREHOUSE">+ Nueva Bodega</button></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>Código / SKU (Automático)</label><input type="text" id="inv-new-sku" value="' + nextSku + '" readonly style="background:#e2e8f0;font-weight:800" /></div>' +
      '<div class="field"><label>Nombre del Producto o Repuesto *</label><input type="text" id="inv-new-name" placeholder="Ej: Pastillas de Freno / Bebida / Insumo" /></div>' +
      '<div class="field"><label>Proveedor</label><select id="inv-new-supplier">' + supOpts + '</select></div>' +
      '<div class="field"><label>Bodega</label><select id="inv-new-warehouse">' + whSelectForm + '</select></div>' +
      '<div class="field"><label>Costo de Compra ($)</label><input type="number" id="inv-new-cost" value="22000" /></div>' +
      '<div class="field"><label>Precio de Venta ($) *</label><input type="number" id="inv-new-sale" value="38000" /></div>' +
      '<div class="field"><label>Cantidad Inicial (Stock) *</label><input type="number" id="inv-new-stock" value="15" /></div>' +
      '<div class="field" style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-primary" style="width:100%" id="btn-inv-create-product">+ Guardar Producto</button></div>' +
      '</div></div></div>' +
      '<div class="card"><div class="card-head">' +
      '<div class="card-title">📦 Productos en Inventario (' + db.products.length + ')</div>' +
      '<div class="row-actions">' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-print-inventory-all">🖨️ Imprimir Inventario</button>' +
      '<select id="inv-filter-warehouse" style="padding:6px 10px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px">' + whOpts + '</select>' +
      '<input type="text" id="inv-search-input" value="' + pkEsc(STATE.invSearchText || '') + '" placeholder="🔎 Buscar por código o nombre..." style="padding:6px 10px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px;min-width:220px" />' +
      '</div></div>' +
      '<div class="card-body"><div class="table-wrap"><table><thead><tr>' +
      '<th>Código</th><th>Producto / Proveedor / Bodega</th><th>Costo Compra</th><th>Precio Venta</th><th>Margen</th><th>Quitar / Agregar Stock</th><th>Acciones</th>' +
      '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div></div>';
  }

  function pkHandleGastroAndInventoryActions(target, db) {
    if (target.closest('#btn-inv-create-product')) {
      var nName = ((document.getElementById('inv-new-name') || {}).value || '').trim();
      if (!nName) { pkToast('Escribe el nombre del producto.'); return true; }
      var nSku = ((document.getElementById('inv-new-sku') || {}).value || ('PRD-' + String(Date.now()).slice(-4))).trim().toUpperCase();
      var nWh = (document.getElementById('inv-new-warehouse') || {}).value || (db.warehouses[0] ? db.warehouses[0].id : 'wh-1');
      var nSup = (document.getElementById('inv-new-supplier') || {}).value || (db.suppliers[0] ? db.suppliers[0].id : 'sup-1');
      var nStock = Math.max(0, Number((document.getElementById('inv-new-stock') || {}).value || 10));
      var nCost = Math.max(0, Number((document.getElementById('inv-new-cost') || {}).value || 22000));
      var nSale = Math.max(nCost, Number((document.getElementById('inv-new-sale') || {}).value || 38000));
      var newPrd = { id: 'prd-' + Date.now(), code: nSku, name: nName, category: 'General', warehouseId: nWh, supplierId: nSup, costPrice: nCost, salePrice: nSale, taxPct: 19, stock: nStock, minStock: 5, lotCode: 'LOTE-2026', expiryDate: '2028-12-31' };
      db.products.unshift(newPrd);
      db.kardexMovements.unshift({ id: 'KDX-' + String(Date.now()).slice(-4), date: new Date().toISOString().slice(0, 16).replace('T', ' '), productId: newPrd.id, productName: newPrd.name, warehouseId: nWh, movementType: 'INVENTARIO_INICIAL', qty: nStock, unitCost: nCost, balanceAfter: nStock, referenceDoc: 'ALTA-PRODUCTO', actor: 'Inventario' });
      pkPersistRelationalTx('PURCHASE_ENTRY', { productCode: newPrd.code, productName: newPrd.name, costPrice: nCost, salePrice: nSale, stock: nStock });
      pkRenderWorkstation(); pkToast('Producto guardado en inventario: ' + nName);
      return true;
    }
    var invDel = target.closest('[data-inv-delete-id]');
    if (invDel) {
      var idDel = invDel.getAttribute('data-inv-delete-id');
      for (var d1 = 0; d1 < db.products.length; d1++) if (db.products[d1].id === idDel) { db.products.splice(d1, 1); break; }
      pkRenderWorkstation(); pkToast('Producto eliminado del inventario.'); return true;
    }
    var selTbl = target.closest('[data-select-table]');
    if (selTbl) { STATE.selectedTableId = selTbl.getAttribute('data-select-table'); pkRenderWorkstation(); return true; }
    if (target.closest('#btn-gastro-new-table')) {
      var nTblNum = db.diningTables.length + 1; var nTblId = 'tbl-' + Date.now();
      db.diningTables.push({ id: nTblId, name: 'Mesa ' + nTblNum, waiter: 'Mesero Turno', diners: 0, status: 'Libre', items: [], total: 0 });
      STATE.selectedTableId = nTblId; pkRenderWorkstation(); pkToast('Mesa ' + nTblNum + ' creada.'); return true;
    }
    if (target.closest('#btn-cmd-add-item')) {
      var tbC = pkFindById(db.diningTables, STATE.selectedTableId) || db.diningTables[0];
      if (tbC) {
        var dishVal = (document.getElementById('cmd-dish-select') || {}).value || 'Plato Especial|35000';
        var customName = ((document.getElementById('cmd-custom-name') || {}).value || '').trim();
        var customPrice = Number((document.getElementById('cmd-custom-price') || {}).value || 0);
        var parts = dishVal.split('|');
        var itemName = customName || parts[0];
        var itemPrice = customPrice > 0 ? customPrice : Number(parts[1] || 25000);
        var itemQty = Math.max(1, Number((document.getElementById('cmd-qty') || {}).value || 1));
        var itemNote = ((document.getElementById('cmd-note') || {}).value || '').trim();
        tbC.waiter = ((document.getElementById('cmd-waiter') || {}).value || 'Mesero').trim();
        tbC.diners = Math.max(1, Number((document.getElementById('cmd-diners') || {}).value || 2));
        if (tbC.status === 'Libre') tbC.status = 'Ocupada';
        tbC.items.push({ productId: 'cmd-' + Date.now(), name: itemName, qty: itemQty, price: itemPrice, note: itemNote });
        var sumT = 0; for (var k = 0; k < tbC.items.length; k++) sumT += tbC.items[k].qty * tbC.items[k].price;
        tbC.total = sumT; pkPersistRelationalTx('GASTRO_ORDER', { tableId: tbC.id }); pkRenderWorkstation(); pkToast('Agregado a ' + tbC.name + ': ' + itemQty + 'x ' + itemName);
      }
      return true;
    }
    var cmdQty = target.closest('[data-cmd-qty]');
    if (cmdQty) {
      var tbQ = pkFindById(db.diningTables, STATE.selectedTableId) || db.diningTables[0];
      var idxC = Number(cmdQty.getAttribute('data-cmd-idx'));
      if (tbQ && tbQ.items[idxC]) {
        tbQ.items[idxC].qty = Math.max(1, tbQ.items[idxC].qty + Number(cmdQty.getAttribute('data-cmd-qty')));
        var sQ = 0; for (var q1 = 0; q1 < tbQ.items.length; q1++) sQ += tbQ.items[q1].qty * tbQ.items[q1].price;
        tbQ.total = sQ; pkRenderWorkstation();
      }
      return true;
    }
    var cmdDel = target.closest('[data-cmd-del]');
    if (cmdDel) {
      var tbX = pkFindById(db.diningTables, STATE.selectedTableId) || db.diningTables[0];
      if (tbX) {
        tbX.items.splice(Number(cmdDel.getAttribute('data-cmd-del')), 1);
        var sX = 0; for (var x1 = 0; x1 < tbX.items.length; x1++) sX += tbX.items[x1].qty * tbX.items[x1].price;
        tbX.total = sX; if (tbX.items.length === 0) tbX.status = 'Libre'; pkRenderWorkstation();
      }
      return true;
    }
    if (target.closest('#btn-cmd-send-kitchen')) {
      var tbK = pkFindById(db.diningTables, STATE.selectedTableId) || db.diningTables[0];
      if (tbK) {
        if (!tbK.items || tbK.items.length === 0) { pkToast('Agrega al menos un plato o bebida antes de enviar a cocina.'); return true; }
        tbK.status = 'En Cocina'; pkRenderWorkstation(); pkToast('Comanda de ' + tbK.name + ' enviada a Cocina y Barra.');
      }
      return true;
    }
    var kdsReady = target.closest('[data-kds-ready-table]');
    if (kdsReady) {
      var tbR = pkFindById(db.diningTables, kdsReady.getAttribute('data-kds-ready-table'));
      if (tbR) { tbR.status = 'Ocupada'; pkRenderWorkstation(); pkToast('Pedido de ' + tbR.name + ' marcado como entregado.'); }
      return true;
    }
    return false;
  }
`;
}
