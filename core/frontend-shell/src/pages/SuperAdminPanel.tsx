import React, { useState, useEffect } from 'react';
import { useProveko, TenantRecord } from '@proveko/ui-sdk';

export const SuperAdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { catalog, tenantsList, tenant, apiPut, refreshBootstrap, loginWithToken, role, username, toast, setPublicView } = useProveko();

  const [selectedTenantId, setSelectedTenantId] = useState<string>(tenant?.tenantId || 'demo-empresa');
  const [services, setServices] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);

  const selectedTenant = tenantsList.find((t) => t.tenantId === selectedTenantId) || tenant;

  useEffect(() => {
    if (selectedTenant) {
      setServices(selectedTenant.activeServices || []);
      setModules(selectedTenant.activeModules || []);
      setFeatures(selectedTenant.activeFeatures || []);
    }
  }, [selectedTenantId, selectedTenant]);

  const toggleService = (serviceKey: string) => {
    const svc = catalog.find((s) => s.serviceKey === serviceKey);
    if (!svc) return;
    if (services.includes(serviceKey)) {
      const svcModKeys = svc.modules.map((m) => m.moduleKey);
      const svcFeatKeys = (svc.features || []).map((f) => f.featureKey);
      setServices((prev) => prev.filter((k) => k !== serviceKey));
      setModules((prev) => prev.filter((k) => !svcModKeys.includes(k)));
      setFeatures((prev) => prev.filter((k) => !svcFeatKeys.includes(k)));
    } else {
      setServices((prev) => [...prev, serviceKey]);
      setModules((prev) => Array.from(new Set([...prev, ...svc.modules.map((m) => m.moduleKey)])));
      setFeatures((prev) => Array.from(new Set([...prev, ...(svc.features || []).map((f) => f.featureKey)])));
    }
  };

  // Si se desactiva un módulo (ej: facturas_taller), apaga automáticamente todas las funcionalidades que dependen de él!
  const toggleModule = (serviceKey: string, moduleKey: string) => {
    if (!services.includes(serviceKey)) return;
    const svc = catalog.find((s) => s.serviceKey === serviceKey);
    if (modules.includes(moduleKey)) {
      const dependentFeats = (svc?.features || [])
        .filter((f) => f.dependsOnModule === moduleKey)
        .map((f) => f.featureKey);
      setModules((prev) => prev.filter((m) => m !== moduleKey));
      setFeatures((prev) => prev.filter((f) => !dependentFeats.includes(f)));
    } else {
      setModules((prev) => [...prev, moduleKey]);
    }
  };

  const toggleFeature = (serviceKey: string, dependsOnModule: string, featureKey: string) => {
    if (!services.includes(serviceKey)) return;
    if (dependsOnModule && !modules.includes(dependsOnModule)) {
      toast(`Primero debes activar el módulo "${dependsOnModule}" para usar esta funcionalidad.`);
      return;
    }
    if (features.includes(featureKey)) {
      setFeatures((prev) => prev.filter((f) => f !== featureKey));
    } else {
      setFeatures((prev) => [...prev, featureKey]);
    }
  };

  const handleSaveSubscriptions = async () => {
    const res = await apiPut<{ tenant: TenantRecord }>(`/api/v1/core/tenants/${selectedTenantId}/subscriptions`, {
      activeServices: services,
      activeModules: modules,
      activeFeatures: features,
    });
    await refreshBootstrap();
    if (tenant?.tenantId === res.tenant.tenantId) {
      loginWithToken('', role, username, res.tenant);
    }
    toast(`Licencias guardadas para ${res.tenant.companyName} (${res.tenant.dbName})`);
  };

  return (
    <div>
      <div className="pk-card">
        <div className="pk-card-head">
          <div>
            <div className="pk-card-title">⚙️ Control Maestro de Empresas, Bases de Datos y Licencias de 4 Niveles</div>
            <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 3 }}>
              Activa o desactiva por cliente: <strong>1. Microservicios independientes</strong> → <strong>2. Módulos internos</strong> → <strong>3. Funcionalidades independientes o dependientes del módulo</strong>.
            </div>
          </div>
          <div className="pk-row-actions">
            <button type="button" className="pk-btn pk-btn-emerald" onClick={() => setPublicView('register')}>
              ➕ Crear Nueva Empresa (Nueva BD)
            </button>
            <button type="button" className="pk-btn pk-btn-primary" onClick={handleSaveSubscriptions}>
              💾 Guardar Cambios de Licencia
            </button>
            <button type="button" className="pk-btn pk-btn-outline" onClick={onClose}>
              Volver a Operación
            </button>
          </div>
        </div>

        <div className="pk-card-body">
          <div className="pk-form-grid">
            <div className="pk-field">
              <label>Seleccionar Empresa Cliente</label>
              <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)}>
                {tenantsList.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>
                    {t.companyName} — NIT {t.nit} — BD PostgreSQL: {t.dbName}
                  </option>
                ))}
              </select>
            </div>
            {selectedTenant && (
              <div className="pk-field">
                <label>Base de Datos PostgreSQL Aislada</label>
                <input readOnly value={selectedTenant.dbName} style={{ background: '#f1f5f9', fontWeight: 800 }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pk-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(410px, 1fr))' }}>
        {catalog.map((svc) => {
          const svcOn = services.includes(svc.serviceKey);
          return (
            <div className="pk-card" key={svc.serviceKey} style={{ marginBottom: 0, opacity: svcOn ? 1 : 0.72 }}>
              <div className="pk-card-head" style={{ background: svcOn ? '#f8fafc' : '#f1f5f9' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>
                  <input type="checkbox" checked={svcOn} onChange={() => toggleService(svc.serviceKey)} />
                  <span>{svc.icon} {svc.displayName}</span>
                </label>
                <span className={`pk-badge ${svcOn ? 'pk-badge-emerald' : 'pk-badge-slate'}`}>
                  {svcOn ? 'Microservicio Activo' : 'Apagado'}
                </span>
              </div>

              <div className="pk-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#334155' }}>Módulos dentro del Microservicio:</div>
                {svc.modules.map((mod) => {
                  const modOn = svcOn && modules.includes(mod.moduleKey);
                  return (
                    <label
                      key={mod.moduleKey}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: modOn ? '#eff6ff' : '#ffffff',
                        cursor: svcOn ? 'pointer' : 'not-allowed',
                        fontSize: 12.5,
                        fontWeight: 700,
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
                        {mod.tabIcon} {mod.displayName}
                      </span>
                      <span className="pk-badge pk-badge-slate">{mod.moduleKey}</span>
                    </label>
                  );
                })}

                {svc.features && svc.features.length > 0 && (
                  <>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#334155', marginTop: 4 }}>
                      Funcionalidades Granulares:
                    </div>
                    {svc.features.map((feat) => {
                      const parentModOk = !feat.dependsOnModule || modules.includes(feat.dependsOnModule);
                      const featEnabled = svcOn && parentModOk;
                      const featOn = featEnabled && features.includes(feat.featureKey);
                      return (
                        <label
                          key={feat.featureKey}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            padding: '7px 10px',
                            borderRadius: 8,
                            border: '1px dashed #cbd5e1',
                            background: featOn ? '#ecfdf5' : '#f8fafc',
                            opacity: featEnabled ? 1 : 0.55,
                            cursor: featEnabled ? 'pointer' : 'not-allowed',
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700 }}>
                            <span>
                              <input
                                type="checkbox"
                                disabled={!featEnabled}
                                checked={featOn}
                                onChange={() => toggleFeature(svc.serviceKey, feat.dependsOnModule, feat.featureKey)}
                                style={{ marginRight: 8 }}
                              />
                              ⚡ {feat.displayName}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--pk-muted)', paddingLeft: 22 }}>
                            {feat.dependsOnModule
                              ? `Depende del módulo: ${feat.dependsOnModule} ${parentModOk ? '(Activo)' : '🔒 (Inactivo — activa el módulo primero)'}`
                              : 'Funcionalidad independiente del microservicio'}
                          </div>
                        </label>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
