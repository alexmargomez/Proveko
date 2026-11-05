import { PROVEKO_MODULE_UI_SCHEMA_REGISTRY } from '../../application/registries/module-schema.registry.js';
import {
  PROVEKO_OPERATIONAL_CENTERS,
  PROVEKO_ROLE_PROFILES,
} from '../../application/registries/platform-centers.registry.js';
import { buildInitialPlatformSeedState } from '../../application/registries/platform-seed-state.registry.js';
import type { RenderWorkstationUiOptions } from '../../domain/contracts/module-ui-schema.contract.js';
import {
  buildSerializedCatalogBundle,
  serializeForInlineScript,
} from '../../infrastructure/catalog/seed-catalog.serializer.js';
import { renderDomSanitizerAndCatalogRuntimeJs } from '../client-runtime/dom-sanitizer.runtime.js';
import { renderGuidedFormAndTableRuntimeJs } from '../client-runtime/form-and-table.runtime.js';
import { renderGatewayTransportRuntimeJs } from '../client-runtime/gateway-transport.runtime.js';
import { renderPlatformActionsRuntimeJs } from '../client-runtime/platform-actions.runtime.js';
import { renderSuperAdminAndShellRuntimeJs } from '../client-runtime/superadmin-and-shell.runtime.js';
import { renderWorkstationControllerRuntimeJs } from '../client-runtime/workstation-controller.runtime.js';
import { renderCommercialLandingLayerHtml } from '../components/landing-layer.component.js';
import { renderLoginAndSuperAdminLayerHtml } from '../components/login-and-superadmin.component.js';
import { renderWorkstationLayerHtml } from '../components/workstation-layer.component.js';
import { renderProvekoComponentsCss } from '../styles/components.styles.js';
import { renderProvekoDesignTokensCss } from '../styles/design-tokens.styles.js';
import { renderProvekoLayoutShellCss } from '../styles/layout-shell.styles.js';

function escapeHtmlServerSide(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Ensamblador Principal del Documento HTML de la Plataforma Unificada Proveko (SOLID SRP + DIP).
 * Conecta las 4 Superficies: Portada/Checkout (`/`), Login (`/login`), Consola SuperAdmin (`/superadmin`)
 * y Plataforma de Gestión Empresarial (`/app`) con sus 6 Centros Operativos y Componentes Conmutables.
 */
export function renderProvekoWorkstationHtml(options: RenderWorkstationUiOptions = {}): string {
  const rawDomain = options.appDomain ?? options.appUrl ?? 'proveko.local';
  const domainBadge = escapeHtmlServerSide(rawDomain);
  const initialSurface = options.initialSurface ?? 'workstation';
  const initialLandingActive = initialSurface === 'landing';

  const { servicesJson, modulesJson, presetsJson, uiSchemasJson } = buildSerializedCatalogBundle(
    PROVEKO_MODULE_UI_SCHEMA_REGISTRY,
  );
  const centersJson = serializeForInlineScript(PROVEKO_OPERATIONAL_CENTERS);
  const rolesJson = serializeForInlineScript(PROVEKO_ROLE_PROFILES);
  const initialSeedDbJson = serializeForInlineScript(buildInitialPlatformSeedState());

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proveko — Plataforma Integrada de Gestión Empresarial</title>
  <style>
    ${renderProvekoDesignTokensCss()}
    ${renderProvekoLayoutShellCss()}
    ${renderProvekoComponentsCss()}
  </style>
</head>
<body>
  ${renderWorkstationLayerHtml({ domainBadge, initialLandingActive })}
  ${renderCommercialLandingLayerHtml(!initialLandingActive)}
  ${renderLoginAndSuperAdminLayerHtml()}

  <script>
    const SERVICES_CATALOG = ${servicesJson};
    const MODULES_CATALOG = ${modulesJson};
    const PRESETS_CATALOG = ${presetsJson};
    const UI_SCHEMAS = ${uiSchemasJson};
    const CENTERS_CATALOG = ${centersJson};
    const ROLES_CATALOG = ${rolesJson};
    const INITIAL_SEED_DB = ${initialSeedDbJson};

    ${renderDomSanitizerAndCatalogRuntimeJs()}
    ${renderGuidedFormAndTableRuntimeJs()}
    ${renderWorkstationControllerRuntimeJs(initialSurface)}
    ${renderGatewayTransportRuntimeJs()}
    ${renderPlatformActionsRuntimeJs()}
    ${renderSuperAdminAndShellRuntimeJs(initialSurface)}
  </script>
</body>
</html>`;
}
