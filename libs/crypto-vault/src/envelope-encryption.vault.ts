import crypto from 'node:crypto';
import { PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface PlainDatabaseCredentials {
  host: string;
  adminPort: number;
  poolerPort: number;
  dbName: string;
  username: string;
  password: string;
}

export interface EncryptedConnectionEnvelope {
  version: 1;
  tenantId: string;
  cellId: string;
  kekId: string;
  encryptedDekB64: string;
  dekIvB64: string;
  dekAuthTagB64: string;
  encryptedCredentialsB64: string;
  credentialsIvB64: string;
  credentialsAuthTagB64: string;
}

export interface KekKeyRingConfig {
  activeKekId: string;
  /** Mapa de kekId -> clave hexadecimal de 64 caracteres (32 bytes / 256 bits) */
  keysHex: Record<string, string>;
}

/**
 * Implementación de Envelope Encryption (KEK + DEK por Tenant) con AES-256-GCM y AAD [P1-03]
 * Garantiza que en Redis y en proveko_control_db jamás existan credenciales en texto plano
 * y permite rotación de KEK sin re-cifrar las credenciales ni tumbar conexiones.
 */
export class EnvelopeCryptoVault {
  private readonly activeKekId: string;
  private readonly keyRing: Map<string, Buffer>;

  constructor(config: KekKeyRingConfig) {
    this.activeKekId = config.activeKekId;
    this.keyRing = new Map<string, Buffer>();

    for (const [id, hex] of Object.entries(config.keysHex)) {
      const buf = Buffer.from(hex, 'hex');
      if (buf.byteLength !== 32) {
        throw new Error(`Invalid KEK length for "${id}": expected 32 bytes (64 hex chars).`);
      }
      this.keyRing.set(id, buf);
    }

    if (!this.keyRing.has(this.activeKekId)) {
      throw new Error(`Active KEK "${this.activeKekId}" not found in keyRing.`);
    }
  }

  private buildAad(tenantId: string, cellId: string): Buffer {
    return Buffer.from(`proveko:envelope:v1:${tenantId}:${cellId}`, 'utf8');
  }

  public sealDatabaseCredentials(
    tenantId: string,
    cellId: string,
    credentials: PlainDatabaseCredentials,
  ): EncryptedConnectionEnvelope {
    const kek = this.keyRing.get(this.activeKekId)!;
    const aad = this.buildAad(tenantId, cellId);

    // 1. Generar DEK única de 256 bits (32 bytes) para este tenant
    const dek = crypto.randomBytes(32);

    // 2. Cifrar las credenciales con la DEK usando AES-256-GCM + AAD
    const credentialsIv = crypto.randomBytes(12);
    const credCipher = crypto.createCipheriv('aes-256-gcm', dek, credentialsIv);
    credCipher.setAAD(aad);
    const serialized = Buffer.from(JSON.stringify(credentials), 'utf8');
    const encryptedCredentials = Buffer.concat([
      credCipher.update(serialized),
      credCipher.final(),
    ]);
    const credentialsAuthTag = credCipher.getAuthTag();

    // 3. Envolver (cifrar) la DEK con la KEK activa usando AES-256-GCM + AAD
    const dekIv = crypto.randomBytes(12);
    const dekCipher = crypto.createCipheriv('aes-256-gcm', kek, dekIv);
    dekCipher.setAAD(aad);
    const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
    const dekAuthTag = dekCipher.getAuthTag();

    // Limpiar DEK en memoria
    dek.fill(0);

    return {
      version: 1,
      tenantId,
      cellId,
      kekId: this.activeKekId,
      encryptedDekB64: encryptedDek.toString('base64'),
      dekIvB64: dekIv.toString('base64'),
      dekAuthTagB64: dekAuthTag.toString('base64'),
      encryptedCredentialsB64: encryptedCredentials.toString('base64'),
      credentialsIvB64: credentialsIv.toString('base64'),
      credentialsAuthTagB64: credentialsAuthTag.toString('base64'),
    };
  }

  public unsealDatabaseCredentials(
    envelope: EncryptedConnectionEnvelope,
    expectedTenantId: string,
    expectedCellId: string,
  ): PlainDatabaseCredentials {
    if (envelope.tenantId !== expectedTenantId || envelope.cellId !== expectedCellId) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        403,
        'Envelope tenant/cell mismatch detected (anti-tampering AAD guard).',
      );
    }

    const kek = this.keyRing.get(envelope.kekId);
    if (!kek) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        500,
        `Unknown KEK ID "${envelope.kekId}" when unsealing tenant credentials.`,
      );
    }

    const aad = this.buildAad(expectedTenantId, expectedCellId);

    try {
      // 1. Desenvolver la DEK usando la KEK correspondiente
      const dekDecipher = crypto.createDecipheriv(
        'aes-256-gcm',
        kek,
        Buffer.from(envelope.dekIvB64, 'base64'),
      );
      dekDecipher.setAAD(aad);
      dekDecipher.setAuthTag(Buffer.from(envelope.dekAuthTagB64, 'base64'));
      const dek = Buffer.concat([
        dekDecipher.update(Buffer.from(envelope.encryptedDekB64, 'base64')),
        dekDecipher.final(),
      ]);

      // 2. Descifrar las credenciales con la DEK en RAM privada
      const credDecipher = crypto.createDecipheriv(
        'aes-256-gcm',
        dek,
        Buffer.from(envelope.credentialsIvB64, 'base64'),
      );
      credDecipher.setAAD(aad);
      credDecipher.setAuthTag(Buffer.from(envelope.credentialsAuthTagB64, 'base64'));
      const plainBuf = Buffer.concat([
        credDecipher.update(Buffer.from(envelope.encryptedCredentialsB64, 'base64')),
        credDecipher.final(),
      ]);

      dek.fill(0);
      return JSON.parse(plainBuf.toString('utf8')) as PlainDatabaseCredentials;
    } catch {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        403,
        'Cryptographic verification failed while unsealing tenant database envelope.',
      );
    }
  }

  /**
   * Re-envuelve únicamente la DEK hacia la nueva KEK activa sin tocar las credenciales cifradas (Rotación sin downtime)
   */
  public reWrapEnvelopeToActiveKek(
    envelope: EncryptedConnectionEnvelope,
  ): EncryptedConnectionEnvelope {
    if (envelope.kekId === this.activeKekId) {
      return envelope;
    }

    const oldKek = this.keyRing.get(envelope.kekId);
    const newKek = this.keyRing.get(this.activeKekId)!;
    if (!oldKek) {
      throw new Error(`Old KEK "${envelope.kekId}" not found in keyRing.`);
    }

    const aad = this.buildAad(envelope.tenantId, envelope.cellId);

    const dekDecipher = crypto.createDecipheriv(
      'aes-256-gcm',
      oldKek,
      Buffer.from(envelope.dekIvB64, 'base64'),
    );
    dekDecipher.setAAD(aad);
    dekDecipher.setAuthTag(Buffer.from(envelope.dekAuthTagB64, 'base64'));
    const dek = Buffer.concat([
      dekDecipher.update(Buffer.from(envelope.encryptedDekB64, 'base64')),
      dekDecipher.final(),
    ]);

    const newDekIv = crypto.randomBytes(12);
    const dekCipher = crypto.createCipheriv('aes-256-gcm', newKek, newDekIv);
    dekCipher.setAAD(aad);
    const newEncryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
    const newDekAuthTag = dekCipher.getAuthTag();

    dek.fill(0);

    return {
      ...envelope,
      kekId: this.activeKekId,
      encryptedDekB64: newEncryptedDek.toString('base64'),
      dekIvB64: newDekIv.toString('base64'),
      dekAuthTagB64: newDekAuthTag.toString('base64'),
    };
  }
}
