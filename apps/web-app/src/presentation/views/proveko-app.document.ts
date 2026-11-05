import {
  ALL_FEATURES_FLAT,
  ALL_SUBMODULES_FLAT,
  BUSINESS_TYPE_PRESETS,
  MICROSERVICE_FRONTEND_CATALOG,
} from '../../application/registries/platform-centers.registry.js';
import {
  INITIAL_CLIENT_DATABASES,
  INITIAL_SUBMODULE_ROWS,
} from '../../application/registries/platform-seed-state.registry.js';
import { renderClientRuntimeBundleJs } from '../client-runtime/workstation-controller.runtime.js';
import { renderLandingLayerHtml } from '../components/landing-layer.component.js';
import { renderLoginAndSuperAdminHtml } from '../components/login-and-superadmin.component.js';
import { renderWorkstationLayerHtml } from '../components/workstation-layer.component.js';
import { renderComponentsStylesCss } from '../styles/components.styles.js';
import { renderProvekoDesignTokensCss } from '../styles/design-tokens.styles.js';
import { renderLayoutShellStylesCss } from '../styles/layout-shell.styles.js';

export interface RenderProvekoWorkstationHtmlOptions {
  appUrl?: string;
  appDomain?: string;
  initialSurface?: 'landing' | 'workstation' | 'login' | 'superadmin' | 'demo';
}

export function renderProvekoWorkstationHtml(
  options: RenderProvekoWorkstationHtmlOptions = {},
): string {
  const appDomain = options.appDomain ?? 'proveko.sudoalexmar.tech';
  const initialSurface = options.initialSurface ?? 'landing';

  const bootPayloadJson = JSON.stringify({
    initialSurface,
    services: MICROSERVICE_FRONTEND_CATALOG,
    submodules: ALL_SUBMODULES_FLAT,
    features: ALL_FEATURES_FLAT,
    businessTypes: BUSINESS_TYPE_PRESETS,
    initialClients: INITIAL_CLIENT_DATABASES,
    initialRows: INITIAL_SUBMODULE_ROWS,
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Proveko — Plataforma Empresarial de Gestión Multi-Base</title>
  <style>
${renderProvekoDesignTokensCss()}
${renderLayoutShellStylesCss()}
${renderComponentsStylesCss()}
  </style>
</head>
<body>
  <div class="pk-shell">
    <header class="pk-topbar">
      <div class="pk-brand">
        <div class="pk-logo">PK</div>
        <div>
          <div class="pk-title">PROVEKO <span style="color:var(--pk-primary)" id="top-context-label">| Plataforma Empresarial</span></div>
          <div class="pk-subtitle">Gestión Integrada Multi-Base · Dominio: ${appDomain}</div>
        </div>
      </div>

      <!-- NAVEGACIÓN PÚBLICA: LOS 3 APARTADOS OFICIALES (1. MUESTRA, 2. LOGIN / REGISTRA TU NEGOCIO, 3. DEMO) -->
      <div class="pk-surface-tabs" id="public-nav-tabs">
        <button type="button" class="pk-tab-btn active" id="tab-nav-showcase">🏢 Muestra de la Plataforma</button>
        <button type="button" class="pk-tab-btn" id="tab-nav-auth">🔐 Login / Registra tu Negocio</button>
        <button type="button" class="pk-tab-btn" id="tab-nav-demo">🧪 Demo</button>
      </div>

      <!-- BARRA DE SESIÓN AUTENTICADA (SOLO VISIBLE CUANDO UN USUARIO INICIA SESIÓN REAL) -->
      <div class="pk-context-bar" id="authenticated-session-bar" style="display:none">
        <span class="badge badge-blue" id="session-role-badge">Rol</span>
        <span class="badge badge-emerald" id="session-db-badge">BD</span>
        <span style="font-size:12px;font-weight:700;color:var(--pk-text)" id="session-user-label"></span>
        <button type="button" class="btn btn-outline btn-sm" id="btn-logout-session">Cerrar Sesión</button>
      </div>
    </header>

    ${renderLandingLayerHtml()}
    ${renderLoginAndSuperAdminHtml()}
    ${renderWorkstationLayerHtml()}
  </div>

  <div class="toast" id="pk-toast"></div>

  <script>
    window.__PROVEKO_BOOT__ = ${bootPayloadJson};
${renderClientRuntimeBundleJs()}
  </script>
</body>
</html>`;
}
