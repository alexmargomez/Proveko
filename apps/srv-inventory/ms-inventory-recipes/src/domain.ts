import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface RecipeIngredientInput {
  ingredientSku: string;
  quantityRequired: string;
  unitCost: string;
}

export interface ExplodeRecipeCostDto {
  finishedProductSku: string;
  soldQuantity: string;
  ingredients: RecipeIngredientInput[];
}

export interface RecipeExplosionResult {
  tenantId: string;
  finishedProductSku: string;
  soldQuantity: string;
  totalRecipeCost: string;
  deductions: Array<{
    ingredientSku: string;
    deductedQuantity: string;
    lineCost: string;
  }>;
}

/**
 * Puerto de Repositorio de Recetas y Escandallos BOM (SOLID DIP)
 */
export interface InventoryRecipesRepositoryPort {
  listByTenant(tenantId: string): Promise<RecipeExplosionResult[]>;
  saveRecipeExplosion(record: RecipeExplosionResult): Promise<RecipeExplosionResult>;
}

export function calculateValidatedRecipeExplosion(
  tenantId: string,
  input: ExplodeRecipeCostDto,
): RecipeExplosionResult {
  if (typeof input.finishedProductSku !== 'string' || input.finishedProductSku.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "finishedProductSku" is required.',
    );
  }
  if (!Array.isArray(input.ingredients) || input.ingredients.length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Recipe "ingredients" must be a non-empty array.',
    );
  }

  const soldQty = MoneyDecimal.from(input.soldQuantity).assertPositive('soldQuantity');
  let totalRecipeCost = MoneyDecimal.zero();

  const deductions = input.ingredients.map((ing, idx) => {
    if (typeof ing.ingredientSku !== 'string' || ing.ingredientSku.trim().length === 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `Ingredient at index ${idx} is missing "ingredientSku".`,
      );
    }
    const qtyRequired = MoneyDecimal.from(ing.quantityRequired).assertPositive(
      `ingredients[${idx}].quantityRequired`,
    );
    const unitCost = MoneyDecimal.from(ing.unitCost).assertNonNegative(
      `ingredients[${idx}].unitCost`,
    );
    const totalIngredientQty = qtyRequired.mul(soldQty);
    const lineCost = totalIngredientQty.mul(unitCost);
    totalRecipeCost = totalRecipeCost.add(lineCost);

    return {
      ingredientSku: ing.ingredientSku.trim(),
      deductedQuantity: totalIngredientQty.toFixed4(),
      lineCost: lineCost.toFixed4(),
    };
  });

  return {
    tenantId,
    finishedProductSku: input.finishedProductSku.trim(),
    soldQuantity: soldQty.toFixed4(),
    totalRecipeCost: totalRecipeCost.toFixed4(),
    deductions,
  };
}
