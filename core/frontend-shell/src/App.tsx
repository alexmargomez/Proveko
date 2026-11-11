import React, { useEffect, useState } from 'react';
import { usePlatform } from '@platform/ui-sdk';
import { SidebarMenu } from './layout/SidebarMenu';
import { TopModuleTabs } from './layout/TopModuleTabs';
import { LandingAndAuth } from './pages/LandingAndAuth';
import { SuperAdminPanel } from './pages/SuperAdminPanel';

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
  const { activeServiceKey, catalog, tenant, apiGetText, refreshBootstrap } = usePlatform();
  const [RemoteView, setRemoteView] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [attempt, setAttempt] = useState<number>(0);

  const svc = catalog.find((item) => item.serviceKey === activeServiceKey);

  useEffect(() => {
    if (!svc) return;
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
  }, [svc, apiGetText, attempt]);

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

  if (loading) {
    return (
      <div className="pk-card">
        <div className="pk-card-body">Cargando componente {svc.displayName}...</div>
      </div>
    );
  }

  if (errorMsg || !RemoteView) {
    return (
      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">{svc.displayName} — Servicio No Disponible</div>
          <button
            type="button"
            className="pk-btn pk-btn-primary pk-btn-sm"
            onClick={handleRetryRemote}
          >
            Reintentar Conexión
          </button>
        </div>
        <div className="pk-card-body" style={{ color: 'var(--pk-muted)' }}>
          {errorMsg || 'Verifica la disponibilidad de red del microservicio configurado.'}
        </div>
      </div>
    );
  }

  const stageKey = `${svc.serviceKey}:${tenant?.tenantId || 'none'}`;
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
  const { publicView, token, tenant, role, username, logout, impersonateTenant } = usePlatform();
  const [impersonatingWorkstation, setImpersonatingWorkstation] = useState<boolean>(false);

  const isSuperAdmin = role === 'superadmin';

  useEffect(() => {
    if (publicView !== 'app' || !isSuperAdmin) {
      setImpersonatingWorkstation(false);
    }
  }, [publicView, isSuperAdmin]);

  const hasActiveSession =
    Boolean(token || tenant) ||
    (typeof window !== 'undefined' && localStorage.getItem('pk_has_session') === '1');

  if (publicView !== 'app' || !hasActiveSession) {
    return <LandingAndAuth />;
  }

  if (isSuperAdmin && !impersonatingWorkstation) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
        <header className="pk-topbar" style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
          <div className="pk-brand">
            <span style={{ background: '#2563eb', padding: '4px 9px', borderRadius: 7, fontSize: 14 }}>◆</span>
            <span>PROVEKO — CONSOLA CORPORATIVA SUPERADMIN</span>
            <span className="pk-badge pk-badge-emerald" style={{ marginLeft: 8 }}>
              Gobierno Global
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                background: '#1e293b',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: 7,
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {username || 'SuperAdmin'}
            </span>
            <button type="button" className="pk-btn pk-btn-danger pk-btn-sm" onClick={() => void logout()}>
              Cerrar Sesión
            </button>
          </div>
        </header>
        <main className="pk-stage" style={{ maxWidth: 1520, width: '100%', margin: '0 auto' }}>
          <SuperAdminPanel
            onEnterWorkstation={(targetTenantId) => {
              void (async () => {
                await impersonateTenant(targetTenantId);
                setImpersonatingWorkstation(true);
              })();
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="pk-shell">
      <SidebarMenu
        showAdminPanel={false}
        onToggleAdminPanel={(show) => {
          if (show) setImpersonatingWorkstation(false);
        }}
      />
      <div className="pk-main">
        {isSuperAdmin && impersonatingWorkstation && (
          <div
            role="region"
            aria-label="Modo Impersonación Corporativa"
            style={{
              background: '#1e3a8a',
              color: '#ffffff',
              padding: '8px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              fontSize: 12.5,
              fontWeight: 700,
              borderBottom: '1px solid #1d4ed8',
            }}
          >
            <span>
              Modo Impersonación Corporativa Activo: Operando en{' '}
              <strong>{tenant?.companyName || 'Empresa'}</strong> (NIT {tenant?.nit || 'N/A'})
            </span>
            <button
              type="button"
              className="pk-btn pk-btn-sm"
              style={{ background: '#ffffff', color: '#0f172a', fontWeight: 800 }}
              onClick={() => setImpersonatingWorkstation(false)}
            >
              Salir de Impersonación / Volver al Panel Corporativo
            </button>
          </div>
        )}
        <TopModuleTabs
          showAdminPanel={false}
          onOpenAdmin={() => setImpersonatingWorkstation(false)}
        />
        <main className="pk-stage">
          <RemoteServiceStage />
        </main>
      </div>
    </div>
  );
};
