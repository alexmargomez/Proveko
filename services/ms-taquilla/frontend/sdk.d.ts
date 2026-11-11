declare module '@platform/ui-sdk' {
  import * as React from 'react';

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

  export type PublicViewMode = 'landing' | 'login' | 'register' | 'app';

  export interface SessionContextValue {
    token: string;
    role: string;
    username: string;
    publicView: PublicViewMode;
    setPublicView: (v: PublicViewMode) => void;
    tenant: TenantSummary | null;
    tenantsList: TenantSummary[];
    loginWithToken: (tok: string, role: string, username: string, ten: TenantSummary) => void;
    impersonateTenant: (tenantId: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshBootstrap: () => Promise<void>;
    apiGet: <T>(path: string) => Promise<T>;
    apiGetText: (path: string) => Promise<string>;
    apiPost: <T>(path: string, body: unknown, idempotencyKey?: string) => Promise<T>;
    apiPut: <T>(path: string, body: unknown) => Promise<T>;
    apiDelete: <T>(path: string) => Promise<T>;
  }

  export interface LicenseContextValue {
    catalog: ServiceManifest[];
    hasService: (serviceKey: string) => boolean;
    hasModule: (moduleKey: string) => boolean;
    hasSubmodule: (requiredModule: string, submoduleKey: string) => boolean;
    hasFeature: (requiredModule: string, featureKey: string) => boolean;
    hasPrintCapability: boolean;
  }

  export interface NavigationContextValue {
    activeServiceKey: string;
    setActiveServiceKey: (key: string) => void;
    activeModuleKey: string;
    setActiveModuleKey: (key: string) => void;
    activeSubmoduleKey: string;
    setActiveSubmoduleKey: (key: string) => void;
    roleViewFilter: string;
    setRoleViewFilter: (role: string) => void;
    navigateTo: (serviceKey: string, moduleKey?: string, payload?: Record<string, unknown>) => void;
    incomingPayload: Record<string, unknown> | null;
    clearIncomingPayload: () => void;
    openHtmlPrintWindow: (html: string, title?: string) => void;
    requestPrintDocument: (payload: Record<string, unknown>) => Promise<void>;
  }

  export interface ToastContextValue {
    toast: (msg: string) => void;
  }

  export type PlatformContextValue = SessionContextValue &
    LicenseContextValue &
    NavigationContextValue &
    ToastContextValue;

  export const PlatformProvider: React.FC<{ children: React.ReactNode }>;
  export function useSession(): SessionContextValue;
  export function useLicensing(): LicenseContextValue;
  export function useNavigation(): NavigationContextValue;
  export function useToast(): ToastContextValue;
  export function usePlatform(): PlatformContextValue;

  export const ModuleGate: React.FC<{ module: string; children: React.ReactNode }>;
  export const SubmoduleGate: React.FC<{
    module?: string;
    submodule: string;
    children: React.ReactNode;
  }>;
  export const FeatureGate: React.FC<{
    module?: string;
    feature: string;
    children: React.ReactNode;
  }>;
  export const PkAutoCodeInput: React.FC<{ label: string; value: string }>;

  export interface PkSelectProps<T> {
    label: string;
    items: T[];
    value: string;
    onChange: (newValue: string) => void;
    getValue: (item: T) => string;
    getLabel: (item: T) => string;
    onCreateNew?: () => void;
    createLabel?: string;
    searchable?: boolean;
    emptyLabel?: string;
  }

  export function PkSelect<T>(props: PkSelectProps<T>): React.ReactElement;

  export const PkModal: React.FC<{
    open: boolean;
    title: string;
    onClose: () => void;
    maxWidth?: number;
    children: React.ReactNode;
  }>;

  export const PkConfirmModal: React.FC<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    busy?: boolean;
  }>;

  export const PkPrintButton: React.FC<{
    label?: string;
    payload: Record<string, unknown>;
    variant?: 'primary' | 'outline';
  }>;

  export const PkKpiRow: React.FC<{
    items: { label: string; value: string; color?: string }[];
  }>;

  export function useAsyncAction(): {
    busy: boolean;
    run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  };

  export function formatCop(amount: number): string;
  export function downloadCsvUtf8(filename: string, headers: string[], rows: (string | number)[][]): void;
}
