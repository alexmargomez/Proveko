import { jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const billingSubscriptionsTable = pgTable('billing_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull().unique(),
  tier: varchar('tier', { length: 32 }).notNull(),
  presetKey: varchar('preset_key', { length: 64 }),
  enabledServicesJson: jsonb('enabled_services_json').$type<string[]>().notNull().default([]),
  selectedMicroservicesJson: jsonb('selected_microservices_json')
    .$type<string[]>()
    .notNull()
    .default([]),
  totalMonthlyUsd: numeric('total_monthly_usd', { precision: 19, scale: 4 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'), // ACTIVE | PAST_DUE | CANCELED
  nextBillingAt: timestamp('next_billing_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const billingInvoicesTable = pgTable('billing_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),
  subscriptionId: uuid('subscription_id').notNull(),
  subtotalUsd: numeric('subtotal_usd', { precision: 19, scale: 4 }).notNull(),
  discountUsd: numeric('discount_usd', { precision: 19, scale: 4 }).notNull(),
  taxUsd: numeric('tax_usd', { precision: 19, scale: 4 }).notNull(),
  totalUsd: numeric('total_usd', { precision: 19, scale: 4 }).notNull(),
  paymentGatewayRef: varchar('payment_gateway_ref', { length: 128 }),
  status: varchar('status', { length: 32 }).notNull().default('PAID'),
  issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
});

export const billingWebhookInboxTable = pgTable('billing_webhook_inbox', {
  webhookEventId: varchar('webhook_event_id', { length: 128 }).primaryKey(),
  provider: varchar('provider', { length: 64 }).notNull(), // stripe | wompi | mercadopago
  payloadHash: text('payload_hash').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
});
