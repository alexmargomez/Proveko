import {
  type GastroSplitCheckRepositoryPort,
  type SplitCheckBySeatsDto,
  type SplitCheckResult,
  calculateValidatedSplitCheck,
} from './domain.js';

export class GastroSplitCheckUseCases {
  constructor(private readonly repository: GastroSplitCheckRepositoryPort) {}

  public async listSplitChecks(tenantId: string, branchId: string) {
    const checks = this.repository.listByTenantAndBranch
      ? await this.repository.listByTenantAndBranch(tenantId, branchId)
      : [];
    return {
      tenantId,
      branchId,
      schema: 'srv_gastro',
      table: 'spl_split_bills',
      checks,
    };
  }

  public async splitBySeats(
    tenantId: string,
    branchId: string,
    dto: SplitCheckBySeatsDto,
  ): Promise<SplitCheckResult> {
    const result = calculateValidatedSplitCheck(tenantId, branchId, dto);
    return this.repository.saveSplitCheck(result);
  }
}
