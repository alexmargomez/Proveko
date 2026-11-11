import React, { useState } from 'react';
import { usePlatform, useAsyncAction, TenantSummary } from '@platform/ui-sdk';

const INDUSTRY_PRESETS: Record<string, { label: string; categories: string[] }> = {
  full: {
    label: 'Suite Empresarial Completa (Todas las Áreas)',
    categories: [],
  },
  comercio: {
    label: 'Comercio, Almacén y Punto de Venta',
    categories: ['Comercial', 'Logística', 'Finanzas', 'Abastecimiento', 'Gerencia', 'Transversal'],
  },
  automotriz: {
    label: 'Centro Automotriz, Repuestos y Comisiones',
    categories: ['Comercial', 'Automotriz', 'Logística', 'Finanzas', 'Abastecimiento', 'Gerencia', 'Transversal'],
  },
  restaurante: {
    label: 'Restaurante, Gastrobar y Cocina',
    categories: ['Gastronomía', 'Comercial', 'Logística', 'Finanzas', 'Abastecimiento', 'Gerencia', 'Transversal'],
  },
  hotel: {
    label: 'Hotel, Cabañas y Alojamiento',
    categories: ['Hospitalidad', 'Gastronomía', 'Comercial', 'Servicios', 'Finanzas', 'Gerencia', 'Transversal'],
  },
  logistica: {
    label: 'Báscula Camionera, Transporte y Logística',
    categories: ['Logística Pesada', 'Comercial', 'Logística', 'Finanzas', 'Gerencia', 'Transversal'],
  },
};

export const LandingAndAuth: React.FC = () => {
  const { publicView, setPublicView, token, tenant, role, apiPost, loginWithToken, refreshBootstrap, catalog, toast } = usePlatform();
  const { busy, run } = useAsyncAction();
  const isAuthenticated = Boolean(token || tenant);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [nit, setNit] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [preset, setPreset] = useState('full');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await apiPost<{
        token: string;
        role: string;
        username: string;
        tenant: TenantSummary;
      }>('/api/v1/core/login', { username, password });
      loginWithToken(res.token, res.role, res.username, res.tenant);
      await refreshBootstrap();
      toast(`Sesión iniciada como ${res.username}`);
    });
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const allowedCategories = INDUSTRY_PRESETS[preset]?.categories || [];
      let activeServices: string[] = [];
      let activeModules: string[] = [];
      let activeSubmodules: string[] = [];
      let activeFeatures: string[] = [];

      if (allowedCategories.length > 0 && catalog.length > 0) {
        for (const svc of catalog) {
          if (allowedCategories.includes(svc.category)) {
            activeServices.push(svc.serviceKey);
            activeModules = activeModules.concat(svc.modules.map((m) => m.moduleKey));
            activeSubmodules = activeSubmodules.concat((svc.submodules || []).map((sm) => sm.submoduleKey));
            activeFeatures = activeFeatures.concat((svc.features || []).map((f) => f.featureKey));
          }
        }
      }

      const res = await apiPost<{ token?: string; role: string; tenant: TenantSummary }>('/api/v1/core/register', {
        companyName,
        nit,
        adminUsername: adminEmail,
        password: adminPass,
        businessPreset: preset,
        activeServices,
        activeModules,
        activeSubmodules,
        activeFeatures,
      });
      if (role === 'superadmin' && res.role === 'superadmin') {
        await refreshBootstrap();
        setPublicView('app');
        toast(`Empresa "${res.tenant.companyName}" aprovisionada correctamente`);
        return;
      }
      loginWithToken(res.token || '', res.role || 'cliente', res.tenant.adminUsername, res.tenant);
      await refreshBootstrap();
      toast(`Empresa "${res.tenant.companyName}" aprovisionada correctamente`);
    });
  };

  const goStationOrLogin = () => {
    setPublicView(isAuthenticated ? 'app' : 'login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#ffffff', display: 'flex', flexDirection: 'column' }}>
      <header className="pk-topbar" style={{ borderBottomColor: '#1e293b' }}>
        <div className="pk-brand">
          <span style={{ background: '#2563eb', padding: '4px 9px', borderRadius: 7 }}>◆</span>
          <span>PROVEKO EMPRESARIAL</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isAuthenticated && (
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={goStationOrLogin}>
              Ir a la Estación
            </button>
          )}
          <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => setPublicView('login')}>
            Iniciar Sesión
          </button>
          <button type="button" className="pk-btn pk-btn-primary pk-btn-sm" onClick={() => setPublicView('register')}>
            Crear Empresa Nueva
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {publicView === 'landing' && (
          <div style={{ maxWidth: 920, textAlign: 'center' }}>
            <span className="pk-badge pk-badge-blue" style={{ fontSize: 12, padding: '5px 12px' }}>
              Plataforma Empresarial Distribuida Multi-Empresa
            </span>
            <h1 style={{ fontSize: 40, fontWeight: 900, margin: '18px 0 12px', lineHeight: 1.15 }}>
              Gestión modular integrada para comercio, logística, servicios e industria
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 16, maxWidth: 720, margin: '0 auto 28px' }}>
              Facturación, Inventario Multi-Bodega, Órdenes de Servicio, Hotelería, Comandas Gastronómicas, Pesaje Camionero, Cartera, Contabilidad y Documentos Corporativos.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="pk-btn pk-btn-primary"
                style={{ padding: '12px 22px', fontSize: 14 }}
                onClick={goStationOrLogin}
              >
                {isAuthenticated ? 'Continuar en la Estación' : 'Iniciar Sesión Operativa'}
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-emerald"
                style={{ padding: '12px 22px', fontSize: 14 }}
                onClick={() => setPublicView('register')}
              >
                Registrar Nueva Empresa
              </button>
            </div>
          </div>
        )}

        {(publicView === 'login' || (publicView === 'app' && !isAuthenticated)) && (
          <div className="pk-card" style={{ maxWidth: 460, color: 'var(--pk-text)' }}>
            <div className="pk-card-head">
              <div className="pk-card-title">Iniciar Sesión Corporativa</div>
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => setPublicView('register')}>
                Crear Empresa
              </button>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="pk-field">
                  <label htmlFor="login-user">Correo Electrónico</label>
                  <input
                    id="login-user"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="usuario@empresa.com"
                  />
                </div>
                <div className="pk-field">
                  <label htmlFor="login-pass">Contraseña</label>
                  <input
                    id="login-pass"
                    required
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                  {busy ? 'Verificando...' : 'Ingresar'}
                </button>
              </form>
            </div>
          </div>
        )}

        {publicView === 'register' && (
          <div className="pk-card" style={{ maxWidth: 560, color: 'var(--pk-text)' }}>
            <div className="pk-card-head">
              <div className="pk-card-title">Aprovisionar Nueva Empresa</div>
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => setPublicView('login')}>
                Ya tengo cuenta
              </button>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="pk-field">
                  <label htmlFor="reg-company">Razón Social / Nombre del Negocio *</label>
                  <input
                    id="reg-company"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ej: Comercializadora Andina S.A.S."
                  />
                </div>
                <div className="pk-field">
                  <label htmlFor="reg-nit">NIT / Identificación Tributaria *</label>
                  <input
                    id="reg-nit"
                    required
                    value={nit}
                    onChange={(e) => setNit(e.target.value)}
                    placeholder="Ej: 901.552.310-1"
                  />
                </div>
                <div className="pk-field">
                  <label htmlFor="reg-preset">Actividad Económica Principal</label>
                  <select id="reg-preset" value={preset} onChange={(e) => setPreset(e.target.value)}>
                    {Object.entries(INDUSTRY_PRESETS).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pk-field">
                  <label htmlFor="reg-email">Correo Administrador *</label>
                  <input
                    id="reg-email"
                    required
                    type="email"
                    autoComplete="username"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="gerencia@empresa.com"
                  />
                </div>
                <div className="pk-field">
                  <label htmlFor="reg-pass">Contraseña (mínimo 8 caracteres) *</label>
                  <input
                    id="reg-pass"
                    required
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <button type="submit" className="pk-btn pk-btn-emerald" disabled={busy}>
                  {busy ? 'Aprovisionando...' : 'Crear Empresa y Acceder'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
