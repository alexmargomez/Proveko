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

/**
 * Registro central que ensambla los 14 Frontends que viven dentro de cada Microservicio (apps/srv-[servicio]/frontend/).
 */
export const MICROSERVICE_FRONTEND_CATALOG: readonly MicroserviceFrontendDefinition[] = [
  SRV_INVOICING_FRONTEND_VIEW,
  SRV_INVENTORY_FRONTEND_VIEW,
  SRV_PROCUREMENT_FRONTEND_VIEW,
  SRV_TREASURY_FRONTEND_VIEW,
  SRV_CRM_FRONTEND_VIEW,
  SRV_FINANCE_FRONTEND_VIEW,
  SRV_HR_PAYROLL_FRONTEND_VIEW,
  SRV_REPORTS_FRONTEND_VIEW,
  SRV_GASTRO_FRONTEND_VIEW,
  SRV_WORKSHOP_FRONTEND_VIEW,
  SRV_FLEET_FRONTEND_VIEW,
  SRV_APPOINTMENTS_FRONTEND_VIEW,
  SRV_HOTEL_FRONTEND_VIEW,
  SRV_TICKETING_FRONTEND_VIEW,
];

export const ALL_SUBMODULES_FLAT: readonly MicroserviceSubmoduleTab[] =
  MICROSERVICE_FRONTEND_CATALOG.flatMap((svc) => svc.submodules);

export const ALL_FEATURES_FLAT: readonly MicroserviceComponentFeature[] =
  MICROSERVICE_FRONTEND_CATALOG.flatMap((svc) => svc.features);

/**
 * 9 Grupos de Clientes (Tipos de Negocio Oficiales en proveko_groups_db):
 * Habilitan los Módulos Principales, Submódulos y Funcionalidades básicas para operar de inmediato,
 * permitiendo agregar Módulos Principales o Submódulos adicionales con costo en COP.
 */
export const BUSINESS_TYPE_PRESETS: readonly BusinessTypePreset[] = [
  {
    id: 'comercio-retail',
    name: 'Comercio, Tienda & Ferretería',
    badge: 'Plan Base Completo Comercial',
    description: 'Incluye Caja POS, Cotizaciones, Existencias, Bodega Base, Compras a Proveedores, Directorio de Clientes, Cartera y Reportes.',
    baseMonthlyUsd: 169000,
    includedPrincipalServices: ['srv-invoicing', 'srv-inventory', 'srv-procurement', 'srv-crm', 'srv-treasury', 'srv-reports'],
    includedSubmodules: ['mod-pos', 'mod-quotes', 'mod-stock', 'mod-warehouses', 'mod-purchase-orders', 'mod-directory', 'mod-receivables-cxc', 'mod-sales-profitability-reports'],
    includedFeatures: ['comp-cashier-name', 'comp-line-discount', 'comp-manager-signature', 'comp-nit-dv-auto'],
  },
  {
    id: 'restaurante-gastro',
    name: 'Restaurante, Gastrobar & Cafetería',
    badge: 'Plan Base Completo Gastronómico',
    description: 'Incluye Salón y Mesas, Monitor KDS, Modificadores de Carta, División de Cuentas, Domicilios, Caja POS con Propina y Recetas BOM.',
    baseMonthlyUsd: 199000,
    includedPrincipalServices: ['srv-gastro', 'srv-invoicing', 'srv-inventory', 'srv-procurement', 'srv-treasury', 'srv-reports'],
    includedSubmodules: ['mod-tables', 'mod-kds', 'mod-modifiers-menu', 'mod-split', 'mod-deliveries', 'mod-pos', 'mod-stock', 'mod-recipes', 'mod-petty-cash', 'mod-sales-profitability-reports'],
    includedFeatures: ['comp-cashier-name', 'comp-tip', 'comp-waiter-assign', 'comp-courtesy-auth'],
  },
  {
    id: 'bares-discotecas',
    name: 'Bares, Licores & Entretenimiento Nocturno',
    badge: 'Plan Base Especializado Bares',
    description: 'Incluye Barra y Mesas, Comandas KDS, Control por Trago/Botella, Happy Hour, Taquilla/Covers QR, Torniquetes y Caja POS.',
    baseMonthlyUsd: 199000,
    includedPrincipalServices: ['srv-gastro', 'srv-ticketing', 'srv-invoicing', 'srv-inventory', 'srv-treasury', 'srv-reports'],
    includedSubmodules: ['mod-tables', 'mod-kds', 'mod-split', 'mod-event-tickets', 'mod-gate-scanner', 'mod-pos', 'mod-stock', 'mod-recipes', 'mod-petty-cash'],
    includedFeatures: ['comp-bar-shot-measure', 'comp-happy-hour-pricing', 'comp-waiter-assign', 'comp-tip', 'comp-cashier-name', 'comp-anti-clone-qr-gate'],
  },
  {
    id: 'talleres-fixmotor',
    name: 'Talleres Automotrices, CDA & Servicio Técnico (FixMotor)',
    badge: 'Plan Especializado FixMotor',
    description: 'Incluye Flota/Vehículos de Clientes, Órdenes de Trabajo Kanban con Checklist, Comisiones de Técnicos, Garantías, Repuestos y POS/FE.',
    baseMonthlyUsd: 229000,
    includedPrincipalServices: ['srv-workshop', 'srv-inventory', 'srv-procurement', 'srv-invoicing', 'srv-crm', 'srv-treasury', 'srv-reports'],
    includedSubmodules: ['mod-vehicles-assets', 'mod-work-orders-kanban', 'mod-worker-commissions', 'mod-warranties', 'mod-stock', 'mod-warehouses', 'mod-purchase-orders', 'mod-pos', 'mod-dian', 'mod-directory', 'mod-customer-360'],
    includedFeatures: ['comp-intake-checklist-sign', 'comp-warranty-vin-alert', 'comp-nit-dv-auto', 'comp-cashier-name'],
  },
  {
    id: 'servicios-citas-v2',
    name: 'Consultorios, IPS, Centros de Servicios & Citas (v2)',
    badge: 'Plan Especializado Estilo v2',
    description: 'Incluye Agendas Multi-Profesional, Recordatorios WhatsApp IA, Turnador TV, Contratos con Bolsa v2, Tarifarios, Facturación Agrupada y Glosas.',
    baseMonthlyUsd: 249000,
    includedPrincipalServices: ['srv-appointments', 'srv-crm', 'srv-invoicing', 'srv-inventory', 'srv-treasury', 'srv-reports'],
    includedSubmodules: ['mod-calendar-slots', 'mod-staff-schedules', 'mod-interactive-reminders', 'mod-queue-turnador', 'mod-directory', 'mod-contracts', 'mod-tariffs', 'mod-grouped-billing', 'mod-glosas-disputes', 'mod-dian', 'mod-tech-reception', 'mod-lots'],
    includedFeatures: ['comp-overbooking-guard', 'comp-whatsapp-ai-reschedule', 'comp-contract-budget-alert', 'comp-expiry-semaphore'],
  },
  {
    id: 'reservas-tickets-hotel',
    name: 'Hoteles, Glamping, Clubes & Taquilla de Eventos',
    badge: 'Plan Base Alojamiento y Cupos',
    description: 'Incluye Reserva de Cabañas/Salones, Recepción y Folio de Huésped, Tarifas por Temporada, Ama de Llaves, Pasadías QR y Facturación.',
    baseMonthlyUsd: 229000,
    includedPrincipalServices: ['srv-hotel', 'srv-ticketing', 'srv-gastro', 'srv-invoicing', 'srv-crm', 'srv-treasury'],
    includedSubmodules: ['mod-bookings', 'mod-rooms', 'mod-seasonal-rates', 'mod-housekeeping', 'mod-tickets', 'mod-tables', 'mod-pos', 'mod-dian', 'mod-directory'],
    includedFeatures: ['comp-qr-ticket', 'comp-cashier-name', 'comp-nit-dv-auto'],
  },
  {
    id: 'distribuidora-mayorista',
    name: 'Distribuidora Mayorista, Importadora & Multi-Bodega',
    badge: 'Plan Base Completo Mayorista',
    description: 'Incluye Facturación DIAN, Tarifarios, Bodegas WMS, Traslados, Toma Física Ciega, Compras, RADIAN, Documento Soporte, Cartera CxC/CxP y PUC.',
    baseMonthlyUsd: 259000,
    includedPrincipalServices: ['srv-invoicing', 'srv-inventory', 'srv-procurement', 'srv-treasury', 'srv-crm', 'srv-finance', 'srv-reports'],
    includedSubmodules: ['mod-pos', 'mod-dian', 'mod-tariffs', 'mod-quotes', 'mod-stock', 'mod-warehouses', 'mod-transfers', 'mod-physical-count', 'mod-purchase-orders', 'mod-purchase-invoices', 'mod-radian-events', 'mod-landed-costs', 'mod-receivables-cxc', 'mod-payables-cxp', 'mod-directory', 'mod-puc'],
    includedFeatures: ['comp-manager-signature', 'comp-carrier-select', 'comp-credit-quota-lock', 'comp-margin-drop-alert'],
  },
  {
    id: 'agro-logistica-bascula',
    name: 'Agroindustria, Transporte de Carga RNDC & Báscula Camionera',
    badge: 'Plan Base Completo Logístico y Pesaje',
    description: 'Incluye Báscula Camionera RS-232 (Bruto/Tara/Neto), Manifiestos RNDC, Anticipos y Liquidación de Viajes, Llantas, Bodegas, Lotes y DIAN.',
    baseMonthlyUsd: 289000,
    includedPrincipalServices: ['srv-fleet', 'srv-inventory', 'srv-procurement', 'srv-invoicing', 'srv-treasury', 'srv-crm', 'srv-finance'],
    includedSubmodules: ['mod-fleet-scale', 'mod-fleet-dispatch-rndc', 'mod-trip-settlements', 'mod-tires-fleet-maint', 'mod-stock', 'mod-warehouses', 'mod-transfers', 'mod-lots', 'mod-scale', 'mod-support-doc-dse', 'mod-dian', 'mod-receivables-cxc', 'mod-payables-cxp', 'mod-directory'],
    includedFeatures: ['comp-manager-signature', 'comp-carrier-select', 'comp-scale-tare', 'comp-weighbridge-humidity-discount', 'comp-rndc-manifest-sync'],
  },
  {
    id: 'erp-corporativo-integral',
    name: 'ERP Corporativo Multi-Sede (NIIF + Nómina DIAN + BI)',
    badge: 'Suite Empresarial Todo-en-Uno',
    description: 'Habilita Contabilidad NIIF, Exógena DIAN, Nómina Electrónica CUNE + PILA, Tesorería, Compras RADIAN, Inventario WMS, Facturación y BI.',
    baseMonthlyUsd: 389000,
    includedPrincipalServices: ['srv-invoicing', 'srv-inventory', 'srv-procurement', 'srv-treasury', 'srv-finance', 'srv-hr-payroll', 'srv-reports', 'srv-crm'],
    includedSubmodules: ['mod-pos', 'mod-dian', 'mod-tariffs', 'mod-grouped-billing', 'mod-stock', 'mod-warehouses', 'mod-transfers', 'mod-physical-count', 'mod-purchase-orders', 'mod-purchase-invoices', 'mod-support-doc-dse', 'mod-radian-events', 'mod-receivables-cxc', 'mod-payables-cxp', 'mod-banks-reconciliation', 'mod-puc', 'mod-cost-centers', 'mod-fixed-assets', 'mod-exogena-taxes', 'mod-employees-contracts', 'mod-payroll-settlement', 'mod-social-benefits-pila', 'mod-electronic-payroll-dian', 'mod-financial-reports', 'mod-tax-dian-reports', 'mod-directory', 'mod-contracts'],
    includedFeatures: ['comp-nit-dv-auto', 'comp-credit-quota-lock', 'comp-withholding-calc', 'comp-ley1607-exoneration', 'comp-cune-dian-payroll', 'comp-dian-xml-exporter'],
  },
];
