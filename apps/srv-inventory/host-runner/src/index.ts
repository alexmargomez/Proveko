import {
  type DoubleKeyServiceGuard,
  ParentServiceHostRunner,
} from '@proveko/service-guard';
import type { MicroserviceKey } from '@proveko/shared-kernel';
import { msInventoryLotsPlugin } from '../../ms-inventory-lots/src/index.js';
import { msInventoryRecipesPlugin } from '../../ms-inventory-recipes/src/index.js';
import { msInventoryStockPlugin } from '../../ms-inventory-stock/src/index.js';
import { msInventoryTransfersPlugin } from '../../ms-inventory-transfers/src/index.js';

export function createSrvInventoryHostRunner(
  guard: DoubleKeyServiceGuard,
  enabledMicroservicesEnv?: string | ReadonlyArray<MicroserviceKey>,
  hostNodeId: string = 'host-runner:srv:inventory',
): ParentServiceHostRunner {
  return new ParentServiceHostRunner(
    'srv:inventory',
    guard,
    [
      msInventoryStockPlugin,
      msInventoryRecipesPlugin,
      msInventoryLotsPlugin,
      msInventoryTransfersPlugin,
    ],
    enabledMicroservicesEnv,
    hostNodeId,
  );
}
