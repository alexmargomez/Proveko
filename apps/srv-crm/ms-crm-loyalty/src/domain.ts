import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface AccrueLoyaltyDto {
  contactId: string;
  invoiceAmount: string;
}

export interface LoyaltyAccrualResult {
  tenantId: string;
  contactId: string;
  pointsEarned: string;
  newPointsBalance: string;
}

export interface LoyaltyWalletRecord {
  tenantId: string;
  contactId: string;
  tierLevel: 'SILVER' | 'GOLD' | 'PLATINUM';
  pointsBalance: string;
}

/**
 * Estrategia de acumulación de puntos (SOLID OCP + DIP)
 */
export interface LoyaltyAccrualPolicyPort {
  calculatePoints(invoiceAmount: MoneyDecimal): MoneyDecimal;
}

export class DefaultPercentLoyaltyAccrualPolicy implements LoyaltyAccrualPolicyPort {
  constructor(private readonly ratePercent: string = '5.00') {}

  public calculatePoints(invoiceAmount: MoneyDecimal): MoneyDecimal {
    return invoiceAmount.applyTaxRatePercent(this.ratePercent);
  }
}

/**
 * Puerto de Repositorio de Billeteras de Fidelización (SOLID DIP)
 */
export interface CrmLoyaltyRepositoryPort {
  listByTenant(tenantId: string): Promise<LoyaltyWalletRecord[]>;
  accruePoints(
    tenantId: string,
    contactId: string,
    pointsDelta: MoneyDecimal,
  ): Promise<LoyaltyWalletRecord>;
}

export function validateAccrueLoyaltyInput(
  input: AccrueLoyaltyDto,
  policy: LoyaltyAccrualPolicyPort,
): { contactId: string; pointsEarned: MoneyDecimal } {
  if (typeof input.contactId !== 'string' || input.contactId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "contactId" is required.',
    );
  }
  const invoiceAmount = MoneyDecimal.from(input.invoiceAmount).assertPositive('invoiceAmount');
  const pointsEarned = policy.calculatePoints(invoiceAmount);
  return {
    contactId: input.contactId.trim(),
    pointsEarned,
  };
}
