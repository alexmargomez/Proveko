/**
 * Plantilla Operativa 1 (`mod-pos`): Punto de Venta (Facturar), Cotizaciones y Caja a Pantalla Completa.
 * Diseño a 2 columnas (Izquierda: Cliente + Agregar Producto/Servicio; Derecha: Carrito y Pago en Caja)
 * + Tabla inferior de Facturas Emitidas con botones de impresión y abono (<= 200 líneas).
 */
export function renderPosHybridHubRuntimeJs(): string {
  return `
  function pkRenderPosHub() {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;

    var cust = pkFindById(db.customers, STATE.posCustomerId) || db.customers[0];
    if (cust) STATE.posCustomerId = cust.id;
    var contract = cust && cust.contractId ? pkFindById(db.contracts, cust.contractId) : null;
    var tariff = cust && cust.tariffId ? pkFindById(db.tariffs, cust.tariffId) : null;
    var selectedVehicle = pkFindById(db.vehicles, STATE.posVehicleId) || null;

    var pendingOrders = [];
    for (var o = 0; o < db.workOrders.length; o++) {
      if (db.workOrders[o].status !== 'Facturado') pendingOrders.push(db.workOrders[o]);
    }
    var openTables = [];
    for (var dt = 0; dt < db.diningTables.length; dt++) {
      if (db.diningTables[dt].status !== 'Libre' && db.diningTables[dt].items && db.diningTables[dt].items.length > 0) openTables.push(db.diningTables[dt]);
    }

    var custOpts = '';
    for (var cIdx = 0; cIdx < db.customers.length; cIdx++) {
      var cItem = db.customers[cIdx];
      custOpts += '<option value="' + pkEsc(cItem.id) + '" ' + (cust && cust.id === cItem.id ? 'selected' : '') + '>' +
        pkEsc(cItem.name + ' (' + (cItem.docType || 'NIT') + ' ' + cItem.nit + ')') + '</option>';
    }
    var vehOpts = '<option value="">— Venta de Mostrador (Sin vehículo) —</option>';
    for (var vIdx = 0; vIdx < db.vehicles.length; vIdx++) {
      var vItem = db.vehicles[vIdx];
      vehOpts += '<option value="' + pkEsc(vItem.id) + '" ' + (selectedVehicle && selectedVehicle.id === vItem.id ? 'selected' : '') + '>' +
        pkEsc(vItem.plate + ' — ' + vItem.brand + ' (' + vItem.customerName + ')') + '</option>';
    }
    var prodOpts = '';
    for (var pIdx = 0; pIdx < db.products.length; pIdx++) {
      var pr = db.products[pIdx];
      prodOpts += '<option value="' + pkEsc(pr.id) + '">' + pkEsc(pr.name + ' [' + pr.code + '] — Stock: ' + pr.stock + ' — ' + pkCop(pr.salePrice)) + '</option>';
    }
    var workerOpts = '';
    for (var wIdx = 0; wIdx < db.workers.length; wIdx++) {
      var wk = db.workers[wIdx];
      workerOpts += '<option value="' + pkEsc(wk.id) + '">' + pkEsc(wk.name + ' (' + wk.specialty + ')') + '</option>';
    }

    var quickLoadHtml = '';
    if (pendingOrders.length > 0 || openTables.length > 0) {
      quickLoadHtml = '<div style="margin-top:10px;padding:9px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<span style="font-size:12px;font-weight:700;color:#1e3a8a">⚡ Pasar a Caja para cobrar:</span><div class="row-actions">';
      for (var po = 0; po < pendingOrders.length; po++) {
        var ord = pendingOrders[po];
        quickLoadHtml += '<button type="button" class="btn btn-primary btn-sm" data-pos-load-order="' + pkEsc(ord.id) + '">🔧 Orden ' + pkEsc(ord.plate) + ' (' + pkCop(ord.totalEstimated) + ')</button>';
      }
      for (var ot = 0; ot < openTables.length; ot++) {
        var tbl = openTables[ot];
        quickLoadHtml += '<button type="button" class="btn btn-emerald btn-sm" data-pos-load-table="' + pkEsc(tbl.id) + '">🍽️ ' + pkEsc(tbl.name) + ' (' + pkCop(tbl.total) + ')</button>';
      }
      quickLoadHtml += '</div></div>';
    }

    var subTotal = 0; var discountTotal = 0;
    var discountPct = tariff ? Number(tariff.discountPct || 0) : 0;
    var cartRowsHtml = '';
    for (var i = 0; i < STATE.posCart.length; i++) {
      var it = STATE.posCart[i];
      var lineGross = Number(it.price || 0) * Number(it.qty || 1);
      var lineDisc = Math.round(lineGross * (discountPct / 100));
      var lineNet = lineGross - lineDisc;
      subTotal += lineGross; discountTotal += lineDisc;
      cartRowsHtml += '<tr>' +
        '<td><span class="badge ' + (it.kind === 'SERVICIO' ? 'badge-amber' : 'badge-blue') + '">' + pkEsc(it.kind === 'SERVICIO' ? 'Servicio' : 'Producto') + '</span></td>' +
        '<td><strong>' + pkEsc(it.name) + '</strong>' + (it.workerName ? '<div style="font-size:11px;color:var(--pk-muted)">Técnico: ' + pkEsc(it.workerName) + '</div>' : '') + '</td>' +
        '<td><div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-pos-qty-delta="-1" data-pos-idx="' + i + '">➖</button>' +
        '<strong style="min-width:22px;text-align:center">' + it.qty + '</strong>' +
        '<button type="button" class="btn btn-outline btn-sm" data-pos-qty-delta="1" data-pos-idx="' + i + '">➕</button></div></td>' +
        '<td>' + pkCop(it.price) + '</td>' +
        '<td><strong>' + pkCop(lineNet) + '</strong></td>' +
        '<td><button type="button" class="btn btn-outline btn-sm" style="color:var(--pk-rose)" data-pos-del-idx="' + i + '">🗑️</button></td></tr>';
    }
    if (!cartRowsHtml) {
      cartRowsHtml = '<tr><td colspan="6" style="text-align:center;color:var(--pk-muted);padding:18px">El carrito está vacío. Agrega un producto o servicio a la izquierda.</td></tr>';
    }
    var grandTotal = subTotal - discountTotal;
    var cashRec = Number(STATE.posCashReceived || grandTotal);
    var changeDue = Math.max(0, cashRec - grandTotal);

    var recentInvRows = '';
    for (var r = 0; r < Math.min(6, db.invoices.length); r++) {
      var inv = db.invoices[r];
      recentInvRows += '<tr><td><strong>' + pkEsc(inv.id) + '</strong></td><td>' + pkEsc(inv.date) + '</td><td>' + pkEsc(inv.customerName) + '</td>' +
        '<td>' + pkEsc(inv.paymentMethod) + '</td><td><strong>' + pkCop(inv.total) + '</strong></td>' +
        '<td><span class="badge ' + (inv.pendingBalance > 0 ? 'badge-amber' : 'badge-emerald') + '">' + (inv.pendingBalance > 0 ? 'Debe ' + pkCop(inv.pendingBalance) : 'Pagada') + '</span></td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" data-open-invoice-modal="' + pkEsc(inv.id) + '">👁️ Ver</button>' +
        '<button type="button" class="btn btn-primary btn-sm" data-print-invoice="' + pkEsc(inv.id) + '">🖨️ Imprimir</button>' +
        (inv.pendingBalance > 0 ? '<button type="button" class="btn btn-emerald btn-sm" data-open-abono-modal="' + pkEsc(inv.id) + '">💵 Abonar</button>' : '') +
        '</div></td></tr>';
    }

    stage.innerHTML =
      '<div class="grid-2" style="align-items:start">' +
      '<div>' +
      '<div class="card"><div class="card-head"><div class="card-title">👤 1. Cliente de la Venta</div>' +
      '<div class="row-actions"><button type="button" class="btn btn-primary btn-sm" data-open-new-customer-modal="1">+ Nuevo Cliente</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-open-customer-360="' + pkEsc(cust ? cust.id : '') + '">👁️ Ficha del Cliente</button></div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>Seleccionar Cliente</label><select id="pos-select-customer">' + custOpts + '</select></div>' +
      '<div class="field"><label>Vehículo / Referencia (Opcional)</label><select id="pos-select-vehicle">' + vehOpts + '</select></div>' +
      '<div class="field"><label>Lista de Precios / Convenio</label><input type="text" readonly value="' + pkEsc((tariff ? tariff.name + ' (-' + tariff.discountPct + '%)' : 'Precio General') + (contract && contract.id !== 'cnt-particular' ? ' · Cupo: ' + pkCop(contract.availableBalance) : '')) + '" style="background:#f8fafc;font-weight:700" /></div>' +
      '</div>' + quickLoadHtml + '</div></div>' +

      '<div class="card"><div class="card-head"><div class="card-title">📦 2A. Agregar Producto del Inventario</div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field" style="grid-column:span 2"><label>Elegir Producto</label><select id="pos-select-product">' + prodOpts + '</select></div>' +
      '<div class="field"><label>Cantidad</label><input type="number" id="pos-product-qty" value="1" min="1" /></div>' +
      '</div><div style="margin-top:10px;display:flex;gap:8px;align-items:center">' +
      '<input type="text" id="pos-sku-input" placeholder="Lector código de barras / SKU (Opcional)" style="flex:1;padding:8px 11px;border:1px solid var(--pk-border);border-radius:8px;font-size:13px" />' +
      '<button type="button" class="btn btn-primary" id="btn-pos-add-product">+ Agregar Producto</button></div></div></div>' +

      '<div class="card"><div class="card-head"><div class="card-title">🔧 2B. Agregar Servicio / Mano de Obra</div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field" style="grid-column:span 2"><label>Descripción del Servicio</label><input type="text" id="pos-service-desc" placeholder="Ej: Instalación, Mantenimiento o Consulta" /></div>' +
      '<div class="field"><label>Valor ($)</label><input type="number" id="pos-service-price" value="65000" /></div>' +
      '</div><div style="margin-top:10px;display:flex;gap:8px;align-items:center">' +
      '<select id="pos-select-worker" style="flex:1;padding:8px 11px;border:1px solid var(--pk-border);border-radius:8px;font-size:13px">' + workerOpts + '</select>' +
      '<button type="button" class="btn btn-amber" id="btn-pos-add-service">+ Agregar Servicio</button></div></div></div>' +
      '</div>' +

      '<div class="card" style="border:2px solid #023047"><div class="card-head" style="background:#023047;color:#fff">' +
      '<div class="card-title" style="color:#fff;font-size:15px">🧾 3. Cuenta a Cobrar en Caja</div>' +
      '<span class="badge badge-amber" style="font-size:14px;padding:5px 12px">Total: ' + pkCop(grandTotal) + '</span></div>' +
      '<div class="card-body"><div class="table-wrap" style="margin-bottom:14px"><table><thead><tr><th>Tipo</th><th>Descripción</th><th>Cant.</th><th>Unitario</th><th>Subtotal</th><th></th></tr></thead><tbody>' + cartRowsHtml + '</tbody></table></div>' +
      '<div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Medio de Pago</label><select id="pos-payment-method">' +
      '<option value="Efectivo" ' + (STATE.posPaymentMethod === 'Efectivo' ? 'selected' : '') + '>💵 Efectivo</option>' +
      '<option value="Transferencia / Nequi" ' + (STATE.posPaymentMethod === 'Transferencia / Nequi' ? 'selected' : '') + '>📲 Transferencia / Nequi / QR</option>' +
      '<option value="Tarjeta" ' + (STATE.posPaymentMethod === 'Tarjeta' ? 'selected' : '') + '>💳 Tarjeta / Datáfono</option>' +
      '<option value="Crédito / Cartera CxC" ' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC' ? 'selected' : '') + '>📒 Crédito / Fiado (Pasa a Cartera)</option></select></div>' +
      '<div class="field"><label>' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC' ? 'Abono Inicial Hoy ($)' : 'Efectivo Recibido ($)') + '</label><input type="number" id="pos-cash-received" value="' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC' ? (STATE.posCreditInitialAbono || 0) : cashRec) + '" /></div>' +
      '<div class="field"><label>' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC' ? 'Saldo Pendiente por Cobrar' : 'Cambio a Devolver') + '</label>' +
      '<input type="text" readonly value="' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC' ? pkCop(Math.max(0, grandTotal - Number(STATE.posCreditInitialAbono || 0))) : pkCop(changeDue)) + '" style="font-weight:800;color:var(--pk-emerald);background:#fff" /></div>' +
      '</div>' +
      '<div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<div class="row-actions">' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-pos-print-quote">🖨️ Cotización</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-pos-whatsapp-quote">💬 WhatsApp</button></div>' +
      '<button type="button" class="btn btn-emerald" style="font-size:14px;padding:10px 20px" id="btn-pos-checkout-invoice">✅ Cobrar y Emitir Factura</button>' +
      '</div></div></div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><div class="card-title">📋 Últimas Facturas Emitidas en Caja</div>' +
      '<button type="button" class="btn btn-outline btn-sm" data-export-csv="invoices">📥 Descargar Excel</button></div>' +
      '<div class="card-body"><div class="table-wrap"><table><thead><tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th>Medio de Pago</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>' + recentInvRows + '</tbody></table></div></div></div>';
  }
`;
}
