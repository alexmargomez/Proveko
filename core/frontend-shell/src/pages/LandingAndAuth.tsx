import React, { useState } from 'react';
import { formatCop, TenantSummary, useAsyncAction, usePlatform } from '@platform/ui-sdk';
import { PkIcon } from '../components/ServiceIcons';
import { RegistrationWizard } from './RegistrationWizard';

export const LandingAndAuth: React.FC = () => {
  const {
    publicView,
    setPublicView,
    token,
    tenant,
    catalog,
    businessPresets,
    apiPost,
    loginWithToken,
    startDemoSession,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();
  const isAuthenticated = Boolean(token || tenant);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPresetForWizard, setSelectedPresetForWizard] = useState<string | undefined>(undefined);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await apiPost<{
        token: string;
        role: string;
        internalRole?: string;
        username: string;
        fullName?: string;
        isCompanyAdmin?: boolean;
        isDemo?: boolean;
        tenant: TenantSummary;
        companyTenant?: TenantSummary;
      }>('/api/v1/core/login', { username, password });
      loginWithToken(res.token, res.role, res.username, res.tenant, {
        fullName: res.fullName,
        internalRole: res.internalRole,
        isCompanyAdmin: res.isCompanyAdmin,
        isDemo: res.isDemo,
        companyTenant: res.companyTenant || res.tenant,
      });
      toast(`Sesión iniciada como ${res.fullName || res.username}`);
    });
  };

  const handleLaunchDemo = (rolePreview = 'admin_empresa') => {
    void run(async () => {
      await startDemoSession(rolePreview);
      toast('Modo Demostración Activo — Explora todas las áreas libremente');
    });
  };

  const openWizardWithPreset = (presetKey?: string) => {
    setSelectedPresetForWizard(presetKey);
    setPublicView('register');
  };

  const activeAuthMode = publicView === 'register' ? 'register' : publicView === 'login' ? 'login' : 'showcase';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--pk-bg)', display: 'flex', flexDirection: 'column' }}>
      <header className="pk-topbar">
        <button
          type="button"
          className="pk-brand"
          style={{ cursor: 'pointer' }}
          onClick={() => setPublicView('landing')}
        >
          <span className="pk-logo-box">PK</span>
          <div className="pk-brand-meta">
            <div className="pk-brand-title">
              <span>PROVEKO</span>
              <span className="pk-hide-xs" style={{ color: '#cbd5e1', fontWeight: 400 }}>|</span>
              <span className="pk-hide-xs" style={{ color: 'var(--pk-primary)', fontWeight: 700, fontSize: 13.5 }}>
                {activeAuthMode === 'showcase'
                  ? 'Soluciones para tu Empresa'
                  : activeAuthMode === 'register'
                  ? 'Configura tu Empresa'
                  : 'Iniciar Sesión'}
              </span>
            </div>
            <div className="pk-brand-sub">Sistema Integrado de Ventas, Inventario, Operaciones y Finanzas</div>
          </div>
        </button>

        <nav className="pk-surface-tabs" aria-label="Navegación principal pública">
          <button
            type="button"
            className={`pk-surface-tab ${activeAuthMode === 'showcase' ? 'active' : ''}`}
            onClick={() => setPublicView('landing')}
          >
            <span>Muestra de la Plataforma</span>
          </button>
          <button
            type="button"
            className={`pk-surface-tab ${activeAuthMode === 'login' || activeAuthMode === 'register' ? 'active' : ''}`}
            onClick={() => setPublicView(activeAuthMode === 'register' ? 'register' : 'login')}
          >
            <span>Login / Registra tu Negocio</span>
          </button>
          <button
            type="button"
            className="pk-surface-tab"
            disabled={busy}
            onClick={() => {
              if (isAuthenticated) {
                setPublicView('app');
              } else {
                handleLaunchDemo('admin_empresa');
              }
            }}
          >
            <span>{isAuthenticated ? 'Volver a mi Estación' : 'Demo en Vivo'}</span>
          </button>
        </nav>

        <div className="pk-row-actions pk-hide-mobile">
          {isAuthenticated ? (
            <button type="button" className="pk-btn pk-btn-primary pk-btn-sm" onClick={() => setPublicView('app')}>
              Ir a mi Estación Activa →
            </button>
          ) : (
            <>
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => setPublicView('login')}>
                Iniciar Sesión
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-primary pk-btn-sm"
                onClick={() => openWizardWithPreset(undefined)}
              >
                Crear Cuenta para mi Negocio
              </button>
            </>
          )}
        </div>
      </header>

      <main className="pk-public-container" style={{ flex: 1 }}>
        {publicView === 'landing' && (
          <div className="pk-stack" style={{ gap: 22 }}>
            <section className="pk-hero-banner">
              <div>
                <span className="pk-hero-badge">SISTEMA DE VENTAS, INVENTARIO Y CONTROL DE NEGOCIOS</span>
                <h1 className="pk-hero-title">
                  Administra tu negocio de forma fácil: Facturación, Inventario, Comandas, Taller, Hotelería y Caja en un solo lugar.
                </h1>
                <p style={{ color: '#dbeafe', fontSize: 15, lineHeight: 1.6, margin: '0 0 22px', maxWidth: 680 }}>
                  Elige el tipo de negocio que tienes, personaliza las herramientas para cada área y crea usuarios con permisos individuales para tus cajeros, meseros, bodegueros, técnicos o contadores.
                </p>
                <div className="pk-row-actions" style={{ gap: 10 }}>
                  <button
                    type="button"
                    className="pk-btn pk-btn-amber-brand"
                    style={{ padding: '11px 20px', fontSize: 13.5 }}
                    onClick={() => openWizardWithPreset(undefined)}
                  >
                    Crear Cuenta para mi Negocio →
                  </button>
                  <button
                    type="button"
                    className="pk-btn pk-btn-hero-outline"
                    style={{ padding: '11px 18px', fontSize: 13.5 }}
                    disabled={busy}
                    onClick={() => handleLaunchDemo('admin_empresa')}
                  >
                    {busy ? 'Abriendo Demo...' : 'Probar Demostración en Vivo (1 Clic)'}
                  </button>
                  <button
                    type="button"
                    className="pk-btn pk-btn-hero-outline"
                    style={{ padding: '11px 18px', fontSize: 13.5 }}
                    onClick={() => setPublicView('login')}
                  >
                    Iniciar Sesión
                  </button>
                </div>
              </div>

              <div className="pk-quote-card">
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      color: '#fde68a',
                      fontWeight: 800,
                    }}
                  >
                    Listo para operar hoy mismo
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, margin: '6px 0 12px' }}>
                    Todo lo que tu empresa y tu equipo necesitan
                  </div>
                  <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.75 }}>
                    <div>✓ Punto de Venta rápido, Cotizaciones y Facturación.</div>
                    <div>✓ Inventario Multi-Bodega, Compras y Cuentas por Cobrar.</div>
                    <div>✓ Mesas/Comandas, Taller, Hotelería y Báscula Camionera.</div>
                    <div>✓ Usuarios por cargo: asigna qué servicios ve cada trabajador.</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="pk-btn pk-btn-emerald"
                  style={{ width: '100%', marginTop: 16, padding: '11px 16px', fontSize: 13.5 }}
                  onClick={() => openWizardWithPreset('comercio')}
                >
                  Configurar mi Plan Ahora →
                </button>
              </div>
            </section>

            {businessPresets.length > 0 && (
              <section className="pk-card">
                <div className="pk-card-head" style={{ background: '#ffffff', padding: '15px 20px' }}>
                  <div>
                    <div className="pk-card-title" style={{ fontSize: 16.5 }}>
                      Planes según tu Tipo de Negocio
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--pk-muted)', marginTop: 2 }}>
                      Selecciona tu actividad para iniciar el asistente paso a paso con los módulos ideales preseleccionados.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pk-btn pk-btn-primary pk-btn-sm"
                    onClick={() => openWizardWithPreset(undefined)}
                  >
                    Armar Plan Personalizado
                  </button>
                </div>
                <div className="pk-card-body">
                  <div className="pk-plan-grid">
                    {businessPresets.map((preset) => (
                      <div key={preset.key} className="pk-plan-card">
                        <div>
                          <div className="pk-row-between" style={{ marginBottom: 8 }}>
                            <span className="pk-badge pk-badge-blue">{preset.badge}</span>
                            <span
                              style={{
                                fontWeight: 900,
                                fontSize: 14.5,
                                color: 'var(--pk-primary)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {formatCop(preset.baseMonthlyCop)}/mes
                            </span>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--pk-navy)', marginBottom: 6 }}>
                            {preset.name}
                          </div>
                          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--pk-muted)', lineHeight: 1.5 }}>
                            {preset.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="pk-btn pk-btn-outline pk-btn-sm"
                          style={{ width: '100%' }}
                          onClick={() => openWizardWithPreset(preset.key)}
                        >
                          Elegir este Plan →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {catalog.length > 0 && (
              <section className="pk-card">
                <div className="pk-card-head" style={{ background: '#ffffff', padding: '15px 20px' }}>
                  <div>
                    <div className="pk-card-title" style={{ fontSize: 16.5 }}>
                      Áreas y Módulos Disponibles en la Plataforma
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--pk-muted)', marginTop: 2 }}>
                      Activa únicamente los centros operativos que requiere tu empresa y amplíalos cuando crezcas.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    disabled={busy}
                    onClick={() => handleLaunchDemo('admin_empresa')}
                  >
                    Probarlos en Vivo en el Demo →
                  </button>
                </div>
                <div className="pk-card-body">
                  <div className="pk-plan-grid">
                    {catalog.map((svc) => (
                      <div key={svc.serviceKey} className="pk-plan-card">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <span
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 9,
                                background: '#eff6ff',
                                color: 'var(--pk-primary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <PkIcon name={svc.serviceKey} size={19} />
                            </span>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--pk-navy)' }}>
                                {svc.displayName}
                              </div>
                              <span className="pk-badge pk-badge-slate">{svc.category}</span>
                            </div>
                          </div>
                          <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--pk-muted)', lineHeight: 1.45 }}>
                            {svc.summary}
                          </p>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {(svc.modules || []).map((mod) => (
                              <span
                                key={mod.moduleKey}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0',
                                  color: '#334155',
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                }}
                              >
                                {mod.displayName}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {(publicView === 'login' || publicView === 'register' || (publicView === 'app' && !isAuthenticated)) && (
          <div className="pk-stack">
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
              <button
                type="button"
                className={`pk-btn ${publicView !== 'register' ? 'pk-btn-primary' : 'pk-btn-outline'}`}
                onClick={() => setPublicView('login')}
              >
                Iniciar Sesión en mi Empresa
              </button>
              <button
                type="button"
                className={`pk-btn ${publicView === 'register' ? 'pk-btn-primary' : 'pk-btn-outline'}`}
                onClick={() => openWizardWithPreset(undefined)}
              >
                Crear Cuenta Paso a Paso
              </button>
            </div>

            {publicView === 'register' ? (
              <RegistrationWizard
                initialPresetKey={selectedPresetForWizard}
                onSwitchToLogin={() => setPublicView('login')}
              />
            ) : (
              <div className="pk-card" style={{ maxWidth: 450, width: '100%', margin: '8px auto 0' }}>
                <div className="pk-card-head" style={{ background: '#ffffff', padding: '16px 20px' }}>
                  <div>
                    <div className="pk-card-title" style={{ fontSize: 17 }}>
                      Iniciar Sesión
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
                      Ingresa con tu cuenta de administrador o de trabajador asignado
                    </div>
                  </div>
                </div>
                <div className="pk-card-body" style={{ padding: 20 }}>
                  <form onSubmit={handleLogin} className="pk-stack">
                    <div className="pk-field">
                      <label htmlFor="pk-login-user">Usuario o Correo Electrónico</label>
                      <input
                        id="pk-login-user"
                        type="text"
                        required
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="usuario@empresa.co"
                      />
                    </div>
                    <div className="pk-field">
                      <label htmlFor="pk-login-pass">Contraseña</label>
                      <input
                        id="pk-login-pass"
                        type="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <button
                      type="submit"
                      className="pk-btn pk-btn-primary"
                      disabled={busy}
                      style={{ width: '100%', padding: '11px', marginTop: 4, fontSize: 13.5 }}
                    >
                      {busy ? 'Validando acceso...' : 'Entrar al Sistema'}
                    </button>
                  </form>

                  <div
                    style={{
                      marginTop: 16,
                      paddingTop: 14,
                      borderTop: '1px solid var(--pk-border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="pk-btn pk-btn-outline"
                      style={{ width: '100%' }}
                      disabled={busy}
                      onClick={() => handleLaunchDemo('admin_empresa')}
                    >
                      Explorar Demostración en Vivo sin Registro
                    </button>
                    <div className="pk-row-between" style={{ fontSize: 12.5, paddingTop: 4 }}>
                      <span style={{ color: 'var(--pk-muted)' }}>¿Aún no registras tu empresa?</span>
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        onClick={() => openWizardWithPreset(undefined)}
                      >
                        Crear Cuenta →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
