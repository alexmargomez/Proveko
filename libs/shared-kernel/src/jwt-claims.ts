import {
  type MicroserviceKey,
  type ModuleKey,
  type ParentMicroserviceKey,
  SEED_MICROSERVICES_CATALOG,
  type ServiceKey,
  type TenantTier,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
} from './catalog.types.js';

export type ActiveServicesTree = Partial<Record<ServiceKey, MicroserviceKey[]>>;

export interface ProvekoJwtClaims {
  iss: string;
  aud: string;
  jti: string;
  iat: number;
  exp: number;
  tenant_id: string;
  cell_id: string;
  user_id: string;
  role_key: string;
  tier: TenantTier;
  is_sandbox: boolean;
  active_branch_id: string;
  allowed_branch_ids: string[];
  sub_ver: number;
  services: ActiveServicesTree;
  readonly_microservices: MicroserviceKey[];
}

export type ResolvedCapabilityAccess =
  | {
      access: 'ACTIVE';
      canRead: true;
      canWrite: true;
      supersededBy?: undefined;
    }
  | {
      access: 'READONLY_ARCHIVE';
      canRead: true;
      canWrite: false;
      supersededBy?: MicroserviceKey;
    }
  | {
      access: 'DISABLED';
      canRead: false;
      canWrite: false;
      reason: 'PARENT_SERVICE_DISABLED' | 'MICROSERVICE_DISABLED';
    };

/**
 * Evaluador determinista compartido entre API Gateway, @proveko/service-guard y @proveko/ui-kit
 * Valida la Regla de Doble Llave (Microservicio Padre Contenedor + Módulo Hijo o Modo Readonly Archive)
 */
export function resolveMicroserviceAccess(
  claims: Pick<ProvekoJwtClaims, 'services' | 'readonly_microservices'>,
  parentMicroserviceInput: ServiceKey | ParentMicroserviceKey,
  moduleInput: MicroserviceKey | ModuleKey,
): ResolvedCapabilityAccess {
  const parentService = normalizeParentMicroserviceKey(parentMicroserviceInput);
  const microservice = normalizeModuleKey(moduleInput);

  const activeChildren = claims.services[parentService];
  if (!activeChildren) {
    // Incluso si estaba en readonly_microservices, si el Microservicio Padre se apaga cae todo en cascada
    return {
      access: 'DISABLED',
      canRead: false,
      canWrite: false,
      reason: 'PARENT_SERVICE_DISABLED',
    };
  }

  if (activeChildren.includes(microservice)) {
    return {
      access: 'ACTIVE',
      canRead: true,
      canWrite: true,
    };
  }

  if (claims.readonly_microservices.includes(microservice)) {
    // Buscar cuál módulo activo del mismo padre lo reemplazó (supersedes)
    const replacer = SEED_MICROSERVICES_CATALOG.find(
      (def) =>
        def.parentService === parentService &&
        def.supersedes.includes(microservice) &&
        activeChildren.includes(def.key),
    );

    return {
      access: 'READONLY_ARCHIVE',
      canRead: true,
      canWrite: false,
      supersededBy: replacer?.key,
    };
  }

  return {
    access: 'DISABLED',
    canRead: false,
    canWrite: false,
    reason: 'MICROSERVICE_DISABLED',
  };
}

export const resolveModuleAccess = resolveMicroserviceAccess;
