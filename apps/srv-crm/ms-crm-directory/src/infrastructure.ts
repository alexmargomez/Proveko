import { srvCrmSchema } from '@proveko/tenant-db-resolver';
import { jsonb, numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { CrmDirectoryRepositoryPort, DirectoryContactRecord } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_crm` — Prefijo obligatorio `dir_` (`mod:crm-directory` / `ms:crm-directory`)
 */
export const dirContactsTable = srvCrmSchema.table('dir_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  branchId: varchar('branch_id', { length: 64 }).notNull(),
  taxIdType: varchar('tax_id_type', { length: 16 }).notNull(), // NIT | CC | CE | PASSPORT
  taxIdNumber: varchar('tax_id_number', { length: 32 }).notNull(),
  legalName: varchar('legal_name', { length: 180 }).notNull(),
  email: varchar('email', { length: 160 }),
  creditLimit: numeric('credit_limit', { precision: 19, scale: 4 }).notNull().default('0.0000'),
  customFields: jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryCrmDirectoryRepositoryAdapter implements CrmDirectoryRepositoryPort {
  private readonly store = new Map<string, DirectoryContactRecord[]>();

  public async listByTenantAndBranch(
    tenantId: string,
    branchId: string,
  ): Promise<DirectoryContactRecord[]> {
    return [...(this.store.get(`${tenantId}:${branchId}`) ?? [])];
  }

  public async saveContact(contact: DirectoryContactRecord): Promise<DirectoryContactRecord> {
    const key = `${contact.tenantId}:${contact.branchId}`;
    const list = this.store.get(key) ?? [];
    const existingIdx = list.findIndex((c) => c.id === contact.id);
    if (existingIdx >= 0) {
      list[existingIdx] = contact;
    } else {
      list.push(contact);
    }
    this.store.set(key, list);
    return contact;
  }
}
