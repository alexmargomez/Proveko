/**
 * Taxonomía Oficial de 3 Niveles de Proveko:
 * - Nivel 1: Interno = Servicio (Microservicio `srv-*`) | Externo = Módulo Principal
 * - Nivel 2: Interno = Módulo (`mod-*`)                 | Externo = Submódulo (interpestaña grande)
 * - Nivel 3: Interno = Componente (`comp-*` / mini)     | Externo = Funcionalidad (independiente o dependiente de un submódulo)
 */

export type GlobalPlatformRole = 'superadmin' | 'desarrollador' | 'auxiliar' | 'cliente';

export interface SubmoduleFieldSpec {
  readonly key: string;
  readonly label: string;
  readonly type: 'text' | 'number' | 'select' | 'date';
  readonly placeholder?: string;
  readonly options?: readonly string[];
  /** Si el campo pertenece a una Funcionalidad (componente mini), solo aparece cuando esa funcionalidad está activa */
  readonly requiredFeatureKey?: string;
}

/** Nivel 3: Componente (Interno) / Funcionalidad (Externo) */
export interface MicroserviceComponentFeature {
  readonly componentKey: string;
  readonly externalName: string; // Ej: "Firma de encargado", "Seleccionar transportista"
  readonly description: string;
  readonly parentModuleKey?: string | 'independent';
  readonly parentServiceKey?: string;
  readonly includedByDefault?: boolean;
  readonly monthlyAddonUsd: number;
}

/** Nivel 2: Módulo (Interno) / Submódulo con Interpestaña (Externo) */
export interface MicroserviceSubmoduleTab {
  readonly moduleKey: string;
  readonly parentServiceKey: string;
  readonly externalSubmoduleName: string; // Ej: "Bodegas", "Solicitudes para Traslados"
  readonly tabIcon: string;
  readonly summary: string;
  readonly monthlyAddonUsd: number;
  readonly actionButtonLabel: string;
  readonly tableHeaders: readonly string[];
  readonly fields: readonly SubmoduleFieldSpec[];
  readonly hasInteractivePosCart?: boolean;
  readonly hasVisualRecipeBuilder?: boolean;
  readonly hasTruckScaleWeighbridge?: boolean;
}

/** Nivel 1: Servicio Microservicio (Interno) / Módulo Principal (Externo) */
export interface MicroserviceFrontendDefinition {
  readonly serviceKey: string;
  readonly externalPrincipalModuleName: string;
  readonly icon: string;
  readonly subtitle: string;
  readonly standaloneMonthlyUsd: number;
  readonly submodules: readonly MicroserviceSubmoduleTab[];
  readonly features: readonly MicroserviceComponentFeature[];
}

/** Tipo de Negocio: Habilita los básicos completos de ese negocio y permite sumar adicionales con costo */
export interface BusinessTypePreset {
  readonly id: string;
  readonly name: string;
  readonly badge: string;
  readonly description: string;
  readonly baseMonthlyUsd: number;
  readonly includedPrincipalServices: readonly string[];
  readonly includedSubmodules: readonly string[];
  readonly includedFeatures: readonly string[];
}

export interface ClientInternalRoleRecord {
  readonly roleId: string;
  readonly name: string;
  readonly description: string;
  readonly allowedSubmodules: readonly string[];
}

export interface ClientInternalUserRecord {
  readonly userId: string;
  readonly username: string;
  readonly fullName: string;
  readonly email: string;
  readonly internalRoleId: string;
  readonly internalRoleName: string;
  readonly passwordHint: string;
  readonly isClientAdmin: boolean;
}

export interface ClientDatabaseTenantRecord {
  readonly tenantId: string;
  readonly companyName: string;
  readonly nit: string;
  readonly businessTypeId: string;
  readonly businessTypeName: string;
  readonly dbName: string;
  readonly dbHost: string;
  readonly dbPort: number;
  readonly paymentStatus: 'STANDBY_VERIFICADO' | 'ACTIVO' | 'DEMO';
  readonly monthlyUsd: number;
  readonly adminUsername: string;
  readonly adminPasswordHint: string;
  readonly maxRolesAllowed: number;
  readonly maxUsersAllowed: number;
  readonly activePrincipalServices: readonly string[];
  readonly activeSubmodules: readonly string[];
  readonly activeFeatures: readonly string[];
  readonly internalRoles: readonly ClientInternalRoleRecord[];
  readonly internalUsers: readonly ClientInternalUserRecord[];
}
