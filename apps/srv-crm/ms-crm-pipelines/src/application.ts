import {
  type CreatePipelineDealDto,
  type CrmPipelinesRepositoryPort,
  type PipelineDealRecord,
  buildValidatedPipelineDeal,
} from './domain.js';

export class CrmPipelinesUseCases {
  constructor(private readonly repository: CrmPipelinesRepositoryPort) {}

  public async listDeals(tenantId: string) {
    const deals = await this.repository.listByTenant(tenantId);
    return {
      tenantId,
      schema: 'srv_crm',
      table: 'pip_deals',
      deals,
    };
  }

  public async createDeal(
    tenantId: string,
    dto: CreatePipelineDealDto,
  ): Promise<PipelineDealRecord> {
    const deal = buildValidatedPipelineDeal(tenantId, dto);
    return this.repository.saveDeal(deal);
  }
}
