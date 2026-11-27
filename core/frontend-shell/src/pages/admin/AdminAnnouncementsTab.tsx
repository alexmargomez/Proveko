import React, { useCallback, useEffect, useState } from 'react';
import { PkConfirmModal, PkModal, PkSimpleSelect, TenantSummary, useAsyncAction, usePlatform } from '@platform/ui-sdk';
import { AdminSwitch } from './AdminSwitch';

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
  const { apiGet, apiPost, apiPut, apiDelete, tenantsList, hasPlatformPermission, toast } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>(tenantsList || []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementItem | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('INFO');
  const [targetScope, setTargetScope] = useState('ALL');
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);

  const canManage = hasPlatformPermission('plataforma.anuncios');

  const load = useCallback(async () => {
    const [annResp, tenResp] = await Promise.all([
      apiGet<{ announcements: AnnouncementItem[] }>('/api/v1/admin/announcements'),
      hasPlatformPermission('empresas.ver')
        ? apiGet<{ tenants: TenantSummary[] }>('/api/v1/admin/tenants').catch(() => ({ tenants: tenantsList || [] }))
        : Promise.resolve({ tenants: tenantsList || [] }),
    ]);
    setItems(annResp.announcements || []);
    setTenants(tenResp.tenants || []);
  }, [apiGet, hasPlatformPermission, tenantsList]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setTitle('');
    setMessage('');
    setSeverity('INFO');
    setTargetScope('ALL');
    setSelectedTenants([]);
    setModalOpen(true);
  };

  const openEdit = (a: AnnouncementItem) => {
    setEditing(a);
    setTitle(a.title);
    setMessage(a.message);
    setSeverity(a.severity);
    setTargetScope(a.targetScope);
    setSelectedTenants([...(a.targetTenants || [])]);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const payload = {
        title,
        message,
        severity,
        targetScope,
        targetTenants: targetScope === 'SPECIFIC' ? selectedTenants : [],
        active: editing ? editing.active : true,
      };
      if (editing) {
        await apiPut(`/api/v1/admin/announcements/${encodeURIComponent(editing.announcementId)}`, payload);
        toast('Anuncio actualizado');
      } else {
        await apiPost('/api/v1/admin/announcements', payload);
        toast('Anuncio publicado hacia las estaciones de clientes');
      }
      setModalOpen(false);
      await load();
    });
  };

  return (
    <div className="pk-stack">
      <div className="pk-card">
        <div className="pk-card-head">
          <div>
            <div className="pk-card-title">Comunicados y Avisos Operativos hacia Clientes ({items.length})</div>
            <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
              Muestra banners informativos, avisos de mantenimiento o alertas críticas en la parte superior de la estación de las empresas.
            </div>
          </div>
          {canManage && (
            <button type="button" className="pk-btn pk-btn-primary" onClick={openCreate}>
              + Publicar Nuevo Comunicado
            </button>
          )}
        </div>

        <div className="pk-table-wrap">
          <table className="pk-table">
            <thead>
              <tr>
                <th>Comunicado</th>
                <th>Nivel</th>
                <th>Destinatarios</th>
                <th>Publicado</th>
                <th>Visible</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.announcementId}>
                  <td>
                    <strong>{a.title}</strong>
                    <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>{a.message}</div>
                  </td>
                  <td>
                    <span
                      className={`pk-badge ${
                        a.severity === 'CRITICAL' ? 'pk-badge-rose' : a.severity === 'WARNING' ? 'pk-badge-amber' : 'pk-badge-blue'
                      }`}
                    >
                      {a.severity}
                    </span>
                  </td>
                  <td>
                    {a.targetScope === 'ALL'
                      ? 'Todas las empresas'
                      : `${(a.targetTenants || []).length} empresa(s) específicas`}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--pk-muted)' }}>
                    {a.createdAt.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td>
                    <AdminSwitch
                      checked={a.active}
                      disabled={!canManage || busy}
                      tone="emerald"
                      onChange={(next) =>
                        void run(async () => {
                          await apiPut(`/api/v1/admin/announcements/${encodeURIComponent(a.announcementId)}`, {
                            ...a,
                            active: next,
                          });
                          await load();
                        })
                      }
                    />
                  </td>
                  <td>
                    {canManage && (
                      <div className="pk-row-actions">
                        <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => openEdit(a)}>
                          Editar
                        </button>
                        <button type="button" className="pk-btn pk-btn-danger pk-btn-sm" onClick={() => setDeleteTarget(a)}>
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--pk-muted)' }}>
                    No hay comunicados publicados en este momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PkModal
        open={modalOpen}
        title={editing ? 'Editar Comunicado' : 'Publicar Nuevo Comunicado de Plataforma'}
        onClose={() => setModalOpen(false)}
        maxWidth={620}
      >
        <form onSubmit={handleSave} className="pk-stack">
          <div className="pk-form-grid cols-2">
            <div className="pk-field">
              <label>Título del Aviso</label>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Ventana de Mantenimiento Programado" />
            </div>
            <PkSimpleSelect
              label="Nivel de Prioridad"
              searchable={false}
              value={severity}
              onChange={(nextSev) => setSeverity(nextSev)}
              options={[
                { value: 'INFO', label: 'Informativo (Azul)' },
                { value: 'WARNING', label: 'Advertencia (Ámbar)' },
                { value: 'CRITICAL', label: 'Crítico (Rojo)' },
              ]}
            />
          </div>

          <div className="pk-field">
            <label>Mensaje para los Usuarios</label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe el detalle claro que verán las empresas en su estación..."
            />
          </div>

          <PkSimpleSelect
            label="Alcance de Publicación"
            searchable={false}
            value={targetScope}
            onChange={(nextScope) => setTargetScope(nextScope)}
            options={[
              { value: 'ALL', label: 'Global — Todas las empresas clientes' },
              { value: 'SPECIFIC', label: 'Dirigido — Solo empresas seleccionadas' },
            ]}
          />

          {targetScope === 'SPECIFIC' && (
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--pk-border)', borderRadius: 8, padding: 10 }}>
              <div className="pk-label">Selecciona las empresas destinatarias</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                {tenants.map((t) => (
                  <label key={t.tenantId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                    <input
                      type="checkbox"
                      checked={selectedTenants.includes(t.tenantId)}
                      onChange={(e) =>
                        setSelectedTenants((prev) =>
                          e.target.checked ? [...prev, t.tenantId] : prev.filter((id) => id !== t.tenantId)
                        )
                      }
                    />
                    <span>{t.companyName}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="pk-form-actions">
            <button type="button" className="pk-btn pk-btn-outline" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              {busy ? 'Guardando...' : editing ? 'Guardar Cambios' : 'Publicar Comunicado'}
            </button>
          </div>
        </form>
      </PkModal>

      <PkConfirmModal
        open={Boolean(deleteTarget)}
        title="Eliminar Comunicado"
        message={`¿Confirmas eliminar el comunicado "${deleteTarget?.title || ''}"?`}
        confirmLabel="Eliminar"
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void run(async () => {
            await apiDelete(`/api/v1/admin/announcements/${encodeURIComponent(deleteTarget.announcementId)}`);
            setDeleteTarget(null);
            await load();
            toast('Comunicado eliminado');
          });
        }}
      />
    </div>
  );
};
