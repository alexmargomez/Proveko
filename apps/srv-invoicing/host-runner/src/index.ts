import {
  type DoubleKeyServiceGuard,
  ParentServiceHostRunner,
} from '@proveko/service-guard';
import type { MicroserviceKey } from '@proveko/shared-kernel';
import { msInvoicingElectronicDianPlugin } from '../../ms-invoicing-electronic-dian/src/index.js';
import { msInvoicingPosPlugin } from '../../ms-invoicing-pos/src/index.js';
import { msInvoicingQuotesPlugin } from '../../ms-invoicing-quotes/src/index.js';
import { msInvoicingSimpleReceiptPlugin } from '../../ms-invoicing-simple-receipt/src/index.js';

export function createSrvInvoicingHostRunner(
  guard: DoubleKeyServiceGuard,
  enabledMicroservicesEnv?: string | ReadonlyArray<MicroserviceKey>,
  hostNodeId: string = 'host-runner:srv:invoicing',
): ParentServiceHostRunner {
  return new ParentServiceHostRunner(
    'srv:invoicing',
    guard,
    [
      msInvoicingPosPlugin,
      msInvoicingSimpleReceiptPlugin,
      msInvoicingElectronicDianPlugin,
      msInvoicingQuotesPlugin,
    ],
    enabledMicroservicesEnv,
    hostNodeId,
  );
}
