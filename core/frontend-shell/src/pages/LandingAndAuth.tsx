import React, { useState } from 'react';
import { useProveko, TenantRecord } from '@proveko/ui-sdk';

const INDUSTRY_PRESETS: Record<string, { label: string; services: string[] }> = {
  full: {
    label: '✨ Suite Empresarial Completa (Todos los 15 Microservicios)',
    services: [],
  },
  comercio: {
    label: '🛒 Comercio, Almacén y Punto de Venta',
    services: ['ms-facturacion', 'ms-clientes', 'ms-inventario', 'ms-caja', 'ms-compras', 'ms-reportes', 'ms-impresiones'],
  },
  taller: {
    label: '🔧 Taller Automotriz, Repuestos y Comisiones',
    services: ['ms-facturacion', 'ms-taller', 'ms-clientes', 'ms-inventario', 'ms-caja', 'ms-compras', 'ms-reportes', 'ms-impresiones'],
  },
  restaurante: {
    label: '🍽️ Restaurante, Gastrobar y Cocina',
    services: ['ms-comandas', 'ms-facturacion', 'ms-inventario', 'ms-caja', 'ms-compras', 'ms-reportes', 'ms-impresiones'],
  },
  hotel: {
    label: '🏨 Hotel, Cabañas y Alojamiento',
    services: ['ms-hoteleria', 'ms-comandas', 'ms-facturacion', 'ms-clientes', 'ms-caja', 'ms-agenda', 'ms-reportes', 'ms-impresiones'],
  },
  bascula: {
    label: '⚖️ Báscula Camionera, Transporte y Logística',
    services: ['ms-bascula', 'ms-clientes', 'ms-facturacion', 'ms-inventario', 'ms-caja', 'ms-reportes', 'ms-impresiones'],
  },
};

export const LandingAndAuth: React.FC = () => {
  const { publicView, setPublicView, apiPost, loginWithToken, refreshBootstrap, catalog, toast } = useProveko();

  const [username, setUsername] = useState('admin@empresa.co');
  const [password, setPassword] = useState('admin123');

  const [companyName, setCompanyName] = useState('');
  const [nit, setNit] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState('Proveko2026*');
  const [preset, setPreset] = useState('full');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiPost<{
      token: string;
      role: string;
      username: string;
      tenant: TenantRecord;
    }>('/api/v1/core/login', { username, password });
    loginWithToken(res.token, res.role, res.username, res.tenant);
    await refreshBootstrap();
    toast(`Bienvenido, ${res.username}`);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedSvcs = INDUSTRY_PRESETS[preset]?.services || [];
    let activeModules: string[] = [];
    let activeFeatures: string[] = [];
    if (selectedSvcs.length > 0) {
      for (const svc of catalog) {
        if (selectedSvcs.includes(svc.serviceKey)) {
          activeModules = activeModules.concat(svc.modules.map((m) => m.moduleKey));
          activeFeatures = activeFeatures.concat((svc.features || []).map((f) => f.featureKey));
        }
      }
    }

    const res = await apiPost<{ token: string; tenant: TenantRecord }>('/api/v1/core/register', {
      companyName,
      nit,
      adminUsername: adminEmail,
      password: adminPass,
      businessPreset: preset,
      activeServices: selectedSvcs,
      activeModules,
      activeFeatures,
    });
    await refreshBootstrap();
    loginWithToken(res.token, 'cliente', res.tenant.adminUsername, res.tenant);
    toast(`Empresa "${res.tenant.companyName}" creada con su base de datos ${res.tenant.dbName}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#ffffff', display: 'flex', flexDirection: 'column' }}>
      <header className="pk-topbar" style={{ borderBottomColor: '#1e293b' }}>
        <div className="pk-brand">
          <span style={{ background: '#2563eb', padding: '4px 9px', borderRadius: 7 }}>◆</span>
          <span>PROVEKO EMPRESARIAL</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => setPublicView('app')}>
            🚀 Volver al Sistema Operativo
          </button>
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
              Plataforma Empresarial Multi-Industria con Base de Datos Independiente por Cliente
            </span>
            <h1 style={{ fontSize: 40, fontWeight: 900, margin: '18px 0 12px', lineHeight: 1.15 }}>
              Todo tu negocio conectado en una sola estación rápida, clara y modular
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 16, maxWidth: 720, margin: '0 auto 28px' }}>
              Facturación POS, Inventario Multi-Bodega, Taller Automotriz, Hotelería, Comandas de Restaurante, Báscula Camionera, Cartera, Contabilidad e Impresión universal.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="pk-btn pk-btn-primary" style={{ padding: '12px 22px', fontSize: 14 }} onClick={() => setPublicView('app')}>
                ⚡ Entrar Directo a la Demo Operativa
              </button>
              <button type="button" className="pk-btn pk-btn-emerald" style={{ padding: '12px 22px', fontSize: 14 }} onClick={() => setPublicView('register')}>
                🏢 Crear Nueva Empresa (BD Aislada)
              </button>
            </div>
          </div>
        )}

        {publicView === 'login' && (
          <div className="pk-card" style={{ maxWidth: 460, color: 'var(--pk-text)' }}>
            <div className="pk-card-head">
              <div className="pk-card-title">🔐 Ingresar a Proveko</div>
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => setPublicView('register')}>
                Crear Empresa
              </button>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="pk-field">
                  <label>Correo o Usuario</label>
                  <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin@empresa.co o superadmin@proveko.com" />
                </div>
                <div className="pk-field">
                  <label>Contraseña</label>
                  <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', background: '#f8fafc', padding: 10, borderRadius: 8 }}>
                  💡 <strong>Acceso rápido:</strong> Usa <code>superadmin@proveko.com</code> para administrar licencias de Microservicios, Módulos y Funcionalidades, o <code>admin@empresa.co</code> como cliente.
                </div>
                <button type="submit" className="pk-btn pk-btn-primary">Ingresar a mi Estación</button>
              </form>
            </div>
          </div>
        )}

        {publicView === 'register' && (
          <div className="pk-card" style={{ maxWidth: 560, color: 'var(--pk-text)' }}>
            <div className="pk-card-head">
              <div className="pk-card-title">🏢 Aprovisionar Nueva Empresa (1 Base de Datos Propia)</div>
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => setPublicView('login')}>
                Ya tengo cuenta
              </button>
            </div>
            <div className="pk-card-body">
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="pk-field">
                  <label>Razón Social / Nombre del Negocio *</label>
                  <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ej: Serviteca El Motor SAS" />
                </div>
                <div className="pk-field">
                  <label>NIT / Identificación Tributaria *</label>
                  <input required value={nit} onChange={(e) => setNit(e.target.value)} placeholder="Ej: 901.552.310-1" />
                </div>
                <div className="pk-field">
                  <label>Giro Principal del Negocio (Activa sus Microservicios)</label>
                  <select value={preset} onChange={(e) => setPreset(e.target.value)}>
                    {Object.entries(INDUSTRY_PRESETS).map(([key, item]) => (
                      <option key={key} value={key}>{item.label}</option>
                    ))}
                  </select>
                </div>
                <div className="pk-field">
                  <label>Correo Administrador *</label>
                  <input required type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="gerencia@minegocio.co" />
                </div>
                <div className="pk-field">
                  <label>Contraseña *</label>
                  <input required type="password" value={adminPass} onChange={(e) => setAdminPass(e.target.value)} />
                </div>
                <button type="submit" className="pk-btn pk-btn-emerald">🚀 Crear Base de Datos y Entrar</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
