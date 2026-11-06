/**
 * Hub Relacional 2 (`kanban`): Recepción Técnica de Vehículos/Activos y Tablero Kanban en Vivo de 5 Etapas
 * (Inspirado en FactuPOS `schedule.jsx` + alertas de kilometraje, cambio de aceite +3.000 km, SOAT, Tecnomecánica y pase directo al POS).
 */
export function renderWorkshopKanbanHubRuntimeJs(): string {
  return `
  function pkRenderKanbanHub() {
    var db = STATE.relDb;
    var container = document.getElementById('ws-converged-hub-container');
    if (!container || !db) return;

    var stages = ['Recibido', 'En Diagnóstico', 'Esperando Repuesto', 'En Reparación', 'Listo para Entrega'];
    var stageBadges = ['badge-slate', 'badge-blue', 'badge-amber', 'badge-blue', 'badge-emerald'];

    var custOpts = '';
    for (var c = 0; c < db.customers.length; c++) {
      var cu = db.customers[c];
      custOpts += '<option value="' + pkEsc(cu.id) + '">' + pkEsc(cu.name + ' (' + cu.docType + ' ' + cu.nit + ')') + '</option>';
    }
    var workerOpts = '';
    for (var w = 0; w < db.workers.length; w++) {
      var wk = db.workers[w];
      workerOpts += '<option value="' + pkEsc(wk.id) + '">' + pkEsc(wk.name + ' — ' + wk.specialty) + '</option>';
    }

    var columnsHtml = '';
    for (var s = 0; s < stages.length; s++) {
      var stg = stages[s];
      var cardsHtml = '';
      var count = 0;
      for (var o = 0; o < db.workOrders.length; o++) {
        var wo = db.workOrders[o];
        if (wo.status !== stg) continue;
        count++;
        var svcsSummary = '';
        for (var k = 0; k < (wo.services || []).length; k++) {
          svcsSummary += '<div style="font-size:11px;color:var(--pk-text)">• ' + pkEsc(wo.services[k].description) + ' (<strong>' + pkCop(wo.services[k].price) + '</strong>)</div>';
        }
        var nextStage = s < stages.length - 1 ? stages[s + 1] : null;
        var prevStage = s > 0 ? stages[s - 1] : null;

        cardsHtml += '<div style="background:#fff;border:1px solid var(--pk-border);border-radius:10px;padding:10px;margin-bottom:8px;box-shadow:0 1px 3px rgba(15,23,42,.05)">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
          '<span class="badge ' + stageBadges[s] + '">🚗 ' + pkEsc(wo.plate) + '</span>' +
          '<span style="font-size:11px;font-weight:800;color:var(--pk-muted)">' + pkEsc(wo.id) + '</span></div>' +
          '<div style="font-size:12px;font-weight:800">' + pkEsc(wo.vehicleBrand) + '</div>' +
          '<div style="font-size:11px;color:var(--pk-muted);margin-bottom:6px">👤 FK Cliente: <strong>' + pkEsc(wo.customerName) + '</strong><br/>👨‍🔧 FK Técnico: <strong>' + pkEsc(wo.workerName) + '</strong><br/>🛣️ Km: ' + Number(wo.currentKm || 0).toLocaleString('es-CO') + ' (Próx Aceite: ' + Number(wo.nextOilKm || 0).toLocaleString('es-CO') + ')</div>' +
          '<div style="background:#f8fafc;padding:6px;border-radius:6px;margin-bottom:6px">' + svcsSummary + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
          '<span style="font-size:11px;color:var(--pk-muted)">Total Estimado:</span>' +
          '<strong style="font-size:12px;color:var(--pk-emerald)">' + pkCop(wo.totalEstimated) + '</strong></div>' +
          '<div class="row-actions" style="justify-content:space-between">' +
          (prevStage ? '<button type="button" class="btn btn-outline btn-sm" style="padding:3px 7px;font-size:10px" data-wo-move="' + pkEsc(wo.id) + '" data-wo-stage="' + pkEsc(prevStage) + '">&larr;</button>' : '<span></span>') +
          (nextStage ? '<button type="button" class="btn btn-primary btn-sm" style="padding:3px 8px;font-size:10px" data-wo-move="' + pkEsc(wo.id) + '" data-wo-stage="' + pkEsc(nextStage) + '">Avanzar: ' + pkEsc(nextStage) + ' &rarr;</button>' : '') +
          '</div>' +
          '<div class="row-actions" style="margin-top:6px;border-top:1px dashed var(--pk-border);padding-top:6px">' +
          '<button type="button" class="btn btn-emerald btn-sm" style="width:100%;justify-content:center" data-pos-load-order="' + pkEsc(wo.id) + '">🛒 Pasar a Caja POS y Facturar</button>' +
          '<button type="button" class="btn btn-outline btn-sm" style="width:100%;justify-content:center" data-wo-whatsapp="' + pkEsc(wo.id) + '">💬 Avisar por WhatsApp</button>' +
          '</div></div>';
      }
      if (!cardsHtml) {
        cardsHtml = '<div style="font-size:11px;color:var(--pk-muted);text-align:center;padding:18px 6px;border:1px dashed var(--pk-border);border-radius:8px">Sin órdenes en esta etapa</div>';
      }
      columnsHtml += '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:10px;min-width:215px;flex:1">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<strong style="font-size:12px">' + pkEsc(stg) + '</strong>' +
        '<span class="badge ' + stageBadges[s] + '">' + count + '</span></div>' +
        cardsHtml + '</div>';
    }

    container.innerHTML =
      '<div class="card"><div class="card-head"><div>' +
      '<div class="card-title">🔧 1. Recepción Técnica de Vehículo / Activo y Creación de Orden de Trabajo (FK -> customers, vehicles, workers)</div>' +
      '<div class="card-sub">Registra o actualiza automáticamente la placa en la tabla de vehículos, sugiere cambio de aceite (+3.000 km) y crea tarjeta en el Kanban</div></div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>Propietario / Cliente (FK -> customers)</label><select id="wo-customer-id">' + custOpts + '</select></div>' +
      '<div class="field"><label>Placa / Serial del Activo</label><input type="text" id="wo-plate" placeholder="Ej: KLM-901" style="text-transform:uppercase;font-weight:800" /></div>' +
      '<div class="field"><label>Marca / Línea / Modelo</label><input type="text" id="wo-brand" placeholder="Ej: Mazda CX-30 Grand Touring 2024" /></div>' +
      '<div class="field"><label>Kilometraje Actual</label><div class="row-actions"><input type="number" id="wo-current-km" value="45000" style="flex:1" />' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-wo-suggest-oil">🛢️ +3.000 km</button></div></div>' +
      '<div class="field"><label>Próx. Cambio Aceite (Km)</label><input type="number" id="wo-next-oil-km" value="48000" /></div>' +
      '<div class="field"><label>Vencimiento SOAT / Tecno</label><input type="date" id="wo-soat-date" value="2026-12-31" /></div>' +
      '<div class="field"><label>Técnico / Mecánico Asignado (FK -> workers)</label><select id="wo-worker-id">' + workerOpts + '</select></div>' +
      '<div class="field"><label>Trabajo / Diagnóstico Solicitado</label><input type="text" id="wo-service-desc" placeholder="Ej: Cambio kit embrague + revisión frenos" /></div>' +
      '<div class="field"><label>Valor Mano de Obra Estimado (COP)</label><input type="number" id="wo-service-price" value="120000" /></div>' +
      '</div><div style="margin-top:10px;display:flex;justify-content:flex-end">' +
      '<button type="button" class="btn btn-primary" id="btn-wo-create-order">+ Ingresar Vehículo/Activo al Tablero Kanban</button></div></div></div>' +

      '<div class="card"><div class="card-head"><div>' +
      '<div class="card-title">📋 2. Tablero Kanban de Taller y Operaciones en Vivo (5 Etapas Interactivas)</div>' +
      '<div class="card-sub">Mueve órdenes entre etapas, notifica al cliente por WhatsApp o envía la orden con un clic a Caja POS para facturarla</div></div></div>' +
      '<div class="card-body"><div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px">' + columnsHtml + '</div></div></div>';
  }
`;
}
