import {
  type IndustryPresetKey,
  MICROSERVICE_BASE_MONTHLY_PRICE_USD,
  type MicroserviceKey,
  type ModuleKey,
  MoneyDecimal,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
  type ParentMicroserviceKey,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  SEED_INDUSTRY_PRESETS,
  SEED_MICROSERVICES_CATALOG,
  type ServiceKey,
} from '@proveko/shared-kernel';

/**
 * Tarifario Mensual Oficial por Módulo (`mod:*` / `ms:*`) en USD (NUMERIC(19, 4)).
 * Re-exportado desde `@proveko/shared-kernel` como fuente única de verdad (Single Source of Truth).
 * Los Microservicios Padres (`ms:*` / `srv:*`) son Contenedores Gatekeepers gratuitos ($0.0000),
 * ya que por sí solos no exponen pantallas, pero deben estar activos para habilitar sus módulos hijos.
 */
export const MICROSERVICE_MONTHLY_PRICE_USD: Readonly<Record<MicroserviceKey, string>> =
  MICROSERVICE_BASE_MONTHLY_PRICE_USD;

export const PRESET_BUNDLE_DISCOUNT_PERCENT: Readonly<Record<IndustryPresetKey, string>> = {
  'preset:gastro-bar-restaurant': '15.00',
  'preset:retail-commerce-dian': '15.00',
  'preset:hotel-hospitality': '15.00',
  'preset:distributor-pharma-lots': '20.00',
};

export interface ModularQuoteInput {
  enabledServices: ReadonlyArray<ParentMicroserviceKey | ServiceKey>;
  selectedMicroservices: ReadonlyArray<ModuleKey | MicroserviceKey>;
  presetKey?: IndustryPresetKey;
  taxRatePercent?: string; // Por defecto '19.00' (IVA)
}

export interface ModularQuoteBreakdown {
  enabledServices: ServiceKey[];
  selectedMicroservices: Array<{
    microserviceKey: MicroserviceKey;
    parentService: ServiceKey;
    monthlyPriceUsd: string;
  }>;
  appliedPresetKey: IndustryPresetKey | null;
  subtotalUsd: string;
  discountUsd: string;
  netBeforeTaxUsd: string;
  taxUsd: string;
  totalMonthlyUsd: string;
}

/**
 * Puerto de Dominio para el Motor Cotizador Modular (SOLID DIP + OCP)
 */
export interface SubscriptionQuoteCalculatorPort {
  calculateQuote(input: ModularQuoteInput): ModularQuoteBreakdown;
}

/**
 * Motor Cotizador Modular de Proveko:
 * 1. Verifica que cada Módulo tenga habilitado su Microservicio Padre Gatekeeper (`ms:*` / `srv:*`).
 * 2. Verifica que todas las dependencias (`requires`) estén incluidas en la selección.
 * 3. Impide cobrar dos módulos del mismo `mutex_group` al mismo tiempo (ej. Recibo Simple + Facturación DIAN).
 * 4. Calcula con precisión `MoneyDecimal` (`decimal.js`) el descuento por Preset Comercial e impuestos.
 */
export class ModularSubscriptionQuoteEngine implements SubscriptionQuoteCalculatorPort {
  public calculateQuote(input: ModularQuoteInput): ModularQuoteBreakdown {
    const enabledSrvSet = new Set<ServiceKey>(
      input.enabledServices.map((s) => normalizeParentMicroserviceKey(s)),
    );
    const selectedMsSet = new Set<MicroserviceKey>(
      input.selectedMicroservices.map((m) => normalizeModuleKey(m)),
    );
    const activeMutexMap = new Map<string, MicroserviceKey>();

    const lineItems: ModularQuoteBreakdown['selectedMicroservices'] = [];
    let subtotal = MoneyDecimal.zero();

    for (const msKey of selectedMsSet) {
      const def = SEED_MICROSERVICES_CATALOG.find((m) => m.key === msKey);
      if (!def) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_MICROSERVICE_DISABLED,
          400,
          `Unknown microservice "${msKey}" in quote request.`,
        );
      }

      // 1. Regla Gatekeeper: El Microservicio Padre debe estar habilitado
      if (!enabledSrvSet.has(def.parentService)) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_PARENT_SERVICE_DISABLED,
          422,
          `Cannot quote microservice "${msKey}" without enabling its parent gatekeeper service "${def.parentService}".`,
          { microservice: msKey, required_parent_service: def.parentService },
        );
      }

      // 2. Validar prerrequisitos (requiresServices y requiresMicroservices)
      for (const reqSrv of def.requiresServices) {
        if (!enabledSrvSet.has(reqSrv)) {
          throw new ProvekoDomainError(
            PROVEKO_ERROR_CODES.ERR_MISSING_PREREQUISITES,
            422,
            `Microservice "${msKey}" requires parent service "${reqSrv}".`,
            { microservice: msKey, missing_requirement: reqSrv },
          );
        }
      }
      for (const reqMs of def.requiresMicroservices) {
        if (!selectedMsSet.has(reqMs)) {
          throw new ProvekoDomainError(
            PROVEKO_ERROR_CODES.ERR_MISSING_PREREQUISITES,
            422,
            `Microservice "${msKey}" requires microservice "${reqMs}" to be included in the plan.`,
            { microservice: msKey, missing_requirement: reqMs },
          );
        }
      }

      // 3. Validar exclusión mutua (mutex_group) para no cobrar doble por módulos excluyentes
      if (def.mutexGroup) {
        const conflicting = activeMutexMap.get(def.mutexGroup);
        if (conflicting) {
          throw new ProvekoDomainError(
            PROVEKO_ERROR_CODES.ERR_MUTEX_GROUP_CONFLICT,
            409,
            `Cannot bill mutually exclusive microservices "${conflicting}" and "${msKey}" (mutex_group: "${def.mutexGroup}").`,
            {
              mutex_group: def.mutexGroup,
              conflicting_microservices: [conflicting, msKey],
            },
          );
        }
        activeMutexMap.set(def.mutexGroup, msKey);
      }

      const unitPrice = MoneyDecimal.from(MICROSERVICE_MONTHLY_PRICE_USD[msKey]);
      subtotal = subtotal.add(unitPrice);
      lineItems.push({
        microserviceKey: msKey,
        parentService: def.parentService,
        monthlyPriceUsd: unitPrice.toFixed4(),
      });
    }

    // 4. Evaluar si aplica descuento de Preset Comercial por Giro
    let appliedPreset: IndustryPresetKey | null = null;
    let discount = MoneyDecimal.zero();

    if (input.presetKey !== undefined) {
      const presetDef = SEED_INDUSTRY_PRESETS.find((p) => p.key === input.presetKey);
      if (!presetDef) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
          422,
          `Unknown industry preset "${String(input.presetKey)}".`,
          { preset_key: input.presetKey },
        );
      }
      if (presetDef.microservices.every((m) => selectedMsSet.has(m))) {
        appliedPreset = input.presetKey;
        const discountRate = PRESET_BUNDLE_DISCOUNT_PERCENT[input.presetKey] ?? '0.00';
        discount = subtotal.applyTaxRatePercent(discountRate);
      }
    }

    const netBeforeTax = subtotal.sub(discount);
    const taxRate = input.taxRatePercent ?? '19.00';
    const tax = netBeforeTax.applyTaxRatePercent(taxRate);
    const total = netBeforeTax.add(tax);

    return {
      enabledServices: Array.from(enabledSrvSet),
      selectedMicroservices: lineItems,
      appliedPresetKey: appliedPreset,
      subtotalUsd: subtotal.toFixed4(),
      discountUsd: discount.toFixed4(),
      netBeforeTaxUsd: netBeforeTax.toFixed4(),
      taxUsd: tax.toFixed4(),
      totalMonthlyUsd: total.toFixed4(),
    };
  }
}

