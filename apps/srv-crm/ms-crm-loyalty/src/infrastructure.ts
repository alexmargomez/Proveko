import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvCrmSchema } from '@proveko/tenant-db-resolver';
import { numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import type { CrmLoyaltyRepositoryPort, LoyaltyWalletRecord } from './domain.js';

/**
 * Esquema PostgreSQL explícito `srv_crm` — Prefijo obligatorio `loy_` (`mod:crm-loyalty` / `ms:crm-loyalty`)
 */
export const loyWalletsTable = srvCrmSchema.table('loy_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull().unique(),
  tierLevel: varchar('tier_level', { length: 32 }).notNull().default('SILVER'),
  pointsBalance: numeric('points_balance', { precision: 19, scale: 4 }).notNull().default('0.0000'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export class InMemoryCrmLoyaltyRepositoryAdapter implements CrmLoyaltyRepositoryPort {
  private readonly store = new Map<string, LoyaltyWalletRecord[]>();

  public async listByTenant(tenantId: string): Promise<LoyaltyWalletRecord[]> {
    return [...(this.store.get(tenantId) ?? [])];
  }

  public async accruePoints(
    tenantId: string,
    contactId: string,
    pointsDelta: MoneyDecimal,
  ): Promise<LoyaltyWalletRecord> {
    const list = this.store.get(tenantId) ?? [];
    const existingIdx = list.findIndex((w) => w.contactId === contactId);
    if (existingIdx >= 0) {
      const current = list[existingIdx]!;
      const nextBalance = MoneyDecimal.from(current.pointsBalance).add(pointsDelta).toFixed4();
      const updated: LoyaltyWalletRecord = {
        ...current,
        pointsBalance: nextBalance,
      };
      list[existingIdx] = updated;
      this.store.set(tenantId, list);
      return updated;
    }

    const created: LoyaltyWalletRecord = {
      tenantId,
      contactId,
      tierLevel: 'SILVER',
      pointsBalance: pointsDelta.toFixed4(),
    };
    list.push(created);
    this.store.set(tenantId, list);
    return created;
  }
}
