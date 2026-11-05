import {
  type MicroserviceKey,
  type ModuleKey,
  normalizeModuleKey,
} from '@proveko/shared-kernel';
import type { ModuleUiSchemaDefinition } from '../../domain/contracts/module-ui-schema.contract.js';
import { CRM_MODULE_SCHEMAS } from './schemas/crm-modules.schema.js';
import { FINANCE_MODULE_SCHEMAS } from './schemas/finance-modules.schema.js';
import { GASTRO_MODULE_SCHEMAS } from './schemas/gastro-modules.schema.js';
import { HOTEL_MODULE_SCHEMAS } from './schemas/hotel-modules.schema.js';
import { INVENTORY_MODULE_SCHEMAS } from './schemas/inventory-modules.schema.js';
import { INVOICING_MODULE_SCHEMAS } from './schemas/invoicing-modules.schema.js';

/**
 * Registro Unificado Declarativo de los 20 Módulos de Negocio (SOLID OCP + DIP).
 * Para agregar un módulo N+1 basta con registrar su `ModuleUiSchemaDefinition` sin tocar
 * ni una sola línea del renderizador de formularios o tablas.
 */
export const PROVEKO_MODULE_UI_SCHEMA_REGISTRY: Readonly<
  Record<MicroserviceKey, ModuleUiSchemaDefinition>
> = Object.freeze({
  ...CRM_MODULE_SCHEMAS,
  ...INVOICING_MODULE_SCHEMAS,
  ...INVENTORY_MODULE_SCHEMAS,
  ...GASTRO_MODULE_SCHEMAS,
  ...HOTEL_MODULE_SCHEMAS,
  ...FINANCE_MODULE_SCHEMAS,
}) as Readonly<Record<MicroserviceKey, ModuleUiSchemaDefinition>>;

export function getModuleUiSchema(
  keyInput: MicroserviceKey | ModuleKey,
): ModuleUiSchemaDefinition {
  const canonicalKey = normalizeModuleKey(keyInput);
  return PROVEKO_MODULE_UI_SCHEMA_REGISTRY[canonicalKey];
}
