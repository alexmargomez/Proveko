import { SRV_CRM_FRONTEND_VIEW } from '../../../../srv-crm/frontend/crm-service.view.js';
import { SRV_FINANCE_FRONTEND_VIEW } from '../../../../srv-finance/frontend/finance-service.view.js';
import { SRV_GASTRO_FRONTEND_VIEW } from '../../../../srv-gastro/frontend/gastro-service.view.js';
import { SRV_HOTEL_FRONTEND_VIEW } from '../../../../srv-hotel/frontend/hotel-service.view.js';
import { SRV_INVENTORY_FRONTEND_VIEW } from '../../../../srv-inventory/frontend/inventory-service.view.js';
import { SRV_INVOICING_FRONTEND_VIEW } from '../../../../srv-invoicing/frontend/invoicing-service.view.js';
import type {
  BusinessTypePreset,
  MicroserviceComponentFeature,
  MicroserviceFrontendDefinition,
  MicroserviceSubmoduleTab,
} from '../../domain/contracts/platform-hub.contract.js';

/**
 * Registro central que ensambla los Frontends que viven dentro de cada Microservicio (apps/srv-[servicio]/frontend/).
 */
export const MICROSERVICE_FRONTEND_CATALOG: readonly MicroserviceFrontendDefinition[] = [
  SRV_INVOICING_FRONTEND_VIEW,
  SRV_INVENTORY_FRONTEND_VIEW,
  SRV_GASTRO_FRONTEND_VIEW,
  SRV_HOTEL_FRONTEND_VIEW,
  SRV_CRM_FRONTEND_VIEW,
  SRV_FINANCE_FRONTEND_VIEW,
];

export const ALL_SUBMODULES_FLAT: readonly MicroserviceSubmoduleTab[] =
  MICROSERVICE_FRONTEND_CATALOG.flatMap((svc) => svc.submodules);

export const ALL_FEATURES_FLAT: readonly MicroserviceComponentFeature[] =
  MICROSERVICE_FRONTEND_CATALOG.flatMap((svc) => svc.features);

/**
 * Tipos de Negocio Oficiales:
 * Al seleccionar el Tipo de Negocio, se habilitan los Módulos Principales, Submódulos y Funcionalidades
 * básicas para que el negocio opere de forma completa por el valor base.
 * Si el cliente desea agregar Módulos Principales o Submódulos adicionales en el Paso 2, ahí se suman costos.
 */
export const BUSINESS_TYPE_PRESETS: readonly BusinessTypePreset[] = [
  {
    id: 'comercio-retail',
    name: 'Comercio, Tienda & Ferretería',
    badge: 'Plan Base Completo Comercial',
    description: 'Incluye Caja POS, Cotizaciones, Existencias de Inventario, Bodega Base, Directorio de Clientes y Caja/Bancos.',
    baseMonthlyUsd: 39,
    includedPrincipalServices: ['srv-invoicing', 'srv-inventory', 'srv-crm', 'srv-finance'],
    includedSubmodules: ['mod-pos', 'mod-quotes', 'mod-stock', 'mod-warehouses', 'mod-directory', 'mod-cashbook'],
    includedFeatures: ['comp-cashier-name', 'comp-line-discount', 'comp-manager-signature'],
  },
  {
    id: 'restaurante-gastro',
    name: 'Restaurante, Bar & Gastronomía',
    badge: 'Plan Base Completo Gastronómico',
    description: 'Incluye Salón y Mesas, Monitor de Cocina (KDS), División de Cuentas, Caja POS con Propina, Existencias y Recetas.',
    baseMonthlyUsd: 49,
    includedPrincipalServices: ['srv-gastro', 'srv-invoicing', 'srv-inventory', 'srv-finance'],
    includedSubmodules: ['mod-tables', 'mod-kds', 'mod-split', 'mod-pos', 'mod-stock', 'mod-recipes', 'mod-cashbook'],
    includedFeatures: ['comp-cashier-name', 'comp-tip', 'comp-waiter-assign'],
  },
  {
    id: 'agro-logistica-bascula',
    name: 'Agroindustria, Bodegas & Báscula Camionera',
    badge: 'Plan Base Completo Logístico',
    description: 'Incluye Báscula y Tractomulas (Bruto/Tara/Neto), Bodegas, Solicitudes para Traslados, Existencias, Lotes y Facturación.',
    baseMonthlyUsd: 69,
    includedPrincipalServices: ['srv-inventory', 'srv-invoicing', 'srv-crm', 'srv-finance'],
    includedSubmodules: ['mod-stock', 'mod-warehouses', 'mod-transfers', 'mod-lots', 'mod-scale', 'mod-pos', 'mod-dian', 'mod-directory', 'mod-arap'],
    includedFeatures: ['comp-manager-signature', 'comp-carrier-select', 'comp-scale-tare', 'comp-cashier-name'],
  },
  {
    id: 'reservas-tickets-hotel',
    name: 'Reservas de Cupos, Taquilla de Tickets & Alojamiento',
    badge: 'Plan Base Completo de Cupos y Tickets',
    description: 'Incluye Agenda de Cupos, Emisión de Tickets con QR, Recepción de Alojamiento, Caja POS y Directorio de Clientes.',
    baseMonthlyUsd: 54,
    includedPrincipalServices: ['srv-hotel', 'srv-invoicing', 'srv-crm', 'srv-finance'],
    includedSubmodules: ['mod-bookings', 'mod-tickets', 'mod-rooms', 'mod-pos', 'mod-directory', 'mod-cashbook'],
    includedFeatures: ['comp-qr-ticket', 'comp-cashier-name'],
  },
  {
    id: 'distribuidora-mayorista',
    name: 'Distribuidora Mayorista & Multi-Bodega',
    badge: 'Plan Base Completo Mayorista',
    description: 'Incluye Facturación Electrónica DIAN, Cotizaciones, Bodegas, Solicitudes de Traslado, Cartera CxC/CxP y Embudo Comercial.',
    baseMonthlyUsd: 59,
    includedPrincipalServices: ['srv-invoicing', 'srv-inventory', 'srv-crm', 'srv-finance'],
    includedSubmodules: ['mod-pos', 'mod-dian', 'mod-quotes', 'mod-stock', 'mod-warehouses', 'mod-transfers', 'mod-directory', 'mod-pipelines', 'mod-cashbook', 'mod-arap'],
    includedFeatures: ['comp-manager-signature', 'comp-carrier-select', 'comp-cashier-name', 'comp-line-discount'],
  },
];
