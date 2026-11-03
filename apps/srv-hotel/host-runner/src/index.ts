import {
  type DoubleKeyServiceGuard,
  ParentServiceHostRunner,
} from '@proveko/service-guard';
import type { MicroserviceKey } from '@proveko/shared-kernel';
import { msHotelBookingsPlugin } from '../../ms-hotel-bookings/src/index.js';
import { msHotelFrontdeskPlugin } from '../../ms-hotel-frontdesk/src/index.js';
import { msHotelRoomsPlugin } from '../../ms-hotel-rooms/src/index.js';

export function createSrvHotelHostRunner(
  guard: DoubleKeyServiceGuard,
  enabledMicroservicesEnv?: string | ReadonlyArray<MicroserviceKey>,
  hostNodeId: string = 'host-runner:srv:hotel',
): ParentServiceHostRunner {
  return new ParentServiceHostRunner(
    'srv:hotel',
    guard,
    [msHotelRoomsPlugin, msHotelBookingsPlugin, msHotelFrontdeskPlugin],
    enabledMicroservicesEnv,
    hostNodeId,
  );
}
