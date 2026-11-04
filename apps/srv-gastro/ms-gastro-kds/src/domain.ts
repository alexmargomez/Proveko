import { PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export type KdsStationKey = 'HOT_KITCHEN' | 'BAR' | 'GRILL';

export interface KdsTicketItemInput {
  sku: string;
  qty: number;
  notes?: string;
}

export interface DispatchKdsTicketDto {
  stationKey: KdsStationKey;
  tableCode: string;
  items: KdsTicketItemInput[];
}

export interface KdsTicketRecord {
  tenantId: string;
  branchId: string;
  stationKey: KdsStationKey;
  tableCode: string;
  items: KdsTicketItemInput[];
  status: 'PREPARING' | 'READY' | 'SERVED';
}

/**
 * Puerto de Repositorio de Comandas KDS (SOLID DIP)
 */
export interface GastroKdsRepositoryPort {
  listByTenantAndBranch(tenantId: string, branchId: string): Promise<KdsTicketRecord[]>;
  saveTicket(ticket: KdsTicketRecord): Promise<KdsTicketRecord>;
}

const VALID_STATIONS: ReadonlySet<string> = new Set<KdsStationKey>(['HOT_KITCHEN', 'BAR', 'GRILL']);

export function buildValidatedKdsTicket(
  tenantId: string,
  branchId: string,
  input: DispatchKdsTicketDto,
): KdsTicketRecord {
  if (!input.stationKey || !VALID_STATIONS.has(input.stationKey)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Invalid "stationKey"; expected HOT_KITCHEN, BAR, or GRILL.',
    );
  }
  if (typeof input.tableCode !== 'string' || input.tableCode.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "tableCode" is required.',
    );
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'KDS ticket "items" must be a non-empty array.',
    );
  }

  const sanitizedItems = input.items.map((item, idx) => {
    if (typeof item.sku !== 'string' || item.sku.trim().length === 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `KDS item at index ${idx} is missing "sku".`,
      );
    }
    if (typeof item.qty !== 'number' || !Number.isFinite(item.qty) || item.qty <= 0) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        `KDS item "${item.sku}" must have a positive "qty" (> 0).`,
      );
    }
    return {
      sku: item.sku.trim(),
      qty: item.qty,
      notes: item.notes?.trim(),
    };
  });

  return {
    tenantId,
    branchId,
    stationKey: input.stationKey,
    tableCode: input.tableCode.trim(),
    items: sanitizedItems,
    status: 'PREPARING',
  };
}
