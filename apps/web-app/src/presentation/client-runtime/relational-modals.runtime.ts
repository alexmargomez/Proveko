/**
 * Modales Operativos, Visores y Creación Rápida en Tablas Normalizadas (<= 200 líneas):
 * - Nuevo Cliente (`pkOpenNewCustomerModal`)
 * - Creación Rápida de Entidades Normalizadas (`pkOpenQuickEntityModal`: Conductor, Transportista, Placa, Bodega, Proveedor, Habitación, Profesional)
 * - Surtir Producto, Trasladar Bodega, Ficha Cliente, Historial Placa, Abonos e Impresión Factura
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

  function pkOpenQuickEntityModal(kind) {
    var db = STATE.relDb;
    if (kind === 'DRIVER') {
      var carOpts = ''; for (var c = 0; c < db.carriers.length; c++) carOpts += '<option value="' + pkEsc(db.carriers[c].name) + '">' + pkEsc(db.carriers[c].name) + '</option>';
      var vehOpts = ''; for (var v = 0; v < db.vehicles.length; v++) vehOpts += '<option value="' + pkEsc(db.vehicles[v].plate) + '">' + pkEsc(db.vehicles[v].plate + ' — ' + db.vehicles[v].brand) + '</option>';
      pkOpenModal('🚛 Registrar Nuevo Conductor', 'Se guarda en la tabla de Conductores y queda seleccionable en Báscula y Despachos',
        '<div class="form-grid"><div class="field"><label>Cédula del Conductor *</label><input type="text" id="qe-drv-doc" placeholder="Ej: 72.184.990" /></div>' +
        '<div class="field"><label>Nombre Completo *</label><input type="text" id="qe-drv-name" placeholder="Ej: Hernando Valencia Ríos" /></div>' +
        '<div class="field"><label>Categoría Licencia</label><select id="qe-drv-lic"><option>C3 Tractocamión / Pesados</option><option>C2 Camión Rígido</option><option>C1 Servicio Público</option></select></div>' +
        '<div class="field"><label>Teléfono / Celular</label><input type="text" id="qe-drv-phone" placeholder="Ej: 310 884 2211" /></div>' +
        '<div class="field"><label>Empresa Transportista</label><select id="qe-drv-carrier">' + carOpts + '</select></div>' +
        '<div class="field"><label>Placa Asignada</label><select id="qe-drv-plate">' + vehOpts + '</select></div></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" class="btn btn-emerald" data-save-quick-entity="DRIVER">✓ Guardar Conductor</button></div>');
      return;
    }
    if (kind === 'CARRIER') {
      pkOpenModal('🏢 Registrar Nueva Empresa Transportista', 'Se guarda en la tabla de Transportistas para Traslados y Báscula',
        '<div class="form-grid"><div class="field"><label>NIT Transportista *</label><input type="text" id="qe-car-nit" placeholder="Ej: 900.771.220-8" /></div>' +
        '<div class="field"><label>Razón Social *</label><input type="text" id="qe-car-name" placeholder="Ej: Transportes del Caribe S.A.S." /></div>' +
        '<div class="field"><label>Ciudad Base</label><select id="qe-car-city"><option>Barranquilla</option><option>Bogotá D.C.</option><option>Medellín</option><option>Cali</option><option>Cartagena</option><option>Buenaventura</option></select></div>' +
        '<div class="field"><label>Teléfono Despachos</label><input type="text" id="qe-car-phone" placeholder="Ej: 300 441 9080" /></div></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" class="btn btn-emerald" data-save-quick-entity="CARRIER">✓ Guardar Transportista</button></div>');
      return;
    }
    if (kind === 'VEHICLE') {
      var custOpts = ''; for (var cu = 0; cu < db.customers.length; cu++) custOpts += '<option value="' + pkEsc(db.customers[cu].id) + '">' + pkEsc(db.customers[cu].name) + '</option>';
      pkOpenModal('🚗 Registrar Nueva Placa / Vehículo', 'Disponible en Taller, Facturación y Báscula Camionera',
        '<div class="form-grid"><div class="field"><label>Placa / Matrícula *</label><input type="text" id="qe-veh-plate" placeholder="Ej: SXT-942" style="text-transform:uppercase;font-weight:800" /></div>' +
        '<div class="field"><label>Marca y Línea *</label><input type="text" id="qe-veh-brand" placeholder="Ej: Kenworth T800 / Toyota Hilux" /></div>' +
        '<div class="field"><label>Propietario / Empresa</label><select id="qe-veh-cust">' + custOpts + '</select></div>' +
        '<div class="field"><label>Kilometraje Actual</label><input type="number" id="qe-veh-km" value="45000" /></div></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" class="btn btn-emerald" data-save-quick-entity="VEHICLE">✓ Guardar Placa / Vehículo</button></div>');
      return;
    }
    if (kind === 'WAREHOUSE') {
      var wkOpts = ''; for (var w = 0; w < db.workers.length; w++) wkOpts += '<option value="' + pkEsc(db.workers[w].name) + '">' + pkEsc(db.workers[w].name) + '</option>';
      pkOpenModal('🏭 Registrar Nueva Bodega o Sucursal', 'Se guarda en la tabla de Bodegas para Inventario y Traslados',
        '<div class="form-grid"><div class="field"><label>Nombre de la Bodega *</label><input type="text" id="qe-wh-name" placeholder="Ej: Bodega Sur / Almacén Central" /></div>' +
        '<div class="field"><label>Ciudad / Ubicación</label><select id="qe-wh-city"><option>Sede Principal</option><option>Bogotá D.C.</option><option>Medellín</option><option>Cali</option><option>Barranquilla</option></select></div>' +
        '<div class="field"><label>Responsable de Bodega</label><select id="qe-wh-mgr">' + wkOpts + '</select></div></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" class="btn btn-emerald" data-save-quick-entity="WAREHOUSE">✓ Guardar Bodega</button></div>');
      return;
    }
    if (kind === 'ROOM') {
      pkOpenModal('🛏️ Registrar Nueva Habitación / Cabaña', 'Se agrega al inventario de Alojamiento y Recepción',
        '<div class="form-grid"><div class="field"><label>Número o Nombre *</label><input type="text" id="qe-rm-num" placeholder="Ej: Habitación 205 / Cabaña 05" /></div>' +
        '<div class="field"><label>Tipo de Acomodación</label><select id="qe-rm-type"><option>Sencilla Ejecutiva</option><option>Doble Superior</option><option>Suite Familiar</option><option>Cabaña Campestre</option></select></div>' +
        '<div class="field"><label>Ubicación / Piso</label><select id="qe-rm-floor"><option>Piso 1</option><option>Piso 2</option><option>Piso 3</option><option>Zona Campestre</option></select></div>' +
        '<div class="field"><label>Tarifa por Noche ($)</label><input type="number" id="qe-rm-rate" value="180000" /></div></div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" class="btn btn-emerald" data-save-quick-entity="ROOM">✓ Guardar Habitación</button></div>');
      return;
    }
  }

  function pkOpenNewCustomerModal() {
    var db = STATE.relDb;
    var cntOpts = ''; for (var c = 0; c < db.contracts.length; c++) cntOpts += '<option value="' + pkEsc(db.contracts[c].id) + '">' + pkEsc(db.contracts[c].code + ' — ' + db.contracts[c].entityName) + '</option>';
    var trfOpts = ''; for (var t = 0; t < db.tariffs.length; t++) trfOpts += '<option value="' + pkEsc(db.tariffs[t].id) + '">' + pkEsc(db.tariffs[t].name + ' (-' + db.tariffs[t].discountPct + '%)') + '</option>';
    pkOpenModal('👤 Registrar Nuevo Cliente', 'Se guarda en la tabla de Clientes y queda seleccionado automáticamente',
      '<div class="form-grid" style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Tipo de Documento</label><select id="modal-cust-doctype"><option value="NIT">NIT Empresa</option><option value="CC">Cédula (CC)</option><option value="CE">Cédula Extranjería</option></select></div>' +
      '<div class="field"><label>Número de Documento / NIT *</label><input type="text" id="modal-cust-nit" placeholder="Ej: 901452110" /></div>' +
      '<div class="field"><label>Nombre Completo o Razón Social *</label><input type="text" id="modal-cust-name" placeholder="Ej: Comercializadora del Norte S.A.S." /></div>' +
      '<div class="field"><label>Teléfono / WhatsApp</label><input type="text" id="modal-cust-phone" placeholder="Ej: 315 890 1122" /></div>' +
      '<div class="field"><label>Correo Electrónico</label><input type="email" id="modal-cust-email" placeholder="cliente@correo.com" /></div>' +
      '<div class="field"><label>Ciudad</label><select id="modal-cust-address"><option>Bogotá D.C.</option><option>Medellín</option><option>Cali</option><option>Barranquilla</option><option>Cartagena</option><option>Bucaramanga</option></select></div>' +
      '<div class="field"><label>Convenio / Contrato</label><select id="modal-cust-contract">' + cntOpts + '</select></div>' +
      '<div class="field"><label>Lista de Precios / Tarifa</label><select id="modal-cust-tariff">' + trfOpts + '</select></div>' +
      '<div class="field"><label>Cupo de Crédito Autorizado</label><select id="modal-cust-credit"><option value="0">Contado ($0)</option><option value="2000000">$2.000.000 COP</option><option value="5000000" selected>$5.000.000 COP</option><option value="20000000">$20.000.000 COP</option></select></div></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button type="button" class="btn btn-emerald" id="btn-modal-save-customer">✓ Guardar Cliente y Seleccionar</button></div>');
  }

  function pkOpenRestockModal(prodId) {
    var db = STATE.relDb; var prod = pkFindById(db.products, prodId) || db.products[0]; if (!prod) return;
    var supOpts = ''; for (var s = 0; s < db.suppliers.length; s++) supOpts += '<option value="' + pkEsc(db.suppliers[s].id) + '">' + pkEsc(db.suppliers[s].name) + '</option>';
    pkOpenModal('📥 Surtir Inventario — ' + prod.name, 'Código: ' + prod.code + ' · Existencia actual: ' + prod.stock + ' und',
      '<div class="form-grid" style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Cantidad que Entra (+)</label><input type="number" id="modal-restock-qty" value="12" min="1" /></div>' +
      '<div class="field"><label>Costo Unitario Compra ($)</label><input type="number" id="modal-restock-cost" value="' + prod.costPrice + '" /></div>' +
      '<div class="field"><label>Precio de Venta ($)</label><input type="number" id="modal-restock-sale" value="' + prod.salePrice + '" /></div>' +
      '<div class="field"><label>Proveedor</label><select id="modal-restock-sup">' + supOpts + '</select></div>' +
      '<div class="field"><label>Soporte (Automático)</label><input type="text" id="modal-restock-ref" value="ENT-' + String(Date.now()).slice(-4) + '" readonly style="background:#e2e8f0" /></div>' +
      '<div class="field"><button type="button" class="btn btn-emerald" style="width:100%" data-confirm-restock-id="' + pkEsc(prod.id) + '">✓ Ingresar Unidades</button></div></div>');
  }

  function pkOpenTransferModal(prodId) {
    var db = STATE.relDb; var prod = pkFindById(db.products, prodId) || db.products[0]; if (!prod) return;
    var whOpts = ''; for (var w = 0; w < db.warehouses.length; w++) whOpts += '<option value="' + pkEsc(db.warehouses[w].id) + '">' + pkEsc(db.warehouses[w].name) + '</option>';
    var carOpts = ''; for (var c = 0; c < db.carriers.length; c++) carOpts += '<option value="' + pkEsc(db.carriers[c].name) + '">' + pkEsc(db.carriers[c].name) + '</option>';
    pkOpenModal('🔄 Trasladar Producto de Bodega — ' + prod.name, 'Código: ' + prod.code + ' · Disponible: ' + prod.stock + ' und',
      '<div class="form-grid" style="background:#f8fafc;padding:14px;border-radius:10px;border:1px solid var(--pk-border)">' +
      '<div class="field"><label>Bodega Destino</label><select id="modal-transfer-wh">' + whOpts + '</select></div>' +
      '<div class="field"><label>Transportista Asignado</label><select id="modal-transfer-note">' + carOpts + '</select></div>' +
      '<div class="field"><label>Cantidad a Trasladar</label><input type="number" id="modal-transfer-qty" value="5" min="1" max="' + prod.stock + '" /></div>' +
      '<div class="field"><button type="button" class="btn btn-primary" style="width:100%" data-confirm-transfer-id="' + pkEsc(prod.id) + '">✓ Confirmar Traslado</button></div></div>');
  }

  function pkOpenCustomer360Modal(custId) {
    var db = STATE.relDb; var cust = pkFindById(db.customers, custId) || db.customers[0]; if (!cust) return;
    var contract = cust.contractId ? pkFindById(db.contracts, cust.contractId) : null;
    var tariff = cust.tariffId ? pkFindById(db.tariffs, cust.tariffId) : null;
    var vehHtml = ''; for (var v = 0; v < db.vehicles.length; v++) { var ve = db.vehicles[v]; if (ve.customerId === cust.id) vehHtml += '<tr><td><span class="badge badge-blue">🚗 ' + pkEsc(ve.plate) + '</span></td><td><strong>' + pkEsc(ve.brand) + '</strong></td><td>' + Number(ve.currentKm || 0).toLocaleString('es-CO') + ' km</td><td>SOAT: ' + pkEsc(ve.soatExpiry) + '</td></tr>'; }
    var invHtml = ''; var totalHistorical = 0; for (var i = 0; i < db.invoices.length; i++) { var inv = db.invoices[i]; if (inv.customerId === cust.id) { totalHistorical += Number(inv.total || 0); invHtml += '<tr><td><strong>' + pkEsc(inv.id) + '</strong> (' + pkEsc(inv.date) + ')</td><td>' + pkCop(inv.total) + '</td><td>' + pkCop(inv.pendingBalance) + '</td><td><span class="badge ' + (inv.pendingBalance > 0 ? 'badge-amber' : 'badge-emerald') + '">' + pkEsc(inv.status) + '</span></td></tr>'; } }
    pkOpenModal('👁️ Ficha del Cliente — ' + cust.name, (cust.docType || 'NIT') + ' ' + cust.nit + ' · Tel: ' + cust.phone + ' · ' + cust.city,
      '<div class="kpi-row"><div class="kpi-box"><div class="kpi-label">Compras Acumuladas</div><div class="kpi-val">' + pkCop(totalHistorical) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Saldo por Cobrar</div><div class="kpi-val" style="color:var(--pk-amber)">' + pkCop(cust.currentDebt) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Convenio</div><div class="kpi-val" style="font-size:13px">' + pkEsc(contract ? contract.code : 'Contado') + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Tarifa</div><div class="kpi-val" style="font-size:13px;color:var(--pk-primary)">' + pkEsc(tariff ? tariff.name : 'General') + '</div></div></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0"><strong style="font-size:13px">🚗 Vehículos Asociados:</strong><button type="button" class="btn btn-primary btn-sm" data-print-customer="' + pkEsc(cust.id) + '">🖨️ Imprimir Estado de Cuenta</button></div>' +
      '<div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Placa</th><th>Vehículo</th><th>Kilometraje</th><th>SOAT</th></tr></thead><tbody>' + (vehHtml || '<tr><td colspan="4">Sin vehículos registrados</td></tr>') + '</tbody></table></div>' +
      '<div style="font-size:13px;font-weight:800;margin:8px 0">🧾 Facturas y Cartera:</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Factura</th><th>Total</th><th>Saldo Pendiente</th><th>Estado</th></tr></thead><tbody>' + (invHtml || '<tr><td colspan="4">Sin facturas registradas</td></tr>') + '</tbody></table></div>');
  }

  function pkOpenVehicle360Modal(vehId) {
    var db = STATE.relDb; var ve = pkFindById(db.vehicles, vehId) || db.vehicles[0]; if (!ve) return;
    var histHtml = ''; for (var o = 0; o < db.workOrders.length; o++) { var wo = db.workOrders[o]; if (wo.vehicleId === ve.id || wo.plate === ve.plate) { var sList = []; for (var k = 0; k < (wo.services || []).length; k++) sList.push(wo.services[k].description + ' (' + pkCop(wo.services[k].price) + ')'); histHtml += '<tr><td><code>' + pkEsc(wo.id) + '</code> (' + pkEsc(wo.createdAt) + ')</td><td>' + pkEsc(wo.workerName) + '</td><td>' + pkEsc(sList.join(' + ')) + '</td><td><span class="badge badge-blue">' + pkEsc(wo.status) + '</span></td></tr>'; } }
    pkOpenModal('🚗 Historial de Placa — ' + ve.plate + ' (' + ve.brand + ')', 'Propietario: ' + ve.customerName + ' · Km Actual: ' + Number(ve.currentKm || 0).toLocaleString('es-CO') + ' km',
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:12px"><strong>SOAT:</strong> ' + pkEsc(ve.soatExpiry) + ' · <strong>Próx. Aceite:</strong> ' + Number(ve.nextOilChangeKm || 0).toLocaleString('es-CO') + ' km</span><button type="button" class="btn btn-primary btn-sm" data-print-veh="' + pkEsc(ve.id) + '">🖨️ Imprimir Hoja de Vida</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Orden / Fecha</th><th>Técnico</th><th>Trabajos Realizados</th><th>Estado</th></tr></thead><tbody>' + (histHtml || '<tr><td colspan="4">Sin órdenes previas</td></tr>') + '</tbody></table></div>');
  }

  function pkOpenAbonoModal(invId) {
    var db = STATE.relDb; var inv = pkFindById(db.invoices, invId); if (!inv) return;
    var abRows = ''; var abList = inv.abonosHistory || [];
    for (var a = 0; a < abList.length; a++) abRows += '<tr><td><code>' + pkEsc(abList[a].id) + '</code></td><td>' + pkEsc(abList[a].date) + '</td><td>' + pkEsc(abList[a].method) + '</td><td>' + pkEsc(abList[a].note) + '</td><td style="color:var(--pk-emerald);font-weight:800">+' + pkCop(abList[a].amount) + '</td></tr>';
    pkOpenModal('💵 Registrar Abono o Pago — Factura ' + inv.id, 'Cliente: ' + inv.customerName + ' · Saldo Pendiente: ' + pkCop(inv.pendingBalance),
      '<div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
      '<div class="field"><label>Valor del Abono ($)</label><input type="number" id="modal-abono-amount" value="' + inv.pendingBalance + '" max="' + inv.pendingBalance + '" /></div>' +
      '<div class="field"><label>Medio de Pago</label><select id="modal-abono-method"><option value="Efectivo">💵 Efectivo</option><option value="Transferencia / Nequi">📲 Transferencia / Nequi</option><option value="Tarjeta">💳 Tarjeta</option></select></div>' +
      '<div class="field"><label>Observación</label><div class="row-actions"><input type="text" id="modal-abono-note" value="Abono a factura" style="flex:1" /><button type="button" class="btn btn-emerald btn-sm" data-confirm-abono-inv="' + pkEsc(inv.id) + '">✓ Guardar Abono</button></div></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Fecha</th><th>Medio</th><th>Nota</th><th>Valor</th></tr></thead><tbody>' + (abRows || '<tr><td colspan="5">Sin abonos registrados aún</td></tr>') + '</tbody></table></div>');
  }

  function pkOpenInvoiceModal(invId) {
    var db = STATE.relDb; var inv = pkFindById(db.invoices, invId); if (!inv) return;
    var itRows = ''; for (var i = 0; i < (inv.items || []).length; i++) { var it = inv.items[i]; itRows += '<tr><td>' + pkEsc(it.kind) + '</td><td><strong>' + pkEsc(it.name) + '</strong></td><td>' + it.qty + '</td><td>' + pkCop(it.price) + '</td><td><strong>' + pkCop(it.qty * it.price) + '</strong></td></tr>'; }
    pkOpenModal('🧾 Detalle de Factura ' + inv.id + ' (' + inv.status + ')', 'Cliente: ' + inv.customerName + ' · Fecha: ' + inv.date,
      '<div class="table-wrap" style="margin-bottom:12px"><table><thead><tr><th>Tipo</th><th>Descripción</th><th>Cant.</th><th>Vlr. Unit</th><th>Subtotal</th></tr></thead><tbody>' + itRows + '</tbody></table></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f8fafc;border-radius:10px"><div><strong>Total: ' + pkCop(inv.total) + '</strong> · Pagado: ' + pkCop(inv.amountPaid) + ' · Saldo: ' + pkCop(inv.pendingBalance) + '</div><button type="button" class="btn btn-primary btn-sm" data-print-invoice="' + pkEsc(inv.id) + '">🖨️ Imprimir Factura / Tirilla</button></div>');
  }
`;
}
