import {
  type DoubleKeyServiceGuard,
  ParentServiceHostRunner,
} from '@proveko/service-guard';
import type { MicroserviceKey } from '@proveko/shared-kernel';
import { msFinanceAccountingPucPlugin } from '../../ms-finance-accounting-puc/src/index.js';
import { msFinanceArApPlugin } from '../../ms-finance-ar-ap/src/index.js';
import { msFinanceCashbookPlugin } from '../../ms-finance-cashbook/src/index.js';

export function createSrvFinanceHostRunner(
  guard: DoubleKeyServiceGuard,
  enabledMicroservicesEnv?: string | ReadonlyArray<MicroserviceKey>,
  hostNodeId: string = 'host-runner:srv:finance',
): ParentServiceHostRunner {
  return new ParentServiceHostRunner(
    'srv:finance',
    guard,
    [msFinanceCashbookPlugin, msFinanceArApPlugin, msFinanceAccountingPucPlugin],
    enabledMicroservicesEnv,
    hostNodeId,
  );
}
