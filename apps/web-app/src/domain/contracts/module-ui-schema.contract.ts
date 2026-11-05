import type { MicroserviceKey, ServiceKey } from '@proveko/shared-kernel';

export type ModuleFormFieldType = 'text' | 'decimal' | 'integer' | 'select' | 'json-lines';

export interface ModuleFormFieldOption {
  readonly value: string;
  readonly label: string;
}

export interface ModuleFormFieldSchema {
  readonly name: string;
  readonly label: string;
  readonly type: ModuleFormFieldType;
  readonly defaultValue: unknown;
  readonly placeholder?: string;
  readonly options?: readonly ModuleFormFieldOption[];
  readonly helperText?: string;
}

export interface ModuleTableColumnSchema {
  readonly key: string;
  readonly header: string;
  readonly format?: 'text' | 'tabular-currency' | 'badge' | 'code';
}

export interface ModuleKpiCardSchema {
  readonly label: string;
  readonly value: string;
  readonly badgeTone: 'emerald' | 'amber' | 'blue' | 'slate';
  readonly subtext: string;
}

/**
 * Contrato Declarativo de UI por Módulo Operativo (SOLID ISP + OCP).
 * Permite agregar un módulo N+1 sin modificar el motor de renderizado de formularios ni tablas.
 */
export interface ModuleUiSchemaDefinition {
  readonly microserviceKey: MicroserviceKey;
  readonly moduleNotation: string;
  readonly parentService: ServiceKey;
  readonly title: string;
  readonly badge: string;
  readonly description: string;
  readonly listEndpoint: string;
  readonly createEndpoint: string;
  readonly createButtonLabel: string;
  readonly responseCollectionPath: string;
  readonly kpis: readonly ModuleKpiCardSchema[];
  readonly formFields: readonly ModuleFormFieldSchema[];
  readonly columns: readonly ModuleTableColumnSchema[];
  readonly defaultPayload: Readonly<Record<string, unknown>>;
}

export interface RenderWorkstationUiOptions {
  readonly appUrl?: string;
  readonly appDomain?: string;
  readonly initialSurface?: 'landing' | 'workstation';
}
