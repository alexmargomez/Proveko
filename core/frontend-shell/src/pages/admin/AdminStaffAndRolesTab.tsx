import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlatform } from '@platform/ui-sdk';

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

export const AdminStaffAndRolesTab: React.FC = () => {
  const { apiGet, apiPost, apiPut, apiDelete, hasPlatformPermission, toast } = usePlatform();
  const [subTab, setSubTab] = useState<'roles' | 'users'>('roles');
  const [permissions, setPermissions] = useState<PermissionSpec[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>('soporte_n1');
  const [draftRole, setDraftRole] = useState<PlatformRole | null>(null);
  const [newRoleForm, setNewRoleForm] = useState({ roleKey: '', displayName: '', description: '' });
  const [newUserForm, setNewUserForm] = useState({ email: '', fullName: '', password: '', roleKey: 'soporte_n1', mfaRequired: false, allowedTenants: '*' });
  const [totpReveal, setTotpReveal] = useState<{ email: string; secret: string; otpauthUri: string } | null>(null);

  const canManageRoles = hasPlatformPermission('plataforma.roles_gestionar');
  const canManageUsers = hasPlatformPermission('plataforma.usuarios_gestionar');

  const load = useCallback(async () => {
    const [pResp, rResp, uResp] = await Promise.all([
      apiGet<{ permissions: PermissionSpec[] }>('/api/v1/admin/staff/permissions'),
      apiGet<{ roles: PlatformRole[] }>('/api/v1/admin/staff/roles'),
      apiGet<{ users: PlatformUser[] }>('/api/v1/admin/staff/users'),
    ]);
    setPermissions(pResp.permissions || []);
    const nextRoles = rResp.roles || [];
    setRoles(nextRoles);
    setUsers(uResp.users || []);
    const found = nextRoles.find((r) => r.roleKey === selectedRoleKey) || nextRoles[0] || null;
    if (found) {
      setSelectedRoleKey(found.roleKey);
      setDraftRole({ ...found, permissions: [...found.permissions] });
    }
  }, [apiGet, selectedRoleKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionSpec[]> = {};
    for (const p of permissions) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    return groups;
  }, [permissions]);

  const selectRole = (r: PlatformRole) => {
    setSelectedRoleKey(r.roleKey);
    setDraftRole({ ...r, permissions: [...r.permissions] });
  };

  const togglePerm = (permKey: string) => {
    if (!draftRole || draftRole.roleKey === 'superadmin' || !canManageRoles) return;
    const has = draftRole.permissions.includes(permKey);
    const next = has ? draftRole.permissions.filter((p) => p !== permKey) : [...draftRole.permissions, permKey];
    setDraftRole({ ...draftRole, permissions: next });
  };

  const saveDraftRole = async () => {
    if (!draftRole) return;
    await apiPut(`/api/v1/admin/staff/roles/${encodeURIComponent(draftRole.roleKey)}`, {
      displayName: draftRole.displayName,
      description: draftRole.description,
      requireMfa: draftRole.requireMfa,
      requireDataReason: draftRole.requireDataReason,
      permissions: draftRole.permissions,
    });
    toast(`Permisos del rol "${draftRole.displayName}" guardados`);
    await load();
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const resp = await apiPost<{ role: PlatformRole }>('/api/v1/admin/staff/roles', {
      roleKey: newRoleForm.roleKey,
      displayName: newRoleForm.displayName,
      description: newRoleForm.description,
      requireMfa: false,
      requireDataReason: true,
      permissions: ['empresas.ver'],
    });
    setNewRoleForm({ roleKey: '', displayName: '', description: '' });
    if (resp.role) {
      setSelectedRoleKey(resp.role.roleKey);
    }
    toast('Rol personalizado creado');
    await load();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPost('/api/v1/admin/staff/users', {
      email: newUserForm.email.trim(),
      fullName: newUserForm.fullName.trim(),
      password: newUserForm.password,
      roleKey: newUserForm.roleKey,
      mfaRequired: newUserForm.mfaRequired,
      allowedTenants: newUserForm.allowedTenants.split(',').map((s) => s.trim()).filter(Boolean),
    });
    setNewUserForm({ email: '', fullName: '', password: '', roleKey: 'soporte_n1', mfaRequired: false, allowedTenants: '*' });
    toast('Operador interno creado');
    await load();
  };

  const handleSetupTOTP = async (u: PlatformUser) => {
    const resp = await apiPost<{ totp: { secret: string; otpauthUri: string } }>(
      `/api/v1/admin/staff/users/${encodeURIComponent(u.userId)}/totp/setup`,
      {}
    );
    setTotpReveal({ email: u.email, secret: resp.totp.secret, otpauthUri: resp.totp.otpauthUri });
    toast(`2FA TOTP activado para ${u.email}`);
    await load();
  };

  const handleDisableTOTP = async (u: PlatformUser) => {
    await apiDelete(`/api/v1/admin/staff/users/${encodeURIComponent(u.userId)}/totp`);
    toast(`2FA TOTP desactivado para ${u.email}`);
    await load();
  };

  const toggleUserStatus = async (u: PlatformUser) => {
    const nextStatus = u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    await apiPut(`/api/v1/admin/staff/users/${encodeURIComponent(u.userId)}`, { status: nextStatus });
    toast(`Operador ${u.email} ahora está ${nextStatus}`);
    await load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="pk-row-actions">
        <button type="button" className={`pk-btn ${subTab === 'roles' ? 'pk-btn-primary' : 'pk-btn-outline'}`} onClick={() => setSubTab('roles')}>
          Matriz de Roles y Switches ({roles.length})
        </button>
        <button type="button" className={`pk-btn ${subTab === 'users' ? 'pk-btn-primary' : 'pk-btn-outline'}`} onClick={() => setSubTab('users')}>
          Personal Interno de Plataforma ({users.length})
        </button>
      </div>

      {subTab === 'roles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="pk-card">
              <div className="pk-card-head"><div className="pk-card-title">Roles de Plataforma</div></div>
              <div className="pk-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10 }}>
                {roles.map((r) => (
                  <button
                    key={r.roleKey}
                    type="button"
                    onClick={() => selectRole(r)}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: selectedRoleKey === r.roleKey ? '1.5px solid #023047' : '1px solid #e2e8f0',
                      background: selectedRoleKey === r.roleKey ? '#f0f9ff' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13.5 }}>{r.displayName}</strong>
                      <span className="pk-badge pk-badge-slate">{r.permissions.includes('*') ? 'TOTAL' : `${r.permissions.length}`}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', marginTop: 2 }}>{r.roleKey}</div>
                  </button>
                ))}
              </div>
            </div>

            {canManageRoles && (
              <div className="pk-card">
                <div className="pk-card-head"><div className="pk-card-title">Crear Rol Personalizado</div></div>
                <div className="pk-card-body">
                  <form onSubmit={(e) => void handleCreateRole(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input className="pk-input" required placeholder="clave_rol (ej: soporte_vip)" value={newRoleForm.roleKey}
                      onChange={(e) => setNewRoleForm({ ...newRoleForm, roleKey: e.target.value })} />
                    <input className="pk-input" required placeholder="Nombre visible (ej: Soporte VIP)" value={newRoleForm.displayName}
                      onChange={(e) => setNewRoleForm({ ...newRoleForm, displayName: e.target.value })} />
                    <input className="pk-input" placeholder="Descripción breve" value={newRoleForm.description}
                      onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })} />
                    <button type="submit" className="pk-btn pk-btn-primary pk-btn-sm">Crear Rol</button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {draftRole && (
            <div className="pk-card">
              <div className="pk-card-head">
                <div>
                  <div className="pk-card-title">{draftRole.displayName} <code>({draftRole.roleKey})</code></div>
                  <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>{draftRole.description}</div>
                </div>
                {canManageRoles && (
                  <div className="pk-row-actions">
                    {!draftRole.isSystem && (
                      <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void apiDelete(`/api/v1/admin/staff/roles/${encodeURIComponent(draftRole.roleKey)}`).then(load)}>
                        Eliminar Rol
                      </button>
                    )}
                    <button type="button" className="pk-btn pk-btn-primary pk-btn-sm" onClick={() => void saveDraftRole()}>
                      Guardar Permisos
                    </button>
                  </div>
                )}
              </div>
              <div className="pk-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
                    <input type="checkbox" disabled={!canManageRoles} checked={draftRole.requireMfa}
                      onChange={(e) => setDraftRole({ ...draftRole, requireMfa: e.target.checked })} />
                    <span>Exigir 2FA (TOTP) obligatorio para este rol</span>
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
                    <input type="checkbox" disabled={!canManageRoles} checked={draftRole.requireDataReason}
                      onChange={(e) => setDraftRole({ ...draftRole, requireDataReason: e.target.checked })} />
                    <span>Exigir motivo/ticket obligatorio al ver o exportar datos de clientes</span>
                  </label>
                </div>

                {Object.entries(groupedPermissions).map(([category, list]) => (
                  <div key={category}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#023047', marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
                      {category}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 8 }}>
                      {list.map((spec) => {
                        const checked = draftRole.permissions.includes('*') || draftRole.permissions.includes(spec.key);
                        const locked = draftRole.roleKey === 'superadmin' || !canManageRoles;
                        return (
                          <label
                            key={spec.key}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: checked ? '1px solid #0284c7' : '1px solid #e2e8f0',
                              background: checked ? '#f0f9ff' : '#ffffff',
                              cursor: locked ? 'default' : 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={locked}
                              onChange={() => togglePerm(spec.key)}
                              style={{ marginTop: 3 }}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>{spec.label}</span>
                                {spec.sensitive && <span className="pk-badge pk-badge-amber" style={{ fontSize: 10 }}>SENSIBLE</span>}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', marginTop: 2 }}>{spec.description}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {totpReveal && (
            <div className="pk-card" style={{ border: '1.5px solid #0284c7', background: '#f0f9ff' }}>
              <div className="pk-card-head">
                <div className="pk-card-title">Clave 2FA TOTP Generada para {totpReveal.email}</div>
                <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => setTotpReveal(null)}>Cerrar</button>
              </div>
              <div className="pk-card-body" style={{ fontSize: 13 }}>
                <div><strong>Secreto Base32:</strong> <code>{totpReveal.secret}</code></div>
                <div style={{ marginTop: 6, wordBreak: 'break-all' }}><strong>URI otpauth:</strong> <code>{totpReveal.otpauthUri}</code></div>
              </div>
            </div>
          )}

          {canManageUsers && (
            <div className="pk-card">
              <div className="pk-card-head"><div className="pk-card-title">Crear Operador Interno de Plataforma</div></div>
              <div className="pk-card-body">
                <form onSubmit={(e) => void handleCreateUser(e)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, alignItems: 'end' }}>
                  <div>
                    <label className="pk-label">Correo corporativo</label>
                    <input type="email" className="pk-input" required value={newUserForm.email}
                      onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })} placeholder="soporte@plataforma.local" />
                  </div>
                  <div>
                    <label className="pk-label">Nombre completo</label>
                    <input className="pk-input" required value={newUserForm.fullName}
                      onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })} placeholder="Laura Gómez" />
                  </div>
                  <div>
                    <label className="pk-label">Contraseña inicial</label>
                    <input type="password" className="pk-input" required minLength={8} value={newUserForm.password}
                      onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
                  </div>
                  <div>
                    <label className="pk-label">Rol de plataforma</label>
                    <select className="pk-input" value={newUserForm.roleKey}
                      onChange={(e) => setNewUserForm({ ...newUserForm, roleKey: e.target.value })}>
                      {roles.map((r) => <option key={r.roleKey} value={r.roleKey}>{r.displayName}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="pk-label">Alcance de Empresas (* = todas)</label>
                    <input className="pk-input" value={newUserForm.allowedTenants}
                      onChange={(e) => setNewUserForm({ ...newUserForm, allowedTenants: e.target.value })} placeholder="*" />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}>
                    <input type="checkbox" checked={newUserForm.mfaRequired}
                      onChange={(e) => setNewUserForm({ ...newUserForm, mfaRequired: e.target.checked })} />
                    <span>Exigir 2FA</span>
                  </label>
                  <button type="submit" className="pk-btn pk-btn-primary">Crear Operador</button>
                </form>
              </div>
            </div>
          )}

          <div className="pk-card">
            <div className="pk-card-head"><div className="pk-card-title">Directorio de Personal Interno</div></div>
            <div className="pk-card-body" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Operador</th>
                    <th>Rol</th>
                    <th>2FA TOTP</th>
                    <th>Alcance</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.userId}>
                      <td><strong>{u.fullName}</strong><div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>{u.email}</div></td>
                      <td><code>{u.roleKey}</code></td>
                      <td>
                        <span className={`pk-badge ${u.mfaEnabled ? 'pk-badge-emerald' : u.mfaRequired ? 'pk-badge-amber' : 'pk-badge-slate'}`}>
                          {u.mfaEnabled ? 'ACTIVO' : u.mfaRequired ? 'PENDIENTE' : 'OPCIONAL'}
                        </span>
                      </td>
                      <td>{(u.allowedTenants || ['*']).join(', ')}</td>
                      <td><span className={`pk-badge ${u.status === 'ACTIVE' ? 'pk-badge-emerald' : 'pk-badge-red'}`}>{u.status}</span></td>
                      <td>
                        {canManageUsers && (
                          <div className="pk-row-actions">
                            {!u.mfaEnabled ? (
                              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void handleSetupTOTP(u)}>Activar 2FA</button>
                            ) : (
                              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void handleDisableTOTP(u)}>Desactivar 2FA</button>
                            )}
                            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void apiPost(`/api/v1/admin/staff/users/${encodeURIComponent(u.userId)}/revoke-sessions`, {}).then(() => toast('Sesiones revocadas'))}>
                              Revocar Sesiones
                            </button>
                            {u.userId !== 'usr_platform_superadmin' && (
                              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void toggleUserStatus(u)}>
                                {u.status === 'SUSPENDED' ? 'Reactivar' : 'Suspender'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
