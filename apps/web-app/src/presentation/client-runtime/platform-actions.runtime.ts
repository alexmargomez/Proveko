/**
 * Runtime de Cliente — Acciones Interactivas de los 6 Centros Operativos (SOLID SRP).
 */
export function renderPlatformActionsRuntimeJs(): string {
  return `
    window.provekoUpdatePosHeader = function(field, val) { STATE.posDraft[field] = val; };

    window.provekoAddPosLine = function() {
      STATE.posDraft.lines.push({ description: 'Nuevo Producto / Servicio Comercial', qty: 1, unitPrice: 45000, discountPct: 0, taxRate: 19 });
      renderInvoicingPosCenter();
    };

    window.provekoUpdatePosLine = function(idx, field, val) {
      if (!STATE.posDraft.lines[idx]) return;
      STATE.posDraft.lines[idx][field] = val;
      renderInvoicingPosCenter();
    };

    window.provekoRemovePosLine = function(idx) {
      if (STATE.posDraft.lines.length <= 1) return;
      STATE.posDraft.lines.splice(idx, 1);
      renderInvoicingPosCenter();
    };

    window.provekoEmitInvoice = function(mode) {
      let subtotal = 0, discount = 0, tax = 0;
      STATE.posDraft.lines.forEach((l) => {
        const g = l.qty * l.unitPrice;
        const d = hasComponent('comp:line-discounts') ? g * (l.discountPct / 100) : 0;
        const b = g - d;
        subtotal += b; discount += d; tax += b * (l.taxRate / 100);
      });
      const tip = hasComponent('comp:tip-service') ? subtotal * ((STATE.posDraft.tipPct || 0) / 100) : 0;
      const grandTotal = subtotal + tax + tip;
      const prefix = mode === 'COTIZACION' ? 'COT-' : (STATE.posDraft.docType.includes('DIAN') ? 'FAC-' : 'POS-');
      STATE.db.invoices.unshift({
        id: prefix + Math.floor(1000 + Math.random() * 8999),
        type: mode === 'COTIZACION' ? 'Cotización Comercial' : STATE.posDraft.docType,
        customerName: STATE.posDraft.customerName,
        customerNit: '901.445.889-1',
        cashierName: STATE.posDraft.cashierName,
        paymentMethod: STATE.posDraft.paymentMethod,
        subtotal: Math.round(subtotal), discount: Math.round(discount), tax: Math.round(tax), tip: Math.round(tip),
        grandTotal: Math.round(grandTotal), issuedAt: 'Ahora mismo', itemsCount: STATE.posDraft.lines.length, cufe: 'SHA384-VERIFIED',
      });
      renderInvoicingPosCenter();
    };

    window.provekoCreateProduct = function() {
      STATE.db.products.unshift({
        id: 'prd-' + Date.now(),
        sku: document.getElementById('prd-sku').value || 'SKU-NEW',
        barcode: '770' + Math.floor(100000000 + Math.random() * 899999999),
        name: document.getElementById('prd-name').value || 'Producto Nuevo',
        category: document.getElementById('prd-cat').value, unit: 'UND',
        warehouse: document.getElementById('prd-wh').value || 'Bodega Central',
        stock: Number(document.getElementById('prd-stock').value) || 0, minStock: 10,
        unitCost: Number(document.getElementById('prd-cost').value) || 0,
        salePrice: Number(document.getElementById('prd-price').value) || 0, taxRate: 19,
        lotCode: document.getElementById('prd-lot') ? document.getElementById('prd-lot').value : 'LOTE-GEN',
        expiration: '2027-06-30',
      });
      renderInventoryAndRecipesCenter();
    };

    window.provekoAddRecipeIngredient = function() {
      STATE.recipeDraft.ingredients.push({ name: 'Nuevo Insumo de Receta', qty: 0.25, unit: 'KG', unitCost: 22000, wastePct: 3 });
      renderInventoryAndRecipesCenter();
    };

    window.provekoUpdateRecipeIng = function(idx, field, val) {
      if (!STATE.recipeDraft.ingredients[idx]) return;
      STATE.recipeDraft.ingredients[idx][field] = val;
      renderInventoryAndRecipesCenter();
    };

    window.provekoRemoveRecipeIng = function(idx) {
      if (STATE.recipeDraft.ingredients.length <= 1) return;
      STATE.recipeDraft.ingredients.splice(idx, 1);
      renderInventoryAndRecipesCenter();
    };

    window.provekoSaveVisualRecipe = function() {
      const totalCost = STATE.recipeDraft.ingredients.reduce((a, i) => a + (i.qty * i.unitCost * (1 + i.wastePct / 100)), 0);
      STATE.db.recipes.unshift({
        id: 'rec-' + Date.now(), code: STATE.recipeDraft.code, productName: STATE.recipeDraft.productName,
        portions: 1, salePrice: STATE.recipeDraft.salePrice, totalCost: Math.round(totalCost),
        ingredients: [...STATE.recipeDraft.ingredients],
      });
      renderInventoryAndRecipesCenter();
    };

    window.provekoCreateTableOrder = function() {
      STATE.db.tablesAndOrders.unshift({
        id: 'MESA-' + Math.floor(10 + Math.random() * 89),
        name: document.getElementById('tbl-name').value || 'Mesa Nueva',
        diners: Number(document.getElementById('tbl-diners').value) || 2,
        waiter: document.getElementById('tbl-waiter').value || 'Mesero Turno',
        status: 'EN_COCINA', currentOrder: [document.getElementById('tbl-order').value || 'Pedido en preparación'], total: 128000,
      });
      renderGastroAndReservationsCenter();
    };

    window.provekoAdvanceTableStatus = function(idx) {
      const t = STATE.db.tablesAndOrders[idx];
      if (!t) return;
      t.status = t.status === 'EN_COCINA' ? 'LISTO_PARA_SERVIR' : (t.status === 'LISTO_PARA_SERVIR' ? 'CUENTA_ABIERTA' : 'DISPONIBLE');
      if (t.status === 'DISPONIBLE') { t.currentOrder = []; t.total = 0; t.diners = 0; }
      renderGastroAndReservationsCenter();
    };

    window.provekoCreateReservationOrTicket = function() {
      STATE.db.reservationsAndTickets.unshift({
        id: 'RES-' + Date.now(), kind: document.getElementById('res-kind').value,
        holderName: document.getElementById('res-holder').value || 'Cliente Reserva',
        documentId: document.getElementById('res-doc').value || '900.000.000',
        resourceName: document.getElementById('res-resource').value || 'Cupo Reservado',
        dateSlot: document.getElementById('res-date').value || 'Hoy', spots: 4,
        ticketCode: 'TCK-' + Math.floor(1000 + Math.random() * 8999) + '-OK',
        amount: Number(document.getElementById('res-amount').value) || 150000, status: 'CONFIRMADA',
      });
      renderGastroAndReservationsCenter();
    };

    window.provekoRecalcNetWeight = function() {
      const g = Number(document.getElementById('trk-gross').value) || 0;
      const t = Number(document.getElementById('trk-tare').value) || 0;
      const nEl = document.getElementById('trk-net');
      if (nEl) nEl.value = String(Math.max(0, g - t));
    };

    window.provekoRegisterTruckInYard = function() {
      const gross = document.getElementById('trk-gross') ? Number(document.getElementById('trk-gross').value) : 48000;
      const tare = document.getElementById('trk-tare') ? Number(document.getElementById('trk-tare').value) : 16500;
      STATE.db.trucksInYard.unshift({
        id: 'TRK-' + Date.now(),
        tractorPlate: (document.getElementById('trk-plate').value || 'AAA-000').toUpperCase(),
        trailerPlate: (document.getElementById('trk-trailer').value || 'R-00000').toUpperCase(),
        vehicleType: document.getElementById('trk-type').value,
        driverName: document.getElementById('trk-driver').value || 'Conductor Asignado', driverId: 'CC Verificada',
        carrier: document.getElementById('trk-carrier').value || 'Transportadora',
        cargoProduct: document.getElementById('trk-cargo').value || 'Carga General',
        dock: document.getElementById('trk-dock') ? document.getElementById('trk-dock').value : 'Muelle #1',
        grossWeightKg: gross, tareWeightKg: tare, netWeightKg: Math.max(0, gross - tare),
        sealCode: document.getElementById('trk-seal') ? document.getElementById('trk-seal').value : 'PREC-OK',
        yardStatus: 'EN_BASCULA_PESAJE', entryTime: 'Ahora',
      });
      renderLogisticsAndFleetCenter();
    };

    window.provekoAdvanceTruckStatus = function(idx) {
      const trk = STATE.db.trucksInYard[idx];
      if (!trk) return;
      const flow = ['EN_BASCULA_PESAJE', 'CARGANDO_EN_MUELLE', 'DESTARE_SALIDA', 'DESPACHADO_CON_GUIA'];
      trk.yardStatus = flow[(flow.indexOf(trk.yardStatus) + 1) % flow.length];
      renderLogisticsAndFleetCenter();
    };

    window.provekoCreateThirdParty = function() {
      STATE.db.thirdParties.unshift({
        id: 'ter-' + Date.now(), taxId: document.getElementById('tp-nit').value || '900.000.000-1',
        legalName: document.getElementById('tp-name').value || 'Nuevo Tercero',
        thirdPartyType: document.getElementById('tp-type').value,
        phone: document.getElementById('tp-phone').value || '+57 300 000 0000', email: 'contacto@tercero.co',
        city: document.getElementById('tp-city').value || 'Bogotá',
        creditLimit: document.getElementById('tp-limit') ? Number(document.getElementById('tp-limit').value) : 10000000,
        balanceDue: 0, paymentTermsDays: 30,
      });
      renderCrmAndFinanceCenter();
    };

    window.provekoApplyQuickPayment = function(idx) {
      const tp = STATE.db.thirdParties[idx];
      if (!tp) return;
      tp.balanceDue = Math.max(0, tp.balanceDue - 1500000);
      renderCrmAndFinanceCenter();
    };

    window.provekoCreateTenantUser = function() {
      const tenant = getActiveTenant();
      STATE.db.users.push({
        id: 'usr-' + Date.now(), tenantId: tenant.tenantId,
        fullName: document.getElementById('usr-name').value || 'Nuevo Empleado',
        username: document.getElementById('usr-email').value || 'usuario@empresa.co',
        password: document.getElementById('usr-pass').value || 'Clave2026!',
        roleKey: document.getElementById('usr-role').value, branch: tenant.activeBranch, active: true,
      });
      renderUsersAndRbacCenter();
    };
  `;
}
