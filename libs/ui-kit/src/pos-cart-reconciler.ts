import {
  type MicroserviceKey,
  MoneyDecimal,
  type ProvekoJwtClaims,
  resolveMicroserviceAccess,
} from '@proveko/shared-kernel';

export interface PosCartItemSnapshot {
  lineId: string;
  sku: string;
  name: string;
  quantityFixed4: string;
  unitPriceFixed4: string;
  taxRatePercent: string;
}

export interface PosCartStateSnapshot {
  tenantId: string;
  branchId: string;
  documentEmitMode: 'ms:invoicing-simple-receipt' | 'ms:invoicing-electronic-dian';
  customerTaxId: string | null;
  items: PosCartItemSnapshot[];
  reconciledNotice: string | null;
}

/**
 * Reconciliador Resiliente del Carrito POS ante cambios de `sub_ver` en caliente (`supersedes`) [P3-01]
 * Si el cajero está armando una venta en modo `ms:invoicing-simple-receipt` y la empresa activa
 * `ms:invoicing-electronic-dian`, conmuta el carrito sin perder ni un solo ítem ni descuadrar decimales.
 */
export class PosCartCapabilityReconciler {
  public static calculateCartTotalFixed4(items: readonly PosCartItemSnapshot[]): string {
    let total = MoneyDecimal.zero();
    for (const item of items) {
      const subtotal = MoneyDecimal.from(item.unitPriceFixed4).mul(item.quantityFixed4);
      const tax = subtotal.applyTaxRatePercent(item.taxRatePercent);
      total = total.add(subtotal).add(tax);
    }
    return total.toFixed4();
  }

  public static reconcileCartOnSubVerUpdate(
    cart: PosCartStateSnapshot,
    newClaims: Pick<ProvekoJwtClaims, 'services' | 'readonly_microservices'>,
  ): PosCartStateSnapshot {
    const currentAccess = resolveMicroserviceAccess(
      newClaims,
      'srv:invoicing',
      cart.documentEmitMode as MicroserviceKey,
    );

    if (currentAccess.access === 'READONLY_ARCHIVE' && currentAccess.supersededBy) {
      return {
        ...cart,
        documentEmitMode: currentAccess.supersededBy as PosCartStateSnapshot['documentEmitMode'],
        reconciledNotice: `El modo de emisión se actualizó automáticamente a "${currentAccess.supersededBy}" conservando todos los productos del carrito.`,
      };
    }

    return cart;
  }
}
