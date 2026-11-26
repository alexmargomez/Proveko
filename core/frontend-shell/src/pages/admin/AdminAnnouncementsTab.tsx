import React, { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '@platform/ui-sdk';

interface AnnouncementItem {
  announcementId: string;
  title: string;
  message: string;
  severity: string;
  targetScope: string;
  targetTenants: string[];
  active: boolean;
  createdBy: string;
  createdAt: string;
}

export const AdminAnnouncementsTab: React.FC = () => {
  const { apiGet, apiPost, apiPut, apiDelete, hasPlatformPermission, toast } = usePlatform();
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('INFO');
  const [targetScope, setTargetScope] = useState('ALL');
  const [targetTenants, setTargetTenants] = useState('');

  const canManage = hasPlatformPermission('plataforma.anuncios');

  const load = useCallback(async () => {
    const resp = await apiGet<{ announcements: AnnouncementItem[] }>('/api/v1/admin/announcements');
    setItems(resp.announcements || []);
  }, [apiGet]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/admin/announcements', {
      title,
      message,
      severity,
      targetScope,
      targetTenants: targetScope === 'SPECIFIC' ? targetTenants.split(',').map((s) => s.trim()).filter(Boolean) : [],
    });
    setTitle('');
    setMessage('');
    setTargetTenants('');
    toast('Anuncio publicado');
    await load();
  };

  const toggleActive = async (item: AnnouncementItem) => {
    await apiPut(`/api/v1/admin/announcements/${encodeURIComponent(item.announcementId)}`, {
      ...item,
      active: !item.active,
    });
    await load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {canManage && (
        <div className="pk-card">
          <div className="pk-card-head"><div className="pk-card-title">Publicar Anuncio / Aviso de Mantenimiento</div></div>
          <div className="pk-card-body">
            <form onSubmit={(e) => void handleCreate(e)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label className="pk-label">Título</label>
                <input className="pk-input" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mantenimiento programado" />
              </div>
              <div>
                <label className="pk-label">Severidad</label>
                <select className="pk-input" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  <option value="INFO">Informativo (Azul)</option>
                  <option value="WARNING">Advertencia (Ámbar)</option>
                  <option value="CRITICAL">Crítico (Rojo)</option>
                </select>
              </div>
              <div>
                <label className="pk-label">Alcance</label>
                <select className="pk-input" value={targetScope} onChange={(e) => setTargetScope(e.target.value)}>
                  <option value="ALL">Todas las empresas</option>
                  <option value="SPECIFIC">Empresas específicas</option>
                </select>
              </div>
              {targetScope === 'SPECIFIC' && (
                <div>
                  <label className="pk-label">IDs de Empresas (coma)</label>
                  <input className="pk-input" value={targetTenants} onChange={(e) => setTargetTenants(e.target.value)} placeholder="ten_123, demo-empresa" />
                </div>
              )}
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="pk-label">Mensaje</label>
                <input className="pk-input" required value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Este domingo de 2:00 AM a 3:00 AM realizaremos mejoras en la plataforma." />
              </div>
              <div>
                <button type="submit" className="pk-btn pk-btn-primary">Publicar Anuncio</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="pk-card">
        <div className="pk-card-head"><div className="pk-card-title">Anuncios Registrados ({items.length})</div></div>
        <div className="pk-card-body" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="pk-table">
            <thead>
              <tr>
                <th>Anuncio</th>
                <th>Severidad</th>
                <th>Alcance</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.announcementId}>
                  <td><strong>{a.title}</strong><div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>{a.message}</div></td>
                  <td><span className={`pk-badge ${a.severity === 'CRITICAL' ? 'pk-badge-red' : a.severity === 'WARNING' ? 'pk-badge-amber' : 'pk-badge-blue'}`}>{a.severity}</span></td>
                  <td>{a.targetScope === 'ALL' ? 'Global' : (a.targetTenants || []).join(', ')}</td>
                  <td><span className={`pk-badge ${a.active ? 'pk-badge-emerald' : 'pk-badge-slate'}`}>{a.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td>
                    {canManage && (
                      <div className="pk-row-actions">
                        <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void toggleActive(a)}>
                          {a.active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void apiDelete(`/api/v1/admin/announcements/${encodeURIComponent(a.announcementId)}`).then(load)}>
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>No hay anuncios publicados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
