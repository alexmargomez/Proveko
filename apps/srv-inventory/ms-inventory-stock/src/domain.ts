import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export type KardexMovementType =
  | 'INBOUND'
  | 'OUTBOUND_SALE'
  | 'RECIPE_DEDUCTION'
  | 'ADJUSTMENT';

export interface RecordStockMovementDto {
  sku: string;
  movementType: KardexMovementType;
  currentQty: string;
  quantityDelta: string;
  unitCost: string;
}

export interface StockMovementResult {
  tenantId: string;
  branchId: string;
  sku: string;
  movementType: KardexMovementType;
  newQtyOnHand: string;
  totalValuation: string;
}

/**
 * Puerto de Repositorio de Existencias Kardex (SOLID DIP)
 */
export interface InventoryStockRepositoryPort {
  listByTenantAndBranch(tenantId: string, branchId: string): Promise<StockMovementResult[]>;
  saveStockSnapshot(snapshot: StockMovementResult): Promise<StockMovementResult>;
}

const VALID_MOVEMENT_TYPES: ReadonlySet<string> = new Set<KardexMovementType>([
  'INBOUND',
  'OUTBOUND_SALE',
  'RECIPE_DEDUCTION',
  'ADJUSTMENT',
]);

export function calculateValidatedKardexMovement(
  tenantId: string,
  branchId: string,
  input: RecordStockMovementDto,
): StockMovementResult {
  if (typeof input.sku !== 'string' || input.sku.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "sku" is required.',
    );
  }
  if (!input.movementType || !VALID_MOVEMENT_TYPES.has(input.movementType)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Invalid "movementType" ("${String(input.movementType)}"); expected INBOUND, OUTBOUND_SALE, RECIPE_DEDUCTION, or ADJUSTMENT.`,
    );
  }

  const currentQty = MoneyDecimal.from(input.currentQty).assertNonNegative('currentQty');
  const delta = MoneyDecimal.from(input.quantityDelta).assertPositive('quantityDelta');
  const unitCost = MoneyDecimal.from(input.unitCost).assertNonNegative('unitCost');

  const newQty =
    input.movementType === 'INBOUND' ? currentQty.add(delta) : currentQty.sub(delta);

  if (newQty.isNegative()) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Insufficient stock for SKU "${input.sku.trim()}": currentQty (${currentQty.toFixed4()}) - delta (${delta.toFixed4()}) would result in negative stock (${newQty.toFixed4()}).`,
      {
        sku: input.sku.trim(),
        current_qty: currentQty.toFixed4(),
        requested_delta: delta.toFixed4(),
      },
    );
  }

  const totalValuation = newQty.mul(unitCost);

  return {
    tenantId,
    branchId,
    sku: input.sku.trim(),
    movementType: input.movementType,
    newQtyOnHand: newQty.toFixed4(),
    totalValuation: totalValuation.toFixed4(),
  };
}
