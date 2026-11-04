import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { InventoryRecipesUseCases } from './application.js';
import type { ExplodeRecipeCostDto, InventoryRecipesRepositoryPort } from './domain.js';
import { InMemoryInventoryRecipesRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildInventoryRecipesPlugin(
  repository: InventoryRecipesRepositoryPort = new InMemoryInventoryRecipesRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new InventoryRecipesUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:inventory',
    microserviceKey: 'ms:inventory-recipes',
    tablePrefix: 'rec_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/recipes',
        description: 'Listar recetas y escandallos BOM',
        handler: async (ctx) => useCases.listRecipes(ctx.tenantId),
      },
      {
        method: 'POST',
        subPath: '/recipes/explode-cost',
        description: 'Calcular costo de escandallo y explosión de insumos BOM por cantidad vendida',
        handler: async (ctx, req) =>
          useCases.explodeRecipeCost(ctx.tenantId, (req.body ?? {}) as ExplodeRecipeCostDto),
      },
    ],
  });
}

export const msInventoryRecipesPlugin = buildInventoryRecipesPlugin();

export function createStandaloneInventoryRecipesServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: InventoryRecipesRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildInventoryRecipesPlugin(repository) : msInventoryRecipesPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

