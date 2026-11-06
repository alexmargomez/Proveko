/**
 * Plantilla Operativa 4:
 * - `mod-directory`: Directorio de Clientes (con botón + Nuevo Cliente en Modal, Historial y Facturarle).
 * - `mod-contracts`: Contratos y Convenios Empresariales.
 * - `mod-receivables-cxc`: Cuentas por Cobrar a Clientes (Cartera y Abonos).
 * - `mod-dian`: Historial de Facturas Emitidas.
 * - `mod-tech-reception`: Proveedores de Inventario.
 * - `mod-lots`: Kardex de Movimientos de Inventario.
 */
export function renderCrm360CxcHubRuntimeJs(): string {
  return `
  function pkRenderLook360Hub(subKey) {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;

    var q = (STATE.look360Search || '').trim().toLowerCase();

    if (subKey === 'mod-contracts') {
      var ctRows = '';
      for (var ct = 0; ct < db.contracts.length; ct++) {
        var co = db.contracts[ct];
        var tf = pkFindById(db.tariffs, co.tariffId);
        ctRows += '<tr><td><code>' + pkEsc(co.code) + '</code></td><td><strong>' + pkEsc(co.name) + '</strong><div style="font-size:11px;color:var(--pk-muted)">NIT: ' + pkEsc(co.entityNit) + '</div></td>' +
          '<td><span class="badge badge-blue">' + pkEsc(tf ? tf.name + ' (-' + tf.discountPct + '%)' : 'Plena') + '</span></td>' +
          '<td>' + pkCop(co.budgetCeiling) + '</td><td>' + pkCop(co.consumedAmount) + '</td>' +
          '<td><strong style="color:var(--pk-emerald)">' + pkCop(co.availableBalance) + '</strong></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">📑 Contratos y Convenios Activos</div></div>' +
        '<div class="card-body"><div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
        '<div class="field"><label>Código Convenio</label><input type="text" id="cnt-new-code" placeholder="Ej: CNV-2026-09" /></div>' +
        '<div class="field"><label>Empresa / Entidad *</label><input type="text" id="cnt-new-name" placeholder="Ej: Transportes del Caribe S.A." /></div>' +
        '<div class="field"><label>Cupo Presupuestal ($)</label><div class="row-actions"><input type="number" id="cnt-new-budget" value="25000000" style="flex:1" />' +
        '<button type="button" class="btn btn-primary btn-sm" id="btn-cnt-add">+ Crear Convenio</button></div></div></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Código</th><th>Empresa</th><th>Tarifa / Descuento</th><th>Cupo Total</th><th>Consumido</th><th>Saldo Disponible</th></tr></thead><tbody>' + ctRows + '</tbody></table></div></div></div>';
      return;
    }

    if (subKey === 'mod-receivables-cxc' || subKey === 'mod-dian') {
      var dRows = ''; var totalPending = 0;
      for (var d = 0; d < db.invoices.length; d++) {
        var f = db.invoices[d];
        var hasDebt = Number(f.pendingBalance || 0) > 0;
        if (subKey === 'mod-receivables-cxc' && !hasDebt && db.invoices.length > 2) continue;
        totalPending += Number(f.pendingBalance || 0);
        dRows += '<tr>' +
          '<td><strong>' + pkEsc(f.id) + '</strong><div style="font-size:11px;color:var(--pk-muted)">' + pkEsc(f.date) + '</div></td>' +
          '<td><strong>' + pkEsc(f.customerName) + '</strong><div style="font-size:11px;color:var(--pk-muted)">' + pkEsc(f.plate || 'Mostrador') + '</div></td>' +
          '<td>' + pkCop(f.total) + '</td>' +
          '<td style="color:var(--pk-emerald);font-weight:700">' + pkCop(f.amountPaid) + '</td>' +
          '<td><span class="badge ' + (hasDebt ? 'badge-amber' : 'badge-emerald') + '">' + (hasDebt ? 'Debe: ' + pkCop(f.pendingBalance) : '✓ Pagada') + '</span></td>' +
          '<td><div class="row-actions">' +
          (hasDebt ? '<button type="button" class="btn btn-emerald btn-sm" data-open-abono-modal="' + pkEsc(f.id) + '">💵 Abonar / Pagar</button>' : '') +
          '<button type="button" class="btn btn-outline btn-sm" data-open-invoice-modal="' + pkEsc(f.id) + '">🖨️ Ver Factura</button>' +
          '</div></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head">' +
        '<div class="card-title">' + (subKey === 'mod-receivables-cxc' ? '📒 Cuentas por Cobrar a Clientes (Cartera)' : '🧾 Historial de Facturas Emitidas') + '</div>' +
        '<span class="badge badge-amber" style="font-size:13px">Total por Cobrar: ' + pkCop(totalPending) + '</span></div>' +
        '<div class="card-body"><div class="table-wrap"><table><thead><tr>' +
        '<th>Factura / Fecha</th><th>Cliente</th><th>Total Factura</th><th>Abonado</th><th>Saldo Pendiente</th><th>Acciones</th>' +
        '</tr></thead><tbody>' + (dRows || '<tr><td colspan="6" style="text-align:center;padding:16px">No hay facturas pendientes de cobro.</td></tr>') + '</tbody></table></div></div></div>';
      return;
    }

    if (subKey === 'mod-tech-reception') {
      var sRows = '';
      for (var s = 0; s < db.suppliers.length; s++) {
        var sp = db.suppliers[s];
        sRows += '<tr><td><code>' + pkEsc(sp.nit) + '</code></td><td><strong>' + pkEsc(sp.name) + '</strong></td><td>' + pkEsc(sp.contactName) + '</td><td>' + pkEsc(sp.phone) + '</td><td>' + pkEsc(sp.city) + '</td>' +
          '<td><button type="button" class="btn btn-outline btn-sm" data-sup-delete-id="' + pkEsc(sp.id) + '">🗑️</button></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">🚚 Proveedores Registrados (' + db.suppliers.length + ')</div></div>' +
        '<div class="card-body"><div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
        '<div class="field"><label>NIT</label><input type="text" id="sup-new-nit" placeholder="Ej: 900.441.220-1" /></div>' +
        '<div class="field"><label>Nombre del Proveedor *</label><input type="text" id="sup-new-name" placeholder="Ej: Importadora de Repuestos S.A." /></div>' +
        '<div class="field"><label>Teléfono y Contacto</label><div class="row-actions"><input type="text" id="sup-new-phone" placeholder="Ej: 310 555 8899" style="flex:1" />' +
        '<button type="button" class="btn btn-primary btn-sm" id="btn-sup-add">+ Guardar Proveedor</button></div></div></div>' +
        '<div class="table-wrap"><table><thead><tr><th>NIT</th><th>Proveedor</th><th>Contacto</th><th>Teléfono</th><th>Ciudad</th><th>Acción</th></tr></thead><tbody>' + sRows + '</tbody></table></div></div></div>';
      return;
    }

    if (subKey === 'mod-lots') {
      var kRows = '';
      for (var km = 0; km < db.kardexMovements.length; km++) {
        var kv = db.kardexMovements[km];
        kRows += '<tr><td>' + pkEsc(kv.date) + '</td><td><span class="badge ' + (kv.qty > 0 ? 'badge-emerald' : 'badge-amber') + '">' + pkEsc(kv.movementType) + '</span></td>' +
          '<td><strong>' + pkEsc(kv.productName) + '</strong></td><td>' + (kv.qty > 0 ? '+' + kv.qty : kv.qty) + ' und</td><td><strong>' + kv.balanceAfter + ' und</strong></td><td><code>' + pkEsc(kv.referenceDoc) + '</code></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">📊 Historial de Entradas y Salidas de Inventario (Kardex)</div></div>' +
        '<div class="card-body"><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Cantidad</th><th>Saldo en Bodega</th><th>Referencia</th></tr></thead><tbody>' + kRows + '</tbody></table></div></div></div>';
      return;
    }

    var cRows = '';
    for (var c = 0; c < db.customers.length; c++) {
      var cu = db.customers[c];
      if (q && (cu.name + ' ' + cu.nit + ' ' + cu.city).toLowerCase().indexOf(q) === -1) continue;
      cRows += '<tr>' +
        '<td><code>' + pkEsc(cu.docType + ' ' + cu.nit + (cu.dv ? '-' + cu.dv : '')) + '</code></td>' +
        '<td><strong>' + pkEsc(cu.name) + '</strong></td>' +
        '<td>📞 ' + pkEsc(cu.phone) + ' · ' + pkEsc(cu.city) + '</td>' +
        '<td>' + pkCop(cu.creditLimit) + '</td>' +
        '<td><strong style="color:' + (cu.currentDebt > 0 ? 'var(--pk-amber)' : 'var(--pk-emerald)') + '">' + pkCop(cu.currentDebt) + '</strong></td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-open-customer-360="' + pkEsc(cu.id) + '">👁️ Historial</button>' +
        '<button type="button" class="btn btn-emerald btn-sm" data-pos-select-cust-go="' + pkEsc(cu.id) + '">🛒 Facturarle</button>' +
        '<button type="button" class="btn btn-outline btn-sm" data-cust-delete-id="' + pkEsc(cu.id) + '">🗑️</button>' +
        '</div></td></tr>';
    }
    stage.innerHTML =
      '<div class="card"><div class="card-head"><div class="card-title">👥 Directorio de Clientes (' + db.customers.length + ')</div>' +
      '<div class="row-actions">' +
      '<input type="text" id="look360-search-input" value="' + pkEsc(STATE.look360Search || '') + '" placeholder="🔎 Buscar por nombre, NIT o ciudad..." style="padding:6px 10px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px;min-width:220px" />' +
      '<button type="button" class="btn btn-primary btn-sm" data-open-new-customer-modal="1">+ Registrar Nuevo Cliente</button>' +
      '</div></div>' +
      '<div class="card-body"><div class="table-wrap"><table><thead><tr>' +
      '<th>NIT / Documento</th><th>Nombre o Razón Social</th><th>Teléfono / Ciudad</th><th>Cupo Crédito</th><th>Saldo Pendiente</th><th>Acciones</th>' +
      '</tr></thead><tbody>' + cRows + '</tbody></table></div></div></div>';
  }
`;
}
