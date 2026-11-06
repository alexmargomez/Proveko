/**
 * Plantilla Operativa 4 (<= 200 líneas):
 * - `mod-directory`: Directorio de Clientes con Formulario Superior Directo (Selects + DV Automático) + Impresión.
 * - `mod-contracts`: Contratos y Convenios (Consecutivo Automático + Select de Cliente y Tarifa + Impresión).
 * - `mod-receivables-cxc` y `mod-dian`: Cartera y Facturas con Abonos e Impresión PDF.
 * - `mod-tech-reception` y `mod-lots`: Proveedores y Kardex con Impresión.
 */
export function renderCrm360CxcHubRuntimeJs(): string {
  return `
  function pkRenderLook360Hub(subKey) {
    var db = STATE.relDb;
    var stage = document.getElementById('ws-module-stage');
    if (!stage || !db) return;

    var q = (STATE.look360Search || '').trim().toLowerCase();
    var cntOpts = '';
    for (var k1 = 0; k1 < db.contracts.length; k1++) {
      cntOpts += '<option value="' + pkEsc(db.contracts[k1].id) + '">' + pkEsc(db.contracts[k1].code + ' — ' + db.contracts[k1].entityName) + '</option>';
    }
    var trfOpts = '';
    for (var k2 = 0; k2 < db.tariffs.length; k2++) {
      trfOpts += '<option value="' + pkEsc(db.tariffs[k2].id) + '">' + pkEsc(db.tariffs[k2].name + ' (-' + db.tariffs[k2].discountPct + '%)') + '</option>';
    }
    var custOpts = '';
    for (var k3 = 0; k3 < db.customers.length; k3++) {
      custOpts += '<option value="' + pkEsc(db.customers[k3].name) + '">' + pkEsc(db.customers[k3].name + ' (' + db.customers[k3].nit + ')') + '</option>';
    }

    if (subKey === 'mod-contracts') {
      var nextCntCode = 'CNV-2026-' + (100 + db.contracts.length + 1);
      var ctRows = '';
      for (var ct = 0; ct < db.contracts.length; ct++) {
        var co = db.contracts[ct];
        ctRows += '<tr><td><code>' + pkEsc(co.code) + '</code></td><td><strong>' + pkEsc(co.entityName || co.name) + '</strong></td>' +
          '<td><span class="badge badge-blue">' + pkEsc(co.tariffName || 'Tarifa Convenio') + '</span></td>' +
          '<td>' + pkCop(co.budgetCeiling) + '</td><td>' + pkCop(co.consumedAmount) + '</td>' +
          '<td><strong style="color:var(--pk-emerald)">' + pkCop(co.availableBalance) + '</strong></td>' +
          '<td><button type="button" class="btn btn-outline btn-sm" data-print-contract="' + pkEsc(co.id) + '">🖨️ Imprimir Convenio</button></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">📑 Contratos y Convenios Empresariales</div>' +
        '<button type="button" class="btn btn-outline btn-sm" data-open-new-customer-modal="1">+ Nuevo Cliente</button></div>' +
        '<div class="card-body"><div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
        '<div class="field"><label>Código Convenio (Automático)</label><input type="text" id="cnt-new-code" value="' + nextCntCode + '" readonly style="background:#e2e8f0;font-weight:800" /></div>' +
        '<div class="field"><label>Seleccionar Cliente / Empresa</label><select id="cnt-new-entity">' + custOpts + '</select></div>' +
        '<div class="field"><label>Lista de Precios / Tarifa</label><select id="cnt-new-tariff">' + trfOpts + '</select></div>' +
        '<div class="field"><label>Cupo Presupuestal ($)</label><div class="row-actions"><input type="number" id="cnt-new-ceiling" value="25000000" style="flex:1" />' +
        '<button type="button" class="btn btn-primary" id="btn-cnt-add">✓ Crear Convenio</button></div></div></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Código</th><th>Empresa</th><th>Tarifa</th><th>Cupo Total</th><th>Consumido</th><th>Disponible</th><th>Acciones</th></tr></thead><tbody>' + ctRows + '</tbody></table></div></div></div>';
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
          (hasDebt ? '<button type="button" class="btn btn-emerald btn-sm" data-open-abono-modal="' + pkEsc(f.id) + '">💵 Abonar</button>' : '') +
          '<button type="button" class="btn btn-outline btn-sm" data-open-invoice-modal="' + pkEsc(f.id) + '">👁️ Detalle</button>' +
          '<button type="button" class="btn btn-primary btn-sm" data-print-invoice="' + pkEsc(f.id) + '">🖨️ Imprimir</button>' +
          '</div></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head">' +
        '<div class="card-title">' + (subKey === 'mod-receivables-cxc' ? '📒 Cuentas por Cobrar a Clientes (Cartera)' : '🧾 Historial de Facturas Emitidas') + '</div>' +
        '<div class="row-actions"><span class="badge badge-amber" style="font-size:13px">Total por Cobrar: ' + pkCop(totalPending) + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-export-csv="invoices">📥 Exportar Excel</button></div></div>' +
        '<div class="card-body"><div class="table-wrap"><table><thead><tr>' +
        '<th>Factura / Fecha</th><th>Cliente</th><th>Total Factura</th><th>Abonado</th><th>Saldo Pendiente</th><th>Acciones</th>' +
        '</tr></thead><tbody>' + (dRows || '<tr><td colspan="6" style="text-align:center;padding:16px">No hay facturas pendientes de cobro.</td></tr>') + '</tbody></table></div></div></div>';
      return;
    }

    if (subKey === 'mod-tech-reception') {
      var sRows = '';
      for (var s = 0; s < db.suppliers.length; s++) {
        var sp = db.suppliers[s];
        sRows += '<tr><td><code>' + pkEsc(sp.nit) + '</code></td><td><strong>' + pkEsc(sp.name) + '</strong></td><td>' + pkEsc(sp.contactName || 'Comercial') + '</td><td>' + pkEsc(sp.phone) + '</td><td>' + pkEsc(sp.city) + '</td>' +
          '<td><div class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-print-supplier="' + pkEsc(sp.id) + '">🖨️ Ficha</button>' +
          '<button type="button" class="btn btn-outline btn-sm" data-sup-delete-id="' + pkEsc(sp.id) + '">🗑️</button></div></td></tr>';
      }
      stage.innerHTML =
        '<div class="card"><div class="card-head"><div class="card-title">🚚 Proveedores Registrados (' + db.suppliers.length + ')</div></div>' +
        '<div class="card-body"><div class="form-grid" style="background:#f8fafc;padding:12px;border-radius:10px;border:1px solid var(--pk-border);margin-bottom:12px">' +
        '<div class="field"><label>NIT Proveedor</label><input type="text" id="sup-new-nit" placeholder="Ej: 900.441.220-1" /></div>' +
        '<div class="field"><label>Razón Social del Proveedor *</label><input type="text" id="sup-new-name" placeholder="Ej: Importadora Nacional S.A.S." /></div>' +
        '<div class="field"><label>Ciudad</label><select id="sup-new-city"><option>Bogotá D.C.</option><option>Medellín</option><option>Cali</option><option>Barranquilla</option><option>Cartagena</option><option>Bucaramanga</option></select></div>' +
        '<div class="field"><label>Teléfono</label><div class="row-actions"><input type="text" id="sup-new-phone" placeholder="Ej: 310 555 8899" style="flex:1" />' +
        '<button type="button" class="btn btn-primary" id="btn-sup-add">✓ Guardar Proveedor</button></div></div></div>' +
        '<div class="table-wrap"><table><thead><tr><th>NIT</th><th>Proveedor</th><th>Contacto</th><th>Teléfono</th><th>Ciudad</th><th>Acciones</th></tr></thead><tbody>' + sRows + '</tbody></table></div></div></div>';
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
        '<div class="card"><div class="card-head"><div class="card-title">📊 Kardex de Movimientos de Inventario</div>' +
        '<button type="button" class="btn btn-outline btn-sm" id="btn-std-print-table">🖨️ Imprimir Kardex PDF</button></div>' +
        '<div class="card-body"><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Cantidad</th><th>Saldo en Bodega</th><th>Referencia</th></tr></thead><tbody>' + kRows + '</tbody></table></div></div></div>';
      return;
    }

    var cRows = '';
    for (var c = 0; c < db.customers.length; c++) {
      var cu = db.customers[c];
      if (q && (cu.name + ' ' + cu.nit + ' ' + cu.city).toLowerCase().indexOf(q) === -1) continue;
      cRows += '<tr>' +
        '<td><code>' + pkEsc((cu.docType || 'NIT') + ' ' + cu.nit + (cu.dv ? '-' + cu.dv : '')) + '</code></td>' +
        '<td><strong>' + pkEsc(cu.name) + '</strong></td>' +
        '<td>📞 ' + pkEsc(cu.phone) + ' · ' + pkEsc(cu.city) + '</td>' +
        '<td>' + pkCop(cu.creditLimit) + '</td>' +
        '<td><strong style="color:' + (cu.currentDebt > 0 ? 'var(--pk-amber)' : 'var(--pk-emerald)') + '">' + pkCop(cu.currentDebt) + '</strong></td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" data-open-customer-360="' + pkEsc(cu.id) + '">👁️ Expediente</button>' +
        '<button type="button" class="btn btn-primary btn-sm" data-print-customer="' + pkEsc(cu.id) + '">🖨️ Imprimir</button>' +
        '<button type="button" class="btn btn-emerald btn-sm" data-pos-select-cust-go="' + pkEsc(cu.id) + '">🛒 Facturarle</button>' +
        '<button type="button" class="btn btn-outline btn-sm" style="color:var(--pk-rose)" data-cust-delete-id="' + pkEsc(cu.id) + '">🗑️</button>' +
        '</div></td></tr>';
    }
    stage.innerHTML =
      '<div class="card" style="border:2px solid #bfdbfe;background:#f8fafc">' +
      '<div class="card-head"><div><div class="card-title">➕ Registrar Nuevo Cliente</div>' +
      '<div class="card-sub">El cliente queda disponible de inmediato en Facturación, Taller, Hotelería, Reservas y Cartera</div></div>' +
      '<button type="button" class="btn btn-emerald" id="btn-inline-save-customer">✓ Guardar Cliente</button></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>Tipo de Documento</label><select id="inline-cust-doctype"><option value="NIT">NIT Empresa</option><option value="CC">Cédula (CC)</option><option value="CE">Cédula Extranjería</option></select></div>' +
      '<div class="field"><label>Número Documento / NIT *</label><input type="text" id="inline-cust-nit" placeholder="Ej: 901452110" /></div>' +
      '<div class="field"><label>Nombre o Razón Social *</label><input type="text" id="inline-cust-name" placeholder="Ej: Ferretería y Suministros del Sur S.A.S." /></div>' +
      '<div class="field"><label>Teléfono / WhatsApp</label><input type="text" id="inline-cust-phone" placeholder="Ej: 315 890 1122" /></div>' +
      '<div class="field"><label>Ciudad</label><select id="inline-cust-city"><option>Bogotá D.C.</option><option>Medellín</option><option>Cali</option><option>Barranquilla</option><option>Cartagena</option><option>Bucaramanga</option><option>Pereira</option></select></div>' +
      '<div class="field"><label>Convenio / Contrato</label><select id="inline-cust-contract">' + cntOpts + '</select></div>' +
      '<div class="field"><label>Lista de Precios / Tarifa</label><select id="inline-cust-tariff">' + trfOpts + '</select></div>' +
      '<div class="field"><label>Cupo de Crédito Autorizado</label><select id="inline-cust-credit"><option value="0">Contado ($0)</option><option value="2000000">$2.000.000 COP</option><option value="5000000" selected>$5.000.000 COP</option><option value="15000000">$15.000.000 COP</option><option value="50000000">$50.000.000 COP</option></select></div>' +
      '</div></div></div>' +

      '<div class="card"><div class="card-head"><div class="card-title">👥 Clientes Registrados (' + db.customers.length + ')</div>' +
      '<div class="row-actions">' +
      '<input type="text" id="look360-search-input" value="' + pkEsc(STATE.look360Search || '') + '" placeholder="🔎 Buscar por nombre, NIT o ciudad..." style="padding:7px 12px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px;min-width:240px" />' +
      '<button type="button" class="btn btn-outline btn-sm" id="btn-std-print-table">🖨️ Imprimir Directorio</button>' +
      '</div></div>' +
      '<div class="card-body"><div class="table-wrap"><table><thead><tr>' +
      '<th>Documento</th><th>Nombre o Razón Social</th><th>Teléfono / Ciudad</th><th>Cupo Crédito</th><th>Saldo Cartera</th><th>Acciones</th>' +
      '</tr></thead><tbody>' + cRows + '</tbody></table></div></div></div>';
  }
`;
}
