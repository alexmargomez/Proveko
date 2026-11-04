import {
  type MicroserviceKey,
  type ModuleKey,
  PROVEKO_ERROR_CODES,
  type ParentMicroserviceKey,
  ProvekoDomainError,
  type ProvekoJwtClaims,
  type ServiceKey,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
  resolveMicroserviceAccess,
} from '@proveko/shared-kernel';
import { TenantContextStorage, type VerifiedTenantContext } from './tenant-context.storage.js';

export type HttpMethodType = 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface DoubleKeyGuardRequest {
  authorizationHeader?: string;
  method: HttpMethodType;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Puerto de verificación criptográfica de tokens (Cumplimiento de DIP — Dependency Inversion Principle)
 */
export interface TokenVerifierPort {
  verifyAccessToken(token: string, nowEpochSeconds?: number): ProvekoJwtClaims;
}

export interface SubVerLookupPort {
  getCurrentSubVer(tenantId: string): Promise<number | null>;
}

/**
 * Purga cabeceras potencialmente inyectadas por clientes externos (Prevención de Header Spoofing [P1-05])
 */
export function sanitizeInboundTenantHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | string[] | undefined> {
  const cleaned: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (
      lower.startsWith('x-proveko-') ||
      lower.startsWith('x-tenant-') ||
      lower.startsWith('x-cell-')
    ) {
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

/**
 * Guard Zero-Trust de Doble Llave (Microservicio Padre Gatekeeper + Módulo Hijo + Modo Readonly Archive + sub_ver)
 */
export class DoubleKeyServiceGuard {
  constructor(
    private readonly jwtVerifier: TokenVerifierPort,
    private readonly subVerLookup?: SubVerLookupPort,
  ) {}

  public async verifyAndExecute<T>(
    req: DoubleKeyGuardRequest,
    targetParentInput: ServiceKey | ParentMicroserviceKey,
    targetModuleInput: MicroserviceKey | ModuleKey,
    handler: (ctx: Readonly<VerifiedTenantContext>) => Promise<T>,
  ): Promise<T> {
    if (!req.authorizationHeader || !req.authorizationHeader.startsWith('Bearer ')) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        'Missing or invalid Bearer token.',
      );
    }

    const targetParentService = normalizeParentMicroserviceKey(targetParentInput);
    const targetMicroservice = normalizeModuleKey(targetModuleInput);

    const rawToken = req.authorizationHeader.slice('Bearer '.length).trim();
    const claims = this.jwtVerifier.verifyAccessToken(rawToken);

    // 1. Verificar versión de suscripción (sub_ver) en Redis si el puerto está provisto (API Gateway)
    if (this.subVerLookup) {
      const currentSubVer = await this.subVerLookup.getCurrentSubVer(claims.tenant_id);
      if (currentSubVer !== null && claims.sub_ver < currentSubVer) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_SUB_VER_STALE,
          401,
          'Subscription capabilities updated in real-time; silent token refresh required.',
          {
            token_sub_ver: claims.sub_ver,
            current_sub_ver: currentSubVer,
          },
        );
      }
    }

    // 2. Validar Doble Llave (Microservicio Padre Gatekeeper + Módulo Hijo)
    const resolution = resolveMicroserviceAccess(claims, targetParentService, targetMicroservice);

    if (resolution.access === 'DISABLED') {
      if (resolution.reason === 'PARENT_SERVICE_DISABLED') {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_PARENT_SERVICE_DISABLED,
          403,
          `Parent microservice gatekeeper "${targetParentService}" is disabled for tenant "${claims.tenant_id}".`,
          { parent_service: targetParentService, microservice: targetMicroservice },
        );
      }

      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_MICROSERVICE_DISABLED,
        403,
        `Module "${targetMicroservice}" is not active in subscription.`,
        { parent_service: targetParentService, microservice: targetMicroservice },
      );
    }

    // 3. Si está en READONLY_ARCHIVE (reemplazado por supersedes), permitir solo GET/HEAD/OPTIONS
    const isReadMethod =
      req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS';
    if (resolution.access === 'READONLY_ARCHIVE' && !isReadMethod) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_MICROSERVICE_READONLY_ARCHIVE,
        403,
        `Module "${targetMicroservice}" is in historical READONLY_ARCHIVE mode and rejects write operations (${req.method}).`,
        {
          microservice: targetMicroservice,
          superseded_by: resolution.supersededBy ?? null,
        },
      );
    }

    // 4. Validar que active_branch_id pertenezca a allowed_branch_ids
    if (!claims.allowed_branch_ids.includes(claims.active_branch_id)) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_BRANCH_FORBIDDEN,
        403,
        `Active branch "${claims.active_branch_id}" is not authorized for user "${claims.user_id}".`,
      );
    }

    const verifiedContext: VerifiedTenantContext = {
      tenantId: claims.tenant_id,
      cellId: claims.cell_id,
      userId: claims.user_id,
      roleKey: claims.role_key,
      tier: claims.tier,
      isSandbox: claims.is_sandbox,
      activeBranchId: claims.active_branch_id,
      allowedBranchIds: claims.allowed_branch_ids,
      subVer: claims.sub_ver,
      currentService: targetParentService,
      currentMicroservice: targetMicroservice,
      isReadonlyArchive: resolution.access === 'READONLY_ARCHIVE',
      claims,
    };

    return TenantContextStorage.runWithVerifiedContext(verifiedContext, () =>
      handler(TenantContextStorage.getRequiredContext()),
    );
  }
}
