import {
  type IndustryPresetKey,
  type MicroserviceKey,
  MoneyDecimal,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  SEED_INDUSTRY_PRESETS,
  SEED_MICROSERVICES_CATALOG,
  type ServiceKey,
} from '@proveko/shared-kernel';

/**
 * Tarifario Mensual Oficial por Microservicio (`ms:*`) en USD (NUMERIC(19, 4)).
 * Los Servicios Padres (`srv:*`) son Contenedores Gatekeepers gratuitos ($0.0000),
 * ya que por sí solos no exponen pantallas, pero deben estar activos para habilitar sus hijos.
 */
export const MICROSERVICE_MONTHLY_PRICE_USD: Readonly<Record<MicroserviceKey, string>> = {
  'ms:crm-directory': '9.0000',
  'ms:crm-pipelines': '14.0000',
  'ms:crm-loyalty': '12.0000',
  'ms:invoicing-pos': '19.0000',
  'ms:invoicing-simple-receipt': '5.0000',
  'ms:invoicing-electronic-dian': '29.0000',
  'ms:invoicing-quotes': '9.0000',
  'ms:inventory-stock': '19.0000',
  'ms:inventory-recipes': '15.0000',
  'ms:inventory-lots': '18.0000',
  'ms:inventory-transfers': '12.0000',
  'ms:gastro-tables': '15.0000',
  'ms:gastro-kds': '19.0000',
  'ms:gastro-split-check': '9.0000',
  'ms:hotel-rooms': '25.0000',
  'ms:hotel-bookings': '22.0000',
  'ms:hotel-frontdesk': '24.0000',
  'ms:finance-cashbook': '8.0000',
  'ms:finance-ar-ap': '16.0000',
  'ms:finance-accounting-puc': '35.0000',
};

export const PRESET_BUNDLE_DISCOUNT_PERCENT: Readonly<Record<IndustryPresetKey, string>> = {
  'preset:gastro-bar-restaurant': '15.00',
  'preset:retail-commerce-dian': '15.00',
  'preset:hotel-hospitality': '15.00',
  'preset:distributor-pharma-lots': '20.00',
};

export interface ModularQuoteInput {
  enabledServices: ReadonlyArray<ServiceKey>;
  selectedMicroservices: ReadonlyArray<MicroserviceKey>;
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
 * Motor Cotizador Modular de Proveko:
 * 1. Verifica que cada Microservicio tenga habilitado su Servicio Padre Gatekeeper (`srv:*`).
 * 2. Verifica que todas las dependencias (`requires`) estén incluidas en la selección.
 * 3. Impide cobrar dos microservicios del mismo `mutex_group` al mismo tiempo (ej. Recibo Simple + Facturación DIAN).
 * 4. Calcula con precisión `MoneyDecimal` (`decimal.js`) el descuento por Preset Comercial e impuestos.
 */
export class ModularSubscriptionQuoteEngine {
  public calculateQuote(input: ModularQuoteInput): ModularQuoteBreakdown {
    const enabledSrvSet = new Set<ServiceKey>(input.enabledServices);
    const selectedMsSet = new Set<MicroserviceKey>(input.selectedMicroservices);
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

      // 1. Regla Gatekeeper: El Servicio Padre debe estar habilitado
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

    if (input.presetKey) {
      const presetDef = SEED_INDUSTRY_PRESETS.find((p) => p.key === input.presetKey);
      if (
        presetDef &&
        presetDef.microservices.every((m) => selectedMsSet.has(m))
      ) {
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
