import React, { useState, useEffect, useMemo } from 'react';
import { usePlatform, useAsyncAction, TenantSummary, PkModal } from '@platform/ui-sdk';

export const SuperAdminPanel: React.FC<{
  onEnterWorkstation: (tenantId: string) => void;
}> = ({ onEnterWorkstation }) => {
  const {
    catalog,
    tenantsList,
    tenant,
    apiPost,
    apiPut,
    refreshBootstrap,
    impersonateTenant,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenant?.tenantId || '');
  const [services, setServices] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [submodules, setSubmodules] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>('');
  const [newNit, setNewNit] = useState<string>('');
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [newAdminPass, setNewAdminPass] = useState<string>('');
  const [newPreset, setNewPreset] = useState<string>('full');

  const selectedTenant = tenantsList.find((t) => t.tenantId === selectedTenantId) || tenant;

  const moduleTitleByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const svc of catalog) {
      for (const mod of svc.modules) {
        map.set(mod.moduleKey, mod.displayName);
      }
    }
    return map;
  }, [catalog]);

  const submoduleTitleByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const svc of catalog) {
      for (const sm of svc.submodules || []) {
        map.set(sm.submoduleKey, sm.displayName);
      }
    }
    return map;
  }, [catalog]);

  useEffect(() => {
    if (!selectedTenantId && tenant?.tenantId) {
      setSelectedTenantId(tenant.tenantId);
    }
  }, [selectedTenantId, tenant?.tenantId]);

  useEffect(() => {
    if (selectedTenant) {
      setServices(selectedTenant.activeServices || []);
      setModules(selectedTenant.activeModules || []);
      setSubmodules(selectedTenant.activeSubmodules || []);
      setFeatures(selectedTenant.activeFeatures || []);
    }
  }, [selectedTenantId, selectedTenant]);

  const toggleService = (serviceKey: string) => {
    const svc = catalog.find((s) => s.serviceKey === serviceKey);
    if (!svc) return;
    const svcModKeys = svc.modules.map((m) => m.moduleKey);
    const svcSubKeys = (svc.submodules || []).map((sm) => sm.submoduleKey);
    const svcFeatKeys = (svc.features || []).map((f) => f.featureKey);

    if (services.includes(serviceKey)) {
      setServices((prev) => prev.filter((k) => k !== serviceKey));
      setModules((prev) => prev.filter((k) => !svcModKeys.includes(k)));
      setSubmodules((prev) => prev.filter((k) => !svcSubKeys.includes(k)));
      setFeatures((prev) => prev.filter((k) => !svcFeatKeys.includes(k)));
    } else {
      setServices((prev) => [...prev, serviceKey]);
      setModules((prev) => Array.from(new Set([...prev, ...svcModKeys])));
      setSubmodules((prev) => Array.from(new Set([...prev, ...svcSubKeys])));
      setFeatures((prev) => Array.from(new Set([...prev, ...svcFeatKeys])));
    }
  };

  const toggleModule = (serviceKey: string, moduleKey: string) => {
    if (!services.includes(serviceKey)) return;
    const svc = catalog.find((s) => s.serviceKey === serviceKey);
    const modSubKeys = (svc?.submodules || [])
      .filter((sm) => sm.dependsOnModule === moduleKey)
      .map((sm) => sm.submoduleKey);
    const dependentFeats = (svc?.features || [])
      .filter((f) => f.dependsOnModule === moduleKey || (f.dependsOnSubmodule && modSubKeys.includes(f.dependsOnSubmodule)))
      .map((f) => f.featureKey);

    if (modules.includes(moduleKey)) {
      setModules((prev) => prev.filter((m) => m !== moduleKey));
      setSubmodules((prev) => prev.filter((sm) => !modSubKeys.includes(sm)));
      setFeatures((prev) => prev.filter((f) => !dependentFeats.includes(f)));
    } else {
      setModules((prev) => [...prev, moduleKey]);
      setSubmodules((prev) => Array.from(new Set([...prev, ...modSubKeys])));
      setFeatures((prev) => Array.from(new Set([...prev, ...dependentFeats])));
    }
  };

  const toggleSubmodule = (serviceKey: string, dependsOnModule: string, submoduleKey: string) => {
    if (!services.includes(serviceKey)) return;
    if (dependsOnModule && !modules.includes(dependsOnModule)) {
      const modTitle = moduleTitleByKey.get(dependsOnModule) || dependsOnModule;
      toast(`Primero debes activar el módulo "${modTitle}" para habilitar este submódulo.`);
      return;
    }
    const svc = catalog.find((s) => s.serviceKey === serviceKey);
    const dependentFeats = (svc?.features || [])
      .filter((f) => f.dependsOnSubmodule === submoduleKey)
      .map((f) => f.featureKey);

    if (submodules.includes(submoduleKey)) {
      setSubmodules((prev) => prev.filter((sm) => sm !== submoduleKey));
      setFeatures((prev) => prev.filter((f) => !dependentFeats.includes(f)));
    } else {
      setSubmodules((prev) => [...prev, submoduleKey]);
      setFeatures((prev) => Array.from(new Set([...prev, ...dependentFeats])));
    }
  };

  const toggleFeature = (
    serviceKey: string,
    dependsOnModule: string,
    dependsOnSubmodule: string | undefined,
    featureKey: string
  ) => {
    if (!services.includes(serviceKey)) return;
    if (dependsOnModule && !modules.includes(dependsOnModule)) {
      const modTitle = moduleTitleByKey.get(dependsOnModule) || dependsOnModule;
      toast(`Primero debes activar el módulo "${modTitle}" para habilitar esta funcionalidad.`);
      return;
    }
    if (dependsOnSubmodule && !submodules.includes(dependsOnSubmodule)) {
      const subTitle = submoduleTitleByKey.get(dependsOnSubmodule) || dependsOnSubmodule;
      toast(`Primero debes activar el submódulo "${subTitle}" para habilitar esta funcionalidad.`);
      return;
    }
    if (features.includes(featureKey)) {
      setFeatures((prev) => prev.filter((f) => f !== featureKey));
    } else {
      setFeatures((prev) => [...prev, featureKey]);
    }
  };

  const handleSaveSubscriptions = () => {
    if (!selectedTenant) return;
    void run(async () => {
      const res = await apiPut<{ tenant: TenantSummary }>(
        `/api/v1/core/tenants/${encodeURIComponent(selectedTenant.tenantId)}/subscriptions`,
        {
          activeServices: services,
          activeModules: modules,
          activeSubmodules: submodules,
          activeFeatures: features,
        }
      );
      await refreshBootstrap();
      if (tenant?.tenantId === res.tenant.tenantId && res.tenant.status !== 'SUSPENDED') {
        await impersonateTenant(res.tenant.tenantId);
      }
      toast(`Licenciamiento de 4 niveles guardado para ${res.tenant.companyName}`);
    });
  };

  const handleToggleTenantStatus = () => {
    if (!selectedTenant) return;
    const nextStatus = selectedTenant.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    void run(async () => {
      const res = await apiPut<{ tenant: TenantSummary }>(
        `/api/v1/core/tenants/${encodeURIComponent(selectedTenant.tenantId)}/status`,
        { status: nextStatus }
      );
      await refreshBootstrap();
      toast(
        res.tenant.status === 'SUSPENDED'
          ? `Empresa "${res.tenant.companyName}" suspendida. Sus sesiones operativas han sido bloqueadas.`
          : `Empresa "${res.tenant.companyName}" reactivada correctamente.`
      );
    });
  };

  const handleCreateTenantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const res = await apiPost<{ tenant: TenantSummary }>('/api/v1/core/tenants', {
        companyName: newCompanyName,
        nit: newNit,
        adminUsername: newAdminEmail,
        password: newAdminPass,
        businessPreset: newPreset,
      });
      await refreshBootstrap();
      setSelectedTenantId(res.tenant.tenantId);
      setShowCreateModal(false);
      setNewCompanyName('');
      setNewNit('');
      setNewAdminEmail('');
      setNewAdminPass('');
      toast(`Empresa "${res.tenant.companyName}" aprovisionada sin alterar tu sesión corporativa`);
    });
  };

  const isSuspended = selectedTenant?.status === 'SUSPENDED';

  return (
    <div>
      <div className="pk-card">
        <div className="pk-card-head">
          <div>
            <div className="pk-card-title">Gobierno Multi-Empresa y Licenciamiento Jerárquico de 4 Niveles</div>
            <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 3 }}>
              Jerarquía contractual por empresa: <strong>1. Microservicio</strong> → <strong>2. Módulo</strong> →{' '}
              <strong>3. Submódulo</strong> → <strong>4. Funcionalidad</strong>.
            </div>
          </div>
          <div className="pk-row-actions">
            <button
              type="button"
              className="pk-btn pk-btn-emerald"
              onClick={() => setShowCreateModal(true)}
            >
              + Aprovisionar Empresa
            </button>
            {selectedTenant && (
              <button
                type="button"
                className={`pk-btn ${isSuspended ? 'pk-btn-emerald' : 'pk-btn-danger'}`}
                onClick={handleToggleTenantStatus}
                disabled={busy}
              >
                {isSuspended ? 'Reactivar Empresa' : 'Suspender Empresa'}
              </button>
            )}
            <button type="button" className="pk-btn pk-btn-primary" onClick={handleSaveSubscriptions} disabled={busy}>
              {busy ? 'Guardando...' : 'Guardar Cambios de Licencia'}
            </button>
            {selectedTenant && (
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                disabled={busy || isSuspended}
                title={isSuspended ? 'Reactiva la empresa antes de abrir su estación operativa' : undefined}
                onClick={() => onEnterWorkstation(selectedTenant.tenantId)}
              >
                Ingresar a Estación de Empresa
              </button>
            )}
          </div>
        </div>

        <div className="pk-card-body">
          <div className="pk-form-grid">
            <div className="pk-field">
              <label htmlFor="sa-tenant-select">Empresa Cliente Seleccionada</label>
              <select
                id="sa-tenant-select"
                value={selectedTenant?.tenantId || ''}
                onChange={(e) => setSelectedTenantId(e.target.value)}
              >
                {tenantsList.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.companyName} — NIT {t.nit} ({t.status === 'SUSPENDED' ? 'Suspendida' : 'Activa'})
                  </option>
                ))}
              </select>
            </div>
            {selectedTenant && (
              <div className="pk-field">
                <label>Estado Operativo y Aislamiento de Datos</label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: isSuspended ? '#fef2f2' : '#f0fdf4',
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 12.5, color: isSuspended ? '#991b1b' : '#166534' }}>
                    {isSuspended ? 'SUSPENDIDA (Acceso Bloqueado)' : 'ACTIVA (En Operación)'} • Administrador:{' '}
                    {selectedTenant.adminUsername}
                  </span>
                  <span className={`pk-badge ${isSuspended ? 'pk-badge-rose' : 'pk-badge-emerald'}`}>
                    {isSuspended ? 'Bloqueada' : 'Al Día'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pk-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))' }}>
        {catalog.map((svc) => {
          const svcOn = services.includes(svc.serviceKey);
          return (
            <div className="pk-card" key={svc.serviceKey} style={{ marginBottom: 0, opacity: svcOn ? 1 : 0.72 }}>
              <div className="pk-card-head" style={{ background: svcOn ? '#f8fafc' : '#f1f5f9' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: 14,
                  }}
                >
                  <input type="checkbox" checked={svcOn} onChange={() => toggleService(svc.serviceKey)} />
                  <span>
                    {svc.icon} 1. {svc.displayName}
                  </span>
                </label>
                <span className={`pk-badge ${svcOn ? 'pk-badge-emerald' : 'pk-badge-slate'}`}>
                  {svcOn ? 'Servicio Activo' : 'Apagado'}
                </span>
              </div>

              <div className="pk-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#334155' }}>
                  2. Módulos → 3. Submódulos → 4. Funcionalidades:
                </div>

                {svc.modules.map((mod) => {
                  const modOn = svcOn && modules.includes(mod.moduleKey);
                  const modSubmodules = (svc.submodules || []).filter((sm) => sm.dependsOnModule === mod.moduleKey);
                  const directModFeatures = (svc.features || []).filter(
                    (f) => f.dependsOnModule === mod.moduleKey && !f.dependsOnSubmodule
                  );

                  return (
                    <div
                      key={mod.moduleKey}
                      style={{
                        borderRadius: 9,
                        border: '1px solid #cbd5e1',
                        background: modOn ? '#ffffff' : '#f8fafc',
                        padding: 9,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 7,
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          borderRadius: 7,
                          background: modOn ? '#eff6ff' : '#f1f5f9',
                          cursor: svcOn ? 'pointer' : 'not-allowed',
                          fontSize: 12.5,
                          fontWeight: 800,
                        }}
                      >
                        <span>
                          <input
                            type="checkbox"
                            disabled={!svcOn}
                            checked={modOn}
                            onChange={() => toggleModule(svc.serviceKey, mod.moduleKey)}
                            style={{ marginRight: 8 }}
                          />
                          {mod.tabIcon} 2. {mod.displayName}
                        </span>
                        <span className={`pk-badge ${modOn ? 'pk-badge-blue' : 'pk-badge-slate'}`}>
                          {modOn ? 'Módulo Activo' : 'Inactivo'}
                        </span>
                      </label>

                      {modSubmodules.map((sm) => {
                        const subOn = modOn && submodules.includes(sm.submoduleKey);
                        const subFeatures = (svc.features || []).filter(
                          (f) => f.dependsOnSubmodule === sm.submoduleKey
                        );
                        return (
                          <div
                            key={sm.submoduleKey}
                            style={{
                              marginLeft: 14,
                              padding: '6px 9px',
                              borderRadius: 7,
                              borderLeft: subOn ? '3px solid #2563eb' : '3px solid #cbd5e1',
                              background: subOn ? '#f8fafc' : '#f1f5f9',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 5,
                            }}
                          >
                            <label
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: modOn ? 'pointer' : 'not-allowed',
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              <span>
                                <input
                                  type="checkbox"
                                  disabled={!modOn}
                                  checked={subOn}
                                  onChange={() =>
                                    toggleSubmodule(svc.serviceKey, mod.moduleKey, sm.submoduleKey)
                                  }
                                  style={{ marginRight: 7 }}
                                />
                                3. {sm.displayName}
                              </span>
                              <span className={`pk-badge ${subOn ? 'pk-badge-emerald' : 'pk-badge-slate'}`}>
                                {subOn ? 'Submódulo' : 'Inactivo'}
                              </span>
                            </label>

                            {subFeatures.map((feat) => {
                              const featOn = subOn && features.includes(feat.featureKey);
                              return (
                                <label
                                  key={feat.featureKey}
                                  style={{
                                    marginLeft: 16,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    border: '1px dashed #cbd5e1',
                                    background: featOn ? '#ecfdf5' : '#ffffff',
                                    opacity: subOn ? 1 : 0.6,
                                    cursor: subOn ? 'pointer' : 'not-allowed',
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                  }}
                                >
                                  <span>
                                    <input
                                      type="checkbox"
                                      disabled={!subOn}
                                      checked={featOn}
                                      onChange={() =>
                                        toggleFeature(
                                          svc.serviceKey,
                                          feat.dependsOnModule,
                                          feat.dependsOnSubmodule,
                                          feat.featureKey
                                        )
                                      }
                                      style={{ marginRight: 7 }}
                                    />
                                    4. {feat.displayName}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        );
                      })}

                      {directModFeatures.map((feat) => {
                        const featOn = modOn && features.includes(feat.featureKey);
                        return (
                          <label
                            key={feat.featureKey}
                            style={{
                              marginLeft: 14,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '5px 8px',
                              borderRadius: 6,
                              border: '1px dashed #cbd5e1',
                              background: featOn ? '#ecfdf5' : '#ffffff',
                              opacity: modOn ? 1 : 0.6,
                              cursor: modOn ? 'pointer' : 'not-allowed',
                              fontSize: 11.5,
                              fontWeight: 600,
                            }}
                          >
                            <span>
                              <input
                                type="checkbox"
                                disabled={!modOn}
                                checked={featOn}
                                onChange={() =>
                                  toggleFeature(
                                    svc.serviceKey,
                                    feat.dependsOnModule,
                                    feat.dependsOnSubmodule,
                                    feat.featureKey
                                  )
                                }
                                style={{ marginRight: 7 }}
                              />
                              4. {feat.displayName}
                            </span>
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

      <PkModal
        open={showCreateModal}
        title="Aprovisionamiento Corporativo de Nueva Empresa"
        onClose={() => setShowCreateModal(false)}
      >
        <form onSubmit={handleCreateTenantSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="pk-form-grid">
            <div className="pk-field">
              <label htmlFor="sa-new-company">Razón Social</label>
              <input
                id="sa-new-company"
                required
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder="Ej. Distribuidora Central S.A.S."
              />
            </div>
            <div className="pk-field">
              <label htmlFor="sa-new-nit">NIT Tributario</label>
              <input
                id="sa-new-nit"
                required
                value={newNit}
                onChange={(e) => setNewNit(e.target.value)}
                placeholder="901.555.210-3"
              />
            </div>
            <div className="pk-field">
              <label htmlFor="sa-new-email">Correo del Administrador Cliente</label>
              <input
                id="sa-new-email"
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="gerencia@empresa.com"
              />
            </div>
            <div className="pk-field">
              <label htmlFor="sa-new-pass">Contraseña Inicial (mínimo 8 caracteres)</label>
              <input
                id="sa-new-pass"
                type="password"
                minLength={8}
                required
                value={newAdminPass}
                onChange={(e) => setNewAdminPass(e.target.value)}
                placeholder="Contraseña segura"
              />
            </div>
            <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="sa-new-preset">Plantilla Inicial de Operación</label>
              <select
                id="sa-new-preset"
                value={newPreset}
                onChange={(e) => setNewPreset(e.target.value)}
              >
                <option value="full">Suite Empresarial Completa (Todos los Servicios)</option>
                <option value="comercio">Comercio, Inventario y Facturación</option>
                <option value="automotriz">Centro Automotriz y Taller</option>
                <option value="hospitalidad">Hotelería y Gastronomía</option>
                <option value="logistica">Logística Pesada y Báscula</option>
              </select>
            </div>
          </div>
          <div className="pk-row-actions" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="pk-btn pk-btn-emerald" disabled={busy}>
              {busy ? 'Aprovisionando...' : 'Crear Empresa y Base Aislada'}
            </button>
          </div>
        </form>
      </PkModal>
    </div>
  );
};
