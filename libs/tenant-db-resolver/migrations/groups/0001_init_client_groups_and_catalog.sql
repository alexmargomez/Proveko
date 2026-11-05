-- ============================================================================
-- PROVEKO GROUPS & CATALOG DB (proveko_groups_db) — MIGRATION 0001
-- Base de Datos Dedicada para Grupos de Clientes (Bares, Restaurantes, Comercio,
-- Agro/Báscula, Cupos/Tickets, Mayoristas) y su Matriz de Módulos Principales,
-- Submódulos y Funcionalidades (Componentes Minis) administrable por Desarrolladores.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "public"."client_business_groups" (
  "group_key" VARCHAR(64) PRIMARY KEY,
  "group_name" VARCHAR(160) NOT NULL,
  "badge_label" VARCHAR(120) NOT NULL,
  "description" TEXT NOT NULL,
  "base_monthly_cop" BIGINT NOT NULL DEFAULT 149000,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "public"."catalog_principal_modules" (
  "service_key" VARCHAR(64) PRIMARY KEY,
  "external_name" VARCHAR(160) NOT NULL,
  "icon_emoji" VARCHAR(16) NOT NULL DEFAULT '📦',
  "subtitle" TEXT NOT NULL,
  "standalone_monthly_cop" BIGINT NOT NULL DEFAULT 119000,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "public"."catalog_submodules" (
  "submodule_key" VARCHAR(64) PRIMARY KEY,
  "parent_service_key" VARCHAR(64) NOT NULL REFERENCES "public"."catalog_principal_modules"("service_key") ON DELETE CASCADE,
  "external_name" VARCHAR(160) NOT NULL,
  "tab_icon" VARCHAR(16) NOT NULL DEFAULT '📋',
  "summary" TEXT NOT NULL,
  "addon_monthly_cop" BIGINT NOT NULL DEFAULT 39000,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "public"."catalog_features" (
  "feature_key" VARCHAR(64) PRIMARY KEY,
  "parent_service_key" VARCHAR(64) NOT NULL REFERENCES "public"."catalog_principal_modules"("service_key") ON DELETE CASCADE,
  "parent_submodule_key" VARCHAR(64) NOT NULL DEFAULT 'independent',
  "external_name" VARCHAR(160) NOT NULL,
  "description" TEXT NOT NULL,
  "addon_monthly_cop" BIGINT NOT NULL DEFAULT 15000,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "public"."business_group_bundle_items" (
  "bundle_id" VARCHAR(160) PRIMARY KEY,
  "group_key" VARCHAR(64) NOT NULL REFERENCES "public"."client_business_groups"("group_key") ON DELETE CASCADE,
  "item_tier" VARCHAR(32) NOT NULL CHECK ("item_tier" IN ('MODULO_PRINCIPAL', 'SUBMODULO', 'FUNCIONALIDAD')),
  "item_key" VARCHAR(64) NOT NULL,
  "included_in_base_plan" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 1. SEMILLA DE MÓDULOS PRINCIPALES (MICROSERVICIOS) EN PESOS COLOMBIANOS (COP)
-- ============================================================================
INSERT INTO "public"."catalog_principal_modules" ("service_key", "external_name", "icon_emoji", "subtitle", "standalone_monthly_cop")
VALUES
  ('srv-invoicing', 'Facturación y Ventas', '🧾', 'Caja registradora POS, facturación electrónica DIAN, cotizaciones y remisiones.', 119000),
  ('srv-inventory', 'Inventario, Bodegas y Logística', '📦', 'Existencias, apartado de bodegas, solicitudes para traslados, recetas, lotes y báscula camionera.', 139000),
  ('srv-gastro', 'Restaurantes, Bares, Mesas y Comandas', '🍽️', 'Control de salón, barra de licores, comandas KDS en vivo y división de cuentas.', 119000),
  ('srv-hotel', 'Reservas de Cupos, Tickets y Alojamiento', '🎟️', 'Agenda de cupos por franja horaria, taquilla de tickets con código QR y recepción.', 119000),
  ('srv-crm', 'Clientes, Proveedores y Terceros (v2)', '🤝', 'Listado maestro de clientes, proveedores y transportistas con filtros v2, cupos y fidelización.', 95000),
  ('srv-finance', 'Tesorería, Cartera y Contabilidad', '🏦', 'Flujo de caja y bancos, recaudo de cartera CxC, pago a proveedores CxP y asientos PUC.', 119000)
ON CONFLICT ("service_key") DO UPDATE SET
  "external_name" = EXCLUDED."external_name",
  "standalone_monthly_cop" = EXCLUDED."standalone_monthly_cop";

-- ============================================================================
-- 2. SEMILLA DE SUBMÓDULOS (MÓDULOS INTERNOS EN PESTAÑAS)
-- ============================================================================
INSERT INTO "public"."catalog_submodules" ("submodule_key", "parent_service_key", "external_name", "tab_icon", "summary", "addon_monthly_cop")
VALUES
  ('mod-pos', 'srv-invoicing', 'Caja POS y Comprobantes', '🛒', 'Terminal de venta rápida con carrito interactivo, impuestos y arqueo de turno.', 45000),
  ('mod-dian', 'srv-invoicing', 'Facturación Electrónica DIAN', '🏛️', 'Emisión de facturas electrónicas con validación previa, CUFE y envío XML/PDF.', 69000),
  ('mod-quotes', 'srv-invoicing', 'Cotizaciones y Remisiones', '📋', 'Propuestas comerciales, remisiones de salida y conversión a factura.', 39000),
  ('mod-stock', 'srv-inventory', 'Existencias y Catálogo', '📊', 'Kardex valorizado de productos, insumos, costo promedio y punto de reorden.', 39000),
  ('mod-warehouses', 'srv-inventory', 'Bodegas', '🏭', 'Administración de bodegas físicas, centros de acopio, capacidad y encargado.', 45000),
  ('mod-transfers', 'srv-inventory', 'Solicitudes para Traslados', '🔄', 'Solicitudes de traslado entre bodegas con transportista y firma de encargado.', 55000),
  ('mod-recipes', 'srv-inventory', 'Recetas y Producción', '🧪', 'Fórmulas de producción y escandallos de cocina/barra con explosión de insumos.', 55000),
  ('mod-lots', 'srv-inventory', 'Lotes y Vencimientos', '📅', 'Trazabilidad sanitaria por lote, fecha de vencimiento y despacho FEFO.', 39000),
  ('mod-scale', 'srv-inventory', 'Báscula y Tractomulas', '🚛', 'Control de tractomulas en báscula camionera, pesaje Bruto/Tara/Neto y muelle.', 75000),
  ('mod-tables', 'srv-gastro', 'Salón, Barra y Mapa de Mesas', '🪑', 'Ocupación de mesas y barra, comensales activos y asignación de mesero/bartender.', 39000),
  ('mod-kds', 'srv-gastro', 'Monitor de Cocina y Barra (KDS)', '🔥', 'Tablero de comandas en tiempo real por estación (parrilla, cocina fría, barra).', 45000),
  ('mod-split', 'srv-gastro', 'División de Cuentas', '➗', 'Separación de cuenta por silla, por comensal o en partes iguales.', 29000),
  ('mod-bookings', 'srv-hotel', 'Reserva de Cupos y Agenda', '📅', 'Control de cupos disponibles por fecha, franja horaria y capacidad máxima.', 39000),
  ('mod-tickets', 'srv-hotel', 'Emisión de Tickets y Taquilla', '🎫', 'Expedición de tickets numerados de ingreso, cover y validación QR en portería.', 45000),
  ('mod-rooms', 'srv-hotel', 'Recepción y Alojamiento', '🏨', 'Check-in, check-out, estado de habitaciones y cargos a la cuenta del huésped.', 45000),
  ('mod-directory', 'srv-crm', 'Listado de Clientes y Terceros (v2)', '📇', 'Directorio completo estilo v2 de clientes, proveedores y transportistas con filtros.', 29000),
  ('mod-pipelines', 'srv-crm', 'Oportunidades y Embudo', '📈', 'Seguimiento de negocios en negociación, etapa comercial y cierre esperado.', 39000),
  ('mod-loyalty', 'srv-crm', 'Fidelización y Puntos', '⭐', 'Acumulación y redención de puntos por compras frecuentes y categorías VIP.', 29000),
  ('mod-cashbook', 'srv-finance', 'Caja y Bancos', '💵', 'Ingresos, egresos de tesorería, arqueo de turno y saldos en cuentas bancarias.', 39000),
  ('mod-arap', 'srv-finance', 'Cartera CxC y CxP', '📑', 'Seguimiento de cuentas por cobrar a clientes y obligaciones por pagar a proveedores.', 45000),
  ('mod-puc', 'srv-finance', 'Contabilidad PUC', '📘', 'Comprobantes de diario, causación automática por cuenta PUC y balance.', 45000)
ON CONFLICT ("submodule_key") DO UPDATE SET
  "external_name" = EXCLUDED."external_name",
  "addon_monthly_cop" = EXCLUDED."addon_monthly_cop";

-- ============================================================================
-- 3. SEMILLA DE FUNCIONALIDADES (COMPONENTES MINIS)
-- ============================================================================
INSERT INTO "public"."catalog_features" ("feature_key", "parent_service_key", "parent_submodule_key", "external_name", "description", "addon_monthly_cop")
VALUES
  ('comp-cashier-name', 'srv-invoicing', 'mod-pos', 'Ingreso de nombre de cajero y turno', 'Habilita la identificación del cajero responsable en cada comprobante POS.', 15000),
  ('comp-tip', 'srv-invoicing', 'mod-pos', 'Propina sugerida en cuenta', 'Permite registrar porcentaje de propina voluntaria en la liquidación de caja.', 15000),
  ('comp-line-discount', 'srv-invoicing', 'mod-pos', 'Descuento por línea en carrito', 'Permite aplicar porcentaje de descuento individual por producto en el carrito POS.', 19000),
  ('comp-manager-signature', 'srv-inventory', 'independent', 'Firma de encargado', 'Exige registrar la firma o nombre del encargado responsable en bodegas, traslados y remisiones.', 19000),
  ('comp-carrier-select', 'srv-inventory', 'mod-transfers', 'Seleccionar transportista', 'Habilita el selector de empresa transportista y placa en traslados de bodega y báscula.', 19000),
  ('comp-scale-tare', 'srv-inventory', 'mod-scale', 'Cálculo automático Bruto / Tara / Neto en báscula', 'Calcula en vivo el peso neto destarado en kilogramos y toneladas para tractomulas.', 25000),
  ('comp-waiter-assign', 'srv-gastro', 'mod-tables', 'Asignación de mesero / bartender por mesa', 'Registra el mesero o bartender responsable en apertura de mesa y barra.', 15000),
  ('comp-bar-shot-measure', 'srv-gastro', 'mod-tables', 'Control de inventario por trago / botella (Bares)', 'Descuenta automáticamente onzas o mililitros de botellas abiertas al vender tragos o cócteles.', 19000),
  ('comp-happy-hour-pricing', 'srv-gastro', 'mod-tables', 'Tarifas automáticas Happy Hour (Bares)', 'Activa precios promocionales por franja horaria en barra y mesas.', 15000),
  ('comp-qr-ticket', 'srv-hotel', 'mod-tickets', 'Validador QR de ticket en portería', 'Genera y valida token QR único para control de acceso en eventos, bares y cupos.', 19000),
  ('comp-nit-dv-auto', 'srv-crm', 'mod-directory', 'Cálculo automático de Dígito de Verificación NIT', 'Calcula automáticamente el DV fiscal al registrar clientes, proveedores o transportistas.', 15000)
ON CONFLICT ("feature_key") DO UPDATE SET
  "external_name" = EXCLUDED."external_name",
  "addon_monthly_cop" = EXCLUDED."addon_monthly_cop";

-- ============================================================================
-- 4. SEMILLA DE GRUPOS DE CLIENTES (TIPOS DE NEGOCIO)
-- ============================================================================
INSERT INTO "public"."client_business_groups" ("group_key", "group_name", "badge_label", "description", "base_monthly_cop", "is_active")
VALUES
  ('comercio-retail', 'Comercio, Tienda & Ferretería', 'Plan Base Completo Comercial', 'Incluye Caja POS, Cotizaciones, Existencias de Inventario, Bodega Base, Listado de Clientes v2 y Caja/Bancos.', 149000, TRUE),
  ('restaurante-gastro', 'Restaurante, Gastrobar & Cafetería', 'Plan Base Completo Gastronómico', 'Incluye Salón y Mesas, Monitor de Cocina (KDS), División de Cuentas, Caja POS con Propina, Existencias y Recetas.', 189000, TRUE),
  ('bares-discotecas', 'Bares, Licores & Entretenimiento Nocturno', 'Plan Base Especializado Bares', 'Incluye Barra y Mesas, Comandas KDS de Barra, Control por Trago/Botella, Happy Hour, Tickets/Cover QR y Caja POS.', 179000, TRUE),
  ('agro-logistica-bascula', 'Agroindustria, Bodegas & Báscula Camionera', 'Plan Base Completo Logístico', 'Incluye Báscula y Tractomulas (Bruto/Tara/Neto), Bodegas, Solicitudes para Traslados, Existencias, Lotes y Facturación.', 269000, TRUE),
  ('reservas-tickets-hotel', 'Reservas de Cupos, Taquilla de Tickets & Alojamiento', 'Plan Base Completo de Cupos y Tickets', 'Incluye Agenda de Cupos, Emisión de Tickets con QR, Recepción de Alojamiento, Caja POS y Listado de Clientes v2.', 209000, TRUE),
  ('distribuidora-mayorista', 'Distribuidora Mayorista & Multi-Bodega', 'Plan Base Completo Mayorista', 'Incluye Facturación Electrónica DIAN, Cotizaciones, Bodegas, Solicitudes de Traslado, Cartera CxC/CxP y Embudo Comercial.', 229000, TRUE)
ON CONFLICT ("group_key") DO UPDATE SET
  "group_name" = EXCLUDED."group_name",
  "base_monthly_cop" = EXCLUDED."base_monthly_cop",
  "description" = EXCLUDED."description";

-- ============================================================================
-- 5. MATRIZ DE ASIGNACIÓN POR GRUPO DE CLIENTES (business_group_bundle_items)
-- ============================================================================
INSERT INTO "public"."business_group_bundle_items" ("bundle_id", "group_key", "item_tier", "item_key", "included_in_base_plan")
VALUES
  -- Grupo: bares-discotecas
  ('bares-discotecas:MODULO_PRINCIPAL:srv-gastro', 'bares-discotecas', 'MODULO_PRINCIPAL', 'srv-gastro', TRUE),
  ('bares-discotecas:MODULO_PRINCIPAL:srv-invoicing', 'bares-discotecas', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('bares-discotecas:MODULO_PRINCIPAL:srv-inventory', 'bares-discotecas', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('bares-discotecas:MODULO_PRINCIPAL:srv-hotel', 'bares-discotecas', 'MODULO_PRINCIPAL', 'srv-hotel', TRUE),
  ('bares-discotecas:MODULO_PRINCIPAL:srv-finance', 'bares-discotecas', 'MODULO_PRINCIPAL', 'srv-finance', TRUE),
  ('bares-discotecas:SUBMODULO:mod-tables', 'bares-discotecas', 'SUBMODULO', 'mod-tables', TRUE),
  ('bares-discotecas:SUBMODULO:mod-kds', 'bares-discotecas', 'SUBMODULO', 'mod-kds', TRUE),
  ('bares-discotecas:SUBMODULO:mod-split', 'bares-discotecas', 'SUBMODULO', 'mod-split', TRUE),
  ('bares-discotecas:SUBMODULO:mod-tickets', 'bares-discotecas', 'SUBMODULO', 'mod-tickets', TRUE),
  ('bares-discotecas:SUBMODULO:mod-pos', 'bares-discotecas', 'SUBMODULO', 'mod-pos', TRUE),
  ('bares-discotecas:SUBMODULO:mod-stock', 'bares-discotecas', 'SUBMODULO', 'mod-stock', TRUE),
  ('bares-discotecas:SUBMODULO:mod-recipes', 'bares-discotecas', 'SUBMODULO', 'mod-recipes', TRUE),
  ('bares-discotecas:SUBMODULO:mod-cashbook', 'bares-discotecas', 'SUBMODULO', 'mod-cashbook', TRUE),
  ('bares-discotecas:FUNCIONALIDAD:comp-bar-shot-measure', 'bares-discotecas', 'FUNCIONALIDAD', 'comp-bar-shot-measure', TRUE),
  ('bares-discotecas:FUNCIONALIDAD:comp-happy-hour-pricing', 'bares-discotecas', 'FUNCIONALIDAD', 'comp-happy-hour-pricing', TRUE),
  ('bares-discotecas:FUNCIONALIDAD:comp-waiter-assign', 'bares-discotecas', 'FUNCIONALIDAD', 'comp-waiter-assign', TRUE),
  ('bares-discotecas:FUNCIONALIDAD:comp-tip', 'bares-discotecas', 'FUNCIONALIDAD', 'comp-tip', TRUE),
  ('bares-discotecas:FUNCIONALIDAD:comp-cashier-name', 'bares-discotecas', 'FUNCIONALIDAD', 'comp-cashier-name', TRUE),
  ('bares-discotecas:FUNCIONALIDAD:comp-qr-ticket', 'bares-discotecas', 'FUNCIONALIDAD', 'comp-qr-ticket', TRUE),
  -- Grupo: comercio-retail
  ('comercio-retail:MODULO_PRINCIPAL:srv-invoicing', 'comercio-retail', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('comercio-retail:MODULO_PRINCIPAL:srv-inventory', 'comercio-retail', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('comercio-retail:MODULO_PRINCIPAL:srv-crm', 'comercio-retail', 'MODULO_PRINCIPAL', 'srv-crm', TRUE),
  ('comercio-retail:MODULO_PRINCIPAL:srv-finance', 'comercio-retail', 'MODULO_PRINCIPAL', 'srv-finance', TRUE),
  ('comercio-retail:SUBMODULO:mod-pos', 'comercio-retail', 'SUBMODULO', 'mod-pos', TRUE),
  ('comercio-retail:SUBMODULO:mod-quotes', 'comercio-retail', 'SUBMODULO', 'mod-quotes', TRUE),
  ('comercio-retail:SUBMODULO:mod-stock', 'comercio-retail', 'SUBMODULO', 'mod-stock', TRUE),
  ('comercio-retail:SUBMODULO:mod-warehouses', 'comercio-retail', 'SUBMODULO', 'mod-warehouses', TRUE),
  ('comercio-retail:SUBMODULO:mod-directory', 'comercio-retail', 'SUBMODULO', 'mod-directory', TRUE),
  ('comercio-retail:SUBMODULO:mod-cashbook', 'comercio-retail', 'SUBMODULO', 'mod-cashbook', TRUE),
  ('comercio-retail:FUNCIONALIDAD:comp-cashier-name', 'comercio-retail', 'FUNCIONALIDAD', 'comp-cashier-name', TRUE),
  ('comercio-retail:FUNCIONALIDAD:comp-line-discount', 'comercio-retail', 'FUNCIONALIDAD', 'comp-line-discount', TRUE),
  ('comercio-retail:FUNCIONALIDAD:comp-manager-signature', 'comercio-retail', 'FUNCIONALIDAD', 'comp-manager-signature', TRUE),
  ('comercio-retail:FUNCIONALIDAD:comp-nit-dv-auto', 'comercio-retail', 'FUNCIONALIDAD', 'comp-nit-dv-auto', TRUE),
  -- Grupo: restaurante-gastro
  ('restaurante-gastro:MODULO_PRINCIPAL:srv-gastro', 'restaurante-gastro', 'MODULO_PRINCIPAL', 'srv-gastro', TRUE),
  ('restaurante-gastro:MODULO_PRINCIPAL:srv-invoicing', 'restaurante-gastro', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('restaurante-gastro:MODULO_PRINCIPAL:srv-inventory', 'restaurante-gastro', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('restaurante-gastro:MODULO_PRINCIPAL:srv-finance', 'restaurante-gastro', 'MODULO_PRINCIPAL', 'srv-finance', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-tables', 'restaurante-gastro', 'SUBMODULO', 'mod-tables', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-kds', 'restaurante-gastro', 'SUBMODULO', 'mod-kds', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-split', 'restaurante-gastro', 'SUBMODULO', 'mod-split', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-pos', 'restaurante-gastro', 'SUBMODULO', 'mod-pos', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-stock', 'restaurante-gastro', 'SUBMODULO', 'mod-stock', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-recipes', 'restaurante-gastro', 'SUBMODULO', 'mod-recipes', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-cashbook', 'restaurante-gastro', 'SUBMODULO', 'mod-cashbook', TRUE),
  ('restaurante-gastro:FUNCIONALIDAD:comp-cashier-name', 'restaurante-gastro', 'FUNCIONALIDAD', 'comp-cashier-name', TRUE),
  ('restaurante-gastro:FUNCIONALIDAD:comp-tip', 'restaurante-gastro', 'FUNCIONALIDAD', 'comp-tip', TRUE),
  ('restaurante-gastro:FUNCIONALIDAD:comp-waiter-assign', 'restaurante-gastro', 'FUNCIONALIDAD', 'comp-waiter-assign', TRUE),
  -- Grupo: agro-logistica-bascula
  ('agro-logistica-bascula:MODULO_PRINCIPAL:srv-inventory', 'agro-logistica-bascula', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('agro-logistica-bascula:MODULO_PRINCIPAL:srv-invoicing', 'agro-logistica-bascula', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('agro-logistica-bascula:MODULO_PRINCIPAL:srv-crm', 'agro-logistica-bascula', 'MODULO_PRINCIPAL', 'srv-crm', TRUE),
  ('agro-logistica-bascula:MODULO_PRINCIPAL:srv-finance', 'agro-logistica-bascula', 'MODULO_PRINCIPAL', 'srv-finance', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-stock', 'agro-logistica-bascula', 'SUBMODULO', 'mod-stock', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-warehouses', 'agro-logistica-bascula', 'SUBMODULO', 'mod-warehouses', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-transfers', 'agro-logistica-bascula', 'SUBMODULO', 'mod-transfers', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-lots', 'agro-logistica-bascula', 'SUBMODULO', 'mod-lots', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-scale', 'agro-logistica-bascula', 'SUBMODULO', 'mod-scale', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-pos', 'agro-logistica-bascula', 'SUBMODULO', 'mod-pos', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-dian', 'agro-logistica-bascula', 'SUBMODULO', 'mod-dian', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-directory', 'agro-logistica-bascula', 'SUBMODULO', 'mod-directory', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-arap', 'agro-logistica-bascula', 'SUBMODULO', 'mod-arap', TRUE),
  ('agro-logistica-bascula:FUNCIONALIDAD:comp-manager-signature', 'agro-logistica-bascula', 'FUNCIONALIDAD', 'comp-manager-signature', TRUE),
  ('agro-logistica-bascula:FUNCIONALIDAD:comp-carrier-select', 'agro-logistica-bascula', 'FUNCIONALIDAD', 'comp-carrier-select', TRUE),
  ('agro-logistica-bascula:FUNCIONALIDAD:comp-scale-tare', 'agro-logistica-bascula', 'FUNCIONALIDAD', 'comp-scale-tare', TRUE),
  ('agro-logistica-bascula:FUNCIONALIDAD:comp-cashier-name', 'agro-logistica-bascula', 'FUNCIONALIDAD', 'comp-cashier-name', TRUE),
  -- Grupo: reservas-tickets-hotel
  ('reservas-tickets-hotel:MODULO_PRINCIPAL:srv-hotel', 'reservas-tickets-hotel', 'MODULO_PRINCIPAL', 'srv-hotel', TRUE),
  ('reservas-tickets-hotel:MODULO_PRINCIPAL:srv-invoicing', 'reservas-tickets-hotel', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('reservas-tickets-hotel:MODULO_PRINCIPAL:srv-crm', 'reservas-tickets-hotel', 'MODULO_PRINCIPAL', 'srv-crm', TRUE),
  ('reservas-tickets-hotel:MODULO_PRINCIPAL:srv-finance', 'reservas-tickets-hotel', 'MODULO_PRINCIPAL', 'srv-finance', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-bookings', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-bookings', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-tickets', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-tickets', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-rooms', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-rooms', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-pos', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-pos', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-directory', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-directory', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-cashbook', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-cashbook', TRUE),
  ('reservas-tickets-hotel:FUNCIONALIDAD:comp-qr-ticket', 'reservas-tickets-hotel', 'FUNCIONALIDAD', 'comp-qr-ticket', TRUE),
  ('reservas-tickets-hotel:FUNCIONALIDAD:comp-cashier-name', 'reservas-tickets-hotel', 'FUNCIONALIDAD', 'comp-cashier-name', TRUE),
  -- Grupo: distribuidora-mayorista
  ('distribuidora-mayorista:MODULO_PRINCIPAL:srv-invoicing', 'distribuidora-mayorista', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('distribuidora-mayorista:MODULO_PRINCIPAL:srv-inventory', 'distribuidora-mayorista', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('distribuidora-mayorista:MODULO_PRINCIPAL:srv-crm', 'distribuidora-mayorista', 'MODULO_PRINCIPAL', 'srv-crm', TRUE),
  ('distribuidora-mayorista:MODULO_PRINCIPAL:srv-finance', 'distribuidora-mayorista', 'MODULO_PRINCIPAL', 'srv-finance', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-pos', 'distribuidora-mayorista', 'SUBMODULO', 'mod-pos', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-dian', 'distribuidora-mayorista', 'SUBMODULO', 'mod-dian', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-quotes', 'distribuidora-mayorista', 'SUBMODULO', 'mod-quotes', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-stock', 'distribuidora-mayorista', 'SUBMODULO', 'mod-stock', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-warehouses', 'distribuidora-mayorista', 'SUBMODULO', 'mod-warehouses', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-transfers', 'distribuidora-mayorista', 'SUBMODULO', 'mod-transfers', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-directory', 'distribuidora-mayorista', 'SUBMODULO', 'mod-directory', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-pipelines', 'distribuidora-mayorista', 'SUBMODULO', 'mod-pipelines', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-cashbook', 'distribuidora-mayorista', 'SUBMODULO', 'mod-cashbook', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-arap', 'distribuidora-mayorista', 'SUBMODULO', 'mod-arap', TRUE),
  ('distribuidora-mayorista:FUNCIONALIDAD:comp-manager-signature', 'distribuidora-mayorista', 'FUNCIONALIDAD', 'comp-manager-signature', TRUE),
  ('distribuidora-mayorista:FUNCIONALIDAD:comp-carrier-select', 'distribuidora-mayorista', 'FUNCIONALIDAD', 'comp-carrier-select', TRUE),
  ('distribuidora-mayorista:FUNCIONALIDAD:comp-cashier-name', 'distribuidora-mayorista', 'FUNCIONALIDAD', 'comp-cashier-name', TRUE),
  ('distribuidora-mayorista:FUNCIONALIDAD:comp-line-discount', 'distribuidora-mayorista', 'FUNCIONALIDAD', 'comp-line-discount', TRUE)
ON CONFLICT ("bundle_id") DO NOTHING;
