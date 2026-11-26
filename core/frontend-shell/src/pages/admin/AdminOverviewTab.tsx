import React, { useCallback, useEffect, useState } from 'react';
import { PkKpiRow, formatCop, usePlatform } from '@platform/ui-sdk';
import { PkIcon } from '../../components/ServiceIcons';

interface OverviewResp {
  kpis: {
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    maintenanceTenants: number;
    demoTenants: number;
    mrrCop: number;
    activeFlags: number;
    activeAnnouncements: number;
  };
  servicesHealth?: Array<{
    serviceKey: string;
    apiPrefix: string;
    targetUrl: string;
    status: string;
    latencyMs: number;
  }>;
  recentAudit?: Array<{
    logId: string;
    actorEmail: string;
    actorRole: string;
    action: string;
    targetId: string;
    tenantId: string;
    reason: string;
    createdAt: string;
  }>;
}

export const AdminOverviewTab: React.FC<{
  onNavigateSection: (section: string) => void;
  onOpenCreateTenant: () => void;
  onlyHealth?: boolean;
}> = ({ onNavigateSection, onOpenCreateTenant, onlyHealth = false }) => {
  const { apiGet, hasPlatformPermission } = usePlatform();
  const [data, setData] = useState<OverviewResp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiGet<OverviewResp>('/api/v1/admin/overview');
      setData(resp);
    } finally {
      setLoading(false);
    }
  }, [apiGet]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="pk-card">
        <div className="pk-card-body" style={{ color: 'var(--pk-muted)' }}>
          Cargando estado operativo de la plataforma...
        </div>
      </div>
    );
  }

  const k = data?.kpis;
  const upCount = (data?.servicesHealth || []).filter((s) => s.status === 'UP').length;
  const totalSvcs = (data?.servicesHealth || []).length;

  if (onlyHealth) {
    return (
      <div className="pk-stack">
        <PkKpiRow
          items={[
            { label: 'Microservicios Registrados', value: String(totalSvcs) },
            { label: 'Servicios en Línea (UP)', value: String(upCount), color: 'var(--pk-emerald)' },
            {
              label: 'Servicios Degradados (DOWN)',
              value: String(Math.max(0, totalSvcs - upCount)),
              color: totalSvcs - upCount > 0 ? 'var(--pk-rose)' : 'var(--pk-muted)',
            },
          ]}
        />
        <div className="pk-card">
          <div className="pk-card-head">
            <div>
              <div className="pk-card-title">Estado de Salud y Latencia de la Malla de Microservicios</div>
              <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
                Verificación en tiempo real contra los endpoints internos de cada contenedor registrado en el Gateway.
              </div>
            </div>
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void load()}>
              Sondear Ahora
            </button>
          </div>
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Microservicio</th>
                  <th>Prefijo API</th>
                  <th>Destino Interno</th>
                  <th>Estado</th>
                  <th className="pk-num">Latencia</th>
                </tr>
              </thead>
              <tbody>
                {(data?.servicesHealth || []).map((svc) => (
                  <tr key={svc.serviceKey}>
                    <td><strong>{svc.serviceKey}</strong></td>
                    <td><code>{svc.apiPrefix}</code></td>
                    <td style={{ color: 'var(--pk-muted)', fontSize: 12 }}>{svc.targetUrl}</td>
                    <td>
                      <span className={`pk-badge ${svc.status === 'UP' ? 'pk-badge-emerald' : 'pk-badge-rose'}`}>
                        {svc.status}
                      </span>
                    </td>
                    <td className="pk-num">{svc.latencyMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pk-stack">
      <PkKpiRow
        items={[
          { label: 'Empresas Registradas', value: `${k?.activeTenants ?? 0} activas / ${k?.totalTenants ?? 0}` },
          { label: 'MRR Mensual Estimado', value: `${formatCop(k?.mrrCop ?? 0)} COP`, color: 'var(--pk-primary)' },
          {
            label: 'Suspendidas / Mantenimiento',
            value: `${k?.suspendedTenants ?? 0} susp. · ${k?.maintenanceTenants ?? 0} mant.`,
            color: (k?.suspendedTenants ?? 0) + (k?.maintenanceTenants ?? 0) > 0 ? 'var(--pk-amber)' : 'var(--pk-emerald)',
          },
          {
            label: 'Salud Malla S2S',
            value: totalSvcs > 0 ? `${upCount}/${totalSvcs} UP` : 'Operativa',
            color: 'var(--pk-emerald)',
          },
        ]}
      />

      <div className="pk-shortcut-grid">
        {hasPlatformPermission('empresas.ver') && (
          <button type="button" className="pk-shortcut-tile" onClick={() => onNavigateSection('tenants')}>
            <span className="pk-shortcut-circle"><PkIcon name="building" size={24} /></span>
            <span className="pk-shortcut-title">Empresas y Licencias 360°</span>
            <span className="pk-shortcut-sub">Módulos 4 niveles, usuarios, cuotas, soporte y CSV</span>
          </button>
        )}
        {hasPlatformPermission('empresas.crear') && (
          <button type="button" className="pk-shortcut-tile" onClick={onOpenCreateTenant}>
            <span className="pk-shortcut-circle" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: 'var(--pk-emerald)' }}>
              <PkIcon name="plus" size={24} />
            </span>
            <span className="pk-shortcut-title">Aprovisionar Nueva Empresa</span>
            <span className="pk-shortcut-sub">Crea base PostgreSQL aislada y usuario administrador</span>
          </button>
        )}
        {(hasPlatformPermission('plataforma.roles_gestionar') || hasPlatformPermission('plataforma.usuarios_ver')) && (
          <button type="button" className="pk-shortcut-tile" onClick={() => onNavigateSection('roles')}>
            <span className="pk-shortcut-circle"><PkIcon name="shield" size={24} /></span>
            <span className="pk-shortcut-title">Roles y Switches de Permisos</span>
            <span className="pk-shortcut-sub">Activa o desactiva funciones por rol interno</span>
          </button>
        )}
        {hasPlatformPermission('plataforma.usuarios_ver') && (
          <button type="button" className="pk-shortcut-tile" onClick={() => onNavigateSection('staff')}>
            <span className="pk-shortcut-circle"><PkIcon name="users" size={24} /></span>
            <span className="pk-shortcut-title">Personal Interno y 2FA</span>
            <span className="pk-shortcut-sub">Operadores de soporte, desarrollo, comercial y TOTP</span>
          </button>
        )}
        {hasPlatformPermission('catalogo.ver') && (
          <button type="button" className="pk-shortcut-tile" onClick={() => onNavigateSection('catalog')}>
            <span className="pk-shortcut-circle"><PkIcon name="layers" size={24} /></span>
            <span className="pk-shortcut-title">Catálogo Comercial y Precios</span>
            <span className="pk-shortcut-sub">Oculta o publica servicios y ajusta tarifas COP</span>
          </button>
        )}
        {hasPlatformPermission('auditoria.ver') && (
          <button type="button" className="pk-shortcut-tile" onClick={() => onNavigateSection('audit')}>
            <span className="pk-shortcut-circle"><PkIcon name="audit" size={24} /></span>
            <span className="pk-shortcut-title">Bitácora de Auditoría</span>
            <span className="pk-shortcut-sub">Trazabilidad inmutable de cada cambio y exportación</span>
          </button>
        )}
      </div>

      <div className="pk-grid-2">
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">Salud de Microservicios ({upCount}/{totalSvcs} en línea)</div>
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void load()}>
              Actualizar
            </button>
          </div>
          <div className="pk-table-wrap" style={{ maxHeight: 340, overflowY: 'auto' }}>
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Ruta</th>
                  <th>Estado</th>
                  <th className="pk-num">Latencia</th>
                </tr>
              </thead>
              <tbody>
                {(data?.servicesHealth || []).map((svc) => (
                  <tr key={svc.serviceKey}>
                    <td><strong>{svc.serviceKey}</strong></td>
                    <td><code>{svc.apiPrefix}</code></td>
                    <td>
                      <span className={`pk-badge ${svc.status === 'UP' ? 'pk-badge-emerald' : 'pk-badge-rose'}`}>
                        {svc.status}
                      </span>
                    </td>
                    <td className="pk-num">{svc.latencyMs} ms</td>
                  </tr>
                ))}
                {(data?.servicesHealth || []).length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 18 }}>
                      Sin datos de salud para tu rol actual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">Últimas Acciones Auditadas</div>
            {hasPlatformPermission('auditoria.ver') && (
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => onNavigateSection('audit')}>
                Ver Todo →
              </button>
            )}
          </div>
          <div className="pk-table-wrap" style={{ maxHeight: 340, overflowY: 'auto' }}>
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Operador</th>
                  <th>Acción</th>
                  <th>Objetivo</th>
                  <th>Hora UTC</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentAudit || []).map((log) => (
                  <tr key={log.logId}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{log.actorEmail}</div>
                      <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{log.actorRole}</div>
                    </td>
                    <td><code>{log.action}</code></td>
                    <td>{log.tenantId || log.targetId || '—'}</td>
                    <td style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>{log.createdAt.slice(0, 19).replace('T', ' ')}</td>
                  </tr>
                ))}
                {(data?.recentAudit || []).length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 18 }}>
                      Sin eventos recientes registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
