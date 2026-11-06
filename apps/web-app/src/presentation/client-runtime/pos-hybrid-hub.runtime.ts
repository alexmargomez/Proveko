/**
 * Plantilla Operativa 1 (`mod-pos`): Punto de Venta (Facturar), Cotizaciones y Caja.
 * Minimalista e intuitiva: Selección de Cliente (+ botón Nuevo Cliente en modal), Carga de Orden/Mesa abierta,
 * Agregar Producto o Servicio, Carrito con +/- y Cobro en Efectivo, Transferencia, Tarjeta o Crédito.
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
      if (db.diningTables[dt].status !== 'Libre' && db.diningTables[dt].items.length > 0) openTables.push(db.diningTables[dt]);
    }

    var custOpts = '';
    for (var cIdx = 0; cIdx < db.customers.length; cIdx++) {
      var cItem = db.customers[cIdx];
      custOpts += '<option value="' + pkEsc(cItem.id) + '" ' + (cust && cust.id === cItem.id ? 'selected' : '') + '>' +
        pkEsc(cItem.name + ' (' + cItem.docType + ' ' + cItem.nit + ')') + '</option>';
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
      quickLoadHtml = '<div style="margin-top:10px;padding:8px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<span style="font-size:12px;font-weight:700;color:#1e3a8a">⚡ Traer cuenta pendiente a Caja:</span><div class="row-actions">';
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

    var subTotal = 0; var discountTotal = 0; var taxTotal = 0;
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
        '<td><div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-pos-qty-delta="-1" data-pos-idx="' + i + '">-</button>' +
        '<strong style="min-width:24px;text-align:center">' + it.qty + '</strong>' +
        '<button type="button" class="btn btn-outline btn-sm" data-pos-qty-delta="1" data-pos-idx="' + i + '">+</button></div></td>' +
        '<td>' + pkCop(it.price) + '</td>' +
        '<td><strong>' + pkCop(lineNet) + '</strong></td>' +
        '<td><button type="button" class="btn btn-outline btn-sm" data-pos-del-idx="' + i + '">🗑️ Quitar</button></td></tr>';
    }
    if (!cartRowsHtml) {
      cartRowsHtml = '<tr><td colspan="6" style="text-align:center;color:var(--pk-muted);padding:16px">Agrega productos o servicios arriba para iniciar la venta.</td></tr>';
    }
    var grandTotal = subTotal - discountTotal + taxTotal;
    var cashRec = Number(STATE.posCashReceived || grandTotal);
    var changeDue = Math.max(0, cashRec - grandTotal);

    stage.innerHTML =
      '<div class="card"><div class="card-head"><div class="card-title">1. Cliente de la Venta</div>' +
      '<div class="row-actions"><button type="button" class="btn btn-primary btn-sm" data-open-new-customer-modal="1">+ Registrar Nuevo Cliente</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-open-customer-360="' + pkEsc(cust ? cust.id : '') + '">👁️ Ver Historial del Cliente</button></div></div>' +
      '<div class="card-body"><div class="grid-3">' +
      '<div class="field"><label>Seleccionar Cliente</label><select id="pos-select-customer">' + custOpts + '</select></div>' +
      '<div class="field"><label>Vehículo / Placa (Opcional)</label><select id="pos-select-vehicle">' + vehOpts + '</select></div>' +
      '<div class="field"><label>Tarifa / Descuento Aplicado</label><input type="text" readonly value="' + pkEsc((tariff ? tariff.name + ' (-' + tariff.discountPct + '%)' : 'Precio Normal') + (contract && contract.id !== 'cnt-particular' ? ' · Cupo: ' + pkCop(contract.availableBalance) : '')) + '" style="background:#f8fafc;font-weight:700" /></div>' +
      '</div>' + quickLoadHtml + '</div></div>' +

      '<div class="grid-2">' +
      '<div class="card"><div class="card-head"><div class="card-title">📦 2A. Agregar Producto del Inventario</div></div>' +
      '<div class="card-body"><div class="grid-3">' +
      '<div class="field" style="grid-column:span 2"><label>Elegir Producto (o escribir código abajo)</label><select id="pos-select-product">' + prodOpts + '</select></div>' +
      '<div class="field"><label>Cantidad</label><input type="number" id="pos-product-qty" value="1" min="1" /></div>' +
      '</div><div style="margin-top:8px;display:flex;gap:8px;align-items:center">' +
      '<input type="text" id="pos-sku-input" placeholder="Lector de código de barras / SKU (Opcional)" style="flex:1;padding:7px 10px;border:1px solid var(--pk-border);border-radius:8px;font-size:12px" />' +
      '<button type="button" class="btn btn-primary btn-sm" id="btn-pos-add-product">+ Agregar Producto</button></div></div></div>' +

      '<div class="card"><div class="card-head"><div class="card-title">🔧 2B. Agregar Servicio / Mano de Obra</div></div>' +
      '<div class="card-body"><div class="grid-3">' +
      '<div class="field" style="grid-column:span 2"><label>Descripción del Servicio</label><input type="text" id="pos-service-desc" placeholder="Ej: Mantenimiento general / Instalación" /></div>' +
      '<div class="field"><label>Valor ($)</label><input type="number" id="pos-service-price" value="65000" /></div>' +
      '</div><div style="margin-top:8px;display:flex;gap:8px;align-items:center">' +
      '<select id="pos-select-worker" style="flex:1;padding:7px 10px;border:1px solid var(--pk-border);border-radius:8px;font-size:12px">' + workerOpts + '</select>' +
      '<button type="button" class="btn btn-amber btn-sm" id="btn-pos-add-service">+ Agregar Servicio</button></div></div></div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><div class="card-title">🧾 3. Productos y Servicios a Cobrar</div>' +
      '<span class="badge badge-emerald" style="font-size:14px">Total a Pagar: ' + pkCop(grandTotal) + '</span></div>' +
      '<div class="card-body"><div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Tipo</th><th>Descripción</th><th>Cantidad</th><th>Precio Unit.</th><th>Subtotal</th><th>Acción</th></tr></thead><tbody>' + cartRowsHtml + '</tbody></table></div>' +
      '<div class="grid-3" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Medio de Pago</label><select id="pos-payment-method">' +
      '<option value="Efectivo" ' + (STATE.posPaymentMethod === 'Efectivo' ? 'selected' : '') + '>💵 Efectivo</option>' +
      '<option value="Transferencia / Nequi" ' + (STATE.posPaymentMethod === 'Transferencia / Nequi' ? 'selected' : '') + '>📲 Transferencia / Nequi / Daviplata</option>' +
      '<option value="Tarjeta" ' + (STATE.posPaymentMethod === 'Tarjeta' ? 'selected' : '') + '>💳 Tarjeta / Datáfono</option>' +
      '<option value="Crédito / Cartera CxC" ' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC' ? 'selected' : '') + '>📒 Crédito / Fiado (Pasa a Cuentas por Cobrar)</option></select></div>' +
      '<div class="field"><label>' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC' ? 'Abono Inicial Hoy ($)' : 'Dinero Recibido ($)') + '</label><input type="number" id="pos-cash-received" value="' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC' ? (STATE.posCreditInitialAbono || 0) : cashRec) + '" /></div>' +
      '<div class="field"><label>' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC' ? 'Saldo Pendiente por Cobrar' : 'Cambio / Devuelta a Entregar') + '</label>' +
      '<input type="text" readonly value="' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC' ? pkCop(Math.max(0, grandTotal - Number(STATE.posCreditInitialAbono || 0))) : pkCop(changeDue)) + '" style="font-weight:800;color:var(--pk-emerald);background:#fff" /></div>' +
      '</div>' +
      '<div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<div class="row-actions">' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-pos-print-quote">🖨️ Imprimir Cotización (Sin descontar stock)</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-pos-whatsapp-quote">💬 Enviar por WhatsApp</button></div>' +
      '<button type="button" class="btn btn-emerald" id="btn-pos-checkout-invoice">✅ Cobrar y Emitir Factura</button>' +
      '</div></div></div>';
  }
`;
}
