/**
 * Modales Operativos y Visores de Detalle (<= 200 líneas):
 * - Registrar Nuevo Cliente (Dialog global accesible desde Facturación, Taller, Topbar o Clientes)
 * - Ficha del Cliente (Cruza Cliente + Convenios + Vehículos + Facturas + Cartera)
 * - Historial de Vehículo / Equipo
 * - Abonos de Cartera, Surtir Producto, Trasladar entre Bodegas y Visor de Factura
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

  function pkOpenNewCustomerModal() {
    var db = STATE.relDb;
    var cntOpts = '<option value="cnt-particular">Cliente Contado / Particular</option>';
    for (var c = 0; c < db.contracts.length; c++) {
      cntOpts += '<option value="' + pkEsc(db.contracts[c].id) + '">' + pkEsc(db.contracts[c].code + ' — ' + db.contracts[c].entityName) + '</option>';
    }
    var trfOpts = '';
    for (var t = 0; t < db.tariffs.length; t++) {
      trfOpts += '<option value="' + pkEsc(db.tariffs[t].id) + '">' + pkEsc(db.tariffs[t].name + ' (-' + db.tariffs[t].discountPct + '%)') + '</option>';
    }
    pkOpenModal(
      '👤 Registrar Nuevo Cliente',
      'Guarda el cliente y úsalo de inmediato en Facturación, Taller, Reservas o Cartera',
      '<div class="form-grid" style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Tipo de Documento</label><select id="modal-cust-doctype"><option value="CC">Cédula (CC)</option><option value="NIT">NIT Empresa</option><option value="CE">Cédula Extranjería</option></select></div>' +
      '<div class="field"><label>Número de Documento / NIT</label><input type="text" id="modal-cust-nit" placeholder="Ej: 901452110-4 o 1020455890" /></div>' +
      '<div class="field"><label>Nombre Completo o Razón Social</label><input type="text" id="modal-cust-name" placeholder="Ej: Comercializadora del Norte S.A.S." /></div>' +
      '<div class="field"><label>Teléfono / WhatsApp</label><input type="text" id="modal-cust-phone" placeholder="Ej: 315 890 1122" /></div>' +
      '<div class="field"><label>Correo Electrónico</label><input type="email" id="modal-cust-email" placeholder="cliente@correo.com" /></div>' +
      '<div class="field"><label>Ciudad y Dirección</label><input type="text" id="modal-cust-address" placeholder="Ej: Medellín — Calle 10 # 43A-20" /></div>' +
      '<div class="field"><label>Convenio / Contrato</label><select id="modal-cust-contract">' + cntOpts + '</select></div>' +
      '<div class="field"><label>Lista de Precios / Tarifa</label><select id="modal-cust-tariff">' + trfOpts + '</select></div>' +
      '<div class="field"><label>Cupo de Crédito Autorizado (COP)</label><input type="number" id="modal-cust-credit" value="2000000" /></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">' +
      '<button type="button" class="btn btn-emerald" id="btn-modal-save-customer">✓ Guardar Cliente y Seleccionar</button>' +
      '</div>'
    );
  }

  function pkOpenRestockModal(prodId) {
    var db = STATE.relDb;
    var prod = pkFindById(db.products, prodId) || db.products[0];
    if (!prod) return;
    var supOpts = '';
    for (var s = 0; s < db.suppliers.length; s++) supOpts += '<option value="' + pkEsc(db.suppliers[s].id) + '">' + pkEsc(db.suppliers[s].name) + '</option>';
    pkOpenModal(
      '📥 Surtir Inventario — ' + prod.name,
      'Código: ' + prod.code + ' · Existencia actual: ' + prod.stock + ' und · Precio venta: ' + pkCop(prod.salePrice),
      '<div class="form-grid" style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Cantidad que Entra (+)</label><input type="number" id="modal-restock-qty" value="12" min="1" /></div>' +
      '<div class="field"><label>Costo Unitario de Compra (COP)</label><input type="number" id="modal-restock-cost" value="' + prod.costPrice + '" /></div>' +
      '<div class="field"><label>Precio de Venta Actualizado (COP)</label><input type="number" id="modal-restock-sale" value="' + prod.salePrice + '" /></div>' +
      '<div class="field"><label>Proveedor</label><select id="modal-restock-sup">' + supOpts + '</select></div>' +
      '<div class="field"><label>Factura / Soporte</label><input type="text" id="modal-restock-ref" value="FAC-PROV-2026" /></div>' +
      '<div class="field" style="display:flex;align-items:flex-end"><button type="button" class="btn btn-emerald" style="width:100%" data-confirm-restock-id="' + pkEsc(prod.id) + '">✓ Ingresar Unidades al Inventario</button></div>' +
      '</div>'
    );
  }

  function pkOpenTransferModal(prodId) {
    var db = STATE.relDb;
    var prod = pkFindById(db.products, prodId) || db.products[0];
    if (!prod) return;
    var whOpts = '';
    for (var w = 0; w < db.warehouses.length; w++) whOpts += '<option value="' + pkEsc(db.warehouses[w].id) + '">' + pkEsc(db.warehouses[w].name) + '</option>';
    pkOpenModal(
      '🔄 Trasladar Producto de Bodega — ' + prod.name,
      'Código: ' + prod.code + ' · Disponible: ' + prod.stock + ' und',
      '<div class="form-grid" style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Bodega Destino</label><select id="modal-transfer-wh">' + whOpts + '</select></div>' +
      '<div class="field"><label>Cantidad a Trasladar</label><input type="number" id="modal-transfer-qty" value="5" min="1" max="' + prod.stock + '" /></div>' +
      '<div class="field"><label>Observación / Responsable</label><input type="text" id="modal-transfer-note" value="Traslado interno autorizado" /></div>' +
      '<div class="field" style="display:flex;align-items:flex-end"><button type="button" class="btn btn-primary" style="width:100%" data-confirm-transfer-id="' + pkEsc(prod.id) + '">✓ Confirmar Traslado</button></div>' +
      '</div>'
    );
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
      '👁️ Ficha del Cliente — ' + cust.name,
      cust.docType + ' ' + cust.nit + (cust.dv ? '-' + cust.dv : '') + ' · Tel: ' + cust.phone + ' · ' + cust.city + ' (' + cust.address + ')',
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Compras Acumuladas</div><div class="kpi-val">' + pkCop(totalHistorical) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Saldo por Cobrar</div><div class="kpi-val" style="color:var(--pk-amber)">' + pkCop(cust.currentDebt) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Convenio / Contrato</div><div class="kpi-val" style="font-size:13px">' + pkEsc(contract ? contract.code + ' (' + pkCop(contract.availableBalance) + ')' : 'Contado') + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Lista de Precios</div><div class="kpi-val" style="font-size:13px;color:var(--pk-primary)">' + pkEsc(tariff ? tariff.name + ' (-' + tariff.discountPct + '%)' : 'General') + '</div></div>' +
      '</div>' +
      '<div style="font-size:13px;font-weight:800;margin:10px 0 6px">🚗 Vehículos o Equipos Asociados:</div>' +
      '<div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Placa</th><th>Marca / Línea</th><th>Kilometraje</th><th>SOAT</th></tr></thead><tbody>' + (vehHtml || '<tr><td colspan="4">Sin vehículos registrados</td></tr>') + '</tbody></table></div>' +
      '<div style="font-size:13px;font-weight:800;margin:10px 0 6px">🧾 Historial de Facturas y Cuenta por Cobrar:</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Factura</th><th>Referencia</th><th>Total</th><th>Saldo Pendiente</th><th>Estado</th></tr></thead><tbody>' + (invHtml || '<tr><td colspan="5">Sin facturas registradas</td></tr>') + '</tbody></table></div>'
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
      '🚗 Historial de Placa / Equipo — ' + ve.plate + ' (' + ve.brand + ')',
      'Propietario: ' + ve.customerName + ' · Km Actual: ' + ve.currentKm.toLocaleString('es-CO') + ' km · Próx. Aceite: ' + ve.nextOilChangeKm.toLocaleString('es-CO') + ' km',
      '<div style="padding:10px;background:#f8fafc;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px;font-size:12px">' +
      '<strong>Observaciones:</strong> ' + pkEsc(ve.notes || 'Sin novedades') + ' · <strong>SOAT:</strong> ' + pkEsc(ve.soatExpiry) + ' · <strong>Tecnomecánica:</strong> ' + pkEsc(ve.tecnoExpiry) + '</div>' +
      '<div style="font-size:13px;font-weight:800;margin-bottom:6px">🔧 Historial de Servicios en Taller:</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Orden / Fecha</th><th>Técnico</th><th>Trabajos Realizados</th><th>Estado</th></tr></thead><tbody>' + (histHtml || '<tr><td colspan="4">Sin órdenes previas</td></tr>') + '</tbody></table></div>'
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
      '💵 Registrar Abono o Pago — Factura ' + inv.id,
      'Cliente: ' + inv.customerName + ' · Total Factura: ' + pkCop(inv.total) + ' · Saldo Pendiente: ' + pkCop(inv.pendingBalance),
      '<div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
      '<div class="field"><label>Valor del Abono (COP)</label><input type="number" id="modal-abono-amount" value="' + inv.pendingBalance + '" max="' + inv.pendingBalance + '" /></div>' +
      '<div class="field"><label>Medio de Pago</label><select id="modal-abono-method"><option value="Efectivo">💵 Efectivo</option><option value="Transferencia / Nequi">📲 Transferencia / Nequi</option><option value="Tarjeta">💳 Tarjeta</option></select></div>' +
      '<div class="field"><label>Observación</label><div class="row-actions"><input type="text" id="modal-abono-note" value="Abono a factura" style="flex:1" />' +
      '<button type="button" class="btn btn-emerald btn-sm" data-confirm-abono-inv="' + pkEsc(inv.id) + '">✓ Guardar Abono</button></div></div></div>' +
      '<div style="font-size:12px;font-weight:800;margin-bottom:6px">Historial de Pagos y Abonos:</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Fecha</th><th>Medio</th><th>Nota</th><th>Valor</th></tr></thead><tbody>' + (abRows || '<tr><td colspan="5">Sin abonos registrados aún</td></tr>') + '</tbody></table></div>'
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
      '🧾 Detalle de Factura ' + inv.id + ' (' + inv.status + ')',
      'Cliente: ' + inv.customerName + ' · Fecha: ' + inv.date + ' · Referencia: ' + (inv.plate || 'Mostrador'),
      '<div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Tipo</th><th>Descripción</th><th>Cant.</th><th>Vlr. Unit</th><th>Subtotal</th></tr></thead><tbody>' + itRows + '</tbody></table></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f8fafc;border-radius:10px">' +
      '<div><strong>Total: ' + pkCop(inv.total) + '</strong> · Pagado: ' + pkCop(inv.amountPaid) + ' · Saldo Pendiente: ' + pkCop(inv.pendingBalance) + '</div>' +
      '<button type="button" class="btn btn-primary btn-sm" data-print-invoice="' + pkEsc(inv.id) + '">🖨️ Imprimir Factura / Tirilla</button></div>'
    );
  }
`;
}
