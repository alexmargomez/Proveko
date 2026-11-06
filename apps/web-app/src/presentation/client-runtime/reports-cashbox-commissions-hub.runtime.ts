/**
 * Hub Relacional 5 (`reports`) y Hub 6 (`gastro`):
 * - `reports`: Arqueo de Caja Real (Efectivo Neto, Utilidad Neta, Digital, CxC), Gastos Menores, Liquidación de Comisiones de Técnicos y Exportación CSV UTF-8 BOM (Inspirado en FactuPOS `report.jsx`).
 * - `gastro`: Mapa de Mesas, Comandas KDS y Pase directo de Cuenta a Caja POS.
 */
export function renderReportsCashboxCommissionsHubRuntimeJs(): string {
  return `
  function pkRenderReportsAndCashboxHub() {
    var db = STATE.relDb;
    var container = document.getElementById('ws-converged-hub-container');
    if (!container || !db) return;

    var totalInvoiced = 0; var cashIn = 0; var digitalIn = 0; var totalCxc = 0; var partsProfit = 0;
    for (var i = 0; i < db.invoices.length; i++) {
      var inv = db.invoices[i];
      totalInvoiced += Number(inv.total || 0);
      totalCxc += Number(inv.pendingBalance || 0);
      var paid = Number(inv.amountPaid || 0);
      if (inv.paymentMethod === 'Efectivo' || inv.paymentMethod === 'Crédito / Cartera CxC') cashIn += paid;
      else digitalIn += paid;
      var items = inv.items || [];
      for (var k = 0; k < items.length; k++) {
        if (items[k].kind === 'PRODUCTO') {
          var pr = pkFindById(db.products, items[k].refId);
          var unitCost = pr ? Number(pr.costPrice || 0) : Math.round(Number(items[k].price || 0) * 0.6);
          partsProfit += (Number(items[k].price || 0) - unitCost) * Number(items[k].qty || 1);
        }
      }
    }

    var cashExpenses = 0; var totalExpenses = 0;
    var expRows = '';
    for (var e = 0; e < db.expenses.length; e++) {
      var ex = db.expenses[e];
      totalExpenses += Number(ex.amount || 0);
      if (ex.paymentSource === 'Efectivo Caja') cashExpenses += Number(ex.amount || 0);
      expRows += '<tr><td><code>' + pkEsc(ex.id) + '</code></td><td>' + pkEsc(ex.date) + '</td><td><span class="badge badge-slate">' + pkEsc(ex.category) + '</span></td><td><strong>' + pkEsc(ex.description) + '</strong></td><td>' + pkEsc(ex.paymentSource) + '</td><td style="color:var(--pk-amber);font-weight:800">-' + pkCop(ex.amount) + '</td></tr>';
    }

    var netCashInBox = cashIn - cashExpenses;

    var wkRows = '';
    for (var w = 0; w < db.workers.length; w++) {
      var wk = db.workers[w];
      var gross = Number(wk.totalDayGross || 0);
      var techPay = Math.round(gross * (Number(wk.commissionPct || 40) / 100));
      var bizCut = gross - techPay;
      wkRows += '<tr>' +
        '<td><strong>' + pkEsc(wk.name) + '</strong><div style="font-size:11px;color:var(--pk-muted)">' + pkEsc(wk.specialty) + ' · 📞 ' + pkEsc(wk.phone) + '</div></td>' +
        '<td><span class="badge badge-blue">' + wk.commissionPct + '% Técnico / ' + (100 - wk.commissionPct) + '% Empresa</span></td>' +
        '<td>' + pkCop(gross) + '</td>' +
        '<td style="color:var(--pk-primary);font-weight:800">' + pkCop(techPay) + '</td>' +
        '<td style="color:var(--pk-emerald);font-weight:800">' + pkCop(bizCut) + '</td>' +
        '<td>' + (gross > 0
          ? '<button type="button" class="btn btn-emerald btn-sm" data-settle-worker="' + pkEsc(wk.id) + '">⚡ Liquidar Turno (' + pkCop(techPay) + ')</button>'
          : '<span class="badge badge-slate">✓ Turno en $0</span>') + '</td></tr>';
    }

    var stRows = '';
    for (var s = 0; s < db.settlements.length; s++) {
      var st = db.settlements[s];
      stRows += '<tr><td><code>' + pkEsc(st.id) + '</code></td><td>' + pkEsc(st.date) + '</td><td><strong>' + pkEsc(st.workerName) + '</strong></td><td>' + pkCop(st.grossLabor) + '</td><td>' + st.commissionPct + '%</td><td style="color:var(--pk-primary);font-weight:800">' + pkCop(st.technicianPayout) + '</td><td style="color:var(--pk-emerald);font-weight:800">' + pkCop(st.companyRetention) + '</td></tr>';
    }

    container.innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Efectivo Neto Real en Gaveta (Ingresos - Gastos)</div><div class="kpi-val" style="color:var(--pk-emerald)">' + pkCop(netCashInBox) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Ingresos Digitales (Transferencias / Tarjeta)</div><div class="kpi-val" style="color:var(--pk-primary)">' + pkCop(digitalIn) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Utilidad Neta en Repuestos + Total Facturado</div><div class="kpi-val">+' + pkCop(partsProfit) + ' / ' + pkCop(totalInvoiced) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Cartera por Cobrar CxC / Gastos Menores</div><div class="kpi-val" style="color:var(--pk-amber)">CxC: ' + pkCop(totalCxc) + ' · Gastos: -' + pkCop(totalExpenses) + '</div></div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><div>' +
      '<div class="card-title">📥 Exportación Ejecutiva a Excel CSV (UTF-8 con BOM Compatible con Excel)</div>' +
      '<div class="card-sub">Descarga al instante las tablas relacionales enlazadas de la plataforma</div></div>' +
      '<div class="row-actions">' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="invoices">📊 Exportar Ventas y Facturas (.CSV)</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="inventory">📦 Exportar Inventario Valorizado (.CSV)</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="expenses">💸 Exportar Gastos Caja (.CSV)</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="settlements">👨‍🔧 Exportar Liquidaciones (.CSV)</button>' +
      '</div></div></div>' +

      '<div class="card"><div class="card-head"><div>' +
      '<div class="card-title">👨‍🔧 1. Liquidación de Comisiones de Técnicos / Profesionales (FK -> workers, settlements)</div>' +
      '<div class="card-sub">Cada servicio facturado en el POS suma automáticamente al acumulado del técnico; liquida su turno con un clic</div></div></div>' +
      '<div class="card-body"><div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Técnico / Profesional</th><th>Esquema Comisión</th><th>Producido Bruto Hoy</th><th>Pago al Técnico</th><th>Utilidad Empresa</th><th>Acción</th></tr></thead><tbody>' + wkRows + '</tbody></table></div>' +
      '<div class="form-grid" style="background:#f8fafc;padding:10px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Nombre Nuevo Técnico / Profesional</label><input type="text" id="wk-new-name" placeholder="Ej: Jorge Iván Ríos" /></div>' +
      '<div class="field"><label>Especialidad / Área</label><input type="text" id="wk-new-spec" placeholder="Ej: Diagnóstico Electrónico / Especialista" /></div>' +
      '<div class="field"><label>% Comisión Técnico</label><div class="row-actions"><input type="number" id="wk-new-pct" value="40" min="5" max="90" style="flex:1" />' +
      '<button type="button" class="btn btn-primary btn-sm" id="btn-wk-add">+ Vincular Técnico</button></div></div></div>' +
      (stRows ? '<div style="margin-top:12px"><div style="font-size:12px;font-weight:800;margin-bottom:6px">Historial de Turnos Liquidados:</div><div class="table-wrap"><table><thead><tr><th>ID</th><th>Fecha</th><th>Técnico</th><th>Bruto</th><th>%</th><th>Pagado Técnico</th><th>Retención Empresa</th></tr></thead><tbody>' + stRows + '</tbody></table></div></div>' : '') +
      '</div></div>' +

      '<div class="card"><div class="card-head"><div>' +
      '<div class="card-title">💸 2. Control de Gastos de Caja Menor y Egresos Operativos</div>' +
      '<div class="card-sub">Los gastos pagados en Efectivo Caja se descuentan automáticamente del Efectivo Neto en Gaveta</div></div></div>' +
      '<div class="card-body"><div class="form-grid" style="margin-bottom:12px">' +
      '<div class="field"><label>Concepto / Descripción del Gasto</label><input type="text" id="exp-new-desc" placeholder="Ej: Compra insumos aseo / Domicilio repuestos" /></div>' +
      '<div class="field"><label>Categoría</label><select id="exp-new-cat"><option value="Insumos Operativos">Insumos Operativos</option><option value="Servicios Públicos">Servicios Públicos</option><option value="Transporte / Fletes">Transporte / Fletes</option><option value="Mantenimiento">Mantenimiento</option></select></div>' +
      '<div class="field"><label>Origen del Dinero y Valor (COP)</label><div class="row-actions">' +
      '<select id="exp-new-source" style="width:140px"><option value="Efectivo Caja">Efectivo Caja</option><option value="Transferencia Bancaria">Banco / Nequi</option></select>' +
      '<input type="number" id="exp-new-amount" value="25000" style="flex:1" />' +
      '<button type="button" class="btn btn-amber btn-sm" id="btn-exp-add">+ Registrar Gasto</button></div></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>ID</th><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Origen</th><th>Monto</th></tr></thead><tbody>' + expRows + '</tbody></table></div></div></div>';
  }

  function pkRenderGastroHub() {
    var db = STATE.relDb;
    var container = document.getElementById('ws-converged-hub-container');
    if (!container || !db) return;
    var cards = '';
    for (var i = 0; i < db.diningTables.length; i++) {
      var t = db.diningTables[i];
      var itemsHtml = '';
      for (var j = 0; j < t.items.length; j++) {
        itemsHtml += '<div style="font-size:11px;display:flex;justify-content:space-between"><span>' + t.items[j].qty + 'x ' + pkEsc(t.items[j].name) + '</span><strong>' + pkCop(t.items[j].price * t.items[j].qty) + '</strong></div>';
      }
      cards += '<div class="card"><div class="card-head"><div><div class="card-title">🍽️ ' + pkEsc(t.name) + ' (' + pkEsc(t.zone) + ')</div>' +
        '<div class="card-sub">Mesero: ' + pkEsc(t.waiter) + ' · Comensales: ' + t.diners + '</div></div>' +
        '<span class="badge ' + (t.status === 'Libre' ? 'badge-slate' : (t.status === 'Cuenta' ? 'badge-amber' : 'badge-emerald')) + '">' + pkEsc(t.status) + '</span></div>' +
        '<div class="card-body"><div style="background:#f8fafc;padding:8px;border-radius:8px;min-height:54px;margin-bottom:8px">' + (itemsHtml || '<span style="font-size:11px;color:var(--pk-muted)">Mesa disponible sin comanda activa</span>') + '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<strong>Total: ' + pkCop(t.total) + '</strong>' +
        (t.total > 0 ? '<button type="button" class="btn btn-emerald btn-sm" data-pos-load-table="' + pkEsc(t.id) + '">🛒 Pasar Cuenta a Caja POS</button>' : '<button type="button" class="btn btn-outline btn-sm" data-gastro-add-demo="' + pkEsc(t.id) + '">+ Comanda Rápida</button>') +
        '</div></div></div>';
    }
    container.innerHTML = '<div class="grid-3">' + cards + '</div>';
  }
`;
}
