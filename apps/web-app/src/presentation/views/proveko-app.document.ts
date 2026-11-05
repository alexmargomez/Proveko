import { PROVEKO_MODULE_UI_SCHEMA_REGISTRY } from '../../application/registries/module-schema.registry.js';
import type { RenderWorkstationUiOptions } from '../../domain/contracts/module-ui-schema.contract.js';
import { buildSerializedCatalogBundle } from '../../infrastructure/catalog/seed-catalog.serializer.js';
import { renderDomSanitizerAndCatalogRuntimeJs } from '../client-runtime/dom-sanitizer.runtime.js';
import { renderGuidedFormAndTableRuntimeJs } from '../client-runtime/form-and-table.runtime.js';
import { renderGatewayTransportRuntimeJs } from '../client-runtime/gateway-transport.runtime.js';
import { renderWorkstationControllerRuntimeJs } from '../client-runtime/workstation-controller.runtime.js';
import { renderCommercialLandingLayerHtml } from '../components/landing-layer.component.js';
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
 * Ensamblador Principal del Documento HTML de Proveko (SOLID SRP + DIP).
 * Une los estilos institucionales, las 2 capas de presentación (`/` Portada + `/app` Workstation)
 * y el runtime modular sin contener lógica de negocio ni definiciones de catálogos quemadas.
 */
export function renderProvekoWorkstationHtml(options: RenderWorkstationUiOptions = {}): string {
  const rawDomain = options.appDomain ?? options.appUrl ?? 'proveko.local';
  const domainBadge = escapeHtmlServerSide(rawDomain);
  const initialSurface = options.initialSurface ?? 'workstation';
  const initialLandingActive = initialSurface === 'landing';

  const { servicesJson, modulesJson, presetsJson, uiSchemasJson } = buildSerializedCatalogBundle(
    PROVEKO_MODULE_UI_SCHEMA_REGISTRY,
  );

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proveko — Plataforma Empresarial Componible y Estación de Trabajo</title>
  <style>
    ${renderProvekoDesignTokensCss()}
    ${renderProvekoLayoutShellCss()}
    ${renderProvekoComponentsCss()}
  </style>
</head>
<body>
  ${renderWorkstationLayerHtml({ domainBadge, initialLandingActive })}
  ${renderCommercialLandingLayerHtml(!initialLandingActive)}

  <script>
    const SERVICES_CATALOG = ${servicesJson};
    const MODULES_CATALOG = ${modulesJson};
    const PRESETS_CATALOG = ${presetsJson};
    const UI_SCHEMAS = ${uiSchemasJson};

    ${renderDomSanitizerAndCatalogRuntimeJs()}
    ${renderGuidedFormAndTableRuntimeJs()}
    ${renderWorkstationControllerRuntimeJs(initialSurface)}
    ${renderGatewayTransportRuntimeJs()}
  </script>
</body>
</html>`;
}
