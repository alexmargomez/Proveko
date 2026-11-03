import {
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  type TenantTier,
} from '@proveko/shared-kernel';
import type { DatabaseCellEntity } from '../entities/core-entities.js';

/**
 * Motor Puro de Asignación de Celdas de Bases de Datos (`CellAllocatorEngine`)
 * Selecciona la Celda física óptima con menor porcentaje de ocupación para el nivel del cliente.
 */
export class CellAllocatorEngine {
  public selectOptimalCell(
    availableCells: readonly DatabaseCellEntity[],
    targetTier: TenantTier,
    isSandbox: boolean,
  ): DatabaseCellEntity {
    const candidates = availableCells.filter((cell) => {
      if (cell.status !== 'ONLINE') return false;
      if (cell.currentTenants >= cell.maxTenants) return false;
      if (isSandbox) return cell.isSandboxCell;
      if (cell.isSandboxCell) return false;
      return cell.tierTarget === targetTier || cell.tierTarget === 'business';
    });

    if (candidates.length === 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_CELL_CAPACITY_EXHAUSTED,
        503,
        `No online database cell available with free capacity for tier "${targetTier}" (isSandbox=${String(isSandbox)}).`,
      );
    }

    // Seleccionar la celda con menor ratio de ocupación (currentTenants / maxTenants)
    return [...candidates].sort(
      (a, b) => a.currentTenants / a.maxTenants - b.currentTenants / b.maxTenants,
    )[0]!;
  }
}
