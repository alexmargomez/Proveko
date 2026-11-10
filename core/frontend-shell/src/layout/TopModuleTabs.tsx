import React from 'react';
import { useProveko } from '@proveko/ui-sdk';

export const TopModuleTabs: React.FC<{
  showAdminPanel: boolean;
  onOpenAdmin: () => void;
}> = ({ showAdminPanel, onOpenAdmin }) => {
  const {
    tenant,
    tenantsList,
    username,
    role,
    catalog,
    activeServiceKey,
    activeModuleKey,
    setActiveModuleKey,
    hasModule,
    roleViewFilter,
    setRoleViewFilter,
    setPublicView,
    logout,
    loginWithToken,
  } = useProveko();

  const currentService = catalog.find((s) => s.serviceKey === activeServiceKey);
  const activeModules = (currentService?.modules || []).filter((m) => hasModule(m.moduleKey));

  const handleSwitchTenant = (tenantId: string) => {
    const found = tenantsList.find((t) => t.tenantId === tenantId);
    if (found) {
      loginWithToken('', role, username, found);
    }
  };

  return (
    <>
      <header className="pk-topbar">
        <div className="pk-brand">
          <span style={{ background: '#2563eb', padding: '4px 9px', borderRadius: 7, fontSize: 14 }}>◆</span>
          <span>PROVEKO</span>
          {tenant && (
            <span className="pk-badge pk-badge-blue" style={{ marginLeft: 6 }}>
              {tenant.companyName}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {tenantsList.length > 1 && (
            <select
              aria-label="Cambiar empresa activa"
              value={tenant?.tenantId || ''}
              onChange={(e) => handleSwitchTenant(e.target.value)}
              style={{
                background: '#1e293b',
                color: '#fff',
                border: '1px solid #334155',
                borderRadius: 7,
                padding: '5px 9px',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {tenantsList.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>
                  🏢 {t.companyName} ({t.dbName})
                </option>
              ))}
            </select>
          )}

          <select
            aria-label="Vista por puesto de trabajo"
            value={roleViewFilter}
            onChange={(e) => setRoleViewFilter(e.target.value)}
            style={{
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #334155',
              borderRadius: 7,
              padding: '5px 9px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <option value="ALL">👤 Vista: Todos los Módulos</option>
            <option value="CAJERO">🛒 Puesto: Cajero / Ventas</option>
            <option value="MESERO">🍽️ Puesto: Mesero / Comandas</option>
            <option value="RECEPCION">🏨 Puesto: Recepción / Hotel</option>
            <option value="TALLER_BODEGA">🔧 Puesto: Taller / Bodega / Báscula</option>
            <option value="GERENCIA">📊 Puesto: Gerencia y Contabilidad</option>
          </select>

          <button
            type="button"
            className="pk-btn pk-btn-sm"
            style={{ background: '#1e293b', color: '#fff', borderColor: '#334155' }}
            onClick={onOpenAdmin}
          >
            ⚙️ Licencias
          </button>

          <button
            type="button"
            className="pk-btn pk-btn-sm"
            style={{ background: '#1e293b', color: '#cbd5e1', borderColor: '#334155' }}
            onClick={() => setPublicView('login')}
          >
            🔐 Cuenta ({username})
          </button>

          {role !== 'cliente' && (
            <button type="button" className="pk-btn pk-btn-danger pk-btn-sm" onClick={logout}>
              Salir
            </button>
          )}
        </div>
      </header>

      {!showAdminPanel && currentService && (
        <div className="pk-subtabs-bar">
          <div className="pk-subtabs-list">
            {activeModules.map((mod) => (
              <button
                key={mod.moduleKey}
                type="button"
                className={`pk-tab-pill ${activeModuleKey === mod.moduleKey ? 'active' : ''}`}
                onClick={() => setActiveModuleKey(mod.moduleKey)}
              >
                {mod.tabIcon} {mod.displayName}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'var(--pk-muted)', fontWeight: 600 }}>
            {currentService.summary}
          </div>
        </div>
      )}
    </>
  );
};
