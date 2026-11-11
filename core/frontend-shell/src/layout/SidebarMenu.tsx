import React from 'react';
import { usePlatform } from '@platform/ui-sdk';

export const SidebarMenu: React.FC<{
  showAdminPanel?: boolean;
  onToggleAdminPanel?: (show: boolean) => void;
}> = ({ showAdminPanel = false, onToggleAdminPanel }) => {
  const { catalog, activeServiceKey, setActiveServiceKey, hasService, roleViewFilter, role } = usePlatform();

  const visibleServices = catalog.filter((svc) => {
    if (!hasService(svc.serviceKey)) return false;
    if (roleViewFilter !== 'ALL' && svc.category !== roleViewFilter && svc.category !== 'Transversal') {
      return false;
    }
    return true;
  });

  return (
    <aside className="pk-sidebar">
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          color: '#94a3b8',
          padding: '4px 10px 6px',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Áreas de Trabajo
      </div>

      {visibleServices.map((svc) => {
        const isCurrent = !showAdminPanel && activeServiceKey === svc.serviceKey;
        return (
          <button
            key={svc.serviceKey}
            type="button"
            className={`pk-nav-btn ${isCurrent ? 'active' : ''}`}
            onClick={() => {
              onToggleAdminPanel?.(false);
              setActiveServiceKey(svc.serviceKey);
            }}
          >
            <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{svc.icon}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {svc.displayName}
            </span>
          </button>
        );
      })}

      {role === 'superadmin' && onToggleAdminPanel && (
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <button
            type="button"
            className={`pk-nav-btn ${showAdminPanel ? 'active' : ''}`}
            onClick={() => onToggleAdminPanel(true)}
          >
            <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>⚙️</span>
            <span>Consola Corporativa</span>
          </button>
        </div>
      )}
    </aside>
  );
};
