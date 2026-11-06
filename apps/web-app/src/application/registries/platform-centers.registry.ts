import { SRV_APPOINTMENTS_FRONTEND_VIEW } from '../../../../srv-appointments/frontend/appointments-service.view.js';
import { SRV_CRM_FRONTEND_VIEW } from '../../../../srv-crm/frontend/crm-service.view.js';
import { SRV_FINANCE_FRONTEND_VIEW } from '../../../../srv-finance/frontend/finance-service.view.js';
import { SRV_FLEET_FRONTEND_VIEW } from '../../../../srv-fleet/frontend/fleet-service.view.js';
import { SRV_GASTRO_FRONTEND_VIEW } from '../../../../srv-gastro/frontend/gastro-service.view.js';
import { SRV_HOTEL_FRONTEND_VIEW } from '../../../../srv-hotel/frontend/hotel-service.view.js';
import { SRV_HR_PAYROLL_FRONTEND_VIEW } from '../../../../srv-hr-payroll/frontend/hr-payroll-service.view.js';
import { SRV_INVENTORY_FRONTEND_VIEW } from '../../../../srv-inventory/frontend/inventory-service.view.js';
import { SRV_INVOICING_FRONTEND_VIEW } from '../../../../srv-invoicing/frontend/invoicing-service.view.js';
import { SRV_PROCUREMENT_FRONTEND_VIEW } from '../../../../srv-procurement/frontend/procurement-service.view.js';
import { SRV_REPORTS_FRONTEND_VIEW } from '../../../../srv-reports/frontend/reports-service.view.js';
import { SRV_TICKETING_FRONTEND_VIEW } from '../../../../srv-ticketing/frontend/ticketing-service.view.js';
import { SRV_TREASURY_FRONTEND_VIEW } from '../../../../srv-treasury/frontend/treasury-service.view.js';
import { SRV_WORKSHOP_FRONTEND_VIEW } from '../../../../srv-workshop/frontend/workshop-service.view.js';
import type {
  BusinessTypePreset,
  MicroserviceComponentFeature,
  MicroserviceFrontendDefinition,
  MicroserviceSubmoduleTab,
} from '../../domain/contracts/platform-hub.contract.js';

export const MICROSERVICE_FRONTEND_CATALOG: readonly MicroserviceFrontendDefinition[] = [
  SRV_INVOICING_FRONTEND_VIEW,
  SRV_INVENTORY_FRONTEND_VIEW,
  SRV_GASTRO_FRONTEND_VIEW,
  SRV_WORKSHOP_FRONTEND_VIEW,
  SRV_CRM_FRONTEND_VIEW,
  SRV_TREASURY_FRONTEND_VIEW,
  SRV_PROCUREMENT_FRONTEND_VIEW,
  SRV_HOTEL_FRONTEND_VIEW,
  SRV_APPOINTMENTS_FRONTEND_VIEW,
  SRV_FLEET_FRONTEND_VIEW,
  SRV_TICKETING_FRONTEND_VIEW,
  SRV_FINANCE_FRONTEND_VIEW,
  SRV_HR_PAYROLL_FRONTEND_VIEW,
  SRV_REPORTS_FRONTEND_VIEW,
];

export const ALL_SUBMODULES_FLAT: readonly MicroserviceSubmoduleTab[] =
  MICROSERVICE_FRONTEND_CATALOG.flatMap((svc) => svc.submodules);

export const ALL_FEATURES_FLAT: readonly MicroserviceComponentFeature[] =
  MICROSERVICE_FRONTEND_CATALOG.flatMap((svc) => svc.features);

export const BUSINESS_TYPE_PRESETS: readonly BusinessTypePreset[] = [
  {
    id: 'comercio-retail',
    name: 'Comercio, Tienda y Ferretería',
    badge: 'Comercio y Ventas',
    description: 'Punto de Venta, Inventario, Proveedores, Clientes, Caja y Reportes.',
    baseMonthlyUsd: 169000,
    includedPrincipalServices: ['srv-invoicing', 'srv-inventory', 'srv-procurement', 'srv-crm', 'srv-treasury', 'srv-reports'],
    includedSubmodules: ['mod-pos', 'mod-quotes', 'mod-stock', 'mod-warehouses', 'mod-purchase-orders', 'mod-directory', 'mod-receivables-cxc', 'mod-sales-profitability-reports'],
    includedFeatures: ['comp-cashier-name', 'comp-line-discount', 'comp-manager-signature', 'comp-nit-dv-auto'],
  },
  {
    id: 'restaurante-gastro',
    name: 'Restaurante, Gastrobar y Cafetería',
    badge: 'Gastronomía',
    description: 'Mesas, Comandas para Cocina/Barra, Carta, División de Cuentas, Domicilios, Caja e Inventario.',
    baseMonthlyUsd: 199000,
    includedPrincipalServices: ['srv-gastro', 'srv-invoicing', 'srv-inventory', 'srv-procurement', 'srv-treasury', 'srv-reports'],
    includedSubmodules: ['mod-tables', 'mod-kds', 'mod-modifiers-menu', 'mod-split', 'mod-deliveries', 'mod-pos', 'mod-stock', 'mod-recipes', 'mod-petty-cash', 'mod-sales-profitability-reports'],
    includedFeatures: ['comp-cashier-name', 'comp-tip', 'comp-waiter-assign', 'comp-courtesy-auth'],
  },
  {
    id: 'bares-discotecas',
    name: 'Bares, Licores y Eventos',
    badge: 'Bares y Eventos',
    description: 'Mesas y Barra, Comandas, Taquilla/Covers, Control de Puerta, Inventario de Licores y Caja.',
    baseMonthlyUsd: 199000,
    includedPrincipalServices: ['srv-gastro', 'srv-ticketing', 'srv-invoicing', 'srv-inventory', 'srv-treasury', 'srv-reports'],
    includedSubmodules: ['mod-tables', 'mod-kds', 'mod-split', 'mod-event-tickets', 'mod-gate-scanner', 'mod-pos', 'mod-stock', 'mod-recipes', 'mod-petty-cash'],
    includedFeatures: ['comp-bar-shot-measure', 'comp-happy-hour-pricing', 'comp-waiter-assign', 'comp-tip', 'comp-cashier-name', 'comp-anti-clone-qr-gate'],
  },
  {
    id: 'talleres-fixmotor',
    name: 'Talleres Automotrices y Servicio Técnico',
    badge: 'Talleres y Repuestos',
    description: 'Recepción de Vehículos, Tablero de Órdenes, Comisiones de Técnicos, Inventario de Repuestos, Clientes y Facturación.',
    baseMonthlyUsd: 229000,
    includedPrincipalServices: ['srv-workshop', 'srv-inventory', 'srv-procurement', 'srv-invoicing', 'srv-crm', 'srv-treasury', 'srv-reports'],
    includedSubmodules: ['mod-vehicles-assets', 'mod-work-orders-kanban', 'mod-worker-commissions', 'mod-warranties', 'mod-stock', 'mod-warehouses', 'mod-purchase-orders', 'mod-pos', 'mod-dian', 'mod-directory'],
    includedFeatures: ['comp-intake-checklist-sign', 'comp-warranty-vin-alert', 'comp-nit-dv-auto', 'comp-cashier-name'],
  },
  {
    id: 'servicios-citas-v2',
    name: 'Consultorios, Centros de Servicios y Citas',
    badge: 'Citas y Convenios',
    description: 'Agenda de Citas, Horarios de Profesionales, Clientes, Convenios, Facturación y Cartera.',
    baseMonthlyUsd: 249000,
    includedPrincipalServices: ['srv-appointments', 'srv-crm', 'srv-invoicing', 'srv-inventory', 'srv-treasury', 'srv-reports'],
    includedSubmodules: ['mod-calendar-slots', 'mod-staff-schedules', 'mod-queue-turnador', 'mod-directory', 'mod-contracts', 'mod-tariffs', 'mod-grouped-billing', 'mod-glosas-disputes', 'mod-dian', 'mod-tech-reception', 'mod-lots'],
    includedFeatures: ['comp-overbooking-guard', 'comp-whatsapp-ai-reschedule', 'comp-contract-budget-alert', 'comp-expiry-semaphore'],
  },
  {
    id: 'reservas-tickets-hotel',
    name: 'Hoteles, Cabañas, Clubes y Pasadías',
    badge: 'Hotelería y Turismo',
    description: 'Habitaciones y Check-In, Reservas, Camareras, Pasadías, Restaurante y Facturación.',
    baseMonthlyUsd: 229000,
    includedPrincipalServices: ['srv-hotel', 'srv-ticketing', 'srv-gastro', 'srv-invoicing', 'srv-crm', 'srv-treasury'],
    includedSubmodules: ['mod-bookings', 'mod-rooms', 'mod-seasonal-rates', 'mod-housekeeping', 'mod-tickets', 'mod-tables', 'mod-pos', 'mod-dian', 'mod-directory'],
    includedFeatures: ['comp-qr-ticket', 'comp-cashier-name', 'comp-nit-dv-auto'],
  },
  {
    id: 'distribuidora-mayorista',
    name: 'Distribuidora Mayorista y Multi-Bodega',
    badge: 'Mayorista y Bodegas',
    description: 'Facturación, Listas de Precios, Bodegas, Traslados, Compras, Cartera Clientes/Proveedores y Contabilidad.',
    baseMonthlyUsd: 259000,
    includedPrincipalServices: ['srv-invoicing', 'srv-inventory', 'srv-procurement', 'srv-treasury', 'srv-crm', 'srv-finance', 'srv-reports'],
    includedSubmodules: ['mod-pos', 'mod-dian', 'mod-tariffs', 'mod-quotes', 'mod-stock', 'mod-warehouses', 'mod-transfers', 'mod-purchase-orders', 'mod-purchase-invoices', 'mod-receivables-cxc', 'mod-payables-cxp', 'mod-directory', 'mod-puc'],
    includedFeatures: ['comp-manager-signature', 'comp-carrier-select', 'comp-credit-quota-lock', 'comp-margin-drop-alert'],
  },
  {
    id: 'agro-logistica-bascula',
    name: 'Agroindustria, Transporte de Carga y Báscula',
    badge: 'Transporte y Pesaje',
    description: 'Pesaje en Báscula, Despachos de Carga, Anticipos de Viaje, Bodegas, Compras y Facturación.',
    baseMonthlyUsd: 289000,
    includedPrincipalServices: ['srv-fleet', 'srv-inventory', 'srv-procurement', 'srv-invoicing', 'srv-treasury', 'srv-crm', 'srv-finance'],
    includedSubmodules: ['mod-fleet-scale', 'mod-fleet-dispatch-rndc', 'mod-trip-settlements', 'mod-tires-fleet-maint', 'mod-stock', 'mod-warehouses', 'mod-transfers', 'mod-lots', 'mod-scale', 'mod-support-doc-dse', 'mod-dian', 'mod-receivables-cxc', 'mod-payables-cxp', 'mod-directory'],
    includedFeatures: ['comp-manager-signature', 'comp-carrier-select', 'comp-scale-tare', 'comp-weighbridge-humidity-discount', 'comp-rndc-manifest-sync'],
  },
  {
    id: 'erp-corporativo-integral',
    name: 'Empresa Integral Multi-Sede (Todos los Módulos)',
    badge: 'Plan Empresarial Completo',
    description: 'Incluye Facturación, Inventario, Compras, Clientes, Caja, Contabilidad, Nómina y Reportes.',
    baseMonthlyUsd: 389000,
    includedPrincipalServices: ['srv-invoicing', 'srv-inventory', 'srv-gastro', 'srv-workshop', 'srv-procurement', 'srv-treasury', 'srv-finance', 'srv-hr-payroll', 'srv-reports', 'srv-crm', 'srv-hotel', 'srv-appointments', 'srv-fleet', 'srv-ticketing'],
    includedSubmodules: ['mod-pos', 'mod-dian', 'mod-tariffs', 'mod-grouped-billing', 'mod-stock', 'mod-warehouses', 'mod-transfers', 'mod-purchase-orders', 'mod-purchase-invoices', 'mod-support-doc-dse', 'mod-receivables-cxc', 'mod-payables-cxp', 'mod-banks-reconciliation', 'mod-puc', 'mod-cost-centers', 'mod-fixed-assets', 'mod-exogena-taxes', 'mod-employees-contracts', 'mod-payroll-settlement', 'mod-social-benefits-pila', 'mod-financial-reports', 'mod-tax-dian-reports', 'mod-directory', 'mod-contracts'],
    includedFeatures: ['comp-nit-dv-auto', 'comp-credit-quota-lock', 'comp-withholding-calc', 'comp-ley1607-exoneration', 'comp-cune-dian-payroll', 'comp-dian-xml-exporter'],
  },
];
