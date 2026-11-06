/**
 * Hub Relacional 3 (`inventory`): Inventario Valorizado, Bodegas WMS, Entradas de Compra a Proveedores y Actas Técnicas v2
 * (Inspirado en FactuPOS `inventory.jsx` + `hc_version2` `InventarioRecepcionTecnica` e `InventarioKardexProductoBodega`).
 */
export function renderInventoryWmsHubRuntimeJs(): string {
  return `
  function pkRenderInventoryHub() {
    var db = STATE.relDb;
    var container = document.getElementById('ws-converged-hub-container');
    if (!container || !db) return;

    var totalCostVal = 0;
    var totalSaleVal = 0;
    var lowStockCount = 0;
    var whFilter = STATE.invWarehouseFilter || 'ALL';
    var qSearch = (STATE.invSearchText || '').trim().toLowerCase();

    var whOpts = '<option value="ALL">Todas las Bodegas (' + db.warehouses.length + ')</option>';
    var whSelectForm = '';
    for (var w = 0; w < db.warehouses.length; w++) {
      var wh = db.warehouses[w];
      whOpts += '<option value="' + pkEsc(wh.id) + '" ' + (whFilter === wh.id ? 'selected' : '') + '>' + pkEsc(wh.code + ' — ' + wh.name) + '</option>';
      whSelectForm += '<option value="' + pkEsc(wh.id) + '">' + pkEsc(wh.code + ' — ' + wh.name) + '</option>';
    }

    var supOpts = '';
    for (var s = 0; s < db.suppliers.length; s++) {
      var sp = db.suppliers[s];
      supOpts += '<option value="' + pkEsc(sp.id) + '">' + pkEsc(sp.name + ' (NIT ' + sp.nit + ' · ' + sp.city + ')') + '</option>';
    }

    var prodOpts = '<option value="NEW">+ Crear Nuevo Producto / Referencia en Catálogo</option>';
    var rowsHtml = '';
    for (var i = 0; i < db.products.length; i++) {
      var p = db.products[i];
      prodOpts += '<option value="' + pkEsc(p.id) + '">' + pkEsc('[' + p.code + '] ' + p.name + ' (Stock actual: ' + p.stock + ')') + '</option>';
      var costLine = Number(p.costPrice || 0) * Number(p.stock || 0);
      var saleLine = Number(p.salePrice || 0) * Number(p.stock || 0);
      totalCostVal += costLine;
      totalSaleVal += saleLine;
      if (Number(p.stock || 0) <= Number(p.minStock || 5)) lowStockCount++;

      if (whFilter !== 'ALL' && p.warehouseId !== whFilter) continue;
      if (qSearch && (p.code + ' ' + p.name + ' ' + p.category).toLowerCase().indexOf(qSearch) === -1) continue;

      var whObj = pkFindById(db.warehouses, p.warehouseId);
      var supObj = pkFindById(db.suppliers, p.supplierId);
      var unitProfit = Number(p.salePrice || 0) - Number(p.costPrice || 0);
      var marginPct = p.salePrice > 0 ? Math.round((unitProfit / p.salePrice) * 100) : 0;
      var isLow = Number(p.stock || 0) <= Number(p.minStock || 5);

      rowsHtml += '<tr>' +
        '<td><code>' + pkEsc(p.code) + '</code><div style="font-size:10px;color:var(--pk-muted)">Lote: ' + pkEsc(p.lotCode || 'N/A') + '</div></td>' +
        '<td><strong>' + pkEsc(p.name) + '</strong><div style="font-size:11px;color:var(--pk-muted)">🏷️ ' + pkEsc(p.category) + ' · 🤝 FK Prov: ' + pkEsc(supObj ? supObj.name : 'Directo') + '</div></td>' +
        '<td><span class="badge badge-slate">' + pkEsc(whObj ? whObj.name : p.warehouseId) + '</span></td>' +
        '<td>' + pkCop(p.costPrice) + '</td>' +
        '<td><strong>' + pkCop(p.salePrice) + '</strong></td>' +
        '<td><span class="badge badge-emerald">+' + pkCop(unitProfit) + ' (' + marginPct + '%)</span></td>' +
        '<td><div class="row-actions">' +
        '<button type="button" class="btn btn-outline btn-sm" data-inv-delta="-1" data-inv-id="' + pkEsc(p.id) + '">-1</button>' +
        '<span class="badge ' + (isLow ? 'badge-amber' : 'badge-blue') + '" style="font-size:12px">' + p.stock + ' und' + (isLow ? ' ⚠️ Bajo' : '') + '</span>' +
        '<button type="button" class="btn btn-outline btn-sm" data-inv-delta="1" data-inv-id="' + pkEsc(p.id) + '">+1</button>' +
        '</div></td></tr>';
    }

    var potentialProfit = totalSaleVal - totalCostVal;
    var globalMarginPct = totalSaleVal > 0 ? Math.round((potentialProfit / totalSaleVal) * 100) : 0;

    container.innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="kpi-label">Costo Total en Bodega (Inversión)</div><div class="kpi-val">' + pkCop(totalCostVal) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Valor Total de Venta (PVP)</div><div class="kpi-val" style="color:var(--pk-primary)">' + pkCop(totalSaleVal) + '</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Ganancia Potencial Estimada</div><div class="kpi-val" style="color:var(--pk-emerald)">' + pkCop(potentialProfit) + ' (' + globalMarginPct + '%)</div></div>' +
      '<div class="kpi-box"><div class="kpi-label">Alertas Stock Mínimo / Crítico</div><div class="kpi-val" style="color:' + (lowStockCount > 0 ? 'var(--pk-amber)' : 'var(--pk-emerald)') + '">' + lowStockCount + ' referencias</div></div>' +
      '</div>' +

      '<div class="card"><div class="card-head"><div>' +
      '<div class="card-title">📥 1. Registrar Entrada de Compra a Proveedor / Acta de Recepción Técnica v2 (FK -> suppliers, warehouses, kardex)</div>' +
      '<div class="card-sub">Incrementa existencias automáticamente, actualiza el costo de compra/PVP y deja trazabilidad auditable en el Kardex Valorizado</div></div></div>' +
      '<div class="card-body"><div class="form-grid">' +
      '<div class="field"><label>Producto Existente o Nuevo (FK -> products)</label><select id="inv-entry-product-id">' + prodOpts + '</select></div>' +
      '<div class="field"><label>Proveedor Emisor (FK -> suppliers)</label><select id="inv-entry-supplier-id">' + supOpts + '</select></div>' +
      '<div class="field"><label>Bodega Destino (FK -> warehouses)</label><select id="inv-entry-warehouse-id">' + whSelectForm + '</select></div>' +
      '<div class="field"><label>Factura Compra / Acta v2 Nº</label><input type="text" id="inv-entry-invoice-ref" placeholder="Ej: FC-PROV-8841 / ACTA-2026" value="ACTA-REC-' + String(Date.now()).slice(-4) + '" /></div>' +
      '<div class="field"><label>Código SKU (Si es nuevo)</label><input type="text" id="inv-entry-sku" placeholder="Ej: REP-9920" /></div>' +
      '<div class="field"><label>Nombre Producto (Si es nuevo)</label><input type="text" id="inv-entry-name" placeholder="Ej: Amortiguador Trasero Gas / Insumo" /></div>' +
      '<div class="field"><label>Cantidad Recibida (+ Stock)</label><input type="number" id="inv-entry-qty" value="10" min="1" /></div>' +
      '<div class="field"><label>Costo Unitario Compra (COP)</label><input type="number" id="inv-entry-cost" value="35000" /></div>' +
      '<div class="field"><label>Precio Venta Público (COP)</label><input type="number" id="inv-entry-sale" value="58000" /></div>' +
      '<div class="field"><label>Lote / Vencimiento / Temp. Acta v2</label><input type="text" id="inv-entry-lot" placeholder="Ej: LOTE-2026B · Vence 2028 · 22°C Conforme" value="LOTE-2026B · Conforme" /></div>' +
      '</div><div style="margin-top:10px;display:flex;justify-content:flex-end">' +
      '<button type="button" class="btn btn-emerald" id="btn-inv-register-purchase">📥 Procesar Entrada de Almacén, Sumar Stock y Asentar Kardex</button></div></div></div>' +

      '<div class="card"><div class="card-head"><div>' +
      '<div class="card-title">📦 2. Catálogo Maestro Valorizado con Enlaces a Bodegas y Proveedores</div>' +
      '<div class="card-sub">Ajusta existencias en tiempo real (-1 / +1) o filtra por bodega y referencia</div></div>' +
      '<div class="row-actions">' +
      '<select id="inv-filter-warehouse" style="padding:6px 10px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px">' + whOpts + '</select>' +
      '<input type="text" id="inv-search-input" value="' + pkEsc(STATE.invSearchText || '') + '" placeholder="🔎 Buscar SKU, nombre o categoría..." style="padding:6px 10px;border-radius:8px;border:1px solid var(--pk-border);font-size:12px;min-width:210px" />' +
      '</div></div>' +
      '<div class="card-body"><div class="table-wrap"><table><thead><tr>' +
      '<th>SKU / Lote</th><th>Producto y Proveedor (FK)</th><th>Bodega (FK)</th><th>Costo</th><th>Precio Venta</th><th>Utilidad / Margen</th><th>Existencias (Kardex)</th>' +
      '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div></div>';
  }
`;
}
