import { PROVEKO_ERROR_CODES, ProvekoDomainError, type TenantTier } from '@proveko/shared-kernel';

interface BucketState {
  tokens: number;
  lastRefillMs: number;
}

const TIER_RATE_LIMITS: Record<TenantTier, { maxTokens: number; refillPerSec: number }> = {
  sandbox_ephemeral: { maxTokens: 30, refillPerSec: 5 },
  basic: { maxTokens: 120, refillPerSec: 20 },
  business: { maxTokens: 300, refillPerSec: 50 },
  enterprise: { maxTokens: 1000, refillPerSec: 200 },
};

/**
 * Limitador de tasa Token-Bucket por Inquilino (Tenant Tier) o IP para proteger Celdas y Microservicios
 */
export class TenantTierRateLimiter {
  private readonly buckets = new Map<string, BucketState>();

  public checkOrThrow(subjectKey: string, tier: TenantTier = 'basic'): void {
    const config = TIER_RATE_LIMITS[tier];
    const now = Date.now();
    const existing = this.buckets.get(subjectKey);

    if (!existing) {
      this.buckets.set(subjectKey, {
        tokens: config.maxTokens - 1,
        lastRefillMs: now,
      });
      return;
    }

    const elapsedSec = Math.max(0, (now - existing.lastRefillMs) / 1000);
    const refilled = Math.min(
      config.maxTokens,
      existing.tokens + elapsedSec * config.refillPerSec,
    );

    if (refilled < 1) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_RATE_LIMIT_EXCEEDED,
        429,
        `Rate limit exceeded for subject "${subjectKey}" (tier: ${tier}).`,
        { subject: subjectKey, tier },
      );
    }

    existing.tokens = refilled - 1;
    existing.lastRefillMs = now;
  }
}
