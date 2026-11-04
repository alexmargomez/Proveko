import { srvInventorySchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { InventoryRecipesRepositoryPort, RecipeExplosionResult } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_inventory` — Prefijo obligatorio `rec_` (`mod:inventory-recipes` / `ms:inventory-recipes`)
 */
export const recHeadersTable = srvInventorySchema.table('rec_headers', {
  id: uuid('id').primaryKey().defaultRandom(),
  finishedProductSku: varchar('finished_product_sku', { length: 64 }).notNull().unique(),
  yieldQuantity: numeric('yield_quantity', { precision: 19, scale: 4 }).notNull().default('1.0000'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const recBomIngredientsTable = srvInventorySchema.table('rec_bom_ingredients', {
  id: uuid('id').primaryKey().defaultRandom(),
  recipeId: uuid('recipe_id').notNull(),
  ingredientSku: varchar('ingredient_sku', { length: 64 }).notNull(),
  quantityRequired: numeric('quantity_required', { precision: 19, scale: 4 }).notNull(),
  unitCostSnapshot: numeric('unit_cost_snapshot', { precision: 19, scale: 4 }).notNull(),
});

export class InMemoryInventoryRecipesRepositoryAdapter implements InventoryRecipesRepositoryPort {
  private readonly store = new Map<string, RecipeExplosionResult[]>();

  public async listByTenant(tenantId: string): Promise<RecipeExplosionResult[]> {
    return [...(this.store.get(tenantId) ?? [])];
  }

  public async saveRecipeExplosion(record: RecipeExplosionResult): Promise<RecipeExplosionResult> {
    const list = this.store.get(record.tenantId) ?? [];
    list.push(record);
    this.store.set(record.tenantId, list);
    return record;
  }
}
