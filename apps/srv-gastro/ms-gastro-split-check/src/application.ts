import {
  type GastroSplitCheckRepositoryPort,
  type SplitCheckBySeatsDto,
  type SplitCheckResult,
  calculateValidatedSplitCheck,
} from './domain.js';

export class GastroSplitCheckUseCases {
  constructor(private readonly repository: GastroSplitCheckRepositoryPort) {}

  public async splitBySeats(
    tenantId: string,
    branchId: string,
    dto: SplitCheckBySeatsDto,
  ): Promise<SplitCheckResult> {
    const result = calculateValidatedSplitCheck(tenantId, branchId, dto);
    return this.repository.saveSplitCheck(result);
  }
}
