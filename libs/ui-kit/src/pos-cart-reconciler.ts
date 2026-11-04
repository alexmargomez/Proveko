import {
  type MicroserviceKey,
  type ModuleKey,
  MoneyDecimal,
  normalizeModuleKey,
  type ProvekoJwtClaims,
  resolveMicroserviceAccess,
} from '@proveko/shared-kernel';

export type PosDocumentEmitMode =
  | 'ms:invoicing-simple-receipt'
  | 'ms:invoicing-electronic-dian'
  | 'mod:invoicing-simple-receipt'
  | 'mod:invoicing-electronic-dian';

export interface PosCartItemSnapshot {
  lineId: string;
  sku: string;
  name: string;
  quantityFixed4: string;
  unitPriceFixed4: string;
  taxRatePercent: string;
}

export interface PosCartBreakdownFixed4 {
  subtotalFixed4: string;
  taxTotalFixed4: string;
  grandTotalFixed4: string;
}

export interface PosCartStateSnapshot {
  tenantId: string;
  branchId: string;
  documentEmitMode: PosDocumentEmitMode;
  customerTaxId: string | null;
  items: PosCartItemSnapshot[];
  reconciledNotice: string | null;
}

const VALID_EMIT_MODES: ReadonlySet<string> = new Set<PosDocumentEmitMode>([
  'ms:invoicing-simple-receipt',
  'ms:invoicing-electronic-dian',
  'mod:invoicing-simple-receipt',
  'mod:invoicing-electronic-dian',
]);

function isPosDocumentEmitMode(key: MicroserviceKey | ModuleKey | string): key is PosDocumentEmitMode {
  return VALID_EMIT_MODES.has(key);
}

/**
 * Reconciliador Resiliente del Carrito POS ante cambios de `sub_ver` en caliente (`supersedes`) [P3-01]
 * Si el cajero está armando una venta en modo `mod:invoicing-simple-receipt` (`ms:invoicing-simple-receipt`)
 * y la empresa activa `mod:invoicing-electronic-dian` (`ms:invoicing-electronic-dian`),
 * conmuta el carrito sin perder ni un solo ítem ni descuadrar decimales, y asigna Consumidor Final DIAN
 * (`222222222222`) si `customerTaxId` estaba en `null`.
 */
export class PosCartCapabilityReconciler {
  public static calculateCartBreakdownFixed4(
    items: readonly PosCartItemSnapshot[],
  ): PosCartBreakdownFixed4 {
    let subtotalAcc = MoneyDecimal.zero();
    let taxAcc = MoneyDecimal.zero();

    for (const item of items) {
      const qty = MoneyDecimal.from(item.quantityFixed4).assertPositive('quantityFixed4');
      const unitPrice = MoneyDecimal.from(item.unitPriceFixed4).assertNonNegative('unitPriceFixed4');
      const lineSubtotal = unitPrice.mul(qty);
      const lineTax = lineSubtotal.applyTaxRatePercent(item.taxRatePercent);
      subtotalAcc = subtotalAcc.add(lineSubtotal);
      taxAcc = taxAcc.add(lineTax);
    }

    return {
      subtotalFixed4: subtotalAcc.toFixed4(),
      taxTotalFixed4: taxAcc.toFixed4(),
      grandTotalFixed4: subtotalAcc.add(taxAcc).toFixed4(),
    };
  }

  public static calculateCartTotalFixed4(items: readonly PosCartItemSnapshot[]): string {
    return PosCartCapabilityReconciler.calculateCartBreakdownFixed4(items).grandTotalFixed4;
  }

  public static reconcileCartOnSubVerUpdate(
    cart: PosCartStateSnapshot,
    newClaims: Pick<ProvekoJwtClaims, 'services' | 'readonly_microservices'>,
  ): PosCartStateSnapshot {
    const normalizedMode = normalizeModuleKey(cart.documentEmitMode);
    const currentAccess = resolveMicroserviceAccess(
      newClaims,
      'srv:invoicing',
      normalizedMode,
    );

    if (
      currentAccess.access === 'READONLY_ARCHIVE' &&
      currentAccess.supersededBy &&
      isPosDocumentEmitMode(currentAccess.supersededBy)
    ) {
      const usesModPrefix = cart.documentEmitMode.startsWith('mod:');
      const targetMode: PosDocumentEmitMode =
        usesModPrefix && currentAccess.supersededBy === 'ms:invoicing-electronic-dian'
          ? 'mod:invoicing-electronic-dian'
          : currentAccess.supersededBy;
      const isElectronicDian =
        targetMode === 'ms:invoicing-electronic-dian' ||
        targetMode === 'mod:invoicing-electronic-dian';

      return {
        ...cart,
        documentEmitMode: targetMode,
        customerTaxId:
          isElectronicDian && (!cart.customerTaxId || cart.customerTaxId.trim().length === 0)
            ? '222222222222'
            : cart.customerTaxId,
        reconciledNotice: `El modo de emisión se actualizó automáticamente a "${targetMode}" conservando todos los productos del carrito.`,
      };
    }

    return cart;
  }
}

