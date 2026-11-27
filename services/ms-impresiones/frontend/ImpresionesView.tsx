import React, { useState, useEffect, useCallback } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkSimpleSelect,
  PkLiveHeader,
  PkTypeCards,
  useAsyncAction,
  formatCop,
} from '@platform/ui-sdk';

type PrintFormatVariant = 'carta_membrete' | 'media_carta' | 'tirilla_80mm';
type CanvasPreviewVariant = PrintFormatVariant | 'factura_taller';

interface BrandingFormState {
  companyName: string;
  nit: string;
  taxRegime: string;
  address: string;
  phone: string;
  email: string;
  dianResolution: string;
  footerWarranty: string;
  primaryColor: string;
  defaultFormat: PrintFormatVariant;
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const DEFAULT_BRANDING: BrandingFormState = {
  companyName: '',
  nit: '',
  taxRegime: 'Responsable de IVA — Régimen Ordinario',
  address: '',
  phone: '',
  email: '',
  dianResolution: '',
  footerWarranty: '',
  primaryColor: '#023047',
  defaultFormat: 'carta_membrete',
};

const PRINT_FORMAT_OPTIONS = [
  {
    value: 'carta_membrete',
    label: 'Carta con Membrete Corporativo (PDF / Láser)',
    sublabel: 'Hoja completa institucional',
  },
  {
    value: 'media_carta',
    label: 'Media Carta Comercial (Horizontal / Compacto)',
    sublabel: 'Ahorro de papel comercial',
  },
  {
    value: 'tirilla_80mm',
    label: 'Tirilla Térmica POS 80mm (Mostrador)',
    sublabel: 'Impresoras térmicas de caja',
  },
];

const STUDIO_VARIANT_CARDS = [
  {
    key: 'carta_membrete',
    icon: '📄',
    title: 'Carta Membrete Corporativa',
    description: 'Hoja institucional completa con franja de marca, tabla detallada, CUFE y firmas.',
    badge: 'PDF · Carta',
  },
  {
    key: 'media_carta',
    icon: '📑',
    title: 'Media Carta Comercial',
    description: 'Formato compacto horizontal optimizado para entregas ágiles de mostrador y despacho.',
    badge: 'Compacto',
  },
  {
    key: 'tirilla_80mm',
    icon: '🧾',
    title: 'Tirilla Térmica POS 80mm',
    description: 'Rollo continuo de 320px con bordes dentados, tipografía térmica y código QR fiscal.',
    badge: '80mm POS',
  },
  {
    key: 'factura_taller',
    icon: '🔧',
    title: 'Orden / Factura Automotriz',
    description: 'Plantilla especializada con bloque técnico de placa, línea vehicular, km y técnico.',
    badge: 'Automotriz',
  },
];

const CURATED_BRAND_SWATCHES = ['#023047', '#0f172a', '#1d4ed8', '#047857', '#6d28d9', '#b45309', '#be123c'];

const SAMPLE_ITEMS = [
  {
    code: 'PRD-1011',
    description: 'Suministro Corporativo Certificado',
    quantity: 2,
    unitPrice: 148000,
    taxPct: 19,
    subtotal: 296000,
  },
  {
    code: 'SRV-010',
    description: 'Servicio Técnico Especializado',
    quantity: 1,
    unitPrice: 140000,
    taxPct: 0,
    subtotal: 140000,
  },
];

function sanitizePreviewColor(raw: string): string {
  return HEX_COLOR_PATTERN.test(raw.trim()) ? raw.trim() : '#023047';
}

function normalizeDefaultFormat(raw: string | undefined): PrintFormatVariant {
  if (raw === 'tirilla_80mm' || raw === 'media_carta' || raw === 'carta_membrete') {
    return raw;
  }
  return 'carta_membrete';
}

export const ImpresionesView: React.FC = () => {
  const { apiGet, apiPut, requestPrintDocument, toast } = usePlatform();
  const [form, setForm] = useState<BrandingFormState>(DEFAULT_BRANDING);
  const [canvasVariant, setCanvasVariant] = useState<CanvasPreviewVariant>('carta_membrete');
  const { busy: saving, run: runSave } = useAsyncAction();
  const { busy: previewing, run: runPreview } = useAsyncAction();

  const loadBranding = useCallback(async () => {
    try {
      const res = await apiGet<{ ok: boolean; branding: BrandingFormState }>('/api/v1/impresiones/branding');
      if (res.branding) {
        const normalizedDefault = normalizeDefaultFormat(res.branding.defaultFormat);
        setForm({
          ...DEFAULT_BRANDING,
          ...res.branding,
          primaryColor: sanitizePreviewColor(res.branding.primaryColor || '#023047'),
          defaultFormat: normalizedDefault,
        });
        setCanvasVariant(normalizedDefault);
      }
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  const updateField = <K extends keyof BrandingFormState>(key: K, value: BrandingFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectCanvasVariant = (key: string) => {
    const next = key as CanvasPreviewVariant;
    setCanvasVariant(next);
    if (next === 'carta_membrete' || next === 'media_carta' || next === 'tirilla_80mm') {
      updateField('defaultFormat', next);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await runSave(async () => {
      const payload: BrandingFormState = {
        ...form,
        primaryColor: sanitizePreviewColor(form.primaryColor),
      };
      const res = await apiPut<{ ok: boolean; branding: BrandingFormState }>('/api/v1/impresiones/branding', payload);
      if (res.branding) {
        setForm({
          ...payload,
          ...res.branding,
          primaryColor: sanitizePreviewColor(res.branding.primaryColor),
          defaultFormat: normalizeDefaultFormat(res.branding.defaultFormat),
        });
      }
      toast('Membrete empresarial actualizado correctamente');
    });
  };

  const handleSamplePrint = async (overrideVariant?: string) => {
    await runPreview(async () => {
      const chosenVariant = overrideVariant || canvasVariant || form.defaultFormat;
      const samplePayload: Record<string, unknown> = {
        document_type: 'FACTURA ELECTRÓNICA DE VENTA (MUESTRA)',
        layout_variant: chosenVariant,
        document_number: 'FEVP-9012',
        customer_name: 'Comercializadora Andina S.A.S.',
        customer_nit: '901.452.100-2',
        customer_phone: '310 450 9988',
        customer_address: 'Cra. 15 # 93-40 Of. 301 — Bogotá D.C.',
        payment_method: 'Transferencia Bancaria',
        extra_fields:
          chosenVariant === 'factura_taller'
            ? {
                Placa: 'KLM-452',
                Vehículo: 'Toyota Hilux 2.8 Diesel 4x4',
                Kilometraje: '64.200 km',
                'Próximo Aceite': '69.200 km',
                Técnico: 'Jorge Iván Ríos',
                'Orden de Servicio': 'OT-3041',
              }
            : {
                PuntoVenta: 'Caja Principal',
                Ciudad: 'Bogotá D.C.',
              },
        items: [
          {
            code: 'PRD-1011',
            description: 'Suministro Corporativo Certificado',
            quantity: 2,
            unit_price: 148000,
            tax_pct: 19,
            subtotal: 296000,
          },
          {
            code: 'SRV-010',
            description: 'Servicio Técnico Especializado',
            quantity: 1,
            unit_price: 140000,
            tax_pct: 0,
            subtotal: 140000,
          },
        ],
        subtotal: 436000,
        discount_total: 0,
        tax_total: 56240,
        grand_total: 492240,
        pending_balance: 0,
        notes: 'Documento de prueba renderizado con el membrete institucional activo.',
      };
      await requestPrintDocument(samplePayload);
    });
  };

  const safeColor = sanitizePreviewColor(form.primaryColor);
  const displayCompany = form.companyName.trim() || 'INVERSIONES Y SOLUCIONES EMPRESARIALES S.A.S.';
  const displayNit = form.nit.trim() || '901.482.190-4';
  const displayRegime = form.taxRegime.trim() || 'Responsable de IVA — Régimen Ordinario';
  const displayAddress = form.address.trim() || 'Av. El Dorado # 68C-61 Torre Central — Bogotá D.C.';
  const displayPhone = form.phone.trim() || '601 742 8890';
  const displayEmail = form.email.trim() || 'facturacion@empresa.co';
  const displayResolution =
    form.dianResolution.trim() ||
    'Autorización Numeración Facturación Electrónica DIAN N° 18764062194012 · Vigencia 12 meses · Prefijo FEVP del 1 al 50.000';
  const displayWarranty =
    form.footerWarranty.trim() ||
    'Esta factura electrónica de venta se asimila en todos sus efectos legales a una letra de cambio según el Código de Comercio. Garantía sujeta a términos técnicos.';

  const canvasBadgeLabel =
    canvasVariant === 'tirilla_80mm'
      ? 'Tirilla POS 80mm (320px)'
      : canvasVariant === 'media_carta'
      ? 'Media Carta Comercial'
      : canvasVariant === 'factura_taller'
      ? 'Orden / Factura Automotriz'
      : 'Carta Membrete Corporativa';

  return (
    <ModuleGate module="config_membretes">
      <div className="pk-stack">
        <PkLiveHeader
          title="Estudio Interactivo de Diseño Documental"
          liveLabel="Previsualización en vivo"
          subtitle="Configura identidad visual, color corporativo, resolución DIAN y experimenta en tiempo real el lienzo físico de cada documento."
          primaryActionLabel={saving ? 'Guardando...' : '💾 Guardar Membrete Oficial'}
          onPrimaryAction={() => void handleSave()}
          extraActions={
            <button
              type="button"
              className="pk-btn pk-btn-emerald"
              disabled={previewing}
              onClick={() => void handleSamplePrint(canvasVariant)}
            >
              🖨️ Probar Impresión Real ({canvasBadgeLabel})
            </button>
          }
        />

        <div className="pk-card">
          <div className="pk-card-body">
            <PkTypeCards
              label="Selecciona la Plantilla Activa en el Lienzo de Simulación"
              options={STUDIO_VARIANT_CARDS}
              value={canvasVariant}
              onChange={handleSelectCanvasVariant}
            />
          </div>
        </div>

        <div className="pk-grid-2" style={{ alignItems: 'start' }}>
          <form onSubmit={(e) => void handleSave(e)} className="pk-stack">
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🎨 1. Identidad Corporativa y Color de Marca</div>
                <span className="pk-badge pk-badge-blue">Transversal</span>
              </div>
              <div className="pk-card-body">
                <div className="pk-form-grid cols-2">
                  <div className="pk-field pk-col-span-full">
                    <label>Razón Social / Nombre Comercial *</label>
                    <input
                      required
                      value={form.companyName}
                      onChange={(e) => updateField('companyName', e.target.value)}
                      placeholder="Ej: Inversiones y Servicios S.A.S."
                    />
                  </div>

                  <div className="pk-field">
                    <label>NIT Empresarial *</label>
                    <input
                      required
                      value={form.nit}
                      onChange={(e) => updateField('nit', e.target.value)}
                      placeholder="Ej: 901.482.190-4"
                    />
                  </div>

                  <div className="pk-field">
                    <label>Régimen Tributario</label>
                    <input
                      value={form.taxRegime}
                      onChange={(e) => updateField('taxRegime', e.target.value)}
                      placeholder="Responsable de IVA — Régimen Ordinario"
                    />
                  </div>

                  <div className="pk-field pk-col-span-full">
                    <label>Color Institucional (#RRGGBB) y Paleta Ejecutiva</label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="color"
                        value={safeColor}
                        onChange={(e) => updateField('primaryColor', e.target.value)}
                        style={{ width: 50, height: 40, padding: 2, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <input
                        style={{ maxWidth: 140 }}
                        value={form.primaryColor}
                        onChange={(e) => updateField('primaryColor', e.target.value)}
                        placeholder="#023047"
                      />
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {CURATED_BRAND_SWATCHES.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            title={`Aplicar tono ${hex}`}
                            onClick={() => updateField('primaryColor', hex)}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 999,
                              background: hex,
                              border: safeColor.toLowerCase() === hex ? '3px solid #38bdf8' : '2px solid #ffffff',
                              boxShadow: '0 2px 6px rgba(15, 23, 42, 0.22)',
                              cursor: 'pointer',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">📍 2. Domicilio Fiscal y Canales de Atención</div>
              </div>
              <div className="pk-card-body">
                <div className="pk-form-grid cols-2">
                  <div className="pk-field pk-col-span-full">
                    <label>Dirección Principal y Ciudad</label>
                    <input
                      value={form.address}
                      onChange={(e) => updateField('address', e.target.value)}
                      placeholder="Calle / Carrera y Ciudad"
                    />
                  </div>

                  <div className="pk-field">
                    <label>Teléfono / PBX / WhatsApp</label>
                    <input
                      value={form.phone}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="601 742 8890"
                    />
                  </div>

                  <div className="pk-field">
                    <label>Correo Oficial de Facturación</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="facturacion@empresa.co"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">⚖️ 3. Numeración DIAN, Garantía y Formato Predeterminado</div>
              </div>
              <div className="pk-card-body">
                <div className="pk-form-grid cols-1">
                  <div className="pk-field">
                    <label>Resolución de Numeración DIAN</label>
                    <input
                      value={form.dianResolution}
                      onChange={(e) => updateField('dianResolution', e.target.value)}
                      placeholder="Resolución DIAN N° 1876... Prefijo FEVP del 1 al 50.000"
                    />
                  </div>

                  <div className="pk-field">
                    <label>Pie de Página / Condiciones de Garantía y Pago</label>
                    <textarea
                      rows={2}
                      value={form.footerWarranty}
                      onChange={(e) => updateField('footerWarranty', e.target.value)}
                      placeholder="Condiciones de garantía, políticas de cambio o cuentas bancarias para pago."
                    />
                  </div>

                  <PkSimpleSelect
                    label="Formato Predeterminado del Sistema al Imprimir"
                    value={form.defaultFormat}
                    onChange={(val) => {
                      const norm = normalizeDefaultFormat(val);
                      updateField('defaultFormat', norm);
                      setCanvasVariant(norm);
                    }}
                    options={PRINT_FORMAT_OPTIONS}
                  />

                  <div className="pk-form-actions">
                    <button
                      type="button"
                      className="pk-btn pk-btn-outline"
                      disabled={previewing}
                      onClick={() => void handleSamplePrint(canvasVariant)}
                    >
                      🖨️ Enviar Muestra al Motor de Impresión
                    </button>
                    <button type="submit" className="pk-btn pk-btn-primary" disabled={saving}>
                      {saving ? 'Guardando...' : '💾 Guardar Membrete Empresarial'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>

          <div className="pk-card" style={{ position: 'sticky', top: 12 }}>
            <div className="pk-card-head">
              <div className="pk-card-title">👁️ Mesa de Luz — Lienzo Físico en Tiempo Real</div>
              <span className="pk-badge pk-badge-emerald">{canvasBadgeLabel}</span>
            </div>
            <div
              style={{
                background: 'radial-gradient(circle at top, #cbd5e1 0%, #e2e8f0 55%, #dbe3ee 100%)',
                padding: '28px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 18,
                minHeight: 620,
              }}
            >
              {canvasVariant === 'tirilla_80mm' ? (
                <div
                  style={{
                    width: '100%',
                    maxWidth: 320,
                    background: '#fffef9',
                    color: '#0f172a',
                    boxShadow: '0 20px 42px rgba(15, 23, 42, 0.24)',
                    fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 11.5,
                    lineHeight: 1.45,
                    position: 'relative',
                    borderLeft: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      height: 10,
                      background:
                        'repeating-linear-gradient(-45deg, #cbd5e1, #cbd5e1 5px, #fffef9 5px, #fffef9 10px)',
                      borderBottom: '2px dashed #94a3b8',
                    }}
                  />

                  <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: safeColor,
                        marginBottom: 2,
                      }}
                    />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 900, color: safeColor }}>{displayCompany}</div>
                      <div style={{ fontSize: 10.5, marginTop: 2 }}>NIT: {displayNit}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{displayRegime}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{displayAddress}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>Tel: {displayPhone}</div>
                    </div>

                    <div style={{ borderTop: '1.5px dashed #64748b', borderBottom: '1.5px dashed #64748b', padding: '6px 0' }}>
                      <div style={{ fontWeight: 900, textAlign: 'center' }}>FACTURA ELECTRÓNICA POS</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                        <span>N° FEVP-9012</span>
                        <span>CAJA 01</span>
                      </div>
                      <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                        Adq: Comercializadora Andina S.A.S.
                        <br />
                        NIT: 901.452.100-2 · Pago: Transf.
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 10.5 }}>
                        <span>CANT / DESCRIPCIÓN</span>
                        <span>VALOR</span>
                      </div>
                      {SAMPLE_ITEMS.map((it) => (
                        <div key={it.code}>
                          <div style={{ fontWeight: 700 }}>{it.description}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#334155' }}>
                            <span>
                              {it.quantity} x {formatCop(it.unitPrice)} (IVA {it.taxPct}%)
                            </span>
                            <strong style={{ color: '#0f172a' }}>{formatCop(it.subtotal)}</strong>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ borderTop: '1.5px dashed #64748b', paddingTop: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>SUBTOTAL:</span>
                        <span>{formatCop(436000)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>IVA (19%):</span>
                        <span>{formatCop(56240)}</span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 14,
                          fontWeight: 900,
                          color: safeColor,
                          marginTop: 4,
                          paddingTop: 4,
                          borderTop: '1px solid #cbd5e1',
                        }}
                      >
                        <span>TOTAL COP:</span>
                        <span>{formatCop(492240)}</span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 0',
                        borderTop: '1px dashed #94a3b8',
                      }}
                    >
                      <div
                        style={{
                          width: 68,
                          height: 68,
                          border: `2px solid ${safeColor}`,
                          borderRadius: 6,
                          background:
                            'repeating-conic-gradient(#0f172a 0% 25%, #ffffff 0% 50%) 50% / 12px 12px',
                        }}
                      />
                      <div style={{ fontSize: 9, color: '#475569', textAlign: 'center', wordBreak: 'break-all' }}>
                        CUFE: 94a8f102e9c471b03d8a22f1c604e88b9912d4a0
                      </div>
                    </div>

                    <div style={{ fontSize: 9.5, color: '#475569', textAlign: 'center' }}>{displayResolution}</div>
                    <div
                      style={{
                        fontSize: 9.5,
                        color: '#334155',
                        textAlign: 'center',
                        borderTop: '1px dashed #cbd5e1',
                        paddingTop: 6,
                      }}
                    >
                      {displayWarranty}
                    </div>
                  </div>

                  <div
                    style={{
                      height: 10,
                      borderTop: '2px dashed #94a3b8',
                      background:
                        'repeating-linear-gradient(45deg, #cbd5e1, #cbd5e1 5px, #fffef9 5px, #fffef9 10px)',
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    maxWidth: 640,
                    background: '#ffffff',
                    borderRadius: 6,
                    overflow: 'hidden',
                    boxShadow: '0 22px 48px rgba(15, 23, 42, 0.22)',
                    border: '1px solid #cbd5e1',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ height: canvasVariant === 'media_carta' ? 7 : 11, background: safeColor }} />

                  <div
                    style={{
                      padding: canvasVariant === 'media_carta' ? '16px 20px' : '24px 26px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: canvasVariant === 'media_carta' ? 12 : 16,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 14,
                        borderBottom: `2.5px solid ${safeColor}`,
                        paddingBottom: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flex: 1, minWidth: 220 }}>
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            background: safeColor,
                            color: '#ffffff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: 18,
                            flexShrink: 0,
                          }}
                        >
                          {displayCompany.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 16.5, fontWeight: 900, color: safeColor, lineHeight: 1.2 }}>
                            {displayCompany}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#334155', marginTop: 4, lineHeight: 1.4 }}>
                            <strong>NIT:</strong> {displayNit} · {displayRegime}
                            <br />
                            {displayAddress}
                            <br />
                            Tel: {displayPhone} · {displayEmail}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          border: `2px solid ${safeColor}`,
                          borderRadius: 8,
                          padding: '8px 14px',
                          textAlign: 'right',
                          background: '#f8fafc',
                        }}
                      >
                        <div style={{ fontSize: 10, fontWeight: 900, color: safeColor, letterSpacing: '0.04em' }}>
                          {canvasVariant === 'factura_taller'
                            ? 'FACTURA / ORDEN AUTOMOTRIZ'
                            : 'FACTURA ELECTRÓNICA DE VENTA'}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>FEVP-9012</div>
                        <div style={{ fontSize: 10.5, color: '#64748b' }}>Emisión: 2026-11-26 · Contado</div>
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: '9px 12px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                        gap: '4px 12px',
                        fontSize: 11.5,
                        color: '#1e293b',
                      }}
                    >
                      <div>
                        <strong>Cliente:</strong> Comercializadora Andina S.A.S.
                      </div>
                      <div>
                        <strong>NIT / CC:</strong> 901.452.100-2
                      </div>
                      <div>
                        <strong>Dirección:</strong> Cra. 15 # 93-40 Of. 301 — Bogotá
                      </div>
                      <div>
                        <strong>Medio Pago:</strong> Transferencia Bancaria
                      </div>
                    </div>

                    {canvasVariant === 'factura_taller' && (
                      <div
                        style={{
                          background: '#eff6ff',
                          border: `1.5px solid ${safeColor}`,
                          borderRadius: 8,
                          padding: '10px 12px',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                          gap: 8,
                          fontSize: 11.5,
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b' }}>PLACA VEHÍCULO</div>
                          <div
                            style={{
                              display: 'inline-block',
                              marginTop: 2,
                              background: '#facc15',
                              color: '#0f172a',
                              padding: '1px 8px',
                              borderRadius: 4,
                              border: '1.5px solid #0f172a',
                              fontWeight: 900,
                            }}
                          >
                            KLM-452
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b' }}>LÍNEA / MOTOR</div>
                          <div style={{ fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                            Toyota Hilux 2.8 4x4
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b' }}>ORDEN SERVICIO</div>
                          <div style={{ fontWeight: 800, color: safeColor, marginTop: 2 }}>#OT-3041</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b' }}>KILOMETRAJE ACTUAL</div>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>64.200 km</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b' }}>PRÓXIMO SERVICIO</div>
                          <div style={{ fontWeight: 700, color: '#047857' }}>69.200 km</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#64748b' }}>TÉCNICO LÍDER</div>
                          <div style={{ fontWeight: 700, color: '#1e293b' }}>Jorge Iván Ríos</div>
                        </div>
                      </div>
                    )}

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                      <thead>
                        <tr style={{ background: safeColor, color: '#ffffff' }}>
                          <th style={{ padding: '7px 9px', textAlign: 'left' }}>Código</th>
                          <th style={{ padding: '7px 9px', textAlign: 'left' }}>Descripción</th>
                          <th style={{ padding: '7px 9px', textAlign: 'right' }}>Cant.</th>
                          <th style={{ padding: '7px 9px', textAlign: 'right' }}>V. Unit.</th>
                          <th style={{ padding: '7px 9px', textAlign: 'right' }}>Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SAMPLE_ITEMS.map((it) => (
                          <tr key={it.code} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '7px 9px', fontWeight: 700 }}>{it.code}</td>
                            <td style={{ padding: '7px 9px' }}>{it.description}</td>
                            <td style={{ padding: '7px 9px', textAlign: 'right' }}>{it.quantity}</td>
                            <td style={{ padding: '7px 9px', textAlign: 'right' }}>{formatCop(it.unitPrice)}</td>
                            <td style={{ padding: '7px 9px', textAlign: 'right', fontWeight: 700 }}>
                              {formatCop(it.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        gap: 16,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, maxWidth: 330 }}>
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            border: `2px solid ${safeColor}`,
                            borderRadius: 6,
                            flexShrink: 0,
                            background:
                              'repeating-conic-gradient(#0f172a 0% 25%, #ffffff 0% 50%) 50% / 10px 10px',
                          }}
                        />
                        <div style={{ fontSize: 9.5, color: '#475569', lineHeight: 1.35 }}>
                          <strong style={{ color: '#0f172a' }}>Validación Previa DIAN · CUFE SHA-384</strong>
                          <br />
                          94a8f102e9c471b03d8a22f1c604e88b9912d4a0c17e
                          <br />
                          {displayResolution}
                        </div>
                      </div>

                      <div
                        style={{
                          minWidth: 210,
                          border: '1px solid #cbd5e1',
                          borderRadius: 8,
                          padding: '8px 12px',
                          background: '#f8fafc',
                          fontSize: 11.5,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Subtotal:</span>
                          <strong>{formatCop(436000)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                          <span>IVA (19%):</span>
                          <strong>{formatCop(56240)}</strong>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: 6,
                            paddingTop: 6,
                            borderTop: `2px solid ${safeColor}`,
                            fontSize: 13.5,
                            fontWeight: 900,
                            color: safeColor,
                          }}
                        >
                          <span>TOTAL:</span>
                          <span>{formatCop(492240)}</span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        borderTop: '1px dashed #cbd5e1',
                        paddingTop: 9,
                        fontSize: 10.5,
                        color: '#475569',
                        textAlign: 'center',
                      }}
                    >
                      {displayWarranty}
                    </div>
                  </div>
                </div>
              )}

              <div className="pk-row-actions" style={{ justifyContent: 'center' }}>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  disabled={previewing}
                  onClick={() => void handleSamplePrint('carta_membrete')}
                >
                  🖨️ Visor Carta
                </button>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  disabled={previewing}
                  onClick={() => void handleSamplePrint('media_carta')}
                >
                  🖨️ Visor Media Carta
                </button>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  disabled={previewing}
                  onClick={() => void handleSamplePrint('tirilla_80mm')}
                >
                  🖨️ Visor Tirilla 80mm
                </button>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  disabled={previewing}
                  onClick={() => void handleSamplePrint('factura_taller')}
                >
                  🖨️ Visor Automotriz
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModuleGate>
  );
};

export default ImpresionesView;
