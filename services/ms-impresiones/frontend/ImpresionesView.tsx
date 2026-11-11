import React, { useState, useEffect, useCallback } from 'react';
import {
  usePlatform,
  ModuleGate,
  useAsyncAction,
  formatCop,
} from '@platform/ui-sdk';

type PrintFormatVariant = 'carta_membrete' | 'media_carta' | 'tirilla_80mm';

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
  const { busy: saving, run: runSave } = useAsyncAction();
  const { busy: previewing, run: runPreview } = useAsyncAction();

  const loadBranding = useCallback(async () => {
    try {
      const res = await apiGet<{ ok: boolean; branding: BrandingFormState }>('/api/v1/impresiones/branding');
      if (res.branding) {
        setForm({
          ...DEFAULT_BRANDING,
          ...res.branding,
          primaryColor: sanitizePreviewColor(res.branding.primaryColor || '#023047'),
          defaultFormat: normalizeDefaultFormat(res.branding.defaultFormat),
        });
      }
    } catch {
      // Handled by platform session/toast layer
    }
  }, [apiGet]);

  useEffect(() => {
    void loadBranding();
  }, [loadBranding]);

  const updateField = <K extends keyof BrandingFormState>(key: K, value: BrandingFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const chosenVariant = overrideVariant || form.defaultFormat;
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
  const formatLabel =
    form.defaultFormat === 'tirilla_80mm'
      ? 'Tirilla POS 80mm'
      : form.defaultFormat === 'media_carta'
        ? 'Media Carta Comercial'
        : 'Carta con Membrete';

  return (
    <ModuleGate module="config_membretes">
      <div className="pk-grid-2">
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">Configuración de Membrete Oficial y Formatos PDF / POS</div>
            <span className="pk-badge pk-badge-blue">Transversal</span>
          </div>
          <div className="pk-card-body">
            <form onSubmit={(e) => void handleSave(e)} className="pk-form-grid">
              <div className="pk-field">
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

              <div className="pk-field">
                <label>Dirección Principal</label>
                <input
                  value={form.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Calle / Carrera y Ciudad"
                />
              </div>

              <div className="pk-field">
                <label>Teléfono / WhatsApp</label>
                <input
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="601 742 8890"
                />
              </div>

              <div className="pk-field">
                <label>Correo de Facturación</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="facturacion@empresa.co"
                />
              </div>

              <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
                <label>Resolución de Numeración DIAN</label>
                <input
                  value={form.dianResolution}
                  onChange={(e) => updateField('dianResolution', e.target.value)}
                  placeholder="Resolución DIAN N° 1876... Prefijo FEVP del 1 al 50.000"
                />
              </div>

              <div className="pk-field" style={{ gridColumn: '1 / -1' }}>
                <label>Pie de Página / Leyenda de Garantía</label>
                <textarea
                  rows={2}
                  value={form.footerWarranty}
                  onChange={(e) => updateField('footerWarranty', e.target.value)}
                  placeholder="Condiciones de garantía, políticas de cambio o cuentas bancarias para pago."
                />
              </div>

              <div className="pk-field">
                <label>Color Institucional (#RRGGBB)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={safeColor}
                    onChange={(e) => updateField('primaryColor', e.target.value)}
                    style={{ width: 52, height: 38, padding: 2, cursor: 'pointer' }}
                  />
                  <input
                    value={form.primaryColor}
                    onChange={(e) => updateField('primaryColor', e.target.value)}
                    placeholder="#023047"
                  />
                </div>
              </div>

              <div className="pk-field">
                <label>Formato Predeterminado de Impresión</label>
                <select
                  value={form.defaultFormat}
                  onChange={(e) => updateField('defaultFormat', normalizeDefaultFormat(e.target.value))}
                >
                  <option value="carta_membrete">Carta con Membrete Corporativo (PDF / Láser)</option>
                  <option value="media_carta">Media Carta Comercial (Horizontal / Compacto)</option>
                  <option value="tirilla_80mm">Tirilla Térmica POS 80mm (Mostrador)</option>
                </select>
              </div>

              <div className="pk-row-actions" style={{ gridColumn: '1 / -1', marginTop: 6 }}>
                <button type="submit" className="pk-btn pk-btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Membrete Empresarial'}
                </button>
                <button
                  type="button"
                  className="pk-btn pk-btn-emerald"
                  disabled={previewing}
                  onClick={() => void handleSamplePrint()}
                >
                  Probar Formato Predeterminado
                </button>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline"
                  disabled={previewing}
                  onClick={() => void handleSamplePrint('media_carta')}
                >
                  Muestra Media Carta
                </button>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline"
                  disabled={previewing}
                  onClick={() => void handleSamplePrint('tirilla_80mm')}
                >
                  Muestra Tirilla 80mm
                </button>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline"
                  disabled={previewing}
                  onClick={() => void handleSamplePrint('factura_taller')}
                >
                  Muestra Factura Taller
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">Vista Previa en Vivo del Encabezado</div>
            <span className="pk-badge pk-badge-emerald">{formatLabel}</span>
          </div>
          <div className="pk-card-body">
            <div
              style={{
                border: `2px solid ${safeColor}`,
                borderRadius: 10,
                padding: 18,
                background: '#ffffff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  borderBottom: `3px solid ${safeColor}`,
                  paddingBottom: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: safeColor }}>
                    {form.companyName || 'Nombre de la Empresa'}
                  </div>
                  <div style={{ fontSize: 12, color: '#334155', marginTop: 4, lineHeight: 1.45 }}>
                    <strong>NIT:</strong> {form.nit || '—'} • {form.taxRegime || '—'}
                    <br />
                    {form.address || 'Dirección principal'}
                    <br />
                    Tel: {form.phone || '—'} • {form.email || '—'}
                  </div>
                </div>
                <div
                  style={{
                    border: `2px solid ${safeColor}`,
                    borderRadius: 8,
                    padding: '8px 12px',
                    textAlign: 'right',
                  }}
                >
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: safeColor }}>FACTURA DE VENTA</div>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>FEVP-9012</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Total: {formatCop(492240)}</div>
                </div>
              </div>

              {form.dianResolution && (
                <div style={{ fontSize: 11, color: '#475569', marginTop: 10 }}>{form.dianResolution}</div>
              )}

              <div
                style={{
                  marginTop: 14,
                  paddingTop: 10,
                  borderTop: '1px dashed #cbd5e1',
                  fontSize: 11.5,
                  color: '#475569',
                  textAlign: 'center',
                }}
              >
                {form.footerWarranty ||
                  'Pie de garantía institucional aplicado automáticamente a facturas, cotizaciones y recibos.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModuleGate>
  );
};

export default ImpresionesView;
