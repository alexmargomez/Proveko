import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TenantSummary, TenantUserRecord, usePlatform } from '@platform/ui-sdk';

interface ExportJobSummary {
  jobId: string;
  tenantId: string;
  companyName: string;
  requestedBy: string;
  reason: string;
  servicesIncluded: string[];
  status: string;
  fileSizeBytes: number;
  createdAt: string;
}

interface TenantMeta {
  tenantId: string;
  billingNotes: string;
  supportTier: string;
  accountManager: string;
}

interface Props {
  onStartSupport: (tenantId: string, mode: 'readonly' | 'readwrite', reason: string, durationMinutes: number) => Promise<void>;
}

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export const AdminTenants360Tab: React.FC<Props> = ({ onStartSupport }) => {
  const { apiGet, apiPost, apiPut, catalog, hasPlatformPermission, requireDataReason, toast } = usePlatform();
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detailTab, setDetailTab] = useState<'general' | 'licenses' | 'users' | 'support_export'>('general');
  const [tenantUsers, setTenantUsers] = useState<TenantUserRecord[]>([]);
  const [exportJobs, setExportJobs] = useState<ExportJobSummary[]>([]);
  const [meta, setMeta] = useState<TenantMeta>({ tenantId: '', billingNotes: '', supportTier: 'STANDARD', accountManager: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [createForm, setCreateForm] = useState({
    companyName: '', nit: '', adminFullName: '', adminUsername: '', password: '', businessPreset: 'comercio',
  });
  const [quotaMaxUsers, setQuotaMaxUsers] = useState(15);
  const [quotaCustomCop, setQuotaCustomCop] = useState(0);
  const [maintMode, setMaintMode] = useState(false);
  const [maintMsg, setMaintMsg] = useState('');
  const [draftServices, setDraftServices] = useState<string[]>([]);
  const [draftModules, setDraftModules] = useState<string[]>([]);
  const [newUserForm, setNewUserForm] = useState({ fullName: '', username: '', email: '', password: '', internalRole: 'cajero', isCompanyAdmin: false });
  const [supportMode, setSupportMode] = useState<'readonly' | 'readwrite'>('readonly');
  const [supportReason, setSupportReason] = useState('');
  const [supportDuration, setSupportDuration] = useState(30);
  const [exportReason, setExportReason] = useState('');
  const [exporting, setExporting] = useState(false);

  const loadTenants = useCallback(async () => {
    const resp = await apiGet<{ tenants: TenantSummary[] }>('/api/v1/admin/tenants');
    const list = resp.tenants || [];
    setTenants(list);
    if (!selectedId && list.length > 0) {
      setSelectedId(list[0].tenantId);
    }
  }, [apiGet, selectedId]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  const selected = useMemo(() => tenants.find((t) => t.tenantId === selectedId) || null, [tenants, selectedId]);

  const loadTenantDetails = useCallback(async (t: TenantSummary) => {
    setQuotaMaxUsers(t.maxUsersAllowed || 15);
    setQuotaCustomCop(t.customMonthlyCop || 0);
    setMaintMode(Boolean(t.maintenanceMode));
    setMaintMsg(t.maintenanceMessage || '');
    setDraftServices([...(t.activeServices || [])]);
    setDraftModules([...(t.activeModules || [])]);

    if (hasPlatformPermission('usuarios_cliente.ver')) {
      try {
        const uResp = await apiGet<{ users: TenantUserRecord[] }>(`/api/v1/admin/tenants/${encodeURIComponent(t.tenantId)}/users`);
        setTenantUsers(uResp.users || []);
      } catch {
        setTenantUsers([]);
      }
    }
    try {
      const mResp = await apiGet<{ metadata: TenantMeta }>(`/api/v1/admin/tenants/${encodeURIComponent(t.tenantId)}/metadata`);
      if (mResp.metadata) setMeta(mResp.metadata);
    } catch {
      // Ignore metadata read errors
    }
    if (hasPlatformPermission('datos_negocio.exportar_csv')) {
      try {
        const eResp = await apiGet<{ jobs: ExportJobSummary[] }>(`/api/v1/admin/tenants/${encodeURIComponent(t.tenantId)}/exports`);
        setExportJobs(eResp.jobs || []);
      } catch {
        setExportJobs([]);
      }
    }
  }, [apiGet, hasPlatformPermission]);

  useEffect(() => {
    if (selected) {
      void loadTenantDetails(selected);
    }
  }, [selected, loadTenantDetails]);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) =>
      t.companyName.toLowerCase().includes(q) || t.nit.toLowerCase().includes(q) || t.tenantId.toLowerCase().includes(q)
    );
  }, [tenants, search]);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    const resp = await apiPost<{ tenant: TenantSummary }>('/api/v1/admin/tenants', createForm);
    setShowCreateModal(false);
    setCreateForm({ companyName: '', nit: '', adminFullName: '', adminUsername: '', password: '', businessPreset: 'comercio' });
    toast(`Empresa "${resp.tenant.companyName}" aprovisionada`);
    await loadTenants();
    setSelectedId(resp.tenant.tenantId);
  };

  const handleSaveQuotas = async () => {
    if (!selected) return;
    await apiPut(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/quotas`, {
      maxUsersAllowed: quotaMaxUsers,
      customMonthlyCop: quotaCustomCop,
    });
    toast('Cuotas y tarifa actualizadas');
    await loadTenants();
  };

  const handleSaveMaintenance = async () => {
    if (!selected) return;
    await apiPut(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/maintenance`, {
      maintenanceMode: maintMode,
      maintenanceMessage: maintMsg,
    });
    toast(maintMode ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado');
    await loadTenants();
  };

  const handleToggleStatus = async () => {
    if (!selected) return;
    const next = selected.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    await apiPut(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/status`, { status: next });
    toast(`Empresa ahora está ${next}`);
    await loadTenants();
  };

  const handleRevokeTenantSessions = async () => {
    if (!selected) return;
    await apiPost(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/revoke-sessions`, {});
    toast('Todas las sesiones activas de esta empresa fueron revocadas');
    await loadTenants();
  };

  const toggleServiceLicense = (serviceKey: string) => {
    const svc = catalog.find((s) => s.serviceKey === serviceKey);
    const has = draftServices.includes(serviceKey);
    if (has) {
      const svcModKeys = new Set((svc?.modules || []).map((m) => m.moduleKey));
      setDraftServices(draftServices.filter((s) => s !== serviceKey));
      setDraftModules(draftModules.filter((m) => !svcModKeys.has(m)));
    } else {
      const defaultMods = (svc?.modules || []).filter((m) => m.defaultActive).map((m) => m.moduleKey);
      setDraftServices([...draftServices, serviceKey]);
      setDraftModules(Array.from(new Set([...draftModules, ...defaultMods])));
    }
  };

  const handleSaveSubscriptions = async () => {
    if (!selected) return;
    await apiPut(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/subscriptions`, {
      activeServices: draftServices,
      activeModules: draftModules,
      activeFeatures: selected.activeFeatures || [],
    });
    toast('Licencias de empresa actualizadas');
    await loadTenants();
  };

  const handleCreateTenantUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    await apiPost(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/users`, newUserForm);
    setNewUserForm({ fullName: '', username: '', email: '', password: '', internalRole: 'cajero', isCompanyAdmin: false });
    toast('Usuario de cliente creado');
    await loadTenantDetails(selected);
  };

  const handleResetUserPass = async (u: TenantUserRecord) => {
    if (!selected) return;
    const pwd = window.prompt(`Nueva contraseña temporal para ${u.username} (mínimo 8 caracteres):`);
    if (!pwd || pwd.trim().length < 8) return;
    await apiPost(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/users/${encodeURIComponent(u.userId)}/reset-password`, {
      password: pwd.trim(),
    });
    toast(`Contraseña restablecida y sesiones revocadas para ${u.username}`);
  };

  const handleGenerateExport = async () => {
    if (!selected) return;
    setExporting(true);
    try {
      await apiPost(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/exports`, { reason: exportReason });
      setExportReason('');
      toast('Paquete ZIP CSV generado y listo para descargar');
      await loadTenantDetails(selected);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showCreateModal && (
        <div className="pk-card" style={{ border: '1.5px solid #023047' }}>
          <div className="pk-card-head">
            <div className="pk-card-title">Aprovisionar Nueva Empresa Cliente</div>
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => setShowCreateModal(false)}>Cancelar</button>
          </div>
          <div className="pk-card-body">
            <form onSubmit={(e) => void handleCreateTenant(e)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
              <input className="pk-input" required placeholder="Razón social" value={createForm.companyName} onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })} />
              <input className="pk-input" required placeholder="NIT" value={createForm.nit} onChange={(e) => setCreateForm({ ...createForm, nit: e.target.value })} />
              <input className="pk-input" required placeholder="Nombre administrador" value={createForm.adminFullName} onChange={(e) => setCreateForm({ ...createForm, adminFullName: e.target.value })} />
              <input type="email" className="pk-input" required placeholder="Correo administrador" value={createForm.adminUsername} onChange={(e) => setCreateForm({ ...createForm, adminUsername: e.target.value })} />
              <input type="password" className="pk-input" required minLength={8} placeholder="Contraseña (mín 8)" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
              <select className="pk-input" value={createForm.businessPreset} onChange={(e) => setCreateForm({ ...createForm, businessPreset: e.target.value })}>
                <option value="comercio">Comercio</option>
                <option value="restaurante">Restaurante</option>
                <option value="taller">Taller</option>
                <option value="hotel">Hotelería</option>
                <option value="full">Suite Completa</option>
              </select>
              <button type="submit" className="pk-btn pk-btn-primary">Crear Empresa</button>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(270px, 330px) 1fr', gap: 16, alignItems: 'start' }}>
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">Empresas ({filteredTenants.length})</div>
            {hasPlatformPermission('empresas.crear') && (
              <button type="button" className="pk-btn pk-btn-primary pk-btn-sm" onClick={() => setShowCreateModal(true)}>+ Nueva</button>
            )}
          </div>
          <div className="pk-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10 }}>
            <input className="pk-input" placeholder="Buscar razón social o NIT..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div style={{ maxHeight: 540, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredTenants.map((t) => (
                <button
                  key={t.tenantId}
                  type="button"
                  onClick={() => setSelectedId(t.tenantId)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: selectedId === t.tenantId ? '1.5px solid #023047' : '1px solid #e2e8f0',
                    background: selectedId === t.tenantId ? '#f0f9ff' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <strong style={{ fontSize: 13 }}>{t.companyName}</strong>
                    <span className={`pk-badge ${t.status === 'ACTIVE' ? 'pk-badge-emerald' : 'pk-badge-red'}`}>{t.status}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', marginTop: 2 }}>
                    NIT {t.nit} · {t.activeServices.length} servicios {t.maintenanceMode ? '· MANTENIMIENTO' : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {selected && (
          <div className="pk-card">
            <div className="pk-card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div className="pk-card-title">{selected.companyName}</div>
                <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>
                  ID: <code>{selected.tenantId}</code> · BD: <code>{selected.dbName}</code> · Tarifa: <strong>{cop.format(selected.customMonthlyCop || selected.monthlyCop || 0)}/mes</strong>
                </div>
              </div>
              <div className="pk-row-actions">
                <button type="button" className={`pk-btn pk-btn-sm ${detailTab === 'general' ? 'pk-btn-primary' : 'pk-btn-outline'}`} onClick={() => setDetailTab('general')}>Estado y Cuotas</button>
                <button type="button" className={`pk-btn pk-btn-sm ${detailTab === 'licenses' ? 'pk-btn-primary' : 'pk-btn-outline'}`} onClick={() => setDetailTab('licenses')}>Licencias</button>
                <button type="button" className={`pk-btn pk-btn-sm ${detailTab === 'users' ? 'pk-btn-primary' : 'pk-btn-outline'}`} onClick={() => setDetailTab('users')}>Usuarios ({tenantUsers.length})</button>
                <button type="button" className={`pk-btn pk-btn-sm ${detailTab === 'support_export' ? 'pk-btn-primary' : 'pk-btn-outline'}`} onClick={() => setDetailTab('support_export')}>Soporte y CSV</button>
              </div>
            </div>

            <div className="pk-card-body">
              {detailTab === 'general' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {hasPlatformPermission('empresas.suspender') && (
                      <button type="button" className="pk-btn pk-btn-outline" onClick={() => void handleToggleStatus()}>
                        {selected.status === 'SUSPENDED' ? 'Reactivar Empresa' : 'Suspender Empresa'}
                      </button>
                    )}
                    {hasPlatformPermission('usuarios_cliente.revocar_sesiones') && (
                      <button type="button" className="pk-btn pk-btn-outline" onClick={() => void handleRevokeTenantSessions()}>
                        Revocar Todas las Sesiones (v{selected.sessionVersion || 1})
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, padding: 14, background: '#f8fafc', borderRadius: 8 }}>
                    <div>
                      <label className="pk-label">Cupo Máximo de Usuarios</label>
                      <input type="number" className="pk-input" min={1} max={1000} value={quotaMaxUsers} onChange={(e) => setQuotaMaxUsers(Number(e.target.value) || 1)} />
                    </div>
                    <div>
                      <label className="pk-label">Tarifa Mensual Personalizada COP (0 = automática)</label>
                      <input type="number" className="pk-input" min={0} value={quotaCustomCop} onChange={(e) => setQuotaCustomCop(Number(e.target.value) || 0)} />
                    </div>
                    {hasPlatformPermission('empresas.editar_cuotas') && (
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button type="button" className="pk-btn pk-btn-primary" onClick={() => void handleSaveQuotas()}>Guardar Cuotas</button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: 14, background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                        <input type="checkbox" checked={maintMode} onChange={(e) => setMaintMode(e.target.checked)} />
                        <span>Activar Modo Mantenimiento Individual (bloquea acceso del cliente, permite soporte)</span>
                      </label>
                      <input className="pk-input" value={maintMsg} onChange={(e) => setMaintMsg(e.target.value)} placeholder="Mensaje mostrado al cliente durante el mantenimiento..." />
                    </div>
                    {hasPlatformPermission('empresas.mantenimiento') && (
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button type="button" className="pk-btn pk-btn-amber-brand" onClick={() => void handleSaveMaintenance()}>Aplicar</button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    <div>
                      <label className="pk-label">Nivel de Soporte</label>
                      <select className="pk-input" value={meta.supportTier} onChange={(e) => setMeta({ ...meta, supportTier: e.target.value })}>
                        <option value="STANDARD">Estándar</option>
                        <option value="PRIORITY">Prioritario</option>
                        <option value="ENTERPRISE">Corporativo 24/7</option>
                      </select>
                    </div>
                    <div>
                      <label className="pk-label">Ejecutivo de Cuenta</label>
                      <input className="pk-input" value={meta.accountManager} onChange={(e) => setMeta({ ...meta, accountManager: e.target.value })} placeholder="Nombre ejecutivo" />
                    </div>
                    <div>
                      <label className="pk-label">Notas Internas de Cartera</label>
                      <input className="pk-input" value={meta.billingNotes} onChange={(e) => setMeta({ ...meta, billingNotes: e.target.value })} placeholder="Acuerdo anual / descuentos..." />
                    </div>
                    {hasPlatformPermission('empresas.editar_cuotas') && (
                      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <button type="button" className="pk-btn pk-btn-outline" onClick={() => void apiPut(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/metadata`, meta).then(() => toast('Ficha interna guardada'))}>
                          Guardar Ficha
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'licenses' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
                    {catalog.map((svc) => {
                      const active = draftServices.includes(svc.serviceKey);
                      return (
                        <label key={svc.serviceKey} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 8, border: active ? '1px solid #0284c7' : '1px solid #e2e8f0', background: active ? '#f0f9ff' : '#fff' }}>
                          <input type="checkbox" checked={active} disabled={!hasPlatformPermission('empresas.editar_suscripcion')} onChange={() => toggleServiceLicense(svc.serviceKey)} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{svc.displayName}</div>
                            <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{svc.modules.length} módulos</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {hasPlatformPermission('empresas.editar_suscripcion') && (
                    <div>
                      <button type="button" className="pk-btn pk-btn-primary" onClick={() => void handleSaveSubscriptions()}>Guardar Licencias de la Empresa</button>
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'users' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {hasPlatformPermission('usuarios_cliente.crear') && (
                    <form onSubmit={(e) => void handleCreateTenantUser(e)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, alignItems: 'end' }}>
                      <input className="pk-input" required placeholder="Nombre completo" value={newUserForm.fullName} onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })} />
                      <input className="pk-input" required placeholder="Usuario / Correo" value={newUserForm.username} onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value, email: e.target.value })} />
                      <input type="password" className="pk-input" required minLength={8} placeholder="Contraseña" value={newUserForm.password} onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} />
                      <select className="pk-input" value={newUserForm.internalRole} onChange={(e) => setNewUserForm({ ...newUserForm, internalRole: e.target.value })}>
                        <option value="admin_empresa">Admin Empresa</option>
                        <option value="cajero">Cajero</option>
                        <option value="vendedor">Vendedor</option>
                        <option value="bodega">Bodega</option>
                        <option value="contador">Contador</option>
                      </select>
                      <button type="submit" className="pk-btn pk-btn-primary">Crear Usuario</button>
                    </form>
                  )}
                  <table className="pk-table">
                    <thead>
                      <tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                      {tenantUsers.map((u) => (
                        <tr key={u.userId}>
                          <td><strong>{u.fullName}</strong><div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>{u.username}</div></td>
                          <td><code>{u.internalRole}</code></td>
                          <td><span className={`pk-badge ${u.status === 'ACTIVE' ? 'pk-badge-emerald' : 'pk-badge-red'}`}>{u.status}</span></td>
                          <td>
                            <div className="pk-row-actions">
                              {hasPlatformPermission('usuarios_cliente.reset_password') && (
                                <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void handleResetUserPass(u)}>Reset Clave</button>
                              )}
                              {hasPlatformPermission('usuarios_cliente.revocar_sesiones') && (
                                <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void apiPost(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/users/${encodeURIComponent(u.userId)}/revoke-sessions`, {}).then(() => toast('Sesión de usuario revocada'))}>Revocar Sesión</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {detailTab === 'support_export' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                  <div style={{ padding: 14, borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Ingreso de Soporte Controlado (Impersonación)</div>
                    {!hasPlatformPermission('datos_negocio.ver') ? (
                      <div style={{ fontSize: 12.5, color: '#991b1b' }}>Tu rol no tiene habilitado el permiso <code>datos_negocio.ver</code>.</div>
                    ) : (
                      <>
                        <select className="pk-input" value={supportMode} onChange={(e) => setSupportMode(e.target.value as 'readonly' | 'readwrite')}>
                          <option value="readonly">Solo Lectura (bloquea escrituras)</option>
                          {hasPlatformPermission('soporte.impersonar_escritura') && (
                            <option value="readwrite">Lectura y Escritura (corrección operativa)</option>
                          )}
                        </select>
                        <select className="pk-input" value={supportDuration} onChange={(e) => setSupportDuration(Number(e.target.value))}>
                          <option value={15}>Duración: 15 minutos</option>
                          <option value={30}>Duración: 30 minutos</option>
                          <option value={60}>Duración: 60 minutos</option>
                        </select>
                        <input
                          className="pk-input"
                          value={supportReason}
                          onChange={(e) => setSupportReason(e.target.value)}
                          placeholder={requireDataReason ? 'Motivo o # ticket (obligatorio)...' : 'Motivo o # ticket (recomendado)...'}
                        />
                        <button
                          type="button"
                          className="pk-btn pk-btn-primary"
                          onClick={() => void onStartSupport(selected.tenantId, supportMode, supportReason, supportDuration)}
                        >
                          Abrir Estación del Cliente
                        </button>
                      </>
                    )}
                  </div>

                  <div style={{ padding: 14, borderRadius: 10, border: '1px solid #cbd5e1', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Exportación de Datos del Cliente (ZIP CSV Excel)</div>
                    {!hasPlatformPermission('datos_negocio.exportar_csv') ? (
                      <div style={{ fontSize: 12.5, color: '#991b1b' }}>Tu rol no tiene habilitado el permiso <code>datos_negocio.exportar_csv</code>.</div>
                    ) : (
                      <>
                        <input
                          className="pk-input"
                          value={exportReason}
                          onChange={(e) => setExportReason(e.target.value)}
                          placeholder={requireDataReason ? 'Motivo o solicitud del cliente (obligatorio)...' : 'Motivo de exportación...'}
                        />
                        <button type="button" className="pk-btn pk-btn-emerald" disabled={exporting} onClick={() => void handleGenerateExport()}>
                          {exporting ? 'Generando paquete ZIP...' : 'Generar ZIP CSV Compatible con Excel'}
                        </button>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                          {exportJobs.map((j) => (
                            <div key={j.jobId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 8px', background: '#fff', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                              <div>
                                <strong>{j.jobId}</strong> · {(j.fileSizeBytes / 1024).toFixed(1)} KB
                                <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{j.createdAt.slice(0, 19).replace('T', ' ')}</div>
                              </div>
                              <a className="pk-btn pk-btn-outline pk-btn-sm" href={`/api/v1/admin/exports/${encodeURIComponent(j.jobId)}/download`} download>
                                Descargar ZIP
                              </a>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
