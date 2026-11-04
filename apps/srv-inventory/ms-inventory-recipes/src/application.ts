import {
  type ExplodeRecipeCostDto,
  type InventoryRecipesRepositoryPort,
  type RecipeExplosionResult,
  calculateValidatedRecipeExplosion,
} from './domain.js';

export class InventoryRecipesUseCases {
  constructor(private readonly repository: InventoryRecipesRepositoryPort) {}

  public async listRecipes(tenantId: string) {
    const recipes = await this.repository.listByTenant(tenantId);
    return {
      tenantId,
      schema: 'srv_inventory',
      table: 'rec_headers',
      recipes,
    };
  }

  public async explodeRecipeCost(
    tenantId: string,
    dto: ExplodeRecipeCostDto,
  ): Promise<RecipeExplosionResult> {
    const result = calculateValidatedRecipeExplosion(tenantId, dto);
    return this.repository.saveRecipeExplosion(result);
  }
}
