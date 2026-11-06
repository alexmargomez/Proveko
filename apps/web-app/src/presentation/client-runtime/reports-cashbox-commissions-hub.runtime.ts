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
      expRows += '<tr><td>' + pkEsc(ex.date) + '</td><td><span class="badge badge-slate">' + pkEsc(ex.category) + '</span></td><td><strong>' + pkEsc(ex.description) + '</strong></td><td>' + pkEsc(ex.paymentSource) + '</td><td style="color:var(--pk-amber);font-weight:800">-' + pkCop(ex.amount) + '</td><td><button type="button" class="btn btn-outline btn-sm" data-exp-delete-id="' + pkEsc(ex.id) + '">🗑️</button></td></tr>';
    }
    stage.innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Efectivo Neto en Caja (Ingresos - Gastos)</div><div class="kpi-val" style="color:var(--pk-emerald)">' + pkCop(m.netCash) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Transferencias y Tarjetas</div><div class="kpi-val" style="color:var(--pk-primary)">' + pkCop(m.digitalIn) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Total Gastos Registrados</div><div class="kpi-val" style="color:var(--pk-amber)">-' + pkCop(m.totalExpenses) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Total Facturado</div><div class="kpi-val">' + pkCop(m.totalInvoiced) + '</div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><div class="card-title">💸 Registrar Salida o Gasto de Caja</div></div>' +
      '<div class="card-body"><div class="form-grid" style="margin-bottom:12px">' +
      '<div class="field"><label>Concepto del Gasto *</label><input type="text" id="exp-new-desc" placeholder="Ej: Compra insumos de aseo / Domicilio" /></div>' +
      '<div class="field"><label>Categoría</label><select id="exp-new-cat"><option value="Insumos Operativos">Insumos Operativos</option><option value="Transporte / Fletes">Transporte / Fletes</option><option value="Servicios Públicos">Servicios Públicos</option><option value="Adelanto / Vale">Adelanto / Vale</option></select></div>' +
      '<div class="field"><label>Sale de y Valor ($)</label><div class="row-actions">' +
      '<select id="exp-new-source" style="width:140px"><option value="Efectivo Caja">Efectivo Caja</option><option value="Transferencia Bancaria">Banco / Nequi</option></select>' +
      '<input type="number" id="exp-new-amount" value="25000" style="flex:1" />' +
      '<button type="button" class="btn btn-amber btn-sm" id="btn-exp-add">+ Guardar Gasto</button></div></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Origen</th><th>Valor</th><th>Acción</th></tr></thead><tbody>' + expRows + '</tbody></table></div></div></div>';
  }

  function pkRenderReportsAndCashboxHub() {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;
    var m = pkComputeCashMetrics(db);
    var invRows = '';
    for (var i = 0; i < db.invoices.length; i++) {
      var iv = db.invoices[i];
      invRows += '<tr><td><strong>' + pkEsc(iv.id) + '</strong></td><td>' + pkEsc(iv.date) + '</td><td>' + pkEsc(iv.customerName) + '</td><td>' + pkEsc(iv.paymentMethod) + '</td><td><strong>' + pkCop(iv.total) + '</strong></td><td><span class="badge ' + (iv.pendingBalance > 0 ? 'badge-amber' : 'badge-emerald') + '">' + pkEsc(iv.status) + '</span></td></tr>';
    }
    stage.innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Ventas Totales Facturadas</div><div class="kpi-val">' + pkCop(m.totalInvoiced) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Ganancia en Productos</div><div class="kpi-val" style="color:var(--pk-emerald)">+' + pkCop(m.partsProfit) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Efectivo Neto en Caja</div><div class="kpi-val" style="color:var(--pk-primary)">' + pkCop(m.netCash) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Cuentas por Cobrar (Cartera)</div><div class="kpi-val" style="color:var(--pk-amber)">' + pkCop(m.totalCxc) + '</div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><div class="card-title">📥 Descargar Reportes en Excel (.CSV)</div></div>' +
      '<div class="card-body"><div class="row-actions">' +
      '<button type="button" class="btn btn-primary btn-sm" data-export-csv="invoices">📊 Descargar Reporte de Ventas y Facturas</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="inventory">📦 Descargar Inventario Valorizado</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="expenses">💸 Descargar Gastos de Caja</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="settlements">👷 Descargar Comisiones de Técnicos</button>' +
      '</div></div></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">🧾 Detalle de Ventas Recientes</div></div>' +
      '<div class="card-body"><div class="table-wrap"><table><thead><tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th>Medio de Pago</th><th>Total</th><th>Estado</th></tr></thead><tbody>' + invRows + '</tbody></table></div></div></div>';
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
        kdsCards += '<div class="card"><div class="card-head" style="background:#fef3c7"><div class="card-title">👨‍🍳 ' + pkEsc(tk.name) + ' (' + pkEsc(tk.zone) + ')</div><span class="badge badge-amber">Mesero: ' + pkEsc(tk.waiter) + '</span></div>' +
          '<div class="card-body">' + listK + '<div style="margin-top:12px"><button type="button" class="btn btn-emerald btn-sm" style="width:100%" data-kds-ready-table="' + pkEsc(tk.id) + '">✅ Marcar Pedido Listo para Servir</button></div></div></div>';
      }
      stage.innerHTML = '<div class="grid-3">' + (kdsCards || '<div class="card"><div class="card-body">No hay comandas pendientes en cocina en este momento.</div></div>') + '</div>';
      return;
    }

    var selTable = pkFindById(db.diningTables, STATE.activeTableId) || db.diningTables[0];
    if (selTable) STATE.activeTableId = selTable.id;

    var tableButtons = '';
    for (var i = 0; i < db.diningTables.length; i++) {
      var t = db.diningTables[i];
      var isSel = selTable && selTable.id === t.id;
      var isOcc = t.items && t.items.length > 0;
      tableButtons += '<button type="button" data-select-table="' + pkEsc(t.id) + '" style="padding:12px 16px;border-radius:12px;cursor:pointer;text-align:left;min-width:165px;border:2px solid ' + (isSel ? '#023047' : (isOcc ? '#10b981' : '#cbd5e1')) + ';background:' + (isSel ? '#023047' : (isOcc ? '#ecfdf5' : '#fff')) + ';color:' + (isSel ? '#fff' : '#0f172a') + '">' +
        '<div style="font-weight:800;font-size:14px">🍽️ ' + pkEsc(t.name) + '</div>' +
        '<div style="font-size:11px;opacity:0.85">' + pkEsc(t.zone) + ' · ' + (isOcc ? pkCop(t.total) : 'Libre') + '</div></button>';
    }

    var menuOpts = '';
    for (var p = 0; p < db.products.length; p++) {
      menuOpts += '<option value="' + pkEsc(db.products[p].id) + '">' + pkEsc(db.products[p].name + ' — ' + pkCop(db.products[p].salePrice)) + '</option>';
    }

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
    if (!cmdRows) cmdRows = '<tr><td colspan="5" style="text-align:center;color:var(--pk-muted);padding:16px">Esta mesa está libre. Selecciona un plato o bebida arriba y haz clic en "+ Agregar a la Comanda".</td></tr>';

    stage.innerHTML =
      '<div class="card"><div class="card-head"><div class="card-title">1. Selecciona la Mesa (Haz clic en una mesa para ver o crear su comanda)</div>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-gastro-new-table">+ Crear Nueva Mesa</button></div>' +
      '<div class="card-body"><div style="display:flex;gap:10px;flex-wrap:wrap">' + tableButtons + '</div></div></div>' +

      (selTable ? (
        '<div class="card"><div class="card-head" style="background:#f8fafc"><div class="card-title">📝 2. Comanda de ' + pkEsc(selTable.name) + ' (' + pkEsc(selTable.zone) + ')</div>' +
        '<span class="badge badge-emerald" style="font-size:14px">Total Mesa: ' + pkCop(selTable.total) + '</span></div>' +
        '<div class="card-body">' +
        '<div class="form-grid" style="background:#f1f5f9;padding:12px;border-radius:10px;margin-bottom:14px">' +
        '<div class="field"><label>Plato / Bebida / Producto *</label><select id="cmd-product-id">' + menuOpts + '</select></div>' +
        '<div class="field"><label>O escribir plato personalizado</label><input type="text" id="cmd-custom-name" placeholder="Ej: Churrasco 350g / Limonada Cerezada" /></div>' +
        '<div class="field"><label>Precio ($) (Si es personalizado)</label><input type="number" id="cmd-custom-price" placeholder="Ej: 38000" /></div>' +
        '<div class="field"><label>Cantidad</label><input type="number" id="cmd-qty-input" value="1" min="1" /></div>' +
        '<div class="field"><label>Nota para Cocina / Barra</label><input type="text" id="cmd-note-input" placeholder="Ej: Término 3/4, sin cebolla, bien fría" /></div>' +
        '<div class="field" style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-primary" style="width:100%" id="btn-cmd-add-item">+ Agregar a la Comanda</button></div>' +
        '</div>' +
        '<div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Plato / Bebida</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th><th>Quitar</th></tr></thead><tbody>' + cmdRows + '</tbody></table></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<button type="button" class="btn btn-amber" id="btn-cmd-send-kitchen">👨‍🍳 Enviar Comanda a Cocina / Barra</button>' +
        '<button type="button" class="btn btn-emerald" data-pos-load-table="' + pkEsc(selTable.id) + '">💵 Pasar Cuenta de ' + pkEsc(selTable.name) + ' a Caja para Cobrar</button>' +
        '</div></div></div>'
      ) : '');
  }
`;
}
