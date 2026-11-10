package tenantdb

func newSeededTenantData(companyName string) *TenantData {
	if companyName == "" {
		companyName = "Empresa Cliente S.A.S."
	}
	return &TenantData{
		Branding: BrandingConfig{
			CompanyName:    companyName,
			Nit:            "901.482.190-4",
			TaxRegime:      "Responsable de IVA — Régimen Ordinario",
			Address:        "Av. El Dorado # 68C-61 Of. 402 — Bogotá D.C.",
			Phone:          "310 455 8899",
			Email:          "facturacion@empresa.co",
			DianResolution: "Resolución DIAN N° 18764068221901 — Prefijo FEVP del 1 al 50.000",
			FooterWarranty: "Gracias por su compra. Garantía sujeta a condiciones técnicas del servicio.",
			PrimaryColor:   "#023047",
			DefaultFormat:  "carta_membrete",
		},
		Tariffs: []Tariff{
			{ID: "trf-plena", Code: "TRF-01", Name: "Tarifa Comercial Plena", DiscountPct: 0},
			{ID: "trf-flota", Code: "TRF-02", Name: "Convenio Corporativo / Flota (-12%)", DiscountPct: 12},
			{ID: "trf-mayorista", Code: "TRF-03", Name: "Mayorista / Distribuidor (-18%)", DiscountPct: 18},
		},
		Contracts: []Contract{
			{ID: "cnt-particular", Code: "CNV-001", EntityName: "Venta Directa / Particular", TariffID: "trf-plena", TariffName: "Tarifa Comercial Plena", BudgetCeiling: 999999999, ConsumedAmount: 0, AvailableBalance: 999999999, Status: "Activo"},
			{ID: "cnt-logistica", Code: "CNV-002", EntityName: "Transportes Andinos S.A.S.", TariffID: "trf-flota", TariffName: "Convenio Corporativo / Flota (-12%)", BudgetCeiling: 25000000, ConsumedAmount: 4200000, AvailableBalance: 20800000, Status: "Activo"},
		},
		Customers: []Customer{
			{ID: "cust-1", Code: "CLI-1001", DocType: "CC", Nit: "222222222222", Name: "Consumidor Final Mostrador", TaxRegime: "No Responsable", Phone: "3000000000", Email: "mostrador@cliente.co", City: "Bogotá", Address: "Mostrador Principal", ContractID: "cnt-particular", TariffID: "trf-plena", CreditLimit: 0, CurrentDebt: 0},
			{ID: "cust-2", Code: "CLI-1002", DocType: "NIT", Nit: "900812345", DV: "6", Name: "Transportes Andinos S.A.S.", TaxRegime: "Responsable de IVA", Phone: "3124567890", Email: "compras@andinos.co", City: "Medellín", Address: "Cra 43A # 14-50", ContractID: "cnt-logistica", TariffID: "trf-flota", CreditLimit: 15000000, CurrentDebt: 680000},
			{ID: "cust-3", Code: "CLI-1003", DocType: "CC", Nit: "1032456789", Name: "Carlos Andrés Mejía", TaxRegime: "No Responsable", Phone: "3157894561", Email: "cmejia@correo.co", City: "Cali", Address: "Calle 5 # 38-20", ContractID: "cnt-particular", TariffID: "trf-plena", CreditLimit: 3000000, CurrentDebt: 0},
		},
		Vehicles: []Vehicle{
			{ID: "veh-1", Plate: "KLM-452", Brand: "Toyota Hilux 2.8 Diesel 4x4", ModelYear: "2024", CustomerID: "cust-2", CustomerName: "Transportes Andinos S.A.S.", CurrentKm: 64200, NextOilChangeKm: 69200, SoatExpiry: "2027-03-15", Notes: "Flota corporativa"},
			{ID: "veh-2", Plate: "WXY-987", Brand: "Kenworth T800 Tractocamión", ModelYear: "2023", CustomerID: "cust-2", CustomerName: "Transportes Andinos S.A.S.", CurrentKm: 182000, NextOilChangeKm: 192000, SoatExpiry: "2027-01-20", Notes: "3 ejes carga pesada"},
			{ID: "veh-3", Plate: "GTR-819", Brand: "Mazda CX-30 Grand Touring", ModelYear: "2025", CustomerID: "cust-3", CustomerName: "Carlos Andrés Mejía", CurrentKm: 18500, NextOilChangeKm: 23500, SoatExpiry: "2027-06-10", Notes: "Mantenimiento preventivo"},
		},
		Drivers: []Driver{
			{ID: "drv-1", Code: "COND-101", Name: "Hernando Gómez Patiño", DocNumber: "79451230", LicenseCategory: "C3 Carga Pesada", Phone: "3112345678", VehicleID: "veh-2", AssignedPlate: "WXY-987", Status: "Activo"},
			{ID: "drv-2", Code: "COND-102", Name: "Jairo Alberto Ospina", DocNumber: "80123987", LicenseCategory: "C2 Camión Rígido", Phone: "3148765432", VehicleID: "veh-1", AssignedPlate: "KLM-452", Status: "Activo"},
		},
		Carriers: []Carrier{
			{ID: "car-1", Code: "TRN-201", Nit: "900441122-3", Name: "Logística Nacional de Carga S.A.S.", VehicleType: "Tractomula 3S3", RouteZone: "Ruta Bogotá — Buenaventura", Phone: "3109988776"},
			{ID: "car-2", Code: "TRN-202", Nit: "901223344-8", Name: "Expreso del Magdalena S.A.", VehicleType: "Doble Troque", RouteZone: "Ruta Medellín — Costa Atlántica", Phone: "3165544332"},
		},
		Suppliers: []Supplier{
			{ID: "sup-1", Code: "PRV-301", Nit: "860025147-1", Name: "Importadora Nacional de Repuestos e Insumos S.A.", City: "Bogotá", Phone: "3102223344"},
			{ID: "sup-2", Code: "PRV-302", Nit: "900334455-9", Name: "Distribuidora Mayorista del Valle S.A.S.", City: "Cali", Phone: "3187776655"},
		},
		Warehouses: []Warehouse{
			{ID: "wh-1", Code: "BOD-01", Name: "Bodega Principal Central", City: "Bogotá", Manager: "Andrés Villamizar"},
			{ID: "wh-2", Code: "BOD-02", Name: "Bodega Punto de Venta Norte", City: "Medellín", Manager: "Laura Castellanos"},
		},
		Products: []Product{
			{ID: "prd-1", Code: "PRD-101", Name: "Aceite Sintético 5W-30 Galón Premium", Category: "Lubricantes", WarehouseID: "wh-1", SupplierID: "sup-1", CostPrice: 92000, SalePrice: 148000, TaxPct: 19, Stock: 28, MinStock: 6, LotCode: "LT-2026A", ExpiryDate: "2028-12-31"},
			{ID: "prd-2", Code: "PRD-102", Name: "Juego Pastillas de Freno Cerámicas", Category: "Frenos", WarehouseID: "wh-1", SupplierID: "sup-1", CostPrice: 78000, SalePrice: 135000, TaxPct: 19, Stock: 14, MinStock: 5, LotCode: "LT-2026B", ExpiryDate: "2029-06-30"},
			{ID: "prd-3", Code: "PRD-103", Name: "Filtro de Aire Industrial Alta Eficiencia", Category: "Filtros", WarehouseID: "wh-2", SupplierID: "sup-2", CostPrice: 28000, SalePrice: 52000, TaxPct: 19, Stock: 4, MinStock: 5, LotCode: "LT-2026C", ExpiryDate: "2028-09-30"},
			{ID: "prd-4", Code: "PRD-104", Name: "Menú Ejecutivo / Punta de Anca 350g", Category: "Restaurante", WarehouseID: "wh-1", SupplierID: "sup-2", CostPrice: 21000, SalePrice: 46000, TaxPct: 8, Stock: 45, MinStock: 10, LotCode: "LT-FRESCO", ExpiryDate: "2026-12-31"},
		},
		Workers: []Worker{
			{ID: "wk-1", Code: "TEC-01", Name: "Jorge Iván Ríos", DocNumber: "1020456123", Specialty: "Mecánica Diesel e Inyección", CommissionPct: 40, Phone: "3115556677", TotalDayGross: 140000},
			{ID: "wk-2", Code: "TEC-02", Name: "Camilo Ernesto Duarte", DocNumber: "1018998877", Specialty: "Frenos, Suspensión y Escáner", CommissionPct: 45, Phone: "3134445566", TotalDayGross: 0},
		},
		WorkOrders: []WorkOrder{
			{ID: "OT-3041", CreatedAt: "2026-11-10 08:30", CustomerID: "cust-2", CustomerName: "Transportes Andinos S.A.S.", VehicleID: "veh-1", Plate: "KLM-452", VehicleBrand: "Toyota Hilux 2.8 Diesel 4x4", CurrentKm: 64200, NextOilKm: 69200, WorkerID: "wk-1", WorkerName: "Jorge Iván Ríos", Status: "En Proceso", ServiceDesc: "Sincronización e Inyección Diesel", TotalEstimated: 240000},
			{ID: "OT-3042", CreatedAt: "2026-11-10 09:45", CustomerID: "cust-3", CustomerName: "Carlos Andrés Mejía", VehicleID: "veh-3", Plate: "GTR-819", VehicleBrand: "Mazda CX-30 Grand Touring", CurrentKm: 18500, NextOilKm: 23500, WorkerID: "wk-2", WorkerName: "Camilo Ernesto Duarte", Status: "Listo para Entrega", ServiceDesc: "Cambio de Aceite y Revisión Frenos", TotalEstimated: 140000},
		},
		Invoices: []Invoice{
			{
				ID: "FEVP-9011", Cufe: "CUFE-89123498123", Date: "2026-11-10 09:15",
				CustomerID: "cust-2", CustomerName: "Transportes Andinos S.A.S.", CustomerNit: "900812345-6",
				ContractID: "cnt-logistica", VehicleID: "veh-1", Plate: "KLM-452",
				MechanicID: "wk-1", MechanicName: "Jorge Iván Ríos", LayoutVariant: "factura_taller",
				WorkshopMeta: map[string]string{"Placa": "KLM-452", "Vehículo": "Toyota Hilux 2.8", "Kilometraje": "64.200 km", "Mecánico": "Jorge Iván Ríos"},
				Items: []InvoiceItem{
					{Kind: "PRODUCTO", RefID: "prd-1", Code: "PRD-101", Name: "Aceite Sintético 5W-30 Galón Premium", Qty: 2, Price: 148000, TaxPct: 19},
					{Kind: "SERVICIO", RefID: "OT-3041", Code: "SRV-MO", Name: "Mano de Obra Cambio y Escáner", Qty: 1, Price: 140000, TaxPct: 0, WorkerID: "wk-1", WorkerName: "Jorge Iván Ríos"},
				},
				Subtotal: 436000, DiscountTotal: 0, TaxTotal: 56240, Total: 492240,
				PaymentMethod: "Crédito / Cartera CxC", AmountPaid: 200000, PendingBalance: 292240, Status: "Pendiente CxC",
				AbonosHistory: []AbonoRecord{{ID: "RC-5001", Date: "2026-11-10", Amount: 200000, Method: "Transferencia Bancaria", Note: "Anticipo inicial"}},
			},
		},
		Expenses: []Expense{
			{ID: "EGR-101", Date: "2026-11-10 08:10", Category: "Insumos Operativos", Description: "Compra papelería térmica y elementos de aseo", Amount: 45000, PaymentSource: "Efectivo Caja", Responsible: "Caja Principal"},
		},
		DiningTables: []DiningTable{
			{ID: "tbl-1", Name: "Mesa 1", Zone: "Salón Principal", Waiter: "Camila (Mesera)", Status: "Ocupada", Items: []GastroItem{{ProductID: "prd-4", Name: "Menú Ejecutivo / Punta de Anca 350g", Qty: 2, Price: 46000, Note: "Término 3/4"}}, Total: 92000},
			{ID: "tbl-2", Name: "Mesa 2", Zone: "Salón Principal", Waiter: "Camila (Mesera)", Status: "Libre", Items: []GastroItem{}, Total: 0},
			{ID: "tbl-3", Name: "Mesa 3", Zone: "Terraza", Waiter: "Mateo (Terraza)", Status: "En Cocina", Items: []GastroItem{{ProductID: "prd-4", Name: "Punta de Anca 350g", Qty: 1, Price: 46000, Note: "Bien asado"}}, Total: 46000},
		},
		HotelRooms: []HotelRoom{
			{ID: "rm-101", RoomNumber: "Habitación 101", RoomType: "Suite Ejecutiva Doble", Floor: "Piso 1", NightlyRate: 185000, Status: "Ocupada", CheckInCode: "CHK-501", GuestID: "cust-2", GuestName: "Transportes Andinos S.A.S.", CheckInDate: "2026-11-09", Nights: 2, ExtrasTotal: 35000},
			{ID: "rm-102", RoomNumber: "Habitación 102", RoomType: "Estándar Sencilla", Floor: "Piso 1", NightlyRate: 130000, Status: "Disponible"},
			{ID: "rm-201", RoomNumber: "Habitación 201", RoomType: "Suite Familiar", Floor: "Piso 2", NightlyRate: 240000, Status: "Disponible"},
		},
		CargoRoutes: []CargoRoute{
			{ID: "crg-1", Code: "CRG-01", Description: "Contenedor Carga Seca 40 Pies", Origin: "Puerto Buenaventura", Destination: "Zona Franca Bogotá"},
			{ID: "crg-2", Code: "CRG-02", Description: "Granel Agrícola Maíz / Soya", Origin: "Planta Buga", Destination: "Medellín Sur"},
			{ID: "crg-3", Code: "CRG-03", Description: "Acero Estructural y Bobinas", Origin: "Siderúrgica Boyacá", Destination: "Cali Industrial"},
		},
		ScaleTickets: []ScaleTicket{
			{ID: "BAS-1001", Date: "2026-11-10 07:45", VehicleID: "veh-2", Plate: "WXY-987", DriverID: "drv-1", DriverName: "Hernando Gómez Patiño", CarrierID: "car-1", CarrierName: "Logística Nacional de Carga S.A.S.", CargoID: "crg-1", CargoDesc: "Contenedor Carga Seca 40 Pies (Puerto Buenaventura -> Zona Franca Bogotá)", GrossKg: 51840, TareKg: 16920, NetKg: 34920, Status: "Pesaje Completado"},
		},
		PucAccounts: []PucAccount{
			{ID: "puc-1105", Code: "110505", Name: "110505 — Caja General Efectivo", Category: "Activo"},
			{ID: "puc-1110", Code: "111005", Name: "111005 — Bancos Moneda Nacional", Category: "Activo"},
			{ID: "puc-1305", Code: "130505", Name: "130505 — Clientes Nacionales (CxC)", Category: "Activo"},
			{ID: "puc-1435", Code: "143501", Name: "143501 — Mercancías No Fabricadas por la Empresa", Category: "Activo"},
			{ID: "puc-2205", Code: "220505", Name: "220505 — Proveedores Nacionales (CxP)", Category: "Pasivo"},
			{ID: "puc-2408", Code: "240801", Name: "240801 — Impuesto sobre las Ventas por Pagar (IVA)", Category: "Pasivo"},
			{ID: "puc-4135", Code: "413595", Name: "413595 — Ingresos Operacionales Comercio y Servicios", Category: "Ingreso"},
			{ID: "puc-5105", Code: "510506", Name: "510506 — Sueldos y Salarios Personal", Category: "Gasto"},
		},
		GenericModules: map[string][]GenericRecord{},
	}
}
