import React, { useMemo, useState } from 'react';
import { usePlatform } from '@platform/ui-sdk';
import { AdminOverviewTab } from './AdminOverviewTab';
import { AdminTenants360Tab } from './AdminTenants360Tab';
import { AdminCatalogAndFlagsTab } from './AdminCatalogAndFlagsTab';
import { AdminStaffAndRolesTab } from './AdminStaffAndRolesTab';
import { AdminAuditLogTab } from './AdminAuditLogTab';
import { AdminAnnouncementsTab } from './AdminAnnouncementsTab';

type AdminTab = 'overview' | 'tenants' | 'catalog' | 'staff' | 'audit' | 'announcements';

interface Props {
  onLogout: () => Promise<void>;
  onStartSupport: (tenantId: string, mode: 'readonly' | 'readwrite', reason: string, durationMinutes: number) => Promise<void>;
}

export const PlatformAdminConsole: React.FC<Props> = ({ onLogout, onStartSupport }) => {
  const { username, platformRole, hasPlatformPermission } = usePlatform();

  const availableTabs = useMemo(() => {
    const list: Array<{ key: AdminTab; label: string }> = [];
    if (hasPlatformPermission('empresas.ver')) {
      list.push({ key: 'overview', label: 'Resumen y Salud' });
      list.push({ key: 'tenants', label: 'Empresas 360°' });
    }
    if (hasPlatformPermission('catalogo.ver')) {
      list.push({ key: 'catalog', label: 'Catálogo y Flags' });
    }
    if (hasPlatformPermission('plataforma.usuarios_ver') || hasPlatformPermission('plataforma.roles_gestionar')) {
      list.push({ key: 'staff', label: 'Personal y Roles' });
    }
    if (hasPlatformPermission('auditoria.ver')) {
      list.push({ key: 'audit', label: 'Auditoría' });
    }
    if (hasPlatformPermission('plataforma.anuncios') || hasPlatformPermission('empresas.ver')) {
      list.push({ key: 'announcements', label: 'Anuncios' });
    }
    return list;
  }, [hasPlatformPermission]);

  const [activeTab, setActiveTab] = useState<AdminTab>(availableTabs[0]?.key || 'overview');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--pk-bg)', display: 'flex', flexDirection: 'column' }}>
      <header className="pk-topbar" style={{ background: '#023047', color: '#ffffff', borderBottom: '1px solid #074160' }}>
        <div className="pk-brand">
          <span className="pk-logo-box">PK</span>
          <div className="pk-brand-meta">
            <div className="pk-brand-title" style={{ color: '#ffffff' }}>
              <span>PROVEKO</span>
              <span style={{ color: '#64748b', fontWeight: 400 }}>|</span>
              <span style={{ color: '#94d2bd', fontWeight: 700, fontSize: 14 }}>
                Consola de Administración de Plataforma
              </span>
            </div>
            <div className="pk-brand-sub" style={{ color: '#cbd5e1' }}>
              Gobierno Multi-Tenant, Personal Interno, Catálogo Comercial y Auditoría
            </div>
          </div>
        </div>
        <div className="pk-row-actions">
          <span className="pk-badge pk-badge-amber">{platformRole || 'platform'}</span>
          <span className="pk-badge pk-badge-blue">{username}</span>
          <button
            type="button"
            className="pk-btn pk-btn-outline pk-btn-sm"
            style={{ color: '#ffffff', borderColor: 'rgba(255,255,255,0.35)' }}
            onClick={() => void onLogout()}
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <nav
        aria-label="Navegación Consola de Plataforma"
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '10px 24px',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {availableTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`pk-btn pk-btn-sm ${activeTab === t.key ? 'pk-btn-primary' : 'pk-btn-outline'}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="pk-stage" style={{ maxWidth: 1560, width: '100%', margin: '0 auto', padding: '18px 24px' }}>
        {activeTab === 'overview' && <AdminOverviewTab />}
        {activeTab === 'tenants' && <AdminTenants360Tab onStartSupport={onStartSupport} />}
        {activeTab === 'catalog' && <AdminCatalogAndFlagsTab />}
        {activeTab === 'staff' && <AdminStaffAndRolesTab />}
        {activeTab === 'audit' && <AdminAuditLogTab />}
        {activeTab === 'announcements' && <AdminAnnouncementsTab />}
      </main>
    </div>
  );
};
