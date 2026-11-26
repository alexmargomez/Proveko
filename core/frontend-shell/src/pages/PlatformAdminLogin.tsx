import React, { useState } from 'react';
import { TenantSummary, usePlatform } from '@platform/ui-sdk';

interface LoginResp {
  ok: boolean;
  plane?: string;
  requiresTotp?: boolean;
  requiresTotpSetup?: boolean;
  challengeToken?: string;
  totpSetupSecret?: string;
  totpSetupUri?: string;
  token?: string;
  role?: string;
  internalRole?: string;
  platformRole?: string;
  platformPermissions?: string[];
  allowedTenants?: string[];
  requireDataReason?: boolean;
  username?: string;
  fullName?: string;
  isCompanyAdmin?: boolean;
  isDemo?: boolean;
  tenant?: TenantSummary | null;
  companyTenant?: TenantSummary | null;
  error?: string;
}

export const PlatformAdminLogin: React.FC = () => {
  const { loginWithToken, toast } = usePlatform();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [totpSetupSecret, setTotpSetupSecret] = useState('');
  const [totpSetupUri, setTotpSetupUri] = useState('');
  const [requiresTotp, setRequiresTotp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const completeLogin = (data: LoginResp) => {
    if (data.plane !== 'platform' && data.role !== 'superadmin') {
      setErrorMsg('Esta consola es exclusiva para personal interno de plataforma. Ingresa por el portal principal de clientes.');
      return;
    }
    loginWithToken(data.token || '', data.role || 'platform_staff', data.username || email, data.tenant || null, {
      plane: 'platform',
      fullName: data.fullName,
      internalRole: data.internalRole,
      platformRole: data.platformRole,
      platformPermissions: data.platformPermissions,
      allowedTenants: data.allowedTenants,
      requireDataReason: data.requireDataReason,
      isCompanyAdmin: data.isCompanyAdmin,
      isDemo: false,
      companyTenant: data.companyTenant || data.tenant || null,
    });
    toast(`Bienvenido a la Consola de Plataforma (${data.platformRole || data.role})`);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const resp = await fetch('/api/v1/core/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim(), password }),
      });
      const data = (await resp.json()) as LoginResp;
      if (!resp.ok) {
        setErrorMsg(data.error || 'Credenciales inválidas');
        return;
      }
      if (data.requiresTotp && data.challengeToken) {
        setRequiresTotp(true);
        setChallengeToken(data.challengeToken);
        setTotpSetupSecret(data.totpSetupSecret || '');
        setTotpSetupUri(data.totpSetupUri || '');
        return;
      }
      completeLogin(data);
    } catch {
      setErrorMsg('No fue posible conectar con el servidor de autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const resp = await fetch('/api/v1/core/verify-totp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken, code: totpCode.trim() }),
      });
      const data = (await resp.json()) as LoginResp;
      if (!resp.ok) {
        setErrorMsg(data.error || 'Código 2FA inválido o expirado');
        return;
      }
      completeLogin(data);
    } catch {
      setErrorMsg('Error verificando código de seguridad 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #021d2e 0%, #023047 55%, #074160 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="pk-card"
        style={{
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255,255,255,0.14)',
        }}
      >
        <div
          className="pk-card-head"
          style={{
            background: '#023047',
            color: '#ffffff',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 6,
            padding: '20px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="pk-logo-box">PK</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.02em' }}>PROVEKO PLATFORM</div>
              <div style={{ fontSize: 12, color: '#94d2bd' }}>Consola de Administración Interna</div>
            </div>
          </div>
        </div>

        <div className="pk-card-body" style={{ padding: 24 }}>
          {errorMsg && (
            <div
              role="alert"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '10px 12px',
                borderRadius: 8,
                fontSize: 13,
                marginBottom: 14,
              }}
            >
              {errorMsg}
            </div>
          )}

          {!requiresTotp ? (
            <form onSubmit={(e) => void handlePasswordSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="pk-label" htmlFor="admin-email">Correo corporativo de operador</label>
                <input
                  id="admin-email"
                  type="email"
                  className="pk-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@plataforma.local"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="pk-label" htmlFor="admin-pass">Contraseña</label>
                <input
                  id="admin-pass"
                  type="password"
                  className="pk-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>
              <button type="submit" className="pk-btn pk-btn-primary" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Validando acceso...' : 'Ingresar a Consola de Plataforma'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 6 }}>
                <a href="/" style={{ fontSize: 12.5, color: 'var(--pk-muted)', textDecoration: 'none' }}>
                  ← Volver al portal de empresas clientes
                </a>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => void handleTotpSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13.5, color: 'var(--pk-text)' }}>
                <strong>Verificación en dos pasos (2FA TOTP)</strong>
                <div style={{ fontSize: 12.5, color: 'var(--pk-muted)', marginTop: 4 }}>
                  Ingresa el código temporal de 6 dígitos generado por tu aplicación autenticadora.
                </div>
              </div>
              {totpSetupSecret && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>Configuración inicial 2FA requerida</div>
                  <div style={{ color: 'var(--pk-muted)', marginBottom: 6 }}>
                    Registra esta clave en Google Authenticator, Authy o Microsoft Authenticator:
                  </div>
                  <code style={{ display: 'block', padding: '6px 8px', background: '#fff', borderRadius: 6, wordBreak: 'break-all' }}>
                    {totpSetupSecret}
                  </code>
                  {totpSetupUri && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--pk-muted)', wordBreak: 'break-all' }}>
                      URI: {totpSetupUri}
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="pk-label" htmlFor="admin-totp">Código de 6 dígitos</label>
                <input
                  id="admin-totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="pk-input"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  required
                  autoFocus
                  style={{ letterSpacing: '0.28em', fontWeight: 700, fontSize: 18, textAlign: 'center' }}
                />
              </div>
              <button type="submit" className="pk-btn pk-btn-primary" disabled={loading || totpCode.length !== 6} style={{ width: '100%' }}>
                {loading ? 'Verificando...' : 'Verificar y Entrar'}
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-outline pk-btn-sm"
                onClick={() => {
                  setRequiresTotp(false);
                  setChallengeToken('');
                  setTotpCode('');
                }}
              >
                Cancelar y volver
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
