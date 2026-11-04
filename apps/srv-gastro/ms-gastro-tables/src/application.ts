import {
  type DiningTableOccupancyRecord,
  type GastroTablesRepositoryPort,
  type OccupyTableDto,
  buildValidatedTableOccupancy,
} from './domain.js';

export class GastroTablesUseCases {
  constructor(private readonly repository: GastroTablesRepositoryPort) {}

  public async listTables(tenantId: string, branchId: string) {
    const tables = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: 'srv_gastro',
      table: 'tbl_dining_tables',
      tables,
    };
  }

  public async occupyTable(
    tenantId: string,
    branchId: string,
    dto: OccupyTableDto,
  ): Promise<DiningTableOccupancyRecord> {
    const record = buildValidatedTableOccupancy(tenantId, branchId, dto);
    return this.repository.saveTableOccupancy(record);
  }
}
