import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PkConfirmModal, PkModal, PkSimpleSelect, TenantSummary, useAsyncAction, usePlatform } from '@platform/ui-sdk';
import { generateSecurePassword } from '../../utils/password';
import { AdminSwitch } from './AdminSwitch';

interface PermissionSpec {
  key: string;
  category: string;
  label: string;
  description: string;
  sensitive?: boolean;
}

interface PlatformRole {
  roleKey: string;
  displayName: string;
  description: string;
  isSystem: boolean;
  requireMfa: boolean;
  requireDataReason: boolean;
  permissions: string[];
}

interface PlatformUser {
  userId: string;
  email: string;
  fullName: string;
  roleKey: string;
  status: string;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  allowedTenants: string[];
  sessionVersion: number;
  lastLoginAt: string;
}

export const AdminStaffAndRolesTab: React.FC<{
  mode: 'roles' | 'staff';
}> = ({ mode }) => {
  const { apiGet, apiPost, apiPut, apiDelete, tenantsList, hasPlatformPermission, toast } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [permissions, setPermissions] = useState<PermissionSpec[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>(tenantsList || []);

  // Roles editor state
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>('soporte_n1');
  const [draftRole, setDraftRole] = useState<PlatformRole | null>(null);
  const [permSearch, setPermSearch] = useState('');
  const [showNewRoleModal, setShowNewRoleModal] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({ roleKey: '', displayName: '', description: '' });
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<PlatformRole | null>(null);

  // Staff modal state
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<PlatformUser | null>(null);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffFullName, setStaffFullName] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRoleKey, setStaffRoleKey] = useState('soporte_n1');
  const [staffMfaRequired, setStaffMfaRequired] = useState(false);
  const [staffAllTenants, setStaffAllTenants] = useState(true);
  const [staffAllowedTenants, setStaffAllowedTenants] = useState<string[]>([]);
  const [totpReveal, setTotpReveal] = useState<{ email: string; secret: string; otpauthUri: string } | null>(null);

  const canManageRoles = hasPlatformPermission('plataforma.roles_gestionar');
  const canManageUsers = hasPlatformPermission('plataforma.usuarios_gestionar');

  const load = useCallback(async () => {
    const [pResp, rResp, uResp, tResp] = await Promise.all([
      apiGet<{ permissions: PermissionSpec[] }>('/api/v1/admin/staff/permissions'),
      apiGet<{ roles: PlatformRole[] }>('/api/v1/admin/staff/roles'),
      apiGet<{ users: PlatformUser[] }>('/api/v1/admin/staff/users'),
      hasPlatformPermission('empresas.ver')
        ? apiGet<{ tenants: TenantSummary[] }>('/api/v1/admin/tenants').catch(() => ({ tenants: tenantsList || [] }))
        : Promise.resolve({ tenants: tenantsList || [] }),
    ]);
    setPermissions(pResp.permissions || []);
    const nextRoles = rResp.roles || [];
    setRoles(nextRoles);
    setUsers(uResp.users || []);
    setTenants(tResp.tenants || []);
    const found = nextRoles.find((r) => r.roleKey === selectedRoleKey) || nextRoles[0] || null;
    if (found) {
      setSelectedRoleKey(found.roleKey);
      setDraftRole({ ...found, permissions: [...found.permissions] });
    }
  }, [apiGet, hasPlatformPermission, selectedRoleKey, tenantsList]);

  useEffect(() => {
    void load();
  }, [load]);

  const groupedPermissions = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    const groups: Record<string, PermissionSpec[]> = {};
    for (const p of permissions) {
      if (
        q &&
        !p.label.toLowerCase().includes(q) &&
        !p.description.toLowerCase().includes(q) &&
        !p.key.toLowerCase().includes(q)
      ) {
        continue;
      }
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    return groups;
  }, [permissions, permSearch]);

  const togglePerm = (permKey: string) => {
    if (!draftRole || draftRole.roleKey === 'superadmin' || !canManageRoles) return;
    const has = draftRole.permissions.includes(permKey);
    const next = has ? draftRole.permissions.filter((p) => p !== permKey) : [...draftRole.permissions, permKey];
    setDraftRole({ ...draftRole, permissions: next });
  };

  const toggleCategoryAll = (list: PermissionSpec[], enable: boolean) => {
    if (!draftRole || draftRole.roleKey === 'superadmin' || !canManageRoles) return;
    const catKeys = new Set(list.map((s) => s.key));
    if (enable) {
      setDraftRole({
        ...draftRole,
        permissions: Array.from(new Set([...draftRole.permissions, ...list.map((s) => s.key)])),
      });
    } else {
      setDraftRole({
        ...draftRole,
        permissions: draftRole.permissions.filter((k) => !catKeys.has(k)),
      });
    }
  };

  const openCreateStaffModal = () => {
    setEditingStaff(null);
    setStaffEmail('');
    setStaffFullName('');
    setStaffPassword(generateSecurePassword());
    setStaffRoleKey(roles.find((r) => r.roleKey === 'soporte_n1')?.roleKey || roles[0]?.roleKey || 'soporte_n1');
    setStaffMfaRequired(false);
    setStaffAllTenants(true);
    setStaffAllowedTenants([]);
    setStaffModalOpen(true);
  };

  const openEditStaffModal = (u: PlatformUser) => {
    setEditingStaff(u);
    setStaffEmail(u.email);
    setStaffFullName(u.fullName);
    setStaffPassword('');
    setStaffRoleKey(u.roleKey);
    setStaffMfaRequired(u.mfaRequired);
    const isAll = !u.allowedTenants || u.allowedTenants.length === 0 || u.allowedTenants.includes('*');
    setStaffAllTenants(isAll);
    setStaffAllowedTenants(isAll ? [] : [...u.allowedTenants]);
    setStaffModalOpen(true);
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const allowed = staffAllTenants ? ['*'] : staffAllowedTenants;
      if (editingStaff) {
        await apiPut(`/api/v1/admin/staff/users/${encodeURIComponent(editingStaff.userId)}`, {
          fullName: staffFullName.trim(),
          password: staffPassword.trim(),
          roleKey: staffRoleKey,
          mfaRequired: staffMfaRequired,
          allowedTenants: allowed,
          status: editingStaff.status,
        });
        toast(`Operador ${staffFullName} actualizado`);
      } else {
        await apiPost('/api/v1/admin/staff/users', {
          email: staffEmail.trim(),
          fullName: staffFullName.trim(),
          password: staffPassword,
          roleKey: staffRoleKey,
          mfaRequired: staffMfaRequired,
          allowedTenants: allowed,
        });
        toast(`Operador ${staffEmail} creado`);
      }
      setStaffModalOpen(false);
      await load();
    });
  };

  if (mode === 'roles') {
    return (
      <div className="pk-split-layout">
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">Roles Internos ({roles.length})</div>
            {canManageRoles && (
              <button type="button" className="pk-btn pk-btn-primary pk-btn-sm" onClick={() => setShowNewRoleModal(true)}>
                + Crear Rol
              </button>
            )}
          </div>
          <div className="pk-card-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {roles.map((r) => (
              <button
                key={r.roleKey}
                type="button"
                className={`pk-entity-item ${selectedRoleKey === r.roleKey ? 'active' : ''}`}
                onClick={() => {
                  setSelectedRoleKey(r.roleKey);
                  setDraftRole({ ...r, permissions: [...r.permissions] });
                }}
              >
                <div className="pk-row-between">
                  <strong style={{ fontSize: 13.5, color: 'var(--pk-navy)' }}>{r.displayName}</strong>
                  <span className={`pk-badge ${r.permissions.includes('*') ? 'pk-badge-amber' : 'pk-badge-blue'}`}>
                    {r.permissions.includes('*') ? 'TOTAL (*)' : `${r.permissions.length} switches`}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', marginTop: 3 }}>
                  <code>{r.roleKey}</code> {r.isSystem ? '· Base del sistema' : '· Personalizado'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {draftRole && (
          <div className="pk-card">
            <div className="pk-card-head">
              <div>
                <div className="pk-card-title" style={{ fontSize: 16 }}>
                  {draftRole.displayName} <code style={{ fontSize: 12, fontWeight: 500 }}>({draftRole.roleKey})</code>
                </div>
                <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>{draftRole.description}</div>
              </div>
              {canManageRoles && (
                <div className="pk-row-actions">
                  {!draftRole.isSystem && (
                    <button type="button" className="pk-btn pk-btn-danger pk-btn-sm" onClick={() => setDeleteRoleTarget(draftRole)}>
                      Eliminar Rol
                    </button>
                  )}
                  <button
                    type="button"
                    className="pk-btn pk-btn-primary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await apiPut(`/api/v1/admin/staff/roles/${encodeURIComponent(draftRole.roleKey)}`, {
                          displayName: draftRole.displayName,
                          description: draftRole.description,
                          requireMfa: draftRole.requireMfa,
                          requireDataReason: draftRole.requireDataReason,
                          permissions: draftRole.permissions,
                        });
                        toast(`Switches del rol "${draftRole.displayName}" actualizados`);
                        await load();
                      })
                    }
                  >
                    {busy ? 'Guardando...' : 'Guardar Cambios del Rol'}
                  </button>
                </div>
              )}
            </div>

            <div className="pk-card-body pk-stack">
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderRadius: 10,
                  border: '1px solid var(--pk-border)',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22 }}>
                  <AdminSwitch
                    checked={draftRole.requireMfa}
                    disabled={!canManageRoles}
                    tone="amber"
                    onChange={(next) => setDraftRole({ ...draftRole, requireMfa: next })}
                    label="Exigir 2FA (TOTP) obligatorio al iniciar sesión"
                  />
                  <AdminSwitch
                    checked={draftRole.requireDataReason}
                    disabled={!canManageRoles}
                    onChange={(next) => setDraftRole({ ...draftRole, requireDataReason: next })}
                    label="Exigir motivo/ticket obligatorio para ver o exportar datos de clientes"
                  />
                </div>
                <div className="pk-field" style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <input
                    placeholder="Filtrar permisos..."
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                  />
                </div>
              </div>

              {Object.entries(groupedPermissions).map(([category, list]) => {
                const locked = draftRole.roleKey === 'superadmin' || !canManageRoles;
                const allActive = list.every((s) => draftRole.permissions.includes('*') || draftRole.permissions.includes(s.key));
                return (
                  <div key={category} className="pk-card" style={{ boxShadow: 'none' }}>
                    <div className="pk-card-head" style={{ padding: '10px 14px' }}>
                      <div className="pk-card-title" style={{ fontSize: 13.5 }}>{category}</div>
                      {!locked && (
                        <button
                          type="button"
                          className="pk-btn pk-btn-outline pk-btn-sm"
                          onClick={() => toggleCategoryAll(list, !allActive)}
                        >
                          {allActive ? 'Desactivar Categoría' : 'Activar Toda la Categoría'}
                        </button>
                      )}
                    </div>
                    <div className="pk-card-body" style={{ padding: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 10 }}>
                        {list.map((spec) => {
                          const checked = draftRole.permissions.includes('*') || draftRole.permissions.includes(spec.key);
                          return (
                            <div
                              key={spec.key}
                              style={{
                                padding: '11px 13px',
                                borderRadius: 9,
                                border: checked ? '1px solid #93c5fd' : '1px solid var(--pk-border)',
                                background: checked ? '#f8fbff' : '#ffffff',
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 10,
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--pk-navy)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span>{spec.label}</span>
                                  {spec.sensitive && <span className="pk-badge pk-badge-amber">Sensible</span>}
                                </div>
                                <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', marginTop: 3, lineHeight: 1.4 }}>
                                  {spec.description}
                                </div>
                                <code style={{ fontSize: 10.5, color: '#64748b' }}>{spec.key}</code>
                              </div>
                              <AdminSwitch
                                checked={checked}
                                disabled={locked}
                                tone="emerald"
                                onChange={() => togglePerm(spec.key)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <PkModal open={showNewRoleModal} title="Crear Nuevo Rol Personalizado de Plataforma" onClose={() => setShowNewRoleModal(false)} maxWidth={480}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const resp = await apiPost<{ role: PlatformRole }>('/api/v1/admin/staff/roles', {
                  ...newRoleForm,
                  requireMfa: false,
                  requireDataReason: true,
                  permissions: ['empresas.ver'],
                });
                setShowNewRoleModal(false);
                setNewRoleForm({ roleKey: '', displayName: '', description: '' });
                if (resp.role) setSelectedRoleKey(resp.role.roleKey);
                await load();
                toast('Rol personalizado creado. Configura ahora sus switches.');
              });
            }}
            className="pk-stack"
          >
            <div className="pk-field">
              <label>Clave Técnica del Rol</label>
              <input required value={newRoleForm.roleKey} onChange={(e) => setNewRoleForm({ ...newRoleForm, roleKey: e.target.value })} placeholder="ej: lider_implantacion" />
            </div>
            <div className="pk-field">
              <label>Nombre Visible</label>
              <input required value={newRoleForm.displayName} onChange={(e) => setNewRoleForm({ ...newRoleForm, displayName: e.target.value })} placeholder="Ej. Líder de Implantación" />
            </div>
            <div className="pk-field">
              <label>Descripción de Responsabilidades</label>
              <input value={newRoleForm.description} onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })} placeholder="Alcance operativo del rol..." />
            </div>
            <div className="pk-form-actions">
              <button type="button" className="pk-btn pk-btn-outline" onClick={() => setShowNewRoleModal(false)}>Cancelar</button>
              <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>Crear Rol</button>
            </div>
          </form>
        </PkModal>

        <PkConfirmModal
          open={Boolean(deleteRoleTarget)}
          title="Eliminar Rol de Plataforma"
          message={`¿Confirmas eliminar el rol personalizado "${deleteRoleTarget?.displayName || ''}"?`}
          confirmLabel="Eliminar Rol"
          busy={busy}
          onCancel={() => setDeleteRoleTarget(null)}
          onConfirm={() => {
            if (!deleteRoleTarget) return;
            void run(async () => {
              await apiDelete(`/api/v1/admin/staff/roles/${encodeURIComponent(deleteRoleTarget.roleKey)}`);
              setDeleteRoleTarget(null);
              setSelectedRoleKey('superadmin');
              await load();
              toast('Rol eliminado');
            });
          }}
        />
      </div>
    );
  }

  // STAFF DIRECTORY VIEW
  return (
    <div className="pk-stack">
      <div className="pk-card">
        <div className="pk-card-head">
          <div>
            <div className="pk-card-title">Directorio de Personal Interno de Plataforma ({users.length})</div>
            <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
              Cuentas corporativas independientes de las empresas clientes (SuperAdmin, Operaciones, Soporte, Desarrollo, Comercial y Auditoría).
            </div>
          </div>
          {canManageUsers && (
            <button type="button" className="pk-btn pk-btn-primary" onClick={openCreateStaffModal}>
              + Crear Operador Interno
            </button>
          )}
        </div>

        <div className="pk-table-wrap">
          <table className="pk-table">
            <thead>
              <tr>
                <th>Operador</th>
                <th>Rol Asignado</th>
                <th>Seguridad 2FA TOTP</th>
                <th>Alcance de Empresas</th>
                <th>Último Acceso</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const roleTitle = roles.find((r) => r.roleKey === u.roleKey)?.displayName || u.roleKey;
                return (
                  <tr key={u.userId}>
                    <td>
                      <strong>{u.fullName}</strong>
                      <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>{u.email}</div>
                    </td>
                    <td>
                      <span className="pk-badge pk-badge-blue">{roleTitle}</span>
                    </td>
                    <td>
                      <span className={`pk-badge ${u.mfaEnabled ? 'pk-badge-emerald' : u.mfaRequired ? 'pk-badge-amber' : 'pk-badge-slate'}`}>
                        {u.mfaEnabled ? '2FA Activo' : u.mfaRequired ? 'Exigido al entrar' : 'Opcional'}
                      </span>
                    </td>
                    <td>
                      {!u.allowedTenants || u.allowedTenants.includes('*')
                        ? 'Todas las empresas (*)'
                        : `${u.allowedTenants.length} empresa(s) asignadas`}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--pk-muted)' }}>
                      {u.lastLoginAt ? u.lastLoginAt.slice(0, 19).replace('T', ' ') : 'Sin ingresos'}
                    </td>
                    <td>
                      <span className={`pk-badge ${u.status === 'SUSPENDED' ? 'pk-badge-rose' : 'pk-badge-emerald'}`}>
                        {u.status === 'SUSPENDED' ? 'Suspendido' : 'Activo'}
                      </span>
                    </td>
                    <td>
                      {canManageUsers && (
                        <div className="pk-row-actions">
                          <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => openEditStaffModal(u)}>
                            Editar
                          </button>
                          {!u.mfaEnabled ? (
                            <button
                              type="button"
                              className="pk-btn pk-btn-outline pk-btn-sm"
                              onClick={() =>
                                void run(async () => {
                                  const resp = await apiPost<{ totp: { secret: string; otpauthUri: string } }>(
                                    `/api/v1/admin/staff/users/${encodeURIComponent(u.userId)}/totp/setup`,
                                    {}
                                  );
                                  setTotpReveal({ email: u.email, secret: resp.totp.secret, otpauthUri: resp.totp.otpauthUri });
                                  await load();
                                })
                              }
                            >
                              Activar 2FA
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="pk-btn pk-btn-outline pk-btn-sm"
                              onClick={() =>
                                void run(async () => {
                                  await apiDelete(`/api/v1/admin/staff/users/${encodeURIComponent(u.userId)}/totp`);
                                  await load();
                                  toast(`2FA desactivado para ${u.email}`);
                                })
                              }
                            >
                              Quitar 2FA
                            </button>
                          )}
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            onClick={() =>
                              void apiPost(`/api/v1/admin/staff/users/${encodeURIComponent(u.userId)}/revoke-sessions`, {}).then(() =>
                                toast(`Sesiones revocadas para ${u.email}`)
                              )
                            }
                          >
                            Cerrar Sesiones
                          </button>
                          {u.userId !== 'usr_platform_superadmin' && (
                            <button
                              type="button"
                              className={`pk-btn pk-btn-sm ${u.status === 'SUSPENDED' ? 'pk-btn-emerald' : 'pk-btn-danger'}`}
                              onClick={() =>
                                void run(async () => {
                                  const next = u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
                                  await apiPut(`/api/v1/admin/staff/users/${encodeURIComponent(u.userId)}`, { status: next });
                                  await load();
                                  toast(`Estado actualizado a ${next}`);
                                })
                              }
                            >
                              {u.status === 'SUSPENDED' ? 'Reactivar' : 'Suspender'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE / EDIT PLATFORM OPERATOR */}
      <PkModal
        open={staffModalOpen}
        title={editingStaff ? `Editar Operador: ${editingStaff.fullName}` : 'Crear Nuevo Operador Interno de Plataforma'}
        onClose={() => setStaffModalOpen(false)}
        maxWidth={660}
      >
        <form onSubmit={handleSaveStaff} className="pk-stack">
          <div className="pk-form-grid cols-2">
            <div className="pk-field">
              <label>Nombre Completo</label>
              <input required value={staffFullName} onChange={(e) => setStaffFullName(e.target.value)} placeholder="Ej. Camila Rojas" />
            </div>
            <div className="pk-field">
              <label>Correo Corporativo</label>
              <input type="email" required disabled={Boolean(editingStaff)} value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} placeholder="soporte@plataforma.local" />
            </div>
            <div className="pk-field">
              <label>
                <span>{editingStaff ? 'Nueva Contraseña (opcional)' : 'Contraseña Inicial'}</span>
                <button type="button" onClick={() => setStaffPassword(generateSecurePassword())} style={{ border: 'none', background: 'none', color: 'var(--pk-primary)', fontWeight: 800, fontSize: 11, cursor: 'pointer', padding: 0 }}>
                  Generar segura
                </button>
              </label>
              <input type="text" required={!editingStaff} value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} placeholder={editingStaff ? 'Dejar vacío para mantener' : ''} />
            </div>
            <PkSimpleSelect
              label="Rol en Plataforma"
              disabled={editingStaff?.userId === 'usr_platform_superadmin'}
              value={staffRoleKey}
              onChange={(nextRoleKey) => setStaffRoleKey(nextRoleKey)}
              options={roles.map((r) => ({
                value: r.roleKey,
                label: r.displayName,
                sublabel: r.description,
              }))}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 10, background: '#f8fafc', border: '1px solid var(--pk-border)' }}>
            <AdminSwitch
              checked={staffMfaRequired}
              tone="amber"
              onChange={setStaffMfaRequired}
              label="Exigir configuración de 2FA (TOTP) al próximo inicio de sesión"
            />
            <AdminSwitch
              checked={staffAllTenants}
              tone="emerald"
              onChange={setStaffAllTenants}
              label="Alcance Global: Puede atender todas las empresas registradas (*)"
            />
            {!staffAllTenants && (
              <div style={{ maxHeight: 180, overflowY: 'auto', background: '#fff', padding: 10, borderRadius: 8, border: '1px solid var(--pk-border)' }}>
                <div className="pk-label">Selecciona las empresas asignadas a este operador</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                  {tenants.map((t) => (
                    <label key={t.tenantId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                      <input
                        type="checkbox"
                        checked={staffAllowedTenants.includes(t.tenantId)}
                        onChange={(e) =>
                          setStaffAllowedTenants((prev) =>
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
          </div>

          <div className="pk-form-actions">
            <button type="button" className="pk-btn pk-btn-outline" onClick={() => setStaffModalOpen(false)}>Cancelar</button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              {busy ? 'Guardando...' : editingStaff ? 'Guardar Cambios' : 'Crear Operador'}
            </button>
          </div>
        </form>
      </PkModal>

      {/* MODAL: TOTP SECRET REVEAL */}
      <PkModal open={Boolean(totpReveal)} title={`Secreto 2FA Generado: ${totpReveal?.email || ''}`} onClose={() => setTotpReveal(null)} maxWidth={500}>
        <div className="pk-stack">
          <div style={{ fontSize: 13, color: 'var(--pk-text-secondary)' }}>
            Entrega esta clave Base32 de forma segura al operador para registrarla en su aplicación autenticadora:
          </div>
          <div className="pk-cred-box" style={{ wordBreak: 'break-all' }}>{totpReveal?.secret}</div>
          <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', wordBreak: 'break-all' }}>{totpReveal?.otpauthUri}</div>
          <div className="pk-row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="pk-btn pk-btn-primary" onClick={() => setTotpReveal(null)}>Entendido</button>
          </div>
        </div>
      </PkModal>
    </div>
  );
};
