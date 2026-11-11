import React, { useMemo } from 'react';
import { usePlatform } from '@platform/ui-sdk';

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
    activeSubmoduleKey,
    setActiveSubmoduleKey,
    hasService,
    hasModule,
    hasSubmodule,
    roleViewFilter,
    setRoleViewFilter,
    logout,
    impersonateTenant,
  } = usePlatform();

  const currentService = catalog.find((s) => s.serviceKey === activeServiceKey);
  const activeModules = (currentService?.modules || []).filter((m) => hasModule(m.moduleKey));
  const activeSubmodules = (currentService?.submodules || []).filter(
    (sm) => sm.dependsOnModule === activeModuleKey && hasSubmodule(activeModuleKey, sm.submoduleKey)
  );

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const svc of catalog) {
      if (hasService(svc.serviceKey) && svc.category && svc.category !== 'Transversal') {
        set.add(svc.category);
      }
    }
    return Array.from(set);
  }, [catalog, hasService]);

  const handleSwitchTenant = (tenantId: string) => {
    if (tenantId && tenantId !== tenant?.tenantId) {
      void impersonateTenant(tenantId);
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
          {role === 'superadmin' && tenantsList.filter((t) => t.status !== 'SUSPENDED').length > 1 && (
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
              {tenantsList
                .filter((t) => t.status !== 'SUSPENDED')
                .map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.companyName} — NIT {t.nit}
                  </option>
                ))}
            </select>
          )}

          <select
            aria-label="Filtrar por área funcional"
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
            <option value="ALL">Vista: Todas las Áreas</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                Área: {cat}
              </option>
            ))}
          </select>

          {role === 'superadmin' && (
            <button
              type="button"
              className="pk-btn pk-btn-sm"
              style={{ background: '#1e293b', color: '#fff', borderColor: '#334155' }}
              onClick={onOpenAdmin}
            >
              Panel Corporativo
            </button>
          )}

          <span
            style={{
              background: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #334155',
              borderRadius: 7,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {username}
          </span>

          <button type="button" className="pk-btn pk-btn-danger pk-btn-sm" onClick={() => void logout()}>
            Cerrar Sesión
          </button>
        </div>
      </header>

      {!showAdminPanel && activeModules.length > 0 && (
        <nav className="pk-module-tabs" aria-label="Módulos del servicio activo">
          {activeModules.map((mod) => {
            const active = mod.moduleKey === activeModuleKey;
            return (
              <button
                type="button"
                key={mod.moduleKey}
                className={`pk-module-tab ${active ? 'active' : ''}`}
                onClick={() => setActiveModuleKey(mod.moduleKey)}
              >
                <span>{mod.tabIcon}</span>
                <span>{mod.displayName}</span>
              </button>
            );
          })}
        </nav>
      )}

      {!showAdminPanel && activeSubmodules.length > 0 && (
        <div
          aria-label="Submódulos habilitados"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            padding: '7px 22px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            fontSize: 12,
          }}
        >
          <span style={{ fontWeight: 800, color: '#475569' }}>Submódulos activos:</span>
          {activeSubmodules.map((sm) => {
            const selected = sm.submoduleKey === activeSubmoduleKey;
            return (
              <button
                type="button"
                key={sm.submoduleKey}
                onClick={() => setActiveSubmoduleKey(sm.submoduleKey)}
                style={{
                  border: selected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  background: selected ? '#eff6ff' : '#ffffff',
                  color: selected ? '#1d4ed8' : '#334155',
                  borderRadius: 999,
                  padding: '3px 10px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {sm.displayName}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};
