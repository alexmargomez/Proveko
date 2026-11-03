import { pgSchema } from 'drizzle-orm/pg-core';
import type { ServiceKey } from '@proveko/shared-kernel';

/**
 * Esquemas PostgreSQL explícitos por Servicio Padre [P1-01]
 * Garantizan que Drizzle ORM emita siempre SQL calificado ("srv_inventory"."stk_items")
 * siendo 100% inmune al modo `transaction pooling` de PgBouncer en lecturas sin transacción.
 */
export const srvCrmSchema = pgSchema('srv_crm');
export const srvInvoicingSchema = pgSchema('srv_invoicing');
export const srvInventorySchema = pgSchema('srv_inventory');
export const srvGastroSchema = pgSchema('srv_gastro');
export const srvHotelSchema = pgSchema('srv_hotel');
export const srvFinanceSchema = pgSchema('srv_finance');

export const SERVICE_SCHEMA_MAP: Record<ServiceKey, string> = {
  'srv:crm': 'srv_crm',
  'srv:invoicing': 'srv_invoicing',
  'srv:inventory': 'srv_inventory',
  'srv:gastro': 'srv_gastro',
  'srv:hotel': 'srv_hotel',
  'srv:finance': 'srv_finance',
};
