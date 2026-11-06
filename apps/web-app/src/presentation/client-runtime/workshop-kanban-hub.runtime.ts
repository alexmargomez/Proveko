/**
 * Plantilla Operativa 3 (`srv-workshop` y `srv-hospitality` <= 200 líneas):
 * - `pkRenderKanbanHub`: Taller, Vehículos y Comisiones con Impresión de Orden de Trabajo y Selectores Normalizados.
 * - `pkRenderHotelHub`: Recepción Hotelera, Check-In con Selección de Huésped/Habitación, Cargos e Impresión de Cuenta Hotelera.
 */
export function renderWorkshopKanbanHubRuntimeJs(): string {
  return `
  function pkRenderKanbanHub(subKey) {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;

    if (subKey === 'mod-vehicles-assets') {
      var vRows = '';
      for (var v = 0; v < db.vehicles.length; v++) {
        var ve = db.vehicles[v];
        var oilDiff = ve.nextOilChangeKm - ve.currentKm;
        vRows += '<tr><td><span class="badge badge-blue">🚗 ' + pkEsc(ve.plate) + '</span></td>' +
          '<td><strong>' + pkEsc(ve.brand) + '</strong> (' + pkEsc(ve.modelYear || '2025') + ')</td>' +
          '<td><strong>' + pkEsc(ve.customerName) + '</strong></td>' +
          '<td>Actual: <strong>' + Number(ve.currentKm || 0).toLocaleString('es-CO') + ' km</strong> · Próx: ' + Number(ve.nextOilChangeKm || 0).toLocaleString('es-CO') + ' km ' +
          (oilDiff <= 500 ? '<span class="badge badge-amber">⚠️ Cambio Pronto</span>' : '') + '</td>' +
          '<td>SOAT: ' + pkEsc(ve.soatExpiry) + '</td>' +
          '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-outline btn-sm" data-open-vehicle-360="' + pkEsc(ve.id) + '">👁️ Historial</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-print-veh="' + pkEsc(ve.id) + '">🖨️ Imprimir</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-veh-delete-id="' + pkEsc(ve.id) + '">🗑️</button></div></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">🚗 Vehículos y Placas Registradas (' + db.vehicles.length + ')</div>' +
        '<button type="button" class="btn btn-primary btn-sm" data-open-quick-entity="VEHICLE">+ Registrar Nueva Placa / Vehículo</button></div>' +
        '<div class="card-body"><div class="table-wrap"><table><thead><tr><th>Placa</th><th>Marca y Línea</th><th>Propietario</th><th>Kilometraje / Aceite</th><th>SOAT</th><th>Acciones</th></tr></thead><tbody>' + vRows + '</tbody></table></div></div></div>';
      return;
    }

    if (subKey === 'mod-worker-commissions') {
      var wkRows = '';
      for (var w = 0; w < db.workers.length; w++) {
        var wk = db.workers[w];
        var gross = Number(wk.totalDayGross || 0);
        var techPay = Math.round(gross * (Number(wk.commissionPct || 40) / 100));
        wkRows += '<tr><td><strong>' + pkEsc(wk.name) + '</strong><div style="font-size:11px;color:var(--pk-muted)">' + pkEsc(wk.specialty) + '</div></td>' +
          '<td><span class="badge badge-blue">' + wk.commissionPct + '% Técnico</span></td><td>' + pkCop(gross) + '</td>' +
          '<td style="color:var(--pk-primary);font-weight:800">' + pkCop(techPay) + '</td><td style="color:var(--pk-emerald);font-weight:800">' + pkCop(gross - techPay) + '</td>' +
          '<td><div class="row-actions">' + (gross > 0 ? '<button type="button" class="btn btn-emerald btn-sm" data-settle-worker="' + pkEsc(wk.id) + '">⚡ Liquidar (' + pkCop(techPay) + ')</button>' : '<span class="badge badge-slate">✓ Al día</span>') +
          '<button type="button" class="btn btn-outline btn-sm" data-print-worker="' + pkEsc(wk.id) + '">🖨️ Comprobante</button></div></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">👷 Comisiones de Técnicos y Especialistas</div></div>' +
        '<div class="card-body"><div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
        '<div class="field"><label>Nombre del Técnico / Profesional</label><input type="text" id="wk-new-name" placeholder="Ej: Jorge Iván Ríos" /></div>' +
        '<div class="field"><label>Especialidad / Cargo</label><select id="wk-new-spec"><option>Mecánica General y Sincronización</option><option>Electricidad y Escáner</option><option>Frenos, Suspensión y Alineación</option><option>Latonería y Pintura</option><option>Especialista de Servicio</option></select></div>' +
        '<div class="field"><label>% Comisión</label><div class="row-actions"><select id="wk-new-pct" style="flex:1"><option value="30">30%</option><option value="40" selected>40%</option><option value="45">45%</option><option value="50">50%</option></select>' +
        '<button type="button" class="btn btn-primary" id="btn-wk-add">+ Agregar Técnico</button></div></div></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Técnico</th><th>Porcentaje</th><th>Producido Hoy</th><th>Pago Técnico</th><th>Utilidad Empresa</th><th>Acciones</th></tr></thead><tbody>' + wkRows + '</tbody></table></div></div></div>';
      return;
    }

    var stages = ['Recibido', 'En Diagnóstico', 'Esperando Repuesto', 'En Proceso', 'Listo para Entrega'];
    var stageBadges = ['badge-slate', 'badge-blue', 'badge-amber', 'badge-blue', 'badge-emerald'];
    var custOpts = ''; for (var c = 0; c < db.customers.length; c++) custOpts += '<option value="' + pkEsc(db.customers[c].id) + '">' + pkEsc(db.customers[c].name) + '</option>';
    var vehOpts = ''; for (var vp = 0; vp < db.vehicles.length; vp++) vehOpts += '<option value="' + pkEsc(db.vehicles[vp].plate) + '" data-brand="' + pkEsc(db.vehicles[vp].brand) + '">' + pkEsc(db.vehicles[vp].plate + ' — ' + db.vehicles[vp].brand) + '</option>';
    var workerOpts = ''; for (var wkIdx = 0; wkIdx < db.workers.length; wkIdx++) workerOpts += '<option value="' + pkEsc(db.workers[wkIdx].id) + '">' + pkEsc(db.workers[wkIdx].name + ' — ' + db.workers[wkIdx].specialty) + '</option>';
    var nextWoCode = 'OT-' + (3041 + db.workOrders.length);

    var columnsHtml = '';
    for (var s = 0; s < stages.length; s++) {
      var stg = stages[s]; var cardsHtml = ''; var count = 0;
      for (var o = 0; o < db.workOrders.length; o++) {
        var wo = db.workOrders[o]; if (wo.status !== stg) continue; count++;
        var svcsSummary = ''; for (var k = 0; k < (wo.services || []).length; k++) svcsSummary += '<div style="font-size:11px">• ' + pkEsc(wo.services[k].description) + '</div>';
        var nextStage = s < stages.length - 1 ? stages[s + 1] : null; var prevStage = s > 0 ? stages[s - 1] : null;
        cardsHtml += '<div style="background:#fff;border:1px solid var(--pk-border);border-radius:10px;padding:10px;margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="badge ' + stageBadges[s] + '">🚗 ' + pkEsc(wo.plate) + '</span><strong style="font-size:12px;color:var(--pk-emerald)">' + pkCop(wo.totalEstimated) + '</strong></div>' +
          '<div style="font-size:12px;font-weight:800">' + pkEsc(wo.id + ' · ' + wo.vehicleBrand) + '</div>' +
          '<div style="font-size:11px;color:var(--pk-muted);margin-bottom:6px">👤 ' + pkEsc(wo.customerName) + '<br/>👷 ' + pkEsc(wo.workerName) + '</div>' +
          '<div style="background:#f8fafc;padding:6px;border-radius:6px;margin-bottom:6px">' + svcsSummary + '</div>' +
          '<div class="row-actions" style="justify-content:space-between;margin-bottom:6px">' +
          (prevStage ? '<button type="button" class="btn btn-outline btn-sm" style="padding:3px 7px;font-size:10px" data-wo-move="' + pkEsc(wo.id) + '" data-wo-stage="' + pkEsc(prevStage) + '">&larr;</button>' : '<span></span>') +
          (nextStage ? '<button type="button" class="btn btn-primary btn-sm" style="padding:3px 8px;font-size:10px" data-wo-move="' + pkEsc(wo.id) + '" data-wo-stage="' + pkEsc(nextStage) + '">Pasar a ' + pkEsc(nextStage) + ' &rarr;</button>' : '') +
          '</div><div class="row-actions" style="border-top:1px dashed var(--pk-border);padding-top:6px">' +
          '<button type="button" class="btn btn-emerald btn-sm" style="flex:1" data-pos-load-order="' + pkEsc(wo.id) + '">💵 Cobrar</button>' +
          '<button type="button" class="btn btn-outline btn-sm" title="Imprimir Orden" data-print-wo="' + pkEsc(wo.id) + '">🖨️</button>' +
          '<button type="button" class="btn btn-outline btn-sm" title="WhatsApp" data-wo-whatsapp="' + pkEsc(wo.id) + '">💬</button></div></div>';
      }
      if (!cardsHtml) cardsHtml = '<div style="font-size:11px;color:var(--pk-muted);text-align:center;padding:16px 6px;border:1px dashed var(--pk-border);border-radius:8px">Sin órdenes</div>';
      columnsHtml += '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:10px;min-width:210px;flex:1"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="font-size:12px">' + pkEsc(stg) + '</strong><span class="badge ' + stageBadges[s] + '">' + count + '</span></div>' + cardsHtml + '</div>';
    }

    stage.innerHTML =
      '<div class="card"><div class="card-head"><div class="card-title">➕ Recibir Vehículo / Crear Orden de Trabajo (' + nextWoCode + ')</div>' +
      '<div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-open-new-customer-modal="1">+ Nuevo Cliente</button>' +
      '<button type="button" class="btn btn-outline btn-sm" data-open-quick-entity="VEHICLE">+ Nueva Placa / Vehículo</button></div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>N° Orden (Automático)</label><input type="text" value="' + nextWoCode + '" readonly style="background:#e2e8f0;font-weight:800" /></div>' +
      '<div class="field"><label>Cliente Propietario</label><select id="wo-customer-id">' + custOpts + '</select></div>' +
      '<div class="field"><label>Seleccionar Placa / Vehículo</label><select id="wo-plate">' + vehOpts + '</select></div>' +
      '<div class="field"><label>Kilometraje Actual</label><div class="row-actions"><input type="number" id="wo-current-km" value="45000" style="flex:1" /><button type="button" class="btn btn-outline btn-sm" id="btn-wo-suggest-oil">+3.000</button></div></div>' +
      '<div class="field"><label>Próximo Cambio Aceite (Km)</label><input type="number" id="wo-next-oil-km" value="48000" /></div>' +
      '<div class="field"><label>Técnico Asignado</label><select id="wo-worker-id">' + workerOpts + '</select></div>' +
      '<div class="field"><label>Servicio Principal</label><select id="wo-service-desc"><option value="Mantenimiento Preventivo General|140000">Mantenimiento Preventivo General ($140.000)</option><option value="Cambio de Aceite y Filtros|65000">Cambio de Aceite y Filtros ($65.000)</option><option value="Sincronización e Inyección Electrónica|120000">Sincronización e Inyección ($120.000)</option><option value="Cambio de Pastillas y Revisión Frenos|85000">Revisión y Pastillas de Freno ($85.000)</option><option value="Diagnóstico Computarizado Escáner|90000">Diagnóstico Escáner ($90.000)</option></select></div>' +
      '<div class="field"><label>Valor Mano de Obra ($)</label><div class="row-actions"><input type="number" id="wo-service-price" value="140000" style="flex:1" /><button type="button" class="btn btn-primary" id="btn-wo-create-order">✓ Crear Orden</button></div></div>' +
      '</div></div></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">📋 Tablero de Órdenes en Vivo</div></div><div class="card-body"><div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px">' + columnsHtml + '</div></div></div>';
  }

  function pkRenderHotelHub() {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;
    var rooms = db.hotelRooms || [];
    var custOpts = ''; for (var c = 0; c < db.customers.length; c++) custOpts += '<option value="' + pkEsc(db.customers[c].id) + '">' + pkEsc(db.customers[c].name + ' (' + db.customers[c].nit + ')') + '</option>';
    var availRoomOpts = '';
    var roomCards = '';
    for (var r = 0; r < rooms.length; r++) {
      var rm = rooms[r];
      var isOcc = rm.status === 'Ocupada';
      if (!isOcc) availRoomOpts += '<option value="' + pkEsc(rm.id) + '">' + pkEsc(rm.roomNumber + ' — ' + rm.roomType + ' (' + pkCop(rm.nightlyRate) + '/noche)') + '</option>';
      var totalStay = (Number(rm.nights || 1) * Number(rm.nightlyRate || 0)) + Number(rm.extrasTotal || 0);
      roomCards += '<div class="card" style="margin:0;border:2px solid ' + (isOcc ? '#f59e0b' : '#10b981') + '">' +
        '<div class="card-head" style="background:' + (isOcc ? '#fffbeb' : '#ecfdf5') + '">' +
        '<div><div class="card-title">🛏️ ' + pkEsc(rm.roomNumber) + '</div><div class="card-sub">' + pkEsc(rm.roomType + ' · ' + rm.floor) + '</div></div>' +
        '<span class="badge ' + (isOcc ? 'badge-amber' : 'badge-emerald') + '">' + pkEsc(rm.status) + '</span></div>' +
        '<div class="card-body">' +
        '<div style="font-size:12px;margin-bottom:8px"><strong>Tarifa/Noche:</strong> ' + pkCop(rm.nightlyRate) + '</div>' +
        (isOcc
          ? '<div style="background:#f8fafc;padding:8px;border-radius:8px;font-size:12px;margin-bottom:10px">' +
            '<div>👤 <strong>Huésped:</strong> ' + pkEsc(rm.guestName) + '</div>' +
            '<div>📅 <strong>Ingreso:</strong> ' + pkEsc(rm.checkInDate) + ' (' + rm.nights + ' noches)</div>' +
            '<div>🍽️ <strong>Consumos Extra:</strong> ' + pkCop(rm.extrasTotal || 0) + '</div>' +
            '<div style="margin-top:4px;font-size:14px;font-weight:800;color:var(--pk-primary)">Total Cuenta: ' + pkCop(totalStay) + '</div></div>' +
            '<div class="row-actions">' +
            '<button type="button" class="btn btn-outline btn-sm" data-hotel-add-extra="' + pkEsc(rm.id) + '">+ Consumo ($25k)</button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-print-hotel-room="' + pkEsc(rm.id) + '">🖨️ Imprimir Cuenta</button>' +
            '<button type="button" class="btn btn-emerald btn-sm" data-hotel-checkout-pos="' + pkEsc(rm.id) + '">💵 Cobrar Check-Out</button></div>'
          : '<div style="color:var(--pk-muted);font-size:12px;margin-bottom:10px">Lista para recibir huésped.</div>' +
            '<button type="button" class="btn btn-outline btn-sm" data-print-hotel-room="' + pkEsc(rm.id) + '">🖨️ Ficha Habitación</button>') +
        '</div></div>';
    }
    if (!availRoomOpts) availRoomOpts = '<option value="' + pkEsc(rooms[0] ? rooms[0].id : '') + '">Todas ocupadas (Seleccionar para actualizar)</option>';

    stage.innerHTML =
      '<div class="card" style="border:2px solid #023047"><div class="card-head" style="background:#023047;color:#fff">' +
      '<div class="card-title" style="color:#fff">🏨 1. Registrar Check-In / Entrada de Huésped</div>' +
      '<div class="row-actions"><button type="button" class="btn btn-amber btn-sm" data-open-new-customer-modal="1">+ Nuevo Huésped / Cliente</button>' +
      '<button type="button" class="btn btn-outline btn-sm" style="background:#fff;color:#023047" data-open-quick-entity="ROOM">+ Crear Habitación</button></div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>N° Registro (Automático)</label><input type="text" value="CHK-' + (500 + rooms.length) + '" readonly style="background:#e2e8f0;font-weight:800" /></div>' +
      '<div class="field"><label>Seleccionar Habitación Disponible</label><select id="hotel-room-select">' + availRoomOpts + '</select></div>' +
      '<div class="field"><label>Seleccionar Huésped / Empresa</label><select id="hotel-guest-select">' + custOpts + '</select></div>' +
      '<div class="field"><label>Cantidad de Noches</label><select id="hotel-nights-select"><option value="1">1 Noche</option><option value="2" selected>2 Noches</option><option value="3">3 Noches</option><option value="4">4 Noches</option><option value="7">7 Noches (Semana)</option></select></div>' +
      '<div class="field"><button type="button" class="btn btn-emerald" style="width:100%" id="btn-hotel-checkin">✓ Confirmar Check-In</button></div>' +
      '</div></div></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">🛏️ 2. Estado de Habitaciones, Consumos e Impresión de Cuentas</div></div>' +
      '<div class="card-body"><div class="center-selector-grid">' + roomCards + '</div></div></div>';
  }
`;
}
