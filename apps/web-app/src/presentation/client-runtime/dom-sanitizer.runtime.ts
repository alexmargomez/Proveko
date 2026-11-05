/**
 * Runtime de Cliente — Portada de Armado de Plan (`/`), Ventana de Pagos en Standby (`ms-payments`),
 * Generador de Credenciales del Cliente, Login (`/login`) y Consola SuperAdmin Global (`/superadmin`) (SOLID SRP).
 */
export function renderDomSanitizerAndCatalogRuntimeJs(): string {
  return `
    function escapeHtml(raw) {
      if (raw === null || raw === undefined) return '';
      return String(raw)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatCop(num) {
      const n = Number(num) || 0;
      return '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    function getActiveTenant() {
      return STATE.db.tenants.find((t) => t.tenantId === STATE.activeTenantId) || STATE.db.tenants[0];
    }

    function hasComponent(compKey) {
      const tenant = getActiveTenant();
      return Boolean(tenant && Array.isArray(tenant.enabledComponents) && tenant.enabledComponents.includes(compKey));
    }

    function calculateBuilderQuoteCop() {
      let total = 45000;
      CENTERS_CATALOG.forEach((c) => {
        if (STATE.builderCenters.includes(c.key)) total += c.monthlyBaseCop;
      });
      total += STATE.builderComponents.length * 6000;
      return total;
    }

    function renderLandingConfigurator() {
      const monthlyCop = calculateBuilderQuoteCop();
      const qEl = document.getElementById('quote-total-cop');
      const bEl = document.getElementById('quote-breakdown-text');
      if (qEl) qEl.textContent = formatCop(monthlyCop) + ' COP / mes';
      if (bEl) {
        bEl.textContent = STATE.builderCenters.length + ' Centros Operativos · ' + STATE.builderComponents.length + ' Componentes Activos';
      }
      const grid = document.getElementById('landing-configurator-grid');
      if (!grid) return;
      grid.innerHTML = CENTERS_CATALOG.filter((c) => c.key !== 'center:users-rbac').map((center) => {
        const isCenterOn = STATE.builderCenters.includes(center.key);
        return '<div class="card">' +
          '<div class="card-header" style="background:var(--status-slate-bg);">' +
            '<div style="display:flex; align-items:center; gap:10px;">' +
              '<span style="font-size:20px;">' + center.icon + '</span>' +
              '<div>' +
                '<div class="card-title">' + escapeHtml(center.title) + '</div>' +
                '<div style="font-size:11.5px; color:var(--text-muted);">' + escapeHtml(center.summary) + '</div>' +
              '</div>' +
            '</div>' +
            '<label class="badge ' + (isCenterOn ? 'badge-emerald' : 'badge-slate') + '" style="cursor:pointer;">' +
              '<input type="checkbox" ' + (isCenterOn ? 'checked' : '') + ' onchange="window.provekoToggleBuilderCenter(\\'' + center.key + '\\')" /> ' +
              (isCenterOn ? 'Incluido' : 'Activar') +
            '</label>' +
          '</div>' +
          '<div class="card-body" style="display:flex; flex-direction:column; gap:7px;">' +
            '<div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--text-muted);">Componentes personalizables dentro de este módulo:</div>' +
            center.components.map((comp) => {
              const compOn = isCenterOn && STATE.builderComponents.includes(comp.key);
              return '<label style="display:flex; justify-content:space-between; align-items:center; padding:7px 10px; border:1px solid var(--border-hairline); border-radius:8px; cursor:pointer; background:' + (compOn ? '#EFF6FF' : '#fff') + ';">' +
                '<div>' +
                  '<div style="font-weight:700; font-size:12.5px; color:var(--text-primary);">' + escapeHtml(comp.name) + '</div>' +
                  '<div style="font-size:11px; color:var(--text-muted);">' + escapeHtml(comp.description) + '</div>' +
                '</div>' +
                '<input type="checkbox" ' + (!isCenterOn ? 'disabled' : '') + ' ' + (compOn ? 'checked' : '') + ' onchange="window.provekoToggleBuilderComp(\\'' + comp.key + '\\')" />' +
              '</label>';
            }).join('') +
          '</div>' +
        '</div>';
      }).join('');
    }

    window.provekoOpenCheckoutModal = function() {
      const modal = document.getElementById('checkout-modal');
      const body = document.getElementById('checkout-modal-body');
      if (!modal || !body) return;
      modal.classList.remove('hidden');
      const quoteCop = calculateBuilderQuoteCop();
      body.innerHTML =
        '<div style="padding:10px 14px; background:#FEF3C7; border:1px solid #FCD34D; border-radius:8px; color:#92400E; font-size:12px; margin-bottom:14px;">' +
          '<strong>⚡ Microservicio de Pagos en Standby:</strong> La pasarela bancaria se encuentra en modo Standby de pre-producción. Al confirmar el registro, el pago queda pre-aprobado en Standby y el sistema <strong>genera inmediatamente la credencial del SuperAdmin de la empresa</strong>.' +
        '</div>' +
        '<div class="form-grid-2">' +
          '<div class="form-group"><label class="form-label">Razón Social / Nombre de Empresa</label><input id="reg-company" class="form-control" value="Inversiones & Logística del Norte S.A.S." /></div>' +
          '<div class="form-group"><label class="form-label">NIT / Identificación Tributaria</label><input id="reg-nit" class="form-control" value="901.774.219-8" /></div>' +
          '<div class="form-group"><label class="form-label">Ciudad / Sede Principal</label><input id="reg-city" class="form-control" value="Barranquilla, Colombia" /></div>' +
          '<div class="form-group"><label class="form-label">Correo del Administrador (Usuario SuperAdmin Cliente)</label><input id="reg-email" class="form-control" value="gerencia@logisticanorte.co" /></div>' +
          '<div class="form-group"><label class="form-label">Método de Pago (En Standby)</label><select id="reg-pay-method" class="form-control"><option>Pasarela Tarjeta Corporativa (Standby)</option><option>PSE / Transferencia Empresarial (Standby)</option><option>Convenio Facturación Directa (Standby)</option></select></div>' +
          '<div class="form-group"><label class="form-label">Total Mensual del Plan Armado</label><input class="form-control tabular-nums" disabled value="' + formatCop(quoteCop) + ' COP / mes" /></div>' +
        '</div>' +
        '<button type="button" class="btn btn-emerald" style="width:100%; margin-top:8px; padding:11px;" onclick="window.provekoProcessStandbyPaymentAndCreateTenant()">' +
          '✓ Confirmar Pago en Standby y Generar Credenciales del Cliente' +
        '</button>';
    };

    window.provekoCloseCheckoutModal = function() {
      const modal = document.getElementById('checkout-modal');
      if (modal) modal.classList.add('hidden');
    };

    window.provekoProcessStandbyPaymentAndCreateTenant = function() {
      const companyName = (document.getElementById('reg-company').value || 'Nueva Empresa S.A.S.').trim();
      const nit = (document.getElementById('reg-nit').value || '900.000.000-1').trim();
      const city = (document.getElementById('reg-city').value || 'Bogotá').trim();
      const email = (document.getElementById('reg-email').value || 'admin@nuevaempresa.co').trim();
      const slug = 'emp-' + companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 22) + '-' + Math.floor(100 + Math.random() * 899);
      const generatedPass = 'Prov#' + Math.floor(1000 + Math.random() * 8999) + '!';
      const newTenant = {
        tenantId: slug,
        companyName,
        nit,
        city,
        planName: 'Plan Personalizado (' + STATE.builderCenters.length + ' Centros)',
        paymentStatus: 'STANDBY_APPROVED',
        monthlyCop: calculateBuilderQuoteCop(),
        adminUsername: email,
        adminPassword: generatedPass,
        activeBranch: 'Sede Principal - ' + city,
        enabledCenters: [...new Set([...STATE.builderCenters, 'center:users-rbac'])],
        enabledComponents: [...STATE.builderComponents],
      };
      STATE.db.tenants.unshift(newTenant);
      STATE.db.users.push({ id: 'usr-' + Date.now(), tenantId: slug, fullName: 'Administrador ' + companyName, username: email, password: generatedPass, roleKey: 'ADMIN_CLIENTE', branch: newTenant.activeBranch, active: true });
      const body = document.getElementById('checkout-modal-body');
      body.innerHTML =
        '<div style="padding:16px; background:#DCFCE7; border:1px solid #86EFAC; border-radius:10px; margin-bottom:14px;">' +
          '<div style="font-weight:800; color:#166534; font-size:15px; margin-bottom:4px;">🎉 ¡Empresa Creada y Pago Registrado en Standby!</div>' +
          '<div style="font-size:12.5px; color:#15803D;">El sistema generó automáticamente la credencial maestra del SuperAdmin de esta empresa cliente:</div>' +
        '</div>' +
        '<div class="card" style="margin-bottom:14px; border:1px dashed #1D4ED8; background:#F8FAFC;">' +
          '<div class="card-body form-grid-2">' +
            '<div><span class="kpi-label">Empresa Cliente</span><div style="font-weight:800;">' + escapeHtml(companyName) + '</div></div>' +
            '<div><span class="kpi-label">ID Cuenta (Tenant)</span><div class="mono" style="font-weight:700;">' + escapeHtml(slug) + '</div></div>' +
            '<div><span class="kpi-label">Usuario SuperAdmin Cliente</span><div class="mono" style="font-weight:800; color:#1D4ED8;">' + escapeHtml(email) + '</div></div>' +
            '<div><span class="kpi-label">Contraseña Generada</span><div class="mono" style="font-weight:800; color:#15803D;">' + escapeHtml(generatedPass) + '</div></div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex; gap:10px;">' +
          '<button type="button" class="btn btn-primary" style="flex:1;" onclick="window.provekoEnterAsTenant(\\'' + escapeHtml(slug) + '\\')">🚀 Entrar Directo a Gestionar esta Empresa →</button>' +
          '<button type="button" class="btn btn-outline" onclick="window.provekoCloseCheckoutModal(); window.provekoRenderSuperAdmin();">Ver en Consola</button>' +
        '</div>';
    };
  `;
}
