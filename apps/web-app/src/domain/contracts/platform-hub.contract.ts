export type ProvekoRoleKey =
  | 'SUPERADMIN_GLOBAL'
  | 'ADMIN_CLIENTE'
  | 'CAJERO_FACTURADOR'
  | 'JEFE_BODEGA'
  | 'MESERO_COMANDAS'
  | 'CONTROL_TRACTOMULAS'
  | 'RECEPCION_RESERVAS'
  | 'CONTADOR_FINANZAS';

export type PlatformCenterKey =
  | 'center:invoicing-pos'
  | 'center:inventory-recipes'
  | 'center:gastro-reservations'
  | 'center:logistics-fleet'
  | 'center:crm-finance'
  | 'center:users-rbac';

export interface PlatformComponentToggleDefinition {
  readonly key: string;
  readonly centerKey: PlatformCenterKey;
  readonly name: string;
  readonly description: string;
  readonly defaultEnabled: boolean;
}

export interface PlatformOperationalCenterDefinition {
  readonly key: PlatformCenterKey;
  readonly title: string;
  readonly shortLabel: string;
  readonly icon: string;
  readonly summary: string;
  readonly monthlyBaseCop: number;
  readonly allowedRoles: readonly ProvekoRoleKey[];
  readonly components: readonly PlatformComponentToggleDefinition[];
}

export interface RolePermissionProfile {
  readonly roleKey: ProvekoRoleKey;
  readonly label: string;
  readonly description: string;
  readonly allowedCenters: readonly PlatformCenterKey[];
}

export interface GeneratedTenantAdminCredential {
  readonly tenantId: string;
  readonly companyName: string;
  readonly nit: string;
  readonly adminEmail: string;
  readonly adminUsername: string;
  readonly temporaryPassword: string;
  readonly paymentStatus: 'STANDBY_APPROVED' | 'ACTIVE_SUBSCRIPTION';
  readonly paymentReference: string;
  readonly issuedAtIso: string;
}
