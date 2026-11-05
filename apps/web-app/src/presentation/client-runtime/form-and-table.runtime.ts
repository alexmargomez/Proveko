/**
 * Runtime de Cliente — Centro 1 (Facturación, POS y Caja con Componentes Conmutables)
 * y Centro 2 (Inventario, Kardex y Constructor Visual de Recetas sin JSON) (SOLID SRP).
 */
export function renderGuidedFormAndTableRuntimeJs(): string {
  return `
    function renderInvoicingPosCenter() {
      const tenant = getActiveTenant();
      const showCashier = hasComponent('comp:cashier-shift');
      const showDian = hasComponent('comp:dian-electronic');
      const showDiscounts = hasComponent('comp:line-discounts');
      const showTip = hasComponent('comp:tip-service');
      const showSeller = hasComponent('comp:seller-commission');
      const showQuotes = hasComponent('comp:quotes-converter');

      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      STATE.posDraft.lines.forEach((line) => {
        const gross = line.qty * line.unitPrice;
        const disc = showDiscounts ? gross * (line.discountPct / 100) : 0;
        const base = gross - disc;
        const tax = base * (line.taxRate / 100);
        subtotal += base;
        discountTotal += disc;
        taxTotal += tax;
      });
      const tipAmount = showTip ? subtotal * ((STATE.posDraft.tipPct || 0) / 100) : 0;
      const grandTotal = subtotal + taxTotal + tipAmount;

      const kpiStrip = document.getElementById('center-kpi-strip');
      kpiStrip.innerHTML =
        '<div class="kpi-card"><span class="kpi-label">Ventas Emitidas Hoy</span><div class="kpi-value tabular-nums">' + formatCop(STATE.db.invoices.reduce((a, b) => a + b.grandTotal, 0)) + '</div><span class="kpi-sub">' + STATE.db.invoices.length + ' documentos procesados</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Total Carrito Actual</span><div class="kpi-value tabular-nums" style="color:var(--brand-primary);">' + formatCop(grandTotal) + '</div><span class="kpi-sub">' + STATE.posDraft.lines.length + ' líneas activas</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Modo de Emisión</span><div class="kpi-value">' + (showDian ? 'DIAN + Tirilla POS' : 'Recibo Estándar') + '</div><span class="kpi-sub">Consecutivo automático</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Cajero / Turno</span><div class="kpi-value">' + (showCashier ? escapeHtml(STATE.posDraft.cashierName) : 'Automático') + '</div><span class="kpi-sub">' + escapeHtml(tenant.activeBranch) + '</span></div>';

      const canvas = document.getElementById('center-workspace-canvas');
      canvas.innerHTML =
        '<div class="card" style="margin-bottom:16px;">' +
          '<div class="card-header">' +
            '<span class="card-title">🧾 Estación de Facturación y Punto de Venta (Multicelda Interactiva)</span>' +
            '<div style="display:flex; gap:8px;">' +
              '<button type="button" class="btn btn-outline" onclick="window.provekoAddPosLine()">+ Agregar Producto / Servicio</button>' +
              (showQuotes ? '<button type="button" class="btn btn-outline" onclick="window.provekoEmitInvoice(\\'COTIZACION\\')">📄 Guardar como Cotización</button>' : '') +
              '<button type="button" class="btn btn-primary" onclick="window.provekoEmitInvoice(\\'FACTURA\\')">✓ Emitir y Cobrar (' + formatCop(grandTotal) + ')</button>' +
            '</div>' +
          '</div>' +
          '<div class="card-body">' +
            '<div class="form-grid-4" style="margin-bottom:14px;">' +
              '<div class="form-group"><label class="form-label">Cliente / Adquiriente</label>' +
                '<select class="form-control" onchange="window.provekoUpdatePosHeader(\\'customerName\\', this.value)">' +
                  '<option value="Comercializadora Andina S.A.S.">Comercializadora Andina S.A.S. (901.445.889-1)</option>' +
                  '<option value="Consumidor Final Mostrador">Consumidor Final Mostrador (222222222222)</option>' +
                  STATE.db.thirdParties.map((tp) => '<option value="' + escapeHtml(tp.legalName) + '">' + escapeHtml(tp.legalName) + ' (' + escapeHtml(tp.taxId) + ')</option>').join('') +
                '</select></div>' +
              (showDian ? '<div class="form-group"><label class="form-label">Tipo de Comprobante</label><select class="form-control" onchange="window.provekoUpdatePosHeader(\\'docType\\', this.value)"><option value="Factura Electrónica DIAN">Factura Electrónica DIAN (CUFE)</option><option value="Tirilla POS Mostrador">Tirilla POS Mostrador</option></select></div>' : '') +
              '<div class="form-group"><label class="form-label">Medio de Pago</label><select class="form-control" onchange="window.provekoUpdatePosHeader(\\'paymentMethod\\', this.value)"><option>Efectivo en Caja</option><option>Transferencia / QR Bancario</option><option>Tarjeta Débito / Crédito</option><option>Crédito a Cartera (30 días)</option></select></div>' +
              (showCashier ? '<div class="form-group"><label class="form-label">Nombre de Cajero en Turno (Componente)</label><input class="form-control" value="' + escapeHtml(STATE.posDraft.cashierName) + '" oninput="window.provekoUpdatePosHeader(\\'cashierName\\', this.value)" /></div>' : '') +
              (showSeller ? '<div class="form-group"><label class="form-label">Vendedor Asignado (Componente)</label><input class="form-control" value="' + escapeHtml(STATE.posDraft.sellerName) + '" placeholder="Nombre del asesor" oninput="window.provekoUpdatePosHeader(\\'sellerName\\', this.value)" /></div>' : '') +
              (showTip ? '<div class="form-group"><label class="form-label">% Propina / Servicio (Componente)</label><input type="number" class="form-control tabular-nums" value="' + STATE.posDraft.tipPct + '" oninput="window.provekoUpdatePosHeader(\\'tipPct\\', Number(this.value)); renderInvoicingPosCenter();" /></div>' : '') +
            '</div>' +
            '<table class="data-table" style="margin-bottom:14px;">' +
              '<thead><tr><th>Producto o Servicio</th><th style="width:95px;">Cantidad</th><th style="width:140px;">Precio Unitario ($)</th>' +
              (showDiscounts ? '<th style="width:105px;">% Desc.</th>' : '') +
              '<th style="width:95px;">% IVA</th><th style="width:140px;">Subtotal Línea</th><th style="width:60px;"></th></tr></thead>' +
              '<tbody>' +
                STATE.posDraft.lines.map((line, idx) => {
                  const gross = line.qty * line.unitPrice;
                  const disc = showDiscounts ? gross * (line.discountPct / 100) : 0;
                  const lineTotal = (gross - disc) * (1 + line.taxRate / 100);
                  return '<tr>' +
                    '<td><input class="form-control" value="' + escapeHtml(line.description) + '" oninput="window.provekoUpdatePosLine(' + idx + ', \\'description\\', this.value)" /></td>' +
                    '<td><input type="number" class="form-control tabular-nums" value="' + line.qty + '" onchange="window.provekoUpdatePosLine(' + idx + ', \\'qty\\', Number(this.value))" /></td>' +
                    '<td><input type="number" class="form-control tabular-nums" value="' + line.unitPrice + '" onchange="window.provekoUpdatePosLine(' + idx + ', \\'unitPrice\\', Number(this.value))" /></td>' +
                    (showDiscounts ? '<td><input type="number" class="form-control tabular-nums" value="' + line.discountPct + '" onchange="window.provekoUpdatePosLine(' + idx + ', \\'discountPct\\', Number(this.value))" /></td>' : '') +
                    '<td><input type="number" class="form-control tabular-nums" value="' + line.taxRate + '" onchange="window.provekoUpdatePosLine(' + idx + ', \\'taxRate\\', Number(this.value))" /></td>' +
                    '<td class="tabular-nums mono" style="font-weight:800;">' + formatCop(lineTotal) + '</td>' +
                    '<td><button type="button" class="btn btn-outline" style="padding:4px 8px;" onclick="window.provekoRemovePosLine(' + idx + ')">✕</button></td>' +
                  '</tr>';
                }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>' +
        '</div>' +
        '<div class="card"><div class="card-header"><span class="card-title">Historial de Facturas, Tirillas POS y Cotizaciones Emitidas</span></div>' +
          '<table class="data-table"><thead><tr><th>No. Doc</th><th>Tipo</th><th>Cliente</th>' + (showCashier ? '<th>Cajero</th>' : '') + '<th>Medio Pago</th><th>Subtotal</th><th>Impuestos</th><th>Total Pagado</th></tr></thead><tbody>' +
            STATE.db.invoices.map((inv) => '<tr><td class="mono" style="font-weight:700;">' + escapeHtml(inv.id) + '</td><td><span class="badge badge-blue">' + escapeHtml(inv.type) + '</span></td><td>' + escapeHtml(inv.customerName) + '</td>' + (showCashier ? '<td>' + escapeHtml(inv.cashierName) + '</td>' : '') + '<td>' + escapeHtml(inv.paymentMethod) + '</td><td class="tabular-nums">' + formatCop(inv.subtotal) + '</td><td class="tabular-nums">' + formatCop(inv.tax) + '</td><td class="tabular-nums" style="font-weight:800; color:#15803D;">' + formatCop(inv.grandTotal) + '</td></tr>').join('') +
          '</tbody></table></div>';
    }

    function renderInventoryAndRecipesCenter() {
      const showRecipes = hasComponent('comp:recipes-bom');
      const showLots = hasComponent('comp:lots-fefo');
      const totalVal = STATE.db.products.reduce((acc, p) => acc + (p.stock * p.unitCost), 0);
      document.getElementById('center-kpi-strip').innerHTML =
        '<div class="kpi-card"><span class="kpi-label">Referencias en Catálogo</span><div class="kpi-value tabular-nums">' + STATE.db.products.length + ' SKUs</div><span class="kpi-sub">Control de márgenes y stock mínimo</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Valorización en Bodega</span><div class="kpi-value tabular-nums">' + formatCop(totalVal) + '</div><span class="kpi-sub">Costo promedio ponderado</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Recetas / Escandallos</span><div class="kpi-value tabular-nums">' + STATE.db.recipes.length + ' Fichas</div><span class="kpi-sub">Cálculo visual sin JSON</span></div>' +
        '<div class="kpi-card"><span class="kpi-label">Control de Lotes FEFO</span><div class="kpi-value">' + (showLots ? 'Activo' : 'Opcional') + '</div><span class="kpi-sub">Trazabilidad de vencimientos</span></div>';

      const recTotalCost = STATE.recipeDraft.ingredients.reduce((acc, ing) => acc + (ing.qty * ing.unitCost * (1 + ing.wastePct / 100)), 0);
      const canvas = document.getElementById('center-workspace-canvas');
      canvas.innerHTML =
        '<div class="card" style="margin-bottom:16px;">' +
          '<div class="card-header"><span class="card-title">📦 Registro Maestro de Productos, Precios y Existencias de Bodega</span><button type="button" class="btn btn-primary" onclick="window.provekoCreateProduct()">+ Guardar Producto en Catálogo</button></div>' +
          '<div class="card-body"><div class="form-grid-4">' +
            '<div class="form-group"><label class="form-label">Código SKU</label><input id="prd-sku" class="form-control mono" value="INS-HARINA-25K" /></div>' +
            '<div class="form-group"><label class="form-label">Nombre del Producto / Insumo</label><input id="prd-name" class="form-control" value="Harina de Trigo Fortificada Bulto 25kg" /></div>' +
            '<div class="form-group"><label class="form-label">Categoría</label><select id="prd-cat" class="form-control"><option>Alimentos y Bebidas</option><option>Agroindustrial / Granel</option><option>Mercancía General</option><option>Insumo de Producción</option></select></div>' +
            '<div class="form-group"><label class="form-label">Bodega / Silo</label><input id="prd-wh" class="form-control" value="Bodega Principal #1" /></div>' +
            '<div class="form-group"><label class="form-label">Existencia Inicial</label><input id="prd-stock" type="number" class="form-control tabular-nums" value="80" /></div>' +
            '<div class="form-group"><label class="form-label">Costo Unitario ($)</label><input id="prd-cost" type="number" class="form-control tabular-nums" value="64000" /></div>' +
            '<div class="form-group"><label class="form-label">Precio de Venta ($)</label><input id="prd-price" type="number" class="form-control tabular-nums" value="92000" /></div>' +
            (showLots ? '<div class="form-group"><label class="form-label">Lote y Vencimiento (Componente FEFO)</label><input id="prd-lot" class="form-control mono" value="LOTE-2026-H8 · 2027-06-30" /></div>' : '') +
          '</div>' +
          '<table class="data-table" style="margin-top:10px;"><thead><tr><th>SKU</th><th>Producto</th><th>Bodega</th><th>Existencia</th><th>Costo Unit.</th><th>Precio Venta</th><th>Margen</th>' + (showLots ? '<th>Lote / Vence</th>' : '') + '</tr></thead><tbody>' +
            STATE.db.products.map((p) => {
              const margin = p.salePrice > 0 ? Math.round(((p.salePrice - p.unitCost) / p.salePrice) * 100) : 0;
              return '<tr><td class="mono" style="font-weight:700;">' + escapeHtml(p.sku) + '</td><td style="font-weight:700;">' + escapeHtml(p.name) + '</td><td>' + escapeHtml(p.warehouse) + '</td><td class="tabular-nums"><span class="badge ' + (p.stock <= p.minStock ? 'badge-crimson' : 'badge-emerald') + '">' + p.stock + ' ' + escapeHtml(p.unit) + '</span></td><td class="tabular-nums">' + formatCop(p.unitCost) + '</td><td class="tabular-nums" style="font-weight:700;">' + formatCop(p.salePrice) + '</td><td><span class="badge badge-blue">' + margin + '%</span></td>' + (showLots ? '<td class="mono">' + escapeHtml(p.lotCode) + ' (' + escapeHtml(p.expiration) + ')</td>' : '') + '</tr>';
            }).join('') +
          '</tbody></table></div></div>' +
        (showRecipes ?
          '<div class="card"><div class="card-header"><span class="card-title">👨‍🍳 Constructor Visual de Recetas, Escandallos y Costeo por Porción (Cero JSON)</span><div style="display:flex; gap:8px;"><button type="button" class="btn btn-outline" onclick="window.provekoAddRecipeIngredient()">+ Agregar Ingrediente</button><button type="button" class="btn btn-emerald" onclick="window.provekoSaveVisualRecipe()">✓ Guardar Ficha Técnica (' + formatCop(recTotalCost) + ')</button></div></div>' +
          '<div class="card-body"><div class="form-grid-3" style="margin-bottom:12px;">' +
            '<div class="form-group"><label class="form-label">Código de Ficha / Plato</label><input id="rec-code" class="form-control mono" value="' + escapeHtml(STATE.recipeDraft.code) + '" oninput="STATE.recipeDraft.code=this.value" /></div>' +
            '<div class="form-group"><label class="form-label">Nombre del Plato o Producto Terminado</label><input id="rec-name" class="form-control" value="' + escapeHtml(STATE.recipeDraft.productName) + '" oninput="STATE.recipeDraft.productName=this.value" /></div>' +
            '<div class="form-group"><label class="form-label">Precio de Venta Sugerido ($)</label><input id="rec-price" type="number" class="form-control tabular-nums" value="' + STATE.recipeDraft.salePrice + '" oninput="STATE.recipeDraft.salePrice=Number(this.value)" /></div>' +
          '</div>' +
          '<table class="data-table"><thead><tr><th>Insumo / Ingrediente de la Receta</th><th style="width:110px;">Cantidad</th><th style="width:110px;">Unidad</th><th style="width:140px;">Costo por Unidad ($)</th><th style="width:110px;">% Merma</th><th style="width:140px;">Costo Neto Línea</th><th style="width:55px;"></th></tr></thead><tbody>' +
            STATE.recipeDraft.ingredients.map((ing, idx) => {
              const lineCost = ing.qty * ing.unitCost * (1 + ing.wastePct / 100);
              return '<tr>' +
                '<td><input class="form-control" value="' + escapeHtml(ing.name) + '" oninput="window.provekoUpdateRecipeIng(' + idx + ', \\'name\\', this.value)" /></td>' +
                '<td><input type="number" step="0.01" class="form-control tabular-nums" value="' + ing.qty + '" onchange="window.provekoUpdateRecipeIng(' + idx + ', \\'qty\\', Number(this.value))" /></td>' +
                '<td><select class="form-control" onchange="window.provekoUpdateRecipeIng(' + idx + ', \\'unit\\', this.value)"><option ' + (ing.unit === 'KG' ? 'selected' : '') + '>KG</option><option ' + (ing.unit === 'GR' ? 'selected' : '') + '>GR</option><option ' + (ing.unit === 'LT' ? 'selected' : '') + '>LT</option><option ' + (ing.unit === 'UND' ? 'selected' : '') + '>UND</option></select></td>' +
                '<td><input type="number" class="form-control tabular-nums" value="' + ing.unitCost + '" onchange="window.provekoUpdateRecipeIng(' + idx + ', \\'unitCost\\', Number(this.value))" /></td>' +
                '<td><input type="number" class="form-control tabular-nums" value="' + ing.wastePct + '" onchange="window.provekoUpdateRecipeIng(' + idx + ', \\'wastePct\\', Number(this.value))" /></td>' +
                '<td class="tabular-nums mono" style="font-weight:800;">' + formatCop(lineCost) + '</td>' +
                '<td><button type="button" class="btn btn-outline" style="padding:4px 8px;" onclick="window.provekoRemoveRecipeIng(' + idx + ')">✕</button></td>' +
              '</tr>';
            }).join('') +
          '</tbody></table></div></div>' : '');
    }
  `;
}
