/**
 * Hub Relacional 1 (`pos`): POS Híbrido, Facturación DIAN y Cotizaciones (Inspirado en FactuPOS `sale.jsx` + `DatesRegister.jsx` y `hc_version2` Contratos/Tarifas).
 * Converge en una sola vista: Selector de Cliente (FK) + Contrato/Tarifa (FK) + Vehículo/Placa (FK) con alertas en vivo +
 * Auto-carga de Órdenes Kanban / Mesas abiertas + Lector SKU / Catálogo de Repuestos (FK Bodega) + Mano de Obra con Técnico (FK) +
 * Carrito + Medios de Pago (Efectivo, Digital, Mixto, Crédito CxC con Abono) + Facturar (descuenta Stock, registra Kardex, suma Comisión, consume Contrato, cierra Kanban) +
 * Imprimir Cotización PDF (sin descontar stock) + Enviar por WhatsApp (`wa.me`).
 */
export function renderPosHybridHubRuntimeJs(): string {
  return `
  function pkRenderPosHub() {
    var db = STATE.relDb;
    var container = document.getElementById('ws-converged-hub-container');
    if (!container || !db) return;

    var cust = pkFindById(db.customers, STATE.posCustomerId) || db.customers[0];
    if (cust) STATE.posCustomerId = cust.id;
    var contract = cust && cust.contractId ? pkFindById(db.contracts, cust.contractId) : null;
    var tariff = cust && cust.tariffId ? pkFindById(db.tariffs, cust.tariffId) : null;
    var custVehicles = [];
    for (var v = 0; v < db.vehicles.length; v++) {
      if (!cust || db.vehicles[v].customerId === cust.id) custVehicles.push(db.vehicles[v]);
    }
    var selectedVehicle = pkFindById(db.vehicles, STATE.posVehicleId) || custVehicles[0] || null;
    if (selectedVehicle && !STATE.posVehicleId) STATE.posVehicleId = selectedVehicle.id;

    var pendingOrders = [];
    for (var o = 0; o < db.workOrders.length; o++) {
      var wo = db.workOrders[o];
      if (wo.status !== 'Facturado' && ((cust && wo.customerId === cust.id) || (selectedVehicle && wo.vehicleId === selectedVehicle.id))) {
        pendingOrders.push(wo);
      }
    }
    var openTables = [];
    for (var dt = 0; dt < db.diningTables.length; dt++) {
      if (db.diningTables[dt].status !== 'Libre' && db.diningTables[dt].items.length > 0) openTables.push(db.diningTables[dt]);
    }

    var custOpts = '';
    for (var cIdx = 0; cIdx < db.customers.length; cIdx++) {
      var cItem = db.customers[cIdx];
      custOpts += '<option value="' + pkEsc(cItem.id) + '" ' + (cust && cust.id === cItem.id ? 'selected' : '') + '>' +
        pkEsc(cItem.docType + ' ' + cItem.nit + (cItem.dv ? '-' + cItem.dv : '') + ' — ' + cItem.name + ' (' + cItem.city + ')') + '</option>';
    }
    var vehOpts = '<option value="">— Sin vehículo / Venta mostrador —</option>';
    for (var vIdx = 0; vIdx < db.vehicles.length; vIdx++) {
      var vItem = db.vehicles[vIdx];
      var isOwner = cust && vItem.customerId === cust.id;
      vehOpts += '<option value="' + pkEsc(vItem.id) + '" ' + (selectedVehicle && selectedVehicle.id === vItem.id ? 'selected' : '') + '>' +
        pkEsc(vItem.plate + ' · ' + vItem.brand + ' (' + (isOwner ? 'Del cliente' : vItem.customerName) + ')') + '</option>';
    }
    var prodOpts = '';
    for (var pIdx = 0; pIdx < db.products.length; pIdx++) {
      var pr = db.products[pIdx];
      prodOpts += '<option value="' + pkEsc(pr.id) + '">' + pkEsc('[' + pr.code + '] ' + pr.name + ' — Stock: ' + pr.stock + ' — ' + pkCop(pr.salePrice)) + '</option>';
    }
    var workerOpts = '';
    for (var wIdx = 0; wIdx < db.workers.length; wIdx++) {
      var wk = db.workers[wIdx];
      workerOpts += '<option value="' + pkEsc(wk.id) + '">' + pkEsc(wk.name + ' (' + wk.specialty + ' · Com. ' + wk.commissionPct + '%)') + '</option>';
    }

    var alertsHtml = '';
    if (selectedVehicle) {
      var oilDiff = selectedVehicle.nextOilChangeKm - selectedVehicle.currentKm;
      var oilBadge = oilDiff <= 500
        ? '<span class="badge badge-amber">🛢️ Cambio Aceite urgente (en ' + oilDiff + ' km · Meta: ' + selectedVehicle.nextOilChangeKm + ' km)</span>'
        : '<span class="badge badge-emerald">🛢️ Aceite OK (Próx: ' + selectedVehicle.nextOilChangeKm + ' km)</span>';
      alertsHtml = '<div style="margin-top:8px;padding:8px 10px;background:#f8fafc;border:1px solid var(--pk-border);border-radius:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">' +
        '<div style="font-size:11px"><strong>🚗 Activo Enlazado (FK):</strong> <code>' + pkEsc(selectedVehicle.plate) + '</code> ' + pkEsc(selectedVehicle.brand) + ' · Km actual: <strong>' + selectedVehicle.currentKm.toLocaleString('es-CO') + ' km</strong></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' + oilBadge +
        '<span class="badge badge-blue">📅 SOAT: ' + pkEsc(selectedVehicle.soatExpiry) + '</span>' +
        '<span class="badge badge-slate">🔧 Tecno: ' + pkEsc(selectedVehicle.tecnoExpiry) + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-open-vehicle-360="' + pkEsc(selectedVehicle.id) + '">👁️ Hoja de Vida Placa</button></div></div>';
    }

    var pendingBannerHtml = '';
    if (pendingOrders.length > 0 || openTables.length > 0) {
      pendingBannerHtml += '<div style="margin-top:10px;padding:10px 12px;background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
        '<div style="font-size:12px;color:#1e3a8a"><strong>🔗 Convergencia Automática Detectada:</strong> Hay órdenes de trabajo o mesas activas listas para facturar en caja:</div><div class="row-actions">';
      for (var po = 0; po < pendingOrders.length; po++) {
        var ord = pendingOrders[po];
        pendingBannerHtml += '<button type="button" class="btn btn-primary btn-sm" data-pos-load-order="' + pkEsc(ord.id) + '">⚡ Cargar OT ' + pkEsc(ord.id + ' (' + ord.plate + ' · ' + ord.status + ')') + '</button>';
      }
      for (var ot = 0; ot < openTables.length; ot++) {
        var tbl = openTables[ot];
        pendingBannerHtml += '<button type="button" class="btn btn-emerald btn-sm" data-pos-load-table="' + pkEsc(tbl.id) + '">🍽️ Cargar ' + pkEsc(tbl.name) + ' (' + pkCop(tbl.total) + ')</button>';
      }
      pendingBannerHtml += '</div></div>';
    }

    var subTotal = 0; var discountTotal = 0; var taxTotal = 0;
    var discountPct = tariff ? Number(tariff.discountPct || 0) : 0;
    var cartRowsHtml = '';
    for (var i = 0; i < STATE.posCart.length; i++) {
      var it = STATE.posCart[i];
      var lineGross = Number(it.price || 0) * Number(it.qty || 1);
      var lineDisc = Math.round(lineGross * (discountPct / 100));
      var lineNet = lineGross - lineDisc;
      var lineTax = Math.round(lineNet * (Number(it.taxPct || 0) / 100));
      subTotal += lineGross; discountTotal += lineDisc; taxTotal += lineTax;
      cartRowsHtml += '<tr>' +
        '<td><span class="badge ' + (it.kind === 'SERVICIO' ? 'badge-amber' : 'badge-blue') + '">' + pkEsc(it.kind || 'PRODUCTO') + '</span></td>' +
        '<td><strong>' + pkEsc(it.name) + '</strong><div style="font-size:11px;color:var(--pk-muted)">' +
        (it.workerName ? '👨‍🔧 Técnico FK: ' + pkEsc(it.workerName) : '📦 SKU: ' + pkEsc(it.code || 'CAT')) + '</div></td>' +
        '<td><div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-pos-qty-delta="-1" data-pos-idx="' + i + '">-</button>' +
        '<span style="font-weight:800;min-width:22px;text-align:center">' + it.qty + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-pos-qty-delta="1" data-pos-idx="' + i + '">+</button></div></td>' +
        '<td>' + pkCop(it.price) + '</td>' +
        '<td><strong>' + pkCop(lineNet + lineTax) + '</strong></td>' +
        '<td><button type="button" class="btn btn-outline btn-sm" data-pos-del-idx="' + i + '">🗑️</button></td></tr>';
    }
    if (!cartRowsHtml) {
      cartRowsHtml = '<tr><td colspan="6" style="text-align:center;color:var(--pk-muted);padding:18px">El carrito híbrido está vacío. Selecciona repuestos, mano de obra o carga una Orden Kanban / Mesa arriba.</td></tr>';
    }
    var grandTotal = subTotal - discountTotal + taxTotal;
    var cashRec = Number(STATE.posCashReceived || grandTotal);
    var changeDue = Math.max(0, cashRec - grandTotal);

    container.innerHTML =
      '<div class="card"><div class="card-head"><div>' +
      '<div class="card-title">🛒 1. Datos Relacionales del Cliente, Convenio v2 y Vehículo/Activo (FKs enlazadas)</div>' +
      '<div class="card-sub">Al cambiar de cliente se enlazan sus vehículos, su contrato/tarifa de descuento y sus órdenes pendientes en taller</div></div>' +
      '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-open-customer-360="' + pkEsc(cust ? cust.id : '') + '">👁️ Expediente 360° Cliente</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-pos-quick-new-customer">+ Nuevo Cliente DIAN</button></div></div>' +
      '<div class="card-body">' +
      '<div class="form-grid">' +
      '<div class="field"><label>Cliente / Tercero DIAN (FK -> customers)</label><select id="pos-select-customer">' + custOpts + '</select></div>' +
      '<div class="field"><label>Vehículo / Placa o Activo (FK -> vehicles)</label><select id="pos-select-vehicle">' + vehOpts + '</select></div>' +
      '<div class="field"><label>Contrato / Convenio v2 y Tarifa Aplicada (FK -> contracts)</label>' +
      '<input type="text" readonly value="' + pkEsc((contract ? contract.code + ' · Cupo disp: ' + pkCop(contract.availableBalance) : 'Particular Contado') + ' | ' + (tariff ? tariff.name + ' (-' + tariff.discountPct + '%)' : 'Tarifa Plena')) + '" style="background:#f8fafc;font-weight:700;color:var(--pk-primary)" /></div>' +
      '</div>' + alertsHtml + pendingBannerHtml + '</div></div>' +

      '<div class="grid-2">' +
      '<div class="card"><div class="card-head"><div><div class="card-title">📦 2A. Agregar Repuesto / Producto del Inventario (FK -> products)</div>' +
      '<div class="card-sub">Descuenta stock automáticamente y registra salida en Kardex al facturar</div></div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>Lector Código de Barras / SKU Rápido</label><input type="text" id="pos-sku-input" placeholder="Ej: ACE-20W50 y presiona Enter o clic en Agregar" /></div>' +
      '<div class="field"><label>Catálogo de Productos con Stock en Bodega</label><select id="pos-select-product">' + prodOpts + '</select></div>' +
      '<div class="field"><label>Cantidad</label><input type="number" id="pos-product-qty" value="1" min="1" /></div>' +
      '</div><div style="margin-top:10px;display:flex;justify-content:flex-end"><button type="button" class="btn btn-primary btn-sm" id="btn-pos-add-product">+ Agregar Producto al Carrito</button></div></div></div>' +

      '<div class="card"><div class="card-head"><div><div class="card-title">🔧 2B. Agregar Mano de Obra / Servicio con Técnico (FK -> workers)</div>' +
      '<div class="card-sub">Liquida automáticamente comisión para el mecánico/profesional asignado</div></div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>Descripción del Servicio / Procedimiento</label><input type="text" id="pos-service-desc" placeholder="Ej: Sincronización full inyección / Mantenimiento" /></div>' +
      '<div class="field"><label>Valor Mano de Obra (COP)</label><input type="number" id="pos-service-price" value="65000" /></div>' +
      '<div class="field"><label>Técnico / Profesional Ejecutor (FK -> workers)</label><select id="pos-select-worker">' + workerOpts + '</select></div>' +
      '</div><div style="margin-top:10px;display:flex;justify-content:flex-end"><button type="button" class="btn btn-amber btn-sm" id="btn-pos-add-service">+ Agregar Mano de Obra al Carrito</button></div></div></div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><div><div class="card-title">🧾 3. Carrito Maestro-Detalle, Liquidación y Cierre Relacional</div>' +
      '<div class="card-sub">Cotiza sin descontar inventario o factura ejecutando todas las llaves foráneas en una sola transacción</div></div>' +
      '<span class="badge badge-emerald" style="font-size:13px">Total Neto: ' + pkCop(grandTotal) + '</span></div>' +
      '<div class="card-body"><div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Tipo</th><th>Concepto / Vínculo FK</th><th>Cant.</th><th>Vlr. Unit</th><th>Subtotal</th><th></th></tr></thead><tbody>' + cartRowsHtml + '</tbody></table></div>' +
      '<div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Medio de Pago</label><select id="pos-payment-method">' +
      '<option value="Efectivo" ' + (STATE.posPaymentMethod === 'Efectivo' ? 'selected' : '') + '>💵 Efectivo en Caja</option>' +
      '<option value="Transferencia / Nequi" ' + (STATE.posPaymentMethod === 'Transferencia / Nequi' ? 'selected' : '') + '>📲 Transferencia / Nequi / Daviplata</option>' +
      '<option value="Tarjeta" ' + (STATE.posPaymentMethod === 'Tarjeta' ? 'selected' : '') + '>💳 Datáfono / Tarjeta</option>' +
      '<option value="Pago Mixto" ' + (STATE.posPaymentMethod === 'Pago Mixto' ? 'selected' : '') + '>⚖️ Pago Mixto (Efectivo + Transferencia)</option>' +
      '<option value="Crédito / Cartera CxC" ' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC' ? 'selected' : '') + '>📒 Crédito / Enviar a Cartera CxC (Con Abono)</option></select></div>' +
      '<div class="field"><label>Efectivo Recibido / Abono Inicial (COP)</label><input type="number" id="pos-cash-received" value="' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC' ? (STATE.posCreditInitialAbono || 0) : cashRec) + '" /></div>' +
      '<div class="field"><label>Resumen Financiero y Vueltos / Saldo CxC</label>' +
      '<input type="text" readonly value="' + (STATE.posPaymentMethod === 'Crédito / Cartera CxC'
        ? ('Saldo a Cartera CxC: ' + pkCop(Math.max(0, grandTotal - Number(STATE.posCreditInitialAbono || 0))))
        : ('Sub: ' + pkCop(subTotal) + ' | Dto: -' + pkCop(discountTotal) + ' | Cambio: ' + pkCop(changeDue))) + '" style="font-weight:800;color:var(--pk-emerald);background:#fff" /></div>' +
      '</div>' +
      '<div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
      '<div class="row-actions">' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-pos-print-quote">🖨️ Imprimir Cotización PDF (Sin descontar Stock)</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-pos-whatsapp-quote">💬 Enviar Cotización por WhatsApp</button>' +
      '</div>' +
      '<button type="button" class="btn btn-emerald" id="btn-pos-checkout-invoice">🧾 Facturar Electrónicamente y Ejecutar Cruces FK</button>' +
      '</div></div></div>';
  }
`;
}
