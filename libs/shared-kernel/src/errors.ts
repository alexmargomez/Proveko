export const PROVEKO_ERROR_CODES = {
  ERR_SUB_VER_STALE: 'ERR_SUB_VER_STALE',
  ERR_TOKEN_EXPIRED: 'ERR_TOKEN_EXPIRED',
  ERR_TOKEN_INVALID: 'ERR_TOKEN_INVALID',
  ERR_PARENT_SERVICE_DISABLED: 'ERR_PARENT_SERVICE_DISABLED',
  ERR_PARENT_MICROSERVICE_DISABLED: 'ERR_PARENT_MICROSERVICE_DISABLED',
  ERR_MICROSERVICE_DISABLED: 'ERR_MICROSERVICE_DISABLED',
  ERR_MODULE_DISABLED: 'ERR_MODULE_DISABLED',
  ERR_MICROSERVICE_READONLY_ARCHIVE: 'ERR_MICROSERVICE_READONLY_ARCHIVE',
  ERR_MODULE_READONLY_ARCHIVE: 'ERR_MODULE_READONLY_ARCHIVE',
  ERR_MUTEX_GROUP_CONFLICT: 'ERR_MUTEX_GROUP_CONFLICT',
  ERR_DEPENDENT_MICROSERVICES_ACTIVE: 'ERR_DEPENDENT_MICROSERVICES_ACTIVE',
  ERR_MISSING_PREREQUISITES: 'ERR_MISSING_PREREQUISITES',
  ERR_BRANCH_FORBIDDEN: 'ERR_BRANCH_FORBIDDEN',
  ERR_INVALID_THEME_TOKEN: 'ERR_INVALID_THEME_TOKEN',
  ERR_AUTH_BUSY_BULKHEAD: 'ERR_AUTH_BUSY_BULKHEAD',
  ERR_CELL_CAPACITY_EXHAUSTED: 'ERR_CELL_CAPACITY_EXHAUSTED',
  ERR_SANDBOX_POOL_EMPTY: 'ERR_SANDBOX_POOL_EMPTY',
  ERR_NOT_FOUND: 'ERR_NOT_FOUND',
  ERR_VALIDATION_FAILED: 'ERR_VALIDATION_FAILED',
  ERR_RATE_LIMIT_EXCEEDED: 'ERR_RATE_LIMIT_EXCEEDED',
  ERR_UPSTREAM_UNAVAILABLE: 'ERR_UPSTREAM_UNAVAILABLE',
  ERR_PAYMENT_AMOUNT_MISMATCH: 'ERR_PAYMENT_AMOUNT_MISMATCH',
  ERR_ACCOUNTING_IMBALANCE: 'ERR_ACCOUNTING_IMBALANCE',
  ERR_MIGRATION_CHECKSUM_DRIFT: 'ERR_MIGRATION_CHECKSUM_DRIFT',
  ERR_MIGRATION_LOCK_TIMEOUT: 'ERR_MIGRATION_LOCK_TIMEOUT',
  ERR_BACKUP_INTEGRITY_FAILED: 'ERR_BACKUP_INTEGRITY_FAILED',
  ERR_CLUSTER_SIGNATURE_INVALID: 'ERR_CLUSTER_SIGNATURE_INVALID',
} as const;

export type ProvekoErrorCode = (typeof PROVEKO_ERROR_CODES)[keyof typeof PROVEKO_ERROR_CODES];

export interface ProblemDetailsRfc9457 {
  type: string;
  title: string;
  status: number;
  detail: string;
  error_code: ProvekoErrorCode;
  metadata?: Record<string, unknown>;
}

export class ProvekoDomainError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ProvekoErrorCode;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    errorCode: ProvekoErrorCode,
    statusCode: number,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ProvekoDomainError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.metadata = metadata;
  }

  public toProblemDetails(): ProblemDetailsRfc9457 {
    return {
      type: `https://errors.proveko.com/${this.errorCode.toLowerCase()}`,
      title: this.errorCode,
      status: this.statusCode,
      detail: this.message,
      error_code: this.errorCode,
      ...(this.metadata ? { metadata: this.metadata } : {}),
    };
  }
}
