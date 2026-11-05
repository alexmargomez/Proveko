/**
 * Runtime de Cliente — Renderizador Declarativo de Formularios Guiados y Grillas Contables (SOLID OCP + SRP).
 * Abierto a la extensión (nuevos módulos en UI_SCHEMAS) y cerrado a la modificación (cero cadenas if/else por módulo).
 */
export function renderGuidedFormAndTableRuntimeJs(): string {
  return `
    function renderModuleKpis(schema) {
      const strip = document.getElementById('mod-kpi-strip');
      if (!strip) return;
      const kpis = Array.isArray(schema.kpis) ? schema.kpis : [];
      strip.innerHTML = kpis.map((kpi) => {
        const badgeClass = 'badge-' + escapeHtml(kpi.badgeTone || 'slate');
        return '<div class="kpi-card">' +
          '<div style="display:flex; justify-content:space-between; align-items:center;">' +
            '<span class="kpi-label">' + escapeHtml(kpi.label) + '</span>' +
            '<span class="badge ' + badgeClass + '">Verificado</span>' +
          '</div>' +
          '<div class="kpi-value tabular-nums">' + escapeHtml(kpi.value) + '</div>' +
          '<div class="kpi-sub">' + escapeHtml(kpi.subtext) + '</div>' +
        '</div>';
      }).join('');
    }

    function renderGuidedFormFields(schema, isReadonlyOrLocked) {
      const container = document.getElementById('guided-form-fields');
      if (!container) return;
      const fields = Array.isArray(schema.formFields) ? schema.formFields : [];
      container.innerHTML = fields.map((field) => {
        const inputId = 'proveko-field-' + escapeHtml(field.name);
        const disabledAttr = isReadonlyOrLocked ? 'disabled' : '';
        let controlHtml = '';

        if (field.type === 'select' && Array.isArray(field.options)) {
          controlHtml = '<select id="' + inputId + '" data-field-name="' + escapeHtml(field.name) + '" data-field-type="select" class="form-control" ' + disabledAttr + ' onchange="window.provekoSyncGuidedFormToJson()">' +
            field.options.map((opt) => {
              const selected = String(opt.value) === String(field.defaultValue) ? 'selected' : '';
              return '<option value="' + escapeHtml(opt.value) + '" ' + selected + '>' + escapeHtml(opt.label) + '</option>';
            }).join('') +
          '</select>';
        } else if (field.type === 'json-lines') {
          const jsonStr = JSON.stringify(field.defaultValue, null, 2);
          controlHtml = '<textarea id="' + inputId + '" data-field-name="' + escapeHtml(field.name) + '" data-field-type="json-lines" class="form-control mono" style="min-height:88px; font-size:11.5px;" ' + disabledAttr + ' oninput="window.provekoSyncGuidedFormToJson()">' + escapeHtml(jsonStr) + '</textarea>';
        } else {
          const extraClass = (field.type === 'decimal' || field.type === 'integer') ? 'tabular-nums mono' : '';
          const inputType = field.type === 'integer' ? 'number' : 'text';
          controlHtml = '<input id="' + inputId + '" type="' + inputType + '" data-field-name="' + escapeHtml(field.name) + '" data-field-type="' + escapeHtml(field.type) + '" class="form-control ' + extraClass + '" value="' + escapeHtml(field.defaultValue) + '" placeholder="' + escapeHtml(field.placeholder || '') + '" ' + disabledAttr + ' oninput="window.provekoSyncGuidedFormToJson()" />';
        }

        return '<div class="form-group">' +
          '<label class="form-label" for="' + inputId + '">' + escapeHtml(field.label) + '</label>' +
          controlHtml +
          (field.helperText ? '<div class="form-helper">' + escapeHtml(field.helperText) + '</div>' : '') +
        '</div>';
      }).join('');
    }

    window.provekoSyncGuidedFormToJson = function() {
      const schema = UI_SCHEMAS[STATE.selectedModuleKey];
      if (!schema) return;
      const payload = {};
      const controls = document.querySelectorAll('#guided-form-fields [data-field-name]');
      controls.forEach((el) => {
        const name = el.getAttribute('data-field-name');
        const fType = el.getAttribute('data-field-type');
        const rawVal = el.value;
        if (fType === 'integer') {
          payload[name] = Number.parseInt(rawVal, 10) || 0;
        } else if (fType === 'json-lines') {
          try {
            payload[name] = JSON.parse(rawVal);
          } catch (_e) {
            payload[name] = schema.defaultPayload[name] || [];
          }
        } else {
          payload[name] = rawVal;
        }
      });
      const editor = document.getElementById('payload-editor');
      if (editor) {
        editor.value = JSON.stringify(payload, null, 2);
      }
    };

    function extractCollectionFromResponse(schema, body) {
      if (!body || typeof body !== 'object') return [];
      const key = schema && schema.responseCollectionPath;
      if (key && Array.isArray(body[key])) {
        return body[key];
      }
      if (Array.isArray(body)) return body;
      return [body];
    }

    function renderDynamicTable(schema, body) {
      const container = document.getElementById('records-table-container');
      const countBadge = document.getElementById('records-count-badge');
      if (!container) return;

      const rows = extractCollectionFromResponse(schema, body);
      if (countBadge) countBadge.textContent = rows.length + ' registro(s)';

      if (rows.length === 0) {
        container.innerHTML = '<div style="padding:28px; text-align:center; color:var(--text-muted); font-size:13px;">' +
          'No hay registros aún en esta sucursal. Completa el formulario guiado de la izquierda y haz clic en el botón de acción para crear el primero.' +
        '</div>';
        return;
      }

      const cols = (schema && Array.isArray(schema.columns) && schema.columns.length > 0)
        ? schema.columns
        : Object.keys(rows[0]).slice(0, 6).map((k) => ({ key: k, header: k, format: 'text' }));

      const thead = '<thead><tr>' + cols.map((c) => '<th>' + escapeHtml(c.header) + '</th>').join('') + '</tr></thead>';
      const tbody = '<tbody>' + rows.map((row) => {
        return '<tr>' + cols.map((col) => {
          const val = row && row[col.key] !== undefined ? row[col.key] : '—';
          if (col.format === 'tabular-currency') {
            return '<td class="tabular-nums mono" style="font-weight:700;">' + escapeHtml(val) + '</td>';
          }
          if (col.format === 'badge') {
            return '<td><span class="badge badge-blue mono">' + escapeHtml(val) + '</span></td>';
          }
          if (col.format === 'code') {
            return '<td class="mono" style="font-size:11.5px; color:var(--text-secondary);">' + escapeHtml(val) + '</td>';
          }
          return '<td>' + escapeHtml(typeof val === 'object' ? JSON.stringify(val) : val) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>';

      container.innerHTML = '<table class="data-table">' + thead + tbody + '</table>';
    }
  `;
}
