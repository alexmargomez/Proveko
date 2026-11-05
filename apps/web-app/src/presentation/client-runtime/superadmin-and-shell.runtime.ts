/**
 * Runtime de Cliente — Estado Global, Login por Rol y Orquestación del Shell de la Plataforma (`/app`) (SOLID SRP).
 */
export function renderSuperAdminAndShellRuntimeJs(initialSurface: 'landing' | 'workstation'): string {
  return `
    const STATE = {
      surface: '${initialSurface}',
      isSuperAdminSession: false,
      activeTenantId: 'emp-agroindustrial-del-valle',
      activeRoleKey: 'ADMIN_CLIENTE',
      selectedCenterKey: 'center:invoicing-pos',
      builderCenters: ['center:invoicing-pos', 'center:inventory-recipes', 'center:gastro-reservations', 'center:logistics-fleet', 'center:crm-finance'],
      builderComponents: ['comp:cashier-shift', 'comp:dian-electronic', 'comp:line-discounts', 'comp:tip-service', 'comp:quotes-converter', 'comp:recipes-bom', 'comp:lots-fefo', 'comp:warehouse-transfers', 'comp:gastro-tables-kds', 'comp:split-check-seats', 'comp:slot-reservations', 'comp:ticket-issuance', 'comp:weighbridge-scale', 'comp:dock-turn-queue', 'comp:seal-manifest', 'comp:credit-portfolio', 'comp:double-entry-puc'],
      posDraft: {
        customerName: 'Comercializadora Andina S.A.S.',
        docType: 'Factura Electrónica DIAN',
        paymentMethod: 'Efectivo en Caja',
        cashierName: 'Laura Valentina Ríos (Turno Mañana)',
        sellerName: 'Carlos Eduardo Mendoza',
        tipPct: 10,
        lines: [
          { description: 'Café Origen Especial Tostado 500g', qty: 3, unitPrice: 34000, discountPct: 0, taxRate: 19 },
          { description: 'Lomo Fino Madurado (Porción 350g)', qty: 2, unitPrice: 68000, discountPct: 5, taxRate: 8 },
        ],
      },
      recipeDraft: {
        code: 'ESC-CAPPUCCINO-ART',
        productName: 'Cappuccino Artesanal de Origen (1 Taza 8oz)',
        salePrice: 14500,
        ingredients: [
          { name: 'Café Especial Molido en Espresso', qty: 0.02, unit: 'KG', unitCost: 37000, wastePct: 5 },
          { name: 'Leche Entera Texturizada', qty: 0.18, unit: 'LT', unitCost: 4800, wastePct: 2 },
          { name: 'Cacao Orgánico y Vaso Térmico', qty: 1, unit: 'UND', unitCost: 950, wastePct: 0 },
        ],
      },
      db: INITIAL_SEED_DB,
    };

    window.provekoSwitchSurface = function(target) {
      STATE.surface = target;
      ['landing', 'login', 'superadmin', 'workstation'].forEach((s) => {
        const sec = document.getElementById('surface-' + s);
        const tab = document.getElementById('tab-surface-' + s);
        if (sec) sec.classList.toggle('hidden', s !== target);
        if (tab) tab.classList.toggle('active', s === target);
      });
      if (target === 'landing') renderLandingConfigurator();
      if (target === 'superadmin') window.provekoRenderSuperAdmin();
      if (target === 'workstation') renderWorkstationShell();
    };

    window.provekoToggleBuilderCenter = function(centerKey) {
      if (STATE.builderCenters.includes(centerKey)) {
        STATE.builderCenters = STATE.builderCenters.filter((k) => k !== centerKey);
      } else {
        STATE.builderCenters.push(centerKey);
      }
      renderLandingConfigurator();
    };

    window.provekoToggleBuilderComp = function(compKey) {
      if (STATE.builderComponents.includes(compKey)) {
        STATE.builderComponents = STATE.builderComponents.filter((k) => k !== compKey);
      } else {
        STATE.builderComponents.push(compKey);
      }
      renderLandingConfigurator();
    };

    window.provekoSelectBuilderPreset = function(mode) {
      if (mode === 'ALL') {
        STATE.builderCenters = CENTERS_CATALOG.filter((c) => c.key !== 'center:users-rbac').map((c) => c.key);
      } else if (mode === 'GASTRO') {
        STATE.builderCenters = ['center:invoicing-pos', 'center:inventory-recipes', 'center:gastro-reservations', 'center:crm-finance'];
      } else {
        STATE.builderCenters = ['center:invoicing-pos', 'center:inventory-recipes', 'center:logistics-fleet', 'center:crm-finance'];
      }
      renderLandingConfigurator();
    };

    window.provekoQuickLogin = function(preset) {
      if (preset === 'SUPERADMIN_GLOBAL') {
        STATE.isSuperAdminSession = true;
        document.getElementById('tab-surface-superadmin').classList.remove('hidden');
        document.getElementById('btn-back-to-superadmin').classList.remove('hidden');
        document.getElementById('active-user-pill').textContent = '👑 SuperAdmin Global';
        window.provekoSwitchSurface('superadmin');
        return;
      }
      STATE.isSuperAdminSession = false;
      STATE.activeTenantId = 'emp-agroindustrial-del-valle';
      STATE.activeRoleKey = preset === 'CAJERO_AGROVALLE' ? 'CAJERO_FACTURADOR' : (preset === 'BASCULA_AGROVALLE' ? 'CONTROL_TRACTOMULAS' : 'ADMIN_CLIENTE');
      document.getElementById('tab-surface-landing').classList.add('hidden');
      window.provekoSwitchSurface('workstation');
    };

    window.provekoSubmitLogin = function() {
      const u = (document.getElementById('login-username').value || '').trim().toLowerCase();
      if (u.includes('superadmin') || u === 'root@proveko.com') {
        window.provekoQuickLogin('SUPERADMIN_GLOBAL');
        return;
      }
      const foundUser = STATE.db.users.find((item) => item.username.toLowerCase() === u);
      if (foundUser) {
        STATE.activeTenantId = foundUser.tenantId;
        STATE.activeRoleKey = foundUser.roleKey;
      }
      document.getElementById('tab-surface-landing').classList.add('hidden');
      window.provekoSwitchSurface('workstation');
    };

    window.provekoEnterAsTenant = function(tenantId) {
      window.provekoCloseCheckoutModal();
      STATE.activeTenantId = tenantId;
      STATE.activeRoleKey = 'ADMIN_CLIENTE';
      document.getElementById('tab-surface-landing').classList.add('hidden');
      window.provekoSwitchSurface('workstation');
    };

    window.provekoSwitchActiveTenant = function(tenantId) {
      STATE.activeTenantId = tenantId;
      renderWorkstationShell();
    };

    window.provekoSwitchActiveRole = function(roleKey) {
      STATE.activeRoleKey = roleKey;
      renderWorkstationShell();
    };

    window.provekoToggleComponentInPlace = function(compKey) {
      const tenant = getActiveTenant();
      if (tenant.enabledComponents.includes(compKey)) {
        tenant.enabledComponents = tenant.enabledComponents.filter((k) => k !== compKey);
      } else {
        tenant.enabledComponents.push(compKey);
      }
      renderWorkstationShell();
    };

    function renderWorkstationShell() {
      const tenant = getActiveTenant();
      const roleProfile = ROLES_CATALOG.find((r) => r.roleKey === STATE.activeRoleKey) || ROLES_CATALOG[0];
      document.getElementById('tenant-select').innerHTML = STATE.db.tenants.map((t) => '<option value="' + escapeHtml(t.tenantId) + '" ' + (t.tenantId === tenant.tenantId ? 'selected' : '') + '>' + escapeHtml(t.companyName) + '</option>').join('');
      document.getElementById('role-select').innerHTML = ROLES_CATALOG.map((r) => '<option value="' + r.roleKey + '" ' + (r.roleKey === STATE.activeRoleKey ? 'selected' : '') + '>' + escapeHtml(r.label) + '</option>').join('');
      document.getElementById('topbar-company-name').textContent = '| ' + tenant.companyName;
      document.getElementById('sidebar-company-label').textContent = tenant.companyName;
      document.getElementById('sidebar-role-label').textContent = 'Rol: ' + roleProfile.label;
      document.getElementById('active-user-pill').textContent = roleProfile.label.split(' ')[0] + ' · ' + tenant.city;

      const visibleCenters = CENTERS_CATALOG.filter((c) => tenant.enabledCenters.includes(c.key) && roleProfile.allowedCenters.includes(c.key));
      if (!visibleCenters.some((c) => c.key === STATE.selectedCenterKey) && visibleCenters.length > 0) {
        STATE.selectedCenterKey = visibleCenters[0].key;
      }
      document.getElementById('sidebar-centers-nav').innerHTML = visibleCenters.map((c) =>
        '<button type="button" class="center-nav-btn ' + (c.key === STATE.selectedCenterKey ? 'active' : '') + '" onclick="STATE.selectedCenterKey=\\'' + c.key + '\\'; renderWorkstationShell();">' +
          '<span style="font-size:18px;">' + c.icon + '</span>' +
          '<div><div style="font-size:13px;">' + escapeHtml(c.shortLabel) + '</div><div style="font-size:10.5px; opacity:0.8;">' + c.components.length + ' componentes</div></div>' +
        '</button>'
      ).join('');

      const activeCenter = CENTERS_CATALOG.find((c) => c.key === STATE.selectedCenterKey) || CENTERS_CATALOG[0];
      document.getElementById('center-title').textContent = activeCenter.icon + ' ' + activeCenter.title;
      document.getElementById('center-summary').textContent = activeCenter.summary;
      document.getElementById('center-badge-branch').textContent = tenant.activeBranch;

      const compBar = document.getElementById('center-components-bar');
      if (activeCenter.components.length === 0) {
        compBar.classList.add('hidden');
      } else {
        compBar.classList.remove('hidden');
        compBar.innerHTML = '<div class="comp-toggles-bar"><span style="font-size:11.5px; font-weight:800; color:var(--text-secondary);">⚙️ Componentes de esta pantalla (Activar / Desactivar en vivo):</span>' +
          activeCenter.components.map((comp) => {
            const on = hasComponent(comp.key);
            return '<button type="button" class="comp-chip ' + (on ? 'on' : '') + '" onclick="window.provekoToggleComponentInPlace(\\'' + comp.key + '\\')">' +
              '<span>' + (on ? '☑' : '☐') + ' ' + escapeHtml(comp.name) + '</span>' +
            '</button>';
          }).join('') + '</div>';
      }

      if (activeCenter.key === 'center:invoicing-pos') renderInvoicingPosCenter();
      else if (activeCenter.key === 'center:inventory-recipes') renderInventoryAndRecipesCenter();
      else if (activeCenter.key === 'center:gastro-reservations') renderGastroAndReservationsCenter();
      else if (activeCenter.key === 'center:logistics-fleet') renderLogisticsAndFleetCenter();
      else if (activeCenter.key === 'center:crm-finance') renderCrmAndFinanceCenter();
      else renderUsersAndRbacCenter();
    }

    window.addEventListener('DOMContentLoaded', () => { window.provekoSwitchSurface(STATE.surface); });
  `;
}
