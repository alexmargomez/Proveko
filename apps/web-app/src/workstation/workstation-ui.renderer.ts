/**
 * Fachada de Compatibilidad de `workstation-ui.renderer.ts` (SOLID SRP + Regla [NUNCA ELIMINAR TRACKEADOS]).
 * El antiguo archivo monolítico de 1,572 líneas fue descompuesto en módulos cohesivos bajo:
 * - `domain/contracts/module-ui-schema.contract.ts`
 * - `application/registries/module-schema.registry.ts` (+ 6 esquemas por dominio)
 * - `infrastructure/catalog/seed-catalog.serializer.ts`
 * - `presentation/styles/{design-tokens,layout-shell,components}.styles.ts`
 * - `presentation/components/{landing-layer,workstation-layer}.component.ts`
 * - `presentation/client-runtime/{dom-sanitizer,form-and-table,workstation-controller}.runtime.ts`
 * - `presentation/views/proveko-app.document.ts`
 */
export type { RenderWorkstationUiOptions } from '../domain/contracts/module-ui-schema.contract.js';
export { renderProvekoWorkstationHtml } from '../presentation/views/proveko-app.document.js';
