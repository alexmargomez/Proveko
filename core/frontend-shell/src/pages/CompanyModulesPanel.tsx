import React from 'react';
import { formatCop, PkKpiRow, useAsyncAction, usePlatform } from '@platform/ui-sdk';
import { PkIcon } from '../components/ServiceIcons';

export const CompanyModulesPanel: React.FC = () => {
  const {
    catalog,
    companyTenant,
    tenant,
    isDemo,
    role,
    pricingCop,
    apiPost,
    refreshBootstrap,
    navigateTo,
    logout,
    setPublicView,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

  const current = companyTenant || tenant;
  const extraSvcPrice = pricingCop?.extraServiceCop || 35000;
  const demoReadOnly = isDemo && role !== 'superadmin';

  const activateCapability = (payload: {
    addServices?: string[];
    addModules?: string[];
    addSubmodules?: string[];
    addFeatures?: string[];
    label: string;
  }) => {
    void run(async () => {
      await apiPost('/api/v1/core/company/activate-modules', {
        addServices: payload.addServices || [],
        addModules: payload.addModules || [],
        addSubmodules: payload.addSubmodules || [],
        addFeatures: payload.addFeatures || [],
      });
      await refreshBootstrap();
      toast(`Habilitado en tu empresa: ${payload.label}`);
    });
  };

  return (
    <div>
      <div className="pk-ws-header">
        <div className="pk-ws-title-row" style={{ paddingBottom: 12 }}>
          <div>
            <h1 className="pk-ws-title">
              <PkIcon name="modules" size={22} />
              <span>Activar Módulos y Ampliar Soluciones</span>
            </h1>
            <div style={{ fontSize: 12.5, color: 'var(--pk-muted)', marginTop: 4 }}>
              Habilita nuevas áreas operativas, secciones o funcionalidades adicionales para {current?.companyName} de inmediato.
            </div>
          </div>
        </div>
      </div>

      <div className="pk-stage">
        {demoReadOnly && (
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 10,
              padding: '11px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              fontSize: 12.5,
              color: '#1e3a8a',
            }}
          >
            <span>
              <strong>Modo Demostración Activo:</strong> En esta empresa de demostración todas las áreas ya están disponibles para explorar y la modificación del plan está protegida. Registra tu empresa para personalizar y ampliar tus propios módulos.
            </span>
            <button
              type="button"
              className="pk-btn pk-btn-primary pk-btn-sm"
              onClick={() => {
                void (async () => {
                  await logout();
                  setPublicView('register');
                })();
              }}
            >
              Crear Cuenta para mi Empresa →
            </button>
          </div>
        )}
        <PkKpiRow
          items={[
            {
              label: 'Áreas Activas en tu Empresa',
              value: `${current?.activeServices.length || 0} de ${catalog.length}`,
            },
            {
              label: 'Secciones Habilitadas',
              value: String(current?.activeModules.length || 0),
            },
            {
              label: 'Estado de Suscripción',
              value: 'Suscripción Activa',
              color: 'var(--pk-emerald)',
            },
            {
              label: 'Valor Mensual Estimado',
              value: `${formatCop(current?.monthlyCop || 169000)}/mes`,
              color: 'var(--pk-primary)',
            },
          ]}
        />

        <div className="pk-plan-grid">
          {catalog.map((svc) => {
            const svcActive = Boolean(current?.activeServices.includes(svc.serviceKey));
            const inactiveMods = (svc.modules || []).filter(
              (m) => !current?.activeModules.includes(m.moduleKey)
            );
            const inactiveFeats = (svc.features || []).filter(
              (f) =>
                current?.activeModules.includes(f.dependsOnModule) &&
                (!f.dependsOnSubmodule || current?.activeSubmodules?.includes(f.dependsOnSubmodule)) &&
                !current?.activeFeatures.includes(f.featureKey)
            );

            return (
              <div
                key={svc.serviceKey}
                className={`pk-plan-card ${svcActive ? 'selected' : ''}`}
              >
                <div>
                  <div className="pk-row-between" style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 9,
                          background: svcActive ? '#dbeafe' : '#f1f5f9',
                          color: svcActive ? 'var(--pk-primary)' : '#475569',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <PkIcon name={svc.serviceKey} size={19} />
                      </span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--pk-navy)' }}>
                          {svc.displayName}
                        </div>
                        <span className="pk-badge pk-badge-slate">{svc.category}</span>
                      </div>
                    </div>
                    {svcActive ? (
                      <span className="pk-badge pk-badge-emerald">Activa</span>
                    ) : (
                      <span className="pk-badge pk-badge-blue">+{formatCop(extraSvcPrice)}/mes</span>
                    )}
                  </div>

                  <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--pk-muted)', lineHeight: 1.45 }}>
                    {svc.summary}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(svc.modules || []).map((mod) => {
                      const modOn = Boolean(current?.activeModules.includes(mod.moduleKey));
                      return (
                        <div
                          key={mod.moduleKey}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '6px 10px',
                            fontSize: 12,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#334155' }}>{mod.displayName}</span>
                          {modOn ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--pk-emerald)' }}>
                              Incluida ✓
                            </span>
                          ) : svcActive ? (
                            <button
                              type="button"
                              className="pk-btn pk-btn-outline pk-btn-sm"
                              disabled={busy || demoReadOnly}
                              onClick={() =>
                                activateCapability({
                                  addModules: [mod.moduleKey],
                                  label: mod.displayName,
                                })
                              }
                            >
                              + Activar sección
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>Disponible</span>
                          )}
                        </div>
                      );
                    })}

                    {svcActive &&
                      inactiveFeats.map((feat) => (
                        <div
                          key={feat.featureKey}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: 8,
                            padding: '6px 10px',
                            fontSize: 11.5,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: '#92400e' }}>
                            Función adicional: {feat.displayName}
                          </span>
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            disabled={busy || demoReadOnly}
                            onClick={() =>
                              activateCapability({
                                addFeatures: [feat.featureKey],
                                label: feat.displayName,
                              })
                            }
                          >
                            + Habilitar
                          </button>
                        </div>
                      ))}
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  {svcActive ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => navigateTo(svc.serviceKey)}
                      >
                        Ir a {svc.displayName}
                      </button>
                      {inactiveMods.length > 0 && (
                        <button
                          type="button"
                          className="pk-btn pk-btn-primary pk-btn-sm"
                          disabled={busy || demoReadOnly}
                          onClick={() =>
                            activateCapability({
                              addModules: inactiveMods.map((m) => m.moduleKey),
                              label: `Todas las secciones de ${svc.displayName}`,
                            })
                          }
                        >
                          Activar todo
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="pk-btn pk-btn-primary"
                      style={{ width: '100%' }}
                      disabled={busy || demoReadOnly}
                      onClick={() =>
                        activateCapability({
                          addServices: [svc.serviceKey],
                          label: svc.displayName,
                        })
                      }
                    >
                      + Activar {svc.displayName} en mi Empresa
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
