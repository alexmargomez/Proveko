import * as ReactNamespace from 'react';
import * as ReactDOMNamespace from 'react-dom';
import * as JsxRuntime from 'react/jsx-runtime';

declare global {
  interface Window {
    __PLATFORM_REACT__?: typeof ReactNamespace;
    __PLATFORM_REACT_DOM__?: typeof ReactDOMNamespace;
    __PLATFORM_JSX_RUNTIME__?: typeof JsxRuntime;
  }
}

window.__PLATFORM_REACT__ = ReactNamespace;
window.__PLATFORM_REACT_DOM__ = ReactDOMNamespace;
window.__PLATFORM_JSX_RUNTIME__ = JsxRuntime;

import('./bootstrap').catch(() => {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;padding:24px;">
      <div style="max-width:480px;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:28px;text-align:center;">
        <h2 style="margin:0 0 10px;font-size:18px;">Servicio de Plataforma en Inicialización</h2>
        <p style="margin:0 0 18px;font-size:13.5px;color:#cbd5e1;line-height:1.5;">
          No fue posible cargar los recursos estandarizados de interfaz a través del Gateway central. Verifica la conectividad e intenta nuevamente.
        </p>
        <button type="button" onclick="window.location.reload()" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-weight:700;cursor:pointer;">
          Reintentar Conexión
        </button>
      </div>
    </div>
  `;
});
