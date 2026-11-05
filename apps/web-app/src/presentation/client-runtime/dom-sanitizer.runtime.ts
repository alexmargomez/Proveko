/**
 * Runtime de Cliente — Sanitización Anti-XSS (`escapeHtml`), Cotizador Modular y Sidebar (SOLID SRP).
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
      const n = Number(num);
      if (!Number.isFinite(n)) return escapeHtml(num);
      return '$' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function isParentEnabled(svcKey) {
      return Array.isArray(STATE.enabledServices[svcKey]);
    }

    function getModuleStatus(mod) {
      if (!isParentEnabled(mod.parentService)) return 'LOCKED_PARENT';
      const activeList = STATE.enabledServices[mod.parentService] || [];
      if (activeList.includes(mod.key)) return 'ACTIVE';
      if (STATE.readonlyMicroservices.includes(mod.key)) return 'READONLY';
      return 'INACTIVE';
    }

    function updateCommercialQuote() {
      const enabledParentsCount = Object.keys(STATE.enabledServices).length;
      let activeModsCount = 0;
      Object.values(STATE.enabledServices).forEach((arr) => {
        if (Array.isArray(arr)) activeModsCount += arr.length;
      });
      const monthlyCop = 49000 + (enabledParentsCount * 20000) + (activeModsCount * 12000);
      const quoteEl = document.getElementById('quote-total-cop');
      const breakEl = document.getElementById('quote-breakdown-text');
      const subVerEl = document.getElementById('quote-subver-pill');
      if (quoteEl) quoteEl.textContent = formatCop(monthlyCop) + ' COP / mes';
      if (breakEl) {
        breakEl.textContent = enabledParentsCount + ' Microservicios Contenedores · ' + activeModsCount + ' Módulos Operativos Activos';
      }
      if (subVerEl) subVerEl.textContent = 'sub_ver: ' + STATE.subVer;
    }

    function renderLandingConfigurator() {
      updateCommercialQuote();
      const presetsContainer = document.getElementById('landing-presets-grid');
      if (presetsContainer) {
        presetsContainer.innerHTML = PRESETS_CATALOG.map((p) => {
          const isCurrent = STATE.activePresetKey === p.presetKey;
          return '<button type="button" class="preset-card ' + (isCurrent ? 'active' : '') + '" onclick="window.provekoApplyPreset(\\'' + escapeHtml(p.presetKey) + '\\')">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">' +
              '<span class="badge badge-blue">' + escapeHtml(p.targetAudience || 'Giro Empresarial') + '</span>' +
              '<span class="mono" style="font-size:11px; color:var(--text-muted);">' + escapeHtml(p.presetKey) + '</span>' +
            '</div>' +
            '<div style="font-weight:800; font-size:14px; margin-bottom:4px; color:var(--text-primary);">' + escapeHtml(p.name) + '</div>' +
            '<div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">' + escapeHtml(p.summary || '') + '</div>' +
            '<div style="font-size:11px; font-weight:700; color:var(--brand-primary);">Activar Plantilla (' + (p.enabledMicroservices ? p.enabledMicroservices.length : 0) + ' módulos) →</div>' +
          '</button>';
        }).join('');
      }

      const confGrid = document.getElementById('landing-configurator-grid');
      if (!confGrid) return;
      confGrid.innerHTML = SERVICES_CATALOG.map((svc) => {
        const parentOn = isParentEnabled(svc.key);
        const childMods = MODULES_CATALOG.filter((m) => m.parentService === svc.key);
        const msNotation = svc.key.replace(/^srv:/, 'ms:');
        return '<div class="card">' +
          '<div class="card-header" style="background:var(--status-slate-bg);">' +
            '<div>' +
              '<div style="font-weight:800; font-size:13px;">' + escapeHtml(svc.name) + '</div>' +
              '<div class="mono" style="font-size:11px; color:var(--text-muted);">' + escapeHtml(msNotation) + ' · Esquema: ' + escapeHtml(svc.dbSchema) + '</div>' +
            '</div>' +
            '<input type="checkbox" aria-label="Activar ' + escapeHtml(svc.name) + '" ' + (parentOn ? 'checked' : '') + ' onchange="window.provekoToggleParentService(\\'' + escapeHtml(svc.key) + '\\')" />' +
          '</div>' +
          '<div class="card-body" style="display:flex; flex-direction:column; gap:8px;">' +
            childMods.map((mod) => {
              const st = getModuleStatus(mod);
              const modNotation = mod.key.replace(/^ms:/, 'mod:');
              const badgeHtml = st === 'ACTIVE'
                ? '<span class="badge badge-emerald">ACTIVO</span>'
                : st === 'READONLY'
                  ? '<span class="badge badge-amber">HISTÓRICO</span>'
                  : '<span class="badge badge-slate">INACTIVO</span>';
              return '<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 8px; border:1px solid var(--border-hairline); border-radius:6px;">' +
                '<div>' +
                  '<div style="font-weight:600; font-size:12.5px;">' + escapeHtml(mod.name) + '</div>' +
                  '<div class="mono" style="font-size:10.5px; color:var(--text-muted);">' + escapeHtml(modNotation) + ' (' + escapeHtml(mod.tablePrefix) + ')</div>' +
                '</div>' +
                '<div style="display:flex; align-items:center; gap:8px;">' +
                  badgeHtml +
                  '<input type="checkbox" ' + (!parentOn ? 'disabled' : '') + ' ' + (st === 'ACTIVE' ? 'checked' : '') + ' onchange="window.provekoToggleModule(\\'' + escapeHtml(svc.key) + '\\', \\'' + escapeHtml(mod.key) + '\\')" />' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
      }).join('');
    }

    function renderSidebar() {
      const container = document.getElementById('sidebar-catalog');
      if (!container) return;
      container.innerHTML = SERVICES_CATALOG.map((svc) => {
        const parentOn = isParentEnabled(svc.key);
        const childMods = MODULES_CATALOG.filter((m) => m.parentService === svc.key);
        return '<div class="svc-group">' +
          '<div class="svc-header">' +
            '<span>' + escapeHtml(svc.name) + '</span>' +
            '<input type="checkbox" title="Activar/Desactivar Microservicio Padre" ' + (parentOn ? 'checked' : '') + ' onchange="window.provekoToggleParentService(\\'' + escapeHtml(svc.key) + '\\')" />' +
          '</div>' +
          '<div class="mod-list">' +
            childMods.map((mod) => {
              const st = getModuleStatus(mod);
              const isSelected = STATE.selectedModuleKey === mod.key;
              const pill = st === 'ACTIVE'
                ? '<span class="badge badge-emerald" style="font-size:9px; padding:1px 5px;">ON</span>'
                : st === 'READONLY'
                  ? '<span class="badge badge-amber" style="font-size:9px; padding:1px 5px;">RO</span>'
                  : '<span class="badge badge-slate" style="font-size:9px; padding:1px 5px;">OFF</span>';
              return '<div class="mod-item ' + (isSelected ? 'active' : '') + '" onclick="window.provekoSelectModule(\\'' + escapeHtml(mod.key) + '\\')">' +
                '<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + escapeHtml(mod.name) + '</span>' +
                '<div style="display:flex; align-items:center; gap:5px;" onclick="event.stopPropagation()">' +
                  pill +
                  '<input type="checkbox" ' + (!parentOn ? 'disabled' : '') + ' ' + (st === 'ACTIVE' ? 'checked' : '') + ' onchange="window.provekoToggleModule(\\'' + escapeHtml(svc.key) + '\\', \\'' + escapeHtml(mod.key) + '\\')" />' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
      }).join('');
    }
  `;
}
