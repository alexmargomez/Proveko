import {
  type FinanceAccountingPucRepositoryPort,
  type PostPucJournalVoucherDto,
  type PucJournalVoucherResult,
  validateAndBalancePucJournalVoucher,
} from './domain.js';

export class FinanceAccountingPucUseCases {
  constructor(private readonly repository: FinanceAccountingPucRepositoryPort) {}

  public async postJournalVoucher(
    tenantId: string,
    branchId: string,
    dto: PostPucJournalVoucherDto,
  ): Promise<PucJournalVoucherResult> {
    const voucher = validateAndBalancePucJournalVoucher(tenantId, branchId, dto);
    return this.repository.saveJournalVoucher(voucher);
  }

  public async listVouchers(
    tenantId: string,
    branchId: string,
  ): Promise<PucJournalVoucherResult[]> {
    if (!this.repository.listByTenantAndBranch) {
      return [];
    }
    return this.repository.listByTenantAndBranch(tenantId, branchId);
  }
}
