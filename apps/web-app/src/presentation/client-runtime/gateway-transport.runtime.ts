/**
 * Runtime de Cliente — Transporte HTTP Zero-Trust, Concurrencia (`requestSeq` + `isActionInFlight`)
 * y Single-Flight Silent Refresh en `401 ERR_SUB_VER_STALE` (SOLID SRP + DIP).
 */
export function renderGatewayTransportRuntimeJs(): string {
  return `
    window.provekoReissueSession = async function() {
      const tenantSel = document.getElementById('tenant-select');
      const branchSel = document.getElementById('branch-select');
      if (tenantSel) STATE.tenantId = tenantSel.value;
      if (branchSel) STATE.activeBranchId = branchSel.value;
      const seq = ++STATE.requestSeq;
      const res = await fetch('/api/v1/control/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId: STATE.tenantId,
          activeBranchId: STATE.activeBranchId,
          subVer: STATE.subVer,
          services: STATE.enabledServices,
          readonlyMicroservices: STATE.readonlyMicroservices
        })
      });
      const data = await res.json();
      if (seq !== STATE.requestSeq) return;
      STATE.token = data.token;
      document.getElementById('jwt-status-badge').textContent =
        'Ed25519 · sub_ver: ' + data.subVer + ' · ' + data.activeBranchId;
      renderLandingConfigurator();
      renderSidebar();
      renderActiveModulePanel();
      await window.provekoExecuteList();
    };

    async function callGatewayWithSilentRefresh(url, options) {
      const doCall = () => fetch(url, {
        ...options,
        headers: { ...(options.headers || {}), 'authorization': 'Bearer ' + STATE.token }
      });
      let res = await doCall();
      if (res.status === 401) {
        await window.provekoReissueSession();
        res = await doCall();
      }
      return res;
    }

    window.provekoExecuteList = async function() {
      const schema = UI_SCHEMAS[STATE.selectedModuleKey];
      if (!schema || !STATE.token) return;
      const res = await callGatewayWithSilentRefresh(schema.listEndpoint, { method: 'GET' });
      const body = await res.json();
      updateInspector(res, body);
      if (res.ok) renderDynamicTable(schema, body);
    };

    window.provekoExecuteCreate = async function() {
      if (STATE.isActionInFlight) return;
      const schema = UI_SCHEMAS[STATE.selectedModuleKey];
      const btn = document.getElementById('btn-create-action');
      try {
        STATE.isActionInFlight = true;
        if (btn) btn.disabled = true;
        if (!STATE.showRawJson) window.provekoSyncGuidedFormToJson();
        const parsed = JSON.parse(document.getElementById('payload-editor').value);
        const res = await callGatewayWithSilentRefresh(schema.createEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed)
        });
        const body = await res.json();
        updateInspector(res, body);
        if (res.ok) await window.provekoExecuteList();
      } finally {
        STATE.isActionInFlight = false;
        renderActiveModulePanel();
      }
    };

    function updateInspector(res, body) {
      const badge = document.getElementById('resp-status-badge');
      const servedBy = document.getElementById('resp-served-by');
      const pre = document.getElementById('response-inspector');
      if (badge) {
        badge.textContent = 'HTTP ' + res.status;
        badge.className = 'badge mono ' + (res.ok ? 'badge-emerald' : 'badge-crimson');
      }
      if (servedBy) servedBy.textContent = res.headers.get('x-proveko-served-by') || 'api-gateway';
      if (pre) pre.textContent = JSON.stringify(body, null, 2);
    }

    window.provekoLoadTopology = async function() {
      const res = await fetch('/api/v1/topology');
      const data = await res.json();
      const grid = document.getElementById('topology-grid');
      if (!grid || !Array.isArray(data.topology)) return;
      grid.innerHTML = data.topology.map((t) =>
        '<div style="padding:8px 10px; border:1px solid #334155; border-radius:6px; background:#1E293B;">' +
          '<div class="mono" style="font-weight:700; color:#93C5FD; font-size:11.5px;">' + escapeHtml(t.parentMicroservice) + '</div>' +
          '<div class="mono" style="font-size:11px; color:#E2E8F0;">' + escapeHtml(t.baseUrl) + '</div>' +
        '</div>'
      ).join('');
    };

    window.addEventListener('DOMContentLoaded', () => { window.provekoReissueSession(); });
  `;
}
