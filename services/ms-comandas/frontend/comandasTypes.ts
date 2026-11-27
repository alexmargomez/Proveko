import type { PkProcessStep, PkTypeCardOption } from '@platform/ui-sdk';

export type OrderChannel = 'MESA' | 'DOMICILIO' | 'PARA_LLEVAR';
export type OrderStage = 'LIBRE' | 'NUEVA' | 'PREPARANDO' | 'LISTA' | 'ENTREGADA';
export type ChannelPillKey = 'ALL' | 'MESA' | 'DOMICILIO' | 'PARA_LLEVAR';
export type SalonDisplayMode = 'floor' | 'table';

export interface MenuItem {
  id: string;
  code: string;
  name: string;
  category: string;
  salePrice: number;
  taxPct: number;
  fromInventory?: boolean;
}

export interface WaiterRecord {
  id: string;
  code: string;
  fullName: string;
  docId: string;
  phone: string;
  zone: string;
  shift: string;
  active: boolean;
}

export interface OrderItem {
  itemId: string;
  productId: string;
  name: string;
  qty: number;
  price: number;
  note: string;
}

export interface DiningTable {
  id: string;
  name: string;
  zone: string;
  waiter: string;
  status: string;
  orderCode?: string;
  channel?: string;
  orderStage?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  guests?: number;
  paymentHint?: string;
  openedAt?: string;
  items: OrderItem[];
  total: number;
}

export interface DraftOrderLine {
  draftId: string;
  productId: string;
  code: string;
  name: string;
  price: number;
  qty: number;
  note: string;
}

export interface ComandasStateResponse {
  ok: boolean;
  nextMenuCode: string;
  nextWaiterCode?: string;
  tables: DiningTable[];
  products: MenuItem[];
  waiters?: WaiterRecord[];
}

export interface OptionalInventoryResponse {
  ok?: boolean;
  products?: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    salePrice: number;
    taxPct?: number;
  }>;
}

export const VALID_MODULES = [
  'mapa_mesas',
  'monitor_cocina',
  'catalogo_mesas',
  'carta_servicios',
  'directorio_meseros',
] as const;

export const TABLE_ZONE_OPTIONS = [
  { value: 'Salón Principal', label: 'Salón Principal' },
  { value: 'Terraza', label: 'Terraza' },
  { value: 'VIP / Reservados', label: 'VIP / Reservados' },
  { value: 'Barra', label: 'Barra' },
];

export const FLOOR_ZONE_PILLS = [
  'Todas las Zonas',
  'Salón Principal',
  'Terraza',
  'VIP / Reservados',
] as const;

export const DISH_CATEGORY_OPTIONS = [
  { value: 'Restaurante — Fuertes', label: 'Restaurante — Fuertes' },
  { value: 'Restaurante — Entradas', label: 'Restaurante — Entradas' },
  { value: 'Barra y Bebidas', label: 'Barra y Bebidas' },
  { value: 'Postres y Cafetería', label: 'Postres y Cafetería' },
  { value: 'Servicios y Eventos', label: 'Servicios y Eventos' },
];

export const DISH_TAX_OPTIONS = [
  { value: '8', label: '8% Impoconsumo' },
  { value: '19', label: '19% IVA' },
  { value: '0', label: '0% Exento' },
];

export const WAITER_SHIFT_OPTIONS = [
  { value: 'Turno Completo', label: 'Turno Completo' },
  { value: 'Turno Apertura', label: 'Turno Apertura (Mañana / Almuerzo)' },
  { value: 'Turno Tarde / Noche', label: 'Turno Tarde / Noche' },
  { value: 'Turno Noche', label: 'Turno Noche' },
  { value: 'Fin de Semana', label: 'Refuerzo Fin de Semana' },
];

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'Efectivo en caja', label: 'Efectivo en caja' },
  { value: 'Efectivo contraentrega', label: 'Efectivo contraentrega' },
  { value: 'Tarjeta crédito / débito', label: 'Tarjeta crédito / débito' },
  { value: 'Datáfono inalámbrico', label: 'Datáfono inalámbrico' },
  { value: 'Transferencia electrónica', label: 'Transferencia electrónica' },
  { value: 'Pago con código QR', label: 'Pago con código QR' },
  { value: 'Factura electrónica corporativa', label: 'Factura electrónica corporativa' },
];

export const PICKUP_WINDOW_OPTIONS = [
  { value: 'Recoge en mostrador principal (15 min)', label: 'Mostrador principal — 15 min' },
  { value: 'Entrega rápida en bahía exterior (20 min)', label: 'Bahía exterior — 20 min' },
  { value: 'Empaque térmico corporativo (30 min)', label: 'Empaque térmico corporativo — 30 min' },
];

export const CHANNEL_TYPE_CARDS: PkTypeCardOption[] = [
  {
    key: 'MESA',
    icon: '🪑',
    title: 'Servicio en Mesa',
    description: 'Apertura o adición de platos para mesas de salón, terraza o reservados VIP.',
    badge: 'Salón',
  },
  {
    key: 'DOMICILIO',
    icon: '🛵',
    title: 'Domicilio con Entrega',
    description: 'Captura de cliente, dirección exacta, empaque sellado y medio de recaudo.',
    badge: 'Despacho',
  },
  {
    key: 'PARA_LLEVAR',
    icon: '🛍️',
    title: 'Pedido Para Llevar',
    description: 'Orden empacada para retiro ágil del cliente directamente en mostrador.',
    badge: 'Mostrador',
  },
];

export const KITCHEN_NOTE_PRESETS = [
  'Término 3/4',
  'Término medio',
  'Bien asado',
  'Sin cebolla',
  'Salsa aparte',
  'Sin azúcar',
];

export function resolveChannel(tbl: DiningTable): OrderChannel {
  const raw = (tbl.channel || '').toUpperCase().trim();
  if (raw === 'DOMICILIO') return 'DOMICILIO';
  if (raw === 'PARA_LLEVAR') return 'PARA_LLEVAR';
  return 'MESA';
}

export function resolveStage(tbl: DiningTable): OrderStage {
  const raw = (tbl.orderStage || '').toUpperCase().trim();
  if (tbl.status === 'Libre' && (!tbl.items || tbl.items.length === 0)) {
    return 'LIBRE';
  }
  if (raw === 'NUEVA' || raw === 'PREPARANDO' || raw === 'LISTA' || raw === 'ENTREGADA') {
    return raw;
  }
  if (tbl.status === 'En Cocina') return 'PREPARANDO';
  if (tbl.status !== 'Libre' || (tbl.items && tbl.items.length > 0)) return 'NUEVA';
  return 'LIBRE';
}

export function formatOpenedElapsed(openedAt?: string): string {
  const clean = (openedAt || '').trim();
  if (!clean) return 'En curso';
  if (clean.toLowerCase().startsWith('hace ')) return clean;
  const parsed = Date.parse(clean);
  if (Number.isNaN(parsed)) return clean;
  const diffMin = Math.max(1, Math.round((Date.now() - parsed) / 60000));
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const hrs = Math.floor(diffMin / 60);
  const rem = diffMin % 60;
  return rem > 0 ? `Hace ${hrs}h ${rem}m` : `Hace ${hrs}h`;
}

export function channelBadgeFor(channel: OrderChannel): {
  label: string;
  tone: 'coral' | 'blue' | 'purple';
} {
  if (channel === 'DOMICILIO') return { label: 'Domicilio', tone: 'coral' };
  if (channel === 'PARA_LLEVAR') return { label: 'Para llevar', tone: 'purple' };
  return { label: 'Mesa', tone: 'blue' };
}

export function buildOrderProcessSteps(
  stage: OrderStage,
  onSelectStage?: (target: OrderStage) => void
): PkProcessStep[] {
  const order: Array<Exclude<OrderStage, 'LIBRE'>> = ['NUEVA', 'PREPARANDO', 'LISTA', 'ENTREGADA'];
  const labels: Record<Exclude<OrderStage, 'LIBRE'>, string> = {
    NUEVA: 'Nueva',
    PREPARANDO: 'Cocina',
    LISTA: 'Lista',
    ENTREGADA: 'Entregada',
  };
  const currentIdx = stage === 'LIBRE' ? -1 : order.indexOf(stage);

  return order.map((st, idx) => {
    let status: PkProcessStep['status'] = 'pending';
    if (currentIdx > idx) status = 'done';
    else if (currentIdx === idx) status = st === 'ENTREGADA' ? 'done' : 'active';

    return {
      step: idx + 1,
      label: labels[st],
      status,
      tooltip: `Etapa: ${labels[st]}`,
      onClick: onSelectStage && stage !== 'LIBRE' ? () => onSelectStage(st) : undefined,
    };
  });
}

export function buildComandaPrintPayload(
  tbl: DiningTable,
  forKitchen: boolean
): Record<string, unknown> {
  const ch = resolveChannel(tbl);
  return {
    document_type: 'COMANDA',
    layout_variant: 'tirilla_80mm',
    document_number: `${forKitchen ? 'COC' : 'PRE'}-${(tbl.orderCode || tbl.id).replace('#', '').toUpperCase()}`,
    issue_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    customer_name: tbl.customerName
      ? `${tbl.customerName} (${tbl.name})`
      : `${tbl.name} — ${tbl.zone}`,
    extra_fields: {
      Comanda: tbl.orderCode || tbl.id.toUpperCase(),
      Canal: ch,
      Ubicacion: ch === 'MESA' ? `${tbl.name} · ${tbl.zone}` : tbl.deliveryAddress || tbl.zone,
      Responsable: tbl.waiter || 'Turno General',
      Etapa: resolveStage(tbl),
    },
    items: (tbl.items || []).map((it, idx) => ({
      code: `P-${idx + 1}`,
      description: it.note ? `${it.name} [Nota: ${it.note}]` : it.name,
      quantity: it.qty,
      unit_price: forKitchen ? 0 : it.price,
      subtotal: forKitchen ? 0 : it.qty * it.price,
    })),
    subtotal: forKitchen ? 0 : tbl.total,
    grand_total: forKitchen ? 0 : tbl.total,
    notes: forKitchen
      ? 'COMANDA DE PREPARACIÓN COCINA Y BARRA'
      : 'PRECUENTA INFORMATIVA — Solicite su factura electrónica en Caja POS.',
  };
}
