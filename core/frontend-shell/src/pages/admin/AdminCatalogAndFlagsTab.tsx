import React, { useCallback, useEffect, useState } from 'react';
import { BusinessPresetSpec, PricingMatrixCOP, ServiceManifest, usePlatform } from '@platform/ui-sdk';

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

export const AdminCatalogAndFlagsTab: React.FC = () => {
  const { apiGet, apiPut, apiDelete, hasPlatformPermission, toast } = usePlatform();
  const [services, setServices] = useState<ServiceManifest[]>([]);
  const [presets, setPresets] = useState<BusinessPresetSpec[]>([]);
  const [overrides, setOverrides] = useState<CatalogOverrides>({ services: {}, presets: {} });
  const [pricing, setPricing] = useState<PricingMatrixCOP>({
    extraServiceCop: 35000,
    extraModuleCop: 15000,
    extraSubmoduleCop: 9000,
    extraFeatureCop: 5000,
  });
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [newFlag, setNewFlag] = useState({ flagKey: '', displayName: '', description: '', enabledGlobal: false, enabledTenants: '' });
  const [saving, setSaving] = useState(false);

  const canEditCatalog = hasPlatformPermission('catalogo.editar_visibilidad') || hasPlatformPermission('catalogo.editar_precios');
  const canEditFlags = hasPlatformPermission('catalogo.feature_flags');

  const load = useCallback(async () => {
    const [catResp, flagsResp] = await Promise.all([
      apiGet<{ catalog: ServiceManifest[]; presets: BusinessPresetSpec[]; pricing: PricingMatrixCOP; overrides: CatalogOverrides }>('/api/v1/admin/catalog'),
      apiGet<{ flags: FeatureFlag[] }>('/api/v1/admin/feature-flags'),
    ]);
    setServices(catResp.catalog || []);
    setPresets(catResp.presets || []);
    setOverrides({
      services: catResp.overrides?.services || {},
      presets: catResp.overrides?.presets || {},
      pricing: catResp.overrides?.pricing,
    });
    setPricing(catResp.overrides?.pricing || catResp.pricing || pricing);
    setFlags(flagsResp.flags || []);
  }, [apiGet]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleServiceVisibility = (serviceKey: string, field: 'visibleInStore' | 'publiclySellable') => {
    const cur = overrides.services[serviceKey] || { serviceKey, visibleInStore: true, publiclySellable: true };
    setOverrides((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        [serviceKey]: { ...cur, [field]: !cur[field] },
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

  const saveCatalogOverrides = async () => {
    setSaving(true);
    try {
      await apiPut('/api/v1/admin/catalog/overrides', {
        services: overrides.services,
        presets: overrides.presets,
        pricing,
      });
      toast('Catálogo comercial y precios guardados');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiPut('/api/v1/admin/feature-flags', {
      flagKey: newFlag.flagKey.trim(),
      displayName: newFlag.displayName.trim() || newFlag.flagKey.trim(),
      description: newFlag.description.trim(),
      enabledGlobal: newFlag.enabledGlobal,
      enabledTenants: newFlag.enabledTenants.split(',').map((s) => s.trim()).filter(Boolean),
      disabledTenants: [],
    });
    setNewFlag({ flagKey: '', displayName: '', description: '', enabledGlobal: false, enabledTenants: '' });
    toast('Feature flag actualizado');
    await load();
  };

  const toggleGlobalFlag = async (flag: FeatureFlag) => {
    await apiPut('/api/v1/admin/feature-flags', { ...flag, enabledGlobal: !flag.enabledGlobal });
    toast(`Flag ${flag.flagKey} ${!flag.enabledGlobal ? 'activado' : 'desactivado'} globalmente`);
    await load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">Gobierno del Catálogo Comercial (Visibilidad y Precios)</div>
          {canEditCatalog && (
            <button type="button" className="pk-btn pk-btn-primary pk-btn-sm" disabled={saving} onClick={() => void saveCatalogOverrides()}>
              {saving ? 'Guardando...' : 'Guardar Cambios del Catálogo'}
            </button>
          )}
        </div>
        <div className="pk-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div>
              <label className="pk-label">Servicio Adicional (COP)</label>
              <input type="number" className="pk-input" disabled={!canEditCatalog} value={pricing.extraServiceCop}
                onChange={(e) => setPricing({ ...pricing, extraServiceCop: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="pk-label">Módulo Adicional (COP)</label>
              <input type="number" className="pk-input" disabled={!canEditCatalog} value={pricing.extraModuleCop}
                onChange={(e) => setPricing({ ...pricing, extraModuleCop: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="pk-label">Submódulo Adicional (COP)</label>
              <input type="number" className="pk-input" disabled={!canEditCatalog} value={pricing.extraSubmoduleCop}
                onChange={(e) => setPricing({ ...pricing, extraSubmoduleCop: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="pk-label">Función Adicional (COP)</label>
              <input type="number" className="pk-input" disabled={!canEditCatalog} value={pricing.extraFeatureCop}
                onChange={(e) => setPricing({ ...pricing, extraFeatureCop: Number(e.target.value) || 0 })} />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Microservicio</th>
                  <th>Clave</th>
                  <th>Visible en Tienda</th>
                  <th>Vendible Públicamente</th>
                </tr>
              </thead>
              <tbody>
                {services.map((svc) => {
                  const ov = overrides.services[svc.serviceKey] || { serviceKey: svc.serviceKey, visibleInStore: true, publiclySellable: true };
                  return (
                    <tr key={svc.serviceKey}>
                      <td><strong>{svc.displayName}</strong></td>
                      <td><code>{svc.serviceKey}</code></td>
                      <td>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: canEditCatalog ? 'pointer' : 'default' }}>
                          <input type="checkbox" disabled={!canEditCatalog} checked={ov.visibleInStore}
                            onChange={() => toggleServiceVisibility(svc.serviceKey, 'visibleInStore')} />
                          <span>{ov.visibleInStore ? 'Visible' : 'Oculto'}</span>
                        </label>
                      </td>
                      <td>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: canEditCatalog ? 'pointer' : 'default' }}>
                          <input type="checkbox" disabled={!canEditCatalog} checked={ov.publiclySellable}
                            onChange={() => toggleServiceVisibility(svc.serviceKey, 'publiclySellable')} />
                          <span>{ov.publiclySellable ? 'En venta' : 'Solo asignación manual'}</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Paquete / Preset</th>
                  <th>Precio Base (COP)</th>
                  <th>Precio Personalizado (COP)</th>
                  <th>Visible en Registro</th>
                </tr>
              </thead>
              <tbody>
                {presets.map((pr) => {
                  const ov = overrides.presets[pr.key] || { presetKey: pr.key, visibleInStore: true, customMonthlyCop: 0 };
                  return (
                    <tr key={pr.key}>
                      <td><strong>{pr.name}</strong> <span style={{ fontSize: 11, color: 'var(--pk-muted)' }}>({pr.key})</span></td>
                      <td>${pr.baseMonthlyCop.toLocaleString('es-CO')}</td>
                      <td>
                        <input
                          type="number"
                          className="pk-input"
                          style={{ maxWidth: 160 }}
                          disabled={!canEditCatalog}
                          value={ov.customMonthlyCop || ''}
                          placeholder={String(pr.baseMonthlyCop)}
                          onChange={(e) => updatePresetOverride(pr.key, { customMonthlyCop: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <input type="checkbox" disabled={!canEditCatalog} checked={ov.visibleInStore}
                            onChange={() => updatePresetOverride(pr.key, { visibleInStore: !ov.visibleInStore })} />
                          <span>{ov.visibleInStore ? 'Activo' : 'Oculto'}</span>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">Feature Flags (Globales y por Empresa)</div>
        </div>
        <div className="pk-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {canEditFlags && (
            <form onSubmit={(e) => void handleSaveFlag(e)} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, alignItems: 'end' }}>
              <div>
                <label className="pk-label">Clave Flag</label>
                <input className="pk-input" required value={newFlag.flagKey} placeholder="ej: dian_v2_beta"
                  onChange={(e) => setNewFlag({ ...newFlag, flagKey: e.target.value })} />
              </div>
              <div>
                <label className="pk-label">Nombre</label>
                <input className="pk-input" value={newFlag.displayName} placeholder="Facturación DIAN v2"
                  onChange={(e) => setNewFlag({ ...newFlag, displayName: e.target.value })} />
              </div>
              <div>
                <label className="pk-label">Empresas (IDs separadas por coma)</label>
                <input className="pk-input" value={newFlag.enabledTenants} placeholder="ten_abc, demo-empresa"
                  onChange={(e) => setNewFlag({ ...newFlag, enabledTenants: e.target.value })} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}>
                <input type="checkbox" checked={newFlag.enabledGlobal} onChange={(e) => setNewFlag({ ...newFlag, enabledGlobal: e.target.checked })} />
                <span>Activo Global</span>
              </label>
              <button type="submit" className="pk-btn pk-btn-primary">Guardar Flag</button>
            </form>
          )}
          <table className="pk-table">
            <thead>
              <tr>
                <th>Flag</th>
                <th>Global</th>
                <th>Empresas Habilitadas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((f) => (
                <tr key={f.flagKey}>
                  <td><strong>{f.displayName}</strong><div><code style={{ fontSize: 11 }}>{f.flagKey}</code></div></td>
                  <td>
                    <span className={`pk-badge ${f.enabledGlobal ? 'pk-badge-emerald' : 'pk-badge-slate'}`}>
                      {f.enabledGlobal ? 'ON' : 'OFF'}
                    </span>
                  </td>
                  <td>{(f.enabledTenants || []).join(', ') || '—'}</td>
                  <td>
                    {canEditFlags && (
                      <div className="pk-row-actions">
                        <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void toggleGlobalFlag(f)}>
                          {f.enabledGlobal ? 'Apagar Global' : 'Encender Global'}
                        </button>
                        <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void apiDelete(`/api/v1/admin/feature-flags/${encodeURIComponent(f.flagKey)}`).then(load)}>
                          Eliminar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {flags.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>No hay feature flags configurados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
