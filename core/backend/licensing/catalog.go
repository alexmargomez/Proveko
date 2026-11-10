package licensing

import "github.com/alexmargomez/proveko/pkg/licensegate"

func OfficialCatalog() []licensegate.ServiceManifest {
	return []licensegate.ServiceManifest{
		{
			ServiceKey:  "ms-facturacion",
			DisplayName: "Facturación y Punto de Venta",
			Icon:        "🧾",
			APIPrefix:   "/api/v1/facturacion",
			Category:    "Comercial",
			Summary:     "Ventas rápidas en mostrador, cotizaciones, facturación electrónica y formatos especializados.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "pos_mostrador", DisplayName: "Facturar / Punto de Venta", TabIcon: "🛒", DefaultActive: true, Summary: "Caja rápida de 2 columnas con productos, servicios y facturas emitidas."},
				{ModuleKey: "cotizaciones", DisplayName: "Cotizaciones Comerciales", TabIcon: "📄", DefaultActive: true, Summary: "Generación e impresión de cotizaciones y envío por WhatsApp."},
				{ModuleKey: "facturas_taller", DisplayName: "Apartado Facturas de Taller", TabIcon: "🔧", DefaultActive: true, Summary: "Habilita selección de Placa, Vehículo, Kilometraje y Orden de Servicio dentro de Facturación."},
				{ModuleKey: "facturacion_dian", DisplayName: "Facturación Electrónica DIAN", TabIcon: "⚡", DefaultActive: true, Summary: "Numeración autorizada, cálculo CUFE y estado de transmisión DIAN."},
			},
			Features: []licensegate.FeatureManifest{
				{FeatureKey: "descuento_linea", DisplayName: "Permitir descuentos por tarifa/convenio", DependsOnModule: "", DefaultActive: true},
				{FeatureKey: "pagos_mixtos_cxc", DisplayName: "Permitir venta a crédito (Cartera CxC) y abonos", DependsOnModule: "", DefaultActive: true},
				{FeatureKey: "asignar_mecanico", DisplayName: "Seleccionar mecánico en factura para liquidar comisión", DependsOnModule: "facturas_taller", DefaultActive: true},
				{FeatureKey: "factura_taller_pdf", DisplayName: "Imprimir PDF con estructura automotriz (Placa, Km y Mecánico)", DependsOnModule: "facturas_taller", DefaultActive: true},
			},
		},
		{
			ServiceKey:  "ms-clientes",
			DisplayName: "Clientes y Terceros",
			Icon:        "👥",
			APIPrefix:   "/api/v1/clientes",
			Category:    "Comercial",
			Summary:     "Directorio maestro normalizado de clientes, convenios, placas, conductores, transportistas y cartera.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "directorio_clientes", DisplayName: "Directorio de Clientes", TabIcon: "👤", DefaultActive: true, Summary: "Registro y consulta de personas y empresas."},
				{ModuleKey: "cartera_cxc", DisplayName: "Cuentas por Cobrar (Cartera)", TabIcon: "💳", DefaultActive: true, Summary: "Control de saldos pendientes y registro de abonos."},
				{ModuleKey: "contratos_convenios", DisplayName: "Contratos y Tarifarios", TabIcon: "🤝", DefaultActive: true, Summary: "Convenios empresariales, topes y descuentos automáticos."},
				{ModuleKey: "flota_terceros", DisplayName: "Conductores y Transportistas", TabIcon: "🚛", DefaultActive: true, Summary: "Catálogo normalizado de conductores, licencias y empresas transportadoras."},
			},
			Features: []licensegate.FeatureManifest{
				{FeatureKey: "cupo_credito_control", DisplayName: "Controlar cupo máximo de crédito por cliente", DependsOnModule: "cartera_cxc", DefaultActive: true},
			},
		},
		{
			ServiceKey:  "ms-inventario",
			DisplayName: "Inventario y Bodegas",
			Icon:        "📦",
			APIPrefix:   "/api/v1/inventario",
			Category:    "Logística",
			Summary:     "Control de existencias, múltiples bodegas, traslados, solicitudes de insumos y Kardex valorizado.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "productos_stock", DisplayName: "Productos y Existencias", TabIcon: "📦", DefaultActive: true, Summary: "Alta de productos, ajuste rápido de stock, surtido y margen de ganancia."},
				{ModuleKey: "bodegas_traslados", DisplayName: "Bodegas y Traslados", TabIcon: "🏭", DefaultActive: true, Summary: "Administración de bodegas y traslados entre sedes."},
				{ModuleKey: "kardex_lotes", DisplayName: "Kardex y Lotes", TabIcon: "📋", DefaultActive: true, Summary: "Trazabilidad de entradas, salidas, lotes y fechas de vencimiento."},
				{ModuleKey: "solicitudes_insumos", DisplayName: "Solicitudes de Insumos", TabIcon: "📥", DefaultActive: true, Summary: "Requisiciones internas de materiales e insumos."},
			},
			Features: []licensegate.FeatureManifest{
				{FeatureKey: "alerta_stock_minimo", DisplayName: "Alertas visuales de productos por agotarse", DependsOnModule: "productos_stock", DefaultActive: true},
			},
		},
		{
			ServiceKey:  "ms-caja",
			DisplayName: "Caja y Tesorería",
			Icon:        "💵",
			APIPrefix:   "/api/v1/caja",
			Category:    "Finanzas",
			Summary:     "Cuadre diario de efectivo, pagos digitales, comprobantes de gasto y arqueo imprimible.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "arqueo_gastos", DisplayName: "Cuadre de Caja y Gastos", TabIcon: "💰", DefaultActive: true, Summary: "Efectivo neto en caja, ingresos digitales y salidas operativas."},
				{ModuleKey: "bancos_tesoreria", DisplayName: "Cuentas y Conciliación", TabIcon: "🏦", DefaultActive: true, Summary: "Movimientos de cuentas bancarias y billeteras digitales."},
			},
			Features: []licensegate.FeatureManifest{
				{FeatureKey: "impresion_egreso", DisplayName: "Generar comprobante impreso de egreso de caja", DependsOnModule: "arqueo_gastos", DefaultActive: true},
			},
		},
		{
			ServiceKey:  "ms-comandas",
			DisplayName: "Mesas y Comandas",
			Icon:        "🍽️",
			APIPrefix:   "/api/v1/comandas",
			Category:    "Gastronomía",
			Summary:     "Atención de mesas para meseros, envío a cocina/barra, precuenta impresa y cobro directo en caja.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "mapa_mesas", DisplayName: "Mapa de Mesas y Pedidos", TabIcon: "🍽️", DefaultActive: true, Summary: "Selección rápida de mesa, platos del catálogo y precuenta."},
				{ModuleKey: "monitor_cocina", DisplayName: "Pantalla Cocina y Barra", TabIcon: "👨‍🍳", DefaultActive: true, Summary: "Pedidos pendientes de preparación por orden de llegada."},
			},
			Features: []licensegate.FeatureManifest{
				{FeatureKey: "notas_preparacion", DisplayName: "Notas rápidas de término y preparación para cocina", DependsOnModule: "mapa_mesas", DefaultActive: true},
			},
		},
		{
			ServiceKey:  "ms-hoteleria",
			DisplayName: "Hotelería y Alojamiento",
			Icon:        "🏨",
			APIPrefix:   "/api/v1/hoteleria",
			Category:    "Hospitalidad",
			Summary:     "Control de habitaciones, Check-In de huéspedes, consumos a la habitación, impresión de cuenta y Check-Out.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "recepcion_habitaciones", DisplayName: "Habitaciones y Check-In", TabIcon: "🛏️", DefaultActive: true, Summary: "Estado en vivo de habitaciones, Check-In, consumos extra y Check-Out a Caja."},
				{ModuleKey: "tarifas_temporadas", DisplayName: "Tarifas Hoteleras", TabIcon: "📅", DefaultActive: true, Summary: "Configuración de tipos de acomodación y tarifas por noche."},
			},
			Features: []licensegate.FeatureManifest{
				{FeatureKey: "cargos_habitacion", DisplayName: "Cargar consumos de restaurante/minibar a la habitación", DependsOnModule: "recepcion_habitaciones", DefaultActive: true},
			},
		},
		{
			ServiceKey:  "ms-taller",
			DisplayName: "Taller y Órdenes de Servicio",
			Icon:        "🔧",
			APIPrefix:   "/api/v1/taller",
			Category:    "Automotriz",
			Summary:     "Recepción de vehículos por placa, tablero de órdenes en vivo, hoja de vida y comisiones de técnicos.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "tablero_ordenes", DisplayName: "Órdenes de Trabajo", TabIcon: "📋", DefaultActive: true, Summary: "Ingreso de vehículo, avance por etapas y paso a Caja para facturar."},
				{ModuleKey: "hoja_vida_vehiculos", DisplayName: "Vehículos y Placas", TabIcon: "🚗", DefaultActive: true, Summary: "Historial técnico, kilometraje, próximo cambio de aceite y SOAT."},
				{ModuleKey: "comisiones_tecnicos", DisplayName: "Liquidación de Técnicos", TabIcon: "👷", DefaultActive: true, Summary: "Cálculo y pago de porcentaje de mano de obra por especialista."},
			},
			Features: []licensegate.FeatureManifest{
				{FeatureKey: "alerta_cambio_aceite", DisplayName: "Sugerencia automática de próximo kilometraje de aceite", DependsOnModule: "tablero_ordenes", DefaultActive: true},
			},
		},
		{
			ServiceKey:  "ms-bascula",
			DisplayName: "Báscula y Transporte de Carga",
			Icon:        "⚖️",
			APIPrefix:   "/api/v1/bascula",
			Category:    "Logística Pesada",
			Summary:     "Pesaje camionero con tiquete automático, destare Bruto/Tara/Neto, conductores, transportistas y cargas.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "pesaje_camionero", DisplayName: "Pesaje y Tiquetes de Báscula", TabIcon: "⚖️", DefaultActive: true, Summary: "Cálculo automático de peso neto vinculando placa, conductor, transportista y carga."},
				{ModuleKey: "rutas_manifiestos", DisplayName: "Cargas y Manifiestos", TabIcon: "🛣️", DefaultActive: true, Summary: "Catálogo de rutas, tipos de carga y manifiestos despachados."},
			},
			Features: []licensegate.FeatureManifest{
				{FeatureKey: "tiquete_doble_firma", DisplayName: "Incluir firmas de conductor y operador en tiquete impreso", DependsOnModule: "pesaje_camionero", DefaultActive: true},
			},
		},
		{
			ServiceKey:  "ms-compras",
			DisplayName: "Compras y Proveedores",
			Icon:        "🚚",
			APIPrefix:   "/api/v1/compras",
			Category:    "Abastecimiento",
			Summary:     "Directorio de proveedores, órdenes de compra y entradas de mercancía a bodega.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "directorio_proveedores", DisplayName: "Proveedores", TabIcon: "🏢", DefaultActive: true, Summary: " Gestión de proveedores nacionales e importadores."},
				{ModuleKey: "ordenes_compra", DisplayName: "Órdenes y Entradas de Compra", TabIcon: "📦", DefaultActive: true, Summary: "Órdenes a proveedor e ingreso directo al stock."},
			},
		},
		{
			ServiceKey:  "ms-agenda",
			DisplayName: "Agenda y Reservas",
			Icon:        "📅",
			APIPrefix:   "/api/v1/agenda",
			Category:    "Servicios",
			Summary:     "Programación de citas, asignación de profesional/recurso y comprobantes de cita.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "calendario_citas", DisplayName: "Citas y Reservas", TabIcon: "🕒", DefaultActive: true, Summary: "Agendamiento rápido con cliente y especialista."},
			},
		},
		{
			ServiceKey:  "ms-taquilla",
			DisplayName: "Taquilla y Entradas",
			Icon:        "🎟️",
			APIPrefix:   "/api/v1/taquilla",
			Category:    "Eventos y Acceso",
			Summary:     "Emisión de boletas/entradas con código consecutivo automático e impresión de tiquete.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "venta_boletas", DisplayName: "Emisión de Tiquetes", TabIcon: "🎟️", DefaultActive: true, Summary: "Taquilla rápida con consecutivo QR automático."},
			},
		},
		{
			ServiceKey:  "ms-nomina",
			DisplayName: "Personal y Nómina",
			Icon:        "👔",
			APIPrefix:   "/api/v1/nomina",
			Category:    "Talento Humano",
			Summary:     "Empleados, cargos, turnos y desprendibles de pago de nómina.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "liquidacion_nomina", DisplayName: "Empleados y Pagos", TabIcon: "📑", DefaultActive: true, Summary: "Liquidación salarial e impresión de colilla de pago."},
			},
		},
		{
			ServiceKey:  "ms-contabilidad",
			DisplayName: "Contabilidad PUC",
			Icon:        "📘",
			APIPrefix:   "/api/v1/contabilidad",
			Category:    "Finanzas",
			Summary:     "Plan Único de Cuentas (PUC), comprobantes contables y asientos con cuentas seleccionables.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "comprobantes_puc", DisplayName: "Asientos y Plan PUC", TabIcon: "📘", DefaultActive: true, Summary: "Registro de comprobantes contables sobre cuentas PUC normalizadas."},
			},
		},
		{
			ServiceKey:  "ms-reportes",
			DisplayName: "Reportes y Exportación",
			Icon:        "📊",
			APIPrefix:   "/api/v1/reportes",
			Category:    "Gerencia",
			Summary:     "Indicadores consolidados de ventas, ganancias, cartera, inventario y descarga en Excel (.CSV) o PDF.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "centro_reportes", DisplayName: "Balance y Descargas Excel", TabIcon: "📈", DefaultActive: true, Summary: "Resumen ejecutivo, exportación CSV e impresión gerencial."},
			},
		},
		{
			ServiceKey:  "ms-impresiones",
			DisplayName: "Impresiones y Membretes",
			Icon:        "🖨️",
			APIPrefix:   "/api/v1/impresiones",
			Category:    "Transversal",
			Summary:     "Configuración de logo, membrete empresarial, pie de garantía y formatos Carta / Tirilla 80mm para todo el sistema.",
			Modules: []licensegate.ModuleManifest{
				{ModuleKey: "config_membretes", DisplayName: "Membrete y Formatos PDF/POS", TabIcon: "🖨️", DefaultActive: true, Summary: "Personaliza el encabezado oficial, NIT, resolución y formato de impresión."},
			},
		},
	}
}
