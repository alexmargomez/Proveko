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
 * Puerto de Dominio para el Limitador de Tasa (SOLID DIP + OCP)
 */
export interface RateLimiterPort {
  checkOrThrow(subjectKey: string, tier?: TenantTier): void;
}

export interface TenantTierRateLimiterOptions {
  maxTrackedSubjects?: number;
  bucketTtlMs?: number;
}

/**
 * Limitador de tasa Token-Bucket por Inquilino (Tenant Tier) o IP con Capacidad LRU Acotada (Anti-OOM)
 */
export class TenantTierRateLimiter implements RateLimiterPort {
  private readonly buckets = new Map<string, BucketState>();
  private readonly maxTrackedSubjects: number;
  private readonly bucketTtlMs: number;

  constructor(options: TenantTierRateLimiterOptions = {}) {
    this.maxTrackedSubjects = options.maxTrackedSubjects ?? 10_000;
    this.bucketTtlMs = options.bucketTtlMs ?? 3_600_000;
  }

  public getTrackedSubjectsCount(): number {
    return this.buckets.size;
  }

  public checkOrThrow(subjectKey: string, tier: TenantTier = 'basic'): void {
    const config = TIER_RATE_LIMITS[tier] ?? TIER_RATE_LIMITS.basic;
    const now = Date.now();
    const existing = this.buckets.get(subjectKey);

    if (!existing || now - existing.lastRefillMs > this.bucketTtlMs) {
      if (existing) {
        this.buckets.delete(subjectKey);
      }
      while (this.buckets.size >= this.maxTrackedSubjects) {
        const oldestKey = this.buckets.keys().next().value;
        if (!oldestKey) break;
        this.buckets.delete(oldestKey);
      }
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

    // Reinsertar al final del Map para mantener orden LRU
    this.buckets.delete(subjectKey);
    this.buckets.set(subjectKey, {
      tokens: refilled - 1,
      lastRefillMs: now,
    });
  }
}

