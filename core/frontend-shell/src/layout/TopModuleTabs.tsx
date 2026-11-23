import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useLicensing, useNavigation, useSession } from '@platform/ui-sdk';
import { PkIcon } from '../components/ServiceIcons';

export const TopModuleTabs: React.FC<{
  onOpenAdmin: () => void;
  onToggleMobileMenu?: () => void;
}> = ({ onOpenAdmin, onToggleMobileMenu }) => {
  const {
    tenant,
    tenantsList,
    username,
    userProfile,
    role,
    isCompanyAdmin,
    roleTemplates,
    logout,
    impersonateTenant,
  } = useSession();
  const { catalog, hasService, hasModule, hasSubmodule } = useLicensing();
  const {
    workstationView,
    setWorkstationView,
    activeServiceKey,
    activeModuleKey,
    setActiveModuleKey,
    activeSubmoduleKey,
    setActiveSubmoduleKey,
    navigateTo,
  } = useNavigation();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement | null>(null);
  const createRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (createRef.current && !createRef.current.contains(target)) setQuickCreateOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setSearchOpen(false);
        setQuickCreateOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const currentService = catalog.find((s) => s.serviceKey === activeServiceKey);
  const activeModules = (currentService?.modules || []).filter((m) => hasModule(m.moduleKey));
  const activeSubmodules = (currentService?.submodules || []).filter(
    (sm) => sm.dependsOnModule === activeModuleKey && hasSubmodule(activeModuleKey, sm.submoduleKey)
  );

  const searchItems = useMemo(() => {
    const list: { id: string; title: string; subtitle: string; icon: string; run: () => void }[] = [
      {
        id: 'nav-home',
        title: 'Inicio y Accesos Directos',
        subtitle: 'Panel principal de bienvenida',
        icon: 'home',
        run: () => setWorkstationView('home'),
      },
    ];
    for (const svc of catalog) {
      if (!hasService(svc.serviceKey)) continue;
      list.push({
        id: `svc-${svc.serviceKey}`,
        title: svc.displayName,
        subtitle: svc.summary,
        icon: svc.serviceKey,
        run: () => navigateTo(svc.serviceKey),
      });
      for (const mod of svc.modules || []) {
        if (!hasModule(mod.moduleKey)) continue;
        list.push({
          id: `mod-${svc.serviceKey}-${mod.moduleKey}`,
          title: mod.displayName,
          subtitle: `${svc.displayName} · ${mod.summary}`,
          icon: svc.serviceKey,
          run: () => navigateTo(svc.serviceKey, mod.moduleKey),
        });
      }
    }
    if (isCompanyAdmin) {
      list.push({
        id: 'cfg-users',
        title: 'Usuarios, Roles y Servicios por Empleado',
        subtitle: 'Configuración de accesos internos de tu empresa',
        icon: 'users',
        run: () => setWorkstationView('users'),
      });
      list.push({
        id: 'cfg-modules',
        title: 'Activar Módulos y Ampliar Plan',
        subtitle: 'Habilita nuevas áreas operativas en 1 clic',
        icon: 'modules',
        run: () => setWorkstationView('activate-modules'),
      });
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list.slice(0, 8);
    return list
      .filter((it) => it.title.toLowerCase().includes(q) || it.subtitle.toLowerCase().includes(q))
      .slice(0, 10);
  }, [catalog, hasModule, hasService, isCompanyAdmin, navigateTo, searchQuery, setWorkstationView]);

  const quickActions = useMemo(() => {
    const actions: { label: string; serviceKey: string; moduleKey?: string; icon: string }[] = [
      { label: 'Nueva Venta / Factura POS', serviceKey: 'ms-facturacion', moduleKey: 'pos_mostrador', icon: 'ms-facturacion' },
      { label: 'Nueva Cotización Comercial', serviceKey: 'ms-facturacion', moduleKey: 'cotizaciones', icon: 'ms-facturacion' },
      { label: 'Crear Cliente o Tercero', serviceKey: 'ms-clientes', moduleKey: 'directorio_clientes', icon: 'ms-clientes' },
      { label: 'Crear Producto o Existencia', serviceKey: 'ms-inventario', icon: 'ms-inventario' },
      { label: 'Registrar Compra a Proveedor', serviceKey: 'ms-compras', icon: 'ms-compras' },
      { label: 'Recibo o Movimiento de Caja', serviceKey: 'ms-caja', icon: 'ms-caja' },
      { label: 'Tomar Comanda / Mesa', serviceKey: 'ms-comandas', icon: 'ms-comandas' },
      { label: 'Nueva Orden de Taller', serviceKey: 'ms-taller', icon: 'ms-taller' },
      { label: 'Reserva o Check-In Hotel', serviceKey: 'ms-hoteleria', icon: 'ms-hoteleria' },
      { label: 'Pesaje en Báscula Camionera', serviceKey: 'ms-bascula', icon: 'ms-bascula' },
    ];
    return actions.filter(
      (a) => hasService(a.serviceKey) && (!a.moduleKey || hasModule(a.moduleKey))
    );
  }, [hasModule, hasService]);

  const initials = useMemo(() => {
    const src = (userProfile?.fullName || username || 'PK').trim();
    const parts = src.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return src.slice(0, 2).toUpperCase();
  }, [userProfile?.fullName, username]);

  const roleBadgeLabel = useMemo(() => {
    if (role === 'superadmin') return 'SuperAdmin Global';
    const ir = userProfile?.internalRole || 'admin_empresa';
    const found = roleTemplates.find((t) => t.roleKey === ir);
    if (found) return found.displayName;
    return ir === 'admin_empresa' ? 'Administrador General' : ir;
  }, [role, roleTemplates, userProfile?.internalRole]);

  return (
    <>
      <header className="pk-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onToggleMobileMenu && (
            <button
              type="button"
              className="pk-mobile-menu-btn"
              aria-label="Abrir menú de navegación"
              onClick={onToggleMobileMenu}
            >
              <PkIcon name="menu" size={19} />
            </button>
          )}
          <button
            type="button"
            className="pk-brand"
            style={{ cursor: 'pointer' }}
            onClick={() => setWorkstationView('home')}
            title="Ir a Inicio"
          >
            <span className="pk-logo-box">PK</span>
            <div className="pk-brand-meta">
              <div className="pk-brand-title">
                <span>PROVEKO</span>
                {tenant && (
                  <>
                    <span style={{ color: '#cbd5e1', fontWeight: 400 }}>|</span>
                    <span style={{ color: '#0f172a', fontWeight: 700, fontSize: 14 }}>{tenant.companyName}</span>
                  </>
                )}
              </div>
              {tenant && (
                <div className="pk-brand-sub">
                  NIT {tenant.nit} · {roleBadgeLabel}
                </div>
              )}
            </div>
          </button>
        </div>

        <div className="pk-omnibox-wrap" ref={searchRef}>
          <span
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#64748b',
              display: 'inline-flex',
            }}
          >
            <PkIcon name="search" size={16} />
          </span>
          <input
            type="search"
            className="pk-omnibox-input"
            placeholder="Buscar área, módulo o herramienta..."
            aria-label="Buscar en la plataforma"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchItems.length > 0) {
                e.preventDefault();
                searchItems[0].run();
                setSearchOpen(false);
                setSearchQuery('');
              }
            }}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
          />
          {searchOpen && (
            <div className="pk-omnibox-dropdown">
              {searchItems.length === 0 ? (
                <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--pk-muted)' }}>
                  No se encontraron áreas o herramientas para «{searchQuery}»
                </div>
              ) : (
                searchItems.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    className="pk-dropdown-item"
                    onClick={() => {
                      it.run();
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <span style={{ color: 'var(--pk-primary)', display: 'inline-flex' }}>
                      <PkIcon name={it.icon} size={17} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12.5 }}>{it.title}</div>
                      <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {it.subtitle}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {role === 'superadmin' && tenantsList.filter((t) => t.status !== 'SUSPENDED').length > 1 && (
            <select
              aria-label="Cambiar empresa activa"
              value={tenant?.tenantId || ''}
              onChange={(e) => {
                if (e.target.value && e.target.value !== tenant?.tenantId) {
                  void impersonateTenant(e.target.value);
                }
              }}
              style={{
                height: 34,
                borderRadius: 8,
                border: '1px solid var(--pk-border-strong)',
                background: '#f8fafc',
                padding: '0 10px',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--pk-navy)',
              }}
            >
              {tenantsList
                .filter((t) => t.status !== 'SUSPENDED')
                .map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.companyName}
                  </option>
                ))}
            </select>
          )}

          {(quickActions.length > 0 || isCompanyAdmin) && (
            <div style={{ position: 'relative' }} ref={createRef}>
              <button
                type="button"
                className="pk-btn pk-btn-primary pk-btn-sm"
                aria-haspopup="menu"
                aria-expanded={quickCreateOpen}
                style={{ height: 34, padding: '0 13px', borderRadius: 8 }}
                onClick={() => setQuickCreateOpen((v) => !v)}
              >
                <PkIcon name="plus" size={15} />
                <span>Crear</span>
                <span style={{ fontSize: 10, marginLeft: 2 }}>▾</span>
              </button>
              {quickCreateOpen && (
                <div className="pk-dropdown-menu" role="menu">
                  <div style={{ padding: '4px 10px 6px', fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                    Creación Rápida
                  </div>
                  {quickActions.map((act) => (
                    <button
                      key={act.label}
                      type="button"
                      role="menuitem"
                      className="pk-dropdown-item"
                      onClick={() => {
                        navigateTo(act.serviceKey, act.moduleKey);
                        setQuickCreateOpen(false);
                      }}
                    >
                      <span style={{ color: 'var(--pk-primary)', display: 'inline-flex' }}>
                        <PkIcon name={act.icon} size={16} />
                      </span>
                      <span>{act.label}</span>
                    </button>
                  ))}
                  {isCompanyAdmin && (
                    <>
                      <div style={{ height: 1, background: '#e2e8f0', margin: '4px 6px' }} />
                      <button
                        type="button"
                        role="menuitem"
                        className="pk-dropdown-item"
                        onClick={() => {
                          setWorkstationView('users');
                          setQuickCreateOpen(false);
                        }}
                      >
                        <span style={{ color: 'var(--pk-emerald)', display: 'inline-flex' }}>
                          <PkIcon name="users" size={16} />
                        </span>
                        <span>Crear Usuario / Empleado</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {isCompanyAdmin && (
            <button
              type="button"
              className="pk-btn pk-btn-outline pk-btn-sm"
              style={{ height: 34, padding: '0 10px' }}
              title="Configuración de Usuarios y Servicios por Empleado"
              onClick={() => setWorkstationView('users')}
            >
              <PkIcon name="users" size={16} />
              <span>Usuarios</span>
            </button>
          )}

          {role === 'superadmin' && (
            <button
              type="button"
              className="pk-btn pk-btn-outline pk-btn-sm"
              style={{ height: 34 }}
              onClick={onOpenAdmin}
            >
              Panel Corporativo
            </button>
          )}

          <div style={{ position: 'relative' }} ref={profileRef}>
            <button
              type="button"
              className="pk-avatar-btn"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              title={`${userProfile?.fullName || username} (${roleBadgeLabel})`}
              onClick={() => setProfileOpen((v) => !v)}
            >
              {initials}
            </button>
            {profileOpen && (
              <div className="pk-dropdown-menu" role="menu" style={{ minWidth: 260 }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', marginBottom: 4 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                    {userProfile?.fullName || username}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{username}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <span className="pk-badge pk-badge-blue">{roleBadgeLabel}</span>
                    <span className="pk-badge pk-badge-emerald">Entorno Empresarial</span>
                  </div>
                </div>
                {isCompanyAdmin && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className="pk-dropdown-item"
                      onClick={() => {
                        setWorkstationView('users');
                        setProfileOpen(false);
                      }}
                    >
                      <PkIcon name="users" size={16} />
                      <span>Usuarios y Permisos por Rol</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="pk-dropdown-item"
                      onClick={() => {
                        setWorkstationView('activate-modules');
                        setProfileOpen(false);
                      }}
                    >
                      <PkIcon name="modules" size={16} />
                      <span>Activar Módulos y Planes</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="pk-dropdown-item"
                  style={{ color: 'var(--pk-rose)' }}
                  onClick={() => {
                    setProfileOpen(false);
                    void logout();
                  }}
                >
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {workstationView === 'service' && currentService && (
        <div className="pk-ws-header">
          <div className="pk-ws-title-row">
            <h1 className="pk-ws-title">
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: '#eff6ff',
                  color: 'var(--pk-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PkIcon name={currentService.serviceKey} size={19} />
              </span>
              <span>{currentService.displayName}</span>
            </h1>
            {activeSubmodules.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {activeSubmodules.map((sm) => {
                  const selected = sm.submoduleKey === activeSubmoduleKey;
                  return (
                    <button
                      type="button"
                      key={sm.submoduleKey}
                      onClick={() => setActiveSubmoduleKey(sm.submoduleKey)}
                      style={{
                        border: selected ? '1px solid var(--pk-primary)' : '1px solid #cbd5e1',
                        background: selected ? '#eff6ff' : '#ffffff',
                        color: selected ? 'var(--pk-primary)' : '#475569',
                        borderRadius: 999,
                        padding: '4px 11px',
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
          </div>

          {activeModules.length > 0 && (
            <nav className="pk-folder-tabs" role="tablist" aria-label="Secciones del área activa">
              {activeModules.map((mod) => {
                const active = mod.moduleKey === activeModuleKey;
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    key={mod.moduleKey}
                    className={`pk-folder-tab ${active ? 'active' : ''}`}
                    onClick={() => setActiveModuleKey(mod.moduleKey)}
                  >
                    <span>{mod.displayName}</span>
                  </button>
                );
              })}
            </nav>
          )}
        </div>
      )}
    </>
  );
};
