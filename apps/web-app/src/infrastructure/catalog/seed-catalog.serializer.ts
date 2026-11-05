import {
  SEED_INDUSTRY_PRESETS,
  SEED_MICROSERVICES_CATALOG,
  SEED_SERVICES_CATALOG,
  type MicroserviceKey,
  type ServiceKey,
} from '@proveko/shared-kernel';
import type { ModuleUiSchemaDefinition } from '../../domain/contracts/module-ui-schema.contract.js';

export interface NormalizedPresetViewModel {
  readonly key: string;
  readonly presetKey: string;
  readonly name: string;
  readonly summary: string;
  readonly targetAudience: string;
  readonly monthlyBaseCop: number;
  readonly services: readonly ServiceKey[];
  readonly microservices: readonly MicroserviceKey[];
  readonly enabledServices: readonly ServiceKey[];
  readonly enabledMicroservices: readonly MicroserviceKey[];
}

const PRESET_METADATA: Readonly<
  Record<string, { summary: string; monthlyBaseCop: number }>
> = {
  'preset:gastro-bar-restaurant': {
    summary: 'Salón de mesas, Comandera KDS en cocina, División de cuentas y Recetas BOM.',
    monthlyBaseCop: 149000,
  },
  'preset:retail-commerce-dian': {
    summary: 'Mostrador POS, Facturación Electrónica DIAN, Kardex Multibodega y Cartera CxC/CxP.',
    monthlyBaseCop: 129000,
  },
  'preset:hotel-hospitality': {
    summary: 'Rack de habitaciones, Reservas, Folio de huéspedes con consumos y Facturación DIAN.',
    monthlyBaseCop: 199000,
  },
  'preset:distributor-pharma-lots': {
    summary: 'Facturación DIAN, Contabilidad PUC/NIIF Partida Doble, Cartera y Lotes FEFO.',
    monthlyBaseCop: 249000,
  },
};

/**
 * Serializador Seguro Anti-XSS para inyección de estado inicial en `<script>` (SOLID SRP + LSP).
 * Escapa `<`, `>`, `&`, `\u2028` y `\u2029` para impedir inyección de etiquetas `</script>`.
 */
export function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function buildNormalizedIndustryPresets(): readonly NormalizedPresetViewModel[] {
  return SEED_INDUSTRY_PRESETS.map((preset) => {
    const meta = PRESET_METADATA[preset.key] ?? {
      summary: 'Configuración empresarial pre-armada lista para operar.',
      monthlyBaseCop: 129000,
    };
    return {
      key: preset.key,
      presetKey: preset.key,
      name: preset.name,
      summary: meta.summary,
      targetAudience: preset.targetAudience,
      monthlyBaseCop: meta.monthlyBaseCop,
      services: preset.services,
      microservices: preset.microservices,
      enabledServices: preset.services,
      enabledMicroservices: preset.microservices,
    };
  });
}

export function buildSerializedCatalogBundle(
  moduleSchemas: Readonly<Record<string, ModuleUiSchemaDefinition>>,
): {
  readonly servicesJson: string;
  readonly modulesJson: string;
  readonly presetsJson: string;
  readonly uiSchemasJson: string;
} {
  return {
    servicesJson: serializeForInlineScript(SEED_SERVICES_CATALOG),
    modulesJson: serializeForInlineScript(SEED_MICROSERVICES_CATALOG),
    presetsJson: serializeForInlineScript(buildNormalizedIndustryPresets()),
    uiSchemasJson: serializeForInlineScript(moduleSchemas),
  };
}
