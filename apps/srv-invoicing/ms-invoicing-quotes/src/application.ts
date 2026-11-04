import {
  type CommercialQuoteRecord,
  type CreateCommercialQuoteDto,
  type InvoicingQuotesRepositoryPort,
  buildValidatedCommercialQuote,
} from './domain.js';

export class InvoicingQuotesUseCases {
  constructor(private readonly repository: InvoicingQuotesRepositoryPort) {}

  public async listQuotes(tenantId: string, branchId: string) {
    const quotes = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: 'srv_invoicing',
      table: 'quo_quotes',
      quotes,
    };
  }

  public async createQuote(
    tenantId: string,
    branchId: string,
    dto: CreateCommercialQuoteDto,
  ): Promise<CommercialQuoteRecord> {
    const quote = buildValidatedCommercialQuote(tenantId, branchId, dto);
    return this.repository.saveQuote(quote);
  }
}
