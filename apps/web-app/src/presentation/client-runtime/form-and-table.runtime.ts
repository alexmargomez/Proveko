/**
 * Runtime Cliente (Parte 2): Renderizador del Asistente "Registra tu Negocio"
 * y Renderizador de la Plataforma Operativa con Interpestañas de Submódulos (Cero switches en pantalla).
 */
export function renderFormAndTableRuntimeJs(): string {
  return `
  function pkRenderRegistrationWizard() {
    var plan = pkComputeRegistrationPlan();
    var rowEl = document.getElementById('reg-business-types-row');
    if (rowEl) {
      var bHtml = '';
      var presets = BOOT.businessTypes || [];
      for (var i = 0; i < presets.length; i++) {
        var p = presets[i];
        var isSel = p.id === STATE.selectedBusinessTypeId;
        bHtml += '<button type="button" class="preset-chip ' + (isSel ? 'active' : '') + '" data-select-btype="' + pkEsc(p.id) + '">' +
          pkEsc(p.name) + ' ($' + p.baseMonthlyUsd + '/mes)</button>';
      }
      rowEl.innerHTML = bHtml;
    }

    var incBox = document.getElementById('reg-included-summary');
    if (incBox && plan.preset) {
      incBox.innerHTML = '<strong>✅ Incluido en tu Plan Base (' + pkEsc(plan.preset.name) + ' — $' + plan.baseUsd + ' USD/mes):</strong> ' +
        pkEsc(plan.preset.description);
    }

    var addonsGrid = document.getElementById('reg-addons-grid');
    if (addonsGrid && plan.preset) {
      var aHtml = '';
      var svcs = BOOT.services || [];
      for (var sIdx = 0; sIdx < svcs.length; sIdx++) {
        var svc = svcs[sIdx];
        var svcIncluded = plan.preset.includedPrincipalServices.indexOf(svc.serviceKey) !== -1;
        var svcExtraChecked = !!STATE.extraServiceKeys[svc.serviceKey];
        var subItems = '';
        for (var mIdx = 0; mIdx < svc.submodules.length; mIdx++) {
          var sub = svc.submodules[mIdx];
          var subIncluded = plan.preset.includedSubmodules.indexOf(sub.moduleKey) !== -1;
          var subChecked = subIncluded || svcExtraChecked || !!STATE.extraSubmoduleKeys[sub.moduleKey];
          subItems += '<label class="comp-toggle-pill" style="' + (subIncluded ? 'background:#ecfdf5;border-color:#6ee7b7' : '') + '">' +
            '<input type="checkbox" data-extra-submodule="' + pkEsc(sub.moduleKey) + '" ' +
            (subChecked ? 'checked ' : '') + (subIncluded ? 'disabled ' : '') + '/>' +
            '<span>' + pkEsc(sub.tabIcon + ' ' + sub.externalSubmoduleName) + '</span>' +
            '<strong style="color:var(--pk-primary)">' + (subIncluded ? 'Básico Incluido' : '+$' + sub.monthlyAddonUsd) + '</strong></label>';
        }
        aHtml += '<div class="center-pick-card ' + ((svcIncluded || svcExtraChecked) ? 'selected' : '') + '">' +
          '<div class="center-pick-head">' +
          '<div class="center-pick-title">' + pkEsc(svc.icon + ' ' + svc.externalPrincipalModuleName) + '</div>' +
          (svcIncluded
            ? '<span class="badge badge-emerald">Módulo Base Incluido</span>'
            : '<label style="font-size:12px;font-weight:700;cursor:pointer"><input type="checkbox" data-extra-service="' + pkEsc(svc.serviceKey) + '" ' + (svcExtraChecked ? 'checked' : '') + '/> Agregar Módulo (+$' + svc.standaloneMonthlyUsd + ')</label>') +
          '</div><div class="center-pick-desc">' + pkEsc(svc.subtitle) + '</div>' +
          '<div class="comp-toggle-list">' + subItems + '</div></div>';
      }
      addonsGrid.innerHTML = aHtml;
    }

    var totalEl = document.getElementById('reg-quote-total');
    if (totalEl) totalEl.textContent = '$' + plan.totalUsd + ' USD/mes';
    var breakEl = document.getElementById('reg-quote-breakdown');
    if (breakEl) {
      breakEl.textContent = 'Plan Base: $' + plan.baseUsd + ' USD + Adicionales seleccionados: $' + plan.extraUsd + ' USD';
    }
  }

  function pkRenderSpecializedWidget(submodule, client) {
    var slot = document.getElementById('ws-specialized-widget-slot');
    if (!slot) return;
    if (submodule.hasInteractivePosCart) {
      var hasDisc = client.activeFeatures.indexOf('comp-line-discount') !== -1;
      var rows = '';
      var subtotal = 0;
      for (var i = 0; i < STATE.posCart.length; i++) {
        var it = STATE.posCart[i];
        var net = Math.round(it.qty * it.price * (1 - (hasDisc ? (it.discountPct || 0) : 0) / 100));
        subtotal += net;
        rows += '<tr><td>' + pkEsc(it.name) + '</td><td>' + it.qty + '</td><td>$ ' + it.price.toLocaleString('es-CO') + '</td>' +
          (hasDisc ? '<td>' + (it.discountPct || 0) + '%</td>' : '') + '<td><strong>$ ' + net.toLocaleString('es-CO') + '</strong></td></tr>';
      }
      slot.innerHTML = '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<strong>🛒 Carrito Activo en Caja POS</strong><span class="badge badge-blue">Subtotal: $ ' + subtotal.toLocaleString('es-CO') + '</span></div>' +
        '<table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th>' + (hasDisc ? '<th>Desc.</th>' : '') + '<th>Total Línea</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      return;
    }
    if (submodule.hasVisualRecipeBuilder) {
      var bRows = '';
      for (var j = 0; j < STATE.bomLines.length; j++) {
        var b = STATE.bomLines[j];
        bRows += '<tr><td>' + pkEsc(b.ingredient) + '</td><td>' + pkEsc(b.qty + ' ' + b.unit) + '</td><td>$ ' + Number(b.cost).toLocaleString('es-CO') + '</td></tr>';
      }
      slot.innerHTML = '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:12px">' +
        '<div style="font-weight:800;margin-bottom:8px">🧪 Insumos de la Receta / Fórmula (Explosión de Materiales)</div>' +
        '<table><thead><tr><th>Insumo</th><th>Cantidad</th><th>Costo</th></tr></thead><tbody>' + bRows + '</tbody></table></div>';
      return;
    }
    if (submodule.hasTruckScaleWeighbridge) {
      slot.innerHTML = '<div style="background:#f8fafc;border:1px solid var(--pk-border);border-radius:12px;padding:12px">' +
        '<div style="font-weight:800;margin-bottom:8px">⚖️ Lectura Digital de Báscula Camionera (Destare Automático)</div>' +
        '<div class="grid-3">' +
        '<div class="field"><label>Peso Bruto (Kg)</label><input type="number" id="scale-gross-kg" value="52400" /></div>' +
        '<div class="field"><label>Peso Tara Vacío (Kg)</label><input type="number" id="scale-tare-kg" value="16800" /></div>' +
        '<div class="field"><label>Peso Neto Destarado</label><input type="text" id="scale-net-display" value="35.600 Kg (35.60 Ton)" readonly style="font-weight:800;color:var(--pk-emerald)" /></div>' +
        '</div></div>';
      return;
    }
    slot.innerHTML = '';
  }
`;
}
