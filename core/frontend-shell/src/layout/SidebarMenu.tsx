import React, { useState } from 'react';
import { useLicensing, useNavigation, useSession } from '@platform/ui-sdk';
import { PkIcon } from '../components/ServiceIcons';

export const SidebarMenu: React.FC<{
  pinned: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onTogglePin: () => void;
  onOpenSuperAdmin?: () => void;
}> = ({ pinned, mobileOpen = false, onCloseMobile, onTogglePin, onOpenSuperAdmin }) => {
  const { isCompanyAdmin, role } = useSession();
  const { catalog, hasService, hasModule } = useLicensing();
  const { workstationView, setWorkstationView, activeServiceKey, activeModuleKey, navigateTo, roleViewFilter } =
    useNavigation();

  const [expandedAccordion, setExpandedAccordion] = useState<string>('');

  const visibleServices = catalog.filter((svc) => {
    if (!hasService(svc.serviceKey)) return false;
    if (roleViewFilter !== 'ALL' && svc.category !== roleViewFilter && svc.category !== 'Transversal') {
      return false;
    }
    return true;
  });

  const handleSelectService = (serviceKey: string) => {
    navigateTo(serviceKey);
    setExpandedAccordion((prev) => (prev === serviceKey ? '' : serviceKey));
    onCloseMobile?.();
  };

  return (
    <aside
      className={`pk-rail-sidebar ${pinned ? 'pinned' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      aria-label="Menú principal de navegación"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px 10px 4px',
        }}
      >
        <span className="pk-rail-section-label">Menú Principal</span>
        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={pinned}
          title={pinned ? 'Contraer menú automático al pasar el cursor' : 'Mantener menú lateral abierto'}
          style={{
            border: 'none',
            background: pinned ? 'rgba(255,183,3,0.22)' : 'rgba(255,255,255,0.08)',
            color: pinned ? '#ffb703' : '#cbd5e1',
            borderRadius: 8,
            width: 34,
            height: 32,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            marginLeft: 'auto',
            flexShrink: 0,
          }}
        >
          <PkIcon name="pin" size={15} />
        </button>
      </div>

      <button
        type="button"
        className={`pk-rail-item ${workstationView === 'home' ? 'active' : ''}`}
        aria-current={workstationView === 'home' ? 'page' : undefined}
        title="Inicio y Accesos Directos"
        onClick={() => {
          setWorkstationView('home');
          onCloseMobile?.();
        }}
      >
        <span className="pk-rail-icon">
          <PkIcon name="home" size={20} />
        </span>
        <span className="pk-rail-label">Inicio</span>
      </button>

      <div className="pk-rail-divider" />

      {visibleServices.map((svc) => {
        const isCurrent = workstationView === 'service' && activeServiceKey === svc.serviceKey;
        const enabledMods = (svc.modules || []).filter((m) => hasModule(m.moduleKey));
        // Only open accordion when explicitly toggled so icons never jump vertically on hover
        const isOpen = expandedAccordion === svc.serviceKey;

        return (
          <div key={svc.serviceKey}>
            <button
              type="button"
              className={`pk-rail-item ${isCurrent ? 'active' : ''}`}
              aria-current={isCurrent ? 'page' : undefined}
              aria-expanded={enabledMods.length > 1 ? isOpen : undefined}
              title={svc.displayName}
              onClick={() => handleSelectService(svc.serviceKey)}
            >
              <span className="pk-rail-icon">
                <PkIcon name={svc.serviceKey} size={20} />
              </span>
              <span className="pk-rail-label">{svc.displayName}</span>
              {enabledMods.length > 1 && (
                <span
                  className="pk-rail-label"
                  style={{
                    flex: 'none',
                    maxWidth: 20,
                    fontSize: 11,
                    opacity: 0.75,
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s',
                  }}
                >
                  ▾
                </span>
              )}
            </button>

            {enabledMods.length > 1 && (
              <div className={`pk-rail-sublist ${isOpen ? 'open' : ''}`}>
                {enabledMods.map((mod) => {
                  const modActive = isCurrent && activeModuleKey === mod.moduleKey;
                  return (
                    <button
                      key={mod.moduleKey}
                      type="button"
                      className={`pk-rail-subitem ${modActive ? 'active' : ''}`}
                      onClick={() => {
                        navigateTo(svc.serviceKey, mod.moduleKey);
                        onCloseMobile?.();
                      }}
                    >
                      {mod.displayName}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {(isCompanyAdmin || role === 'superadmin') && (
        <>
          <div style={{ marginTop: 'auto' }} />
          <div className="pk-rail-divider" />
          <div className="pk-rail-section-label">Configuración</div>

          <button
            type="button"
            className={`pk-rail-item ${workstationView === 'users' ? 'active' : ''}`}
            aria-current={workstationView === 'users' ? 'page' : undefined}
            title="Usuarios, Roles y Servicios por Empleado"
            onClick={() => {
              setWorkstationView('users');
              onCloseMobile?.();
            }}
          >
            <span className="pk-rail-icon">
              <PkIcon name="users" size={20} />
            </span>
            <span className="pk-rail-label">Usuarios y Permisos</span>
          </button>

          <button
            type="button"
            className={`pk-rail-item ${workstationView === 'activate-modules' ? 'active' : ''}`}
            aria-current={workstationView === 'activate-modules' ? 'page' : undefined}
            title="Activar Módulos y Ampliar Plan"
            onClick={() => {
              setWorkstationView('activate-modules');
              onCloseMobile?.();
            }}
          >
            <span className="pk-rail-icon">
              <PkIcon name="modules" size={20} />
            </span>
            <span className="pk-rail-label">Activar Módulos</span>
          </button>

          {role === 'superadmin' && onOpenSuperAdmin && (
            <button
              type="button"
              className="pk-rail-item"
              title="Volver al Panel Corporativo Global"
              onClick={() => {
                onOpenSuperAdmin();
                onCloseMobile?.();
              }}
            >
              <span className="pk-rail-icon">
                <PkIcon name="ms-reportes" size={20} />
              </span>
              <span className="pk-rail-label">Consola Corporativa</span>
            </button>
          )}
        </>
      )}
    </aside>
  );
};
