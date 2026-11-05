-- ============================================================================
-- PROVEKO GROUPS & CATALOG DB (proveko_groups_db) — MIGRATION 0001 (ENTERPRISE EXPANSION)
-- Base de Datos Dedicada para los 9 Grupos de Clientes (Comercio, Restaurantes, Bares,
-- Talleres FixMotor, Consultorios/Citas v2, Hoteles/Eventos, Mayoristas, Agro/Báscula RNDC,
-- ERP Corporativo Integral) y la Matriz Completa de:
--   - 14 Módulos Principales (Microservicios srv-*)
--   - 54 Submódulos (mod-*)
--   - 26 Funcionalidades (comp-*)
--   - Esquemas Dinámicos JSONB por Submódulo (catalog_submodule_schemas)
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

CREATE TABLE IF NOT EXISTS "public"."catalog_submodule_schemas" (
  "submodule_key" VARCHAR(64) PRIMARY KEY REFERENCES "public"."catalog_submodules"("submodule_key") ON DELETE CASCADE,
  "target_sql_schema" VARCHAR(64) NOT NULL,
  "target_sql_table" VARCHAR(80) NOT NULL,
  "table_headers_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "form_fields_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "validation_rules_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
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
-- 1. SEMILLA DE LOS 14 MÓDULOS PRINCIPALES (MICROSERVICIOS) EN PESOS COLOMBIANOS (COP)
-- ============================================================================
INSERT INTO "public"."catalog_principal_modules" ("service_key", "external_name", "icon_emoji", "subtitle", "standalone_monthly_cop")
VALUES
  ('srv-invoicing', 'Facturación DIAN, POS, Tarifarios (v2) y Glosas', '🧾', 'Caja POS con arqueo ciego, facturación electrónica UBL 2.1, tarifarios v2, facturación agrupada y glosas.', 145000),
  ('srv-inventory', 'Inventario, Bodegas, Lotes FEFO y Actas (v2)', '📦', 'Kardex valorizado, bodegas WMS, traslados, actas de recepción técnica v2, conteo físico ciego, recetas y báscula.', 149000),
  ('srv-procurement', 'Compras, Proveedores, RADIAN y Doc Soporte', '🛍️', 'Órdenes de compra a proveedores, recepción de facturas, buzón RADIAN (030/032/033) y Documento Soporte DIAN.', 119000),
  ('srv-treasury', 'Tesorería, Cartera CxC/CxP y Conciliación Bancaria', '💰', 'Recibos de caja, edades de cartera 30/60/90/120+, comprobantes de egreso, conciliación bancaria y cajas menores.', 119000),
  ('srv-crm', 'Clientes, Proveedores, Contratos (v2) y CRM 360', '🤝', 'Directorio maestro estilo v2 (NIT+DV, DANE, sucursales), contratos con bolsa presupuestal, LTV 360° y fidelización.', 115000),
  ('srv-finance', 'Contabilidad NIIF, PUC, Activos Fijos y Exógena DIAN', '📘', 'Plan Único de Cuentas PUC Colombia, asientos contables, centros de costo, activos fijos y medios magnéticos Exógena.', 139000),
  ('srv-hr-payroll', 'Nómina Electrónica DIAN, PILA y RRHH', '👥', 'Contratos laborales, liquidación quincenal/mensual, horas extras, seguridad social PILA, prestaciones y CUNE DIAN.', 170000),
  ('srv-reports', 'Centro de Reportes, Analítica BI y Exógena', '📊', 'Estados financieros NIIF, rentabilidad bruta por producto/vendedor, rotación de inventario, anexos DIAN y BI.', 129000),
  ('srv-gastro', 'Restaurantes, Bares, Comandas KDS y Domicilios', '🍽️', 'Salón y barras, comandas KDS por estación, carta con modificadores, división de cuentas y despacho de domicilios.', 129000),
  ('srv-workshop', 'Talleres Automotrices, Órdenes de Trabajo y Garantías (FixMotor)', '🔧', 'Recepción vehicular con checklist, tablero Kanban de OT, comisiones de técnicos y garantías.', 149000),
  ('srv-fleet', 'Flotas, Báscula Camionera y RNDC', '🚛', 'Báscula camionera RS-232 (Bruto/Tara/Neto), manifiestos RNDC Ministerio de Transporte, anticipos de viaje y llantas.', 165000),
  ('srv-appointments', 'Agendamiento, Turnos y Recordatorios IA (v2)', '📅', 'Motor de agendas multi-profesional y consultorios/recursos estilo v2, recordatorios interactivos WhatsApp IA y turnador.', 135000),
  ('srv-hotel', 'Hotelería, Alojamiento, Folios y Reservas', '🏨', 'Rack de habitaciones, check-in/out, folios de cargos (minibar/restaurante), tarifas por temporada y ama de llaves.', 129000),
  ('srv-ticketing', 'Taquilla QR, Eventos y Mesa PQRSF SLA', '🎫', 'Venta de boletería/covers con código QR antifraude, control de aforo en torniquetes y mesa PQRSF con SLA en días hábiles.', 130000)
ON CONFLICT ("service_key") DO UPDATE SET
  "external_name" = EXCLUDED."external_name",
  "subtitle" = EXCLUDED."subtitle",
  "standalone_monthly_cop" = EXCLUDED."standalone_monthly_cop";

-- ============================================================================
-- 2. SEMILLA DE LOS 54 SUBMÓDULOS (MÓDULOS INTERNOS EN PESTAÑAS)
-- ============================================================================
INSERT INTO "public"."catalog_submodules" ("submodule_key", "parent_service_key", "external_name", "tab_icon", "summary", "addon_monthly_cop")
VALUES
  -- srv-invoicing (6)
  ('mod-pos', 'srv-invoicing', 'Caja POS, Turnos y Tirilla Electrónica', '🛒', 'Terminal de venta rápida con carrito interactivo, pagos mixtos, arqueo ciego X/Z y cálculo de vueltas.', 45000),
  ('mod-dian', 'srv-invoicing', 'Facturación Electrónica DIAN (UBL 2.1)', '🏛️', 'Emisión de facturas electrónicas FEV, Notas Crédito y Débito con validación previa, CUFE y XML/PDF.', 69000),
  ('mod-tariffs', 'srv-invoicing', 'Listas de Precios y Tarifarios Pactados (v2)', '🏷️', 'Motor de tarifas estilo TarifaConvenio v2 con recargos/descuentos porcentuales y precios pactados por convenio.', 39000),
  ('mod-grouped-billing', 'srv-invoicing', 'Facturación Agrupada de Órdenes y Remisiones (v2)', '📦', 'Consolida múltiples órdenes de servicio o remisiones del mes en una sola Factura Corporativa con anexo.', 45000),
  ('mod-glosas-disputes', 'srv-invoicing', 'Radicación de Facturas y Auditoría de Glosas (v2)', '⚖️', 'Control de radicación ante clientes corporativos, registro de objeciones/glosas parciales y conciliación.', 45000),
  ('mod-quotes', 'srv-invoicing', 'Cotizaciones, Pedidos y Plan Separe', '📋', 'Propuestas comerciales, remisiones de entrega de mercancía, plan separe con abonos y conversión a factura.', 39000),
  -- srv-inventory (8)
  ('mod-stock', 'srv-inventory', 'Existencias, Variantes y Kardex Valorizado', '📊', 'Kardex valorizado de productos, variantes/seriales, costo promedio ponderado y punto de reorden.', 39000),
  ('mod-warehouses', 'srv-inventory', 'Bodegas y Ubicaciones WMS', '🏭', 'Administración de bodegas físicas, pasillos/estantes, capacidad instalada y responsable.', 45000),
  ('mod-transfers', 'srv-inventory', 'Solicitudes para Traslados entre Bodegas', '🔄', 'Solicitudes de traslado entre bodegas con despacho en tránsito, recepción, transportista y firma.', 55000),
  ('mod-tech-reception', 'srv-inventory', 'Actas de Recepción Técnica de Mercancía (v2)', '🌡️', 'Inspección técnica estilo InventarioActaRecepcion v2: temperatura, cadena de frío, registro sanitario y cuarentena.', 42000),
  ('mod-physical-count', 'srv-inventory', 'Toma Física Ciega y Conciliación de Mermas', '📋', 'Conteo físico ciego sin mostrar saldo del sistema a los operarios, cálculo de diferencias y ajuste automático.', 39000),
  ('mod-recipes', 'srv-inventory', 'Recetas y Producción BOM', '🧪', 'Fórmulas de producción y escandallos con descuento automático de insumos por unidad.', 55000),
  ('mod-lots', 'srv-inventory', 'Lotes y Vencimientos FEFO', '📅', 'Trazabilidad sanitaria por lote, fecha de vencimiento y despacho prioritario FEFO con semáforo.', 39000),
  ('mod-scale', 'srv-inventory', 'Báscula y Tractomulas', '🚛', 'Control de tractomulas en báscula camionera, pesaje Bruto/Tara/Neto, transportista y muelle.', 75000),
  -- srv-procurement (5)
  ('mod-purchase-orders', 'srv-procurement', 'Órdenes de Compra (OC)', '📝', 'Emisión de órdenes de compra (EgresoOrden v2) con control de cantidad pedida vs recibida en bodega.', 39000),
  ('mod-purchase-invoices', 'srv-procurement', 'Facturas de Compra y Gastos', '🧾', 'Causación de facturas de proveedores con cruce de OC, actualización de costo promedio y retenciones.', 39000),
  ('mod-support-doc-dse', 'srv-procurement', 'Documento Soporte DIAN (No Obligados)', '🏛️', 'Transmisión electrónica de Documento Soporte (CUDS) para compras y cuentas de cobro a no responsables de IVA.', 45000),
  ('mod-radian-events', 'srv-procurement', 'Buzón Tributario y Eventos RADIAN', '📨', 'Recepción de XML de proveedores y emisión de eventos DIAN 030 (Acuse), 032 (Recibo Bien) y 033 (Aceptación).', 39000),
  ('mod-landed-costs', 'srv-procurement', 'Prorrateo de Fletes e Importación', '🚢', 'Distribución de costos de transporte, seguros y aranceles sobre el costo unitario del Kardex.', 35000),
  -- srv-treasury (4)
  ('mod-receivables-cxc', 'srv-treasury', 'Cartera por Cobrar (CxC) y Recibos de Caja', '📥', 'Edades de cartera (30/60/90/120+ días), aplicación de abonos múltiples, retenciones practicadas por clientes y paz y salvo.', 39000),
  ('mod-payables-cxp', 'srv-treasury', 'Cuentas por Pagar (CxP) y Comprobantes de Egreso', '📤', 'Programación de pagos a proveedores, dispersión bancaria PAB/ACH y cruce de anticipos.', 39000),
  ('mod-banks-reconciliation', 'srv-treasury', 'Bancos, Extractos y Conciliación Bancaria', '🏦', 'Control de cuentas corrientes/ahorros, billeteras Nequi/Daviplata y cruce de extractos bancarios.', 42000),
  ('mod-petty-cash', 'srv-treasury', 'Cajas Menores, Anticipos y Reembolsos', '👛', 'Apertura de fondos fijos de caja menor, legalización de vales/gastos con NIT y solicitud de reembolso.', 29000),
  -- srv-crm (5)
  ('mod-directory', 'srv-crm', 'Listado de Clientes y Terceros (v2)', '📇', 'Directorio completo estilo version2: identificación NIT+DV, responsabilidades DIAN, DANE, sucursales y cupo de crédito.', 29000),
  ('mod-contracts', 'srv-crm', 'Contratos Comerciales y Bolsas Presupuestales (v2)', '📜', 'Convenios corporativos estilo EmpresaContrato v2 con techo presupuestal, consumo acumulado, vigencias y pólizas.', 45000),
  ('mod-customer-360', 'srv-crm', 'Expediente 360° LTV y Segmentación RFM', '🎯', 'Métricas tipo FixMotor: valor histórico comprado (LTV), ticket promedio, frecuencia de visita y alerta de inactividad.', 35000),
  ('mod-pipelines', 'srv-crm', 'Oportunidades y Embudo Comercial', '📈', 'Seguimiento de negocios en negociación, etapa comercial, ejecutivo asignado y cierre esperado.', 39000),
  ('mod-loyalty', 'srv-crm', 'Fidelización, Puntos y Cashback', '⭐', 'Acumulación y redención de puntos por compras frecuentes y categorías de cliente.', 29000),
  -- srv-finance (6)
  ('mod-puc', 'srv-finance', 'Plan Único de Cuentas (PUC) y Comprobantes', '📘', 'Comprobantes de diario, causación automática por cuenta PUC de 6-8 dígitos y validación de partida doble.', 45000),
  ('mod-cashbook', 'srv-finance', 'Libro de Caja, Bancos y Movimientos', '💵', 'Ingresos, egresos contables, arqueo de turno y saldos conciliados en cuentas bancarias.', 39000),
  ('mod-arap', 'srv-finance', 'Auxiliar de Cartera Fiscal CxC y CxP', '📑', 'Saldos contables por tercero para cruce de cuentas 1305 (Clientes) y 2205/2335 (Proveedores y Costos por Pagar).', 42000),
  ('mod-cost-centers', 'srv-finance', 'Centros y Subcentros de Costo / Proyectos', '🏗️', 'Contabilidad analítica por sede, unidad de negocio, proyecto o vehículo para medir rentabilidad real.', 35000),
  ('mod-fixed-assets', 'srv-finance', 'Activos Fijos y Depreciación NIIF', '🏢', 'Hoja de vida de maquinaria, vehículos y equipos con cálculo mensual automático de depreciación NIIF.', 39000),
  ('mod-exogena-taxes', 'srv-finance', 'Certificados de Retención y Exógena DIAN (1001-1009)', '🏛️', 'Generación de formatos de Información Exógena DIAN (1001, 1003, 1005, 1006, 1007, 1008, 1009) y certificados.', 49000),
  -- srv-hr-payroll (4)
  ('mod-employees-contracts', 'srv-hr-payroll', 'Empleados, Contratos, EPS, AFP, ARL y Fondos', '🪪', 'Ficha laboral completa, tipo de contrato (término fijo, indefinido, aprendizaje, integral) y nivel de riesgo ARL I-V.', 45000),
  ('mod-payroll-settlement', 'srv-hr-payroll', 'Liquidación de Nómina, Horas Extras y Novedades', '🧮', 'Cálculo de auxilio de transporte, HED (25%), HEN (75%), HRN (35%), dominicales, incapacidades, FSP y libranzas.', 52000),
  ('mod-social-benefits-pila', 'srv-hr-payroll', 'Seguridad Social PILA y Prestaciones Sociales', '🏦', 'Provisiones mensuales y liquidación de Prima de Servicios, Cesantías, Intereses (12%), Vacaciones y archivo plano PILA.', 49000),
  ('mod-electronic-payroll-dian', 'srv-hr-payroll', 'Transmisión Nómina Electrónica DIAN (NI / CUNE)', '🏛️', 'Generación XML mensual de Soporte de Pago de Nómina Electrónica (NI) y Notas de Ajuste (NA) con firma digital y CUNE.', 55000),
  -- srv-reports (5)
  ('mod-financial-reports', 'srv-reports', 'Estados Financieros NIIF y Libros Oficiales', '📈', 'Balance General (Estado de Situación Financiera), Estado de Resultados (PyG), Balance de Prueba por Tercero y Mayor.', 39000),
  ('mod-sales-profitability-reports', 'srv-reports', 'Ventas, Rentabilidad FIFO y Comisiones', '💹', 'Ventas por ítem, cliente, sede, cajero y franja horaria; margen bruto real descontando costo Kardex.', 35000),
  ('mod-inventory-reports', 'srv-reports', 'Valorización de Inventario, Rotación ABC y FEFO', '📦', 'Stock valorizado por bodega, productos hueso/sin rotación, alertas bajo stock mínimo y lotes próximos a vencer.', 35000),
  ('mod-tax-dian-reports', 'srv-reports', 'Anexos de IVA, Impoconsumo, Retenciones e ICA', '🏛️', ' Auxiliares bimestrales/cuatrimestrales de IVA generado vs descontable y bases de ReteFuente/ReteICA por municipio.', 39000),
  ('mod-custom-report-builder', 'srv-reports', 'Constructor de Reportes y Exportador Excel/PDF', '🛠️', 'Diseño de consultas personalizadas por filtros de fecha/sede/tercero con descarga directa en CSV, Excel y PDF.', 35000),
  -- srv-gastro (5)
  ('mod-tables', 'srv-gastro', 'Salón, Barras y Mapa de Mesas', '🪑', 'Ocupación de mesas por terraza o salón, comensales activos, medidas de licor y asignación de mesero.', 39000),
  ('mod-kds', 'srv-gastro', 'Monitor de Cocina y Barra (KDS)', '🔥', 'Tablero de comandas por estación de preparación (parrilla, cocina fría, barra de licores) y tiempos SLA.', 45000),
  ('mod-modifiers-menu', 'srv-gastro', 'Carta Digital, Términos de Cocción y Adiciones', '🥩', 'Configuración de términos de carne, adiciones con cobro extra, exclusiones y combos.', 29000),
  ('mod-split', 'srv-gastro', 'División de Cuentas y Pre-Cuentas', '➗', 'Separación de cuenta por silla, por comensal o en partes iguales con cálculo de Impoconsumo 8% y propina.', 29000),
  ('mod-deliveries', 'srv-gastro', 'Domicilios Propios, Plataformas y Motorizados', '🛵', 'Despacho de pedidos a domicilio por WhatsApp/Web/Rappi, asignación de domiciliario y cuadre de efectivo.', 35000),
  -- srv-workshop (4)
  ('mod-vehicles-assets', 'srv-workshop', 'Flota de Clientes, Placas, VIN y Peritaje', '🚗', 'Ficha técnica por placa/serial, propietario, historial de kilometraje, vencimiento SOAT/Tecnomecánica y alertas.', 39000),
  ('mod-work-orders-kanban', 'srv-workshop', 'Órdenes de Trabajo (OT) Kanban y Recepción', '📋', 'Flujo completo de OT: Recepción con inventario de ingreso, diagnóstico, cotización, repuestos, mano de obra y entrega.', 49000),
  ('mod-worker-commissions', 'srv-workshop', 'Liquidación de Técnicos y Mecánicos', '👷', 'Cálculo automático de comisiones por mano de obra ejecutada (% o tarifa fija por servicio) y productividad.', 39000),
  ('mod-warranties', 'srv-workshop', 'Garantías de Servicio, Repuestos y Posventa', '🛡️', 'Control de vigencia de garantías por días o kilometraje y recordatorios automáticos de próximo mantenimiento.', 35000),
  -- srv-fleet (4)
  ('mod-fleet-scale', 'srv-fleet', 'Báscula Camionera RS-232 y Destare de Flota', '⚖️', 'Pesaje camionero Bruto / Tara / Neto en kilogramos y toneladas, descuento por humedad/impureza y transportista.', 65000),
  ('mod-fleet-dispatch-rndc', 'srv-fleet', 'Despachos, Remesas y Manifiestos RNDC', '🛣️', 'Emisión de remesas terrestres de carga, manifiestos electrónicos RNDC, conductores y piso SICETAC.', 55000),
  ('mod-trip-settlements', 'srv-fleet', 'Anticipos de Viaje, Peajes, ACPM y Liquidación', '⛽', 'Legalización de anticipos de conductores, peajes, ACPM (rendimiento Km/Galón), viáticos y cumplido de remesa.', 49000),
  ('mod-tires-fleet-maint', 'srv-fleet', 'Control de Llantas por Eje, SOAT y Tecnomecánica', '🛞', 'Mapa de llantas por posición de eje, profundidad de labrado (mm), reencauches y alertas SOAT/Tecnomecánica.', 45000),
  -- srv-appointments (4)
  ('mod-calendar-slots', 'srv-appointments', 'Agenda Multi-Profesional y Recursos (v2)', '🗓️', 'Calendario por bloques horarios, asignación de sala/consultorio/bahía, control de inasistencias y estados de cita.', 45000),
  ('mod-staff-schedules', 'srv-appointments', 'Mallas Horarias, Bloqueos y Excepciones', '⏰', 'Configuración de turnos semanales por especialista, vacaciones, permisos y tiempos de alistamiento.', 35000),
  ('mod-interactive-reminders', 'srv-appointments', 'Recordatorios Interactivos WhatsApp / Email', '💬', 'Envío automatizado 24h y 2h antes con botones interactivos para Confirmar, Cancelar o Reprogramar en vivo.', 39000),
  ('mod-queue-turnador', 'srv-appointments', 'Sala de Espera, Check-In QR y Turnador TV', '📺', 'Registro de llegada en kiosco o QR, llamado en pantalla de sala de espera por módulo y métrica de espera.', 35000),
  -- srv-hotel (5)
  ('mod-bookings', 'srv-hotel', 'Reserva de Cupos, Cabañas y Salones', '📅', 'Control de disponibilidad por fecha, temporada, anticipo garantizado y bloqueo en calendario.', 39000),
  ('mod-rooms', 'srv-hotel', 'Recepción, Check-In y Folio de Huésped', '🛎️', 'Check-in, registro TRA MinCIT, estado de habitaciones y cuenta maestra (folio) de consumos.', 45000),
  ('mod-seasonal-rates', 'srv-hotel', 'Tarifas por Temporada y Planes de Estadía', '🌞', 'Configuración de tarifas dinámicas por temporada alta/media/baja, puentes festivos y planes con desayuno.', 35000),
  ('mod-housekeeping', 'srv-hotel', 'Ama de Llaves, Aseo y Mantenimiento', '🧹', 'Tablero operativo de habitaciones (Sucia, En Limpieza, Inspeccionada, Bloqueada) y conteo de lencería/minibar.', 32000),
  ('mod-tickets', 'srv-hotel', 'Pasadías, Eventos y Tickets de Acceso QR', '🎫', 'Expedición de pases de día (Day Pass), acceso a piscina/zonas húmedas y validación QR en portería.', 39000),
  -- srv-ticketing (3)
  ('mod-event-tickets', 'srv-ticketing', 'Taquilla, Covers, Palcos y Preventa QR', '🎟️', 'Emisión de entradas generales, VIP y palcos con consumo mínimo incluido y código QR único criptográfico.', 45000),
  ('mod-gate-scanner', 'srv-ticketing', 'Escáner de Puerta, Torniquetes y Aforo en Vivo', '🚧', 'Control de acceso en tiempo real por portería, contador de ocupación máxima legal y lista de cortesías.', 39000),
  ('mod-pqrsf-helpdesk', 'srv-ticketing', 'Mesa de Ayuda PQRSF y SLA Días Hábiles (Ley 1755)', '🛎️', 'Radicación de Peticiones, Quejas, Reclamos y Solicitudes con semáforo de vencimiento en días hábiles de Colombia.', 45000)
ON CONFLICT ("submodule_key") DO UPDATE SET
  "external_name" = EXCLUDED."external_name",
  "summary" = EXCLUDED."summary",
  "addon_monthly_cop" = EXCLUDED."addon_monthly_cop";

-- ============================================================================
-- 3. SEMILLA DE LAS 26 FUNCIONALIDADES (COMPONENTES MINIS)
-- ============================================================================
INSERT INTO "public"."catalog_features" ("feature_key", "parent_service_key", "parent_submodule_key", "external_name", "description", "addon_monthly_cop")
VALUES
  ('comp-cashier-name', 'srv-invoicing', 'mod-pos', 'Ingreso de nombre de cajero y turno', 'Habilita la identificación del cajero responsable en cada comprobante POS.', 15000),
  ('comp-tip', 'srv-invoicing', 'mod-pos', 'Propina sugerida en cuenta', 'Permite registrar porcentaje de propina voluntaria en la liquidación de caja.', 15000),
  ('comp-line-discount', 'srv-invoicing', 'mod-pos', 'Descuento por línea en carrito', 'Permite aplicar porcentaje de descuento individual por producto en el carrito POS.', 19000),
  ('comp-blind-cash-count', 'srv-invoicing', 'mod-pos', 'Arqueo ciego de caja X/Z por denominación', 'Exige declarar el conteo físico en efectivo sin ver el saldo teórico antes de cerrar turno.', 19000),
  ('comp-manager-signature', 'srv-inventory', 'independent', 'Firma de encargado', 'Exige registrar la firma o nombre del encargado responsable en bodegas, traslados y remisiones.', 19000),
  ('comp-carrier-select', 'srv-inventory', 'mod-transfers', 'Seleccionar transportista', 'Habilita el selector de empresa transportista y placa en traslados de bodega y báscula.', 19000),
  ('comp-scale-tare', 'srv-inventory', 'mod-scale', 'Cálculo automático Bruto / Tara / Neto en báscula', 'Calcula en vivo el peso neto destarado en kilogramos y toneladas para tractomulas.', 25000),
  ('comp-expiry-semaphore', 'srv-inventory', 'mod-lots', 'Semáforo visual FEFO de lotes próximos a vencer (30/60/90 días)', 'Destaca en rojo/ámbar/verde los lotes según sus días restantes de vida útil.', 15000),
  ('comp-margin-drop-alert', 'srv-procurement', 'mod-purchase-invoices', 'Alerta de caída de margen por alza de costo de proveedor', 'Advierte automáticamente al registrar una compra si el nuevo costo reduce el margen comercial esperado.', 15000),
  ('comp-po-approval-signature', 'srv-procurement', 'mod-purchase-orders', 'Firma de aprobación gerencial en Órdenes de Compra', 'Exige autorización firmada del jefe de compras o gerencia antes de despachar la orden al proveedor.', 15000),
  ('comp-bank-auto-match', 'srv-treasury', 'mod-banks-reconciliation', 'Cruce inteligente de referencias y montos en extractos bancarios', 'Sugiere conciliación automática cuando la referencia o valor del extracto coincide con un comprobante.', 19000),
  ('comp-nit-dv-auto', 'srv-crm', 'mod-directory', 'Cálculo automático de Dígito de Verificación NIT (Módulo 11 DIAN)', 'Calcula automáticamente el DV fiscal al registrar clientes, proveedores o transportistas.', 15000),
  ('comp-credit-quota-lock', 'srv-crm', 'mod-directory', 'Bloqueo automático de despacho por cupo de crédito o mora', 'Impide facturar a crédito cuando el cliente supera su cupo aprobado o presenta facturas vencidas.', 19000),
  ('comp-contract-budget-alert', 'srv-crm', 'mod-contracts', 'Alerta de agotamiento de bolsa presupuestal de contrato (v2)', 'Notifica cuando el consumo acumulado de un convenio supera el 80% del techo contratado.', 19000),
  ('comp-withholding-calc', 'srv-finance', 'mod-puc', 'Motor automático de ReteFuente, ReteIVA, ReteICA y Autorretención', 'Calcula automáticamente las retenciones según el régimen tributario del emisor y del tercero.', 25000),
  ('comp-ley1607-exoneration', 'srv-hr-payroll', 'mod-employees-contracts', 'Exoneración automática de aportes Ley 1607 (Art. 114-1 E.T.)', 'Aplica exoneración automática de Salud Patronal (8.5%), SENA (2%) e ICBF (3%) para devengos menores a 10 SMMLV.', 19000),
  ('comp-cune-dian-payroll', 'srv-hr-payroll', 'mod-electronic-payroll-dian', 'Firmador XAdES-EPES y validador CUNE de Nómina Electrónica DIAN', 'Genera el Código Único de Nómina Electrónica (CUNE SHA-384) y valida reglas DIAN antes de transmitir.', 25000),
  ('comp-dian-xml-exporter', 'srv-reports', 'mod-tax-dian-reports', 'Pre-validador y generador XML de Formatos Exógena DIAN', 'Verifica dígitos de verificación y topes antes de exportar los formatos oficiales de medios magnéticos.', 19000),
  ('comp-waiter-assign', 'srv-gastro', 'mod-tables', 'Asignación de mesero / bartender por mesa', 'Registra el mesero o bartender responsable en apertura de mesa y barra.', 15000),
  ('comp-bar-shot-measure', 'srv-gastro', 'mod-tables', 'Control de inventario por trago / botella (Bares)', 'Descuenta automáticamente onzas o mililitros de botellas abiertas al vender tragos o cócteles.', 19000),
  ('comp-happy-hour-pricing', 'srv-gastro', 'mod-tables', 'Tarifas automáticas Happy Hour (Bares)', 'Activa precios promocionales por franja horaria en barra y mesas.', 15000),
  ('comp-courtesy-auth', 'srv-gastro', 'mod-kds', 'PIN supervisor para cortesías y anulaciones de comanda', 'Exige autorización de administrador y motivo al anular un plato ya enviado a cocina.', 15000),
  ('comp-intake-checklist-sign', 'srv-workshop', 'mod-work-orders-kanban', 'Checklist de recepción con firma digital de conformidad', 'Registra estado de carrocería, nivel de combustible y objetos de valor al recibir el vehículo.', 15000),
  ('comp-warranty-vin-alert', 'srv-workshop', 'mod-warranties', 'Detector automático de reingreso en garantía por placa/VIN', 'Alerta en recepción si el vehículo que ingresa tiene una garantía activa de una orden reciente.', 15000),
  ('comp-weighbridge-humidity-discount', 'srv-fleet', 'mod-fleet-scale', 'Descuento automático por humedad e impureza en báscula camionera', 'Resta automáticamente el porcentaje de humedad e impureza de laboratorio sobre el peso neto destarado.', 25000),
  ('comp-rndc-manifest-sync', 'srv-fleet', 'mod-fleet-dispatch-rndc', 'Validación SICETAC y Radicación RNDC Ministerio de Transporte', 'Verifica piso tarifario SICETAC, retención 1% transporte y radicación de manifiesto de carga.', 25000),
  ('comp-overbooking-guard', 'srv-appointments', 'mod-calendar-slots', 'Candado anti-cruce de profesional y consultorio/sala', 'Bloquea colisiones simultáneas de especialista o recurso físico al reservar o reprogramar citas.', 19000),
  ('comp-whatsapp-ai-reschedule', 'srv-appointments', 'mod-interactive-reminders', 'Auto-reprogramación conversacional por WhatsApp IA', 'Libera el cupo automáticamente al cancelar y ofrece 3 nuevos horarios disponibles al cliente.', 25000),
  ('comp-qr-ticket', 'srv-hotel', 'mod-tickets', 'Validador QR de ticket en portería', 'Genera y valida token QR único para control de acceso en eventos, bares y cupos.', 19000),
  ('comp-anti-clone-qr-gate', 'srv-ticketing', 'mod-event-tickets', 'Generador y validador QR criptográfico anti-clonación en torniquetes', 'Invalida el token QR en milisegundos tras la primera lectura en puerta para impedir reingresos.', 19000),
  ('comp-sla-business-days', 'srv-ticketing', 'mod-pqrsf-helpdesk', 'Calculadora SLA con festivos oficiales de Colombia (Ley Emiliani)', 'Descuenta domingos y festivos oficiales de Colombia al calcular términos legales de respuesta PQRSF.', 19000)
ON CONFLICT ("feature_key") DO UPDATE SET
  "external_name" = EXCLUDED."external_name",
  "description" = EXCLUDED."description",
  "addon_monthly_cop" = EXCLUDED."addon_monthly_cop";

-- ============================================================================
-- 4. SEMILLA DE LOS 9 GRUPOS DE CLIENTES (TIPOS DE NEGOCIO)
-- ============================================================================
INSERT INTO "public"."client_business_groups" ("group_key", "group_name", "badge_label", "description", "base_monthly_cop", "is_active")
VALUES
  ('comercio-retail', 'Comercio, Tienda & Ferretería', 'Plan Base Completo Comercial', 'Incluye Caja POS, Cotizaciones, Existencias, Bodega Base, Compras a Proveedores, Directorio de Clientes, Cartera y Reportes.', 169000, TRUE),
  ('restaurante-gastro', 'Restaurante, Gastrobar & Cafetería', 'Plan Base Completo Gastronómico', 'Incluye Salón y Mesas, Monitor KDS, Modificadores de Carta, División de Cuentas, Domicilios, Caja POS con Propina y Recetas BOM.', 199000, TRUE),
  ('bares-discotecas', 'Bares, Licores & Entretenimiento Nocturno', 'Plan Base Especializado Bares', 'Incluye Barra y Mesas, Comandas KDS, Control por Trago/Botella, Happy Hour, Taquilla/Covers QR, Torniquetes y Caja POS.', 199000, TRUE),
  ('talleres-fixmotor', 'Talleres Automotrices, CDA & Servicio Técnico (FixMotor)', 'Plan Especializado FixMotor', 'Incluye Flota/Vehículos de Clientes, Órdenes de Trabajo Kanban con Checklist, Comisiones de Técnicos, Garantías, Repuestos y POS/FE.', 229000, TRUE),
  ('servicios-citas-v2', 'Consultorios, IPS, Centros de Servicios & Citas (v2)', 'Plan Especializado Estilo v2', 'Incluye Agendas Multi-Profesional, Recordatorios WhatsApp IA, Turnador TV, Contratos con Bolsa v2, Tarifarios, Facturación Agrupada y Glosas.', 249000, TRUE),
  ('reservas-tickets-hotel', 'Hoteles, Glamping, Clubes & Taquilla de Eventos', 'Plan Base Alojamiento y Cupos', 'Incluye Reserva de Cabañas/Salones, Recepción y Folio de Huésped, Tarifas por Temporada, Ama de Llaves, Pasadías QR y Facturación.', 229000, TRUE),
  ('distribuidora-mayorista', 'Distribuidora Mayorista, Importadora & Multi-Bodega', 'Plan Base Completo Mayorista', 'Incluye Facturación DIAN, Tarifarios, Bodegas WMS, Traslados, Toma Física Ciega, Compras, RADIAN, Documento Soporte, Cartera CxC/CxP y PUC.', 259000, TRUE),
  ('agro-logistica-bascula', 'Agroindustria, Transporte de Carga RNDC & Báscula Camionera', 'Plan Base Completo Logístico y Pesaje', 'Incluye Báscula Camionera RS-232 (Bruto/Tara/Neto), Manifiestos RNDC, Anticipos y Liquidación de Viajes, Llantas, Bodegas, Lotes y DIAN.', 289000, TRUE),
  ('erp-corporativo-integral', 'ERP Corporativo Multi-Sede (NIIF + Nómina DIAN + BI)', 'Suite Empresarial Todo-en-Uno', 'Habilita Contabilidad NIIF, Exógena DIAN, Nómina Electrónica CUNE + PILA, Tesorería, Compras RADIAN, Inventario WMS, Facturación y BI.', 389000, TRUE)
ON CONFLICT ("group_key") DO UPDATE SET
  "group_name" = EXCLUDED."group_name",
  "badge_label" = EXCLUDED."badge_label",
  "base_monthly_cop" = EXCLUDED."base_monthly_cop",
  "description" = EXCLUDED."description";

-- ============================================================================
-- 5. ESQUEMAS DE SUBMÓDULOS (catalog_submodule_schemas)
-- ============================================================================
INSERT INTO "public"."catalog_submodule_schemas" ("submodule_key", "target_sql_schema", "target_sql_table", "table_headers_json")
VALUES
  ('mod-pos', 'srv_invoicing', 'pos_sale_tickets', '["Comprobante","Cliente","Cajero / Turno","Medio de Pago","Total","Estado"]'::jsonb),
  ('mod-dian', 'srv_invoicing', 'dian_electronic_invoices', '["Prefijo / Número","Adquirente","NIT","Total Gravado","CUFE / Estado DIAN","Fecha"]'::jsonb),
  ('mod-tariffs', 'srv_invoicing', 'inv_price_lists_tariffs', '["Código Tarifa","Nombre Tarifario / Convenio","Regla de Cálculo","Vigencia","Precio Base / Factor"]'::jsonb),
  ('mod-grouped-billing', 'srv_invoicing', 'inv_grouped_billing_orders', '["Lote Consolidado","Empresa / Contrato","Órdenes Incluidas","Corte Período","Total Facturado (COP)"]'::jsonb),
  ('mod-glosas-disputes', 'srv_invoicing', 'inv_billing_disputes_glosas', '["Radicado / Glosa","Factura Afectada","Causal de Objeción","Valor Objetado","Estado Conciliación"]'::jsonb),
  ('mod-quotes', 'srv_invoicing', 'quo_quotes', '["Documento","Cliente","Vigencia","Encargado Autorizador","Valor Total","Estado"]'::jsonb),
  ('mod-stock', 'srv_inventory', 'stk_items', '["Código SKU","Producto / Insumo","Bodega Base","Disponible","Stock Mínimo","Costo Unitario"]'::jsonb),
  ('mod-warehouses', 'srv_inventory', 'stk_warehouses', '["Código","Nombre de Bodega","Ciudad / Sede","Capacidad","Encargado / Firma","Estado"]'::jsonb),
  ('mod-transfers', 'srv_inventory', 'trf_transfers', '["Solicitud","Bodega Origen","Bodega Destino","Ítem y Cantidad","Transportista","Firma Encargado"]'::jsonb),
  ('mod-tech-reception', 'srv_inventory', 'stk_technical_reception_actas', '["N° Acta","Proveedor / Factura","Lote y Temp (°C)","Estado Empaque","Concepto Técnico"]'::jsonb),
  ('mod-physical-count', 'srv_inventory', 'stk_physical_count_sessions', '["Sesión Conteo","Bodega Auditada","Ítems Contados","Diferencia Neta ($ COP)","Estado Ajuste"]'::jsonb),
  ('mod-recipes', 'srv_inventory', 'rcp_recipes', '["Código","Producto Terminado","Insumos de la Receta","Rendimiento","Costo Total"]'::jsonb),
  ('mod-lots', 'srv_inventory', 'lot_batches', '["N° Lote","Producto","Bodega","Vencimiento","Cantidad","Estado FEFO"]'::jsonb),
  ('mod-scale', 'srv_inventory', 'stk_weighbridge_tickets', '["Tiquete","Placa / Remolque","Transportista / Conductor","Peso Bruto","Peso Tara","Peso Neto"]'::jsonb),
  ('mod-purchase-orders', 'srv_procurement', 'prc_purchase_orders', '["N° Orden","Proveedor NIT","Bodega Destino","Estado Recepción","Total Orden ($ COP)"]'::jsonb),
  ('mod-purchase-invoices', 'srv_procurement', 'prc_purchase_invoices', '["Factura Proveedor","Proveedor","Orden Cruzada","IVA / Retenciones","Neto por Pagar ($ COP)"]'::jsonb),
  ('mod-support-doc-dse', 'srv_procurement', 'prc_support_documents_dian', '["N° DSE","Proveedor Cuenta de Cobro","Concepto","CUDS / Estado DIAN","Valor ($ COP)"]'::jsonb),
  ('mod-radian-events', 'srv_procurement', 'prc_radian_events', '["Factura / CUFE","Proveedor Emisor","Evento RADIAN","Estado DIAN","Valor Factura ($ COP)"]'::jsonb),
  ('mod-landed-costs', 'srv_procurement', 'prc_landed_cost_allocations', '["Liquidación","Entrada de Almacén","Concepto Flete/Aduana","Método Prorrateo","Costo Distribuido ($ COP)"]'::jsonb),
  ('mod-receivables-cxc', 'srv_treasury', 'trs_cash_receipt_vouchers', '["Recibo / Factura","Cliente Deudor","Edad de Cartera","Medio de Recaudo","Valor Abonado ($ COP)"]'::jsonb),
  ('mod-payables-cxp', 'srv_treasury', 'trs_disbursement_vouchers', '["Comprobante Egreso","Proveedor Beneficiario","Factura Causada","Banco Origen","Valor Pagado ($ COP)"]'::jsonb),
  ('mod-banks-reconciliation', 'srv_treasury', 'trs_bank_reconciliations', '["Cuenta Bancaria","Entidad / Tipo","Saldo en Libros","Saldo Extracto","Diferencia Por Conciliar"]'::jsonb),
  ('mod-petty-cash', 'srv_treasury', 'trs_petty_cash_expenses', '["Fondo / Vale","Concepto Gasto Menor","Responsable","Fondo Asignado","Gasto Legalizado ($ COP)"]'::jsonb),
  ('mod-directory', 'srv_crm', 'dir_contacts', '["NIT / Documento","Razón Social / Nombre","Tipo de Tercero","Ciudad / Teléfono","Cupo Aprobado (COP)"]'::jsonb),
  ('mod-contracts', 'srv_crm', 'dir_commercial_contracts', '["N° Contrato","Empresa / Convenio","Vigencia","Techo Presupuestal","Saldo Disponible (COP)"]'::jsonb),
  ('mod-customer-360', 'srv_crm', 'dir_customer_360_metrics', '["Cliente","Segmento RFM","Total Histórico LTV","Ticket Promedio","Días Sin Compra"]'::jsonb),
  ('mod-pipelines', 'srv_crm', 'pip_opportunities', '["Negocio","Cliente Prospecto","Etapa del Embudo","Ejecutivo","Valor Estimado"]'::jsonb),
  ('mod-loyalty', 'srv_crm', 'loy_wallets', '["Cliente","Categoría","Puntos Acumulados","Última Compra","Beneficio Activo"]'::jsonb),
  ('mod-puc', 'srv_finance', 'puc_journal_headers', '["Asiento","Cuenta PUC","Tercero NIT","Detalle","Débito / Crédito","Estado"]'::jsonb),
  ('mod-cashbook', 'srv_finance', 'csh_entries', '["Comprobante","Cuenta / Caja","Tipo","Concepto","Firma Encargado","Monto"]'::jsonb),
  ('mod-arap', 'srv_finance', 'arp_ledgers', '["Documento","Tercero","Tipo de Cartera","Vencimiento","Saldo Pendiente","Estado"]'::jsonb),
  ('mod-cost-centers', 'srv_finance', 'puc_cost_centers', '["Código CC","Centro de Costo / Proyecto","Sede","Presupuesto Mensual","Ejecutado ($ COP)"]'::jsonb),
  ('mod-fixed-assets', 'srv_finance', 'puc_fixed_assets', '["Placa Activo","Descripción del Bien","Vida Útil (Meses)","Costo Histórico","Valor Neto Libros (COP)"]'::jsonb),
  ('mod-exogena-taxes', 'srv_finance', 'puc_exogena_Magnetic_media', '["Formato DIAN","Concepto Fiscal","Terceros Reportados","Año Gravable","Total Reportado (COP)"]'::jsonb),
  ('mod-employees-contracts', 'srv_hr_payroll', 'hrp_employment_contracts', '["Documento","Empleado y Cargo","Tipo Contrato","EPS / Pensión / ARL","Salario Base ($ COP)"]'::jsonb),
  ('mod-payroll-settlement', 'srv_hr_payroll', 'hrp_payroll_payslips', '["Período","Colaborador","Total Devengado","Deducciones Salud/Pensión","Neto a Pagar ($ COP)"]'::jsonb),
  ('mod-social-benefits-pila', 'srv_hr_payroll', 'hrp_pila_contributions', '["Planilla / Liquidación","Concepto","Empleados","Exoneración Ley 1607","Valor Liquidado ($ COP)"]'::jsonb),
  ('mod-electronic-payroll-dian', 'srv_hr_payroll', 'hrp_electronic_payroll_dian', '["Consecutivo NI","Empleado Reportado","CUNE DIAN","Estado DIAN","Neto Reportado ($ COP)"]'::jsonb),
  ('mod-financial-reports', 'srv_reports', 'rep_financial_snapshots', '["Reporte Financiero","Período Fiscal","Centro de Costo / Sede","Variación %","Saldo / Resultado ($ COP)"]'::jsonb),
  ('mod-sales-profitability-reports', 'srv_reports', 'rep_saved_definitions', '["Corte / Análisis","Vendedor / Sede","Facturación Bruta","Margen de Utilidad %","Utilidad Neta ($ COP)"]'::jsonb),
  ('mod-inventory-reports', 'srv_reports', 'rep_export_jobs', '["Bodega / Categoría","Referencias Activas","Rotación Promedio","Alertas Vencimiento","Valorización Total ($ COP)"]'::jsonb),
  ('mod-tax-dian-reports', 'srv_reports', 'rep_kpi_targets', '["Impuesto / Formato","Período Bimestral/Anual","Impuesto Generado","Descontable / Retenido","Saldo a Pagar DIAN ($ COP)"]'::jsonb),
  ('mod-custom-report-builder', 'srv_reports', 'rep_saved_definitions', '["Nombre del Reporte","Módulo Origen","Formato Salida","Programación","Última Ejecución"]'::jsonb),
  ('mod-tables', 'srv_gastro', 'tbl_dining_tables', '["Mesa / Zona","Comensales","Mesero Asignado","Consumo Acumulado","Estado"]'::jsonb),
  ('mod-kds', 'srv_gastro', 'kds_orders', '["Comanda","Mesa / Barra","Pedido y Notas","Estación","Tiempo / Estado"]'::jsonb),
  ('mod-modifiers-menu', 'srv_gastro', 'tbl_menu_modifier_groups', '["Grupo Modificador","Plato / Categoría","Opciones Disponibles","Recargo Adición (COP)","Estado"]'::jsonb),
  ('mod-split', 'srv_gastro', 'spl_checks', '["Referencia","Mesa","Modalidad","Pagadores","Total por Pagador"]'::jsonb),
  ('mod-deliveries', 'srv_gastro', 'tbl_delivery_dispatches', '["Pedido #","Cliente y Dirección","Canal","Domiciliario","Total + Envío (COP)"]'::jsonb),
  ('mod-vehicles-assets', 'srv_workshop', 'wks_customer_vehicles', '["Placa / Serial","Marca, Línea y Modelo","Propietario","Último Km","SOAT / Tecnomecánica"]'::jsonb),
  ('mod-work-orders-kanban', 'srv_workshop', 'wks_work_orders', '["N° Orden (OT)","Placa / Equipo","Estado Kanban","Técnico Asignado","Total OT ($ COP)"]'::jsonb),
  ('mod-worker-commissions', 'srv_workshop', 'wks_technician_commissions', '["Liquidación","Técnico / Mecánico","Órdenes Cerradas","Base Mano de Obra","Comisión a Pagar ($ COP)"]'::jsonb),
  ('mod-warranties', 'srv_workshop', 'wks_warranty_claims', '["Certificado","OT / Placa","Cobertura","Vigencia (Días / Km)","Estado Garantía"]'::jsonb),
  ('mod-fleet-scale', 'srv_fleet', 'flt_weighbridge_tickets', '["Tiquete","Placa / Remolque","Transportista / Conductor","Peso Bruto","Peso Tara","Peso Neto"]'::jsonb),
  ('mod-fleet-dispatch-rndc', 'srv_fleet', 'flt_rndc_manifests', '["Manifiesto RNDC","Ruta Origen → Destino","Tractomula / Remolque","Conductor","Flete Pactado ($ COP)"]'::jsonb),
  ('mod-trip-settlements', 'srv_fleet', 'flt_trip_expenses_advances', '["Liquidación","Manifiesto","Anticipos Giro","Peajes + ACPM + Viáticos","Saldo a Pagar ($ COP)"]'::jsonb),
  ('mod-tires-fleet-maint', 'srv_fleet', 'flt_tire_tracking', '["Serial Llanta","Placa / Posición Eje","Labrado (mm)","Km Acumulados","Estado / SOAT"]'::jsonb),
  ('mod-calendar-slots', 'srv_appointments', 'apt_appointments', '["Código Cita","Cliente / Usuario","Profesional / Recurso","Fecha y Hora","Servicio Programado"]'::jsonb),
  ('mod-staff-schedules', 'srv_appointments', 'apt_schedule_templates', '["Especialista","Sede / Consultorio","Franja Horaria","Duración Bloque (min)","Estado Malla"]'::jsonb),
  ('mod-interactive-reminders', 'srv_appointments', 'apt_Automated_reminders', '["Envío #","Destinatario","Canal","Respuesta Cliente","Estado Cupo"]'::jsonb),
  ('mod-queue-turnador', 'srv_appointments', 'apt_waitlist_queue', '["Turno Sala","Cliente en Espera","Módulo / Consultorio","Espera (Min)","Estado Llamado"]'::jsonb),
  ('mod-bookings', 'srv_hotel', 'bkg_reservations', '["Código Reserva","Titular","Espacio / Habitación","Fecha y Franja","Cupos / Huéspedes","Estado"]'::jsonb),
  ('mod-rooms', 'srv_hotel', 'rms_rooms', '["Habitación / Unidad","Huésped Titular","Ingreso / Salida","Tarifa Noche","Estado"]'::jsonb),
  ('mod-seasonal-rates', 'srv_hotel', 'bkg_rate_plans_seasons', '["Plan / Temporada","Tipo Habitación","Vigencia","Incluye Alimentación","Tarifa Noche ($ COP)"]'::jsonb),
  ('mod-housekeeping', 'srv_hotel', 'rms_housekeeping_tasks', '["Habitación","Camarera Asignada","Estado Limpieza","Novedad Minibar / Lencería","Hora Liberación"]'::jsonb),
  ('mod-tickets', 'srv_hotel', 'fdk_checkins', '["N° Ticket","Categoría","Visitante / Comprador","Código QR","Tarifa","Estado Portería"]'::jsonb),
  ('mod-event-tickets', 'srv_ticketing', 'tck_tickets_issued', '["N° Ticket","Categoría / Palco","Visitante / Comprador","Código QR","Tarifa ($ COP)"]'::jsonb),
  ('mod-gate-scanner', 'srv_ticketing', 'tck_events_venues', '["Portería / Acceso","Evento Activo","Ingresos Validados","Aforo Máximo","Estado Puerta"]'::jsonb),
  ('mod-pqrsf-helpdesk', 'srv_ticketing', 'tck_pqrsf_cases', '["Radicado PQRSF","Tipo (P/Q/R/S/F)","Solicitante","Días Hábiles SLA","Estado Trámite"]'::jsonb)
ON CONFLICT ("submodule_key") DO UPDATE SET
  "target_sql_schema" = EXCLUDED."target_sql_schema",
  "target_sql_table" = EXCLUDED."target_sql_table",
  "table_headers_json" = EXCLUDED."table_headers_json";

-- ============================================================================
-- 6. MATRIZ DE ASIGNACIÓN POR GRUPO DE CLIENTES (business_group_bundle_items)
-- ============================================================================
INSERT INTO "public"."business_group_bundle_items" ("bundle_id", "group_key", "item_tier", "item_key", "included_in_base_plan")
VALUES
  -- 1. comercio-retail
  ('comercio-retail:MODULO_PRINCIPAL:srv-invoicing', 'comercio-retail', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('comercio-retail:MODULO_PRINCIPAL:srv-inventory', 'comercio-retail', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('comercio-retail:MODULO_PRINCIPAL:srv-procurement', 'comercio-retail', 'MODULO_PRINCIPAL', 'srv-procurement', TRUE),
  ('comercio-retail:MODULO_PRINCIPAL:srv-crm', 'comercio-retail', 'MODULO_PRINCIPAL', 'srv-crm', TRUE),
  ('comercio-retail:MODULO_PRINCIPAL:srv-treasury', 'comercio-retail', 'MODULO_PRINCIPAL', 'srv-treasury', TRUE),
  ('comercio-retail:MODULO_PRINCIPAL:srv-reports', 'comercio-retail', 'MODULO_PRINCIPAL', 'srv-reports', TRUE),
  ('comercio-retail:SUBMODULO:mod-pos', 'comercio-retail', 'SUBMODULO', 'mod-pos', TRUE),
  ('comercio-retail:SUBMODULO:mod-quotes', 'comercio-retail', 'SUBMODULO', 'mod-quotes', TRUE),
  ('comercio-retail:SUBMODULO:mod-stock', 'comercio-retail', 'SUBMODULO', 'mod-stock', TRUE),
  ('comercio-retail:SUBMODULO:mod-warehouses', 'comercio-retail', 'SUBMODULO', 'mod-warehouses', TRUE),
  ('comercio-retail:SUBMODULO:mod-purchase-orders', 'comercio-retail', 'SUBMODULO', 'mod-purchase-orders', TRUE),
  ('comercio-retail:SUBMODULO:mod-directory', 'comercio-retail', 'SUBMODULO', 'mod-directory', TRUE),
  ('comercio-retail:SUBMODULO:mod-receivables-cxc', 'comercio-retail', 'SUBMODULO', 'mod-receivables-cxc', TRUE),
  ('comercio-retail:SUBMODULO:mod-sales-profitability-reports', 'comercio-retail', 'SUBMODULO', 'mod-sales-profitability-reports', TRUE),
  ('comercio-retail:FUNCIONALIDAD:comp-cashier-name', 'comercio-retail', 'FUNCIONALIDAD', 'comp-cashier-name', TRUE),
  ('comercio-retail:FUNCIONALIDAD:comp-line-discount', 'comercio-retail', 'FUNCIONALIDAD', 'comp-line-discount', TRUE),
  ('comercio-retail:FUNCIONALIDAD:comp-manager-signature', 'comercio-retail', 'FUNCIONALIDAD', 'comp-manager-signature', TRUE),
  ('comercio-retail:FUNCIONALIDAD:comp-nit-dv-auto', 'comercio-retail', 'FUNCIONALIDAD', 'comp-nit-dv-auto', TRUE),

  -- 2. restaurante-gastro
  ('restaurante-gastro:MODULO_PRINCIPAL:srv-gastro', 'restaurante-gastro', 'MODULO_PRINCIPAL', 'srv-gastro', TRUE),
  ('restaurante-gastro:MODULO_PRINCIPAL:srv-invoicing', 'restaurante-gastro', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('restaurante-gastro:MODULO_PRINCIPAL:srv-inventory', 'restaurante-gastro', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('restaurante-gastro:MODULO_PRINCIPAL:srv-procurement', 'restaurante-gastro', 'MODULO_PRINCIPAL', 'srv-procurement', TRUE),
  ('restaurante-gastro:MODULO_PRINCIPAL:srv-treasury', 'restaurante-gastro', 'MODULO_PRINCIPAL', 'srv-treasury', TRUE),
  ('restaurante-gastro:MODULO_PRINCIPAL:srv-reports', 'restaurante-gastro', 'MODULO_PRINCIPAL', 'srv-reports', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-tables', 'restaurante-gastro', 'SUBMODULO', 'mod-tables', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-kds', 'restaurante-gastro', 'SUBMODULO', 'mod-kds', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-modifiers-menu', 'restaurante-gastro', 'SUBMODULO', 'mod-modifiers-menu', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-split', 'restaurante-gastro', 'SUBMODULO', 'mod-split', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-deliveries', 'restaurante-gastro', 'SUBMODULO', 'mod-deliveries', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-pos', 'restaurante-gastro', 'SUBMODULO', 'mod-pos', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-stock', 'restaurante-gastro', 'SUBMODULO', 'mod-stock', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-recipes', 'restaurante-gastro', 'SUBMODULO', 'mod-recipes', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-petty-cash', 'restaurante-gastro', 'SUBMODULO', 'mod-petty-cash', TRUE),
  ('restaurante-gastro:SUBMODULO:mod-sales-profitability-reports', 'restaurante-gastro', 'SUBMODULO', 'mod-sales-profitability-reports', TRUE),
  ('restaurante-gastro:FUNCIONALIDAD:comp-cashier-name', 'restaurante-gastro', 'FUNCIONALIDAD', 'comp-cashier-name', TRUE),
  ('restaurante-gastro:FUNCIONALIDAD:comp-tip', 'restaurante-gastro', 'FUNCIONALIDAD', 'comp-tip', TRUE),
  ('restaurante-gastro:FUNCIONALIDAD:comp-waiter-assign', 'restaurante-gastro', 'FUNCIONALIDAD', 'comp-waiter-assign', TRUE),
  ('restaurante-gastro:FUNCIONALIDAD:comp-courtesy-auth', 'restaurante-gastro', 'FUNCIONALIDAD', 'comp-courtesy-auth', TRUE),

  -- 3. bares-discotecas
  ('bares-discotecas:MODULO_PRINCIPAL:srv-gastro', 'bares-discotecas', 'MODULO_PRINCIPAL', 'srv-gastro', TRUE),
  ('bares-discotecas:MODULO_PRINCIPAL:srv-ticketing', 'bares-discotecas', 'MODULO_PRINCIPAL', 'srv-ticketing', TRUE),
  ('bares-discotecas:MODULO_PRINCIPAL:srv-invoicing', 'bares-discotecas', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('bares-discotecas:MODULO_PRINCIPAL:srv-inventory', 'bares-discotecas', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('bares-discotecas:MODULO_PRINCIPAL:srv-treasury', 'bares-discotecas', 'MODULO_PRINCIPAL', 'srv-treasury', TRUE),
  ('bares-discotecas:MODULO_PRINCIPAL:srv-reports', 'bares-discotecas', 'MODULO_PRINCIPAL', 'srv-reports', TRUE),
  ('bares-discotecas:SUBMODULO:mod-tables', 'bares-discotecas', 'SUBMODULO', 'mod-tables', TRUE),
  ('bares-discotecas:SUBMODULO:mod-kds', 'bares-discotecas', 'SUBMODULO', 'mod-kds', TRUE),
  ('bares-discotecas:SUBMODULO:mod-split', 'bares-discotecas', 'SUBMODULO', 'mod-split', TRUE),
  ('bares-discotecas:SUBMODULO:mod-event-tickets', 'bares-discotecas', 'SUBMODULO', 'mod-event-tickets', TRUE),
  ('bares-discotecas:SUBMODULO:mod-gate-scanner', 'bares-discotecas', 'SUBMODULO', 'mod-gate-scanner', TRUE),
  ('bares-discotecas:SUBMODULO:mod-pos', 'bares-discotecas', 'SUBMODULO', 'mod-pos', TRUE),
  ('bares-discotecas:SUBMODULO:mod-stock', 'bares-discotecas', 'SUBMODULO', 'mod-stock', TRUE),
  ('bares-discotecas:SUBMODULO:mod-recipes', 'bares-discotecas', 'SUBMODULO', 'mod-recipes', TRUE),
  ('bares-discotecas:SUBMODULO:mod-petty-cash', 'bares-discotecas', 'SUBMODULO', 'mod-petty-cash', TRUE),
  ('bares-discotecas:FUNCIONALIDAD:comp-bar-shot-measure', 'bares-discotecas', 'FUNCIONALIDAD', 'comp-bar-shot-measure', TRUE),
  ('bares-discotecas:FUNCIONALIDAD:comp-happy-hour-pricing', 'bares-discotecas', 'FUNCIONALIDAD', 'comp-happy-hour-pricing', TRUE),
  ('bares-discotecas:FUNCIONALIDAD:comp-waiter-assign', 'bares-discotecas', 'FUNCIONALIDAD', 'comp-waiter-assign', TRUE),
  ('bares-discotecas:FUNCIONALIDAD:comp-tip', 'bares-discotecas', 'FUNCIONALIDAD', 'comp-tip', TRUE),
  ('bares-discotecas:FUNCIONALIDAD:comp-cashier-name', 'bares-discotecas', 'FUNCIONALIDAD', 'comp-cashier-name', TRUE),
  ('bares-discotecas:FUNCIONALIDAD:comp-anti-clone-qr-gate', 'bares-discotecas', 'FUNCIONALIDAD', 'comp-anti-clone-qr-gate', TRUE),

  -- 4. talleres-fixmotor
  ('talleres-fixmotor:MODULO_PRINCIPAL:srv-workshop', 'talleres-fixmotor', 'MODULO_PRINCIPAL', 'srv-workshop', TRUE),
  ('talleres-fixmotor:MODULO_PRINCIPAL:srv-inventory', 'talleres-fixmotor', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('talleres-fixmotor:MODULO_PRINCIPAL:srv-procurement', 'talleres-fixmotor', 'MODULO_PRINCIPAL', 'srv-procurement', TRUE),
  ('talleres-fixmotor:MODULO_PRINCIPAL:srv-invoicing', 'talleres-fixmotor', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('talleres-fixmotor:MODULO_PRINCIPAL:srv-crm', 'talleres-fixmotor', 'MODULO_PRINCIPAL', 'srv-crm', TRUE),
  ('talleres-fixmotor:MODULO_PRINCIPAL:srv-treasury', 'talleres-fixmotor', 'MODULO_PRINCIPAL', 'srv-treasury', TRUE),
  ('talleres-fixmotor:MODULO_PRINCIPAL:srv-reports', 'talleres-fixmotor', 'MODULO_PRINCIPAL', 'srv-reports', TRUE),
  ('talleres-fixmotor:SUBMODULO:mod-vehicles-assets', 'talleres-fixmotor', 'SUBMODULO', 'mod-vehicles-assets', TRUE),
  ('talleres-fixmotor:SUBMODULO:mod-work-orders-kanban', 'talleres-fixmotor', 'SUBMODULO', 'mod-work-orders-kanban', TRUE),
  ('talleres-fixmotor:SUBMODULO:mod-worker-commissions', 'talleres-fixmotor', 'SUBMODULO', 'mod-worker-commissions', TRUE),
  ('talleres-fixmotor:SUBMODULO:mod-warranties', 'talleres-fixmotor', 'SUBMODULO', 'mod-warranties', TRUE),
  ('talleres-fixmotor:SUBMODULO:mod-stock', 'talleres-fixmotor', 'SUBMODULO', 'mod-stock', TRUE),
  ('talleres-fixmotor:SUBMODULO:mod-warehouses', 'talleres-fixmotor', 'SUBMODULO', 'mod-warehouses', TRUE),
  ('talleres-fixmotor:SUBMODULO:mod-purchase-orders', 'talleres-fixmotor', 'SUBMODULO', 'mod-purchase-orders', TRUE),
  ('talleres-fixmotor:SUBMODULO:mod-pos', 'talleres-fixmotor', 'SUBMODULO', 'mod-pos', TRUE),
  ('talleres-fixmotor:SUBMODULO:mod-dian', 'talleres-fixmotor', 'SUBMODULO', 'mod-dian', TRUE),
  ('talleres-fixmotor:SUBMODULO:mod-directory', 'talleres-fixmotor', 'SUBMODULO', 'mod-directory', TRUE),
  ('talleres-fixmotor:SUBMODULO:mod-customer-360', 'talleres-fixmotor', 'SUBMODULO', 'mod-customer-360', TRUE),
  ('talleres-fixmotor:FUNCIONALIDAD:comp-intake-checklist-sign', 'talleres-fixmotor', 'FUNCIONALIDAD', 'comp-intake-checklist-sign', TRUE),
  ('talleres-fixmotor:FUNCIONALIDAD:comp-warranty-vin-alert', 'talleres-fixmotor', 'FUNCIONALIDAD', 'comp-warranty-vin-alert', TRUE),
  ('talleres-fixmotor:FUNCIONALIDAD:comp-nit-dv-auto', 'talleres-fixmotor', 'FUNCIONALIDAD', 'comp-nit-dv-auto', TRUE),
  ('talleres-fixmotor:FUNCIONALIDAD:comp-cashier-name', 'talleres-fixmotor', 'FUNCIONALIDAD', 'comp-cashier-name', TRUE),

  -- 5. servicios-citas-v2
  ('servicios-citas-v2:MODULO_PRINCIPAL:srv-appointments', 'servicios-citas-v2', 'MODULO_PRINCIPAL', 'srv-appointments', TRUE),
  ('servicios-citas-v2:MODULO_PRINCIPAL:srv-crm', 'servicios-citas-v2', 'MODULO_PRINCIPAL', 'srv-crm', TRUE),
  ('servicios-citas-v2:MODULO_PRINCIPAL:srv-invoicing', 'servicios-citas-v2', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('servicios-citas-v2:MODULO_PRINCIPAL:srv-inventory', 'servicios-citas-v2', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('servicios-citas-v2:MODULO_PRINCIPAL:srv-treasury', 'servicios-citas-v2', 'MODULO_PRINCIPAL', 'srv-treasury', TRUE),
  ('servicios-citas-v2:MODULO_PRINCIPAL:srv-reports', 'servicios-citas-v2', 'MODULO_PRINCIPAL', 'srv-reports', TRUE),
  ('servicios-citas-v2:SUBMODULO:mod-calendar-slots', 'servicios-citas-v2', 'SUBMODULO', 'mod-calendar-slots', TRUE),
  ('servicios-citas-v2:SUBMODULO:mod-staff-schedules', 'servicios-citas-v2', 'SUBMODULO', 'mod-staff-schedules', TRUE),
  ('servicios-citas-v2:SUBMODULO:mod-interactive-reminders', 'servicios-citas-v2', 'SUBMODULO', 'mod-interactive-reminders', TRUE),
  ('servicios-citas-v2:SUBMODULO:mod-queue-turnador', 'servicios-citas-v2', 'SUBMODULO', 'mod-queue-turnador', TRUE),
  ('servicios-citas-v2:SUBMODULO:mod-directory', 'servicios-citas-v2', 'SUBMODULO', 'mod-directory', TRUE),
  ('servicios-citas-v2:SUBMODULO:mod-contracts', 'servicios-citas-v2', 'SUBMODULO', 'mod-contracts', TRUE),
  ('servicios-citas-v2:SUBMODULO:mod-tariffs', 'servicios-citas-v2', 'SUBMODULO', 'mod-tariffs', TRUE),
  ('servicios-citas-v2:SUBMODULO:mod-grouped-billing', 'servicios-citas-v2', 'SUBMODULO', 'mod-grouped-billing', TRUE),
  ('servicios-citas-v2:SUBMODULO:mod-glosas-disputes', 'servicios-citas-v2', 'SUBMODULO', 'mod-glosas-disputes', TRUE),
  ('servicios-citas-v2:SUBMODULO:mod-dian', 'servicios-citas-v2', 'SUBMODULO', 'mod-dian', TRUE),
  ('servicios-citas-v2:SUBMODULO:mod-tech-reception', 'servicios-citas-v2', 'SUBMODULO', 'mod-tech-reception', TRUE),
  ('servicios-citas-v2:SUBMODULO:mod-lots', 'servicios-citas-v2', 'SUBMODULO', 'mod-lots', TRUE),
  ('servicios-citas-v2:FUNCIONALIDAD:comp-overbooking-guard', 'servicios-citas-v2', 'FUNCIONALIDAD', 'comp-overbooking-guard', TRUE),
  ('servicios-citas-v2:FUNCIONALIDAD:comp-whatsapp-ai-reschedule', 'servicios-citas-v2', 'FUNCIONALIDAD', 'comp-whatsapp-ai-reschedule', TRUE),
  ('servicios-citas-v2:FUNCIONALIDAD:comp-contract-budget-alert', 'servicios-citas-v2', 'FUNCIONALIDAD', 'comp-contract-budget-alert', TRUE),
  ('servicios-citas-v2:FUNCIONALIDAD:comp-expiry-semaphore', 'servicios-citas-v2', 'FUNCIONALIDAD', 'comp-expiry-semaphore', TRUE),

  -- 6. reservas-tickets-hotel
  ('reservas-tickets-hotel:MODULO_PRINCIPAL:srv-hotel', 'reservas-tickets-hotel', 'MODULO_PRINCIPAL', 'srv-hotel', TRUE),
  ('reservas-tickets-hotel:MODULO_PRINCIPAL:srv-ticketing', 'reservas-tickets-hotel', 'MODULO_PRINCIPAL', 'srv-ticketing', TRUE),
  ('reservas-tickets-hotel:MODULO_PRINCIPAL:srv-gastro', 'reservas-tickets-hotel', 'MODULO_PRINCIPAL', 'srv-gastro', TRUE),
  ('reservas-tickets-hotel:MODULO_PRINCIPAL:srv-invoicing', 'reservas-tickets-hotel', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('reservas-tickets-hotel:MODULO_PRINCIPAL:srv-crm', 'reservas-tickets-hotel', 'MODULO_PRINCIPAL', 'srv-crm', TRUE),
  ('reservas-tickets-hotel:MODULO_PRINCIPAL:srv-treasury', 'reservas-tickets-hotel', 'MODULO_PRINCIPAL', 'srv-treasury', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-bookings', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-bookings', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-rooms', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-rooms', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-seasonal-rates', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-seasonal-rates', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-housekeeping', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-housekeeping', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-tickets', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-tickets', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-tables', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-tables', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-pos', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-pos', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-dian', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-dian', TRUE),
  ('reservas-tickets-hotel:SUBMODULO:mod-directory', 'reservas-tickets-hotel', 'SUBMODULO', 'mod-directory', TRUE),
  ('reservas-tickets-hotel:FUNCIONALIDAD:comp-qr-ticket', 'reservas-tickets-hotel', 'FUNCIONALIDAD', 'comp-qr-ticket', TRUE),
  ('reservas-tickets-hotel:FUNCIONALIDAD:comp-cashier-name', 'reservas-tickets-hotel', 'FUNCIONALIDAD', 'comp-cashier-name', TRUE),

  -- 7. distribuidora-mayorista
  ('distribuidora-mayorista:MODULO_PRINCIPAL:srv-invoicing', 'distribuidora-mayorista', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('distribuidora-mayorista:MODULO_PRINCIPAL:srv-inventory', 'distribuidora-mayorista', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('distribuidora-mayorista:MODULO_PRINCIPAL:srv-procurement', 'distribuidora-mayorista', 'MODULO_PRINCIPAL', 'srv-procurement', TRUE),
  ('distribuidora-mayorista:MODULO_PRINCIPAL:srv-treasury', 'distribuidora-mayorista', 'MODULO_PRINCIPAL', 'srv-treasury', TRUE),
  ('distribuidora-mayorista:MODULO_PRINCIPAL:srv-crm', 'distribuidora-mayorista', 'MODULO_PRINCIPAL', 'srv-crm', TRUE),
  ('distribuidora-mayorista:MODULO_PRINCIPAL:srv-finance', 'distribuidora-mayorista', 'MODULO_PRINCIPAL', 'srv-finance', TRUE),
  ('distribuidora-mayorista:MODULO_PRINCIPAL:srv-reports', 'distribuidora-mayorista', 'MODULO_PRINCIPAL', 'srv-reports', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-pos', 'distribuidora-mayorista', 'SUBMODULO', 'mod-pos', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-dian', 'distribuidora-mayorista', 'SUBMODULO', 'mod-dian', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-tariffs', 'distribuidora-mayorista', 'SUBMODULO', 'mod-tariffs', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-quotes', 'distribuidora-mayorista', 'SUBMODULO', 'mod-quotes', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-stock', 'distribuidora-mayorista', 'SUBMODULO', 'mod-stock', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-warehouses', 'distribuidora-mayorista', 'SUBMODULO', 'mod-warehouses', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-transfers', 'distribuidora-mayorista', 'SUBMODULO', 'mod-transfers', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-physical-count', 'distribuidora-mayorista', 'SUBMODULO', 'mod-physical-count', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-purchase-orders', 'distribuidora-mayorista', 'SUBMODULO', 'mod-purchase-orders', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-purchase-invoices', 'distribuidora-mayorista', 'SUBMODULO', 'mod-purchase-invoices', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-radian-events', 'distribuidora-mayorista', 'SUBMODULO', 'mod-radian-events', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-landed-costs', 'distribuidora-mayorista', 'SUBMODULO', 'mod-landed-costs', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-receivables-cxc', 'distribuidora-mayorista', 'SUBMODULO', 'mod-receivables-cxc', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-payables-cxp', 'distribuidora-mayorista', 'SUBMODULO', 'mod-payables-cxp', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-directory', 'distribuidora-mayorista', 'SUBMODULO', 'mod-directory', TRUE),
  ('distribuidora-mayorista:SUBMODULO:mod-puc', 'distribuidora-mayorista', 'SUBMODULO', 'mod-puc', TRUE),
  ('distribuidora-mayorista:FUNCIONALIDAD:comp-manager-signature', 'distribuidora-mayorista', 'FUNCIONALIDAD', 'comp-manager-signature', TRUE),
  ('distribuidora-mayorista:FUNCIONALIDAD:comp-carrier-select', 'distribuidora-mayorista', 'FUNCIONALIDAD', 'comp-carrier-select', TRUE),
  ('distribuidora-mayorista:FUNCIONALIDAD:comp-credit-quota-lock', 'distribuidora-mayorista', 'FUNCIONALIDAD', 'comp-credit-quota-lock', TRUE),
  ('distribuidora-mayorista:FUNCIONALIDAD:comp-margin-drop-alert', 'distribuidora-mayorista', 'FUNCIONALIDAD', 'comp-margin-drop-alert', TRUE),

  -- 8. agro-logistica-bascula
  ('agro-logistica-bascula:MODULO_PRINCIPAL:srv-fleet', 'agro-logistica-bascula', 'MODULO_PRINCIPAL', 'srv-fleet', TRUE),
  ('agro-logistica-bascula:MODULO_PRINCIPAL:srv-inventory', 'agro-logistica-bascula', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('agro-logistica-bascula:MODULO_PRINCIPAL:srv-procurement', 'agro-logistica-bascula', 'MODULO_PRINCIPAL', 'srv-procurement', TRUE),
  ('agro-logistica-bascula:MODULO_PRINCIPAL:srv-invoicing', 'agro-logistica-bascula', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('agro-logistica-bascula:MODULO_PRINCIPAL:srv-treasury', 'agro-logistica-bascula', 'MODULO_PRINCIPAL', 'srv-treasury', TRUE),
  ('agro-logistica-bascula:MODULO_PRINCIPAL:srv-crm', 'agro-logistica-bascula', 'MODULO_PRINCIPAL', 'srv-crm', TRUE),
  ('agro-logistica-bascula:MODULO_PRINCIPAL:srv-finance', 'agro-logistica-bascula', 'MODULO_PRINCIPAL', 'srv-finance', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-fleet-scale', 'agro-logistica-bascula', 'SUBMODULO', 'mod-fleet-scale', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-fleet-dispatch-rndc', 'agro-logistica-bascula', 'SUBMODULO', 'mod-fleet-dispatch-rndc', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-trip-settlements', 'agro-logistica-bascula', 'SUBMODULO', 'mod-trip-settlements', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-tires-fleet-maint', 'agro-logistica-bascula', 'SUBMODULO', 'mod-tires-fleet-maint', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-stock', 'agro-logistica-bascula', 'SUBMODULO', 'mod-stock', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-warehouses', 'agro-logistica-bascula', 'SUBMODULO', 'mod-warehouses', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-transfers', 'agro-logistica-bascula', 'SUBMODULO', 'mod-transfers', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-lots', 'agro-logistica-bascula', 'SUBMODULO', 'mod-lots', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-scale', 'agro-logistica-bascula', 'SUBMODULO', 'mod-scale', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-support-doc-dse', 'agro-logistica-bascula', 'SUBMODULO', 'mod-support-doc-dse', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-dian', 'agro-logistica-bascula', 'SUBMODULO', 'mod-dian', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-receivables-cxc', 'agro-logistica-bascula', 'SUBMODULO', 'mod-receivables-cxc', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-payables-cxp', 'agro-logistica-bascula', 'SUBMODULO', 'mod-payables-cxp', TRUE),
  ('agro-logistica-bascula:SUBMODULO:mod-directory', 'agro-logistica-bascula', 'SUBMODULO', 'mod-directory', TRUE),
  ('agro-logistica-bascula:FUNCIONALIDAD:comp-manager-signature', 'agro-logistica-bascula', 'FUNCIONALIDAD', 'comp-manager-signature', TRUE),
  ('agro-logistica-bascula:FUNCIONALIDAD:comp-carrier-select', 'agro-logistica-bascula', 'FUNCIONALIDAD', 'comp-carrier-select', TRUE),
  ('agro-logistica-bascula:FUNCIONALIDAD:comp-scale-tare', 'agro-logistica-bascula', 'FUNCIONALIDAD', 'comp-scale-tare', TRUE),
  ('agro-logistica-bascula:FUNCIONALIDAD:comp-weighbridge-humidity-discount', 'agro-logistica-bascula', 'FUNCIONALIDAD', 'comp-weighbridge-humidity-discount', TRUE),
  ('agro-logistica-bascula:FUNCIONALIDAD:comp-rndc-manifest-sync', 'agro-logistica-bascula', 'FUNCIONALIDAD', 'comp-rndc-manifest-sync', TRUE),

  -- 9. erp-corporativo-integral
  ('erp-corporativo-integral:MODULO_PRINCIPAL:srv-invoicing', 'erp-corporativo-integral', 'MODULO_PRINCIPAL', 'srv-invoicing', TRUE),
  ('erp-corporativo-integral:MODULO_PRINCIPAL:srv-inventory', 'erp-corporativo-integral', 'MODULO_PRINCIPAL', 'srv-inventory', TRUE),
  ('erp-corporativo-integral:MODULO_PRINCIPAL:srv-procurement', 'erp-corporativo-integral', 'MODULO_PRINCIPAL', 'srv-procurement', TRUE),
  ('erp-corporativo-integral:MODULO_PRINCIPAL:srv-treasury', 'erp-corporativo-integral', 'MODULO_PRINCIPAL', 'srv-treasury', TRUE),
  ('erp-corporativo-integral:MODULO_PRINCIPAL:srv-finance', 'erp-corporativo-integral', 'MODULO_PRINCIPAL', 'srv-finance', TRUE),
  ('erp-corporativo-integral:MODULO_PRINCIPAL:srv-hr-payroll', 'erp-corporativo-integral', 'MODULO_PRINCIPAL', 'srv-hr-payroll', TRUE),
  ('erp-corporativo-integral:MODULO_PRINCIPAL:srv-reports', 'erp-corporativo-integral', 'MODULO_PRINCIPAL', 'srv-reports', TRUE),
  ('erp-corporativo-integral:MODULO_PRINCIPAL:srv-crm', 'erp-corporativo-integral', 'MODULO_PRINCIPAL', 'srv-crm', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-pos', 'erp-corporativo-integral', 'SUBMODULO', 'mod-pos', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-dian', 'erp-corporativo-integral', 'SUBMODULO', 'mod-dian', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-tariffs', 'erp-corporativo-integral', 'SUBMODULO', 'mod-tariffs', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-grouped-billing', 'erp-corporativo-integral', 'SUBMODULO', 'mod-grouped-billing', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-stock', 'erp-corporativo-integral', 'SUBMODULO', 'mod-stock', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-warehouses', 'erp-corporativo-integral', 'SUBMODULO', 'mod-warehouses', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-transfers', 'erp-corporativo-integral', 'SUBMODULO', 'mod-transfers', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-physical-count', 'erp-corporativo-integral', 'SUBMODULO', 'mod-physical-count', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-purchase-orders', 'erp-corporativo-integral', 'SUBMODULO', 'mod-purchase-orders', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-purchase-invoices', 'erp-corporativo-integral', 'SUBMODULO', 'mod-purchase-invoices', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-support-doc-dse', 'erp-corporativo-integral', 'SUBMODULO', 'mod-support-doc-dse', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-radian-events', 'erp-corporativo-integral', 'SUBMODULO', 'mod-radian-events', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-receivables-cxc', 'erp-corporativo-integral', 'SUBMODULO', 'mod-receivables-cxc', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-payables-cxp', 'erp-corporativo-integral', 'SUBMODULO', 'mod-payables-cxp', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-banks-reconciliation', 'erp-corporativo-integral', 'SUBMODULO', 'mod-banks-reconciliation', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-puc', 'erp-corporativo-integral', 'SUBMODULO', 'mod-puc', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-cost-centers', 'erp-corporativo-integral', 'SUBMODULO', 'mod-cost-centers', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-fixed-assets', 'erp-corporativo-integral', 'SUBMODULO', 'mod-fixed-assets', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-exogena-taxes', 'erp-corporativo-integral', 'SUBMODULO', 'mod-exogena-taxes', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-employees-contracts', 'erp-corporativo-integral', 'SUBMODULO', 'mod-employees-contracts', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-payroll-settlement', 'erp-corporativo-integral', 'SUBMODULO', 'mod-payroll-settlement', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-social-benefits-pila', 'erp-corporativo-integral', 'SUBMODULO', 'mod-social-benefits-pila', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-electronic-payroll-dian', 'erp-corporativo-integral', 'SUBMODULO', 'mod-electronic-payroll-dian', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-financial-reports', 'erp-corporativo-integral', 'SUBMODULO', 'mod-financial-reports', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-tax-dian-reports', 'erp-corporativo-integral', 'SUBMODULO', 'mod-tax-dian-reports', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-directory', 'erp-corporativo-integral', 'SUBMODULO', 'mod-directory', TRUE),
  ('erp-corporativo-integral:SUBMODULO:mod-contracts', 'erp-corporativo-integral', 'SUBMODULO', 'mod-contracts', TRUE),
  ('erp-corporativo-integral:FUNCIONALIDAD:comp-nit-dv-auto', 'erp-corporativo-integral', 'FUNCIONALIDAD', 'comp-nit-dv-auto', TRUE),
  ('erp-corporativo-integral:FUNCIONALIDAD:comp-credit-quota-lock', 'erp-corporativo-integral', 'FUNCIONALIDAD', 'comp-credit-quota-lock', TRUE),
  ('erp-corporativo-integral:FUNCIONALIDAD:comp-withholding-calc', 'erp-corporativo-integral', 'FUNCIONALIDAD', 'comp-withholding-calc', TRUE),
  ('erp-corporativo-integral:FUNCIONALIDAD:comp-ley1607-exoneration', 'erp-corporativo-integral', 'FUNCIONALIDAD', 'comp-ley1607-exoneration', TRUE),
  ('erp-corporativo-integral:FUNCIONALIDAD:comp-cune-dian-payroll', 'erp-corporativo-integral', 'FUNCIONALIDAD', 'comp-cune-dian-payroll', TRUE),
  ('erp-corporativo-integral:FUNCIONALIDAD:comp-dian-xml-exporter', 'erp-corporativo-integral', 'FUNCIONALIDAD', 'comp-dian-xml-exporter', TRUE)
ON CONFLICT ("bundle_id") DO NOTHING;
