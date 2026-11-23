export interface ModuleManifest {
  moduleKey: string;
  displayName: string;
  tabIcon: string;
  defaultActive: boolean;
  summary: string;
}

export interface SubmoduleManifest {
  submoduleKey: string;
  displayName: string;
  dependsOnModule: string;
  defaultActive: boolean;
  summary?: string;
}

export interface FeatureManifest {
  featureKey: string;
  displayName: string;
  dependsOnModule: string;
  dependsOnSubmodule?: string;
  defaultActive: boolean;
}

export interface ServiceManifest {
  serviceKey: string;
  displayName: string;
  icon: string;
  apiPrefix: string;
  uiBundlePath: string;
  bundleHash?: string;
  capabilities?: string[];
  category: string;
  summary: string;
  modules: ModuleManifest[];
  submodules?: SubmoduleManifest[];
  features?: FeatureManifest[];
}

export interface TenantSummary {
  id?: string;
  tenantId: string;
  companyName: string;
  nit: string;
  adminUsername: string;
  dbName: string;
  businessPreset: string;
  paymentStatus?: string;
  monthlyCop?: number;
  maxUsersAllowed?: number;
  isDemo?: boolean;
  status: string;
  activeServices: string[];
  activeModules: string[];
  activeSubmodules?: string[];
  activeFeatures: string[];
  createdAt: string;
}

export interface BusinessPresetSpec {
  key: string;
  name: string;
  badge: string;
  description: string;
  baseMonthlyCop: number;
  includedServices: string[];
}

export interface PricingMatrixCOP {
  extraServiceCop: number;
  extraModuleCop: number;
  extraSubmoduleCop: number;
  extraFeatureCop: number;
}

export interface RoleTemplateSpec {
  roleKey: string;
  displayName: string;
  description: string;
  isCompanyAdmin: boolean;
  recommendedServices: string[];
  recommendedModules: string[];
}

export interface UserProfileSummary {
  userId: string;
  username: string;
  fullName: string;
  internalRole: string;
  isCompanyAdmin: boolean;
  isDemo: boolean;
}

export interface TenantUserRecord {
  userId: string;
  tenantId: string;
  username: string;
  email: string;
  fullName: string;
  internalRole: string;
  isCompanyAdmin: boolean;
  allowedServices: string[];
  allowedModules: string[];
  status: string;
  createdAt: string;
}

export interface ModuleActivationRecord {
  requestId: string;
  tenantId: string;
  companyName: string;
  requestedBy: string;
  addedServices: string[];
  addedModules: string[];
  addedSubmodules: string[];
  addedFeatures: string[];
  monthlyCopAfter: number;
  status: string;
  createdAt: string;
}
