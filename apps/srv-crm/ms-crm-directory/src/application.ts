import {
  type CreateDirectoryContactDto,
  type CrmDirectoryRepositoryPort,
  type DirectoryContactRecord,
  buildValidatedDirectoryContact,
} from './domain.js';

export class CrmDirectoryUseCases {
  constructor(private readonly repository: CrmDirectoryRepositoryPort) {}

  public async listContacts(tenantId: string, branchId: string, isReadonlyArchive: boolean) {
    const contacts = await this.repository.listByTenantAndBranch(tenantId, branchId);
    return {
      tenantId,
      branchId,
      schema: 'srv_crm',
      table: 'dir_contacts',
      readonlyMode: isReadonlyArchive,
      contacts,
    };
  }

  public async createContact(
    tenantId: string,
    branchId: string,
    dto: CreateDirectoryContactDto,
  ): Promise<DirectoryContactRecord> {
    const contact = buildValidatedDirectoryContact(tenantId, branchId, dto);
    return this.repository.saveContact(contact);
  }
}
