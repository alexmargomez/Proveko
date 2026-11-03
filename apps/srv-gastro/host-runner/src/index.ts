import {
  type DoubleKeyServiceGuard,
  ParentServiceHostRunner,
} from '@proveko/service-guard';
import type { MicroserviceKey } from '@proveko/shared-kernel';
import { msGastroKdsPlugin } from '../../ms-gastro-kds/src/index.js';
import { msGastroSplitCheckPlugin } from '../../ms-gastro-split-check/src/index.js';
import { msGastroTablesPlugin } from '../../ms-gastro-tables/src/index.js';

export function createSrvGastroHostRunner(
  guard: DoubleKeyServiceGuard,
  enabledMicroservicesEnv?: string | ReadonlyArray<MicroserviceKey>,
  hostNodeId: string = 'host-runner:srv:gastro',
): ParentServiceHostRunner {
  return new ParentServiceHostRunner(
    'srv:gastro',
    guard,
    [msGastroTablesPlugin, msGastroKdsPlugin, msGastroSplitCheckPlugin],
    enabledMicroservicesEnv,
    hostNodeId,
  );
}
