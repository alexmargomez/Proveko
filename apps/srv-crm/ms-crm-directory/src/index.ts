import { CustomFieldsAndWebhookGuard } from '@proveko/rules-engine';
import {
  type DoubleKeyServiceGuard,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { MoneyDecimal } from '@proveko/shared-kernel';
import { srvCrmSchema } from '@proveko/tenant-db-resolver';
import { jsonb, numeric, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Esquema PostgreSQL explícito `srv_crm` — Prefijo obligatorio `dir_` (`ms:crm-directory`)
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

export interface CreateDirectoryContactDto {
  taxIdType: 'NIT' | 'CC' | 'CE' | 'PASSPORT';
  taxIdNumber: string;
  legalName: string;
  email?: string;
  creditLimit?: string;
  customFields?: Record<string, unknown>;
}

export const msCrmDirectoryPlugin = defineProvekoMicroservice({
  parentService: 'srv:crm',
  microserviceKey: 'ms:crm-directory',
  tablePrefix: 'dir_',
  version: '1.0.0',
  routes: [
    {
      method: 'GET',
      subPath: '/contacts',
      description: 'Listar terceros/clientes del directorio CRM del inquilino activo',
      handler: async (ctx) => ({
        tenantId: ctx.tenantId,
        branchId: ctx.activeBranchId,
        schema: 'srv_crm',
        table: 'dir_contacts',
        readonlyMode: ctx.isReadonlyArchive,
        contacts: [],
      }),
    },
    {
      method: 'POST',
      subPath: '/contacts',
      description: 'Crear tercero/cliente validando custom_fields JSONB y límite de crédito Decimal',
      handler: async (ctx, req) => {
        const body = (req.body ?? {}) as CreateDirectoryContactDto;
        if (body.customFields) {
          CustomFieldsAndWebhookGuard.validateCustomFieldsPayload(body.customFields);
        }
        const creditLimit = MoneyDecimal.from(body.creditLimit ?? '0.0000').toFixed4();
        return {
          id: `dir-${ctx.tenantId}-${body.taxIdNumber}`,
          tenantId: ctx.tenantId,
          branchId: ctx.activeBranchId,
          taxIdType: body.taxIdType,
          taxIdNumber: body.taxIdNumber,
          legalName: body.legalName,
          creditLimit,
          customFields: body.customFields ?? {},
        };
      },
    },
  ],
});

/**
 * Permite levantar `ms:crm-directory` completamente solo en un servidor dedicado
 */
export function createStandaloneCrmDirectoryServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
): StandaloneMicroserviceServer {
  return new StandaloneMicroserviceServer(msCrmDirectoryPlugin, guard, serverNodeId);
}
