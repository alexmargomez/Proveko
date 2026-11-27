import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PkConfirmModal,
  PkModal,
  PkSimpleSelect,
  PkViewSwitcher,
  RoleTemplateSpec,
  TenantSummary,
  TenantUserRecord,
  formatCop,
  useAsyncAction,
  usePlatform,
} from '@platform/ui-sdk';
import { PkIcon } from '../../components/ServiceIcons';
import { generateSecurePassword } from '../../utils/password';
import { AdminSwitch } from './AdminSwitch';

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
  focusTenantId?: string;
  createModalRequested?: boolean;
  onConsumeCreateModal?: () => void;
  onStartSupport: (tenantId: string, mode: 'readonly' | 'readwrite', reason: string, durationMinutes: number) => Promise<void>;
}

export const AdminTenants360Tab: React.FC<Props> = ({
  focusTenantId,
  createModalRequested,
  onConsumeCreateModal,
  onStartSupport,
}) => {
  const {
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    catalog,
    roleTemplates,
    hasPlatformPermission,
    requireDataReason,
    refreshBootstrap,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'MAINT'>('ALL');
  const [selectedId, setSelectedId] = useState('');
  const [detailTab, setDetailTab] = useState<'general' | 'licenses' | 'users' | 'support' | 'exports'>('general');

  const [tenantUsers, setTenantUsers] = useState<TenantUserRecord[]>([]);
  const [exportJobs, setExportJobs] = useState<ExportJobSummary[]>([]);
  const [meta, setMeta] = useState<TenantMeta>({ tenantId: '', billingNotes: '', supportTier: 'STANDARD', accountManager: '' });

  // Create Tenant Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    companyName: '',
    nit: '',
    adminFullName: '',
    adminUsername: '',
    password: generateSecurePassword(),
    businessPreset: 'comercio',
  });

  // General & Billing state
  const [paymentStatus, setPaymentStatus] = useState('ACTIVA_VERIFICADA');
  const [quotaMaxUsers, setQuotaMaxUsers] = useState(15);
  const [quotaCustomCop, setQuotaCustomCop] = useState(0);
  const [maintMode, setMaintMode] = useState(false);
  const [maintMsg, setMaintMsg] = useState('');

  // 4-Level Licensing state
  const [draftServices, setDraftServices] = useState<string[]>([]);
  const [draftModules, setDraftModules] = useState<string[]>([]);
  const [draftSubmodules, setDraftSubmodules] = useState<string[]>([]);
  const [draftFeatures, setDraftFeatures] = useState<string[]>([]);

  // Client User Modal state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUserRecord | null>(null);
  const [userFullName, setUserFullName] = useState('');
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('cajero');
  const [userIsAdmin, setUserIsAdmin] = useState(false);
  const [userServices, setUserServices] = useState<string[]>([]);
  const [userModules, setUserModules] = useState<string[]>([]);
  const [resetPassTarget, setResetPassTarget] = useState<TenantUserRecord | null>(null);
  const [resetPassValue, setResetPassValue] = useState('');
  const [deleteUserTarget, setDeleteUserTarget] = useState<TenantUserRecord | null>(null);

  // Support & Export state
  const [supportMode, setSupportMode] = useState<'readonly' | 'readwrite'>('readonly');
  const [supportReason, setSupportReason] = useState('');
  const [supportDuration, setSupportDuration] = useState(30);
  const [exportReason, setExportReason] = useState('');
  const [exportsViewMode, setExportsViewMode] = useState<'list' | 'create'>('list');

  const loadTenants = useCallback(async () => {
    const resp = await apiGet<{ tenants: TenantSummary[] }>('/api/v1/admin/tenants');
    const list = resp.tenants || [];
    setTenants(list);
    setSelectedId((prev) => {
      if (focusTenantId && list.some((t) => t.tenantId === focusTenantId)) return focusTenantId;
      if (prev && list.some((t) => t.tenantId === prev)) return prev;
      return list[0]?.tenantId || '';
    });
  }, [apiGet, focusTenantId]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants]);

  useEffect(() => {
    if (focusTenantId) setSelectedId(focusTenantId);
  }, [focusTenantId]);

  useEffect(() => {
    if (createModalRequested) {
      setCreateForm((prev) => ({ ...prev, password: generateSecurePassword() }));
      setShowCreateModal(true);
      onConsumeCreateModal?.();
    }
  }, [createModalRequested, onConsumeCreateModal]);

  const selected = useMemo(() => tenants.find((t) => t.tenantId === selectedId) || null, [tenants, selectedId]);

  const loadTenantDetails = useCallback(
    async (t: TenantSummary) => {
      setPaymentStatus(t.paymentStatus || 'ACTIVA_VERIFICADA');
      setQuotaMaxUsers(t.maxUsersAllowed || 15);
      setQuotaCustomCop(t.customMonthlyCop || 0);
      setMaintMode(Boolean(t.maintenanceMode));
      setMaintMsg(t.maintenanceMessage || '');
      setDraftServices([...(t.activeServices || [])]);
      setDraftModules([...(t.activeModules || [])]);
      setDraftSubmodules([...(t.activeSubmodules || [])]);
      setDraftFeatures([...(t.activeFeatures || [])]);

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
        setMeta({ tenantId: t.tenantId, billingNotes: '', supportTier: 'STANDARD', accountManager: '' });
      }
      if (hasPlatformPermission('datos_negocio.exportar_csv')) {
        try {
          const eResp = await apiGet<{ jobs: ExportJobSummary[] }>(`/api/v1/admin/tenants/${encodeURIComponent(t.tenantId)}/exports`);
          setExportJobs(eResp.jobs || []);
        } catch {
          setExportJobs([]);
        }
      }
    },
    [apiGet, hasPlatformPermission]
  );

  useEffect(() => {
    if (selected) {
      void loadTenantDetails(selected);
    }
  }, [selected, loadTenantDetails]);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (statusFilter === 'ACTIVE' && t.status === 'SUSPENDED') return false;
      if (statusFilter === 'SUSPENDED' && t.status !== 'SUSPENDED') return false;
      if (statusFilter === 'MAINT' && !t.maintenanceMode) return false;
      if (!q) return true;
      return (
        t.companyName.toLowerCase().includes(q) ||
        t.nit.toLowerCase().includes(q) ||
        t.tenantId.toLowerCase().includes(q) ||
        (t.adminUsername || '').toLowerCase().includes(q)
      );
    });
  }, [tenants, search, statusFilter]);

  // 4-Level Cascading Toggle Helpers
  const toggleService = (serviceKey: string) => {
    const svc = catalog.find((s) => s.serviceKey === serviceKey);
    if (!svc) return;
    const svcModKeys = svc.modules.map((m) => m.moduleKey);
    const svcSubKeys = (svc.submodules || []).map((sm) => sm.submoduleKey);
    const svcFeatKeys = (svc.features || []).map((f) => f.featureKey);

    if (draftServices.includes(serviceKey)) {
      setDraftServices((prev) => prev.filter((k) => k !== serviceKey));
      setDraftModules((prev) => prev.filter((k) => !svcModKeys.includes(k)));
      setDraftSubmodules((prev) => prev.filter((k) => !svcSubKeys.includes(k)));
      setDraftFeatures((prev) => prev.filter((k) => !svcFeatKeys.includes(k)));
    } else {
      setDraftServices((prev) => [...prev, serviceKey]);
      setDraftModules((prev) => Array.from(new Set([...prev, ...svcModKeys])));
      setDraftSubmodules((prev) => Array.from(new Set([...prev, ...svcSubKeys])));
      setDraftFeatures((prev) => Array.from(new Set([...prev, ...svcFeatKeys])));
    }
  };

  const toggleModule = (serviceKey: string, moduleKey: string) => {
    if (!draftServices.includes(serviceKey)) return;
    const svc = catalog.find((s) => s.serviceKey === serviceKey);
    const modSubKeys = (svc?.submodules || []).filter((sm) => sm.dependsOnModule === moduleKey).map((sm) => sm.submoduleKey);
    const dependentFeats = (svc?.features || [])
      .filter((f) => f.dependsOnModule === moduleKey || (f.dependsOnSubmodule && modSubKeys.includes(f.dependsOnSubmodule)))
      .map((f) => f.featureKey);

    if (draftModules.includes(moduleKey)) {
      setDraftModules((prev) => prev.filter((m) => m !== moduleKey));
      setDraftSubmodules((prev) => prev.filter((sm) => !modSubKeys.includes(sm)));
      setDraftFeatures((prev) => prev.filter((f) => !dependentFeats.includes(f)));
    } else {
      setDraftModules((prev) => [...prev, moduleKey]);
      setDraftSubmodules((prev) => Array.from(new Set([...prev, ...modSubKeys])));
      setDraftFeatures((prev) => Array.from(new Set([...prev, ...dependentFeats])));
    }
  };

  const toggleSubmodule = (serviceKey: string, dependsOnModule: string, submoduleKey: string) => {
    if (!draftServices.includes(serviceKey) || (dependsOnModule && !draftModules.includes(dependsOnModule))) return;
    const svc = catalog.find((s) => s.serviceKey === serviceKey);
    const dependentFeats = (svc?.features || []).filter((f) => f.dependsOnSubmodule === submoduleKey).map((f) => f.featureKey);
    if (draftSubmodules.includes(submoduleKey)) {
      setDraftSubmodules((prev) => prev.filter((sm) => sm !== submoduleKey));
      setDraftFeatures((prev) => prev.filter((f) => !dependentFeats.includes(f)));
    } else {
      setDraftSubmodules((prev) => [...prev, submoduleKey]);
      setDraftFeatures((prev) => Array.from(new Set([...prev, ...dependentFeats])));
    }
  };

  const toggleFeature = (serviceKey: string, dependsOnModule: string, dependsOnSubmodule: string | undefined, featureKey: string) => {
    if (!draftServices.includes(serviceKey)) return;
    if (dependsOnModule && !draftModules.includes(dependsOnModule)) return;
    if (dependsOnSubmodule && !draftSubmodules.includes(dependsOnSubmodule)) return;
    setDraftFeatures((prev) => (prev.includes(featureKey) ? prev.filter((f) => f !== featureKey) : [...prev, featureKey]));
  };

  const handleSaveSubscriptions = () => {
    if (!selected) return;
    void run(async () => {
      await apiPut(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/subscriptions`, {
        activeServices: draftServices,
        activeModules: draftModules,
        activeSubmodules: draftSubmodules,
        activeFeatures: draftFeatures,
      });
      await refreshBootstrap();
      await loadTenants();
      toast(`Licenciamiento de 4 niveles guardado para ${selected.companyName}`);
    });
  };

  const handleCreateTenant = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const resp = await apiPost<{ tenant: TenantSummary }>('/api/v1/admin/tenants', createForm);
      setShowCreateModal(false);
      setCreateForm({
        companyName: '',
        nit: '',
        adminFullName: '',
        adminUsername: '',
        password: generateSecurePassword(),
        businessPreset: 'comercio',
      });
      await refreshBootstrap();
      await loadTenants();
      setSelectedId(resp.tenant.tenantId);
      toast(`Empresa "${resp.tenant.companyName}" aprovisionada con base de datos aislada`);
    });
  };

  // Client User Modal helpers
  const applyUserTemplate = (roleKey: string, tpls: RoleTemplateSpec[]) => {
    setUserRole(roleKey);
    if (!selected) return;
    const tpl = tpls.find((t) => t.roleKey === roleKey);
    if (tpl?.isCompanyAdmin || roleKey === 'admin_empresa') {
      setUserIsAdmin(true);
      setUserServices([...selected.activeServices]);
      setUserModules([...selected.activeModules]);
      return;
    }
    setUserIsAdmin(false);
    const recSvcs = (tpl?.recommendedServices || []).filter((sk) => selected.activeServices.includes(sk));
    const chosenSvcs = recSvcs.length > 0 ? recSvcs : selected.activeServices.slice(0, 1);
    setUserServices(chosenSvcs);
    const recMods = tpl?.recommendedModules || [];
    const mods: string[] = [];
    for (const svc of catalog) {
      if (!chosenSvcs.includes(svc.serviceKey)) continue;
      for (const m of svc.modules) {
        if (selected.activeModules.includes(m.moduleKey) && (recMods.length === 0 || recMods.includes(m.moduleKey))) {
          mods.push(m.moduleKey);
        }
      }
    }
    setUserModules(Array.from(new Set(mods)));
  };

  const openCreateClientUser = () => {
    setEditingUser(null);
    setUserFullName('');
    setUserUsername('');
    setUserPassword(generateSecurePassword());
    applyUserTemplate('cajero', roleTemplates);
    setUserModalOpen(true);
  };

  const openEditClientUser = (u: TenantUserRecord) => {
    setEditingUser(u);
    setUserFullName(u.fullName);
    setUserUsername(u.username);
    setUserPassword('');
    setUserRole(u.internalRole);
    setUserIsAdmin(u.isCompanyAdmin);
    setUserServices(u.isCompanyAdmin || u.allowedServices.includes('*') ? [...(selected?.activeServices || [])] : [...u.allowedServices]);
    setUserModules(u.isCompanyAdmin || u.allowedModules.includes('*') ? [...(selected?.activeModules || [])] : [...u.allowedModules]);
    setUserModalOpen(true);
  };

  const handleSaveClientUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    void run(async () => {
      if (editingUser) {
        await apiPut(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/users/${encodeURIComponent(editingUser.userId)}`, {
          fullName: userFullName,
          email: userUsername,
          password: userPassword,
          internalRole: userRole,
          isCompanyAdmin: userIsAdmin,
          allowedServices: userIsAdmin ? ['*'] : userServices,
          allowedModules: userIsAdmin ? ['*'] : userModules,
          status: editingUser.status,
        });
        toast(`Usuario ${userFullName} actualizado`);
      } else {
        await apiPost(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/users`, {
          fullName: userFullName,
          username: userUsername,
          email: userUsername,
          password: userPassword,
          internalRole: userRole,
          isCompanyAdmin: userIsAdmin,
          allowedServices: userIsAdmin ? ['*'] : userServices,
          allowedModules: userIsAdmin ? ['*'] : userModules,
        });
        toast(`Usuario ${userUsername} creado en ${selected.companyName}`);
      }
      setUserModalOpen(false);
      await loadTenantDetails(selected);
    });
  };

  const activeCompanyCatalog = useMemo(
    () => catalog.filter((s) => selected?.activeServices.includes(s.serviceKey) && s.serviceKey !== 'ms-impresiones'),
    [catalog, selected]
  );

  return (
    <div className="pk-split-layout">
      {/* LEFT PANE: TENANT DIRECTORY */}
      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">Empresas ({filteredTenants.length})</div>
          {hasPlatformPermission('empresas.crear') && (
            <button
              type="button"
              className="pk-btn pk-btn-emerald pk-btn-sm"
              onClick={() => {
                setCreateForm((prev) => ({ ...prev, password: generateSecurePassword() }));
                setShowCreateModal(true);
              }}
            >
              + Aprovisionar
            </button>
          )}
        </div>
        <div className="pk-card-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="pk-field">
            <input
              placeholder="Buscar razón social, NIT o correo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(
              [
                ['ALL', 'Todas'],
                ['ACTIVE', 'Activas'],
                ['SUSPENDED', 'Suspendidas'],
                ['MAINT', 'Mantenimiento'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`pk-tab-pill ${statusFilter === key ? 'active' : ''}`}
                style={{ padding: '4px 9px', fontSize: 11 }}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ maxHeight: 'calc(100vh - 285px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {filteredTenants.map((t) => (
              <button
                key={t.tenantId}
                type="button"
                className={`pk-entity-item ${selectedId === t.tenantId ? 'active' : ''}`}
                onClick={() => setSelectedId(t.tenantId)}
              >
                <div className="pk-row-between" style={{ gap: 6 }}>
                  <strong style={{ fontSize: 13, color: 'var(--pk-navy)' }}>{t.companyName}</strong>
                  <span className={`pk-badge ${t.status === 'SUSPENDED' ? 'pk-badge-rose' : 'pk-badge-emerald'}`}>
                    {t.status === 'SUSPENDED' ? 'Suspendida' : 'Activa'}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', marginTop: 4 }}>
                  NIT {t.nit} · {t.activeServices.length} áreas · {t.maxUsersAllowed || 15} cupos
                </div>
                {(t.maintenanceMode || t.isDemo) && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                    {t.isDemo && <span className="pk-badge pk-badge-blue">DEMO</span>}
                    {t.maintenanceMode && <span className="pk-badge pk-badge-amber">MANTENIMIENTO</span>}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANE: 360° WORKSPACE */}
      {selected ? (
        <div className="pk-card">
          <div className="pk-ws-header" style={{ paddingTop: 16 }}>
            <div className="pk-ws-title-row">
              <div>
                <h2 className="pk-ws-title" style={{ fontSize: 18 }}>
                  <PkIcon name="building" size={20} />
                  <span>{selected.companyName}</span>
                  <span className={`pk-badge ${selected.status === 'SUSPENDED' ? 'pk-badge-rose' : 'pk-badge-emerald'}`}>
                    {selected.status === 'SUSPENDED' ? 'SUSPENDIDA' : 'ACTIVA'}
                  </span>
                </h2>
                <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 4 }}>
                  NIT <strong>{selected.nit}</strong> · ID <code>{selected.tenantId}</code> · Base <code>{selected.dbName}</code> · Mensualidad:{' '}
                  <strong style={{ color: 'var(--pk-primary)' }}>
                    {formatCop(selected.customMonthlyCop || selected.monthlyCop || 0)} COP
                  </strong>
                </div>
              </div>
              <div className="pk-row-actions">
                {hasPlatformPermission('datos_negocio.ver') && selected.status !== 'SUSPENDED' && (
                  <button
                    type="button"
                    className="pk-btn pk-btn-primary pk-btn-sm"
                    onClick={() => setDetailTab('support')}
                  >
                    Abrir Soporte Cliente
                  </button>
                )}
                {hasPlatformPermission('empresas.suspender') && (
                  <button
                    type="button"
                    className={`pk-btn pk-btn-sm ${selected.status === 'SUSPENDED' ? 'pk-btn-emerald' : 'pk-btn-danger'}`}
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const next = selected.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
                        await apiPut(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/status`, { status: next });
                        await refreshBootstrap();
                        await loadTenants();
                        toast(next === 'SUSPENDED' ? 'Empresa suspendida' : 'Empresa reactivada');
                      })
                    }
                  >
                    {selected.status === 'SUSPENDED' ? 'Reactivar Empresa' : 'Suspender Empresa'}
                  </button>
                )}
              </div>
            </div>

            <div className="pk-folder-tabs">
              <button type="button" className={`pk-folder-tab ${detailTab === 'general' ? 'active' : ''}`} onClick={() => setDetailTab('general')}>
                Ficha, Cartera y Cuotas
              </button>
              <button type="button" className={`pk-folder-tab ${detailTab === 'licenses' ? 'active' : ''}`} onClick={() => setDetailTab('licenses')}>
                Licenciamiento 4 Niveles ({draftServices.length})
              </button>
              <button type="button" className={`pk-folder-tab ${detailTab === 'users' ? 'active' : ''}`} onClick={() => setDetailTab('users')}>
                Usuarios del Cliente ({tenantUsers.length})
              </button>
              <button type="button" className={`pk-folder-tab ${detailTab === 'support' ? 'active' : ''}`} onClick={() => setDetailTab('support')}>
                Soporte e Impersonación
              </button>
              <button type="button" className={`pk-folder-tab ${detailTab === 'exports' ? 'active' : ''}`} onClick={() => setDetailTab('exports')}>
                Exportación CSV ({exportJobs.length})
              </button>
            </div>
          </div>

          <div className="pk-card-body">
            {/* TAB 1: GENERAL, BILLING, QUOTAS & MAINTENANCE */}
            {detailTab === 'general' && (
              <div className="pk-stack">
                <div className="pk-grid-2">
                  <div className="pk-card" style={{ boxShadow: 'none' }}>
                    <div className="pk-card-head">
                      <div className="pk-card-title">Cupos de Usuarios y Facturación Mensual</div>
                    </div>
                    <div className="pk-card-body pk-stack">
                      <div className="pk-form-grid cols-2">
                        <div className="pk-field">
                          <label>
                            <span>Cupo Máximo de Usuarios</span>
                            <span style={{ display: 'inline-flex', gap: 4 }}>
                              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" style={{ padding: '1px 6px' }} onClick={() => setQuotaMaxUsers((v) => Math.max(1, v - 5))}>-5</button>
                              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" style={{ padding: '1px 6px' }} onClick={() => setQuotaMaxUsers((v) => v + 5)}>+5</button>
                            </span>
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={5000}
                            value={quotaMaxUsers}
                            onChange={(e) => setQuotaMaxUsers(Number(e.target.value) || 1)}
                          />
                        </div>
                        <div className="pk-field">
                          <label>Tarifa Personalizada COP (0 = Automática)</label>
                          <input
                            type="number"
                            min={0}
                            value={quotaCustomCop}
                            onChange={(e) => setQuotaCustomCop(Number(e.target.value) || 0)}
                          />
                        </div>
                        <div className="pk-col-span-full">
                          <PkSimpleSelect
                            label="Estado de Cartera / Pago"
                            searchable={false}
                            value={paymentStatus}
                            onChange={(nextStatus) => setPaymentStatus(nextStatus)}
                            options={[
                              { value: 'ACTIVA_VERIFICADA', label: 'Activa Verificada' },
                              { value: 'PENDIENTE_PAGO', label: 'Pendiente de Pago' },
                              { value: 'CORTESIA', label: 'Cortesía / Convenio' },
                              { value: 'EN_MORA', label: 'En Mora' },
                            ]}
                          />
                        </div>
                      </div>
                      {hasPlatformPermission('empresas.editar_cuotas') && (
                        <div className="pk-form-actions">
                          <button
                            type="button"
                            className="pk-btn pk-btn-primary"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await apiPut(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/quotas`, {
                                  maxUsersAllowed: quotaMaxUsers,
                                  customMonthlyCop: quotaCustomCop,
                                });
                                await apiPut(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/billing`, {
                                  paymentStatus,
                                });
                                await refreshBootstrap();
                                await loadTenants();
                                toast('Cupos, tarifa y estado de cartera actualizados');
                              })
                            }
                          >
                            Guardar Cupos y Cartera
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pk-card" style={{ boxShadow: 'none' }}>
                    <div className="pk-card-head">
                      <div className="pk-card-title">Ventana de Mantenimiento y Seguridad de Sesiones</div>
                    </div>
                    <div className="pk-card-body pk-stack">
                      <AdminSwitch
                        checked={maintMode}
                        tone="amber"
                        disabled={!hasPlatformPermission('empresas.mantenimiento')}
                        onChange={setMaintMode}
                        label="Modo Mantenimiento Individual (bloquea clientes, permite soporte)"
                      />
                      <div className="pk-field">
                        <label>Mensaje mostrado a los usuarios de la empresa</label>
                        <input
                          value={maintMsg}
                          onChange={(e) => setMaintMsg(e.target.value)}
                          placeholder="Estamos aplicando una actualización técnica programada..."
                        />
                      </div>
                      <div className="pk-form-actions" style={{ justifyContent: 'space-between' }}>
                        {hasPlatformPermission('usuarios_cliente.revocar_sesiones') && (
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await apiPost(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/revoke-sessions`, {});
                                await loadTenants();
                                toast('Todas las sesiones activas de esta empresa fueron cerradas (v' + ((selected.sessionVersion || 1) + 1) + ')');
                              })
                            }
                          >
                            Cerrar Todas las Sesiones Activas (v{selected.sessionVersion || 1})
                          </button>
                        )}
                        {hasPlatformPermission('empresas.mantenimiento') && (
                          <button
                            type="button"
                            className="pk-btn pk-btn-amber"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await apiPut(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/maintenance`, {
                                  maintenanceMode: maintMode,
                                  maintenanceMessage: maintMsg,
                                });
                                await loadTenants();
                                toast(maintMode ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado');
                              })
                            }
                          >
                            Guardar Mantenimiento
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pk-card" style={{ boxShadow: 'none' }}>
                  <div className="pk-card-head">
                    <div className="pk-card-title">Ficha Interna de Cuenta y Atención Comercial</div>
                  </div>
                  <div className="pk-card-body">
                    <div className="pk-form-grid cols-2">
                      <PkSimpleSelect
                        label="Nivel de Soporte SLA"
                        searchable={false}
                        value={meta.supportTier}
                        onChange={(nextTier) => setMeta({ ...meta, supportTier: nextTier })}
                        options={[
                          { value: 'STANDARD', label: 'Estándar' },
                          { value: 'PRIORITY', label: 'Prioritario' },
                          { value: 'ENTERPRISE', label: 'Corporativo Dedicado 24/7' },
                        ]}
                      />
                      <div className="pk-field">
                        <label>Ejecutivo Comercial / Líder Asignado</label>
                        <input
                          value={meta.accountManager}
                          onChange={(e) => setMeta({ ...meta, accountManager: e.target.value })}
                          placeholder="Ej. Dirección Comercial"
                        />
                      </div>
                      <div className="pk-field pk-col-span-full">
                        <label>Notas Internas de Facturación y Acuerdos</label>
                        <input
                          value={meta.billingNotes}
                          onChange={(e) => setMeta({ ...meta, billingNotes: e.target.value })}
                          placeholder="Contrato anual, descuentos aprobados, observaciones..."
                        />
                      </div>
                      {hasPlatformPermission('empresas.editar_cuotas') && (
                        <div className="pk-form-actions">
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await apiPut(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/metadata`, meta);
                                toast('Ficha interna guardada');
                              })
                            }
                          >
                            Guardar Ficha Interna
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: FULL 4-LEVEL HIERARCHICAL LICENSING */}
            {detailTab === 'licenses' && (
              <div className="pk-stack">
                <div className="pk-row-between" style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 10, border: '1px solid var(--pk-border)' }}>
                  <div style={{ fontSize: 12.5, color: 'var(--pk-text-secondary)' }}>
                    <strong>Árbol Jerárquico de 4 Niveles:</strong> 1. Microservicio → 2. Módulo → 3. Submódulo → 4. Funcionalidad.
                    Activas ahora: <strong>{draftServices.length} áreas</strong> · <strong>{draftModules.length} módulos</strong> · <strong>{draftFeatures.length} funciones</strong>.
                  </div>
                  {hasPlatformPermission('empresas.editar_suscripcion') && (
                    <div className="pk-row-actions">
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        onClick={() => {
                          setDraftServices(catalog.map((s) => s.serviceKey));
                          setDraftModules(catalog.flatMap((s) => s.modules.map((m) => m.moduleKey)));
                          setDraftSubmodules(catalog.flatMap((s) => (s.submodules || []).map((sm) => sm.submoduleKey)));
                          setDraftFeatures(catalog.flatMap((s) => (s.features || []).map((f) => f.featureKey)));
                        }}
                      >
                        Marcar Suite Completa
                      </button>
                      <button type="button" className="pk-btn pk-btn-primary" disabled={busy} onClick={handleSaveSubscriptions}>
                        {busy ? 'Guardando...' : 'Guardar Licencias de 4 Niveles'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="pk-plan-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 390px), 1fr))' }}>
                  {catalog.map((svc) => {
                    const svcOn = draftServices.includes(svc.serviceKey);
                    const canEdit = hasPlatformPermission('empresas.editar_suscripcion');
                    return (
                      <div className="pk-card" key={svc.serviceKey} style={{ opacity: svcOn ? 1 : 0.78 }}>
                        <div className="pk-card-head" style={{ background: svcOn ? '#eff6ff' : '#f8fafc' }}>
                          <AdminSwitch
                            checked={svcOn}
                            disabled={!canEdit}
                            tone="emerald"
                            onChange={() => toggleService(svc.serviceKey)}
                            label={
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 800 }}>
                                <PkIcon name={svc.serviceKey} size={17} />
                                <span>1. {svc.displayName}</span>
                              </span>
                            }
                          />
                          <span className={`pk-badge ${svcOn ? 'pk-badge-emerald' : 'pk-badge-slate'}`}>
                            {svcOn ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>

                        <div className="pk-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
                          {svc.modules.map((mod) => {
                            const modOn = svcOn && draftModules.includes(mod.moduleKey);
                            const modSubs = (svc.submodules || []).filter((sm) => sm.dependsOnModule === mod.moduleKey);
                            const directFeats = (svc.features || []).filter(
                              (f) => f.dependsOnModule === mod.moduleKey && !f.dependsOnSubmodule
                            );
                            return (
                              <div
                                key={mod.moduleKey}
                                style={{
                                  borderRadius: 8,
                                  border: '1px solid var(--pk-border)',
                                  background: modOn ? '#ffffff' : '#f8fafc',
                                  padding: 9,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 6,
                                }}
                              >
                                <div className="pk-row-between">
                                  <AdminSwitch
                                    checked={modOn}
                                    disabled={!canEdit || !svcOn}
                                    onChange={() => toggleModule(svc.serviceKey, mod.moduleKey)}
                                    label={<span>{mod.tabIcon} 2. {mod.displayName}</span>}
                                  />
                                  <span className={`pk-badge ${modOn ? 'pk-badge-blue' : 'pk-badge-slate'}`}>Módulo</span>
                                </div>

                                {modSubs.map((sm) => {
                                  const subOn = modOn && draftSubmodules.includes(sm.submoduleKey);
                                  const subFeats = (svc.features || []).filter((f) => f.dependsOnSubmodule === sm.submoduleKey);
                                  return (
                                    <div
                                      key={sm.submoduleKey}
                                      style={{
                                        marginLeft: 14,
                                        padding: '6px 9px',
                                        borderRadius: 7,
                                        borderLeft: subOn ? '3px solid var(--pk-primary)' : '3px solid #cbd5e1',
                                        background: '#f8fafc',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 5,
                                      }}
                                    >
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, cursor: modOn && canEdit ? 'pointer' : 'not-allowed' }}>
                                        <input
                                          type="checkbox"
                                          disabled={!canEdit || !modOn}
                                          checked={subOn}
                                          onChange={() => toggleSubmodule(svc.serviceKey, mod.moduleKey, sm.submoduleKey)}
                                        />
                                        <span>3. {sm.displayName}</span>
                                      </label>
                                      {subFeats.map((feat) => {
                                        const featOn = subOn && draftFeatures.includes(feat.featureKey);
                                        return (
                                          <label
                                            key={feat.featureKey}
                                            style={{
                                              marginLeft: 16,
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 7,
                                              fontSize: 11.5,
                                              color: 'var(--pk-text-secondary)',
                                              cursor: subOn && canEdit ? 'pointer' : 'not-allowed',
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              disabled={!canEdit || !subOn}
                                              checked={featOn}
                                              onChange={() => toggleFeature(svc.serviceKey, feat.dependsOnModule, feat.dependsOnSubmodule, feat.featureKey)}
                                            />
                                            <span>4. {feat.displayName}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  );
                                })}

                                {directFeats.map((feat) => {
                                  const featOn = modOn && draftFeatures.includes(feat.featureKey);
                                  return (
                                    <label
                                      key={feat.featureKey}
                                      style={{
                                        marginLeft: 16,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 7,
                                        fontSize: 11.5,
                                        color: 'var(--pk-text-secondary)',
                                        cursor: modOn && canEdit ? 'pointer' : 'not-allowed',
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        disabled={!canEdit || !modOn}
                                        checked={featOn}
                                        onChange={() => toggleFeature(svc.serviceKey, feat.dependsOnModule, feat.dependsOnSubmodule, feat.featureKey)}
                                      />
                                      <span>4. {feat.displayName}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: CLIENT USERS DIRECTORY & GRANULAR RBAC */}
            {detailTab === 'users' && (
              <div className="pk-stack">
                <div className="pk-row-between">
                  <div style={{ fontSize: 13, color: 'var(--pk-muted)' }}>
                    Usuarios activos: <strong>{tenantUsers.filter((u) => u.status !== 'SUSPENDED').length}</strong> de{' '}
                    <strong>{selected.maxUsersAllowed || 15}</strong> permitidos en el plan.
                  </div>
                  {hasPlatformPermission('usuarios_cliente.crear') && (
                    <button type="button" className="pk-btn pk-btn-primary" onClick={openCreateClientUser}>
                      + Crear Usuario en esta Empresa
                    </button>
                  )}
                </div>

                <div className="pk-table-wrap">
                  <table className="pk-table">
                    <thead>
                      <tr>
                        <th>Empleado</th>
                        <th>Rol Operativo</th>
                        <th>Áreas Asignadas</th>
                        <th>Estado</th>
                        <th>Acciones Administrativas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantUsers.map((u) => (
                        <tr key={u.userId}>
                          <td>
                            <strong>{u.fullName}</strong>
                            <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>{u.username}</div>
                          </td>
                          <td>
                            <span className={`pk-badge ${u.isCompanyAdmin ? 'pk-badge-blue' : 'pk-badge-slate'}`}>
                              {u.internalRole}
                            </span>
                          </td>
                          <td>
                            {u.isCompanyAdmin || u.allowedServices.includes('*')
                              ? 'Todas las contratadas'
                              : `${u.allowedServices.length} servicios · ${u.allowedModules.length} módulos`}
                          </td>
                          <td>
                            <span className={`pk-badge ${u.status === 'SUSPENDED' ? 'pk-badge-rose' : 'pk-badge-emerald'}`}>
                              {u.status === 'SUSPENDED' ? 'Suspendido' : 'Activo'}
                            </span>
                          </td>
                          <td>
                            <div className="pk-row-actions">
                              {hasPlatformPermission('usuarios_cliente.editar') && (
                                <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => openEditClientUser(u)}>
                                  Editar / Módulos
                                </button>
                              )}
                              {hasPlatformPermission('usuarios_cliente.reset_password') && (
                                <button
                                  type="button"
                                  className="pk-btn pk-btn-outline pk-btn-sm"
                                  onClick={() => {
                                    setResetPassTarget(u);
                                    setResetPassValue(generateSecurePassword());
                                  }}
                                >
                                  Cambiar Clave
                                </button>
                              )}
                              {hasPlatformPermission('usuarios_cliente.revocar_sesiones') && (
                                <button
                                  type="button"
                                  className="pk-btn pk-btn-outline pk-btn-sm"
                                  onClick={() =>
                                    void apiPost(
                                      `/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/users/${encodeURIComponent(u.userId)}/revoke-sessions`,
                                      {}
                                    ).then(() => toast(`Sesiones cerradas para ${u.username}`))
                                  }
                                >
                                  Cerrar Sesiones
                                </button>
                              )}
                              {hasPlatformPermission('usuarios_cliente.editar') && u.userId !== `usr_${selected.tenantId}` && (
                                <>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-outline pk-btn-sm"
                                    onClick={() =>
                                      void run(async () => {
                                        const next = u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
                                        await apiPut(
                                          `/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/users/${encodeURIComponent(u.userId)}`,
                                          { fullName: u.fullName, email: u.email, internalRole: u.internalRole, status: next }
                                        );
                                        await loadTenantDetails(selected);
                                        toast(next === 'SUSPENDED' ? 'Usuario suspendido' : 'Usuario reactivado');
                                      })
                                    }
                                  >
                                    {u.status === 'SUSPENDED' ? 'Reactivar' : 'Suspender'}
                                  </button>
                                  <button type="button" className="pk-btn pk-btn-danger pk-btn-sm" onClick={() => setDeleteUserTarget(u)}>
                                    Eliminar
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: CONTROLLED SUPPORT IMPERSONATION */}
            {detailTab === 'support' && (
              <div className="pk-card" style={{ maxWidth: 680, boxShadow: 'none' }}>
                <div className="pk-card-head">
                  <div className="pk-card-title">Ingreso de Soporte Auditado a la Estación del Cliente</div>
                </div>
                <div className="pk-card-body pk-stack">
                  {!hasPlatformPermission('datos_negocio.ver') ? (
                    <div style={{ color: '#991b1b', fontSize: 13, fontWeight: 600 }}>
                      Tu rol actual no tiene activado el switch <code>datos_negocio.ver</code>. Solicítalo a un SuperAdministrador si requieres asistir datos operativos.
                    </div>
                  ) : (
                    <>
                      <div className="pk-form-grid cols-2">
                        <PkSimpleSelect
                          label="Modo de Intervención"
                          searchable={false}
                          value={supportMode}
                          onChange={(nextMode) => setSupportMode(nextMode as 'readonly' | 'readwrite')}
                          options={[
                            { value: 'readonly', label: 'Solo Lectura (bloquea escrituras en Gateway)' },
                            ...(hasPlatformPermission('soporte.impersonar_escritura')
                              ? [{ value: 'readwrite', label: 'Lectura y Escritura (corrección operativa)' }]
                              : []),
                          ]}
                        />
                        <PkSimpleSelect
                          label="Vigencia Temporal de la Sesión"
                          searchable={false}
                          value={String(supportDuration)}
                          onChange={(nextDur) => setSupportDuration(Number(nextDur))}
                          options={[
                            { value: '15', label: '15 minutos' },
                            { value: '30', label: '30 minutos' },
                            { value: '60', label: '60 minutos' },
                          ]}
                        />
                      </div>
                      <div className="pk-field">
                        <label>
                          <span>Motivo o Número de Ticket de Soporte</span>
                          {requireDataReason && <span style={{ color: 'var(--pk-rose)' }}>Obligatorio</span>}
                        </label>
                        <input
                          value={supportReason}
                          onChange={(e) => setSupportReason(e.target.value)}
                          placeholder="Ej. Ticket #1042 — Verificación de cuadre de caja reportado por el cliente"
                        />
                      </div>
                      <div className="pk-form-actions">
                        <button
                          type="button"
                          className="pk-btn pk-btn-primary"
                          disabled={selected.status === 'SUSPENDED'}
                          onClick={() => void onStartSupport(selected.tenantId, supportMode, supportReason, supportDuration)}
                        >
                          Entrar a Estación de {selected.companyName} →
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: EXCEL-COMPATIBLE CSV ZIP EXPORTS */}
            {detailTab === 'exports' && (
              <div className="pk-stack">
                <PkViewSwitcher
                  title="Paquetes de Exportación CSV (.ZIP para Excel)"
                  subtitle={`Extrae las tablas de todos los microservicios activos de ${selected.companyName} con codificación UTF-8 BOM y separador punto y coma (;).`}
                  mode={exportsViewMode}
                  onModeChange={setExportsViewMode}
                  listLabel="Historial de Paquetes"
                  createLabel="+ Generar Paquete ZIP"
                  count={exportJobs.length}
                />

                {exportsViewMode === 'list' ? (
                  <div className="pk-card" style={{ boxShadow: 'none' }}>
                    <div className="pk-card-head">
                      <div className="pk-card-title">Paquetes Generados ({exportJobs.length})</div>
                    </div>
                    <div className="pk-table-wrap">
                      <table className="pk-table">
                        <thead>
                          <tr>
                            <th>ID Trabajo</th>
                            <th>Fecha UTC</th>
                            <th>Solicitado Por</th>
                            <th>Motivo</th>
                            <th>Servicios Incluidos</th>
                            <th className="pk-num">Tamaño</th>
                            <th>Descarga</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exportJobs.map((j) => (
                            <tr key={j.jobId}>
                              <td><code>{j.jobId}</code></td>
                              <td style={{ fontSize: 12 }}>{j.createdAt.slice(0, 19).replace('T', ' ')}</td>
                              <td>{j.requestedBy}</td>
                              <td>{j.reason || '—'}</td>
                              <td>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                  {(j.servicesIncluded || []).map((s) => (
                                    <span key={s} className="pk-badge pk-badge-slate">{s}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="pk-num">{(j.fileSizeBytes / 1024).toFixed(1)} KB</td>
                              <td>
                                <a
                                  className="pk-btn pk-btn-primary pk-btn-sm"
                                  style={{ textDecoration: 'none' }}
                                  href={`/api/v1/admin/exports/${encodeURIComponent(j.jobId)}/download`}
                                  download
                                >
                                  Descargar .ZIP
                                </a>
                              </td>
                            </tr>
                          ))}
                          {exportJobs.length === 0 && (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: 20, color: 'var(--pk-muted)' }}>
                                Aún no se han generado paquetes CSV para esta empresa.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="pk-card" style={{ boxShadow: 'none' }}>
                    <div className="pk-card-head">
                      <div>
                        <div className="pk-card-title">Generar Nuevo Paquete de Datos del Cliente (.ZIP con CSVs)</div>
                        <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
                          El paquete consolidará todos los microservicios activos de {selected.companyName} y quedará auditado en bitácora.
                        </div>
                      </div>
                    </div>
                    <div className="pk-card-body">
                      {!hasPlatformPermission('datos_negocio.exportar_csv') ? (
                        <div style={{ color: '#991b1b', fontSize: 13 }}>
                          Tu rol no tiene habilitado el permiso <code>datos_negocio.exportar_csv</code>.
                        </div>
                      ) : (
                        <div className="pk-form-grid cols-2">
                          <div className="pk-field pk-col-span-full">
                            <label>Motivo / Solicitud de Descarga {requireDataReason ? '(Obligatorio)' : ''}</label>
                            <input
                              value={exportReason}
                              onChange={(e) => setExportReason(e.target.value)}
                              placeholder="Ej. Solicitud formal de respaldo contable mensual del cliente"
                            />
                          </div>
                          <div className="pk-form-actions">
                            <button
                              type="button"
                              className="pk-btn pk-btn-outline"
                              disabled={busy}
                              onClick={() => setExportsViewMode('list')}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="pk-btn pk-btn-emerald"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  await apiPost(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/exports`, {
                                    reason: exportReason,
                                  });
                                  setExportReason('');
                                  await loadTenantDetails(selected);
                                  setExportsViewMode('list');
                                  toast('Paquete ZIP CSV generado correctamente');
                                })
                              }
                            >
                              {busy ? 'Generando ZIP...' : 'Generar Paquete ZIP CSV'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="pk-card">
          <div className="pk-card-body" style={{ color: 'var(--pk-muted)' }}>Selecciona una empresa del listado izquierdo.</div>
        </div>
      )}

      {/* MODAL: PROVISION NEW TENANT */}
      <PkModal open={showCreateModal} title="Aprovisionar Nueva Empresa y Base de Datos Aislada" onClose={() => setShowCreateModal(false)} maxWidth={680}>
        <form onSubmit={handleCreateTenant} className="pk-stack">
          <div className="pk-form-grid cols-2">
            <div className="pk-field">
              <label>Razón Social</label>
              <input required value={createForm.companyName} onChange={(e) => setCreateForm({ ...createForm, companyName: e.target.value })} placeholder="Ej. Inversiones del Oriente S.A.S." />
            </div>
            <div className="pk-field">
              <label>NIT Tributario</label>
              <input required value={createForm.nit} onChange={(e) => setCreateForm({ ...createForm, nit: e.target.value })} placeholder="901.440.120-1" />
            </div>
            <div className="pk-field">
              <label>Nombre Administrador Principal</label>
              <input required value={createForm.adminFullName} onChange={(e) => setCreateForm({ ...createForm, adminFullName: e.target.value })} placeholder="Nombre y apellido" />
            </div>
            <div className="pk-field">
              <label>Correo de Acceso</label>
              <input type="email" required value={createForm.adminUsername} onChange={(e) => setCreateForm({ ...createForm, adminUsername: e.target.value })} placeholder="gerencia@empresa.co" />
            </div>
            <div className="pk-field">
              <label>
                <span>Contraseña Inicial</span>
                <button type="button" onClick={() => setCreateForm({ ...createForm, password: generateSecurePassword() })} style={{ border: 'none', background: 'none', color: 'var(--pk-primary)', fontWeight: 800, fontSize: 11, cursor: 'pointer', padding: 0 }}>
                  Generar otra
                </button>
              </label>
              <input type="text" required minLength={8} value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
            </div>
            <PkSimpleSelect
              label="Paquete Operativo Inicial"
              value={createForm.businessPreset}
              onChange={(nextPreset) => setCreateForm({ ...createForm, businessPreset: nextPreset })}
              options={[
                { value: 'full', label: 'Suite Empresarial Completa (Todas las Áreas)' },
                { value: 'comercio', label: 'Comercio, Tienda y Ferretería' },
                { value: 'restaurante', label: 'Restaurante, Gastrobar y Cafetería' },
                { value: 'bares', label: 'Bares, Discotecas y Eventos' },
                { value: 'automotriz', label: 'Centro Automotriz y Taller' },
                { value: 'hotel', label: 'Hoteles y Alojamiento' },
                { value: 'citas', label: 'Consultorios, Spa y Servicios por Cita' },
                { value: 'mayorista', label: 'Distribuidora Mayorista' },
                { value: 'logistica', label: 'Agroindustria y Báscula Camionera' },
              ]}
            />
          </div>
          <div className="pk-form-actions">
            <button type="button" className="pk-btn pk-btn-outline" onClick={() => setShowCreateModal(false)}>Cancelar</button>
            <button type="submit" className="pk-btn pk-btn-emerald" disabled={busy}>
              {busy ? 'Aprovisionando...' : 'Crear Empresa'}
            </button>
          </div>
        </form>
      </PkModal>

      {/* MODAL: CREATE / EDIT CLIENT USER */}
      <PkModal
        open={userModalOpen}
        title={editingUser ? `Editar Empleado: ${editingUser.fullName}` : `Crear Empleado en ${selected?.companyName || ''}`}
        onClose={() => setUserModalOpen(false)}
        maxWidth={720}
      >
        <form onSubmit={handleSaveClientUser} className="pk-stack">
          <div className="pk-form-grid cols-2">
            <div className="pk-field">
              <label>Nombre Completo</label>
              <input required value={userFullName} onChange={(e) => setUserFullName(e.target.value)} placeholder="Nombre del empleado" />
            </div>
            <div className="pk-field">
              <label>Usuario / Correo</label>
              <input required disabled={Boolean(editingUser)} value={userUsername} onChange={(e) => setUserUsername(e.target.value)} placeholder="empleado@empresa.co" />
            </div>
            <div className="pk-field">
              <label>
                <span>{editingUser ? 'Nueva Contraseña (opcional)' : 'Contraseña Inicial'}</span>
                <button type="button" onClick={() => setUserPassword(generateSecurePassword())} style={{ border: 'none', background: 'none', color: 'var(--pk-primary)', fontWeight: 800, fontSize: 11, cursor: 'pointer', padding: 0 }}>
                  Generar clave
                </button>
              </label>
              <input type="text" required={!editingUser} value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder={editingUser ? 'Dejar vacío para conservar' : ''} />
            </div>
            <PkSimpleSelect
              label="Plantilla de Puesto"
              value={userRole}
              onChange={(nextRole) => applyUserTemplate(nextRole, roleTemplates)}
              options={roleTemplates.map((tpl) => ({
                value: tpl.roleKey,
                label: tpl.displayName,
                sublabel: tpl.description,
              }))}
            />
          </div>

          <AdminSwitch
            checked={userIsAdmin}
            onChange={setUserIsAdmin}
            label="Administrador de la Empresa (acceso total a todos los servicios contratados)"
          />

          {!userIsAdmin && (
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--pk-border)', borderRadius: 10, padding: 12 }} className="pk-stack">
              <div className="pk-label">Servicios y Módulos Permitidos para este Empleado</div>
              {activeCompanyCatalog.map((svc) => {
                const svcChecked = userServices.includes(svc.serviceKey);
                const enabledMods = svc.modules.filter((m) => selected?.activeModules.includes(m.moduleKey));
                return (
                  <div key={svc.serviceKey} style={{ padding: 8, borderRadius: 8, background: svcChecked ? '#eff6ff' : '#f8fafc', border: '1px solid var(--pk-border)' }}>
                    <AdminSwitch
                      checked={svcChecked}
                      onChange={(checked) => {
                        if (checked) {
                          setUserServices((prev) => Array.from(new Set([...prev, svc.serviceKey])));
                          setUserModules((prev) => Array.from(new Set([...prev, ...enabledMods.map((m) => m.moduleKey)])));
                        } else {
                          setUserServices((prev) => prev.filter((k) => k !== svc.serviceKey));
                          setUserModules((prev) => prev.filter((mk) => !enabledMods.some((m) => m.moduleKey === mk)));
                        }
                      }}
                      label={<strong>{svc.displayName}</strong>}
                    />
                    {svcChecked && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8, paddingLeft: 48 }}>
                        {enabledMods.map((m) => (
                          <label key={m.moduleKey} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                            <input
                              type="checkbox"
                              checked={userModules.includes(m.moduleKey)}
                              onChange={(e) =>
                                setUserModules((prev) =>
                                  e.target.checked ? [...prev, m.moduleKey] : prev.filter((k) => k !== m.moduleKey)
                                )
                              }
                            />
                            <span>{m.displayName}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="pk-form-actions">
            <button type="button" className="pk-btn pk-btn-outline" onClick={() => setUserModalOpen(false)}>Cancelar</button>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              {busy ? 'Guardando...' : editingUser ? 'Guardar Cambios' : 'Crear Empleado'}
            </button>
          </div>
        </form>
      </PkModal>

      {/* MODAL: RESET CLIENT USER PASSWORD */}
      <PkModal open={Boolean(resetPassTarget)} title={`Restablecer Contraseña: ${resetPassTarget?.username || ''}`} onClose={() => setResetPassTarget(null)} maxWidth={440}>
        <div className="pk-stack">
          <div className="pk-field">
            <label>
              <span>Nueva Contraseña Segura</span>
              <button type="button" onClick={() => setResetPassValue(generateSecurePassword())} style={{ border: 'none', background: 'none', color: 'var(--pk-primary)', fontWeight: 800, fontSize: 11, cursor: 'pointer', padding: 0 }}>
                Regenerar
              </button>
            </label>
            <input value={resetPassValue} onChange={(e) => setResetPassValue(e.target.value)} />
          </div>
          <div className="pk-form-actions">
            <button type="button" className="pk-btn pk-btn-outline" onClick={() => setResetPassTarget(null)}>Cancelar</button>
            <button
              type="button"
              className="pk-btn pk-btn-primary"
              disabled={busy || resetPassValue.trim().length < 8}
              onClick={() => {
                if (!selected || !resetPassTarget) return;
                void run(async () => {
                  await apiPost(
                    `/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/users/${encodeURIComponent(resetPassTarget.userId)}/reset-password`,
                    { password: resetPassValue.trim() }
                  );
                  setResetPassTarget(null);
                  toast('Contraseña actualizada y sesiones anteriores revocadas');
                });
              }}
            >
              Aplicar Nueva Contraseña
            </button>
          </div>
        </div>
      </PkModal>

      {/* CONFIRM DELETE CLIENT USER */}
      <PkConfirmModal
        open={Boolean(deleteUserTarget)}
        title="Eliminar Usuario de Empresa"
        message={`¿Confirmas eliminar permanentemente la cuenta "${deleteUserTarget?.username || ''}" de ${selected?.companyName || ''}?`}
        confirmLabel="Eliminar Usuario"
        busy={busy}
        onCancel={() => setDeleteUserTarget(null)}
        onConfirm={() => {
          if (!selected || !deleteUserTarget) return;
          void run(async () => {
            await apiDelete(`/api/v1/admin/tenants/${encodeURIComponent(selected.tenantId)}/users/${encodeURIComponent(deleteUserTarget.userId)}`);
            setDeleteUserTarget(null);
            await loadTenantDetails(selected);
            toast('Usuario eliminado de la empresa');
          });
        }}
      />
    </div>
  );
};
