/**
 * Hub Relacional 4 (`look360`): Consultas 360°, Expediente de Clientes/Vehículos, Contratos v2 y Cartera CxC con Abonos
 * (Inspirado en FactuPOS `look.jsx`, `ReportCustomer.jsx`, `ReportVehicle.jsx`, `FactuView.jsx` y `hc_version2` `Clientes`, `Contratos`, `Glosas`).
 */
export function renderCrm360CxcHubRuntimeJs(): string {
  return `
  function pkRenderLook360Hub() {
    var db = STATE.relDb;
    var container = document.getElementById('ws-converged-hub-container');
    if (!container || !db) return;

    var tab = STATE.look360Tab || 'customers';
    var q = (STATE.look360Search || '').trim().toLowerCase();

    var totalCxc = 0; var creditInvoicesCount = 0;
    for (var invIdx = 0; invIdx < db.invoices.length; invIdx++) {
      var inv = db.invoices[invIdx];
      if (Number(inv.pendingBalance || 0) > 0) {
        totalCxc += Number(inv.pendingBalance);
        creditInvoicesCount++;
      }
    }

    var tableHtml = '';
    if (tab === 'customers') {
      var cRows = '';
      for (var c = 0; c < db.customers.length; c++) {
        var cu = db.customers[c];
        if (q && (cu.name + ' ' + cu.nit + ' ' + cu.city).toLowerCase().indexOf(q) === -1) continue;
        var contract = cu.contractId ? pkFindById(db.contracts, cu.contractId) : null;
        var tariff = cu.tariffId ? pkFindById(db.tariffs, cu.tariffId) : null;
        var vehCount = 0; var invCount = 0;
        for (var v = 0; v < db.vehicles.length; v++) if (db.vehicles[v].customerId === cu.id) vehCount++;
        for (var iv = 0; iv < db.invoices.length; iv++) if (db.invoices[iv].customerId === cu.id) invCount++;
        cRows += '<tr>' +
          '<td><strong>' + pkEsc(cu.name) + '</strong><div style="font-size:11px;color:var(--pk-muted)">' + pkEsc(cu.docType + ' ' + cu.nit + (cu.dv ? '-' + cu.dv : '') + ' · ' + cu.taxRegime) + '</div></td>' +
          '<td>' + pkEsc(cu.city) + '<div style="font-size:11px;color:var(--pk-muted)">📞 ' + pkEsc(cu.phone) + '</div></td>' +
          '<td><span class="badge badge-blue">' + pkEsc(contract ? contract.code : 'Contado') + '</span> <span class="badge badge-slate">' + pkEsc(tariff ? tariff.name : 'Plena') + '</span></td>' +
          '<td><span class="badge badge-emerald">🚗 ' + vehCount + ' activos</span> <span class="badge badge-blue">🧾 ' + invCount + ' fact.</span></td>' +
          '<td><strong style="color:' + (cu.currentDebt > 0 ? 'var(--pk-amber)' : 'var(--pk-emerald)') + '">' + pkCop(cu.currentDebt) + '</strong> / Cupo: ' + pkCop(cu.creditLimit) + '</td>' +
          '<td><div class="row-actions">' +
          '<button type="button" class="btn btn-primary btn-sm" data-open-customer-360="' + pkEsc(cu.id) + '">👁️ Expediente 360°</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-pos-select-cust-go="' + pkEsc(cu.id) + '">🛒 Facturarle</button></div></td></tr>';
      }
      tableHtml = '<table><thead><tr><th>Tercero / NIT DIAN</th><th>Ciudad / WhatsApp</th><th>Contrato y Tarifa (FK)</th><th>Relaciones FK</th><th>Deuda CxC / Cupo</th><th>Acciones 360°</th></tr></thead><tbody>' + cRows + '</tbody></table>';
    } else if (tab === 'cxc') {
      var dRows = '';
      for (var d = 0; d < db.invoices.length; d++) {
        var f = db.invoices[d];
        if (q && (f.id + ' ' + f.customerName + ' ' + f.plate).toLowerCase().indexOf(q) === -1) continue;
        var hasDebt = Number(f.pendingBalance || 0) > 0;
        dRows += '<tr>' +
          '<td><strong>' + pkEsc(f.id) + '</strong><div style="font-size:11px;color:var(--pk-muted)">' + pkEsc(f.date) + '</div></td>' +
          '<td><strong>' + pkEsc(f.customerName) + '</strong><div style="font-size:11px;color:var(--pk-muted)">🚗 Placa FK: ' + pkEsc(f.plate || 'Mostrador') + '</div></td>' +
          '<td>' + pkCop(f.total) + '</td>' +
          '<td style="color:var(--pk-emerald);font-weight:700">' + pkCop(f.amountPaid) + '</td>' +
          '<td><span class="badge ' + (hasDebt ? 'badge-amber' : 'badge-emerald') + '" style="font-size:12px">' + (hasDebt ? 'Debe: ' + pkCop(f.pendingBalance) : '✓ Paz y Salvo') + '</span></td>' +
          '<td><div class="row-actions">' +
          (hasDebt ? '<button type="button" class="btn btn-emerald btn-sm" data-open-abono-modal="' + pkEsc(f.id) + '">💵 Registrar Abono / Pagar</button>' : '') +
          '<button type="button" class="btn btn-outline btn-sm" data-open-invoice-modal="' + pkEsc(f.id) + '">🖨️ Ver Factura / Glosa</button></div></td></tr>';
      }
      tableHtml = '<table><thead><tr><th>Factura / Fecha</th><th>Cliente y Vehículo (FK)</th><th>Total Factura</th><th>Total Abonado</th><th>Saldo Pendiente CxC</th><th>Recaudo / Visor</th></tr></thead><tbody>' + dRows + '</tbody></table>';
    } else if (tab === 'vehicles') {
      var vRows = '';
      for (var vh = 0; vh < db.vehicles.length; vh++) {
        var ve = db.vehicles[vh];
        if (q && (ve.plate + ' ' + ve.brand + ' ' + ve.customerName).toLowerCase().indexOf(q) === -1) continue;
        vRows += '<tr>' +
          '<td><span class="badge badge-blue" style="font-size:12px">🚗 ' + pkEsc(ve.plate) + '</span></td>' +
          '<td><strong>' + pkEsc(ve.brand) + '</strong> (' + ve.modelYear + ')</td>' +
          '<td>👤 <strong>' + pkEsc(ve.customerName) + '</strong></td>' +
          '<td>Actual: <strong>' + ve.currentKm.toLocaleString('es-CO') + ' km</strong> · Próx Aceite: <strong>' + ve.nextOilChangeKm.toLocaleString('es-CO') + ' km</strong></td>' +
          '<td>SOAT: ' + pkEsc(ve.soatExpiry) + ' · Tecno: ' + pkEsc(ve.tecnoExpiry) + '</td>' +
          '<td><button type="button" class="btn btn-primary btn-sm" data-open-vehicle-360="' + pkEsc(ve.id) + '">👁️ Hoja de Vida Placa</button></td></tr>';
      }
      tableHtml = '<table><thead><tr><th>Placa</th><th>Marca / Línea</th><th>Propietario (FK -> customers)</th><th>Control Kilometraje / Aceite</th><th>Vencimientos Legales</th><th>Historial</th></tr></thead><tbody>' + vRows + '</tbody></table>';
    } else if (tab === 'contracts') {
      var ctRows = '';
      for (var ct = 0; ct < db.contracts.length; ct++) {
        var co = db.contracts[ct];
        var tf = pkFindById(db.tariffs, co.tariffId);
        ctRows += '<tr>' +
          '<td><code>' + pkEsc(co.code) + '</code></td>' +
          '<td><strong>' + pkEsc(co.name) + '</strong><div style="font-size:11px;color:var(--pk-muted)">Entidad: ' + pkEsc(co.entityNit) + '</div></td>' +
          '<td><span class="badge badge-blue">' + pkEsc(tf ? tf.name + ' (-' + tf.discountPct + '%)' : co.tariffId) + '</span></td>' +
          '<td>' + pkCop(co.budgetCeiling) + '</td>' +
          '<td>' + pkCop(co.consumedAmount) + '</td>' +
          '<td><strong style="color:var(--pk-emerald)">' + pkCop(co.availableBalance) + '</strong></td></tr>';
      }
      tableHtml = '<table><thead><tr><th>Código Contrato</th><th>Convenio / Entidad (Estilo v2)</th><th>Tarifario Enlazado (FK)</th><th>Techo Presupuestal</th><th>Ejecutado / Facturado</th><th>Saldo Disponible</th></tr></thead><tbody>' + ctRows + '</tbody></table>';
    } else {
      var kRows = '';
      for (var km = 0; km < db.kardexMovements.length; km++) {
        var kv = db.kardexMovements[km];
        kRows += '<tr>' +
          '<td><code>' + pkEsc(kv.id) + '</code><div style="font-size:10px;color:var(--pk-muted)">' + pkEsc(kv.date) + '</div></td>' +
          '<td><span class="badge ' + (kv.movementType.indexOf('ENTRADA') !== -1 ? 'badge-emerald' : 'badge-amber') + '">' + pkEsc(kv.movementType) + '</span></td>' +
          '<td><strong>' + pkEsc(kv.productName) + '</strong></td>' +
          '<td>' + (kv.qty > 0 ? '+' + kv.qty : kv.qty) + ' und (Saldo: <strong>' + kv.balanceAfter + '</strong>)</td>' +
          '<td>' + pkCop(kv.unitCost) + '</td>' +
          '<td><code>' + pkEsc(kv.referenceDoc) + '</code> · ' + pkEsc(kv.actor) + '</td></tr>';
      }
      tableHtml = '<table><thead><tr><th>Movimiento / Fecha</th><th>Tipo Operación</th><th>Producto (FK)</th><th>Cantidad / Saldo Post</th><th>Costo Unit.</th><th>Documento Origen (FK)</th></tr></thead><tbody>' + kRows + '</tbody></table>';
    }

    container.innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Terceros / Clientes Activos</div><div class="kpi-val">' + db.customers.length + ' empresas/personas</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Vehículos / Activos Enlazados</div><div class="kpi-val" style="color:var(--pk-primary)">' + db.vehicles.length + ' placas con FK</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Total Cartera por Cobrar (CxC)</div><div class="kpi-val" style="color:var(--pk-amber)">' + pkCop(totalCxc) + ' (' + creditInvoicesCount + ' fact.)</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Contratos y Convenios v2</div><div class="kpi-val" style="color:var(--pk-emerald)">' + db.contracts.length + ' vigentes</div></div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><div class="row-actions">' +
      '<button type="button" class="btn ' + (tab === 'customers' ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-look360-tab="customers">👥 Clientes y Terceros 360° (' + db.customers.length + ')</button>' +
      '<button type="button" class="btn ' + (tab === 'cxc' ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-look360-tab="cxc">💵 Cartera CxC, Facturas y Abonos (' + db.invoices.length + ')</button>' +
      '<button type="button" class="btn ' + (tab === 'vehicles' ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-look360-tab="vehicles">🚗 Vehículos y Activos (' + db.vehicles.length + ')</button>' +
      '<button type="button" class="btn ' + (tab === 'contracts' ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-look360-tab="contracts">📑 Contratos y Tarifarios v2 (' + db.contracts.length + ')</button>' +
      '<button type="button" class="btn ' + (tab === 'kardex' ? 'btn-primary' : 'btn-outline') + ' btn-sm" data-look360-tab="kardex">📊 Kardex Auditoría (' + db.kardexMovements.length + ')</button>' +
      '</div>' +
      '<input type="text" id="look360-search-input" value="' + pkEsc(STATE.look360Search || '') + '" placeholder="🔎 Filtrar por cliente, NIT, placa o factura..." style="padding:6px 10px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px;min-width:220px" />' +
      '</div><div class="card-body"><div class="table-wrap">' + tableHtml + '</div></div></div>';
  }
`;
}
