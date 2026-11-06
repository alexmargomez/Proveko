/**
 * Plantilla Operativa 3 (`srv-workshop`):
 * - `mod-work-orders-kanban`: Ingreso de Vehículo/Equipo y Tablero de 5 Etapas.
 * - `mod-vehicles-assets`: Listado de Vehículos con alertas de Aceite y SOAT + botón Ver Historial.
 * - `mod-worker-commissions`: Liquidación de Comisiones de Técnicos con un clic.
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
        vRows += '<tr>' +
          '<td><span class="badge badge-blue" style="font-size:12px">🚗 ' + pkEsc(ve.plate) + '</span></td>' +
          '<td><strong>' + pkEsc(ve.brand) + '</strong> (' + pkEsc(ve.modelYear) + ')</td>' +
          '<td><strong>' + pkEsc(ve.customerName) + '</strong></td>' +
          '<td>Actual: <strong>' + ve.currentKm.toLocaleString('es-CO') + ' km</strong> · Próx. Aceite: ' + ve.nextOilChangeKm.toLocaleString('es-CO') + ' km ' +
          (oilDiff <= 500 ? '<span class="badge badge-amber">⚠️ Cambio Pronto</span>' : '') + '</td>' +
          '<td>SOAT: ' + pkEsc(ve.soatExpiry) + '</td>' +
          '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-primary btn-sm" data-open-vehicle-360="' + pkEsc(ve.id) + '">👁️ Historial</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-veh-delete-id="' + pkEsc(ve.id) + '">🗑️</button></div></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">🚗 Vehículos y Equipos Registrados (' + db.vehicles.length + ')</div></div>' +
        '<div class="card-body"><div class="table-wrap"><table><thead><tr>' +
        '<th>Placa</th><th>Marca y Línea</th><th>Propietario</th><th>Kilometraje / Aceite</th><th>Vencimiento SOAT</th><th>Acciones</th>' +
        '</tr></thead><tbody>' + vRows + '</tbody></table></div></div></div>';
      return;
    }

    if (subKey === 'mod-worker-commissions') {
      var wkRows = '';
      for (var w = 0; w < db.workers.length; w++) {
        var wk = db.workers[w];
        var gross = Number(wk.totalDayGross || 0);
        var techPay = Math.round(gross * (Number(wk.commissionPct || 40) / 100));
        wkRows += '<tr>' +
          '<td><strong>' + pkEsc(wk.name) + '</strong><div style="font-size:11px;color:var(--pk-muted)">' + pkEsc(wk.specialty) + '</div></td>' +
          '<td><span class="badge badge-blue">' + wk.commissionPct + '% Técnico</span></td>' +
          '<td>' + pkCop(gross) + '</td>' +
          '<td style="color:var(--pk-primary);font-weight:800">' + pkCop(techPay) + '</td>' +
          '<td style="color:var(--pk-emerald);font-weight:800">' + pkCop(gross - techPay) + '</td>' +
          '<td>' + (gross > 0
            ? '<button type="button" class="btn btn-emerald btn-sm" data-settle-worker="' + pkEsc(wk.id) + '">⚡ Liquidar Turno (' + pkCop(techPay) + ')</button>'
            : '<span class="badge badge-slate">✓ Al día ($0)</span>') + '</td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">👷 Comisiones de Técnicos en el Turno</div></div>' +
        '<div class="card-body"><div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
        '<div class="field"><label>Nombre del Técnico</label><input type="text" id="wk-new-name" placeholder="Ej: Jorge Iván Ríos" /></div>' +
        '<div class="field"><label>Especialidad</label><input type="text" id="wk-new-spec" placeholder="Ej: Mecánica General / Electrónica" /></div>' +
        '<div class="field"><label>% Comisión para el Técnico</label><div class="row-actions"><input type="number" id="wk-new-pct" value="40" min="5" max="90" style="flex:1" />' +
        '<button type="button" class="btn btn-primary btn-sm" id="btn-wk-add">+ Agregar Técnico</button></div></div></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Técnico</th><th>Porcentaje</th><th>Producido Hoy</th><th>Pago al Técnico</th><th>Utilidad Empresa</th><th>Acción</th></tr></thead><tbody>' + wkRows + '</tbody></table></div></div></div>';
      return;
    }

    var stages = ['Recibido', 'En Diagnóstico', 'Esperando Repuesto', 'En Reparación', 'Listo para Entrega'];
    var stageBadges = ['badge-slate', 'badge-blue', 'badge-amber', 'badge-blue', 'badge-emerald'];
    var custOpts = '';
    for (var c = 0; c < db.customers.length; c++) {
      custOpts += '<option value="' + pkEsc(db.customers[c].id) + '">' + pkEsc(db.customers[c].name) + '</option>';
    }
    var workerOpts = '';
    for (var wkIdx = 0; wkIdx < db.workers.length; wkIdx++) {
      workerOpts += '<option value="' + pkEsc(db.workers[wkIdx].id) + '">' + pkEsc(db.workers[wkIdx].name + ' — ' + db.workers[wkIdx].specialty) + '</option>';
    }

    var columnsHtml = '';
    for (var s = 0; s < stages.length; s++) {
      var stg = stages[s]; var cardsHtml = ''; var count = 0;
      for (var o = 0; o < db.workOrders.length; o++) {
        var wo = db.workOrders[o];
        if (wo.status !== stg) continue;
        count++;
        var svcsSummary = '';
        for (var k = 0; k < (wo.services || []).length; k++) {
          svcsSummary += '<div style="font-size:11px">• ' + pkEsc(wo.services[k].description) + '</div>';
        }
        var nextStage = s < stages.length - 1 ? stages[s + 1] : null;
        var prevStage = s > 0 ? stages[s - 1] : null;

        cardsHtml += '<div style="background:#fff;border:1px solid var(--pk-border);border-radius:10px;padding:10px;margin-bottom:8px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
          '<span class="badge ' + stageBadges[s] + '">🚗 ' + pkEsc(wo.plate) + '</span>' +
          '<strong style="font-size:12px;color:var(--pk-emerald)">' + pkCop(wo.totalEstimated) + '</strong></div>' +
          '<div style="font-size:12px;font-weight:800">' + pkEsc(wo.vehicleBrand) + '</div>' +
          '<div style="font-size:11px;color:var(--pk-muted);margin-bottom:6px">👤 ' + pkEsc(wo.customerName) + '<br/>👷 ' + pkEsc(wo.workerName) + '</div>' +
          '<div style="background:#f8fafc;padding:6px;border-radius:6px;margin-bottom:6px">' + svcsSummary + '</div>' +
          '<div class="row-actions" style="justify-content:space-between;margin-bottom:6px">' +
          (prevStage ? '<button type="button" class="btn btn-outline btn-sm" style="padding:3px 7px;font-size:10px" data-wo-move="' + pkEsc(wo.id) + '" data-wo-stage="' + pkEsc(prevStage) + '">&larr;</button>' : '<span></span>') +
          (nextStage ? '<button type="button" class="btn btn-primary btn-sm" style="padding:3px 8px;font-size:10px" data-wo-move="' + pkEsc(wo.id) + '" data-wo-stage="' + pkEsc(nextStage) + '">Pasar a ' + pkEsc(nextStage) + ' &rarr;</button>' : '') +
          '</div>' +
          '<div class="row-actions" style="border-top:1px dashed var(--pk-border);padding-top:6px">' +
          '<button type="button" class="btn btn-emerald btn-sm" style="flex:1;justify-content:center" data-pos-load-order="' + pkEsc(wo.id) + '">💵 Facturar</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-wo-whatsapp="' + pkEsc(wo.id) + '">💬</button>' +
          '</div></div>';
      }
      if (!cardsHtml) cardsHtml = '<div style="font-size:11px;color:var(--pk-muted);text-align:center;padding:16px 6px;border:1px dashed var(--pk-border);border-radius:8px">Sin órdenes</div>';
      columnsHtml += '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:10px;min-width:205px;flex:1">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><strong style="font-size:12px">' + pkEsc(stg) + '</strong><span class="badge ' + stageBadges[s] + '">' + count + '</span></div>' +
        cardsHtml + '</div>';
    }

    stage.innerHTML =
      '<div class="card"><div class="card-head"><div class="card-title">➕ Recibir Vehículo / Crear Orden de Trabajo</div>' +
      '<button type="button" class="btn btn-outline btn-sm" data-open-new-customer-modal="1">+ Nuevo Cliente</button></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>Cliente Propietario</label><select id="wo-customer-id">' + custOpts + '</select></div>' +
      '<div class="field"><label>Placa / Serial *</label><input type="text" id="wo-plate" placeholder="Ej: KLM-901" style="text-transform:uppercase;font-weight:800" /></div>' +
      '<div class="field"><label>Vehículo / Marca y Línea</label><input type="text" id="wo-brand" placeholder="Ej: Mazda CX-30 / Yamaha NMAX" /></div>' +
      '<div class="field"><label>Kilometraje Actual</label><div class="row-actions"><input type="number" id="wo-current-km" value="45000" style="flex:1" />' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-wo-suggest-oil">+3.000 km</button></div></div>' +
      '<div class="field"><label>Próximo Cambio Aceite (Km)</label><input type="number" id="wo-next-oil-km" value="48000" /></div>' +
      '<div class="field"><label>Técnico Asignado</label><select id="wo-worker-id">' + workerOpts + '</select></div>' +
      '<div class="field" style="grid-column:span 2"><label>Trabajo o Servicio a Realizar *</label><input type="text" id="wo-service-desc" placeholder="Ej: Cambio de aceite y revisión de frenos" /></div>' +
      '<div class="field"><label>Valor Mano de Obra ($)</label><div class="row-actions"><input type="number" id="wo-service-price" value="85000" style="flex:1" />' +
      '<button type="button" class="btn btn-primary btn-sm" id="btn-wo-create-order">+ Ingresar Orden</button></div></div>' +
      '</div></div></div>' +

      '<div class="card"><div class="card-head"><div class="card-title">📋 Tablero de Órdenes en Vivo</div></div>' +
      '<div class="card-body"><div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px">' + columnsHtml + '</div></div></div>';
  }
`;
}
