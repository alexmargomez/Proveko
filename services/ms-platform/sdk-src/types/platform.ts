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
  status: string;
  activeServices: string[];
  activeModules: string[];
  activeSubmodules?: string[];
  activeFeatures: string[];
  createdAt: string;
}
