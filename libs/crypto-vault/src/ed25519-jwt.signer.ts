import crypto from 'node:crypto';
import {
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  type ProvekoJwtClaims,
} from '@proveko/shared-kernel';

export interface Ed25519KeyPairEntry {
  kid: string;
  privateKeyPem?: string;
  publicKeyPem: string;
}

export interface SignJwtInput {
  tenant_id: string;
  cell_id: string;
  user_id: string;
  role_key: string;
  tier: ProvekoJwtClaims['tier'];
  is_sandbox: boolean;
  active_branch_id: string;
  allowed_branch_ids: string[];
  sub_ver: number;
  services: ProvekoJwtClaims['services'];
  readonly_microservices: ProvekoJwtClaims['readonly_microservices'];
  ttlSeconds?: number;
}

/**
 * Emisor y Verificador Asimétrico EdDSA (Ed25519) Zero-Trust con soporte de Key Ring por `kid` [P1-05]
 * Permite firmar en core-service y verificar localmente en <0.1ms en api-gateway y en cada microservicio.
 */
export class Ed25519JwtVault {
  private readonly activeKid: string;
  private readonly privateKeys = new Map<string, crypto.KeyObject>();
  private readonly publicKeys = new Map<string, crypto.KeyObject>();
  private readonly issuer = 'https://auth.proveko.com';
  private readonly audience = 'proveko-api';

  constructor(activeKid: string, entries: Ed25519KeyPairEntry[]) {
    this.activeKid = activeKid;
    for (const entry of entries) {
      this.publicKeys.set(entry.kid, crypto.createPublicKey(entry.publicKeyPem));
      if (entry.privateKeyPem) {
        this.privateKeys.set(entry.kid, crypto.createPrivateKey(entry.privateKeyPem));
      }
    }
  }

  public static generateKeyPairEntry(kid: string): Ed25519KeyPairEntry {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return {
      kid,
      privateKeyPem: privateKey,
      publicKeyPem: publicKey,
    };
  }

  /**
   * Deriva determinísticamente un par de llaves Ed25519 (PKCS#8 + SPKI PEM) a partir de una semilla maestra (`JWT_MASTER_SEED`),
   * permitiendo que múltiples contenedores de microservicios independientes verifiquen firmas sin requerir PEMs multilínea en `.env`.
   */
  public static deriveDeterministicKeyPairEntry(
    kid: string,
    seedSecret: string,
  ): Ed25519KeyPairEntry {
    const seed32 = crypto.createHash('sha256').update(seedSecret, 'utf8').digest();
    const pkcs8Header = Buffer.from('302e020100300506032b657004220420', 'hex');
    const pkcs8Der = Buffer.concat([pkcs8Header, seed32]);
    const privKeyObj = crypto.createPrivateKey({
      key: pkcs8Der,
      format: 'der',
      type: 'pkcs8',
    });
    const pubKeyObj = crypto.createPublicKey(privKeyObj);
    return {
      kid,
      privateKeyPem: privKeyObj.export({ type: 'pkcs8', format: 'pem' }).toString(),
      publicKeyPem: pubKeyObj.export({ type: 'spki', format: 'pem' }).toString(),
    };
  }

  public signAccessToken(input: SignJwtInput, nowEpochSeconds?: number): string {
    const privateKey = this.privateKeys.get(this.activeKid);
    if (!privateKey) {
      throw new Error(`No private key loaded for active kid "${this.activeKid}".`);
    }

    const iat = nowEpochSeconds ?? Math.floor(Date.now() / 1000);
    const exp = iat + (input.ttlSeconds ?? 900); // 15 min por defecto

    const header = {
      alg: 'EdDSA',
      typ: 'JWT',
      kid: this.activeKid,
    };

    const payload: ProvekoJwtClaims = {
      iss: this.issuer,
      aud: this.audience,
      jti: `tok-${crypto.randomUUID()}`,
      iat,
      exp,
      tenant_id: input.tenant_id,
      cell_id: input.cell_id,
      user_id: input.user_id,
      role_key: input.role_key,
      tier: input.tier,
      is_sandbox: input.is_sandbox,
      active_branch_id: input.active_branch_id,
      allowed_branch_ids: [...input.allowed_branch_ids],
      sub_ver: input.sub_ver,
      services: input.services,
      readonly_microservices: [...input.readonly_microservices],
    };

    const encodedHeader = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .sign(null, Buffer.from(signingInput, 'utf8'), privateKey)
      .toString('base64url');

    return `${signingInput}.${signature}`;
  }

  public verifyAccessToken(token: string, nowEpochSeconds?: number): ProvekoJwtClaims {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        'Malformed JWT token structure.',
      );
    }

    const [encodedHeader, encodedPayload, encodedSig] = parts as [string, string, string];

    let header: { alg?: string; kid?: string };
    let claims: ProvekoJwtClaims;
    try {
      header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
      claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        'Invalid JSON encoding in JWT token.',
      );
    }

    if (header.alg !== 'EdDSA' || !header.kid) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        'Unsupported JWT algorithm or missing kid.',
      );
    }

    const publicKey = this.publicKeys.get(header.kid);
    if (!publicKey) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        `Unknown signing key kid "${header.kid}".`,
      );
    }

    const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8');
    const signatureBuf = Buffer.from(encodedSig, 'base64url');

    const isValidSignature = crypto.verify(null, signingInput, publicKey, signatureBuf);
    if (!isValidSignature) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        'Invalid Ed25519 cryptographic signature.',
      );
    }

    if (claims.iss !== this.issuer || claims.aud !== this.audience) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        'Invalid token issuer or audience.',
      );
    }

    const now = nowEpochSeconds ?? Math.floor(Date.now() / 1000);
    if (claims.exp <= now) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_EXPIRED,
        401,
        'Access token has expired.',
      );
    }

    return claims;
  }
}
