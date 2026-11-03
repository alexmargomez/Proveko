export const SERVICE_KEYS = [
  'srv:invoicing',
  'srv:inventory',
  'srv:crm',
  'srv:gastro',
  'srv:hotel',
  'srv:finance',
] as const;

export type ServiceKey = (typeof SERVICE_KEYS)[number];

export const MICROSERVICE_KEYS = [
  'ms:crm-directory',
  'ms:crm-pipelines',
  'ms:crm-loyalty',
  'ms:invoicing-pos',
  'ms:invoicing-simple-receipt',
  'ms:invoicing-electronic-dian',
  'ms:invoicing-quotes',
  'ms:inventory-stock',
  'ms:inventory-recipes',
  'ms:inventory-lots',
  'ms:inventory-transfers',
  'ms:gastro-tables',
  'ms:gastro-kds',
  'ms:gastro-split-check',
  'ms:hotel-rooms',
  'ms:hotel-bookings',
  'ms:hotel-frontdesk',
  'ms:finance-cashbook',
  'ms:finance-ar-ap',
  'ms:finance-accounting-puc',
] as const;

export type MicroserviceKey = (typeof MICROSERVICE_KEYS)[number];

export type MutexGroupKey = 'fiscal_document_emitter' | 'accounting_ledger_engine';

export type SupersedeMode = 'readonly_archive' | 'disabled';

export type SubscriptionLifecycleStatus =
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'READONLY_ARCHIVE'
  | 'DISABLED';

export type TenantTier = 'sandbox_ephemeral' | 'basic' | 'business' | 'enterprise';

export interface ServiceGroupSeedDefinition {
  key: ServiceKey;
  name: string;
  description: string;
  schemaName:
    | 'srv_invoicing'
    | 'srv_inventory'
    | 'srv_crm'
    | 'srv_gastro'
    | 'srv_hotel'
    | 'srv_finance';
  displayOrder: number;
}

export interface MicroserviceSeedDefinition {
  key: MicroserviceKey;
  parentService: ServiceKey;
  name: string;
  subgroup: string;
  tablePrefix: string;
  requiresServices: ServiceKey[];
  requiresMicroservices: MicroserviceKey[];
  mutexGroup: MutexGroupKey | null;
  supersedes: MicroserviceKey[];
  onSupersedeMode: SupersedeMode;
  baseMonthlyPriceCop: string;
}

export type IndustryPresetKey =
  | 'preset:gastro-bar-restaurant'
  | 'preset:retail-commerce-dian'
  | 'preset:hotel-hospitality'
  | 'preset:distributor-pharma-lots';

export interface IndustryPresetSeedDefinition {
  key: IndustryPresetKey;
  name: string;
  targetAudience: string;
  services: ServiceKey[];
  microservices: MicroserviceKey[];
  demoSeedProfile: string;
}

export const SEED_SERVICES_CATALOG: readonly ServiceGroupSeedDefinition[] = [
  {
    key: 'srv:crm',
    name: 'Clientes y Comercial (CRM)',
    description: 'Contenedor Gatekeeper de terceros fiscales, clientes, proveedores y embudos',
    schemaName: 'srv_crm',
    displayOrder: 1,
  },
  {
    key: 'srv:invoicing',
    name: 'Facturación y Ventas',
    description: 'Contenedor Gatekeeper de caja POS, recibos internos, facturación DIAN y cotizaciones',
    schemaName: 'srv_invoicing',
    displayOrder: 2,
  },
  {
    key: 'srv:inventory',
    name: 'Inventarios y Logística',
    description: 'Contenedor Gatekeeper de kardex, bodegas, recetas/escandallos, lotes FEFO y traslados',
    schemaName: 'srv_inventory',
    displayOrder: 3,
  },
  {
    key: 'srv:gastro',
    name: 'Operación Gastronómica',
    description: 'Contenedor Gatekeeper de salones, mesas, comandas de cocina KDS y división de cuentas',
    schemaName: 'srv_gastro',
    displayOrder: 4,
  },
  {
    key: 'srv:hotel',
    name: 'Hotelería y Alojamiento',
    description: 'Contenedor Gatekeeper de habitaciones, reservas, recepción y cargos a folio de huésped',
    schemaName: 'srv_hotel',
    displayOrder: 5,
  },
  {
    key: 'srv:finance',
    name: 'Finanzas y Contabilidad',
    description: 'Contenedor Gatekeeper de tesorería, cartera CxC/CxP y contabilidad de partida doble PUC/NIIF',
    schemaName: 'srv_finance',
    displayOrder: 6,
  },
] as const;

export const SEED_MICROSERVICES_CATALOG: readonly MicroserviceSeedDefinition[] = [
  {
    key: 'ms:crm-directory',
    parentService: 'srv:crm',
    name: 'Directorio de Terceros y Clientes',
    subgroup: 'Base Comercial',
    tablePrefix: 'dir_',
    requiresServices: ['srv:crm'],
    requiresMicroservices: [],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '25000.0000',
  },
  {
    key: 'ms:crm-pipelines',
    parentService: 'srv:crm',
    name: 'Embudos de Venta y Oportunidades',
    subgroup: 'Gestión Comercial',
    tablePrefix: 'pip_',
    requiresServices: ['srv:crm'],
    requiresMicroservices: ['ms:crm-directory'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '35000.0000',
  },
  {
    key: 'ms:crm-loyalty',
    parentService: 'srv:crm',
    name: 'Fidelización, Puntos y Membresías',
    subgroup: 'Retención',
    tablePrefix: 'loy_',
    requiresServices: ['srv:crm'],
    requiresMicroservices: ['ms:crm-directory'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '30000.0000',
  },
  {
    key: 'ms:invoicing-pos',
    parentService: 'srv:invoicing',
    name: 'Caja Rápida POS y Turnos',
    subgroup: 'Punto de Venta',
    tablePrefix: 'pos_',
    requiresServices: ['srv:invoicing'],
    requiresMicroservices: ['ms:crm-directory'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '45000.0000',
  },
  {
    key: 'ms:invoicing-simple-receipt',
    parentService: 'srv:invoicing',
    name: 'Recibo Interno / Cuenta de Cobro No Fiscal',
    subgroup: 'Emisión Documental',
    tablePrefix: 'rcp_',
    requiresServices: ['srv:invoicing'],
    requiresMicroservices: ['ms:invoicing-pos'],
    mutexGroup: 'fiscal_document_emitter',
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '15000.0000',
  },
  {
    key: 'ms:invoicing-electronic-dian',
    parentService: 'srv:invoicing',
    name: 'Facturación Electrónica DIAN UBL 2.1',
    subgroup: 'Emisión Fiscal',
    tablePrefix: 'dian_',
    requiresServices: ['srv:invoicing'],
    requiresMicroservices: ['ms:invoicing-pos', 'ms:crm-directory'],
    mutexGroup: 'fiscal_document_emitter',
    supersedes: ['ms:invoicing-simple-receipt'],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '65000.0000',
  },
  {
    key: 'ms:invoicing-quotes',
    parentService: 'srv:invoicing',
    name: 'Cotizaciones, Pedidos y Remisiones',
    subgroup: 'Preventa',
    tablePrefix: 'quo_',
    requiresServices: ['srv:invoicing'],
    requiresMicroservices: ['ms:crm-directory'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '25000.0000',
  },
  {
    key: 'ms:inventory-stock',
    parentService: 'srv:inventory',
    name: 'Kardex y Existencias Multi-Bodega',
    subgroup: 'Bodegas y Kardex',
    tablePrefix: 'stk_',
    requiresServices: ['srv:inventory'],
    requiresMicroservices: [],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '45000.0000',
  },
  {
    key: 'ms:inventory-recipes',
    parentService: 'srv:inventory',
    name: 'Recetas, Escandallos y Explosión de Insumos',
    subgroup: 'Transformación',
    tablePrefix: 'rec_',
    requiresServices: ['srv:inventory'],
    requiresMicroservices: ['ms:inventory-stock'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '40000.0000',
  },
  {
    key: 'ms:inventory-lots',
    parentService: 'srv:inventory',
    name: 'Control de Lotes, Seriales y Vencimientos FEFO',
    subgroup: 'Trazabilidad',
    tablePrefix: 'lot_',
    requiresServices: ['srv:inventory'],
    requiresMicroservices: ['ms:inventory-stock'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '40000.0000',
  },
  {
    key: 'ms:inventory-transfers',
    parentService: 'srv:inventory',
    name: 'Traslados entre Bodegas y Sedes',
    subgroup: 'Bodegas y Kardex',
    tablePrefix: 'trf_',
    requiresServices: ['srv:inventory'],
    requiresMicroservices: ['ms:inventory-stock'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '25000.0000',
  },
  {
    key: 'ms:gastro-tables',
    parentService: 'srv:gastro',
    name: 'Mapa de Salones, Terrazas y Mesas',
    subgroup: 'Atención en Salón',
    tablePrefix: 'tbl_',
    requiresServices: ['srv:gastro'],
    requiresMicroservices: ['ms:invoicing-pos'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '35000.0000',
  },
  {
    key: 'ms:gastro-kds',
    parentService: 'srv:gastro',
    name: 'Comandas Digitales Cocina y Barra (KDS)',
    subgroup: 'Producción Gastronómica',
    tablePrefix: 'kds_',
    requiresServices: ['srv:gastro'],
    requiresMicroservices: ['ms:gastro-tables'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '35000.0000',
  },
  {
    key: 'ms:gastro-split-check',
    parentService: 'srv:gastro',
    name: 'División de Cuentas, Propinas y Cortesías',
    subgroup: 'Atención en Salón',
    tablePrefix: 'spl_',
    requiresServices: ['srv:gastro'],
    requiresMicroservices: ['ms:gastro-tables', 'ms:invoicing-pos'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '20000.0000',
  },
  {
    key: 'ms:hotel-rooms',
    parentService: 'srv:hotel',
    name: 'Inventario de Habitaciones y Housekeeping',
    subgroup: 'Alojamiento',
    tablePrefix: 'rom_',
    requiresServices: ['srv:hotel'],
    requiresMicroservices: [],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '50000.0000',
  },
  {
    key: 'ms:hotel-bookings',
    parentService: 'srv:hotel',
    name: 'Calendario de Reservas y Ocupación',
    subgroup: 'Reservas',
    tablePrefix: 'bkg_',
    requiresServices: ['srv:hotel'],
    requiresMicroservices: ['ms:hotel-rooms', 'ms:crm-directory'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '45000.0000',
  },
  {
    key: 'ms:hotel-frontdesk',
    parentService: 'srv:hotel',
    name: 'Recepción Check-in/out y Folio de Huésped',
    subgroup: 'Recepción',
    tablePrefix: 'fdk_',
    requiresServices: ['srv:hotel'],
    requiresMicroservices: ['ms:hotel-rooms', 'ms:invoicing-pos', 'ms:crm-directory'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '55000.0000',
  },
  {
    key: 'ms:finance-cashbook',
    parentService: 'srv:finance',
    name: 'Libro Simple de Ingresos y Gastos de Caja',
    subgroup: 'Tesorería',
    tablePrefix: 'csh_',
    requiresServices: ['srv:finance'],
    requiresMicroservices: [],
    mutexGroup: 'accounting_ledger_engine',
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '20000.0000',
  },
  {
    key: 'ms:finance-ar-ap',
    parentService: 'srv:finance',
    name: 'Cartera: Cuentas por Cobrar y Cuentas por Pagar',
    subgroup: 'Cartera',
    tablePrefix: 'arp_',
    requiresServices: ['srv:finance'],
    requiresMicroservices: ['ms:crm-directory'],
    mutexGroup: null,
    supersedes: [],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '35000.0000',
  },
  {
    key: 'ms:finance-accounting-puc',
    parentService: 'srv:finance',
    name: 'Contabilidad de Partida Doble PUC / NIIF',
    subgroup: 'Contabilidad Legal',
    tablePrefix: 'puc_',
    requiresServices: ['srv:finance'],
    requiresMicroservices: ['ms:crm-directory'],
    mutexGroup: 'accounting_ledger_engine',
    supersedes: ['ms:finance-cashbook'],
    onSupersedeMode: 'readonly_archive',
    baseMonthlyPriceCop: '75000.0000',
  },
] as const;

export const SEED_INDUSTRY_PRESETS: readonly IndustryPresetSeedDefinition[] = [
  {
    key: 'preset:gastro-bar-restaurant',
    name: 'Bar, Restaurante y Cafetería',
    targetAudience: 'Restaurantes, gastrobares, cafés y dark kitchens',
    services: ['srv:crm', 'srv:invoicing', 'srv:inventory', 'srv:gastro'],
    microservices: [
      'ms:crm-directory',
      'ms:invoicing-pos',
      'ms:invoicing-simple-receipt',
      'ms:inventory-stock',
      'ms:inventory-recipes',
      'ms:gastro-tables',
      'ms:gastro-kds',
      'ms:gastro-split-check',
    ],
    demoSeedProfile: 'gastro_full_demo',
  },
  {
    key: 'preset:retail-commerce-dian',
    name: 'Comercio, Ferretería y Retail DIAN',
    targetAudience: 'Almacenes, ferreterías, tiendas y comercios facturadores electrónicos',
    services: ['srv:crm', 'srv:invoicing', 'srv:inventory', 'srv:finance'],
    microservices: [
      'ms:crm-directory',
      'ms:invoicing-pos',
      'ms:invoicing-electronic-dian',
      'ms:invoicing-quotes',
      'ms:inventory-stock',
      'ms:inventory-transfers',
      'ms:finance-cashbook',
      'ms:finance-ar-ap',
    ],
    demoSeedProfile: 'retail_dian_demo',
  },
  {
    key: 'preset:hotel-hospitality',
    name: 'Hotel, Hostal y Alojamiento',
    targetAudience: 'Hoteles, hostales y apartahoteles con consumo a habitación',
    services: ['srv:crm', 'srv:invoicing', 'srv:hotel', 'srv:finance'],
    microservices: [
      'ms:crm-directory',
      'ms:invoicing-pos',
      'ms:invoicing-electronic-dian',
      'ms:hotel-rooms',
      'ms:hotel-bookings',
      'ms:hotel-frontdesk',
      'ms:finance-ar-ap',
    ],
    demoSeedProfile: 'hotel_folio_demo',
  },
  {
    key: 'preset:distributor-pharma-lots',
    name: 'Distribuidora, Alimentos y Farmacia (FEFO)',
    targetAudience: 'Distribuidoras mayoristas, droguerías y comercializadoras con lotes',
    services: ['srv:crm', 'srv:invoicing', 'srv:inventory', 'srv:finance'],
    microservices: [
      'ms:crm-directory',
      'ms:invoicing-pos',
      'ms:invoicing-electronic-dian',
      'ms:invoicing-quotes',
      'ms:inventory-stock',
      'ms:inventory-lots',
      'ms:inventory-transfers',
      'ms:finance-ar-ap',
      'ms:finance-accounting-puc',
    ],
    demoSeedProfile: 'distributor_lots_demo',
  },
] as const;
