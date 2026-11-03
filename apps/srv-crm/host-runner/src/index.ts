import {
  type DoubleKeyServiceGuard,
  ParentServiceHostRunner,
} from '@proveko/service-guard';
import type { MicroserviceKey } from '@proveko/shared-kernel';
import { msCrmDirectoryPlugin } from '../../ms-crm-directory/src/index.js';
import { msCrmLoyaltyPlugin } from '../../ms-crm-loyalty/src/index.js';
import { msCrmPipelinesPlugin } from '../../ms-crm-pipelines/src/index.js';

export function createSrvCrmHostRunner(
  guard: DoubleKeyServiceGuard,
  enabledMicroservicesEnv?: string | ReadonlyArray<MicroserviceKey>,
  hostNodeId: string = 'host-runner:srv:crm',
): ParentServiceHostRunner {
  return new ParentServiceHostRunner(
    'srv:crm',
    guard,
    [msCrmDirectoryPlugin, msCrmPipelinesPlugin, msCrmLoyaltyPlugin],
    enabledMicroservicesEnv,
    hostNodeId,
  );
}
