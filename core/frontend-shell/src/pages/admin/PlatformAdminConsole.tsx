import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlatform } from '@platform/ui-sdk';
import { PkIcon } from '../../components/ServiceIcons';
import { AdminOverviewTab } from './AdminOverviewTab';
import { AdminTenants360Tab } from './AdminTenants360Tab';
import { AdminActivationRequestsTab } from './AdminActivationRequestsTab';
import { AdminCatalogAndFlagsTab } from './AdminCatalogAndFlagsTab';
import { AdminStaffAndRolesTab } from './AdminStaffAndRolesTab';
import { AdminAuditLogTab } from './AdminAuditLogTab';
import { AdminAnnouncementsTab } from './AdminAnnouncementsTab';
import { AdminMyAccountTab } from './AdminMyAccountTab';

export type AdminSectionKey =
  | 'overview'
  | 'tenants'
  | 'requests'
  | 'catalog'
  | 'flags'
  | 'staff'
  | 'roles'
  | 'announcements'
  | 'health'
  | 'audit'
  | 'account';

interface NavEntry {
  key: AdminSectionKey;
  label: string;
  subtitle: string;
  icon: string;
  group: 'principal' | 'comercial' | 'seguridad';
}

interface Props {
  onLogout: () => Promise<void>;
  onStartSupport: (tenantId: string, mode: 'readonly' | 'readwrite', reason: string, durationMinutes: number) => Promise<void>;
}

export const PlatformAdminConsole: React.FC<Props> = ({ onLogout, onStartSupport }) => {
  const { username, userProfile, platformRole, tenantsList, hasPlatformPermission } = usePlatform();

  const [railPinned, setRailPinned] = useState<boolean>(() => localStorage.getItem('pk_admin_rail_pinned') !== '0');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [focusTenantId, setFocusTenantId] = useState<string>('');
  const [createModalRequested, setCreateModalRequested] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setSearchOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const navItems = useMemo<NavEntry[]>(() => {
    const items: NavEntry[] = [];
    if (hasPlatformPermission('empresas.ver')) {
      items.push({
        key: 'overview',
        label: 'Panel Ejecutivo',
        subtitle: 'Métricas globales, MRR, accesos rápidos y actividad reciente',
        icon: 'home',
        group: 'principal',
      });
      items.push({
        key: 'tenants',
        label: 'Empresas y Licencias',
        subtitle: 'Gobierno 360° por cliente: módulos 4 niveles, usuarios, cuotas, soporte y CSV',
        icon: 'building',
        group: 'principal',
      });
      items.push({
        key: 'requests',
        label: 'Solicitudes de Módulos',
        subtitle: 'Historial de ampliaciones autogestionadas por empresas clientes',
        icon: 'inbox',
        group: 'principal',
      });
    }
    if (hasPlatformPermission('catalogo.ver')) {
      items.push({
        key: 'catalog',
        label: 'Catálogo y Precios',
        subtitle: 'Visibilidad en tienda, venta autoservicio y tarifas COP',
        icon: 'layers',
        group: 'comercial',
      });
      items.push({
        key: 'flags',
        label: 'Feature Flags',
        subtitle: 'Activación progresiva de nuevas funciones global o por empresa piloto',
        icon: 'flag',
        group: 'comercial',
      });
    }
    if (hasPlatformPermission('plataforma.anuncios') || hasPlatformPermission('empresas.ver')) {
      items.push({
        key: 'announcements',
        label: 'Comunicados Globales',
        subtitle: 'Avisos operativos y alertas hacia las estaciones de clientes',
        icon: 'megaphone',
        group: 'comercial',
      });
    }
    if (hasPlatformPermission('plataforma.usuarios_ver')) {
      items.push({
        key: 'staff',
        label: 'Personal Interno',
        subtitle: 'Operadores de soporte, operaciones, desarrollo, comercial y 2FA',
        icon: 'users',
        group: 'seguridad',
      });
    }
    if (hasPlatformPermission('plataforma.roles_gestionar') || hasPlatformPermission('plataforma.usuarios_ver')) {
      items.push({
        key: 'roles',
        label: 'Roles y Permisos',
        subtitle: 'Matriz interactiva de switches por rol interno de plataforma',
        icon: 'shield',
        group: 'seguridad',
      });
    }
    if (hasPlatformPermission('plataforma.salud_servicios')) {
      items.push({
        key: 'health',
        label: 'Salud de Servicios',
        subtitle: 'Estado en vivo y latencia de los microservicios registrados',
        icon: 'activity',
        group: 'seguridad',
      });
    }
    if (hasPlatformPermission('auditoria.ver')) {
      items.push({
        key: 'audit',
        label: 'Bitácora de Auditoría',
        subtitle: 'Registro inmutable de acciones administrativas y exportaciones',
        icon: 'audit',
        group: 'seguridad',
      });
    }
    items.push({
      key: 'account',
      label: 'Mi Cuenta y 2FA',
      subtitle: 'Configuración personal de doble factor TOTP y contraseña corporativa',
      icon: 'key',
      group: 'seguridad',
    });
    return items;
  }, [hasPlatformPermission]);

  const [activeSection, setActiveSection] = useState<AdminSectionKey>(() => navItems[0]?.key || 'overview');

  const currentNav = navItems.find((n) => n.key === activeSection) || navItems[0];

  const toggleRailPin = () => {
    setRailPinned((prev) => {
      const next = !prev;
      localStorage.setItem('pk_admin_rail_pinned', next ? '1' : '0');
      return next;
    });
  };

  const initials = useMemo(() => {
    const src = (userProfile?.fullName || username || 'AD').trim();
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }, [userProfile?.fullName, username]);

  const omniboxResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const results: Array<{ id: string; title: string; subtitle: string; icon: string; run: () => void }> = [];

    for (const nav of navItems) {
      if (!q || nav.label.toLowerCase().includes(q) || nav.subtitle.toLowerCase().includes(q)) {
        results.push({
          id: `sec-${nav.key}`,
          title: nav.label,
          subtitle: nav.subtitle,
          icon: nav.icon,
          run: () => setActiveSection(nav.key),
        });
      }
    }
    for (const t of tenantsList || []) {
      if (
        !q ||
        t.companyName.toLowerCase().includes(q) ||
        t.nit.toLowerCase().includes(q) ||
        t.tenantId.toLowerCase().includes(q)
      ) {
        results.push({
          id: `ten-${t.tenantId}`,
          title: t.companyName,
          subtitle: `Empresa Cliente · NIT ${t.nit} · ${t.activeServices.length} áreas`,
          icon: 'building',
          run: () => {
            setFocusTenantId(t.tenantId);
            setActiveSection('tenants');
          },
        });
      }
    }
    return results.slice(0, 10);
  }, [navItems, searchQuery, tenantsList]);

  const renderRailGroup = (group: NavEntry['group'], title: string) => {
    const groupItems = navItems.filter((i) => i.group === group);
    if (groupItems.length === 0) return null;
    return (
      <>
        <div className="pk-rail-section-label">{title}</div>
        {groupItems.map((item) => {
          const isCurrent = activeSection === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`pk-rail-item ${isCurrent ? 'active' : ''}`}
              aria-current={isCurrent ? 'page' : undefined}
              title={item.label}
              onClick={() => {
                setActiveSection(item.key);
                setMobileMenuOpen(false);
              }}
            >
              <span className="pk-rail-icon">
                <PkIcon name={item.icon} size={20} />
              </span>
              <span className="pk-rail-label">{item.label}</span>
            </button>
          );
        })}
      </>
    );
  };

  return (
    <div className="pk-workstation-shell">
      {/* INSTITUTIONAL WHITE TOPBAR (IDENTICAL VISUAL SYSTEM TO WORKSTATION) */}
      <header className="pk-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            type="button"
            className="pk-mobile-menu-btn"
            aria-label="Abrir menú lateral"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            <PkIcon name="menu" size={19} />
          </button>
          <button
            type="button"
            className="pk-brand"
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveSection(navItems[0]?.key || 'overview')}
          >
            <span className="pk-logo-box">PK</span>
            <div className="pk-brand-meta">
              <div className="pk-brand-title">
                <span>PROVEKO</span>
                <span className="pk-hide-xs" style={{ color: '#cbd5e1', fontWeight: 400 }}>|</span>
                <span className="pk-hide-xs" style={{ color: 'var(--pk-primary)', fontWeight: 700, fontSize: 14 }}>
                  Consola de Plataforma
                </span>
              </div>
              <div className="pk-brand-sub">Gobierno Multi-Empresa, Personal Interno y Catálogo</div>
            </div>
          </button>
        </div>

        {/* GLOBAL SEARCH OMNIBOX */}
        <div className="pk-omnibox-wrap" ref={searchRef}>
          <span
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--pk-muted)',
              display: 'inline-flex',
              pointerEvents: 'none',
            }}
          >
            <PkIcon name="search" size={16} />
          </span>
          <input
            type="search"
            className="pk-omnibox-input"
            placeholder="Buscar empresa por NIT, razón social o sección del admin..."
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
          />
          {searchOpen && omniboxResults.length > 0 && (
            <div className="pk-omnibox-dropdown">
              {omniboxResults.map((res) => (
                <button
                  key={res.id}
                  type="button"
                  className="pk-dropdown-item"
                  onClick={() => {
                    res.run();
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <PkIcon name={res.icon} size={17} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12.5 }}>{res.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--pk-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {res.subtitle}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT ACTIONS & PROFILE DROPDOWN */}
        <div className="pk-row-actions" style={{ flexShrink: 0 }}>
          {hasPlatformPermission('empresas.crear') && (
            <button
              type="button"
              className="pk-btn pk-btn-emerald pk-btn-sm"
              onClick={() => {
                setActiveSection('tenants');
                setCreateModalRequested(true);
              }}
            >
              + Nueva Empresa
            </button>
          )}
          <span className="pk-badge pk-badge-blue pk-hide-mobile">{platformRole || 'superadmin'}</span>

          <div style={{ position: 'relative' }} ref={profileRef}>
            <button
              type="button"
              className="pk-avatar-btn"
              title={username}
              onClick={() => setProfileOpen((v) => !v)}
            >
              {initials}
            </button>
            {profileOpen && (
              <div className="pk-dropdown-menu">
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--pk-border)' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--pk-navy)' }}>
                    {userProfile?.fullName || username}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>{username}</div>
                </div>
                <button
                  type="button"
                  className="pk-dropdown-item"
                  onClick={() => {
                    setProfileOpen(false);
                    setActiveSection('account');
                  }}
                >
                  <PkIcon name="key" size={16} />
                  <span>Mi Cuenta y Seguridad 2FA</span>
                </button>
                <button
                  type="button"
                  className="pk-dropdown-item"
                  style={{ color: 'var(--pk-rose)' }}
                  onClick={() => {
                    setProfileOpen(false);
                    void onLogout();
                  }}
                >
                  <span>Cerrar Sesión Administrativa</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* MAIN FRAME WITH PINNABLE NAVY LATERAL SIDEBAR RAIL */}
      <div className="pk-app-frame">
        {mobileMenuOpen && (
          <div
            className="pk-mobile-backdrop"
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <div className={`pk-rail-host ${railPinned ? 'pinned' : ''}`}>
          <aside
            className={`pk-rail-sidebar ${railPinned ? 'pinned' : ''} ${mobileMenuOpen ? 'mobile-open' : ''}`}
            aria-label="Menú lateral de administración de plataforma"
          >
            <div className="pk-rail-header">
              <span className="pk-rail-header-title">Menú Plataforma</span>
              <button
                type="button"
                className={`pk-rail-pin-btn ${railPinned ? 'active' : ''}`}
                onClick={toggleRailPin}
                aria-pressed={railPinned}
                title={railPinned ? 'Contraer menú lateral' : 'Fijar menú lateral abierto'}
              >
                <PkIcon name="pin" size={15} />
              </button>
              <button
                type="button"
                className="pk-rail-close-btn"
                aria-label="Cerrar menú lateral"
                onClick={() => setMobileMenuOpen(false)}
              >
                ✕
              </button>
            </div>

            {renderRailGroup('principal', 'Operación Clientes')}
            <div className="pk-rail-divider" />
            {renderRailGroup('comercial', 'Catálogo y Gobierno')}
            <div className="pk-rail-divider" />
            {renderRailGroup('seguridad', 'Personal y Seguridad')}
          </aside>
        </div>

        <main className="pk-main">
          {currentNav && (
            <div className="pk-ws-header" style={{ paddingBottom: 14 }}>
              <div className="pk-ws-title-row" style={{ marginBottom: 0 }}>
                <div>
                  <h1 className="pk-ws-title">
                    <PkIcon name={currentNav.icon} size={22} />
                    <span>{currentNav.label}</span>
                  </h1>
                  <div style={{ fontSize: 12.5, color: 'var(--pk-muted)', marginTop: 3 }}>
                    {currentNav.subtitle}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pk-stage">
            {activeSection === 'overview' && (
              <AdminOverviewTab
                onNavigateSection={(sec) => setActiveSection(sec as AdminSectionKey)}
                onOpenCreateTenant={() => {
                  setActiveSection('tenants');
                  setCreateModalRequested(true);
                }}
              />
            )}
            {activeSection === 'tenants' && (
              <AdminTenants360Tab
                focusTenantId={focusTenantId}
                createModalRequested={createModalRequested}
                onConsumeCreateModal={() => setCreateModalRequested(false)}
                onStartSupport={onStartSupport}
              />
            )}
            {activeSection === 'requests' && (
              <AdminActivationRequestsTab
                onOpenTenant={(tid) => {
                  setFocusTenantId(tid);
                  setActiveSection('tenants');
                }}
              />
            )}
            {activeSection === 'catalog' && <AdminCatalogAndFlagsTab mode="catalog" />}
            {activeSection === 'flags' && <AdminCatalogAndFlagsTab mode="flags" />}
            {activeSection === 'staff' && <AdminStaffAndRolesTab mode="staff" />}
            {activeSection === 'roles' && <AdminStaffAndRolesTab mode="roles" />}
            {activeSection === 'announcements' && <AdminAnnouncementsTab />}
            {activeSection === 'health' && (
              <AdminOverviewTab
                onlyHealth
                onNavigateSection={(sec) => setActiveSection(sec as AdminSectionKey)}
                onOpenCreateTenant={() => {}}
              />
            )}
            {activeSection === 'audit' && <AdminAuditLogTab />}
            {activeSection === 'account' && <AdminMyAccountTab />}
          </div>
        </main>
      </div>
    </div>
  );
};
