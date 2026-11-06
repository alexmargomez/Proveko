/**
 * Modales Relacionales 360° e Impresión Formal PDF (Inspirados en FactuPOS `ReportCustomer.jsx`, `ReportVehicle.jsx`, `FactuView.jsx` y `hc_version2`):
 * - Expediente 360° del Cliente (Cruza Cliente + Contratos + Vehículos + Órdenes Kanban + Facturas + Cartera CxC)
 * - Hoja de Vida Técnica de Placa / Activo (Cruza Placa + Propietario + Alertas + Historial de Mantenimientos)
 * - Modal de Abonos y Saldado de Cartera CxC (`RC-XXXXX`)
 * - Visor de Factura Electrónica DIAN, Glosas v2 e Impresión PDF / Cotización
 */
export function renderRelationalModalsRuntimeJs(): string {
  return `
  function pkOpenModal(title, sub, bodyHtml) {
    var modal = document.getElementById('pk-relational-modal');
    var tEl = document.getElementById('pk-rel-modal-title');
    var sEl = document.getElementById('pk-rel-modal-sub');
    var bEl = document.getElementById('pk-rel-modal-body');
    if (!modal || !bEl) return;
    if (tEl) tEl.textContent = title;
    if (sEl) sEl.textContent = sub;
    bEl.innerHTML = bodyHtml;
    modal.classList.add('open');
  }

  function pkOpenCustomer360Modal(custId) {
    var db = STATE.relDb;
    var cust = pkFindById(db.customers, custId) || db.customers[0];
    if (!cust) return;
    var contract = cust.contractId ? pkFindById(db.contracts, cust.contractId) : null;
    var tariff = cust.tariffId ? pkFindById(db.tariffs, cust.tariffId) : null;

    var vehHtml = '';
    for (var v = 0; v < db.vehicles.length; v++) {
      var ve = db.vehicles[v];
      if (ve.customerId !== cust.id) continue;
      vehHtml += '<tr><td><span class="badge badge-blue">🚗 ' + pkEsc(ve.plate) + '</span></td><td><strong>' + pkEsc(ve.brand) + '</strong></td><td>' + ve.currentKm.toLocaleString('es-CO') + ' km (Próx: ' + ve.nextOilChangeKm.toLocaleString('es-CO') + ' km)</td><td>SOAT: ' + pkEsc(ve.soatExpiry) + '</td></tr>';
    }
    var invHtml = ''; var totalHistorical = 0;
    for (var i = 0; i < db.invoices.length; i++) {
      var inv = db.invoices[i];
      if (inv.customerId !== cust.id) continue;
      totalHistorical += Number(inv.total || 0);
      invHtml += '<tr><td><strong>' + pkEsc(inv.id) + '</strong> (' + pkEsc(inv.date) + ')</td><td>' + pkEsc(inv.plate || 'Mostrador') + '</td><td>' + pkCop(inv.total) + '</td><td>' + pkCop(inv.pendingBalance) + '</td><td><span class="badge ' + (inv.pendingBalance > 0 ? 'badge-amber' : 'badge-emerald') + '">' + pkEsc(inv.status) + '</span></td></tr>';
    }

    pkOpenModal(
      '👁️ Expediente Relacional 360° — ' + cust.name,
      cust.docType + ' ' + cust.nit + (cust.dv ? '-' + cust.dv : '') + ' · ' + cust.taxRegime + ' · ' + cust.city + ' (' + cust.address + ')',
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Total Facturado Histórico</div><div class="kpi-val">' + pkCop(totalHistorical) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Saldo Pendiente CxC</div><div class="kpi-val" style="color:var(--pk-amber)">' + pkCop(cust.currentDebt) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Contrato Enlazado (FK)</div><div class="kpi-val" style="font-size:13px">' + pkEsc(contract ? contract.code + ' (' + pkCop(contract.availableBalance) + ')' : 'Contado') + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Tarifa Asignada (FK)</div><div class="kpi-val" style="font-size:13px;color:var(--pk-primary)">' + pkEsc(tariff ? tariff.name + ' (-' + tariff.discountPct + '%)' : 'Plena') + '</div></div>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:800;margin:10px 0 6px">🚗 Vehículos / Activos Registrados a Nombre del Cliente (FK -> vehicles):</div>' +
      '<div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Placa</th><th>Marca / Línea</th><th>Kilometraje y Aceite</th><th>Vencimientos</th></tr></thead><tbody>' + (vehHtml || '<tr><td colspan="4">Sin vehículos asociados</td></tr>') + '</tbody></table></div>' +
      '<div style="font-size:13px;font-weight:800;margin:10px 0 6px">🧾 Historial de Facturas, Servicios y Cartera CxC (FK -> invoices):</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Factura</th><th>Placa</th><th>Total</th><th>Saldo CxC</th><th>Estado</th></tr></thead><tbody>' + (invHtml || '<tr><td colspan="5">Sin facturas registradas</td></tr>') + '</tbody></table></div>'
    );
  }

  function pkOpenVehicle360Modal(vehId) {
    var db = STATE.relDb;
    var ve = pkFindById(db.vehicles, vehId) || db.vehicles[0];
    if (!ve) return;
    var histHtml = '';
    for (var o = 0; o < db.workOrders.length; o++) {
      var wo = db.workOrders[o];
      if (wo.vehicleId !== ve.id && wo.plate !== ve.plate) continue;
      var sList = [];
      for (var k = 0; k < (wo.services || []).length; k++) sList.push(wo.services[k].description + ' (' + pkCop(wo.services[k].price) + ')');
      histHtml += '<tr><td><code>' + pkEsc(wo.id) + '</code> (' + pkEsc(wo.createdAt) + ')</td><td>' + pkEsc(wo.workerName) + '</td><td>' + pkEsc(sList.join(' + ')) + '</td><td><span class="badge badge-blue">' + pkEsc(wo.status) + '</span></td></tr>';
    }
    pkOpenModal(
      '🚗 Hoja de Vida Técnica de Placa — ' + ve.plate + ' (' + ve.brand + ')',
      'Propietario FK: ' + ve.customerName + ' · Km Actual: ' + ve.currentKm.toLocaleString('es-CO') + ' km · Próx. Aceite: ' + ve.nextOilChangeKm.toLocaleString('es-CO') + ' km',
      '<div style="padding:10px;background:#f8fafc;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px;font-size:12px">' +
      '<strong>Observaciones Técnicas:</strong> ' + pkEsc(ve.notes || 'Sin alertas estructurales') + ' · <strong>SOAT:</strong> ' + pkEsc(ve.soatExpiry) + ' · <strong>Tecnomecánica:</strong> ' + pkEsc(ve.tecnoExpiry) + '</div>' +
      '<div style="font-size:13px;font-weight:800;margin-bottom:6px">🔧 Historial de Órdenes de Trabajo e Intervenciones en Taller:</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Orden / Fecha</th><th>Técnico Ejecutor (FK)</th><th>Procedimientos Realizados</th><th>Estado</th></tr></thead><tbody>' + (histHtml || '<tr><td colspan="4">Sin órdenes previas</td></tr>') + '</tbody></table></div>'
    );
  }

  function pkOpenAbonoModal(invId) {
    var db = STATE.relDb;
    var inv = pkFindById(db.invoices, invId);
    if (!inv) return;
    var abRows = '';
    var abList = inv.abonosHistory || [];
    for (var a = 0; a < abList.length; a++) {
      abRows += '<tr><td><code>' + pkEsc(abList[a].id) + '</code></td><td>' + pkEsc(abList[a].date) + '</td><td>' + pkEsc(abList[a].method) + '</td><td>' + pkEsc(abList[a].note) + '</td><td style="color:var(--pk-emerald);font-weight:800">+' + pkCop(abList[a].amount) + '</td></tr>';
    }
    pkOpenModal(
      '💵 Recaudo de Cartera CxC y Abonos — Factura ' + inv.id,
      'Cliente FK: ' + inv.customerName + ' · Total Factura: ' + pkCop(inv.total) + ' · Saldo Pendiente: ' + pkCop(inv.pendingBalance),
      '<div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
      '<div class="field"><label>Valor del Abono o Pago Total (COP)</label><input type="number" id="modal-abono-amount" value="' + inv.pendingBalance + '" max="' + inv.pendingBalance + '" /></div>' +
      '<div class="field"><label>Medio de Recaudo</label><select id="modal-abono-method"><option value="Efectivo">💵 Efectivo Caja</option><option value="Transferencia / Nequi">📲 Transferencia / Nequi</option><option value="Tarjeta">💳 Tarjeta</option></select></div>' +
      '<div class="field"><label>Observación Recibo de Caja</label><div class="row-actions"><input type="text" id="modal-abono-note" value="Abono / Pago Cartera CxC" style="flex:1" />' +
      '<button type="button" class="btn btn-emerald btn-sm" data-confirm-abono-inv="' + pkEsc(inv.id) + '">✓ Aplicar Abono</button></div></div></div>' +
      '<div style="font-size:12px;font-weight:800;margin-bottom:6px">Historial de Recibos de Caja y Abonos Aplicados a esta Factura:</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Fecha</th><th>Medio</th><th>Nota</th><th>Valor Abonado</th></tr></thead><tbody>' + (abRows || '<tr><td colspan="5">Sin abonos registrados aún</td></tr>') + '</tbody></table></div>'
    );
  }

  function pkOpenInvoiceModal(invId) {
    var db = STATE.relDb;
    var inv = pkFindById(db.invoices, invId);
    if (!inv) return;
    var itRows = '';
    for (var i = 0; i < (inv.items || []).length; i++) {
      var it = inv.items[i];
      itRows += '<tr><td>' + pkEsc(it.kind) + '</td><td><strong>' + pkEsc(it.name) + '</strong></td><td>' + it.qty + '</td><td>' + pkCop(it.price) + '</td><td><strong>' + pkCop(it.qty * it.price) + '</strong></td></tr>';
    }
    pkOpenModal(
      '🧾 Factura Electrónica DIAN ' + inv.id + ' (' + inv.status + ')',
      'CUFE: ' + inv.cufe + ' · Cliente: ' + inv.customerName + ' · Placa: ' + (inv.plate || 'Mostrador'),
      '<div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Tipo</th><th>Descripción</th><th>Cant.</th><th>Vlr. Unit</th><th>Subtotal</th></tr></thead><tbody>' + itRows + '</tbody></table></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f8fafc;border-radius:10px">' +
      '<div><strong>Total Neto: ' + pkCop(inv.total) + '</strong> · Pagado: ' + pkCop(inv.amountPaid) + ' · Saldo CxC: ' + pkCop(inv.pendingBalance) + '</div>' +
      '<button type="button" class="btn btn-primary btn-sm" data-print-invoice="' + pkEsc(inv.id) + '">🖨️ Imprimir PDF Formato Carta / Tirilla</button></div>'
    );
  }
`;
}
