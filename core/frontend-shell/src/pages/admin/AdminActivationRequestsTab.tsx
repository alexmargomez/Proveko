import React, { useCallback, useEffect, useState } from 'react';
import { ModuleActivationRecord, formatCop, usePlatform } from '@platform/ui-sdk';

export const AdminActivationRequestsTab: React.FC<{
  onOpenTenant: (tenantId: string) => void;
}> = ({ onOpenTenant }) => {
  const { apiGet } = usePlatform();
  const [requests, setRequests] = useState<ModuleActivationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiGet<{ requests: ModuleActivationRecord[] }>('/api/v1/admin/activation-requests');
      setRequests(resp.requests || []);
    } finally {
      setLoading(false);
    }
  }, [apiGet]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="pk-card">
      <div className="pk-card-head">
        <div>
          <div className="pk-card-title">Solicitudes y Autogestiones de Ampliación de Módulos ({requests.length})</div>
          <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
            Registro histórico de servicios, módulos y funciones activados por las empresas clientes desde su estación.
          </div>
        </div>
        <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" disabled={loading} onClick={() => void load()}>
          Actualizar
        </button>
      </div>
      <div className="pk-table-wrap">
        <table className="pk-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Empresa Cliente</th>
              <th>Solicitado Por</th>
              <th>Capacidad Activada</th>
              <th className="pk-num">Tarifa Resultante</th>
              <th>Estado</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.requestId}>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{r.createdAt.slice(0, 19).replace('T', ' ')}</td>
                <td>
                  <strong>{r.companyName}</strong>
                  <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}><code>{r.tenantId}</code></div>
                </td>
                <td>{r.requestedBy}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(r.addedServices || []).map((s) => (
                      <span key={s} className="pk-badge pk-badge-blue">{s}</span>
                    ))}
                    {(r.addedModules || []).map((m) => (
                      <span key={m} className="pk-badge pk-badge-slate">{m}</span>
                    ))}
                  </div>
                </td>
                <td className="pk-num">{formatCop(r.monthlyCopAfter || 0)}/mes</td>
                <td>
                  <span className="pk-badge pk-badge-emerald">{r.status || 'APPLIED'}</span>
                </td>
                <td>
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    onClick={() => onOpenTenant(r.tenantId)}
                  >
                    Abrir Empresa 360°
                  </button>
                </td>
              </tr>
            ))}
            {!loading && requests.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--pk-muted)' }}>
                  Aún no se han registrado ampliaciones de plan por autogestión.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
