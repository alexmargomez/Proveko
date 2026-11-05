import {
  type ApplyArApPaymentDto,
  type ArApPaymentResult,
  type FinanceArApRepositoryPort,
  calculateValidatedArApPayment,
} from './domain.js';

export class FinanceArApUseCases {
  constructor(private readonly repository: FinanceArApRepositoryPort) {}

  public async applyPayment(
    tenantId: string,
    branchId: string,
    dto: ApplyArApPaymentDto,
  ): Promise<ArApPaymentResult> {
    const result = calculateValidatedArApPayment(tenantId, branchId, dto);
    return this.repository.savePaymentApplication(result);
  }

  public async listLedgers(
    tenantId: string,
    branchId: string,
  ): Promise<ArApPaymentResult[]> {
    if (!this.repository.listByTenantAndBranch) {
      return [];
    }
    return this.repository.listByTenantAndBranch(tenantId, branchId);
  }
}
