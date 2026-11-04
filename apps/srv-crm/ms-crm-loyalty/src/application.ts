import {
  type AccrueLoyaltyDto,
  type CrmLoyaltyRepositoryPort,
  DefaultPercentLoyaltyAccrualPolicy,
  type LoyaltyAccrualPolicyPort,
  type LoyaltyAccrualResult,
  validateAccrueLoyaltyInput,
} from './domain.js';

export class CrmLoyaltyUseCases {
  constructor(
    private readonly repository: CrmLoyaltyRepositoryPort,
    private readonly accrualPolicy: LoyaltyAccrualPolicyPort = new DefaultPercentLoyaltyAccrualPolicy(),
  ) {}

  public async listWallets(tenantId: string) {
    const wallets = await this.repository.listByTenant(tenantId);
    return {
      tenantId,
      schema: 'srv_crm',
      table: 'loy_wallets',
      wallets,
    };
  }

  public async accruePoints(
    tenantId: string,
    dto: AccrueLoyaltyDto,
  ): Promise<LoyaltyAccrualResult> {
    const { contactId, pointsEarned } = validateAccrueLoyaltyInput(dto, this.accrualPolicy);
    const updated = await this.repository.accruePoints(tenantId, contactId, pointsEarned);
    return {
      tenantId,
      contactId,
      pointsEarned: pointsEarned.toFixed4(),
      newPointsBalance: updated.pointsBalance,
    };
  }
}
