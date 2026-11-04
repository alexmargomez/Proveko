import { PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export interface OccupyTableDto {
  tableCode: string;
  guestsCount: number;
}

export interface DiningTableOccupancyRecord {
  tenantId: string;
  branchId: string;
  tableCode: string;
  guestsCount: number;
  occupancyStatus: 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED';
}

/**
 * Puerto de Repositorio de Mesas y Salones (SOLID DIP)
 */
export interface GastroTablesRepositoryPort {
  listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<DiningTableOccupancyRecord[]>;
  saveTableOccupancy(record: DiningTableOccupancyRecord): Promise<DiningTableOccupancyRecord>;
}

export function buildValidatedTableOccupancy(
  tenantId: string,
  branchId: string,
  input: OccupyTableDto,
): DiningTableOccupancyRecord {
  if (typeof input.tableCode !== 'string' || input.tableCode.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "tableCode" is required.',
    );
  }
  if (typeof input.guestsCount !== 'number' || !Number.isInteger(input.guestsCount) || input.guestsCount <= 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "guestsCount" must be a positive integer (> 0).',
    );
  }

  return {
    tenantId,
    branchId,
    tableCode: input.tableCode.trim(),
    guestsCount: input.guestsCount,
    occupancyStatus: 'OCCUPIED',
  };
}
