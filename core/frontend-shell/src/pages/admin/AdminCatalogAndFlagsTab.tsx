import React, { useCallback, useEffect, useState } from 'react';
import {
  BusinessPresetSpec,
  PkModal,
  PricingMatrixCOP,
  ServiceManifest,
  TenantSummary,
  formatCop,
  useAsyncAction,
  usePlatform,
} from '@platform/ui-sdk';
import { PkIcon } from '../../components/ServiceIcons';
import { AdminSwitch } from './AdminSwitch';

interface ServiceOverride {
  serviceKey: string;
  publiclySellable: boolean;
  visibleInStore: boolean;
  customExtraCop?: number;
  customDisplayName?: string;
}

interface PresetOverride {
  presetKey: string;
  visibleInStore: boolean;
  customMonthlyCop?: number;
}

interface CatalogOverrides {
  services: Record<string, ServiceOverride>;
  presets: Record<string, PresetOverride>;
  pricing?: PricingMatrixCOP;
}

interface FeatureFlag {
  flagKey: string;
  displayName: string;
  description: string;
  enabledGlobal: boolean;
  enabledTenants: string[];
  disabledTenants: string[];
  updatedBy?: string;
  updatedAt?: string;
}

export const AdminCatalogAndFlagsTab: React.FC<{
  mode: 'catalog' | 'flags';
}> = ({ mode }) => {
  const { apiGet, apiPut, apiDelete, tenantsList, hasPlatformPermission, toast } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [services, setServices] = useState<ServiceManifest[]>([]);
  const [presets, setPresets] = useState<BusinessPresetSpec[]>([]);
  const [tenants, setTenants] = useState<TenantSummary[]>(tenantsList || []);
  const [overrides, setOverrides] = useState<CatalogOverrides>({ services: {}, presets: {} });
  const [pricing, setPricing] = useState<PricingMatrixCOP>({
    extraServiceCop: 35000,
    extraModuleCop: 15000,
    extraSubmoduleCop: 9000,
    extraFeatureCop: 5000,
  });

  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [flagForm, setFlagForm] = useState<FeatureFlag>({
    flagKey: '',
    displayName: '',
    description: '',
    enabledGlobal: false,
    enabledTenants: [],
    disabledTenants: [],
  });

  const canEditCatalog = hasPlatformPermission('catalogo.editar_visibilidad') || hasPlatformPermission('catalogo.editar_precios');
  const canEditFlags = hasPlatformPermission('catalogo.feature_flags');

  const load = useCallback(async () => {
    const [catResp, flagsResp, tenResp] = await Promise.all([
      apiGet<{ catalog: ServiceManifest[]; presets: BusinessPresetSpec[]; pricing: PricingMatrixCOP; overrides: CatalogOverrides }>('/api/v1/admin/catalog'),
      apiGet<{ flags: FeatureFlag[] }>('/api/v1/admin/feature-flags'),
      hasPlatformPermission('empresas.ver')
        ? apiGet<{ tenants: TenantSummary[] }>('/api/v1/admin/tenants').catch(() => ({ tenants: tenantsList || [] }))
        : Promise.resolve({ tenants: tenantsList || [] }),
    ]);
    setServices(catResp.catalog || []);
    setPresets(catResp.presets || []);
    setTenants(tenResp.tenants || []);
    setOverrides({
      services: catResp.overrides?.services || {},
      presets: catResp.overrides?.presets || {},
      pricing: catResp.overrides?.pricing,
    });
    if (catResp.overrides?.pricing || catResp.pricing) {
      setPricing(catResp.overrides?.pricing || catResp.pricing);
    }
    setFlags(flagsResp.flags || []);
  }, [apiGet, hasPlatformPermission, tenantsList]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateServiceOverride = (serviceKey: string, patch: Partial<ServiceOverride>) => {
    const cur = overrides.services[serviceKey] || { serviceKey, visibleInStore: true, publiclySellable: true };
    setOverrides((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        [serviceKey]: { ...cur, ...patch },
      },
    }));
  };

  const updatePresetOverride = (presetKey: string, patch: Partial<PresetOverride>) => {
    const cur = overrides.presets[presetKey] || { presetKey, visibleInStore: true };
    setOverrides((prev) => ({
      ...prev,
      presets: {
        ...prev.presets,
        [presetKey]: { ...cur, ...patch },
      },
    }));
  };

  if (mode === 'flags') {
    return (
      <div className="pk-stack">
        <div className="pk-card">
          <div className="pk-card-head">
            <div>
              <div className="pk-card-title">Feature Flags y Despliegue Progresivo ({flags.length})</div>
              <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
                Activa funcionalidades en beta de forma global o únicamente para empresas piloto seleccionadas.
              </div>
            </div>
            {canEditFlags && (
              <button
                type="button"
                className="pk-btn pk-btn-primary"
                onClick={() => {
                  setFlagForm({
                    flagKey: '',
                    displayName: '',
                    description: '',
                    enabledGlobal: false,
                    enabledTenants: [],
                    disabledTenants: [],
                  });
                  setFlagModalOpen(true);
                }}
              >
                + Nuevo Feature Flag
              </button>
            )}
          </div>

          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Funcionalidad / Clave</th>
                  <th>Switch Global</th>
                  <th>Empresas Piloto Habilitadas</th>
                  <th>Actualizado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((f) => (
                  <tr key={f.flagKey}>
                    <td>
                      <strong>{f.displayName}</strong>
                      <div><code style={{ fontSize: 11 }}>{f.flagKey}</code></div>
                      {f.description && <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>{f.description}</div>}
                    </td>
                    <td>
                      <AdminSwitch
                        checked={f.enabledGlobal}
                        disabled={!canEditFlags || busy}
                        tone="emerald"
                        onChange={(next) =>
                          void run(async () => {
                            await apiPut('/api/v1/admin/feature-flags', { ...f, enabledGlobal: next });
                            await load();
                            toast(`Flag ${f.flagKey}: ${next ? 'Activado globalmente' : 'Apagado globalmente'}`);
                          })
                        }
                        label={f.enabledGlobal ? 'Activo Global' : 'Solo Pilotos'}
                      />
                    </td>
                    <td>
                      {(f.enabledTenants || []).length === 0 ? (
                        <span style={{ color: 'var(--pk-muted)' }}>Ninguna específica</span>
                      ) : (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {f.enabledTenants.map((tid) => {
                            const name = tenants.find((t) => t.tenantId === tid)?.companyName || tid;
                            return <span key={tid} className="pk-badge pk-badge-blue">{name}</span>;
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--pk-muted)' }}>
                      {f.updatedAt ? f.updatedAt.slice(0, 19).replace('T', ' ') : '—'}
                    </td>
                    <td>
                      {canEditFlags && (
                        <div className="pk-row-actions">
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            onClick={() => {
                              setFlagForm({ ...f, enabledTenants: [...(f.enabledTenants || [])] });
                              setFlagModalOpen(true);
                            }}
                          >
                            Editar Empresas
                          </button>
                          <button
                            type="button"
                            className="pk-btn pk-btn-danger pk-btn-sm"
                            onClick={() =>
                              void run(async () => {
                                await apiDelete(`/api/v1/admin/feature-flags/${encodeURIComponent(f.flagKey)}`);
                                await load();
                                toast('Feature flag eliminado');
                              })
                            }
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {flags.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--pk-muted)' }}>
                      No hay feature flags creados todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <PkModal open={flagModalOpen} title="Configurar Feature Flag" onClose={() => setFlagModalOpen(false)} maxWidth={600}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await apiPut('/api/v1/admin/feature-flags', flagForm);
                setFlagModalOpen(false);
                await load();
                toast('Feature flag guardado');
              });
            }}
            className="pk-stack"
          >
            <div className="pk-form-grid cols-2">
              <div className="pk-field">
                <label>Clave Técnica</label>
                <input
                  required
                  value={flagForm.flagKey}
                  onChange={(e) => setFlagForm({ ...flagForm, flagKey: e.target.value })}
                  placeholder="ej: nuevo_motor_pos"
                />
              </div>
              <div className="pk-field">
                <label>Nombre Descriptivo</label>
                <input
                  required
                  value={flagForm.displayName}
                  onChange={(e) => setFlagForm({ ...flagForm, displayName: e.target.value })}
                  placeholder="Ej. Nuevo Motor POS Rápido"
                />
              </div>
            </div>
            <div className="pk-field">
              <label>Descripción</label>
              <input
                value={flagForm.description}
                onChange={(e) => setFlagForm({ ...flagForm, description: e.target.value })}
                placeholder="Propósito técnico o comercial del flag..."
              />
            </div>

            <AdminSwitch
              checked={flagForm.enabledGlobal}
              tone="emerald"
              onChange={(next) => setFlagForm({ ...flagForm, enabledGlobal: next })}
              label="Activar para TODAS las empresas globalmente"
            />

            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--pk-border)', borderRadius: 8, padding: 10 }}>
              <div className="pk-label">Empresas Piloto Habilitadas Individualmente</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                {tenants.map((t) => (
                  <label key={t.tenantId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                    <input
                      type="checkbox"
                      checked={flagForm.enabledTenants.includes(t.tenantId)}
                      onChange={(e) =>
                        setFlagForm((prev) => ({
                          ...prev,
                          enabledTenants: e.target.checked
                            ? [...prev.enabledTenants, t.tenantId]
                            : prev.enabledTenants.filter((id) => id !== t.tenantId),
                        }))
                      }
                    />
                    <span>{t.companyName}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pk-form-actions">
              <button type="button" className="pk-btn pk-btn-outline" onClick={() => setFlagModalOpen(false)}>Cancelar</button>
              <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>Guardar Flag</button>
            </div>
          </form>
        </PkModal>
      </div>
    );
  }

  // COMMERCIAL CATALOG & PRICING VIEW
  return (
    <div className="pk-stack">
      <div className="pk-card">
        <div className="pk-card-head">
          <div>
            <div className="pk-card-title">Tarifas Unitarias de Ampliación de Plan (COP)</div>
            <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
              Valores aplicados cuando un cliente activa servicios, módulos o funciones adicionales desde su estación o registro público.
            </div>
          </div>
          {canEditCatalog && (
            <button
              type="button"
              className="pk-btn pk-btn-primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await apiPut('/api/v1/admin/catalog/overrides', {
                    services: overrides.services,
                    presets: overrides.presets,
                    pricing,
                  });
                  await load();
                  toast('Catálogo comercial, visibilidad y tarifas actualizados');
                })
              }
            >
              {busy ? 'Guardando...' : 'Publicar Cambios del Catálogo'}
            </button>
          )}
        </div>
        <div className="pk-card-body">
          <div className="pk-form-grid cols-2">
            <div className="pk-field">
              <label>Microservicio Adicional (COP / mes)</label>
              <input
                type="number"
                disabled={!canEditCatalog}
                value={pricing.extraServiceCop}
                onChange={(e) => setPricing({ ...pricing, extraServiceCop: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="pk-field">
              <label>Módulo Adicional (COP / mes)</label>
              <input
                type="number"
                disabled={!canEditCatalog}
                value={pricing.extraModuleCop}
                onChange={(e) => setPricing({ ...pricing, extraModuleCop: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="pk-field">
              <label>Submódulo Adicional (COP / mes)</label>
              <input
                type="number"
                disabled={!canEditCatalog}
                value={pricing.extraSubmoduleCop}
                onChange={(e) => setPricing({ ...pricing, extraSubmoduleCop: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="pk-field">
              <label>Funcionalidad Adicional (COP / mes)</label>
              <input
                type="number"
                disabled={!canEditCatalog}
                value={pricing.extraFeatureCop}
                onChange={(e) => setPricing({ ...pricing, extraFeatureCop: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">Visibilidad Comercial por Microservicio ({services.length})</div>
        </div>
        <div className="pk-table-wrap">
          <table className="pk-table">
            <thead>
              <tr>
                <th>Microservicio</th>
                <th>Nombre Comercial Mostrado</th>
                <th>Categoría / Capacidad</th>
                <th>Visible en Tienda</th>
                <th>Venta Pública Autoservicio</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => {
                const ov = overrides.services[svc.serviceKey] || {
                  serviceKey: svc.serviceKey,
                  visibleInStore: true,
                  publiclySellable: true,
                  customDisplayName: '',
                };
                return (
                  <tr key={svc.serviceKey}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PkIcon name={svc.serviceKey} size={18} />
                        <div>
                          <strong>{svc.displayName}</strong>
                          <div><code style={{ fontSize: 11 }}>{svc.serviceKey}</code></div>
                        </div>
                      </div>
                    </td>
                    <td style={{ minWidth: 210 }}>
                      <div className="pk-field">
                        <input
                          disabled={!canEditCatalog}
                          value={ov.customDisplayName || ''}
                          placeholder={svc.displayName}
                          onChange={(e) => updateServiceOverride(svc.serviceKey, { customDisplayName: e.target.value })}
                        />
                      </div>
                    </td>
                    <td>
                      <span className="pk-badge pk-badge-slate">{svc.category}</span>
                      <div style={{ fontSize: 11, color: 'var(--pk-muted)', marginTop: 2 }}>
                        {svc.modules.length} módulos · {(svc.features || []).length} funciones
                      </div>
                    </td>
                    <td>
                      <AdminSwitch
                        checked={ov.visibleInStore}
                        disabled={!canEditCatalog}
                        tone="emerald"
                        onChange={(next) => updateServiceOverride(svc.serviceKey, { visibleInStore: next })}
                        label={ov.visibleInStore ? 'Visible' : 'Oculto'}
                      />
                    </td>
                    <td>
                      <AdminSwitch
                        checked={ov.publiclySellable}
                        disabled={!canEditCatalog}
                        onChange={(next) => updateServiceOverride(svc.serviceKey, { publiclySellable: next })}
                        label={ov.publiclySellable ? 'Habilitada' : 'Solo SuperAdmin'}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">Paquetes Comerciales por Giro de Negocio ({presets.length})</div>
        </div>
        <div className="pk-table-wrap">
          <table className="pk-table">
            <thead>
              <tr>
                <th>Paquete Empresarial</th>
                <th className="pk-num">Tarifa Base Oficial</th>
                <th>Tarifa Personalizada (COP)</th>
                <th>Visible en Registro</th>
              </tr>
            </thead>
            <tbody>
              {presets.map((pr) => {
                const ov = overrides.presets[pr.key] || { presetKey: pr.key, visibleInStore: true, customMonthlyCop: 0 };
                return (
                  <tr key={pr.key}>
                    <td>
                      <strong>{pr.name}</strong> <span className="pk-badge pk-badge-blue">{pr.badge}</span>
                      <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', marginTop: 2 }}>{pr.description}</div>
                    </td>
                    <td className="pk-num">{formatCop(pr.baseMonthlyCop)}</td>
                    <td style={{ maxWidth: 190 }}>
                      <div className="pk-field">
                        <input
                          type="number"
                          disabled={!canEditCatalog}
                          value={ov.customMonthlyCop || ''}
                          placeholder={String(pr.baseMonthlyCop)}
                          onChange={(e) => updatePresetOverride(pr.key, { customMonthlyCop: Number(e.target.value) || 0 })}
                        />
                      </div>
                    </td>
                    <td>
                      <AdminSwitch
                        checked={ov.visibleInStore}
                        disabled={!canEditCatalog}
                        tone="emerald"
                        onChange={(next) => updatePresetOverride(pr.key, { visibleInStore: next })}
                        label={ov.visibleInStore ? 'Publicado' : 'Oculto'}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
