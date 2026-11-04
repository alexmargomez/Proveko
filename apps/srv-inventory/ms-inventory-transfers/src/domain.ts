import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface CreateBranchTransferDto {
  toBranchId: string;
  sku: string;
  quantity: string;
}

export interface BranchTransferOrderRecord {
  tenantId: string;
  fromBranchId: string;
  toBranchId: string;
  sku: string;
  quantity: string;
  status: 'IN_TRANSIT' | 'RECEIVED';
}

/**
 * Puerto de Repositorio de Traslados entre Sucursales (SOLID DIP)
 */
export interface InventoryTransfersRepositoryPort {
  listByTenantAndBranch(tenantId: string, branchId: string): Promise<BranchTransferOrderRecord[]>;
  saveTransferOrder(order: BranchTransferOrderRecord): Promise<BranchTransferOrderRecord>;
}

export function buildValidatedBranchTransfer(
  tenantId: string,
  activeBranchId: string,
  allowedBranchIds: readonly string[],
  input: CreateBranchTransferDto,
): BranchTransferOrderRecord {
  if (typeof input.toBranchId !== 'string' || input.toBranchId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "toBranchId" is required.',
    );
  }
  const toBranchId = input.toBranchId.trim();
  if (toBranchId === activeBranchId) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      `Cannot create a circular transfer where source and destination branch are identical ("${activeBranchId}").`,
    );
  }
  if (!allowedBranchIds.includes(toBranchId)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_BRANCH_FORBIDDEN,
      403,
      `Destination branch "${toBranchId}" is not in allowed_branch_ids.`,
    );
  }
  if (typeof input.sku !== 'string' || input.sku.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "sku" is required.',
    );
  }

  const quantity = MoneyDecimal.from(input.quantity).assertPositive('quantity').toFixed4();

  return {
    tenantId,
    fromBranchId: activeBranchId,
    toBranchId,
    sku: input.sku.trim(),
    quantity,
    status: 'IN_TRANSIT',
  };
}
