import React, { useEffect, useState, useCallback } from 'react';
import {
  PkConfirmModal,
  PkKpiRow,
  PkModal,
  RoleTemplateSpec,
  TenantUserRecord,
  useAsyncAction,
  usePlatform,
} from '@platform/ui-sdk';
import { PkIcon } from '../components/ServiceIcons';
import { generateSecurePassword } from '../utils/password';

export const CompanyUsersPanel: React.FC = () => {
  const {
    catalog,
    companyTenant,
    tenant,
    isDemo,
    role,
    roleTemplates: ctxTemplates,
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

  const activeCompany = companyTenant || tenant;
  const companyServices = catalog.filter((svc) => activeCompany?.activeServices.includes(svc.serviceKey));
  const demoReadOnly = isDemo && role !== 'superadmin';

  const [users, setUsers] = useState<TenantUserRecord[]>([]);
  const [maxUsers, setMaxUsers] = useState<number>(15);
  const [templates, setTemplates] = useState<RoleTemplateSpec[]>(ctxTemplates || []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUserRecord | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<TenantUserRecord | null>(null);
  const [showPass, setShowPass] = useState(false);

  const [fullName, setFullName] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [selectedRole, setSelectedRole] = useState('cajero');
  const [isAdminCheck, setIsAdminCheck] = useState(false);
  const [allowedServices, setAllowedServices] = useState<string[]>([]);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);

  const loadUsers = useCallback(async () => {
    const res = await apiGet<{
      users: TenantUserRecord[];
      maxUsersAllowed: number;
      roleTemplates: RoleTemplateSpec[];
    }>('/api/v1/core/company/users');
    setUsers(res.users || []);
    setMaxUsers(res.maxUsersAllowed || 15);
    if (Array.isArray(res.roleTemplates) && res.roleTemplates.length > 0) {
      setTemplates(res.roleTemplates);
    }
  }, [apiGet]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const computeTemplatePermissions = (roleKey: string, availableTpls: RoleTemplateSpec[]) => {
    setSelectedRole(roleKey);
    const tpl = availableTpls.find((t) => t.roleKey === roleKey);
    if (!activeCompany) return;

    if (tpl?.isCompanyAdmin || roleKey === 'admin_empresa') {
      setIsAdminCheck(true);
      setAllowedServices([...activeCompany.activeServices]);
      setAllowedModules([...activeCompany.activeModules]);
      return;
    }

    setIsAdminCheck(false);
    const nonPrintCompanySvcs = activeCompany.activeServices.filter((sk) => sk !== 'ms-impresiones');
    const recSvcs = (tpl?.recommendedServices || []).filter(
      (sk) => sk !== 'ms-impresiones' && activeCompany.activeServices.includes(sk)
    );
    const chosenSvcs = recSvcs.length > 0 ? recSvcs : nonPrintCompanySvcs.slice(0, 1);
    setAllowedServices(chosenSvcs);

    const mods: string[] = [];
    const recModList = tpl?.recommendedModules || [];
    for (const svc of companyServices) {
      if (!chosenSvcs.includes(svc.serviceKey)) continue;
      for (const m of svc.modules) {
        if (!activeCompany.activeModules.includes(m.moduleKey)) continue;
        if (recModList.length === 0 || recModList.includes(m.moduleKey)) {
          mods.push(m.moduleKey);
        }
      }
      const hasAny = svc.modules.some((m) => mods.includes(m.moduleKey));
      if (!hasAny) {
        for (const m of svc.modules) {
          if (activeCompany.activeModules.includes(m.moduleKey)) mods.push(m.moduleKey);
        }
      }
    }
    setAllowedModules(Array.from(new Set(mods)));
  };

  const activeUsersCount = users.filter((u) => u.status !== 'SUSPENDED').length;
  const quotaReached = activeUsersCount >= maxUsers;

  const openCreateModal = () => {
    setEditingUser(null);
    setFullName('');
    setUsernameInput('');
    setPasswordInput(generateSecurePassword());
    setShowPass(false);
    computeTemplatePermissions('cajero', templates.length > 0 ? templates : ctxTemplates);
    setModalOpen(true);
  };

  const openEditModal = (u: TenantUserRecord) => {
    setEditingUser(u);
    setFullName(u.fullName);
    setUsernameInput(u.username);
    setPasswordInput('');
    setShowPass(false);
    setSelectedRole(u.internalRole);
    setIsAdminCheck(u.isCompanyAdmin);
    if (u.isCompanyAdmin || u.allowedServices.includes('*')) {
      setAllowedServices([...(activeCompany?.activeServices || [])]);
      setAllowedModules([...(activeCompany?.activeModules || [])]);
    } else {
      setAllowedServices(u.allowedServices.filter((sk) => sk !== 'ms-impresiones'));
      if (u.allowedModules.includes('*') || u.allowedModules.length === 0) {
        const svcMods: string[] = [];
        for (const svc of companyServices) {
          if (u.allowedServices.includes(svc.serviceKey)) {
            for (const m of svc.modules) {
              if (activeCompany?.activeModules.includes(m.moduleKey)) svcMods.push(m.moduleKey);
            }
          }
        }
        setAllowedModules(svcMods);
      } else {
        setAllowedModules([...u.allowedModules]);
      }
    }
    setModalOpen(true);
  };

  const toggleServiceForUser = (serviceKey: string, checked: boolean) => {
    const svc = companyServices.find((s) => s.serviceKey === serviceKey);
    const svcModKeys = (svc?.modules || [])
      .map((m) => m.moduleKey)
      .filter((mk) => activeCompany?.activeModules.includes(mk));

    if (checked) {
      setAllowedServices((prev) => Array.from(new Set([...prev, serviceKey])));
      setAllowedModules((prev) => Array.from(new Set([...prev, ...svcModKeys])));
    } else {
      setAllowedServices((prev) => prev.filter((k) => k !== serviceKey));
      setAllowedModules((prev) => prev.filter((mk) => !svcModKeys.includes(mk)));
    }
  };

  const toggleModuleForUser = (serviceKey: string, moduleKey: string, checked: boolean) => {
    if (checked) {
      setAllowedServices((prev) => Array.from(new Set([...prev, serviceKey])));
      setAllowedModules((prev) => Array.from(new Set([...prev, moduleKey])));
    } else {
      const nextMods = allowedModules.filter((k) => k !== moduleKey);
      setAllowedModules(nextMods);
      const svc = companyServices.find((s) => s.serviceKey === serviceKey);
      const stillHasAny = (svc?.modules || []).some((m) => nextMods.includes(m.moduleKey));
      if (!stillHasAny) {
        setAllowedServices((prev) => prev.filter((k) => k !== serviceKey));
      }
    }
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (editingUser) {
        await apiPut(`/api/v1/core/company/users/${encodeURIComponent(editingUser.userId)}`, {
          fullName,
          email: editingUser.email || usernameInput,
          password: passwordInput,
          internalRole: selectedRole,
          isCompanyAdmin: isAdminCheck,
          allowedServices: isAdminCheck ? ['*'] : allowedServices,
          allowedModules: isAdminCheck ? ['*'] : allowedModules,
        });
        toast(`Permisos de ${fullName} actualizados correctamente`);
      } else {
        const res = await apiPost<{ ok: boolean; user?: TenantUserRecord }>('/api/v1/core/company/users', {
          fullName,
          username: usernameInput,
          email: usernameInput,
          password: passwordInput,
          internalRole: selectedRole,
          isCompanyAdmin: isAdminCheck,
          allowedServices: isAdminCheck ? ['*'] : allowedServices,
          allowedModules: isAdminCheck ? ['*'] : allowedModules,
        });
        toast(`Usuario ${res?.user?.username || usernameInput} creado con sus servicios asignados`);
      }
      setModalOpen(false);
      await loadUsers();
    });
  };

  const handleToggleUserStatus = (u: TenantUserRecord) => {
    const nextStatus = u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    void run(async () => {
      await apiPut(`/api/v1/core/company/users/${encodeURIComponent(u.userId)}`, {
        fullName: u.fullName,
        email: u.email,
        internalRole: u.internalRole,
        status: nextStatus,
      });
      toast(nextStatus === 'SUSPENDED' ? `Usuario ${u.username} suspendido` : `Usuario ${u.username} reactivado`);
      await loadUsers();
    });
  };

  const confirmDeleteUser = () => {
    if (!pendingDeleteUser) return;
    const target = pendingDeleteUser;
    void run(async () => {
      await apiDelete(`/api/v1/core/company/users/${encodeURIComponent(target.userId)}`);
      setPendingDeleteUser(null);
      toast(`Usuario ${target.username} eliminado`);
      await loadUsers();
    });
  };

  const roleName = (rk: string) =>
    templates.find((t) => t.roleKey === rk)?.displayName || rk;

  const serviceName = (sk: string) =>
    catalog.find((s) => s.serviceKey === sk)?.displayName || sk;

  return (
    <div>
      <div className="pk-ws-header">
        <div className="pk-ws-title-row" style={{ paddingBottom: 12 }}>
          <div>
            <h1 className="pk-ws-title">
              <PkIcon name="users" size={22} />
              <span>Usuarios, Roles y Servicios por Empleado</span>
            </h1>
            <div style={{ fontSize: 12.5, color: 'var(--pk-muted)', marginTop: 4 }}>
              Crea las cuentas de tus cajeros, meseros, bodegueros, técnicos o contadores y elige exactamente qué áreas y secciones puede operar cada uno.
            </div>
          </div>
          <button
            type="button"
            className="pk-btn pk-btn-primary"
            disabled={demoReadOnly || quotaReached}
            title={
              demoReadOnly
                ? 'Registra tu propia empresa para crear empleados reales'
                : quotaReached
                ? 'Has alcanzado el cupo máximo de usuarios activos de tu plan'
                : undefined
            }
            onClick={openCreateModal}
          >
            + Crear Nuevo Usuario
          </button>
        </div>
      </div>

      <div className="pk-stage">
        {demoReadOnly && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 12.5,
              color: '#1e3a8a',
            }}
          >
            <strong>Modo Demostración:</strong> Para probar cómo se comporta cada puesto de trabajo usa el selector de roles en la barra superior. Al registrar tu empresa podrás crear y personalizar los usuarios reales de tu equipo aquí.
          </div>
        )}

        <PkKpiRow
          items={[
            { label: 'Usuarios Activos / Cupo', value: `${activeUsersCount} / ${maxUsers}` },
            {
              label: 'Total Registrados',
              value: String(users.length),
              color: 'var(--pk-emerald)',
            },
            {
              label: 'Administradores de Empresa',
              value: String(users.filter((u) => u.isCompanyAdmin).length),
            },
            {
              label: 'Áreas Contratadas por la Empresa',
              value: String(companyServices.length),
            },
          ]}
        />

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">Directorio de Usuarios Internos de {activeCompany?.companyName}</div>
          </div>
          <div className="pk-card-body" style={{ padding: 0 }}>
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Trabajador</th>
                    <th>Usuario de Acceso</th>
                    <th>Cargo / Rol Base</th>
                    <th>Servicios Asignados</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isRoot =
                      u.username.toLowerCase() === activeCompany?.adminUsername?.toLowerCase() ||
                      u.userId === `usr_${activeCompany?.tenantId}`;
                    const allAccess = u.isCompanyAdmin || u.allowedServices.includes('*');
                    return (
                      <tr key={u.userId}>
                        <td style={{ fontWeight: 700 }}>{u.fullName}</td>
                        <td>{u.username}</td>
                        <td>
                          <span className={`pk-badge ${u.isCompanyAdmin ? 'pk-badge-blue' : 'pk-badge-slate'}`}>
                            {roleName(u.internalRole)}
                          </span>
                        </td>
                        <td>
                          {allAccess ? (
                            <span className="pk-badge pk-badge-emerald">
                              Acceso Total a la Suscripción ({companyServices.length} áreas)
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                              {u.allowedServices.map((sk) => (
                                <span key={sk} className="pk-badge pk-badge-blue">
                                  {serviceName(sk)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`pk-badge ${
                              u.status === 'SUSPENDED' ? 'pk-badge-rose' : 'pk-badge-emerald'
                            }`}
                          >
                            {u.status === 'SUSPENDED' ? 'Suspendido' : 'Activo'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="pk-row-actions" style={{ justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="pk-btn pk-btn-outline pk-btn-sm"
                              disabled={demoReadOnly}
                              onClick={() => openEditModal(u)}
                            >
                              Permisos / Clave
                            </button>
                            {!isRoot && (
                              <>
                                <button
                                  type="button"
                                  className="pk-btn pk-btn-outline pk-btn-sm"
                                  disabled={busy || demoReadOnly}
                                  onClick={() => handleToggleUserStatus(u)}
                                >
                                  {u.status === 'SUSPENDED' ? 'Reactivar' : 'Suspender'}
                                </button>
                                <button
                                  type="button"
                                  className="pk-btn pk-btn-danger pk-btn-sm"
                                  disabled={busy || demoReadOnly}
                                  onClick={() => setPendingDeleteUser(u)}
                                >
                                  Eliminar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <PkModal
        open={modalOpen}
        title={
          editingUser
            ? `Configurar Servicios y Acceso — ${editingUser.fullName}`
            : 'Crear Nuevo Usuario y Asignar Servicios'
        }
        onClose={() => setModalOpen(false)}
        maxWidth={860}
      >
        <form onSubmit={handleSaveUser} className="pk-stack">
          <div className="pk-grid-2">
            <div className="pk-field">
              <label htmlFor="usr-fullname">Nombre Completo del Trabajador *</label>
              <input
                id="usr-fullname"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Laura Gómez — Cajera Principal"
              />
            </div>

            <div className="pk-field">
              <label htmlFor="usr-username">Correo o Usuario para Iniciar Sesión *</label>
              <input
                id="usr-username"
                required
                disabled={Boolean(editingUser)}
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Ej. caja1@miempresa.co"
              />
              {!editingUser && usernameInput.trim() !== '' && !usernameInput.includes('@') && (
                <div style={{ fontSize: 11.5, color: 'var(--pk-primary)', fontWeight: 600, marginTop: 3 }}>
                  Iniciará sesión como:{' '}
                  <strong>
                    {usernameInput.trim().toLowerCase()}@
                    {((activeCompany?.companyName || '')
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, '')
                      .slice(0, 28) || 'empresa') + '.co'}
                  </strong>
                </div>
              )}
            </div>

            <div className="pk-field">
              <label htmlFor="usr-role">Plantilla de Cargo / Rol Operativo *</label>
              <select
                id="usr-role"
                value={selectedRole}
                onChange={(e) => computeTemplatePermissions(e.target.value, templates)}
              >
                {templates.map((tpl) => (
                  <option key={tpl.roleKey} value={tpl.roleKey}>
                    {tpl.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="pk-field">
              <label htmlFor="usr-pass">
                <span>{editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña de Acceso *'}</span>
                <span style={{ display: 'inline-flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#64748b',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showPass ? 'Ocultar' : 'Mostrar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordInput(generateSecurePassword());
                      setShowPass(true);
                    }}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--pk-primary)',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Generar clave
                  </button>
                </span>
              </label>
              <input
                id="usr-pass"
                type={showPass ? 'text' : 'password'}
                minLength={editingUser ? undefined : 8}
                required={!editingUser}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder={editingUser ? 'Dejar vacío para conservar actual' : 'Mínimo 8 caracteres'}
              />
            </div>
          </div>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid var(--pk-border)',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--pk-navy)' }}>
                Permisos de Administrador de Empresa
              </div>
              <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>
                Si se activa, el usuario tendrá acceso a todas las áreas contratadas y podrá gestionar empleados.
              </div>
            </div>
            <input
              type="checkbox"
              checked={isAdminCheck}
              onChange={(e) => {
                const next = e.target.checked;
                setIsAdminCheck(next);
                if (next && activeCompany) {
                  setSelectedRole('admin_empresa');
                  setAllowedServices([...activeCompany.activeServices]);
                  setAllowedModules([...activeCompany.activeModules]);
                } else if (!next && selectedRole === 'admin_empresa') {
                  computeTemplatePermissions('cajero', templates);
                }
              }}
              style={{ width: 18, height: 18 }}
            />
          </div>

          {!isAdminCheck && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--pk-navy)', marginBottom: 8 }}>
                Selecciona exactamente qué Servicios y Secciones puede ver y operar este usuario:
              </div>
              <div className="pk-grid-2" style={{ maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
                {companyServices
                  .filter((s) => s.serviceKey !== 'ms-impresiones')
                  .map((svc) => {
                    const svcChecked = allowedServices.includes(svc.serviceKey);
                    const availableMods = svc.modules.filter((m) =>
                      activeCompany?.activeModules.includes(m.moduleKey)
                    );
                    return (
                      <div
                        key={svc.serviceKey}
                        style={{
                          border: svcChecked ? '1.5px solid var(--pk-primary)' : '1px solid var(--pk-border)',
                          background: svcChecked ? '#f8fbff' : '#ffffff',
                          borderRadius: 10,
                          padding: 12,
                        }}
                      >
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            fontWeight: 800,
                            fontSize: 13,
                            color: 'var(--pk-navy)',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={svcChecked}
                            onChange={(e) => toggleServiceForUser(svc.serviceKey, e.target.checked)}
                          />
                          <span>{svc.displayName}</span>
                        </label>
                        {availableMods.length > 0 && (
                          <div style={{ marginTop: 8, paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {availableMods.map((mod) => (
                              <label
                                key={mod.moduleKey}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 7,
                                  fontSize: 12,
                                  color: '#334155',
                                  cursor: 'pointer',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={svcChecked && allowedModules.includes(mod.moduleKey)}
                                  onChange={(e) =>
                                    toggleModuleForUser(svc.serviceKey, mod.moduleKey, e.target.checked)
                                  }
                                />
                                <span style={{ textTransform: 'none' }}>{mod.displayName}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="pk-row-actions" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" className="pk-btn pk-btn-outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-emerald" disabled={busy}>
              {busy ? 'Guardando...' : editingUser ? 'Guardar Permisos del Usuario' : 'Crear Usuario con Estos Servicios'}
            </button>
          </div>
        </form>
      </PkModal>

      <PkConfirmModal
        open={Boolean(pendingDeleteUser)}
        title="Confirmar Eliminación de Usuario"
        message={
          pendingDeleteUser
            ? `¿Estás seguro de eliminar permanentemente la cuenta de acceso de "${pendingDeleteUser.fullName}" (${pendingDeleteUser.username})? Su sesión activa será revocada de inmediato.`
            : ''
        }
        confirmLabel="Eliminar Usuario"
        busy={busy}
        onCancel={() => setPendingDeleteUser(null)}
        onConfirm={confirmDeleteUser}
      />
    </div>
  );
};
