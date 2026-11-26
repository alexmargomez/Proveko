import React, { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '@platform/ui-sdk';

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

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export const AdminOverviewTab: React.FC = () => {
  const { apiGet } = usePlatform();
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
    return <div className="pk-card"><div className="pk-card-body">Cargando métricas de la plataforma...</div></div>;
  }

  const k = data?.kpis;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
        <div className="pk-card"><div className="pk-card-body">
          <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>Empresas Registradas</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{k?.totalTenants ?? 0}</div>
          <div style={{ fontSize: 12, color: '#059669' }}>{k?.activeTenants ?? 0} activas · {k?.suspendedTenants ?? 0} suspendidas</div>
        </div></div>
        <div className="pk-card"><div className="pk-card-body">
          <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>MRR Estimado (Sin Demo)</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#023047' }}>{cop.format(k?.mrrCop ?? 0)}</div>
          <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>Facturación mensual proyectada</div>
        </div></div>
        <div className="pk-card"><div className="pk-card-body">
          <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>En Mantenimiento</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: (k?.maintenanceTenants ?? 0) > 0 ? '#d97706' : '#0f172a' }}>
            {k?.maintenanceTenants ?? 0}
          </div>
          <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>Ventanas individuales activas</div>
        </div></div>
        <div className="pk-card"><div className="pk-card-body">
          <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>Gobierno Activo</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{k?.activeFlags ?? 0} flags</div>
          <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>{k?.activeAnnouncements ?? 0} anuncios vigentes</div>
        </div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">Salud de Microservicios Registrados</div>
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void load()}>
              Actualizar
            </button>
          </div>
          <div className="pk-card-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Prefijo API</th>
                  <th>Estado</th>
                  <th>Latencia</th>
                </tr>
              </thead>
              <tbody>
                {(data?.servicesHealth || []).map((svc) => (
                  <tr key={svc.serviceKey}>
                    <td><strong>{svc.serviceKey}</strong></td>
                    <td><code>{svc.apiPrefix}</code></td>
                    <td>
                      <span className={`pk-badge ${svc.status === 'UP' ? 'pk-badge-emerald' : 'pk-badge-red'}`}>
                        {svc.status}
                      </span>
                    </td>
                    <td>{svc.latencyMs} ms</td>
                  </tr>
                ))}
                {(data?.servicesHealth || []).length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>Sin permiso o sin microservicios reportados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">Actividad Administrativa Reciente</div>
          </div>
          <div className="pk-card-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Operador</th>
                  <th>Acción</th>
                  <th>Empresa / Objetivo</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentAudit || []).map((log) => (
                  <tr key={log.logId}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.actorEmail}</div>
                      <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{log.actorRole}</div>
                    </td>
                    <td><code>{log.action}</code></td>
                    <td>{log.tenantId || log.targetId || '—'}</td>
                    <td style={{ fontSize: 12 }}>{log.createdAt.slice(0, 19).replace('T', ' ')}</td>
                  </tr>
                ))}
                {(data?.recentAudit || []).length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>Sin eventos recientes registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
