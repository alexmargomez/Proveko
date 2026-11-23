import React, { useEffect, useMemo, useState } from 'react';
import {
  BusinessPresetSpec,
  formatCop,
  PkModal,
  TenantSummary,
  useAsyncAction,
  usePlatform,
} from '@platform/ui-sdk';
import { PkIcon } from '../components/ServiceIcons';
import { generateSecurePassword } from '../utils/password';

const FALLBACK_PRESETS: BusinessPresetSpec[] = [
  {
    key: 'comercio',
    name: 'Comercio, Tienda y Ferretería',
    badge: 'Comercio y Ventas',
    description: 'Punto de Venta POS, Inventario, Compras a Proveedores, Clientes y Cartera, Caja y Reportes.',
    baseMonthlyCop: 169000,
    includedServices: ['ms-facturacion', 'ms-inventario', 'ms-compras', 'ms-clientes', 'ms-caja', 'ms-reportes', 'ms-impresiones'],
  },
  {
    key: 'restaurante',
    name: 'Restaurante, Gastrobar y Cafetería',
    badge: 'Gastronomía',
    description: 'Mapa de Mesas, Comandas de Cocina y Barra, División de Cuentas, POS, Inventario y Caja.',
    baseMonthlyCop: 199000,
    includedServices: ['ms-comandas', 'ms-facturacion', 'ms-inventario', 'ms-compras', 'ms-clientes', 'ms-caja', 'ms-reportes', 'ms-impresiones'],
  },
  {
    key: 'automotriz',
    name: 'Centro Automotriz, Taller y Repuestos',
    badge: 'Taller y Repuestos',
    description: 'Recepción de Vehículos, Tablero de Órdenes, Comisiones de Técnicos, Bodega de Repuestos y POS.',
    baseMonthlyCop: 229000,
    includedServices: ['ms-taller', 'ms-inventario', 'ms-compras', 'ms-facturacion', 'ms-clientes', 'ms-caja', 'ms-reportes', 'ms-impresiones'],
  },
  {
    key: 'hotel',
    name: 'Hoteles, Cabañas, Clubes y Pasadías',
    badge: 'Hotelería y Turismo',
    description: 'Rack de Habitaciones, Check-In / Check-Out, Reservas, Restaurante, Taquilla y Facturación.',
    baseMonthlyCop: 229000,
    includedServices: ['ms-hoteleria', 'ms-taquilla', 'ms-comandas', 'ms-facturacion', 'ms-clientes', 'ms-caja', 'ms-reportes', 'ms-impresiones'],
  },
  {
    key: 'logistica',
    name: 'Agroindustria, Transporte de Carga y Báscula',
    badge: 'Pesaje y Flota',
    description: 'Pesaje Camionero (Bruto/Tara/Neto), Despachos, Bodegas, Compras, Tesorería, Contabilidad y Reportes.',
    baseMonthlyCop: 289000,
    includedServices: ['ms-bascula', 'ms-inventario', 'ms-compras', 'ms-facturacion', 'ms-caja', 'ms-clientes', 'ms-contabilidad', 'ms-reportes', 'ms-impresiones'],
  },
  {
    key: 'full',
    name: 'Suite Empresarial Integral Multi-Sede',
    badge: 'Suite Completa',
    description: 'Incluye todas las áreas operativas, administrativas, contables y de talento humano.',
    baseMonthlyCop: 389000,
    includedServices: [],
  },
];

export const RegistrationWizard: React.FC<{
  initialPresetKey?: string;
  onSwitchToLogin: () => void;
}> = ({ initialPresetKey, onSwitchToLogin }) => {
  const {
    catalog,
    businessPresets,
    pricingCop,
    role,
    apiPost,
    loginWithToken,
    refreshBootstrap,
    setPublicView,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

  const presets = businessPresets.length > 0 ? businessPresets : FALLBACK_PRESETS;
  const extraSvcCop = pricingCop?.extraServiceCop || 35000;

  const [step, setStep] = useState<1 | 2 | 3>(initialPresetKey ? 2 : 1);
  const [presetKey, setPresetKey] = useState<string>(initialPresetKey || 'comercio');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);

  const [companyName, setCompanyName] = useState('');
  const [nit, setNit] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass, setAdminPass] = useState(() => generateSecurePassword());
  const [showPass, setShowPass] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('PSE_EMPRESARIAL');

  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [provisionedResult, setProvisionedResult] = useState<{
    token: string;
    role: string;
    username: string;
    fullName: string;
    tenant: TenantSummary;
  } | null>(null);

  const activePreset = useMemo(
    () => presets.find((p) => p.key === presetKey) || presets[0],
    [presetKey, presets]
  );

  const syncServicesFromPreset = (targetPresetKey: string) => {
    setPresetKey(targetPresetKey);
    const found = presets.find((p) => p.key === targetPresetKey) || presets[0];
    const baseSvcs =
      found.key === 'full' || found.includedServices.length === 0
        ? catalog.map((s) => s.serviceKey)
        : found.includedServices;
    setSelectedServices(Array.from(new Set(baseSvcs)));

    const mods: string[] = [];
    for (const svc of catalog) {
      if (baseSvcs.includes(svc.serviceKey)) {
        for (const m of svc.modules) {
          if (m.defaultActive) mods.push(m.moduleKey);
        }
      }
    }
    setSelectedModules(Array.from(new Set(mods)));
  };

  useEffect(() => {
    if (catalog.length > 0 && (selectedServices.length === 0 || selectedModules.length === 0)) {
      syncServicesFromPreset(initialPresetKey || presetKey);
    }
  }, [catalog.length]);

  useEffect(() => {
    if (initialPresetKey) {
      syncServicesFromPreset(initialPresetKey);
      setStep(2);
    } else {
      setStep(1);
    }
  }, [initialPresetKey]);

  const estimatedCop = useMemo(() => {
    if (!activePreset) return 169000;
    if (activePreset.key === 'full') return activePreset.baseMonthlyCop;
    const baseSet = new Set(activePreset.includedServices);
    let total = activePreset.baseMonthlyCop;
    for (const sk of selectedServices) {
      if (!baseSet.has(sk) && sk !== 'ms-impresiones') {
        total += extraSvcCop;
      }
    }
    return Math.min(total, 389000);
  }, [activePreset, extraSvcCop, selectedServices]);

  const toggleService = (sk: string, checked: boolean) => {
    const svc = catalog.find((s) => s.serviceKey === sk);
    const modKeys = (svc?.modules || []).map((m) => m.moduleKey);
    if (checked) {
      setSelectedServices((prev) => Array.from(new Set([...prev, sk])));
      setSelectedModules((prev) => Array.from(new Set([...prev, ...modKeys])));
    } else {
      setSelectedServices((prev) => prev.filter((item) => item !== sk));
      setSelectedModules((prev) => prev.filter((mk) => !modKeys.includes(mk)));
    }
  };

  const toggleModule = (sk: string, mk: string, checked: boolean) => {
    if (checked) {
      setSelectedServices((prev) => Array.from(new Set([...prev, sk])));
      setSelectedModules((prev) => Array.from(new Set([...prev, mk])));
    } else {
      const nextMods = selectedModules.filter((item) => item !== mk);
      setSelectedModules(nextMods);
      const svc = catalog.find((s) => s.serviceKey === sk);
      const anyRemaining = (svc?.modules || []).some((m) => nextMods.includes(m.moduleKey));
      if (!anyRemaining) {
        setSelectedServices((prev) => prev.filter((item) => item !== sk));
      }
    }
  };

  const handleOpenCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServices.length === 0 && catalog.length > 0) {
      toast('Selecciona al menos un área operativa para tu negocio');
      return;
    }
    setProvisionedResult(null);
    setCheckoutModalOpen(true);
  };

  const handleConfirmStandbyProvision = () => {
    void run(async () => {
      const effectiveModules = new Set(selectedModules);
      for (const svc of catalog) {
        if (!selectedServices.includes(svc.serviceKey)) continue;
        const hasAnyForSvc = (svc.modules || []).some((m) => effectiveModules.has(m.moduleKey));
        if (!hasAnyForSvc) {
          for (const m of svc.modules || []) {
            if (m.defaultActive) effectiveModules.add(m.moduleKey);
          }
        }
      }

      const activeSubmodules: string[] = [];
      const activeFeatures: string[] = [];
      for (const svc of catalog) {
        if (!selectedServices.includes(svc.serviceKey)) continue;
        for (const sm of svc.submodules || []) {
          if (sm.defaultActive && (!sm.dependsOnModule || effectiveModules.has(sm.dependsOnModule))) {
            activeSubmodules.push(sm.submoduleKey);
          }
        }
        for (const f of svc.features || []) {
          if (
            f.defaultActive &&
            effectiveModules.has(f.dependsOnModule) &&
            (!f.dependsOnSubmodule || activeSubmodules.includes(f.dependsOnSubmodule))
          ) {
            activeFeatures.push(f.featureKey);
          }
        }
      }

      const payload: Record<string, unknown> = {
        companyName,
        nit,
        adminFullName: adminFullName || `Administrador ${companyName}`,
        adminUsername: adminEmail,
        password: adminPass,
        businessPreset: presetKey,
        paymentMethod,
      };
      if (selectedServices.length > 0) {
        payload.activeServices = Array.from(new Set([...selectedServices, 'ms-impresiones']));
        const printMods =
          catalog.find((s) => s.serviceKey === 'ms-impresiones')?.modules.map((m) => m.moduleKey) || [];
        payload.activeModules = Array.from(new Set([...Array.from(effectiveModules), ...printMods]));
        if (activeSubmodules.length > 0) payload.activeSubmodules = activeSubmodules;
        if (activeFeatures.length > 0) payload.activeFeatures = activeFeatures;
      }

      const res = await apiPost<{
        token?: string;
        role: string;
        username?: string;
        fullName?: string;
        tenant: TenantSummary;
      }>('/api/v1/core/register', payload);

      if (role === 'superadmin' && res.role === 'superadmin') {
        setCheckoutModalOpen(false);
        await refreshBootstrap();
        setPublicView('app');
        toast(`Empresa "${res.tenant.companyName}" aprovisionada correctamente`);
        return;
      }

      setProvisionedResult({
        token: res.token || '',
        role: res.role || 'cliente',
        username: res.username || res.tenant.adminUsername,
        fullName: res.fullName || adminFullName || `Administrador ${res.tenant.companyName}`,
        tenant: res.tenant,
      });
    });
  };

  const handleEnterCreatedWorkspace = () => {
    if (!provisionedResult) return;
    setCheckoutModalOpen(false);
    loginWithToken(
      provisionedResult.token,
      provisionedResult.role,
      provisionedResult.username,
      provisionedResult.tenant,
      {
        fullName: provisionedResult.fullName,
        internalRole: 'admin_empresa',
        isCompanyAdmin: true,
        isDemo: false,
        companyTenant: provisionedResult.tenant,
      }
    );
    void refreshBootstrap();
    toast(`Bienvenido a ${provisionedResult.tenant.companyName}`);
  };

  const goStep3IfValid = () => {
    if (catalog.length > 0 && selectedServices.filter((s) => s !== 'ms-impresiones').length === 0) {
      toast('Selecciona al menos un área operativa en el Paso 2 antes de continuar');
      setStep(2);
      return;
    }
    setStep(3);
  };

  const handleCopyCredentials = () => {
    if (!provisionedResult) return;
    const text = [
      `Empresa: ${provisionedResult.tenant.companyName}`,
      `NIT: ${provisionedResult.tenant.nit}`,
      `Usuario Administrador: ${provisionedResult.username}`,
      `Contraseña: ${adminPass}`,
    ].join('\n');
    void navigator.clipboard?.writeText(text);
    toast('Credenciales copiadas al portapapeles');
  };

  return (
    <div className="pk-card">
      <div className="pk-card-head" style={{ background: '#ffffff', padding: '16px 22px' }}>
        <div>
          <span className="pk-badge pk-badge-blue" style={{ marginBottom: 4 }}>
            CONFIGURACIÓN PASO A PASO DE TU EMPRESA
          </span>
          <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--pk-navy)' }}>
            Activa el Sistema a la Medida de tu Negocio
          </h2>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pk-muted)', textTransform: 'uppercase' }}>
            Valor Mensual Estimado
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: 'var(--pk-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCop(estimatedCop)} <span style={{ fontSize: 12, fontWeight: 700 }}>COP/mes</span>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--pk-muted)' }}>
            {activePreset?.name} · {selectedServices.filter((s) => s !== 'ms-impresiones').length} áreas seleccionadas
          </div>
        </div>
      </div>

      <div className="pk-card-body" style={{ padding: 22 }}>
        <div className="pk-stepper">
          <button
            type="button"
            className={`pk-step-pill ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}
            onClick={() => setStep(1)}
          >
            <span className="pk-badge pk-badge-blue">1</span>
            <span>Tipo de Negocio</span>
          </button>
          <button
            type="button"
            className={`pk-step-pill ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}
            onClick={() => setStep(2)}
          >
            <span className="pk-badge pk-badge-blue">2</span>
            <span>Personalizar Áreas y Módulos</span>
          </button>
          <button
            type="button"
            className={`pk-step-pill ${step === 3 ? 'active' : ''}`}
            onClick={goStep3IfValid}
          >
            <span className="pk-badge pk-badge-blue">3</span>
            <span>Datos de Empresa y Activación</span>
          </button>
        </div>

        {step === 1 && (
          <div className="pk-stack">
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pk-text-secondary)' }}>
              Selecciona el giro principal de tu empresa para preconfigurar las herramientas ideales:
            </div>
            <div className="pk-plan-grid">
              {presets.map((p) => {
                const isSelected = p.key === presetKey;
                return (
                  <div
                    key={p.key}
                    role="button"
                    tabIndex={0}
                    className={`pk-plan-card ${isSelected ? 'selected' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => syncServicesFromPreset(p.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        syncServicesFromPreset(p.key);
                      }
                    }}
                  >
                    <div>
                      <div className="pk-row-between" style={{ marginBottom: 6 }}>
                        <span className="pk-badge pk-badge-blue">{p.badge}</span>
                        <span
                          style={{
                            fontWeight: 900,
                            fontSize: 14,
                            color: 'var(--pk-navy)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatCop(p.baseMonthlyCop)}/mes
                        </span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--pk-navy)', marginBottom: 6 }}>
                        {p.name}
                      </div>
                      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--pk-muted)', lineHeight: 1.45 }}>
                        {p.description}
                      </p>
                    </div>
                    <div className="pk-row-between" style={{ paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: isSelected ? 'var(--pk-primary)' : '#64748b' }}>
                        {isSelected ? 'Plan Seleccionado ✓' : 'Clic para elegir'}
                      </span>
                      <button
                        type="button"
                        className={`pk-btn pk-btn-sm ${isSelected ? 'pk-btn-primary' : 'pk-btn-outline'}`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          syncServicesFromPreset(p.key);
                          setStep(2);
                        }}
                      >
                        Personalizar →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pk-row-between" style={{ marginTop: 8 }}>
              <button type="button" className="pk-btn pk-btn-outline" onClick={onSwitchToLogin}>
                ¿Ya tienes cuenta? Iniciar Sesión
              </button>
              <button type="button" className="pk-btn pk-btn-primary" onClick={() => setStep(2)}>
                Continuar al Paso 2: Personalizar Módulos →
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="pk-stack">
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--pk-border)',
                borderRadius: 10,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--pk-navy)' }}>
                  Plan Base: {activePreset?.name} ({formatCop(activePreset?.baseMonthlyCop || 169000)}/mes)
                </div>
                <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>
                  Las áreas de tu giro ya están marcadas. Puedes activar o quitar áreas y secciones según necesites.
                </div>
              </div>
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => setStep(1)}>
                Cambiar Giro
              </button>
            </div>

            <div className="pk-plan-grid">
              {catalog
                .filter((s) => s.serviceKey !== 'ms-impresiones')
                .map((svc) => {
                  const checked = selectedServices.includes(svc.serviceKey);
                  const includedInBase =
                    activePreset?.key === 'full' ||
                    Boolean(activePreset?.includedServices.includes(svc.serviceKey));
                  return (
                    <div key={svc.serviceKey} className={`pk-plan-card ${checked ? 'selected' : ''}`}>
                      <div>
                        <div className="pk-row-between" style={{ marginBottom: 8 }}>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 9,
                              fontWeight: 800,
                              fontSize: 14,
                              color: 'var(--pk-navy)',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleService(svc.serviceKey, e.target.checked)}
                              style={{ width: 16, height: 16 }}
                            />
                            <PkIcon name={svc.serviceKey} size={18} />
                            <span>{svc.displayName}</span>
                          </label>
                          {includedInBase ? (
                            <span className="pk-badge pk-badge-emerald">Incluido</span>
                          ) : (
                            <span className="pk-badge pk-badge-blue">+{formatCop(extraSvcCop)}</span>
                          )}
                        </div>
                        <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--pk-muted)' }}>{svc.summary}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {(svc.modules || []).map((mod) => (
                            <label
                              key={mod.moduleKey}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 7,
                                fontSize: 12,
                                color: '#334155',
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 7,
                                padding: '5px 9px',
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked && selectedModules.includes(mod.moduleKey)}
                                onChange={(e) => toggleModule(svc.serviceKey, mod.moduleKey, e.target.checked)}
                              />
                              <span style={{ textTransform: 'none' }}>{mod.displayName}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="pk-row-between" style={{ marginTop: 8 }}>
              <button type="button" className="pk-btn pk-btn-outline" onClick={() => setStep(1)}>
                ← Volver al Paso 1
              </button>
              <button type="button" className="pk-btn pk-btn-primary" onClick={goStep3IfValid}>
                Continuar al Paso 3: Datos de tu Empresa →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={handleOpenCheckout} className="pk-stack">
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--pk-border)',
                borderRadius: 12,
                padding: 18,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--pk-navy)', marginBottom: 12 }}>
                Datos de tu Empresa y Cuenta Administradora Principal
              </div>
              <div className="pk-grid-2">
                <div className="pk-field">
                  <label htmlFor="wiz-company">Razón Social o Nombre Comercial *</label>
                  <input
                    id="wiz-company"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ej. Ferretería y Suministros Andinos S.A.S."
                  />
                </div>
                <div className="pk-field">
                  <label htmlFor="wiz-nit">NIT o Documento Tributario *</label>
                  <input
                    id="wiz-nit"
                    required
                    value={nit}
                    onChange={(e) => setNit(e.target.value)}
                    placeholder="Ej. 901.420.118-3"
                  />
                </div>
                <div className="pk-field">
                  <label htmlFor="wiz-admin-name">Nombre del Administrador Principal *</label>
                  <input
                    id="wiz-admin-name"
                    required
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    placeholder="Ej. Carlos Andrés Mejía"
                  />
                </div>
                <div className="pk-field">
                  <label htmlFor="wiz-email">Correo o Usuario Administrador *</label>
                  <input
                    id="wiz-email"
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="gerencia@miempresa.co"
                  />
                </div>
                <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="wiz-pass">
                    <span>Contraseña Maestra Inicial (Mínimo 8 caracteres) *</span>
                    <span style={{ display: 'inline-flex', gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: '#64748b',
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {showPass ? 'Ocultar' : 'Mostrar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminPass(generateSecurePassword());
                          setShowPass(true);
                        }}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: 'var(--pk-primary)',
                          fontWeight: 800,
                          fontSize: 11,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Generar otra clave segura
                      </button>
                    </span>
                  </label>
                  <input
                    id="wiz-pass"
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pk-row-between">
              <button type="button" className="pk-btn pk-btn-outline" onClick={() => setStep(2)}>
                ← Volver a Personalización de Módulos
              </button>
              <button type="submit" className="pk-btn pk-btn-emerald" style={{ padding: '11px 22px', fontSize: 13.5 }}>
                Continuar a Confirmación y Activar mi Empresa →
              </button>
            </div>
          </form>
        )}
      </div>

      <PkModal
        open={checkoutModalOpen}
        title={
          provisionedResult
            ? 'Plataforma Empresarial Creada y Lista'
            : 'Confirmar Suscripción y Activar Entorno Empresarial'
        }
        onClose={() => {
          if (!provisionedResult && !busy) setCheckoutModalOpen(false);
        }}
        maxWidth={640}
      >
        {!provisionedResult ? (
          <div className="pk-stack">
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
              <strong>Activación Inmediata:</strong> Se aprovisionará un entorno empresarial dedicado y aislado para{' '}
              <strong>{companyName}</strong> con todas las áreas seleccionadas listas para operar y crear los usuarios de tu equipo.
            </div>

            <div className="pk-grid-2">
              <div className="pk-field">
                <label>Empresa a Aprovisionar</label>
                <input type="text" readOnly value={`${companyName} (NIT ${nit})`} style={{ background: '#f8fafc', fontWeight: 700 }} />
              </div>
              <div className="pk-field">
                <label>Valor Mensual del Plan</label>
                <input
                  type="text"
                  readOnly
                  value={`${formatCop(estimatedCop)} COP / mes`}
                  style={{ background: '#f8fafc', fontWeight: 800, color: 'var(--pk-primary)' }}
                />
              </div>
            </div>

            <div className="pk-field">
              <label htmlFor="pay-method-sel">Modalidad de Facturación Empresarial</label>
              <select
                id="pay-method-sel"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="PSE_EMPRESARIAL">PSE / Transferencia Bancaria Empresarial</option>
                <option value="TARJETA_CORPORATIVA">Tarjeta Débito o Crédito Corporativa</option>
                <option value="FACTURACION_CONTRATO">Facturación Electrónica por Contrato Mensual</option>
              </select>
            </div>

            <div className="pk-row-between" style={{ marginTop: 6 }}>
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                disabled={busy}
                onClick={() => setCheckoutModalOpen(false)}
              >
                Revisar Datos
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-emerald"
                style={{ padding: '11px 22px' }}
                disabled={busy}
                onClick={handleConfirmStandbyProvision}
              >
                {busy ? 'Aprovisionando Entorno y Módulos...' : 'Confirmar y Crear mi Plataforma Ahora'}
              </button>
            </div>
          </div>
        ) : (
          <div className="pk-stack">
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #6ee7b7',
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 15, color: '#065f46' }}>
                ¡Tu plataforma empresarial ha sido creada exitosamente!
              </div>
              <div style={{ fontSize: 12.5, color: '#047857', marginTop: 3 }}>
                Guarda tus datos de administrador. Dentro de tu estación podrás crear las cuentas y permisos de cada trabajador en <strong>Usuarios y Permisos</strong>.
              </div>
            </div>

            <div className="pk-cred-box">
              <div>
                Empresa: <strong>{provisionedResult.tenant.companyName}</strong> (NIT {provisionedResult.tenant.nit})
              </div>
              <div>
                Entorno Empresarial Dedicado: <strong>Aislado y Activo</strong>
              </div>
              <div>
                Usuario Administrador: <strong>{provisionedResult.username}</strong>
              </div>
              <div>
                Contraseña Definida: <strong>{adminPass}</strong>
              </div>
              <div>
                Áreas Habilitadas: <strong>{provisionedResult.tenant.activeServices.length} áreas operativas</strong>
              </div>
            </div>

            <div className="pk-row-between" style={{ marginTop: 4 }}>
              <button type="button" className="pk-btn pk-btn-outline" onClick={handleCopyCredentials}>
                Copiar Credenciales
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-primary"
                style={{ padding: '11px 22px' }}
                onClick={handleEnterCreatedWorkspace}
              >
                Entrar a mi Sistema Ahora →
              </button>
            </div>
          </div>
        )}
      </PkModal>
    </div>
  );
};
