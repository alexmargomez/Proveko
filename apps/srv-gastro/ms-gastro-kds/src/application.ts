import {
  type DispatchKdsTicketDto,
  type GastroKdsRepositoryPort,
  type KdsTicketRecord,
  buildValidatedKdsTicket,
} from './domain.js';

export class GastroKdsUseCases {
  constructor(private readonly repository: GastroKdsRepositoryPort) {}

  public async listTickets(tenantId: string, branchId: string) {
    const tickets = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: 'srv_gastro',
      table: 'kds_tickets',
      tickets,
    };
  }

  public async dispatchTicket(
    tenantId: string,
    branchId: string,
    dto: DispatchKdsTicketDto,
  ): Promise<KdsTicketRecord> {
    const ticket = buildValidatedKdsTicket(tenantId, branchId, dto);
    return this.repository.saveTicket(ticket);
  }
}
