import { Ed25519JwtVault, type EncryptedConnectionEnvelope } from '@proveko/crypto-vault';
import { PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';
import { buildJwtCapabilitiesProjection } from '../../domain/entities/core-entities.js';
import type {
  SubscriptionCatalogRepositoryPort,
  TenantRepositoryPort,
  UserRepositoryPort,
} from '../../domain/ports/repositories.port.js';
import type { PasswordHasherPort, TenantStateCachePort } from '../ports/outbound.ports.js';

export class AuthAndRoutingUseCases {
  constructor(
    private readonly tenantRepo: TenantRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly catalogRepo: SubscriptionCatalogRepositoryPort,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly jwtVault: Ed25519JwtVault,
    private readonly stateCache: TenantStateCachePort,
  ) {}

  public async login(
    tenantId: string,
    email: string,
    passwordPlain: string,
    requestedBranchId?: string,
  ): Promise<{ accessToken: string; subVer: number }> {
    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        'Invalid credentials or inactive tenant.',
      );
    }

    const user = await this.userRepo.findByEmailAndTenant(email, tenantId);
    if (!user || !user.isActive) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        'Invalid credentials.',
      );
    }

    const validPassword = await this.passwordHasher.verifyPassword(
      passwordPlain,
      user.passwordHash,
    );
    if (!validPassword) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        'Invalid credentials.',
      );
    }

    const activeBranchId = requestedBranchId ?? user.defaultBranchId;
    if (!user.allowedBranchIds.includes(activeBranchId)) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_BRANCH_FORBIDDEN,
        403,
        `User is not authorized for branch "${activeBranchId}".`,
      );
    }

    const parentSubs = await this.catalogRepo.findParentServicesByTenant(tenantId);
    const msSubs = await this.catalogRepo.findMicroservicesByTenant(tenantId);
    const projection = buildJwtCapabilitiesProjection(parentSubs, msSubs);

    const accessToken = this.jwtVault.signAccessToken({
      tenant_id: tenant.id,
      cell_id: tenant.cellId,
      user_id: user.id,
      role_key: user.roleKey,
      tier: tenant.tier,
      is_sandbox: tenant.isSandbox,
      active_branch_id: activeBranchId,
      allowed_branch_ids: user.allowedBranchIds,
      sub_ver: tenant.subVer,
      services: projection.services,
      readonly_microservices: projection.readonlyMicroservices,
    });

    return { accessToken, subVer: tenant.subVer };
  }

  /**
   * Refresca silenciosamente el JWT cuando el Frontend recibe `ERR_SUB_VER_STALE` [P3-01]
   */
  public async refreshCapabilitiesToken(currentValidToken: string): Promise<{
    accessToken: string;
    subVer: number;
  }> {
    const claims = this.jwtVault.verifyAccessToken(currentValidToken);
    const tenant = await this.tenantRepo.findById(claims.tenant_id);
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        'Tenant is no longer active.',
      );
    }

    const parentSubs = await this.catalogRepo.findParentServicesByTenant(tenant.id);
    const msSubs = await this.catalogRepo.findMicroservicesByTenant(tenant.id);
    const projection = buildJwtCapabilitiesProjection(parentSubs, msSubs);

    const accessToken = this.jwtVault.signAccessToken({
      tenant_id: tenant.id,
      cell_id: tenant.cellId,
      user_id: claims.user_id,
      role_key: claims.role_key,
      tier: tenant.tier,
      is_sandbox: tenant.isSandbox,
      active_branch_id: claims.active_branch_id,
      allowed_branch_ids: claims.allowed_branch_ids,
      sub_ver: tenant.subVer,
      services: projection.services,
      readonly_microservices: projection.readonlyMicroservices,
    });

    return { accessToken, subVer: tenant.subVer };
  }

  /**
   * Resuelve y devuelve únicamente el sobre cifrado (`EncryptedConnectionEnvelope`) para `@proveko/tenant-db-resolver` [P1-03]
   */
  public async resolveEncryptedConnectionEnvelope(
    tenantId: string,
  ): Promise<EncryptedConnectionEnvelope> {
    const cached = await this.stateCache.getCachedEncryptedEnvelope(tenantId);
    if (cached) {
      return cached;
    }

    const tenant = await this.tenantRepo.findById(tenantId);
    if (!tenant) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
        404,
        `Tenant "${tenantId}" not found in Tenant Catalog.`,
      );
    }

    await this.stateCache.cacheEncryptedEnvelope(
      tenantId,
      tenant.encryptedConnectionEnvelope,
    );
    return tenant.encryptedConnectionEnvelope;
  }
}
