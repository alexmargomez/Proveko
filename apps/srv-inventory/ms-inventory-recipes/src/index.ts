import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvInventorySchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_inventory` — Prefijo obligatorio `rec_` (`ms:inventory-recipes`)
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

export interface RecipeIngredientInput {
  ingredientSku: string;
  quantityRequired: string;
  unitCost: string;
}

export const msInventoryRecipesPlugin = defineProvekoMicroservice({
  parentService: 'srv:inventory',
  microserviceKey: 'ms:inventory-recipes',
  tablePrefix: 'rec_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/recipes',
      description: 'Listar recetas y escandallos BOM',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        schema: 'srv_inventory',
        table: 'rec_headers',
        recipes: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/recipes/explode-cost',
      description: 'Calcular costo de escandallo y explosión de insumos BOM por cantidad vendida',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as {
          finishedProductSku: string;
          soldQuantity: string;
          ingredients: RecipeIngredientInput[];
        };
        const soldQty = MoneyDecimal.from(body.soldQuantity);
        let totalRecipeCost = MoneyDecimal.zero();

        const deductions = (body.ingredients ?? []).map((ing) => {
          const totalIngredientQty = MoneyDecimal.from(ing.quantityRequired).mul(soldQty);
          const lineCost = totalIngredientQty.mul(MoneyDecimal.from(ing.unitCost));
          totalRecipeCost = totalRecipeCost.add(lineCost);
          return {
            ingredientSku: ing.ingredientSku,
            deductedQuantity: totalIngredientQty.toFixed4(),
            lineCost: lineCost.toFixed4(),
          };
        });

        return {
          tenantId: ctx.tenantId,
          finishedProductSku: body.finishedProductSku,
          soldQuantity: soldQty.toFixed4(),
          totalRecipeCost: totalRecipeCost.toFixed4(),
          deductions,
        };
      },
    },
  ],
});

export function createStandaloneInventoryRecipesServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msInventoryRecipesPlugin, guard, serverNodeId);
}
