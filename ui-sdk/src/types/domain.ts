export interface ModuleManifest {
  moduleKey: string;
  displayName: string;
  tabIcon: string;
  defaultActive: boolean;
  summary: string;
}

export interface FeatureManifest {
  featureKey: string;
  displayName: string;
  dependsOnModule: string;
  defaultActive: boolean;
}

export interface ServiceManifest {
  serviceKey: string;
  displayName: string;
  icon: string;
  apiPrefix: string;
  category: string;
  summary: string;
  modules: ModuleManifest[];
  features?: FeatureManifest[];
}

export interface TenantRecord {
  tenantId: string;
  companyName: string;
  nit: string;
  adminUsername: string;
  dbName: string;
  businessPreset: string;
  status: string;
  activeServices: string[];
  activeModules: string[];
  activeFeatures: string[];
  createdAt: string;
}

export interface Tariff {
  id: string;
  code: string;
  name: string;
  discountPct: number;
}

export interface Contract {
  id: string;
  code: string;
  entityName: string;
  tariffId: string;
  tariffName: string;
  budgetCeiling: number;
  consumedAmount: number;
  availableBalance: number;
  status: string;
}

export interface Customer {
  id: string;
  code: string;
  docType: string;
  nit: string;
  dv: string;
  name: string;
  taxRegime: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  contractId: string;
  tariffId: string;
  creditLimit: number;
  currentDebt: number;
}

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  modelYear: string;
  customerId: string;
  customerName: string;
  currentKm: number;
  nextOilChangeKm: number;
  soatExpiry: string;
  notes: string;
}

export interface Driver {
  id: string;
  code: string;
  name: string;
  docNumber: string;
  licenseCategory: string;
  phone: string;
  vehicleId: string;
  assignedPlate: string;
  status: string;
}

export interface Carrier {
  id: string;
  code: string;
  nit: string;
  name: string;
  vehicleType: string;
  routeZone: string;
  phone: string;
}

export interface Supplier {
  id: string;
  code: string;
  nit: string;
  name: string;
  city: string;
  phone: string;
}

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  city: string;
  manager: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  warehouseId: string;
  supplierId: string;
  costPrice: number;
  salePrice: number;
  taxPct: number;
  stock: number;
  minStock: number;
  lotCode: string;
  expiryDate: string;
}

export interface KardexMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  warehouseId: string;
  movementType: string;
  qty: number;
  unitCost: number;
  balanceAfter: number;
  referenceDoc: string;
  actor: string;
}

export interface InvoiceItem {
  kind: 'PRODUCTO' | 'SERVICIO';
  refId: string;
  code: string;
  name: string;
  qty: number;
  price: number;
  taxPct: number;
  workerId?: string;
  workerName?: string;
}

export interface AbonoRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  note: string;
}

export interface Invoice {
  id: string;
  cufe: string;
  date: string;
  customerId: string;
  customerName: string;
  customerNit: string;
  contractId: string;
  vehicleId: string;
  plate: string;
  mechanicId: string;
  mechanicName: string;
  workshopMeta?: Record<string, string>;
  layoutVariant: string;
  items: InvoiceItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  pendingBalance: number;
  status: string;
  abonosHistory: AbonoRecord[];
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentSource: string;
  responsible: string;
}

export interface Worker {
  id: string;
  code: string;
  name: string;
  docNumber: string;
  specialty: string;
  commissionPct: number;
  phone: string;
  totalDayGross: number;
}

export interface WorkOrder {
  id: string;
  createdAt: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  plate: string;
  vehicleBrand: string;
  currentKm: number;
  nextOilKm: number;
  workerId: string;
  workerName: string;
  status: string;
  serviceDesc: string;
  totalEstimated: number;
}

export interface DiningTable {
  id: string;
  name: string;
  zone: string;
  waiter: string;
  status: string;
  items: { productId: string; name: string; qty: number; price: number; note: string }[];
  total: number;
}

export interface HotelRoom {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: string;
  nightlyRate: number;
  status: string;
  checkInCode: string;
  guestId: string;
  guestName: string;
  checkInDate: string;
  nights: number;
  extrasTotal: number;
}

export interface CargoRoute {
  id: string;
  code: string;
  description: string;
  origin: string;
  destination: string;
}

export interface ScaleTicket {
  id: string;
  date: string;
  vehicleId: string;
  plate: string;
  driverId: string;
  driverName: string;
  carrierId: string;
  carrierName: string;
  cargoId: string;
  cargoDesc: string;
  grossKg: number;
  tareKg: number;
  netKg: number;
  status: string;
}

export interface PucAccount {
  id: string;
  code: string;
  name: string;
  category: string;
}

export interface PrintDocumentPayload {
  document_type: string;
  layout_variant?: string;
  document_number: string;
  issue_date?: string;
  customer_name?: string;
  customer_nit?: string;
  customer_phone?: string;
  customer_address?: string;
  payment_method?: string;
  extra_fields?: Record<string, string>;
  items: {
    code: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_pct?: number;
    subtotal: number;
  }[];
  subtotal?: number;
  discount_total?: number;
  tax_total?: number;
  grand_total: number;
  pending_balance?: number;
  notes?: string;
}

export function formatCop(amount: number): string {
  return '$' + Math.round(Number(amount || 0)).toLocaleString('es-CO');
}
