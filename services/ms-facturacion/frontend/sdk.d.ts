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
    paymentStatus?: string;
    monthlyCop?: number;
    customMonthlyCop?: number;
    maxUsersAllowed?: number;
    sessionVersion?: number;
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
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
    plane?: string;
    userId: string;
    username: string;
    fullName: string;
    internalRole: string;
    isCompanyAdmin: boolean;
    isDemo: boolean;
    platformRole?: string;
    platformPermissions?: string[];
    allowedTenants?: string[];
    requireDataReason?: boolean;
    impersonating?: boolean;
    impersonationMode?: string;
    impersonationReason?: string;
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
    sessionVersion?: number;
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

  export type PublicViewMode = 'landing' | 'login' | 'register' | 'app';
  export type WorkstationViewMode = 'home' | 'service' | 'users' | 'activate-modules';

  export interface SessionContextValue {
    token: string;
    plane: string;
    role: string;
    username: string;
    userProfile: UserProfileSummary | null;
    platformRole: string;
    platformPermissions: string[];
    requireDataReason: boolean;
    impersonating: boolean;
    impersonationMode: string;
    impersonationReason: string;
    hasPlatformPermission: (perm: string) => boolean;
    isCompanyAdmin: boolean;
    isDemo: boolean;
    isBootstrapping: boolean;
    publicView: PublicViewMode;
    setPublicView: (v: PublicViewMode) => void;
    tenant: TenantSummary | null;
    companyTenant: TenantSummary | null;
    tenantsList: TenantSummary[];
    businessPresets: BusinessPresetSpec[];
    pricingCop: PricingMatrixCOP | null;
    roleTemplates: RoleTemplateSpec[];
    loginWithToken: (
      tok: string,
      role: string,
      username: string,
      ten: TenantSummary | null,
      extra?: {
        plane?: string;
        fullName?: string;
        internalRole?: string;
        platformRole?: string;
        platformPermissions?: string[];
        allowedTenants?: string[];
        requireDataReason?: boolean;
        isCompanyAdmin?: boolean;
        isDemo?: boolean;
        companyTenant?: TenantSummary | null;
      }
    ) => void;
    startDemoSession: (rolePreview?: string) => Promise<void>;
    impersonateTenant: (
      tenantId: string,
      opts?: { mode?: 'readonly' | 'readwrite'; reason?: string; durationMinutes?: number }
    ) => Promise<void>;
    stopImpersonation: () => Promise<void>;
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
    workstationView: WorkstationViewMode;
    setWorkstationView: (view: WorkstationViewMode) => void;
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
    placeholder?: string;
    disabled?: boolean;
  }

  export function PkSelect<T>(props: PkSelectProps<T>): React.ReactElement;

  export interface PkSimpleOption {
    value: string;
    label: string;
    sublabel?: string;
  }

  export interface PkSimpleSelectProps {
    label?: string;
    ariaLabel?: string;
    options: PkSimpleOption[];
    value: string;
    onChange: (newValue: string) => void;
    placeholder?: string;
    allowClear?: boolean;
    searchable?: boolean;
    disabled?: boolean;
    compact?: boolean;
    onCreateNew?: () => void;
    createLabel?: string;
  }

  export const PkSimpleSelect: React.FC<PkSimpleSelectProps>;

  export const PkViewSwitcher: React.FC<{
    title: string;
    subtitle?: string;
    mode: 'list' | 'create';
    onModeChange: (mode: 'list' | 'create') => void;
    listLabel?: string;
    createLabel?: string;
    count?: number;
    extraActions?: React.ReactNode;
  }>;

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

  export interface PkProcessStep {
    step: number | string;
    label: string;
    sublabel?: string;
    status: 'done' | 'active' | 'error' | 'pending';
    tooltip?: string;
    onClick?: () => void;
  }

  export const PkProcessNodes: React.FC<{
    steps: PkProcessStep[];
    compact?: boolean;
  }>;

  export interface PkLivePillTab {
    key: string;
    label: string;
    count?: number;
  }

  export const PkLiveHeader: React.FC<{
    title: string;
    liveLabel?: string;
    subtitle?: string;
    pills?: PkLivePillTab[];
    activePill?: string;
    onPillChange?: (key: string) => void;
    displayMode?: 'board' | 'table';
    onDisplayModeChange?: (mode: 'board' | 'table') => void;
    boardLabel?: string;
    tableLabel?: string;
    primaryActionLabel?: string;
    onPrimaryAction?: () => void;
    extraActions?: React.ReactNode;
  }>;

  export interface PkKanbanColumnSpec {
    key: string;
    title: string;
    dotColor: 'amber' | 'blue' | 'purple' | 'emerald' | 'rose' | 'slate';
    count: number;
    emptyText?: string;
    children?: React.ReactNode;
  }

  export const PkKanbanBoard: React.FC<{
    columns: PkKanbanColumnSpec[];
  }>;

  export interface PkTicketLineItem {
    qty?: string | number;
    name: string;
    amount?: string;
  }

  export interface PkTicketCardProps {
    code: string;
    timeAgo?: string;
    channelBadge?: {
      label: string;
      tone?: 'coral' | 'blue' | 'purple' | 'emerald' | 'amber' | 'slate';
    };
    title: string;
    subtitle?: string;
    metaLine?: string;
    items?: PkTicketLineItem[];
    highlightNote?: string;
    totalLabel?: string;
    totalValue?: string;
    paymentLabel?: string;
    statusPill?: {
      label: string;
      tone: 'amber' | 'blue' | 'purple' | 'emerald' | 'rose' | 'slate';
    };
    processNodes?: PkProcessStep[];
    extraBody?: React.ReactNode;
    primaryAction?: {
      label: string;
      tone: 'coral' | 'blue' | 'purple' | 'emerald' | 'amber' | 'navy';
      onClick: () => void;
      disabled?: boolean;
    };
    secondaryActions?: React.ReactNode;
  }

  export const PkTicketCard: React.FC<PkTicketCardProps>;

  export interface PkTypeCardOption {
    key: string;
    icon: string;
    title: string;
    description: string;
    badge?: string;
  }

  export const PkTypeCards: React.FC<{
    label?: string;
    options: PkTypeCardOption[];
    value: string;
    onChange: (key: string) => void;
    disabled?: boolean;
  }>;

  export const PkFullscreenDialog: React.FC<{
    open: boolean;
    title: string;
    subtitle?: string;
    badge?: { label: string; tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' };
    onClose: () => void;
    subheader?: React.ReactNode;
    footerLeft?: React.ReactNode;
    footerActions?: React.ReactNode;
    children: React.ReactNode;
  }>;

  export const PkProgressBar: React.FC<{
    label?: string;
    valueLabel?: string;
    pct: number;
    tone?: 'emerald' | 'blue' | 'amber' | 'rose' | 'purple';
  }>;

  export const PkDistributionStrip: React.FC<{
    title?: string;
    segments: { label: string; value: number; displayValue: string; color: string }[];
  }>;

  export function useAsyncAction(): {
    busy: boolean;
    run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  };

  export function formatCop(amount: number): string;
  export function downloadCsvUtf8(filename: string, headers: string[], rows: (string | number)[][]): void;
}
