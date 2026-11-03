import crypto from 'node:crypto';
import { PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';
import type { PasswordHasherPort } from '../../application/ports/outbound.ports.js';

export interface BulkheadHasherOptions {
  maxConcurrentHashes?: number;
  maxQueueSize?: number;
}

/**
 * Hasher de Contraseñas con Semáforo de Concurrencia (Bulkhead Pattern) [P1-04] & [P2-04]
 * Impide que una ráfaga de logins sature los hilos de `libuv` o dispare la RAM del contenedor `core-service`.
 */
export class BulkheadPasswordHasher implements PasswordHasherPort {
  private readonly maxConcurrent: number;
  private readonly maxQueueSize: number;
  private activeCount = 0;
  private waitQueue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];

  constructor(options?: BulkheadHasherOptions) {
    this.maxConcurrent = options?.maxConcurrentHashes ?? 4;
    this.maxQueueSize = options?.maxQueueSize ?? 20;
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getQueueLength(): number {
    return this.waitQueue.length;
  }

  private async acquireSlot(): Promise<void> {
    if (this.activeCount < this.maxConcurrent) {
      this.activeCount += 1;
      return;
    }

    if (this.waitQueue.length >= this.maxQueueSize) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_AUTH_BUSY_BULKHEAD,
        429,
        'Authentication bulkhead capacity reached; please retry in a moment.',
        {
          max_concurrent: this.maxConcurrent,
          max_queue: this.maxQueueSize,
        },
      );
    }

    await new Promise<void>((resolve, reject) => {
      this.waitQueue.push({ resolve, reject });
    });
    this.activeCount += 1;
  }

  private releaseSlot(): void {
    this.activeCount -= 1;
    const next = this.waitQueue.shift();
    if (next) {
      next.resolve();
    }
  }

  public async hashPassword(plain: string): Promise<string> {
    await this.acquireSlot();
    try {
      const salt = crypto.randomBytes(16);
      const derived = await new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(
          plain,
          salt,
          64,
          { N: 16384, r: 8, p: 1 },
          (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
          },
        );
      });
      return `scrypt$16384$8$1$${salt.toString('base64')}$${derived.toString('base64')}`;
    } finally {
      this.releaseSlot();
    }
  }

  public async verifyPassword(plain: string, storedHash: string): Promise<boolean> {
    await this.acquireSlot();
    try {
      const parts = storedHash.split('$');
      if (parts.length !== 6 || parts[0] !== 'scrypt') {
        return false;
      }
      const salt = Buffer.from(parts[4]!, 'base64');
      const expected = Buffer.from(parts[5]!, 'base64');

      const derived = await new Promise<Buffer>((resolve, reject) => {
        crypto.scrypt(
          plain,
          salt,
          expected.byteLength,
          { N: 16384, r: 8, p: 1 },
          (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
          },
        );
      });

      return crypto.timingSafeEqual(derived, expected);
    } finally {
      this.releaseSlot();
    }
  }
}
