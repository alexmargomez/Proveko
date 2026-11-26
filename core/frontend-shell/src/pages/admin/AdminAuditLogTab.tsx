import React, { useCallback, useEffect, useState } from 'react';
import { PkModal, TenantSummary, usePlatform } from '@platform/ui-sdk';

interface AuditEntry {
  logId: string;
  actorUserId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  tenantId: string;
  reason: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  status: string;
  createdAt: string;
}

export const AdminAuditLogTab: React.FC = () => {
  const { apiGet, tenantsList, hasPlatformPermission } = usePlatform();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [tenants] = useState<TenantSummary[]>(tenantsList || []);
  const [tenantFilter, setTenantFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [inspectItem, setInspectItem] = useState<AuditEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (tenantFilter.trim()) qs.set('tenantId', tenantFilter.trim());
      if (actorFilter.trim()) qs.set('actor', actorFilter.trim());
      if (actionFilter.trim()) qs.set('action', actionFilter.trim());
      qs.set('limit', '150');
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
    <div className="pk-stack">
      <div className="pk-card">
        <div className="pk-card-head">
          <div>
            <div className="pk-card-title">Bitácora Inmutable de Auditoría ({logs.length} eventos)</div>
            <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
              Registro cronológico de mutaciones administrativas, accesos de soporte y exportaciones CSV.
            </div>
          </div>
          <div className="pk-row-actions">
            {hasPlatformPermission('auditoria.exportar') && (
              <a
                className="pk-btn pk-btn-emerald pk-btn-sm"
                style={{ textDecoration: 'none' }}
                href={exportUrl()}
                download="auditoria_plataforma.csv"
              >
                Exportar Bitácora CSV
              </a>
            )}
          </div>
        </div>

        <div className="pk-card-body" style={{ borderBottom: '1px solid var(--pk-border)', paddingBottom: 14 }}>
          <div className="pk-form-grid">
            <div className="pk-field">
              <label>Filtrar por Empresa</label>
              <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}>
                <option value="">Todas las empresas</option>
                {tenants.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.companyName} ({t.tenantId})
                  </option>
                ))}
              </select>
            </div>
            <div className="pk-field">
              <label>Correo del Operador</label>
              <input
                placeholder="ej: superadmin@plataforma.local"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
              />
            </div>
            <div className="pk-field">
              <label>Acción Ejecutada</label>
              <input
                placeholder="ej: exportar_csv, rol_editar..."
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              />
            </div>
            <div className="pk-row-actions">
              <button type="button" className="pk-btn pk-btn-primary" disabled={loading} onClick={() => void load()}>
                {loading ? 'Consultando...' : 'Aplicar Filtros'}
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                onClick={() => {
                  setTenantFilter('');
                  setActorFilter('');
                  setActionFilter('');
                }}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>

        <div className="pk-table-wrap">
          <table className="pk-table">
            <thead>
              <tr>
                <th>Fecha UTC</th>
                <th>Operador Interno</th>
                <th>Acción</th>
                <th>Empresa / Objetivo</th>
                <th>Motivo / Ticket</th>
                <th>IP Origen</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.logId}>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{l.createdAt.slice(0, 19).replace('T', ' ')}</td>
                  <td>
                    <strong>{l.actorEmail}</strong>
                    <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{l.actorRole}</div>
                  </td>
                  <td><code>{l.action}</code></td>
                  <td>
                    <strong>{l.tenantId || l.targetId || '—'}</strong>
                    <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{l.targetType}</div>
                  </td>
                  <td>{l.reason || '—'}</td>
                  <td style={{ fontSize: 12 }}>{l.ipAddress || '—'}</td>
                  <td>
                    <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => setInspectItem(l)}>
                      Inspeccionar
                    </button>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--pk-muted)' }}>
                    No se encontraron registros para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PkModal open={Boolean(inspectItem)} title={`Detalle de Evento Auditado: ${inspectItem?.logId || ''}`} onClose={() => setInspectItem(null)} maxWidth={680}>
        {inspectItem && (
          <div className="pk-stack" style={{ fontSize: 12.5 }}>
            <div className="pk-grid-2">
              <div>
                <div className="pk-label">Operador</div>
                <strong>{inspectItem.actorEmail}</strong> ({inspectItem.actorRole})
              </div>
              <div>
                <div className="pk-label">Fecha Exacta UTC</div>
                <code>{inspectItem.createdAt}</code>
              </div>
              <div>
                <div className="pk-label">Acción / Tipo Objetivo</div>
                <code>{inspectItem.action}</code> · {inspectItem.targetType} ({inspectItem.targetId || 'N/A'})
              </div>
              <div>
                <div className="pk-label">Dirección IP y Agente</div>
                <div>{inspectItem.ipAddress || '—'}</div>
                <div style={{ fontSize: 11, color: 'var(--pk-muted)', wordBreak: 'break-all' }}>{inspectItem.userAgent || ''}</div>
              </div>
            </div>
            {inspectItem.reason && (
              <div>
                <div className="pk-label">Motivo / Ticket Registrado</div>
                <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--pk-border)' }}>
                  {inspectItem.reason}
                </div>
              </div>
            )}
            <div>
              <div className="pk-label">Payload Registrado (Después del Cambio)</div>
              <pre className="pk-cred-box" style={{ margin: 0, maxHeight: 240, overflow: 'auto' }}>
                {JSON.stringify(inspectItem.after || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </PkModal>
    </div>
  );
};
