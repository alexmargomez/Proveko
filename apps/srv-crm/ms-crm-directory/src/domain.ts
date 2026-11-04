import { CustomFieldsAndWebhookGuard } from '@proveko/rules-engine';
import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export type TaxIdType = 'NIT' | 'CC' | 'CE' | 'PASSPORT';

export interface CreateDirectoryContactDto {
  taxIdType: TaxIdType;
  taxIdNumber: string;
  legalName: string;
  email?: string;
  creditLimit?: string;
  customFields?: Record<string, unknown>;
}

export interface DirectoryContactRecord {
  id: string;
  tenantId: string;
  branchId: string;
  taxIdType: TaxIdType;
  taxIdNumber: string;
  legalName: string;
  email?: string;
  creditLimit: string;
  customFields: Record<string, unknown>;
}

/**
 * Puerto de Repositorio del Directorio CRM (SOLID DIP)
 */
export interface CrmDirectoryRepositoryPort {
  listByTenantAndBranch(tenantId: string, branchId: string): Promise<DirectoryContactRecord[]>;
  saveContact(contact: DirectoryContactRecord): Promise<DirectoryContactRecord>;
}

const VALID_TAX_ID_TYPES: ReadonlySet<string> = new Set<TaxIdType>(['NIT', 'CC', 'CE', 'PASSPORT']);

export function buildValidatedDirectoryContact(
  tenantId: string,
  branchId: string,
  input: CreateDirectoryContactDto,
): DirectoryContactRecord {
  if (!input.taxIdType || !VALID_TAX_ID_TYPES.has(input.taxIdType)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Invalid "taxIdType"; expected NIT, CC, CE, or PASSPORT.`,
    );
  }
  if (typeof input.taxIdNumber !== 'string' || input.taxIdNumber.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "taxIdNumber" is required.',
    );
  }
  if (typeof input.legalName !== 'string' || input.legalName.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "legalName" is required.',
    );
  }
  if (input.customFields) {
    CustomFieldsAndWebhookGuard.validateCustomFieldsPayload(input.customFields);
  }

  const creditLimit = MoneyDecimal.from(input.creditLimit ?? '0.0000')
    .assertNonNegative('creditLimit')
    .toFixed4();

  return {
    id: `dir-${tenantId}-${input.taxIdNumber.trim()}`,
    tenantId,
    branchId,
    taxIdType: input.taxIdType,
    taxIdNumber: input.taxIdNumber.trim(),
    legalName: input.legalName.trim(),
    email: input.email?.trim(),
    creditLimit,
    customFields: input.customFields ?? {},
  };
}
