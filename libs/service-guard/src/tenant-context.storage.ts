import { AsyncLocalStorage } from 'node:async_hooks';
import {
  type MicroserviceKey,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  type ProvekoJwtClaims,
  type ServiceKey,
} from '@proveko/shared-kernel';

export interface VerifiedTenantContext {
  readonly tenantId: string;
  readonly cellId: string;
  readonly userId: string;
  readonly roleKey: string;
  readonly tier: ProvekoJwtClaims['tier'];
  readonly isSandbox: boolean;
  readonly activeBranchId: string;
  readonly allowedBranchIds: readonly string[];
  readonly subVer: number;
  readonly currentService: ServiceKey;
  readonly currentMicroservice: MicroserviceKey;
  readonly isReadonlyArchive: boolean;
  readonly claims: Readonly<ProvekoJwtClaims>;
}

const tenantContextAls = new AsyncLocalStorage<Readonly<VerifiedTenantContext>>();

export class TenantContextStorage {
  public static runWithVerifiedContext<T>(
    context: VerifiedTenantContext,
    fn: () => T,
  ): T {
    const frozenContext = Object.freeze({
      ...context,
      allowedBranchIds: Object.freeze([...context.allowedBranchIds]),
      claims: Object.freeze({ ...context.claims }),
    });
    return tenantContextAls.run(frozenContext, fn);
  }

  public static getRequiredContext(): Readonly<VerifiedTenantContext> {
    const ctx = tenantContextAls.getStore();
    if (!ctx) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        'Zero-Trust violation: Attempted to access tenant database without a cryptographically verified TenantContext in AsyncLocalStorage.',
      );
    }
    return ctx;
  }

  public static getOptionalContext(): Readonly<VerifiedTenantContext> | undefined {
    return tenantContextAls.getStore();
  }
}
