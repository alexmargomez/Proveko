/**
 * Plantillas Operativas 5 y 6:
 * - `mod-petty-cash`: Cuadre de Caja del Día y Registro de Gastos (`srv-treasury`).
 * - `srv-reports`: Reportes de Ventas, Ganancias, Inventario y Descarga directa en Excel (.CSV).
 * - `mod-tables` y `mod-kds`: Mapa de Mesas, Toma de Comandas (Mesero) y Monitor de Cocina/Barra (`srv-gastro`).
 */
export function renderReportsCashboxCommissionsHubRuntimeJs(): string {
  return `
  function pkComputeCashMetrics(db) {
    var totalInvoiced = 0; var cashIn = 0; var digitalIn = 0; var totalCxc = 0; var partsProfit = 0;
    for (var i = 0; i < db.invoices.length; i++) {
      var inv = db.invoices[i];
      totalInvoiced += Number(inv.total || 0);
      totalCxc += Number(inv.pendingBalance || 0);
      var paid = Number(inv.amountPaid || 0);
      if (inv.paymentMethod === 'Efectivo' || inv.paymentMethod === 'Crédito / Cartera CxC') cashIn += paid;
      else digitalIn += paid;
      for (var k = 0; k < (inv.items || []).length; k++) {
        var it = inv.items[k];
        if (it.kind === 'PRODUCTO') {
          var pr = pkFindById(db.products, it.refId);
          var uCost = pr ? Number(pr.costPrice || 0) : Math.round(Number(it.price || 0) * 0.6);
          partsProfit += (Number(it.price || 0) - uCost) * Number(it.qty || 1);
        }
      }
    }
    var cashExpenses = 0; var totalExpenses = 0;
    for (var e = 0; e < db.expenses.length; e++) {
      totalExpenses += Number(db.expenses[e].amount || 0);
      if (db.expenses[e].paymentSource === 'Efectivo Caja') cashExpenses += Number(db.expenses[e].amount || 0);
    }
    return { totalInvoiced: totalInvoiced, cashIn: cashIn, digitalIn: digitalIn, totalCxc: totalCxc, partsProfit: partsProfit, totalExpenses: totalExpenses, netCash: cashIn - cashExpenses };
  }

  function pkRenderPettyCashHub() {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;
    var m = pkComputeCashMetrics(db);
    var expRows = '';
    for (var e = 0; e < db.expenses.length; e++) {
      var ex = db.expenses[e];
      expRows += '<tr><td><code>' + pkEsc(ex.id) + '</code></td><td>' + pkEsc(ex.date) + '</td><td><span class="badge badge-slate">' + pkEsc(ex.category) + '</span></td><td><strong>' + pkEsc(ex.description) + '</strong></td><td>' + pkEsc(ex.paymentSource) + '</td><td style="color:var(--pk-amber);font-weight:800">-' + pkCop(ex.amount) + '</td><td><div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-print-expense="' + pkEsc(ex.id) + '">🖨️</button><button type="button" class="btn btn-outline btn-sm" data-exp-delete-id="' + pkEsc(ex.id) + '">🗑️</button></div></td></tr>';
    }
    var nextEgr = 'EGR-' + (101 + db.expenses.length);
    stage.innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Efectivo Neto en Caja (Ingresos - Gastos)</div><div class="kpi-val" style="color:var(--pk-emerald)">' + pkCop(m.netCash) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Transferencias y Tarjetas</div><div class="kpi-val" style="color:var(--pk-primary)">' + pkCop(m.digitalIn) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Total Gastos Registrados</div><div class="kpi-val" style="color:var(--pk-amber)">-' + pkCop(m.totalExpenses) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Total Facturado</div><div class="kpi-val">' + pkCop(m.totalInvoiced) + '</div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><div class="card-title">💸 Registrar Salida o Gasto de Caja (' + nextEgr + ')</div>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-print-cashbox">🖨️ Imprimir Arqueo de Caja</button></div>' +
      '<div class="card-body"><div class="form-grid" style="margin-bottom:12px">' +
      '<div class="field"><label>Comprobante (Automático)</label><input type="text" value="' + nextEgr + '" readonly style="background:#e2e8f0;font-weight:800" /></div>' +
      '<div class="field"><label>Categoría del Gasto</label><select id="exp-new-cat"><option value="Insumos Operativos">Insumos Operativos</option><option value="Transporte / Fletes">Transporte / Fletes</option><option value="Servicios Públicos">Servicios Públicos</option><option value="Mantenimiento / Aseo">Mantenimiento / Aseo</option><option value="Adelanto / Vale">Adelanto / Vale</option></select></div>' +
      '<div class="field"><label>Concepto / Detalle *</label><input type="text" id="exp-new-desc" placeholder="Ej: Compra insumos de aseo / Domicilio" /></div>' +
      '<div class="field"><label>Sale de y Valor ($)</label><div class="row-actions">' +
      '<select id="exp-new-source" style="width:140px"><option value="Efectivo Caja">Efectivo Caja</option><option value="Transferencia Bancaria">Banco / Nequi</option></select>' +
      '<input type="number" id="exp-new-amount" value="25000" style="flex:1" />' +
      '<button type="button" class="btn btn-amber btn-sm" id="btn-exp-add">+ Guardar Gasto</button></div></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>N° Egreso</th><th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Origen</th><th>Valor</th><th>Acciones</th></tr></thead><tbody>' + expRows + '</tbody></table></div></div></div>';
  }

  function pkRenderReportsAndCashboxHub() {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;
    var m = pkComputeCashMetrics(db);
    var invRows = '';
    for (var i = 0; i < db.invoices.length; i++) {
      var iv = db.invoices[i];
      invRows += '<tr><td><strong>' + pkEsc(iv.id) + '</strong></td><td>' + pkEsc(iv.date) + '</td><td>' + pkEsc(iv.customerName) + '</td><td>' + pkEsc(iv.paymentMethod) + '</td><td><strong>' + pkCop(iv.total) + '</strong></td><td><span class="badge ' + (iv.pendingBalance > 0 ? 'badge-amber' : 'badge-emerald') + '">' + pkEsc(iv.status) + '</span></td><td><button type="button" class="btn btn-outline btn-sm" data-print-invoice="' + pkEsc(iv.id) + '">🖨️ Imprimir</button></td></tr>';
    }
    stage.innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Ventas Totales Facturadas</div><div class="kpi-val">' + pkCop(m.totalInvoiced) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Ganancia en Productos</div><div class="kpi-val" style="color:var(--pk-emerald)">+' + pkCop(m.partsProfit) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Efectivo Neto en Caja</div><div class="kpi-val" style="color:var(--pk-primary)">' + pkCop(m.netCash) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Cuentas por Cobrar (Cartera)</div><div class="kpi-val" style="color:var(--pk-amber)">' + pkCop(m.totalCxc) + '</div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><div class="card-title">📥 Descargar e Imprimir Reportes Gerenciales</div>' +
      '<button type="button" class="btn btn-primary btn-sm" id="btn-print-cashbox">🖨️ Imprimir Balance General del Día</button></div>' +
      '<div class="card-body"><div class="row-actions">' +
      '<button type="button" class="btn btn-primary btn-sm" data-export-csv="invoices">📊 Descargar Reporte de Ventas (.CSV)</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="inventory">📦 Descargar Inventario Valorizado (.CSV)</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="expenses">💸 Descargar Gastos de Caja (.CSV)</button>' +
      '</div></div></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">🧾 Detalle de Ventas Recientes</div></div>' +
      '<div class="card-body"><div class="table-wrap"><table><thead><tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th>Medio de Pago</th><th>Total</th><th>Estado</th><th>Acción</th></tr></thead><tbody>' + invRows + '</tbody></table></div></div></div>';
  }

  function pkRenderGastroHub(subKey) {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;

    if (subKey === 'mod-kds') {
      var kdsCards = '';
      for (var k = 0; k < db.diningTables.length; k++) {
        var tk = db.diningTables[k];
        if (!tk.items || tk.items.length === 0) continue;
        var listK = '';
        for (var m = 0; m < tk.items.length; m++) {
          listK += '<div style="padding:6px 0;border-bottom:1px dashed var(--pk-border);font-size:13px"><strong>' + tk.items[m].qty + 'x ' + pkEsc(tk.items[m].name) + '</strong>' +
            (tk.items[m].note ? '<div style="font-size:11px;color:#b45309">Nota: ' + pkEsc(tk.items[m].note) + '</div>' : '') + '</div>';
        }
        kdsCards += '<div class="card"><div class="card-head" style="background:#fef3c7"><div class="card-title">👨‍🍳 ' + pkEsc(tk.name) + '</div><span class="badge badge-amber">Mesero: ' + pkEsc(tk.waiter) + '</span></div>' +
          '<div class="card-body">' + listK + '<div class="row-actions" style="margin-top:12px"><button type="button" class="btn btn-outline btn-sm" data-print-gastro-table="' + pkEsc(tk.id) + '">🖨️ Imprimir Comanda</button><button type="button" class="btn btn-emerald btn-sm" style="flex:1" data-kds-ready-table="' + pkEsc(tk.id) + '">✅ Marcar Listo</button></div></div></div>';
      }
      stage.innerHTML = '<div class="grid-3">' + (kdsCards || '<div class="card"><div class="card-body">No hay comandas pendientes en cocina en este momento.</div></div>') + '</div>';
      return;
    }

    var selTable = pkFindById(db.diningTables, STATE.selectedTableId) || db.diningTables[0];
    if (selTable) STATE.selectedTableId = selTable.id;

    var tableButtons = '';
    for (var i = 0; i < db.diningTables.length; i++) {
      var t = db.diningTables[i];
      var isSel = selTable && selTable.id === t.id;
      var isOcc = t.items && t.items.length > 0;
      tableButtons += '<button type="button" data-select-table="' + pkEsc(t.id) + '" style="padding:12px 16px;border-radius:12px;cursor:pointer;text-align:left;min-width:165px;border:2px solid ' + (isSel ? '#023047' : (isOcc ? '#10b981' : '#cbd5e1')) + ';background:' + (isSel ? '#023047' : (isOcc ? '#ecfdf5' : '#fff')) + ';color:' + (isSel ? '#fff' : '#0f172a') + '">' +
        '<div style="font-weight:800;font-size:14px">🍽️ ' + pkEsc(t.name) + '</div>' +
        '<div style="font-size:11px;opacity:0.85">' + pkEsc(t.waiter || 'Mesero') + ' · ' + (isOcc ? pkCop(t.total) : 'Libre') + '</div></button>';
    }

    var menuOpts = '<option value="Punta de Anca 350g|48000">Punta de Anca 350g — $48.000</option><option value="Bandeja Especial Ejecutiva|32000">Bandeja Especial Ejecutiva — $32.000</option><option value="Hamburguesa Artesanal Doble|28000">Hamburguesa Artesanal Doble — $28.000</option><option value="Limonada Cerezada / Natural|9500">Limonada Cerezada / Natural — $9.500</option>';
    for (var p = 0; p < db.products.length; p++) {
      menuOpts += '<option value="' + pkEsc(db.products[p].name + '|' + db.products[p].salePrice) + '">' + pkEsc(db.products[p].name + ' — ' + pkCop(db.products[p].salePrice)) + '</option>';
    }
    var waiterOpts = '<option value="Camila (Mesera)">Camila (Mesera)</option><option value="Mateo (Barra)">Mateo (Barra)</option><option value="Laura (Terraza)">Laura (Terraza)</option>';
    for (var w = 0; w < db.workers.length; w++) waiterOpts += '<option value="' + pkEsc(db.workers[w].name) + '">' + pkEsc(db.workers[w].name) + '</option>';

    var cmdRows = '';
    if (selTable && selTable.items) {
      for (var c = 0; c < selTable.items.length; c++) {
        var it = selTable.items[c];
        cmdRows += '<tr><td><strong>' + pkEsc(it.name) + '</strong>' + (it.note ? '<div style="font-size:11px;color:var(--pk-muted)">Nota: ' + pkEsc(it.note) + '</div>' : '') + '</td>' +
          '<td><div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-cmd-qty="-1" data-cmd-idx="' + c + '">➖</button><strong>' + it.qty + '</strong><button type="button" class="btn btn-outline btn-sm" data-cmd-qty="1" data-cmd-idx="' + c + '">➕</button></div></td>' +
          '<td>' + pkCop(it.price) + '</td><td><strong>' + pkCop(it.price * it.qty) + '</strong></td>' +
          '<td><button type="button" class="btn btn-outline btn-sm" data-cmd-del="' + c + '">🗑️</button></td></tr>';
      }
    }
    if (!cmdRows) cmdRows = '<tr><td colspan="5" style="text-align:center;color:var(--pk-muted);padding:16px">Mesa libre. Selecciona un plato o bebida arriba y haz clic en "+ Agregar a la Comanda".</td></tr>';

    stage.innerHTML =
      '<div class="card"><div class="card-head"><div class="card-title">1. Selecciona la Mesa (Haz clic en una mesa para ver o crear su comanda)</div>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-gastro-new-table">+ Crear Nueva Mesa</button></div>' +
      '<div class="card-body"><div style="display:flex;gap:10px;flex-wrap:wrap">' + tableButtons + '</div></div></div>' +

      (selTable ? (
        '<div class="card"><div class="card-head" style="background:#f8fafc"><div class="card-title">📝 2. Comanda de ' + pkEsc(selTable.name) + '</div>' +
        '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-print-gastro-table="' + pkEsc(selTable.id) + '">🖨️ Imprimir Precuenta / Comanda</button>' +
        '<span class="badge badge-emerald" style="font-size:14px">Total Mesa: ' + pkCop(selTable.total) + '</span></div></div>' +
        '<div class="card-body">' +
        '<div class="form-grid" style="background:#f1f5f9;padding:12px;border-radius:10px;margin-bottom:14px">' +
        '<div class="field"><label>Plato / Bebida / Producto (Catálogo)</label><select id="cmd-dish-select">' + menuOpts + '</select></div>' +
        '<div class="field"><label>Mesero Asignado</label><select id="cmd-waiter">' + waiterOpts + '</select></div>' +
        '<div class="field"><label>Cantidad</label><select id="cmd-qty"><option value="1" selected>1 Unidad</option><option value="2">2 Unidades</option><option value="3">3 Unidades</option><option value="4">4 Unidades</option><option value="6">6 Unidades</option></select></div>' +
        '<div class="field"><label>Preparación / Nota Cocina</label><select id="cmd-note"><option value="Estándar">Estándar</option><option value="Término 3/4">Término 3/4</option><option value="Bien asado">Bien asado</option><option value="Sin cebolla / Sin salsa">Sin cebolla / Sin salsa</option><option value="Fría con hielo">Fría con hielo</option><option value="Para llevar">Para llevar</option></select></div>' +
        '<div class="field"><button type="button" class="btn btn-primary" style="width:100%" id="btn-cmd-add-item">+ Agregar a la Comanda</button></div>' +
        '</div>' +
        '<div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Plato / Bebida</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th><th>Quitar</th></tr></thead><tbody>' + cmdRows + '</tbody></table></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<button type="button" class="btn btn-amber" id="btn-cmd-send-kitchen">👨‍🍳 Enviar Comanda a Cocina / Barra</button>' +
        '<button type="button" class="btn btn-outline" data-print-gastro-table="' + pkEsc(selTable.id) + '">🖨️ Imprimir Comanda / Precuenta</button>' +
        '<button type="button" class="btn btn-emerald" data-pos-load-table="' + pkEsc(selTable.id) + '">💵 Pasar Cuenta de ' + pkEsc(selTable.name) + ' a Caja para Cobrar</button>' +
        '</div></div></div>'
      ) : '');
  }
`;
}
