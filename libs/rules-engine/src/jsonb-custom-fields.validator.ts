import { PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface CustomFieldsGuardOptions {
  maxBytes?: number;
  maxDepth?: number;
  maxKeys?: number;
}

/**
 * Protección del Event Loop contra JSONB Bombs (tamaño <= 32KB, profundidad <= 3, llaves <= 50)
 * y Filtro Anti-SSRF post-DNS para Webhooks configurados por inquilinos [P2-04]
 */
export class CustomFieldsAndWebhookGuard {
  private static readonly DEFAULT_MAX_BYTES = 32 * 1024; // 32 KB
  private static readonly DEFAULT_MAX_DEPTH = 3;
  private static readonly DEFAULT_MAX_KEYS = 50;

  public static validateCustomFieldsPayload(
    customFields: unknown,
    options?: CustomFieldsGuardOptions,
  ): Record<string, unknown> {
    if (
      typeof customFields !== 'object' ||
      customFields === null ||
      Array.isArray(customFields)
    ) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        'custom_fields must be a flat or bounded JSON object.',
      );
    }

    const maxBytes = options?.maxBytes ?? this.DEFAULT_MAX_BYTES;
    const maxDepth = options?.maxDepth ?? this.DEFAULT_MAX_DEPTH;
    const maxKeys = options?.maxKeys ?? this.DEFAULT_MAX_KEYS;

    const serialized = JSON.stringify(customFields);
    if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `custom_fields payload exceeds maximum size of ${maxBytes} bytes.`,
      );
    }

    let keyCount = 0;

    const inspectDepth = (node: unknown, currentDepth: number): void => {
      if (currentDepth > maxDepth) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
          422,
          `custom_fields nesting depth exceeds maximum allowed depth of ${maxDepth}.`,
        );
      }

      if (typeof node === 'object' && node !== null) {
        const entries = Array.isArray(node) ? node.entries() : Object.entries(node);
        for (const [, val] of entries) {
          keyCount += 1;
          if (keyCount > maxKeys) {
            throw new ProvekoDomainError(
              PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
              422,
              `custom_fields exceeds maximum total keys count of ${maxKeys}.`,
            );
          }
          if (typeof val === 'object' && val !== null) {
            inspectDepth(val, currentDepth + 1);
          }
        }
      }
    };

    inspectDepth(customFields, 1);
    return customFields as Record<string, unknown>;
  }

  /**
   * Valida que una IP resuelta por DNS no pertenezca a rangos privados, loopback o AWS/Cloud Metadata (Anti-SSRF)
   */
  public static assertPublicWebhookTargetIp(resolvedIp: string): void {
    const normalized = resolvedIp.trim().toLowerCase();

    if (
      normalized === '::1' ||
      normalized === '0.0.0.0' ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('fc00:') ||
      normalized.startsWith('fd00:')
    ) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `SSRF protection blocked private/loopback IPv6 address: ${resolvedIp}`,
      );
    }

    const ipv4Parts = normalized.split('.').map((p) => Number(p));
    if (ipv4Parts.length === 4 && ipv4Parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
      const [a, b] = ipv4Parts as [number, number, number, number];
      const isPrivateOrReserved =
        a === 10 ||
        a === 127 ||
        a === 0 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254) || // Cloud metadata 169.254.169.254
        (a === 100 && b >= 64 && b <= 127);

      if (isPrivateOrReserved) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
          422,
          `SSRF protection blocked internal/private IPv4 address: ${resolvedIp}`,
        );
      }
    }
  }
}
