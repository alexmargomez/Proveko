import React, { useState } from 'react';
import { TenantSummary, usePlatform } from '@platform/ui-sdk';
import { PkIcon } from '../components/ServiceIcons';

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
  const [showPass, setShowPass] = useState(false);
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
    <div style={{ minHeight: '100vh', background: 'var(--pk-bg)', display: 'flex', flexDirection: 'column' }}>
      <header className="pk-topbar">
        <div className="pk-brand">
          <span className="pk-logo-box">PK</span>
          <div className="pk-brand-meta">
            <div className="pk-brand-title">
              <span>PROVEKO</span>
              <span style={{ color: '#cbd5e1', fontWeight: 400 }}>|</span>
              <span style={{ color: 'var(--pk-primary)', fontWeight: 700, fontSize: 14 }}>
                Consola de Administración de Plataforma
              </span>
            </div>
            <div className="pk-brand-sub">Acceso restringido al equipo interno de operaciones, soporte y desarrollo</div>
          </div>
        </div>
        <a href="/" className="pk-btn pk-btn-outline pk-btn-sm" style={{ textDecoration: 'none' }}>
          ← Ir al Portal de Clientes
        </a>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div
          className="pk-card"
          style={{
            width: '100%',
            maxWidth: 460,
            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
          }}
        >
          <div className="pk-card-head" style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: '#eff6ff',
                  color: 'var(--pk-primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PkIcon name="shield" size={20} />
              </span>
              <div>
                <div className="pk-card-title" style={{ fontSize: 16 }}>
                  {requiresTotp ? 'Verificación de Seguridad 2FA' : 'Ingreso de Personal Interno'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
                  {requiresTotp
                    ? 'Valida el código temporal de tu aplicación autenticadora'
                    : 'Ingresa con tu cuenta corporativa de operador'}
                </div>
              </div>
            </div>
          </div>

          <div className="pk-card-body" style={{ padding: 22 }}>
            {errorMsg && (
              <div
                role="alert"
                style={{
                  background: 'var(--pk-rose-soft)',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  padding: '10px 12px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 600,
                  marginBottom: 14,
                }}
              >
                {errorMsg}
              </div>
            )}

            {!requiresTotp ? (
              <form onSubmit={(e) => void handlePasswordSubmit(e)} className="pk-stack">
                <div className="pk-field">
                  <label htmlFor="admin-email">Correo Corporativo</label>
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="superadmin@plataforma.local"
                    required
                    autoFocus
                  />
                </div>
                <div className="pk-field">
                  <label htmlFor="admin-pass">
                    <span>Contraseña</span>
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
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
                      {showPass ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </label>
                  <input
                    id="admin-pass"
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    required
                  />
                </div>
                <button type="submit" className="pk-btn pk-btn-primary" disabled={loading} style={{ width: '100%', padding: '10px 16px' }}>
                  {loading ? 'Validando credenciales...' : 'Entrar a la Consola Administrativa'}
                </button>
              </form>
            ) : (
              <form onSubmit={(e) => void handleTotpSubmit(e)} className="pk-stack">
                {totpSetupSecret && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--pk-border-strong)',
                      borderRadius: 10,
                      padding: 14,
                      fontSize: 12.5,
                    }}
                  >
                    <div style={{ fontWeight: 800, color: 'var(--pk-navy)', marginBottom: 4 }}>
                      Configuración inicial de 2FA requerida
                    </div>
                    <div style={{ color: 'var(--pk-muted)', marginBottom: 8 }}>
                      Registra esta clave secreta Base32 en Google Authenticator, Authy o Microsoft Authenticator:
                    </div>
                    <div className="pk-cred-box" style={{ padding: '10px 12px', wordBreak: 'break-all' }}>
                      {totpSetupSecret}
                    </div>
                    {totpSetupUri && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--pk-muted)', wordBreak: 'break-all' }}>
                        {totpSetupUri}
                      </div>
                    )}
                  </div>
                )}
                <div className="pk-field">
                  <label htmlFor="admin-totp">Código Temporal de 6 Dígitos</label>
                  <input
                    id="admin-totp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    required
                    autoFocus
                    style={{ letterSpacing: '0.32em', fontWeight: 800, fontSize: 20, textAlign: 'center' }}
                  />
                </div>
                <button type="submit" className="pk-btn pk-btn-primary" disabled={loading || totpCode.length !== 6} style={{ width: '100%', padding: '10px 16px' }}>
                  {loading ? 'Verificando código...' : 'Confirmar Código y Entrar'}
                </button>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline"
                  style={{ width: '100%' }}
                  onClick={() => {
                    setRequiresTotp(false);
                    setChallengeToken('');
                    setTotpCode('');
                  }}
                >
                  Volver al inicio de sesión
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
