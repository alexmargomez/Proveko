import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  BusinessPresetSpec,
  PricingMatrixCOP,
  RoleTemplateSpec,
  ServiceManifest,
  TenantSummary,
  UserProfileSummary,
} from '../types/platform';

export type PublicViewMode = 'landing' | 'login' | 'register' | 'app';
export type WorkstationViewMode = 'home' | 'service' | 'users' | 'activate-modules';

export interface SessionContextValue {
  token: string;
  role: string;
  username: string;
  userProfile: UserProfileSummary | null;
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
    ten: TenantSummary,
    extra?: {
      fullName?: string;
      internalRole?: string;
      isCompanyAdmin?: boolean;
      isDemo?: boolean;
      companyTenant?: TenantSummary | null;
    }
  ) => void;
  startDemoSession: (rolePreview?: string) => Promise<void>;
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

const SessionContext = createContext<SessionContextValue | null>(null);
const LicenseContext = createContext<LicenseContextValue | null>(null);
const NavigationContext = createContext<NavigationContextValue | null>(null);
const ToastContext = createContext<ToastContextValue | null>(null);

function makeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStoredNav<T extends string>(key: string, fallback: T): T {
  try {
    const val = sessionStorage.getItem(key);
    return val ? (val as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredNav(key: string, val: string): void {
  try {
    if (val) sessionStorage.setItem(key, val);
    else sessionStorage.removeItem(key);
  } catch {
    // Ignore storage quota errors
  }
}

const SandboxedPrintModal: React.FC<{
  html: string;
  title: string;
  onClose: () => void;
}> = ({ html, title, onClose }) => {
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const triggerFramePrint = (win: Window) => {
    win.focus();
    win.print();
  };

  const handlePrint = () => {
    const iframe = frameRef.current;
    const win = iframe?.contentWindow;
    if (!iframe || !win) return;
    if (win.document.readyState !== 'complete') {
      iframe.addEventListener('load', () => triggerFramePrint(win), { once: true });
      return;
    }
    triggerFramePrint(win);
  };

  return (
    <div className="pk-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="pk-modal"
        style={{ maxWidth: 920, height: '86vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pk-card-head" style={{ background: '#023047', color: '#fff' }}>
          <div className="pk-card-title" style={{ color: '#fff' }}>{title || 'Vista previa de documento'}</div>
          <div className="pk-row-actions">
            <button type="button" className="pk-btn pk-btn-emerald pk-btn-sm" onClick={handlePrint}>
              Imprimir / Guardar PDF
            </button>
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
        <div style={{ flex: 1, background: '#e2e8f0', padding: 10 }}>
          <iframe
            ref={frameRef}
            title={title || 'Documento imprimible'}
            srcDoc={html}
            sandbox="allow-same-origin allow-modals"
            style={{ width: '100%', height: '100%', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff' }}
          />
        </div>
      </div>
    </div>
  );
};

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string>('');
  const [hasSession, setHasSession] = useState<boolean>(() => {
    localStorage.removeItem('pk_jwt');
    return localStorage.getItem('pk_has_session') === '1';
  });
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(
    () => localStorage.getItem('pk_has_session') === '1'
  );
  const [role, setRole] = useState<string>(() => localStorage.getItem('pk_role') || 'cliente');
  const [username, setUsername] = useState<string>(() => localStorage.getItem('pk_user') || '');
  const [userProfile, setUserProfile] = useState<UserProfileSummary | null>(null);
  const [publicView, setPublicViewState] = useState<PublicViewMode>(() =>
    localStorage.getItem('pk_has_session') === '1' ? 'app' : readStoredNav<PublicViewMode>('pk_pub_view', 'landing')
  );
  const [workstationView, setWorkstationViewState] = useState<WorkstationViewMode>(() =>
    readStoredNav<WorkstationViewMode>('pk_ws_view', 'home')
  );
  const [tenant, setTenant] = useState<TenantSummary | null>(null);
  const [companyTenant, setCompanyTenant] = useState<TenantSummary | null>(null);
  const [tenantsList, setTenantsList] = useState<TenantSummary[]>([]);
  const [catalog, setCatalog] = useState<ServiceManifest[]>([]);
  const [businessPresets, setBusinessPresets] = useState<BusinessPresetSpec[]>([]);
  const [pricingCop, setPricingCop] = useState<PricingMatrixCOP | null>(null);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplateSpec[]>([]);
  const [activeServiceKey, setActiveServiceKeyState] = useState<string>(() =>
    readStoredNav<string>('pk_active_svc', '')
  );
  const [activeModuleKey, setActiveModuleKeyState] = useState<string>(() =>
    readStoredNav<string>('pk_active_mod', '')
  );
  const [activeSubmoduleKey, setActiveSubmoduleKey] = useState<string>('');
  const [roleViewFilter, setRoleViewFilter] = useState<string>('ALL');
  const [toastMsg, setToastMsg] = useState<string>('');
  const [incomingPayload, setIncomingPayload] = useState<Record<string, unknown> | null>(null);
  const [printPreview, setPrintPreview] = useState<{ html: string; title: string } | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const activeSvcRef = useRef<string>(activeServiceKey);
  const activeModRef = useRef<string>(activeModuleKey);
  activeSvcRef.current = activeServiceKey;
  activeModRef.current = activeModuleKey;

  const setPublicView = useCallback((v: PublicViewMode) => {
    setPublicViewState(v);
    writeStoredNav('pk_pub_view', v);
  }, []);

  const setWorkstationView = useCallback((v: WorkstationViewMode) => {
    setWorkstationViewState(v);
    writeStoredNav('pk_ws_view', v);
  }, []);

  const setActiveModuleKey = useCallback((k: string) => {
    setActiveModuleKeyState(k);
    writeStoredNav('pk_active_mod', k);
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg('');
      toastTimerRef.current = null;
    }, 3600);
  }, []);

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem('pk_jwt');
    localStorage.removeItem('pk_has_session');
    localStorage.removeItem('pk_role');
    localStorage.removeItem('pk_user');
    writeStoredNav('pk_ws_view', '');
    writeStoredNav('pk_active_svc', '');
    writeStoredNav('pk_active_mod', '');
    writeStoredNav('pk_impersonating', '');
    setToken('');
    setHasSession(false);
    setIsBootstrapping(false);
    setRole('cliente');
    setUsername('');
    setUserProfile(null);
    setTenant(null);
    setCompanyTenant(null);
    setTenantsList([]);
    setActiveServiceKeyState('');
    setActiveModuleKeyState('');
    setActiveSubmoduleKey('');
    setRoleViewFilter('ALL');
    setWorkstationViewState('home');
    setIncomingPayload(null);
    setPrintPreview(null);
    setPublicView('landing');
  }, [setPublicView]);

  const buildHeaders = useCallback(
    (extra?: Record<string, string>): Record<string, string> => {
      const h: Record<string, string> = { 'Content-Type': 'application/json', ...(extra || {}) };
      if (token) h['Authorization'] = `Bearer ${token}`;
      return h;
    },
    [token]
  );

  const apiRequest = useCallback(
    async <T,>(method: string, path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> => {
      const res = await fetch(path, {
        method,
        credentials: 'include',
        headers: buildHeaders(extraHeaders),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      let data: Record<string, unknown> | null = null;
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        data = null;
      }
      if (res.status === 401 && !path.endsWith('/login') && !path.endsWith('/public-catalog')) {
        clearLocalSession();
      }
      if (!res.ok || data?.ok === false) {
        const errMsg = (typeof data?.error === 'string' && data.error) || `Error HTTP ${res.status}`;
        toast(errMsg);
        throw new Error(errMsg);
      }
      if (typeof data?.token === 'string' && data.token) {
        setToken(data.token);
      }
      return data as T;
    },
    [buildHeaders, clearLocalSession, toast]
  );

  const apiGetText = useCallback(
    async (path: string): Promise<string> => {
      const h: Record<string, string> = {};
      if (token) h['Authorization'] = `Bearer ${token}`;
      const res = await fetch(path, { method: 'GET', credentials: 'include', headers: h });
      if (res.status === 401) {
        clearLocalSession();
      }
      const text = await res.text();
      if (!res.ok) {
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (typeof parsed?.error === 'string' && parsed.error.trim()) {
            throw new Error(parsed.error.trim());
          }
        } catch (err) {
          if (err instanceof Error && !err.message.includes('JSON')) {
            throw err;
          }
        }
        throw new Error(`No fue posible cargar el recurso (${res.status})`);
      }
      return text;
    },
    [clearLocalSession, token]
  );

  const apiGet = useCallback(<T,>(path: string) => apiRequest<T>('GET', path), [apiRequest]);
  const apiPost = useCallback(
    <T,>(path: string, body: unknown, idempotencyKey?: string) =>
      apiRequest<T>('POST', path, body, { 'Idempotency-Key': idempotencyKey || makeIdempotencyKey() }),
    [apiRequest]
  );
  const apiPut = useCallback(
    <T,>(path: string, body: unknown) => apiRequest<T>('PUT', path, body, { 'Idempotency-Key': makeIdempotencyKey() }),
    [apiRequest]
  );
  const apiDelete = useCallback(
    <T,>(path: string) => apiRequest<T>('DELETE', path, undefined, { 'Idempotency-Key': makeIdempotencyKey() }),
    [apiRequest]
  );

  useEffect(() => {
    let active = true;
    fetch('/api/v1/core/public-catalog', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.catalog) && data.catalog.length > 0) {
          setCatalog((prev) => (prev.length > 0 ? prev : data.catalog));
        }
        if (Array.isArray(data.presets)) setBusinessPresets(data.presets);
        if (data.pricing) setPricingCop(data.pricing);
        if (Array.isArray(data.roleTemplates)) setRoleTemplates(data.roleTemplates);
      })
      .catch(() => {
        // Offline ignored
      });
    return () => {
      active = false;
    };
  }, []);

  const applyCatalogSelection = useCallback((nextCatalog: ServiceManifest[], nextTenant: TenantSummary | null) => {
    if (!nextTenant || nextCatalog.length === 0) return;
    const prevSvc = activeSvcRef.current;
    const prevMod = activeModRef.current;
    const valid = nextCatalog.find(
      (s) => s.serviceKey === prevSvc && nextTenant.activeServices.includes(s.serviceKey)
    );
    const chosen = valid || nextCatalog.find((s) => nextTenant.activeServices.includes(s.serviceKey)) || nextCatalog[0];
    if (!chosen) return;

    setActiveServiceKeyState(chosen.serviceKey);
    writeStoredNav('pk_active_svc', chosen.serviceKey);

    if (chosen.modules.length > 0) {
      const keepMod = chosen.modules.find(
        (m) => m.moduleKey === prevMod && nextTenant.activeModules.includes(m.moduleKey)
      );
      const firstEnabled =
        keepMod ||
        chosen.modules.find((m) => nextTenant.activeModules.includes(m.moduleKey)) ||
        chosen.modules[0];
      setActiveModuleKeyState(firstEnabled.moduleKey);
      writeStoredNav('pk_active_mod', firstEnabled.moduleKey);
    }
  }, []);

  const refreshBootstrap = useCallback(async () => {
    if (!token && !hasSession) {
      setIsBootstrapping(false);
      return;
    }
    try {
      const data = await apiGet<{
        catalog: ServiceManifest[];
        tenant: TenantSummary;
        companyTenant?: TenantSummary;
        tenants?: TenantSummary[];
        userRole?: string;
        username?: string;
        userProfile?: UserProfileSummary;
        presets?: BusinessPresetSpec[];
        pricing?: PricingMatrixCOP;
        roleTemplates?: RoleTemplateSpec[];
      }>('/api/v1/core/bootstrap');
      const nextCatalog = data.catalog || [];
      const nextTenant = data.tenant || null;
      setCatalog(nextCatalog);
      setTenant(nextTenant);
      setCompanyTenant(data.companyTenant || nextTenant);
      setTenantsList(data.tenants || []);
      if (Array.isArray(data.presets)) setBusinessPresets(data.presets);
      if (data.pricing) setPricingCop(data.pricing);
      if (Array.isArray(data.roleTemplates)) setRoleTemplates(data.roleTemplates);
      if (data.userProfile) {
        setUserProfile(data.userProfile);
        if (!data.userProfile.isCompanyAdmin && data.userRole !== 'superadmin') {
          setWorkstationViewState((cur) =>
            cur === 'users' || cur === 'activate-modules' ? 'home' : cur
          );
        }
      }
      if (data.userRole) {
        setRole(data.userRole);
        localStorage.setItem('pk_role', data.userRole);
      }
      if (data.username) {
        setUsername(data.username);
        localStorage.setItem('pk_user', data.username);
      }
      applyCatalogSelection(nextCatalog, nextTenant);
    } catch {
      // Handled via apiRequest
    } finally {
      setIsBootstrapping(false);
    }
  }, [apiGet, applyCatalogSelection, hasSession, token]);

  useEffect(() => {
    if (token || hasSession) {
      void refreshBootstrap();
    }
  }, [token, hasSession, refreshBootstrap]);

  const setActiveServiceKey = useCallback(
    (key: string) => {
      setWorkstationView('service');
      setActiveServiceKeyState(key);
      writeStoredNav('pk_active_svc', key);
      const svc = catalog.find((s) => s.serviceKey === key);
      if (svc && svc.modules.length > 0) {
        const activeMod =
          svc.modules.find((m) => tenant && tenant.activeModules.includes(m.moduleKey)) || svc.modules[0];
        setActiveModuleKey(activeMod.moduleKey);
      }
    },
    [catalog, setActiveModuleKey, setWorkstationView, tenant]
  );

  const hasService = useCallback(
    (serviceKey: string) => Boolean(tenant && tenant.activeServices.includes(serviceKey)),
    [tenant]
  );

  const hasModule = useCallback(
    (moduleKey: string) => Boolean(tenant && tenant.activeModules.includes(moduleKey)),
    [tenant]
  );

  const hasSubmodule = useCallback(
    (requiredModule: string, submoduleKey: string) => {
      if (!tenant) return false;
      if (requiredModule && !tenant.activeModules.includes(requiredModule)) return false;
      if (!tenant.activeSubmodules) return true;
      return tenant.activeSubmodules.includes(submoduleKey);
    },
    [tenant]
  );

  const hasFeature = useCallback(
    (requiredModule: string, featureKey: string) => {
      if (!tenant) return false;
      if (requiredModule && !tenant.activeModules.includes(requiredModule)) return false;
      return tenant.activeFeatures.includes(featureKey);
    },
    [tenant]
  );

  useEffect(() => {
    const svc = catalog.find((s) => s.serviceKey === activeServiceKey);
    const modSubmodules = (svc?.submodules || []).filter(
      (sm) =>
        sm.dependsOnModule === activeModuleKey &&
        (!tenant?.activeSubmodules || tenant.activeSubmodules.includes(sm.submoduleKey))
    );
    if (modSubmodules.length === 0) {
      setActiveSubmoduleKey('');
      return;
    }
    setActiveSubmoduleKey((prev) =>
      modSubmodules.some((sm) => sm.submoduleKey === prev) ? prev : modSubmodules[0].submoduleKey
    );
  }, [activeServiceKey, activeModuleKey, catalog, tenant]);

  const printService = useMemo(
    () => catalog.find((s) => Boolean(s.capabilities && s.capabilities.includes('document_print'))) || null,
    [catalog]
  );

  const hasPrintCapability = useMemo(
    () => Boolean(printService && tenant && tenant.activeServices.includes(printService.serviceKey)),
    [printService, tenant]
  );

  const loginWithToken = useCallback(
    (
      tok: string,
      r: string,
      u: string,
      ten: TenantSummary,
      extra?: {
        fullName?: string;
        internalRole?: string;
        isCompanyAdmin?: boolean;
        isDemo?: boolean;
        companyTenant?: TenantSummary | null;
      }
    ) => {
      localStorage.removeItem('pk_jwt');
      localStorage.setItem('pk_has_session', '1');
      localStorage.setItem('pk_role', r);
      localStorage.setItem('pk_user', u);
      setToken(tok);
      setHasSession(true);
      setIsBootstrapping(false);
      setRole(r);
      setUsername(u);
      setTenant(ten);
      setCompanyTenant(extra?.companyTenant || ten);
      setUserProfile({
        userId: '',
        username: u,
        fullName: extra?.fullName || u,
        internalRole: extra?.internalRole || (r === 'superadmin' ? 'superadmin' : 'admin_empresa'),
        isCompanyAdmin: extra?.isCompanyAdmin ?? true,
        isDemo: Boolean(extra?.isDemo || ten.isDemo),
      });
      setWorkstationView('home');
      setIncomingPayload(null);
      setPrintPreview(null);
      setPublicView('app');
    },
    [setPublicView, setWorkstationView]
  );

  const startDemoSession = useCallback(
    async (rolePreview = 'admin_empresa') => {
      const resp = await apiPost<{
        token: string;
        role: string;
        internalRole?: string;
        username: string;
        fullName?: string;
        isCompanyAdmin?: boolean;
        isDemo?: boolean;
        tenant: TenantSummary;
        companyTenant?: TenantSummary;
      }>('/api/v1/core/demo-session', { rolePreview });
      loginWithToken(resp.token, resp.role, resp.username, resp.tenant, {
        fullName: resp.fullName,
        internalRole: resp.internalRole,
        isCompanyAdmin: resp.isCompanyAdmin,
        isDemo: true,
        companyTenant: resp.companyTenant || resp.tenant,
      });
      if (rolePreview !== 'admin_empresa') {
        setWorkstationView('service');
      }
      applyCatalogSelection(catalog, resp.tenant);
    },
    [apiPost, applyCatalogSelection, catalog, loginWithToken, setWorkstationView]
  );

  const impersonateTenant = useCallback(
    async (tenantId: string) => {
      const resp = await apiPost<{
        token: string;
        role: string;
        username: string;
        tenant: TenantSummary;
        companyTenant?: TenantSummary;
      }>('/api/v1/core/impersonate', { tenantId });
      localStorage.removeItem('pk_jwt');
      localStorage.setItem('pk_has_session', '1');
      localStorage.setItem('pk_role', resp.role);
      localStorage.setItem('pk_user', resp.username);
      writeStoredNav('pk_impersonating', '1');
      setToken(resp.token);
      setHasSession(true);
      setRole(resp.role);
      setUsername(resp.username);
      setTenant(resp.tenant);
      setCompanyTenant(resp.companyTenant || resp.tenant);
      setWorkstationView('home');
      setIncomingPayload(null);
      setPrintPreview(null);
      applyCatalogSelection(catalog, resp.tenant);
      toast(`Operando en ${resp.tenant.companyName}`);
    },
    [apiPost, applyCatalogSelection, catalog, setWorkstationView, toast]
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/core/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Ignore network errors during logout
    }
    clearLocalSession();
  }, [clearLocalSession]);

  const navigateTo = useCallback(
    (serviceKey: string, moduleKey?: string, payload?: Record<string, unknown>) => {
      setIncomingPayload(payload || null);
      setWorkstationView('service');
      setActiveServiceKeyState(serviceKey);
      writeStoredNav('pk_active_svc', serviceKey);
      if (moduleKey && (!tenant || tenant.activeModules.includes(moduleKey))) {
        setActiveModuleKey(moduleKey);
      } else {
        const svc = catalog.find((s) => s.serviceKey === serviceKey);
        if (svc && svc.modules.length > 0) {
          const activeMod =
            svc.modules.find((m) => tenant && tenant.activeModules.includes(m.moduleKey)) || svc.modules[0];
          setActiveModuleKey(activeMod.moduleKey);
        }
      }
    },
    [catalog, setActiveModuleKey, setWorkstationView, tenant]
  );

  const clearIncomingPayload = useCallback(() => setIncomingPayload(null), []);

  const openHtmlPrintWindow = useCallback((html: string, title = 'Vista previa de documento') => {
    setPrintPreview({ html, title });
  }, []);

  const requestPrintDocument = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!printService || !hasPrintCapability) {
        toast('El servicio de documentos imprimibles no está habilitado para esta empresa.');
        return;
      }
      const resp = await apiPost<{ html_printable: string; title?: string }>(
        `${printService.apiPrefix}/render`,
        payload
      );
      openHtmlPrintWindow(
        resp.html_printable,
        resp.title || String(payload.document_type || payload.docType || 'Documento')
      );
    },
    [apiPost, hasPrintCapability, openHtmlPrintWindow, printService, toast]
  );

  const isCompanyAdmin = Boolean(role === 'superadmin' || userProfile?.isCompanyAdmin);
  const isDemo = Boolean(userProfile?.isDemo || tenant?.isDemo);

  const sessionValue = useMemo<SessionContextValue>(
    () => ({
      token,
      role,
      username,
      userProfile,
      isCompanyAdmin,
      isDemo,
      isBootstrapping,
      publicView,
      setPublicView,
      tenant,
      companyTenant,
      tenantsList,
      businessPresets,
      pricingCop,
      roleTemplates,
      loginWithToken,
      startDemoSession,
      impersonateTenant,
      logout,
      refreshBootstrap,
      apiGet,
      apiGetText,
      apiPost,
      apiPut,
      apiDelete,
    }),
    [
      token,
      role,
      username,
      userProfile,
      isCompanyAdmin,
      isDemo,
      isBootstrapping,
      publicView,
      setPublicView,
      tenant,
      companyTenant,
      tenantsList,
      businessPresets,
      pricingCop,
      roleTemplates,
      loginWithToken,
      startDemoSession,
      impersonateTenant,
      logout,
      refreshBootstrap,
      apiGet,
      apiGetText,
      apiPost,
      apiPut,
      apiDelete,
    ]
  );

  const licenseValue = useMemo<LicenseContextValue>(
    () => ({
      catalog,
      hasService,
      hasModule,
      hasSubmodule,
      hasFeature,
      hasPrintCapability,
    }),
    [catalog, hasService, hasModule, hasSubmodule, hasFeature, hasPrintCapability]
  );

  const navigationValue = useMemo<NavigationContextValue>(
    () => ({
      workstationView,
      setWorkstationView,
      activeServiceKey,
      setActiveServiceKey,
      activeModuleKey,
      setActiveModuleKey,
      activeSubmoduleKey,
      setActiveSubmoduleKey,
      roleViewFilter,
      setRoleViewFilter,
      navigateTo,
      incomingPayload,
      clearIncomingPayload,
      openHtmlPrintWindow,
      requestPrintDocument,
    }),
    [
      workstationView,
      setWorkstationView,
      activeServiceKey,
      setActiveServiceKey,
      activeModuleKey,
      setActiveModuleKey,
      activeSubmoduleKey,
      roleViewFilter,
      navigateTo,
      incomingPayload,
      clearIncomingPayload,
      openHtmlPrintWindow,
      requestPrintDocument,
    ]
  );

  const toastValue = useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={toastValue}>
      <SessionContext.Provider value={sessionValue}>
        <LicenseContext.Provider value={licenseValue}>
          <NavigationContext.Provider value={navigationValue}>
            {children}
            {toastMsg && (
              <div className="pk-toast" role="status" aria-live="polite">
                {toastMsg}
              </div>
            )}
            {printPreview && (
              <SandboxedPrintModal
                html={printPreview.html}
                title={printPreview.title}
                onClose={() => setPrintPreview(null)}
              />
            )}
          </NavigationContext.Provider>
        </LicenseContext.Provider>
      </SessionContext.Provider>
    </ToastContext.Provider>
  );
};

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe utilizarse dentro de <PlatformProvider>');
  return ctx;
}

export function useLicensing(): LicenseContextValue {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicensing debe utilizarse dentro de <PlatformProvider>');
  return ctx;
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation debe utilizarse dentro de <PlatformProvider>');
  return ctx;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe utilizarse dentro de <PlatformProvider>');
  return ctx;
}

export function usePlatform(): PlatformContextValue {
  const session = useSession();
  const licensing = useLicensing();
  const navigation = useNavigation();
  const toastCtx = useToast();
  return useMemo(
    () => ({
      ...session,
      ...licensing,
      ...navigation,
      ...toastCtx,
    }),
    [session, licensing, navigation, toastCtx]
  );
}
