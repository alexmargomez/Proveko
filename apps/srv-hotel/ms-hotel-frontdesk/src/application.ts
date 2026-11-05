import {
  type HotelFrontdeskRepositoryPort,
  type PostFolioChargeDto,
  type RoomFolioBalanceRecord,
  calculateValidatedFolioCharge,
} from './domain.js';

export class HotelFrontdeskUseCases {
  constructor(private readonly repository: HotelFrontdeskRepositoryPort) {}

  public async postFolioCharge(
    tenantId: string,
    branchId: string,
    dto: PostFolioChargeDto,
  ): Promise<RoomFolioBalanceRecord> {
    const record = calculateValidatedFolioCharge(tenantId, branchId, dto);
    return this.repository.saveFolioBalance(record);
  }

  public async listFolios(
    tenantId: string,
    branchId: string,
  ): Promise<RoomFolioBalanceRecord[]> {
    if (!this.repository.listByTenantAndBranch) {
      return [];
    }
    return this.repository.listByTenantAndBranch(tenantId, branchId);
  }
}
