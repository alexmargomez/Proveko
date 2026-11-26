import React, { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '@platform/ui-sdk';

interface AuditEntry {
  logId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  tenantId: string;
  reason: string;
  ipAddress: string;
  status: string;
  createdAt: string;
}

export const AdminAuditLogTab: React.FC = () => {
  const { apiGet, hasPlatformPermission } = usePlatform();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [tenantFilter, setTenantFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (tenantFilter.trim()) qs.set('tenantId', tenantFilter.trim());
      if (actorFilter.trim()) qs.set('actor', actorFilter.trim());
      if (actionFilter.trim()) qs.set('action', actionFilter.trim());
      const resp = await apiGet<{ logs: AuditEntry[] }>(`/api/v1/admin/audit?${qs.toString()}`);
      setLogs(resp.logs || []);
    } finally {
      setLoading(false);
    }
  }, [apiGet, tenantFilter, actorFilter, actionFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportUrl = () => {
    const qs = new URLSearchParams();
    if (tenantFilter.trim()) qs.set('tenantId', tenantFilter.trim());
    if (actorFilter.trim()) qs.set('actor', actorFilter.trim());
    if (actionFilter.trim()) qs.set('action', actionFilter.trim());
    return `/api/v1/admin/audit/export-csv?${qs.toString()}`;
  };

  return (
    <div className="pk-card">
      <div className="pk-card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="pk-card-title">Bitácora Inmutable de Auditoría ({logs.length})</div>
        <div className="pk-row-actions">
          <input className="pk-input" style={{ width: 170 }} placeholder="Empresa ID..." value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)} />
          <input className="pk-input" style={{ width: 180 }} placeholder="Operador correo..." value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} />
          <input className="pk-input" style={{ width: 180 }} placeholder="Acción..." value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} />
          <button type="button" className="pk-btn pk-btn-primary pk-btn-sm" disabled={loading} onClick={() => void load()}>
            Filtrar
          </button>
          {hasPlatformPermission('auditoria.exportar') && (
            <a className="pk-btn pk-btn-outline pk-btn-sm" href={exportUrl()} download="auditoria_plataforma.csv">
              Exportar CSV
            </a>
          )}
        </div>
      </div>
      <div className="pk-card-body" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="pk-table">
          <thead>
            <tr>
              <th>Fecha UTC</th>
              <th>Operador</th>
              <th>Acción</th>
              <th>Empresa / Objetivo</th>
              <th>Motivo / Ticket</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.logId}>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{l.createdAt.slice(0, 19).replace('T', ' ')}</td>
                <td><strong>{l.actorEmail}</strong><div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{l.actorRole}</div></td>
                <td><code>{l.action}</code></td>
                <td>{l.tenantId || l.targetId || '—'}<div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{l.targetType}</div></td>
                <td>{l.reason || '—'}</td>
                <td style={{ fontSize: 12 }}>{l.ipAddress || '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>Sin registros de auditoría para los filtros actuales.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
