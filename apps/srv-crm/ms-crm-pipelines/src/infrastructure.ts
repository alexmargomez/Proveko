import { srvCrmSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { CrmPipelinesRepositoryPort, PipelineDealRecord } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_crm` — Prefijo obligatorio `pip_` (`mod:crm-pipelines` / `ms:crm-pipelines`)
 */
export const pipDealsTable = srvCrmSchema.table('pip_deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull(),
  stageKey: varchar('stage_key', { length: 48 }).notNull(), // LEAD | QUALIFIED | PROPOSAL | WON | LOST
  expectedValue: numeric('expected_value', { precision: 19, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryCrmPipelinesRepositoryAdapter implements CrmPipelinesRepositoryPort {
  private readonly store = new Map<string, PipelineDealRecord[]>();

  public async listByTenant(tenantId: string): Promise<PipelineDealRecord[]> {
    return [...(this.store.get(tenantId) ?? [])];
  }

  public async saveDeal(deal: PipelineDealRecord): Promise<PipelineDealRecord> {
    const list = this.store.get(deal.tenantId) ?? [];
    list.push(deal);
    this.store.set(deal.tenantId, list);
    return deal;
  }
}
