import type { MicroserviceKey } from '@proveko/shared-kernel';
import {
  type InvoicingPosRepositoryPort,
  type PosCheckoutDto,
  type PosSaleTicketResult,
  calculateValidatedPosCheckout,
} from './domain.js';

export class InvoicingPosUseCases {
  constructor(private readonly repository: InvoicingPosRepositoryPort) {}

  public async listShifts(tenantId: string, branchId: string) {
    const shifts = await this.repository.listShiftsByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: 'srv_invoicing',
      table: 'pos_cash_shifts',
      shifts,
    };
  }

  public async checkout(
    tenantId: string,
    branchId: string,
    activeInvoicingChildren: readonly MicroserviceKey[],
    dto: PosCheckoutDto,
  ): Promise<PosSaleTicketResult> {
    const ticket = calculateValidatedPosCheckout(
      tenantId,
      branchId,
      activeInvoicingChildren,
      dto,
    );
    return this.repository.saveSaleTicket(ticket);
  }
}
