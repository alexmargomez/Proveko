import React, { useState } from 'react';
import { formatCop, PkKpiRow, usePlatform } from '@platform/ui-sdk';
import { PkIcon } from '../components/ServiceIcons';

export const WorkstationHome: React.FC = () => {
  const {
    tenant,
    companyTenant,
    userProfile,
    isCompanyAdmin,
    catalog,
    hasService,
    hasModule,
    navigateTo,
    setWorkstationView,
  } = usePlatform();

  const [tab, setTab] = useState<'shortcuts' | 'overview'>('shortcuts');

  const shortcuts: {
    key: string;
    title: string;
    sub: string;
    icon: string;
    visible: boolean;
    onClick: () => void;
  }[] = [
    {
      key: 'pos',
      title: 'Crea una Venta o Factura POS',
      sub: 'Caja rápida y facturación',
      icon: 'ms-facturacion',
      visible: hasService('ms-facturacion'),
      onClick: () =>
        hasModule('pos_mostrador')
          ? navigateTo('ms-facturacion', 'pos_mostrador')
          : navigateTo('ms-facturacion'),
    },
    {
      key: 'quote',
      title: 'Crea una Cotización Comercial',
      sub: 'Propuestas para clientes',
      icon: 'ms-facturacion',
      visible: hasService('ms-facturacion') && hasModule('cotizaciones'),
      onClick: () => navigateTo('ms-facturacion', 'cotizaciones'),
    },
    {
      key: 'customer',
      title: 'Crea o Consulta un Tercero',
      sub: 'Clientes, convenios y cartera',
      icon: 'ms-clientes',
      visible: hasService('ms-clientes'),
      onClick: () => navigateTo('ms-clientes'),
    },
    {
      key: 'product',
      title: 'Gestiona Productos y Bodegas',
      sub: 'Existencias, kardex y traslados',
      icon: 'ms-inventario',
      visible: hasService('ms-inventario'),
      onClick: () => navigateTo('ms-inventario'),
    },
    {
      key: 'purchase',
      title: 'Registra una Compra o Gasto',
      sub: 'Proveedores y abastecimiento',
      icon: 'ms-compras',
      visible: hasService('ms-compras'),
      onClick: () => navigateTo('ms-compras'),
    },
    {
      key: 'cash',
      title: 'Recibo y Cuadre de Caja',
      sub: 'Turnos, ingresos y egresos',
      icon: 'ms-caja',
      visible: hasService('ms-caja'),
      onClick: () => navigateTo('ms-caja'),
    },
    {
      key: 'comandas',
      title: 'Atiende Mesas y Comandas',
      sub: 'Salón, cocina y barra',
      icon: 'ms-comandas',
      visible: hasService('ms-comandas'),
      onClick: () => navigateTo('ms-comandas'),
    },
    {
      key: 'taller',
      title: 'Recibe un Vehículo o Equipo',
      sub: 'Órdenes de servicio y técnicos',
      icon: 'ms-taller',
      visible: hasService('ms-taller'),
      onClick: () => navigateTo('ms-taller'),
    },
    {
      key: 'hotel',
      title: 'Habitaciones y Check-In',
      sub: 'Reservas y cargos de alojamiento',
      icon: 'ms-hoteleria',
      visible: hasService('ms-hoteleria'),
      onClick: () => navigateTo('ms-hoteleria'),
    },
    {
      key: 'bascula',
      title: 'Registra Pesaje en Báscula',
      sub: 'Destare de carga y despachos',
      icon: 'ms-bascula',
      visible: hasService('ms-bascula'),
      onClick: () => navigateTo('ms-bascula'),
    },
    {
      key: 'agenda',
      title: 'Agenda Citas y Reservas',
      sub: 'Programación de profesionales',
      icon: 'ms-agenda',
      visible: hasService('ms-agenda'),
      onClick: () => navigateTo('ms-agenda'),
    },
    {
      key: 'taquilla',
      title: 'Taquilla y Control de Acceso',
      sub: 'Entradas, boletería y QR',
      icon: 'ms-taquilla',
      visible: hasService('ms-taquilla'),
      onClick: () => navigateTo('ms-taquilla'),
    },
    {
      key: 'accounting',
      title: 'Comprobante Contable PUC',
      sub: 'Asientos y libros oficiales',
      icon: 'ms-contabilidad',
      visible: hasService('ms-contabilidad'),
      onClick: () => navigateTo('ms-contabilidad'),
    },
    {
      key: 'payroll',
      title: 'Personal y Liquidación Nómina',
      sub: 'Contratos y desprendibles',
      icon: 'ms-nomina',
      visible: hasService('ms-nomina'),
      onClick: () => navigateTo('ms-nomina'),
    },
    {
      key: 'reports',
      title: 'Reportes e Indicadores',
      sub: 'Consolidados y exportación CSV',
      icon: 'ms-reportes',
      visible: hasService('ms-reportes'),
      onClick: () => navigateTo('ms-reportes'),
    },
    {
      key: 'users',
      title: 'Usuarios y Servicios por Rol',
      sub: 'Crea empleados y define accesos',
      icon: 'users',
      visible: isCompanyAdmin,
      onClick: () => setWorkstationView('users'),
    },
    {
      key: 'modules',
      title: 'Activar Nuevos Módulos',
      sub: 'Amplía las herramientas de tu plan',
      icon: 'modules',
      visible: isCompanyAdmin,
      onClick: () => setWorkstationView('activate-modules'),
    },
  ].filter((item) => item.visible);

  const activeCatalogServices = catalog.filter((s) => hasService(s.serviceKey));
  const effPlan = companyTenant || tenant;

  const overviewKpis = isCompanyAdmin
    ? [
        { label: 'Áreas Habilitadas en tu Sesión', value: String(activeCatalogServices.length) },
        { label: 'Secciones Operativas Activas', value: String(tenant?.activeModules.length || 0) },
        { label: 'Cupo de Usuarios del Plan', value: `${effPlan?.maxUsersAllowed || 15} usuarios` },
        {
          label: 'Suscripción Mensual',
          value: effPlan?.monthlyCop ? `${formatCop(effPlan.monthlyCop)}/mes` : 'Activa',
          color: 'var(--pk-emerald)',
        },
      ]
    : [
        { label: 'Áreas Asignadas a tu Perfil', value: String(activeCatalogServices.length) },
        { label: 'Secciones Operativas Activas', value: String(tenant?.activeModules.length || 0) },
        { label: 'Estado Operativo', value: 'En Línea', color: 'var(--pk-emerald)' },
      ];

  return (
    <div>
      <div className="pk-ws-header">
        <div className="pk-ws-title-row">
          <h1 className="pk-ws-title">Inicio</h1>
          {isCompanyAdmin && (
            <div className="pk-row-actions">
              <button
                type="button"
                className="pk-btn pk-btn-outline pk-btn-sm"
                onClick={() => setWorkstationView('users')}
              >
                <PkIcon name="users" size={15} />
                <span>Gestionar Usuarios y Roles</span>
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-primary pk-btn-sm"
                onClick={() => setWorkstationView('activate-modules')}
              >
                <PkIcon name="modules" size={15} />
                <span>Activar Módulos</span>
              </button>
            </div>
          )}
        </div>
        <nav className="pk-folder-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'shortcuts'}
            className={`pk-folder-tab ${tab === 'shortcuts' ? 'active' : ''}`}
            onClick={() => setTab('shortcuts')}
          >
            Accesos directos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'overview'}
            className={`pk-folder-tab ${tab === 'overview' ? 'active' : ''}`}
            onClick={() => setTab('overview')}
          >
            Resumen de áreas habilitadas
          </button>
        </nav>
      </div>

      <div className="pk-stage">
        {tab === 'shortcuts' && (
          <div className="pk-card">
            <div className="pk-card-head" style={{ background: '#ffffff' }}>
              <div>
                <div className="pk-card-title" style={{ fontSize: 16 }}>
                  Te damos la bienvenida{userProfile?.fullName ? `, ${userProfile.fullName}` : ''} — ¿Qué deseas hacer hoy?
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--pk-muted)', marginTop: 2 }}>
                  Selecciona una herramienta para iniciar tu operación o pasa el cursor por el menú izquierdo para navegar entre secciones.
                </div>
              </div>
            </div>
            <div className="pk-card-body">
              <div className="pk-shortcut-grid">
                {shortcuts.map((sc) => (
                  <button
                    key={sc.key}
                    type="button"
                    className="pk-shortcut-tile"
                    onClick={sc.onClick}
                  >
                    <span className="pk-shortcut-circle">
                      <PkIcon name={sc.icon} size={24} />
                    </span>
                    <span className="pk-shortcut-title">{sc.title}</span>
                    <span className="pk-shortcut-sub">{sc.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'overview' && (
          <>
            <PkKpiRow items={overviewKpis} />

            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">Áreas Operativas Disponibles en tu Estación</div>
              </div>
              <div className="pk-card-body">
                <div className="pk-plan-grid">
                  {activeCatalogServices.map((svc) => (
                    <div key={svc.serviceKey} className="pk-plan-card">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
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
                            <PkIcon name={svc.serviceKey} size={18} />
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
                      </div>
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        style={{ width: '100%' }}
                        onClick={() => navigateTo(svc.serviceKey)}
                      >
                        Abrir {svc.displayName} →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
