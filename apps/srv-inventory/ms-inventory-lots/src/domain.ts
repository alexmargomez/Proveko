import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface LotBatchCandidate {
  batchCode: string;
  expirationDate: string; // YYYY-MM-DD
  availableQty: string;
}

export interface AllocateFefoDto {
  sku: string;
  requestedQty: string;
  batches: LotBatchCandidate[];
  referenceDate?: string; // YYYY-MM-DD opcional para excluir lotes vencidos
}

export interface FefoAllocationResult {
  tenantId: string;
  sku: string;
  allocations: Array<{
    batchCode: string;
    expirationDate: string;
    allocatedQty: string;
  }>;
  unfulfilledQty: string;
}

/**
 * Puerto de Repositorio de Lotes y Vencimientos FEFO (SOLID DIP)
 */
export interface InventoryLotsRepositoryPort {
  listByTenantAndBranch(tenantId: string, branchId: string): Promise<LotBatchCandidate[]>;
  saveAllocationRecord(record: FefoAllocationResult): Promise<FefoAllocationResult>;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function allocateValidatedFefoBatches(
  tenantId: string,
  input: AllocateFefoDto,
): FefoAllocationResult {
  if (typeof input.sku !== 'string' || input.sku.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "sku" is required.',
    );
  }
  if (!Array.isArray(input.batches) || input.batches.length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "batches" must be a non-empty array.',
    );
  }

  let remaining = MoneyDecimal.from(input.requestedQty).assertPositive('requestedQty');
  const referenceDate = input.referenceDate?.trim();
  if (referenceDate && !ISO_DATE_RE.test(referenceDate)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "referenceDate" must follow YYYY-MM-DD format.',
    );
  }

  const validBatches = input.batches
    .map((b, idx) => {
      if (typeof b.batchCode !== 'string' || b.batchCode.trim().length === 0) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
          422,
          `Batch at index ${idx} is missing "batchCode".`,
        );
      }
      if (typeof b.expirationDate !== 'string' || !ISO_DATE_RE.test(b.expirationDate.trim())) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
          422,
          `Batch "${b.batchCode}" has invalid "expirationDate"; expected YYYY-MM-DD.`,
        );
      }
      const avail = MoneyDecimal.from(b.availableQty).assertNonNegative(
        `batches[${idx}].availableQty`,
      );
      return {
        batchCode: b.batchCode.trim(),
        expirationDate: b.expirationDate.trim(),
        avail,
      };
    })
    .filter((b) => {
      if (b.avail.isZero()) return false;
      if (referenceDate && b.expirationDate < referenceDate) {
        return false; // Excluir lotes vencidos respecto a la fecha de referencia
      }
      return true;
    })
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));

  const allocations: FefoAllocationResult['allocations'] = [];

  for (const batch of validBatches) {
    if (remaining.isZero()) break;
    const diff = batch.avail.sub(remaining);
    const take = diff.isNegative() ? batch.avail : remaining;
    allocations.push({
      batchCode: batch.batchCode,
      expirationDate: batch.expirationDate,
      allocatedQty: take.toFixed4(),
    });
    remaining = remaining.sub(take);
  }

  return {
    tenantId,
    sku: input.sku.trim(),
    allocations,
    unfulfilledQty: remaining.toFixed4(),
  };
}
