import {
  type CashbookEntryRecord,
  type FinanceCashbookRepositoryPort,
  type RecordCashbookEntryDto,
  buildValidatedCashbookEntry,
} from './domain.js';

export class FinanceCashbookUseCases {
  constructor(private readonly repository: FinanceCashbookRepositoryPort) {}

  public async listEntries(tenantId: string, branchId: string, isReadonlyArchive: boolean) {
    const entries = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: 'srv_finance',
      table: 'csh_entries',
      isReadonlyArchive,
      entries,
    };
  }

  public async recordEntry(
    tenantId: string,
    branchId: string,
    dto: RecordCashbookEntryDto,
  ): Promise<CashbookEntryRecord> {
    const entry = buildValidatedCashbookEntry(tenantId, branchId, dto);
    return this.repository.saveEntry(entry);
  }
}
