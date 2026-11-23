import React, { useEffect, useState } from 'react';
import { usePlatform } from '@platform/ui-sdk';
import { SidebarMenu } from './layout/SidebarMenu';
import { TopModuleTabs, ServiceContextHeader } from './layout/TopModuleTabs';
import { LandingAndAuth } from './pages/LandingAndAuth';
import { SuperAdminPanel } from './pages/SuperAdminPanel';
import { WorkstationHome } from './pages/WorkstationHome';
import { CompanyUsersPanel } from './pages/CompanyUsersPanel';
import { CompanyModulesPanel } from './pages/CompanyModulesPanel';

const remoteComponentCache = new Map<string, React.ComponentType>();

async function verifyBundleHashIfApplicable(source: string, expectedPrefix: string): Promise<void> {
  if (!/^[0-9a-f]{12,}$/i.test(expectedPrefix)) {
    return;
  }
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return;
  }
  const bytes = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  if (!hex.startsWith(expectedPrefix.toLowerCase())) {
    throw new Error('Integridad del paquete UI remoto rechazada (SHA-256 no coincide con el manifiesto).');
  }
}

interface ErrorBoundaryProps {
  serviceTitle: string;
  resetKey: string;
  onRetry: () => void;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class RemoteErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : 'Error inesperado al renderizar el componente remoto.',
    };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">{this.props.serviceTitle} — Fallo Aislado del Componente</div>
            <button
              type="button"
              className="pk-btn pk-btn-primary pk-btn-sm"
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                this.props.onRetry();
              }}
            >
              Recargar Vista
            </button>
          </div>
          <div className="pk-card-body" style={{ color: 'var(--pk-muted)' }}>
            {this.state.message}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const RemoteServiceStage: React.FC = () => {
  const {
    activeServiceKey,
    catalog,
    tenant,
    username,
    role,
    userProfile,
    isCompanyAdmin,
    hasModule,
    setWorkstationView,
    apiGetText,
    refreshBootstrap,
  } = usePlatform();
  const [RemoteView, setRemoteView] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [attempt, setAttempt] = useState<number>(0);

  const svc = catalog.find((item) => item.serviceKey === activeServiceKey);
  const enabledModules = (svc?.modules || []).filter((m) => hasModule(m.moduleKey));

  useEffect(() => {
    if (!svc || enabledModules.length === 0) return;
    const version = svc.bundleHash || 'rev-1';
    const cacheKey = `${svc.serviceKey}:${svc.uiBundlePath}:${version}`;
    if (attempt === 0 && remoteComponentCache.has(cacheKey)) {
      setRemoteView(() => remoteComponentCache.get(cacheKey) || null);
      setErrorMsg('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMsg('');

    (async () => {
      try {
        const sep = svc.uiBundlePath.includes('?') ? '&' : '?';
        const moduleUrl = `${svc.uiBundlePath}${sep}v=${encodeURIComponent(version)}${attempt > 0 ? `&r=${attempt}` : ''}`;

        const jsSource = await apiGetText(moduleUrl);
        await verifyBundleHashIfApplicable(jsSource, version);

        let mod: { default?: React.ComponentType } | null = null;
        const blobUrl = URL.createObjectURL(new Blob([jsSource], { type: 'text/javascript' }));
        try {
          mod = (await import(/* @vite-ignore */ blobUrl)) as { default?: React.ComponentType };
        } finally {
          URL.revokeObjectURL(blobUrl);
        }

        const Comp = mod?.default;
        if (!Comp) {
          throw new Error(`El paquete UI de ${svc.displayName} no exporta una vista principal válida.`);
        }
        remoteComponentCache.set(cacheKey, Comp);
        if (!cancelled) {
          setRemoteView(() => Comp);
          if (attempt > 0) {
            setAttempt(0);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setRemoteView(null);
          setErrorMsg(err instanceof Error ? err.message : 'Servicio remoto no disponible');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [svc, enabledModules.length, apiGetText, attempt]);

  const handleRetryRemote = () => {
    void (async () => {
      if (svc) {
        remoteComponentCache.delete(`${svc.serviceKey}:${svc.uiBundlePath}:${svc.bundleHash || 'rev-1'}`);
      }
      await refreshBootstrap();
      setAttempt((n) => n + 1);
    })();
  };

  if (!svc) {
    return (
      <div className="pk-card">
        <div className="pk-card-body">Selecciona un área activa en el menú lateral para comenzar.</div>
      </div>
    );
  }

  if (enabledModules.length === 0) {
    return (
      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">{svc.displayName} — Sin Secciones Habilitadas</div>
          {isCompanyAdmin && (
            <button
              type="button"
              className="pk-btn pk-btn-primary pk-btn-sm"
              onClick={() => setWorkstationView('activate-modules')}
            >
              Activar Secciones
            </button>
          )}
        </div>
        <div className="pk-card-body" style={{ color: 'var(--pk-muted)' }}>
          Tu perfil actual no cuenta con secciones habilitadas dentro de {svc.displayName}. Solicita al administrador de
          tu empresa asignar los permisos correspondientes o activa módulos adicionales.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pk-card">
        <div className="pk-card-body">Cargando módulo {svc.displayName}...</div>
      </div>
    );
  }

  if (errorMsg || !RemoteView) {
    return (
      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">{svc.displayName} — Área Temporalmente No Disponible</div>
          <button
            type="button"
            className="pk-btn pk-btn-primary pk-btn-sm"
            onClick={handleRetryRemote}
          >
            Reintentar Conexión
          </button>
        </div>
        <div className="pk-card-body" style={{ color: 'var(--pk-muted)' }}>
          {errorMsg || 'Verifica la conectividad del servicio y vuelve a intentarlo.'}
        </div>
      </div>
    );
  }

  const stageKey = `${svc.serviceKey}:${tenant?.tenantId || 'none'}:${userProfile?.userId || username}:${userProfile?.internalRole || role}`;
  return (
    <RemoteErrorBoundary
      serviceTitle={svc.displayName}
      resetKey={stageKey}
      onRetry={handleRetryRemote}
    >
      <RemoteView key={stageKey} />
    </RemoteErrorBoundary>
  );
};

export const App: React.FC = () => {
  const {
    publicView,
    setPublicView,
    workstationView,
    isBootstrapping,
    token,
    tenant,
    role,
    username,
    userProfile,
    isDemo,
    logout,
    impersonateTenant,
    startDemoSession,
  } = usePlatform();

  const [impersonatingWorkstation, setImpersonatingWorkstation] = useState<boolean>(
    () => typeof window !== 'undefined' && sessionStorage.getItem('pk_impersonating') === '1',
  );
  const [railPinned, setRailPinned] = useState<boolean>(() => localStorage.getItem('pk_rail_pinned') === '1');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const isSuperAdmin = role === 'superadmin';

  const setImpersonation = (active: boolean) => {
    setImpersonatingWorkstation(active);
    if (typeof window !== 'undefined') {
      if (active) {
        sessionStorage.setItem('pk_impersonating', '1');
      } else {
        sessionStorage.removeItem('pk_impersonating');
      }
    }
  };

  useEffect(() => {
    if (publicView !== 'app' || (!isBootstrapping && !isSuperAdmin)) {
      setImpersonation(false);
    }
  }, [publicView, isBootstrapping, isSuperAdmin]);

  const handleLogout = async () => {
    remoteComponentCache.clear();
    setImpersonation(false);
    setMobileMenuOpen(false);
    await logout();
  };

  const toggleRailPin = () => {
    setRailPinned((prev) => {
      const next = !prev;
      localStorage.setItem('pk_rail_pinned', next ? '1' : '0');
      return next;
    });
  };

  const hasActiveSession =
    Boolean(token || tenant) ||
    (typeof window !== 'undefined' && localStorage.getItem('pk_has_session') === '1');

  useEffect(() => {
    if (!hasActiveSession) {
      remoteComponentCache.clear();
    }
  }, [hasActiveSession]);

  if (publicView !== 'app' || !hasActiveSession) {
    return <LandingAndAuth />;
  }

  if (isBootstrapping && !tenant && !isSuperAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--pk-bg)', display: 'flex', flexDirection: 'column' }}>
        <header className="pk-topbar">
          <div className="pk-brand">
            <span className="pk-logo-box">PK</span>
            <div className="pk-brand-meta">
              <div className="pk-brand-title">
                <span>PROVEKO</span>
              </div>
              <div className="pk-brand-sub">Preparando estación empresarial</div>
            </div>
          </div>
        </header>
        <main className="pk-stage" style={{ maxWidth: 680, width: '100%', margin: '48px auto' }}>
          <div className="pk-card">
            <div className="pk-card-body" style={{ textAlign: 'center', padding: 28, color: 'var(--pk-muted)' }}>
              Cargando tu entorno empresarial...
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isSuperAdmin && !impersonatingWorkstation) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--pk-bg)', display: 'flex', flexDirection: 'column' }}>
        <header className="pk-topbar">
          <div className="pk-brand">
            <span className="pk-logo-box">PK</span>
            <div className="pk-brand-meta">
              <div className="pk-brand-title">
                <span>PROVEKO</span>
                <span style={{ color: '#cbd5e1', fontWeight: 400 }}>|</span>
                <span style={{ color: 'var(--pk-primary)', fontWeight: 700, fontSize: 14 }}>
                  Administración Central de Empresas
                </span>
              </div>
              <div className="pk-brand-sub">Gobierno Global de Suscripciones, Licencias y Cupos</div>
            </div>
          </div>
          <div className="pk-row-actions">
            <span className="pk-badge pk-badge-blue">{username || 'SuperAdmin'}</span>
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void handleLogout()}>
              Cerrar Sesión
            </button>
          </div>
        </header>
        <main className="pk-stage" style={{ maxWidth: 1540, width: '100%', margin: '0 auto' }}>
          <SuperAdminPanel
            onEnterWorkstation={(targetTenantId) => {
              void (async () => {
                await impersonateTenant(targetTenantId);
                setImpersonation(true);
              })();
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="pk-workstation-shell">
      {isSuperAdmin && impersonatingWorkstation && (
        <div
          role="region"
          aria-label="Modo Impersonación Corporativa"
          style={{
            background: '#023047',
            color: '#ffffff',
            padding: '7px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 12.5,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          <span>
            Modo Soporte Corporativo Activo en <strong>{tenant?.companyName || 'Empresa'}</strong> (NIT{' '}
            {tenant?.nit || 'N/A'})
          </span>
          <button
            type="button"
            className="pk-btn pk-btn-amber-brand pk-btn-sm"
            onClick={() => setImpersonation(false)}
          >
            Volver al Panel Corporativo Global
          </button>
        </div>
      )}

      {isDemo && !isSuperAdmin && (
        <div
          role="region"
          aria-label="Modo Demostración Interactiva"
          style={{
            background: 'linear-gradient(90deg, #023047 0%, #0b4f78 100%)',
            color: '#ffffff',
            padding: '8px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 12.5,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="pk-badge pk-badge-amber">DEMO EN VIVO</span>
            <span>
              Explora facturación, inventario, comandas, taller y roles libremente. Simular vista de empleado:
            </span>
            <select
              aria-label="Simular rol en modo demostración"
              value={userProfile?.internalRole || 'admin_empresa'}
              onChange={(e) => {
                const nextRole = e.target.value;
                void startDemoSession(nextRole);
              }}
              style={{
                background: 'rgba(255,255,255,0.14)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 7,
                padding: '4px 9px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <option value="admin_empresa" style={{ color: '#0f172a' }}>Vista: Administrador (Todo)</option>
              <option value="cajero" style={{ color: '#0f172a' }}>Vista: Cajero y Facturador</option>
              <option value="vendedor" style={{ color: '#0f172a' }}>Vista: Asesor Comercial y Ventas</option>
              <option value="mesero" style={{ color: '#0f172a' }}>Vista: Mesero de Salón</option>
              <option value="cocina" style={{ color: '#0f172a' }}>Vista: Cocina y Despacho</option>
              <option value="bodega" style={{ color: '#0f172a' }}>Vista: Jefe de Bodega</option>
              <option value="tecnico" style={{ color: '#0f172a' }}>Vista: Técnico de Taller</option>
              <option value="recepcion" style={{ color: '#0f172a' }}>Vista: Recepción Hotelera</option>
              <option value="contador" style={{ color: '#0f172a' }}>Vista: Contador y Nómina</option>
            </select>
          </div>

          <button
            type="button"
            className="pk-btn pk-btn-emerald pk-btn-sm"
            onClick={() => {
              void (async () => {
                await handleLogout();
                setPublicView('register');
              })();
            }}
          >
            Crear Cuenta para mi Empresa →
          </button>
        </div>
      )}

      <TopModuleTabs
        onOpenAdmin={() => setImpersonation(false)}
        onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
      />

      <div className="pk-app-frame">
        {mobileMenuOpen && (
          <div
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.45)',
              zIndex: 80,
            }}
          />
        )}
        <div className={`pk-rail-host ${railPinned ? 'pinned' : ''}`}>
          <SidebarMenu
            pinned={railPinned}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
            onTogglePin={toggleRailPin}
            onOpenSuperAdmin={isSuperAdmin ? () => setImpersonation(false) : undefined}
          />
        </div>
        <main className="pk-main">
          <ServiceContextHeader />
          {workstationView === 'home' && <WorkstationHome />}
          {workstationView === 'users' && <CompanyUsersPanel />}
          {workstationView === 'activate-modules' && <CompanyModulesPanel />}
          {workstationView === 'service' && (
            <div className="pk-stage">
              <RemoteServiceStage />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
