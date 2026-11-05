import crypto from 'node:crypto';
import {
  type MicroserviceKey,
  type ModuleKey,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
  type ParentMicroserviceKey,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  type ServiceKey,
} from '@proveko/shared-kernel';

export const DEFAULT_PROVEKO_CLUSTER_SECRET = 'proveko-default-cluster-hmac-secret-2026';

export interface ClusterSignaturePayload {
  method: string;
  pathAndQuery: string;
  targetParent: ServiceKey | ParentMicroserviceKey | string;
  targetModule: MicroserviceKey | ModuleKey | string;
  authorizationHeader?: string;
  timestampSeconds?: number;
}

export interface SignedClusterHeaders {
  'x-proveko-cluster-ts': string;
  'x-proveko-cluster-sig': string;
}

/**
 * Sello Criptográfico de Clúster (`HMAC-SHA256` + Anti-Replay Timestamp):
 * Blindaje entre el `api-gateway` y los Microservicios (`ms:*`), especialmente
 * cuando un Microservicio se instala fuera en otro VPS / servidor dedicado.
 *
 * Garantiza que ningún actor externo pueda llamar directamente a la URL de un
 * microservicio (ni siquiera teniendo un JWT válido de usuario) sin pasar por el `api-gateway`.
 */
export class ClusterHmacGuard {
  private readonly secretKeyBuffer: Buffer;

  constructor(
    clusterSecret: string = process.env.PROVEKO_CLUSTER_SECRET ?? DEFAULT_PROVEKO_CLUSTER_SECRET,
    private readonly maxClockSkewSeconds: number = 30,
  ) {
    if (!clusterSecret || clusterSecret.trim().length < 16) {
      throw new Error('PROVEKO_CLUSTER_SECRET must be at least 16 characters long.');
    }
    this.secretKeyBuffer = Buffer.from(clusterSecret, 'utf8');
  }

  private buildCanonicalString(
    timestampSeconds: number,
    payload: ClusterSignaturePayload,
  ): string {
    const method = payload.method.toUpperCase();
    const pathAndQuery = payload.pathAndQuery.startsWith('/')
      ? payload.pathAndQuery
      : `/${payload.pathAndQuery}`;
    const normalizedParent = normalizeParentMicroserviceKey(
      payload.targetParent as ParentMicroserviceKey,
    );
    const normalizedModule = normalizeModuleKey(payload.targetModule as ModuleKey);
    const authHash = crypto
      .createHash('sha256')
      .update(payload.authorizationHeader ?? '', 'utf8')
      .digest('hex');

    return `${timestampSeconds}\n${method}\n${pathAndQuery}\n${normalizedParent}\n${normalizedModule}\n${authHash}`;
  }

  public signOutboundRequest(payload: ClusterSignaturePayload): SignedClusterHeaders {
    const ts = payload.timestampSeconds ?? Math.floor(Date.now() / 1000);
    const canonical = this.buildCanonicalString(ts, payload);
    const signature = crypto
      .createHmac('sha256', this.secretKeyBuffer)
      .update(canonical, 'utf8')
      .digest('hex');

    return {
      'x-proveko-cluster-ts': String(ts),
      'x-proveko-cluster-sig': signature,
    };
  }

  public verifyInboundRequest(
    headers: Record<string, string | string[] | undefined>,
    payload: Omit<ClusterSignaturePayload, 'timestampSeconds'>,
    nowSeconds: number = Math.floor(Date.now() / 1000),
  ): void {
    const rawTs = headers['x-proveko-cluster-ts'];
    const rawSig = headers['x-proveko-cluster-sig'];

    const tsStr = Array.isArray(rawTs) ? rawTs[0] : rawTs;
    const sigStr = Array.isArray(rawSig) ? rawSig[0] : rawSig;

    if (!tsStr || !sigStr) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_CLUSTER_SIGNATURE_INVALID,
        403,
        'Direct access to microservice endpoint is forbidden: missing cluster gateway HMAC signature headers.',
      );
    }

    const parsedTs = Number(tsStr);
    if (!Number.isInteger(parsedTs) || Math.abs(nowSeconds - parsedTs) > this.maxClockSkewSeconds) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_CLUSTER_SIGNATURE_INVALID,
        403,
        'Cluster gateway HMAC signature timestamp is expired or out of tolerance window (anti-replay triggered).',
        { timestamp: tsStr, max_skew_seconds: this.maxClockSkewSeconds },
      );
    }

    const canonical = this.buildCanonicalString(parsedTs, payload);
    const expectedHex = crypto
      .createHmac('sha256', this.secretKeyBuffer)
      .update(canonical, 'utf8')
      .digest('hex');

    const providedBuf = Buffer.from(sigStr, 'utf8');
    const expectedBuf = Buffer.from(expectedHex, 'utf8');

    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_CLUSTER_SIGNATURE_INVALID,
        403,
        'Invalid cluster gateway HMAC signature: request did not originate from an authorized Proveko API Gateway.',
      );
    }
  }
}
