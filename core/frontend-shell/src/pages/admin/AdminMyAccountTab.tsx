import React, { useCallback, useEffect, useState } from 'react';
import { useAsyncAction, usePlatform } from '@platform/ui-sdk';

interface MyAccountInfo {
  userId?: string;
  email?: string;
  fullName?: string;
  roleKey?: string;
  mfaEnabled?: boolean;
  mfaRequired?: boolean;
  lastLoginAt?: string;
}

export const AdminMyAccountTab: React.FC = () => {
  const { username, platformRole, platformPermissions, requireDataReason, apiGet, apiPost, apiPut, apiDelete, toast } =
    usePlatform();
  const { busy, run } = useAsyncAction();

  const [me, setMe] = useState<MyAccountInfo | null>(null);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ me?: MyAccountInfo }>('/api/v1/admin/me');
      setMe(res.me || null);
    } catch {
      setMe(null);
    }
  }, [apiGet]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleEnableTotp = () => {
    void run(async () => {
      const res = await apiPost<{ totp: { secret: string; otpauthUri: string } }>('/api/v1/admin/me/totp/setup', {});
      setTotpSecret(res.totp.secret);
      setTotpUri(res.totp.otpauthUri);
      toast('Autenticación 2FA TOTP activada en tu cuenta');
      await load();
    });
  };

  const handleDisableTotp = () => {
    void run(async () => {
      await apiDelete('/api/v1/admin/me/totp');
      setTotpSecret('');
      setTotpUri('');
      toast('Autenticación 2FA TOTP desactivada');
      await load();
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await apiPut('/api/v1/admin/me/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast('Tu contraseña corporativa ha sido actualizada');
    });
  };

  return (
    <div className="pk-grid-2">
      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">Mi Identidad y Seguridad 2FA (TOTP)</div>
          <span className={`pk-badge ${me?.mfaEnabled ? 'pk-badge-emerald' : 'pk-badge-slate'}`}>
            {me?.mfaEnabled ? '2FA Activo' : '2FA No Configurado'}
          </span>
        </div>
        <div className="pk-card-body pk-stack">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
            <div>
              <div className="pk-label">Operador</div>
              <div style={{ fontWeight: 700 }}>{me?.fullName || username}</div>
              <div style={{ color: 'var(--pk-muted)', fontSize: 12 }}>{me?.email || username}</div>
            </div>
            <div>
              <div className="pk-label">Rol en Plataforma</div>
              <span className="pk-badge pk-badge-blue">{platformRole || me?.roleKey || 'superadmin'}</span>
              <div style={{ color: 'var(--pk-muted)', fontSize: 11.5, marginTop: 4 }}>
                {requireDataReason ? 'Requiere motivo al ver datos de clientes' : 'Sin restricción de motivo'}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--pk-border)', paddingTop: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--pk-navy)', marginBottom: 6 }}>
              Verificación en Dos Pasos (Google / Microsoft Authenticator)
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--pk-muted)', lineHeight: 1.5 }}>
              Protege tu cuenta administrativa generando un código temporal de 6 dígitos cada 30 segundos al iniciar sesión.
            </p>
            <div className="pk-row-actions">
              {!me?.mfaEnabled ? (
                <button type="button" className="pk-btn pk-btn-primary" disabled={busy} onClick={handleEnableTotp}>
                  Generar Clave y Activar 2FA
                </button>
              ) : (
                <>
                  <button type="button" className="pk-btn pk-btn-outline" disabled={busy} onClick={handleEnableTotp}>
                    Regenerar Secreto 2FA
                  </button>
                  {!me?.mfaRequired && (
                    <button type="button" className="pk-btn pk-btn-danger" disabled={busy} onClick={handleDisableTotp}>
                      Desactivar 2FA
                    </button>
                  )}
                </>
              )}
            </div>

            {totpSecret && (
              <div style={{ marginTop: 14 }}>
                <div className="pk-label">Clave Base32 (cópiala en tu app autenticadora)</div>
                <div className="pk-cred-box" style={{ wordBreak: 'break-all' }}>{totpSecret}</div>
                {totpUri && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--pk-muted)', wordBreak: 'break-all' }}>
                    {totpUri}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--pk-border)', paddingTop: 14 }}>
            <div className="pk-label">Permisos Efectivos de tu Rol</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {platformPermissions.map((p) => (
                <span key={p} className="pk-badge pk-badge-slate">
                  {p === '*' ? 'Acceso Total (*)' : p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">Cambiar Mi Contraseña Corporativa</div>
        </div>
        <div className="pk-card-body">
          <form onSubmit={handleChangePassword} className="pk-stack">
            <div className="pk-field">
              <label htmlFor="me-cur-pass">Contraseña Actual</label>
              <input
                id="me-cur-pass"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Tu contraseña actual"
              />
            </div>
            <div className="pk-field">
              <label htmlFor="me-new-pass">Nueva Contraseña (mínimo 8 caracteres)</label>
              <input
                id="me-new-pass"
                type="password"
                minLength={8}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña segura"
              />
            </div>
            <div className="pk-row-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                {busy ? 'Actualizando...' : 'Actualizar Contraseña'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
