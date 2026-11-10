import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  ServiceManifest,
  TenantRecord,
  InvoiceItem,
  PrintDocumentPayload,
} from '../types/domain';

export type QuickDialogType =
  | null
  | 'nuevo-cliente'
  | 'nuevo-conductor'
  | 'nuevo-transportista'
  | 'nueva-placa'
  | 'nueva-bodega'
  | 'nueva-habitacion'
  | 'nuevo-proveedor';

export interface PosTransferPayload {
  customerId?: string;
  vehicleId?: string;
  mechanicId?: string;
  linkedWorkOrderId?: string;
  linkedTableId?: string;
  linkedRoomId?: string;
  items: InvoiceItem[];
}

interface ProvekoContextValue {
  token: string;
  role: string;
  username: string;
  publicView: 'landing' | 'login' | 'register' | 'app';
  setPublicView: (v: 'landing' | 'login' | 'register' | 'app') => void;
  tenant: TenantRecord | null;
  tenantsList: TenantRecord[];
  catalog: ServiceManifest[];
  activeServiceKey: string;
  setActiveServiceKey: (key: string) => void;
  activeModuleKey: string;
  setActiveModuleKey: (key: string) => void;
  roleViewFilter: string;
  setRoleViewFilter: (role: string) => void;
  hasService: (serviceKey: string) => boolean;
  hasModule: (moduleKey: string) => boolean;
  hasFeature: (requiredModule: string, featureKey: string) => boolean;
  apiGet: <T>(path: string) => Promise<T>;
  apiPost: <T>(path: string, body: unknown) => Promise<T>;
  apiPut: <T>(path: string, body: unknown) => Promise<T>;
  apiDelete: <T>(path: string) => Promise<T>;
  refreshBootstrap: () => Promise<void>;
  loginWithToken: (tok: string, role: string, username: string, ten: TenantRecord) => void;
  logout: () => void;
  toast: (msg: string) => void;
  activeDialog: QuickDialogType;
  openQuickDialog: (dlg: QuickDialogType, onSaved?: () => void) => void;
  closeQuickDialog: () => void;
  notifyDialogSaved: () => void;
  dialogVersion: number;
  printViaService: (payload: PrintDocumentPayload) => Promise<void>;
  posTransfer: PosTransferPayload | null;
  sendToPosCheckout: (transfer: PosTransferPayload) => void;
  clearPosTransfer: () => void;
}

const ProvekoContext = createContext<ProvekoContextValue | null>(null);

export const ProvekoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string>(() => localStorage.getItem('pk_jwt') || '');
  const [role, setRole] = useState<string>(() => localStorage.getItem('pk_role') || 'cliente');
  const [username, setUsername] = useState<string>(() => localStorage.getItem('pk_user') || 'demo@proveko.com');
  const [publicView, setPublicView] = useState<'landing' | 'login' | 'register' | 'app'>(() =>
    localStorage.getItem('pk_jwt') ? 'app' : 'app'
  );
  const [tenant, setTenant] = useState<TenantRecord | null>(null);
  const [tenantsList, setTenantsList] = useState<TenantRecord[]>([]);
  const [catalog, setCatalog] = useState<ServiceManifest[]>([]);
  const [activeServiceKey, setActiveServiceKeyState] = useState<string>('ms-facturacion');
  const [activeModuleKey, setActiveModuleKey] = useState<string>('pos_mostrador');
  const [roleViewFilter, setRoleViewFilter] = useState<string>('ALL');
  const [toastMsg, setToastMsg] = useState<string>('');
  const [activeDialog, setActiveDialog] = useState<QuickDialogType>(null);
  const [dialogCallback, setDialogCallback] = useState<(() => void) | null>(null);
  const [dialogVersion, setDialogVersion] = useState<number>(0);
  const [posTransfer, setPosTransfer] = useState<PosTransferPayload | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? '' : prev)), 3200);
  }, []);

  const buildHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    if (tenant?.tenantId) h['X-Tenant-Id'] = tenant.tenantId;
    return h;
  }, [token, tenant?.tenantId]);

  const apiRequest = useCallback(
    async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
      const res = await fetch(path, {
        method,
        headers: buildHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        const errMsg = data?.error || `Error HTTP ${res.status}`;
        toast(errMsg);
        throw new Error(errMsg);
      }
      return data as T;
    },
    [buildHeaders, toast]
  );

  const apiGet = useCallback(<T,>(path: string) => apiRequest<T>('GET', path), [apiRequest]);
  const apiPost = useCallback(<T,>(path: string, body: unknown) => apiRequest<T>('POST', path, body), [apiRequest]);
  const apiPut = useCallback(<T,>(path: string, body: unknown) => apiRequest<T>('PUT', path, body), [apiRequest]);
  const apiDelete = useCallback(<T,>(path: string) => apiRequest<T>('DELETE', path), [apiRequest]);

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await apiGet<{
        catalog: ServiceManifest[];
        tenant: TenantRecord;
        tenants: TenantRecord[];
      }>('/api/v1/core/bootstrap');
      setCatalog(data.catalog || []);
      setTenant(data.tenant || null);
      setTenantsList(data.tenants || []);
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void refreshBootstrap();
  }, [refreshBootstrap]);

  const setActiveServiceKey = useCallback(
    (key: string) => {
      setActiveServiceKeyState(key);
      const svc = catalog.find((s) => s.serviceKey === key);
      if (svc && svc.modules.length > 0) {
        const activeMod = svc.modules.find((m) => !tenant || tenant.activeModules.includes(m.moduleKey)) || svc.modules[0];
        setActiveModuleKey(activeMod.moduleKey);
      }
    },
    [catalog, tenant]
  );

  const hasService = useCallback(
    (serviceKey: string) => !tenant || tenant.activeServices.includes(serviceKey),
    [tenant]
  );

  const hasModule = useCallback(
    (moduleKey: string) => !tenant || tenant.activeModules.includes(moduleKey),
    [tenant]
  );

  const hasFeature = useCallback(
    (requiredModule: string, featureKey: string) => {
      if (!tenant) return true;
      if (requiredModule && !tenant.activeModules.includes(requiredModule)) return false;
      return tenant.activeFeatures.includes(featureKey);
    },
    [tenant]
  );

  const loginWithToken = useCallback((tok: string, r: string, u: string, ten: TenantRecord) => {
    localStorage.setItem('pk_jwt', tok);
    localStorage.setItem('pk_role', r);
    localStorage.setItem('pk_user', u);
    setToken(tok);
    setRole(r);
    setUsername(u);
    setTenant(ten);
    setPublicView('app');
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('pk_jwt');
    localStorage.removeItem('pk_role');
    localStorage.removeItem('pk_user');
    setToken('');
    setRole('cliente');
    setPublicView('landing');
  }, []);

  const openQuickDialog = useCallback((dlg: QuickDialogType, onSaved?: () => void) => {
    setActiveDialog(dlg);
    setDialogCallback(() => onSaved || null);
  }, []);

  const closeQuickDialog = useCallback(() => {
    setActiveDialog(null);
    setDialogCallback(null);
  }, []);

  const notifyDialogSaved = useCallback(() => {
    setDialogVersion((v) => v + 1);
    if (dialogCallback) dialogCallback();
    setActiveDialog(null);
    setDialogCallback(null);
  }, [dialogCallback]);

  const printViaService = useCallback(
    async (payload: PrintDocumentPayload) => {
      const resp = await apiPost<{ title: string; html_printable: string }>('/api/v1/impresiones/render', payload);
      const win = window.open('', '_blank', 'width=880,height=740');
      if (!win) {
        toast('Habilita las ventanas emergentes para imprimir el documento.');
        return;
      }
      win.document.write(resp.html_printable);
      win.document.close();
    },
    [apiPost, toast]
  );

  const sendToPosCheckout = useCallback((transfer: PosTransferPayload) => {
    setPosTransfer(transfer);
    setActiveServiceKeyState('ms-facturacion');
    setActiveModuleKey('pos_mostrador');
  }, []);

  const clearPosTransfer = useCallback(() => setPosTransfer(null), []);

  return (
    <ProvekoContext.Provider
      value={{
        token,
        role,
        username,
        publicView,
        setPublicView,
        tenant,
        tenantsList,
        catalog,
        activeServiceKey,
        setActiveServiceKey,
        activeModuleKey,
        setActiveModuleKey,
        roleViewFilter,
        setRoleViewFilter,
        hasService,
        hasModule,
        hasFeature,
        apiGet,
        apiPost,
        apiPut,
        apiDelete,
        refreshBootstrap,
        loginWithToken,
        logout,
        toast,
        activeDialog,
        openQuickDialog,
        closeQuickDialog,
        notifyDialogSaved,
        dialogVersion,
        printViaService,
        posTransfer,
        sendToPosCheckout,
        clearPosTransfer,
      }}
    >
      {children}
      {toastMsg && <div className="pk-toast">{toastMsg}</div>}
    </ProvekoContext.Provider>
  );
};

export function useProveko(): ProvekoContextValue {
  const ctx = useContext(ProvekoContext);
  if (!ctx) throw new Error('useProveko debe usarse dentro de <ProvekoProvider>');
  return ctx;
}
