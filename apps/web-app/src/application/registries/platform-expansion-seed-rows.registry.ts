/**
 * Filas iniciales (Demo / Seed en COP) para todos los nuevos Submódulos de la Expansión Enterprise de Proveko
 * (v2, FixMotor, Siigo/DIAN, RADIAN, Tesorería, Nómina Electrónica, Flotas RNDC, Agendamiento IA y BI).
 */
export const EXPANSION_SUBMODULE_SEED_ROWS: Record<string, readonly (readonly string[])[]> = {
  // srv-crm (Nuevos submódulos v2 + FixMotor)
  'mod-contracts': [
    ['CNT-2026-0084', 'Grupo Industrial del Pacífico S.A.', '2026-01-01 a 2026-12-31', '$ 120.000.000', '$ 84.500.000'],
    ['CNT-2026-0112', 'Clínica y Servicios Integrales S.A.S.', '2026-03-01 a 2027-02-28', '$ 95.000.000', '$ 61.200.000'],
  ],
  'mod-customer-360': [
    ['Comercializadora del Valle S.A.S.', 'Campeón VIP (Alta Frecuencia)', '$ 68.400.000', '$ 4.850.000', '4 Días'],
    ['Transportes Rápidos del Norte S.A.S.', 'Leal Recurrente', '$ 31.200.000', '$ 2.600.000', '11 Días'],
  ],

  // srv-invoicing (Nuevos submódulos v2)
  'mod-tariffs': [
    ['TAR-CORP-2026', 'Tarifario Mayorista Institucional (-15%)', 'Descuento % sobre Lista Base', '2026 Anual', '$ 125.000'],
    ['TAR-CONV-V2', 'Convenio Corporativo Especial Pactado', 'Precio Fijo Pactado por Ítem', '2026 Semestral', '$ 98.500'],
  ],
  'mod-grouped-billing': [
    ['FAC-AGR-2026-089', 'Grupo Industrial del Pacífico — CNT-2026-0084', '28 Remisiones Verificadas (Mes)', 'Corte Mensual', '$ 18.950.000'],
  ],
  'mod-glosas-disputes': [
    ['GLO-2026-00312', 'FEV-10421 — Comercializadora del Valle', 'Diferencia en Tarifa Pactada', '$ 420.000', 'Conciliada (NC Parcial)'],
  ],

  // srv-inventory (Nuevos submódulos v2)
  'mod-tech-reception': [
    ['ACT-REC-2026-118', 'Distribuidora Nacional — FE-9941', 'Lote L-8841 — Temp: 4.2 °C (OK)', 'Íntegro Sellado', 'Aprobado — Stock Disponible'],
  ],
  'mod-physical-count': [
    ['TOM-CIEGA-2026-09', 'Bodega Central Principal', '145 Referencias Auditadas', '$ -48.000', 'Ajuste Contabilizado'],
  ],

  // srv-procurement (Nuevo Microservicio Compras + RADIAN + Doc Soporte)
  'mod-purchase-orders': [
    ['OC-2026-00418', 'Distribuidora Nacional de Insumos — 900.412.889-1', 'Bodega Central Principal', 'Recibida 100%', '$ 4.850.000'],
    ['OC-2026-00419', 'Importadora Andina de Repuestos — 901.220.410-8', 'Bodega Norte Punto Venta', 'Parcial (70%)', '$ 8.200.000'],
  ],
  'mod-purchase-invoices': [
    ['FE-99412', 'Importadora Andina S.A.S.', 'OC-2026-00418 / EA-109', 'IVA 19% + ReteFuente 2.5%', '$ 5.420.000'],
  ],
  'mod-support-doc-dse': [
    ['DSE-000215', 'Jairo Alberto Méndez — CC 79.884.120', 'Mantenimiento Eléctrico Sede Norte', 'CUDS Validado DIAN', '$ 950.000'],
  ],
  'mod-radian-events': [
    ['FEV-88410', 'Licores y Bebidas Nacionales S.A.', '030 Acuse + 032 Recibo + 033 Aceptación', 'Título Valor RADIAN OK', '$ 3.680.000'],
  ],
  'mod-landed-costs': [
    ['PRF-2026-041', 'EA-2026-109 (Bodega Central)', 'Flete Tractomula Puerto Buenaventura', 'Por Peso en Kilogramos', '$ 1.850.000'],
  ],

  // srv-treasury (Nuevo Microservicio Tesorería, Cartera y Bancos)
  'mod-receivables-cxc': [
    ['RC-2026-00891', 'Comercializadora del Valle S.A.S.', 'FEV-10421 (Corriente <30 días)', 'Transferencia Bancolombia', '$ 4.850.000'],
  ],
  'mod-payables-cxp': [
    ['CE-2026-00314', 'Importadora Andina S.A.S.', 'FE-99412 (Por Vencer)', 'Dispersión PAB ACH', '$ 5.420.000'],
  ],
  'mod-banks-reconciliation': [
    ['CON-2026-11', 'Bancolombia Cuenta Corriente 441-889201-04', '$ 48.920.000', '$ 48.920.000', '$ 0 (Conciliado)'],
  ],
  'mod-petty-cash': [
    ['CM-ADMIN-01', 'Elementos de Cafetería, Papelería y Peajes', 'Claudia Patricia Gómez', '$ 1.500.000', '$ 342.000'],
  ],

  // srv-finance (Nuevos submódulos NIIF + Exógena)
  'mod-cost-centers': [
    ['CC-200-LOGISTICA', 'Operación Planta Norte y Distribución', 'Sede Principal', '$ 45.000.000', '$ 31.800.000'],
  ],
  'mod-fixed-assets': [
    ['AF-MAQ-0042', 'Montacargas Eléctrico Toyota 2.5 Ton', '60 Meses', '$ 95.000.000', '$ 79.166.667'],
  ],
  'mod-exogena-taxes': [
    ['Formato 1001 DIAN', '5004 — Compra de Inventarios y Retenciones', '128 NITs Reportados', 'Año Gravable 2026', '$ 845.000.000'],
  ],

  // srv-hr-payroll (Nuevo Microservicio Nómina Electrónica DIAN + PILA)
  'mod-employees-contracts': [
    ['CC 1.032.488.910', 'Julián David Torres — Jefe Operaciones', 'Término Indefinido', 'Sura EPS / Porvenir AFP / ARL II', '$ 2.850.000'],
  ],
  'mod-payroll-settlement': [
    ['NOM-2026-11-Q1', 'Julián David Torres', '$ 3.120.000', '$ 228.000 (Salud 4% + Pensión 4%)', '$ 2.892.000'],
  ],
  'mod-social-benefits-pila': [
    ['PILA-2026-11-8841', 'Planilla Integrada PILA Mensual', '14 Colaboradores', 'Exonerado Ley 1607 Art 114-1', '$ 9.450.000'],
  ],
  'mod-electronic-payroll-dian': [
    ['NE-2026-00314', 'Julián David Torres', 'CUNE-9f82a41c-dian-2026-ok', 'Aceptado DIAN Sin Observaciones', '$ 2.892.000'],
  ],

  // srv-reports (Nuevo Microservicio BI y Reportes Centralizados)
  'mod-financial-reports': [
    ['Estado de Resultados (PyG) NIIF', 'Mensual Consolidado 2026-11', 'Todas las Sedes', 'Utilidad Neta +24.8%', '$ 84.500.000'],
  ],
  'mod-sales-profitability-reports': [
    ['Corte Diario Ventas + Margen FIFO', 'Sede Principal — Andrés Felipe', 'Efectivo + QR + Tarjetas', 'Margen Bruto 38.4%', '$ 14.850.000'],
  ],
  'mod-inventory-reports': [
    ['Valorización de Stock y Alertas FEFO', 'Bodega Central Principal', '248 SKUs Activos', '4 Lotes < 60 días', '$ 192.400.000'],
  ],
  'mod-tax-dian-reports': [
    ['Anexo Bimestral IVA (Formulario 300)', '2026 Bimestre 05', 'IVA Generado $18.4M vs Descontable $11.2M', 'Validado PUC', '$ 7.200.000'],
  ],
  'mod-custom-report-builder': [
    ['Rentabilidad por Cliente y Línea v2', 'Ventas + Inventario + Cartera', 'Excel (.xlsx) + PDF Ejecutivo', 'Lun-Vie 06:00 AM', 'Activo'],
  ],

  // srv-gastro (Nuevos submódulos)
  'mod-modifiers-menu': [
    ['Término de Cocción / Adiciones Parrilla', 'Cortes de Parrilla y Hamburguesas', 'Azul, Medio, 3/4, Bien Asado + Tocineta', '$ 8.500', 'Activo en KDS'],
  ],
  'mod-deliveries': [
    ['DOM-2026-419', 'Cra 15 # 88-20 Apto 502 — 310 554 1190', 'WhatsApp Directo', 'Kevin Mora — Moto KLM-45D', '$ 94.000'],
  ],

  // srv-workshop (Nuevo Microservicio Talleres FixMotor)
  'mod-vehicles-assets': [
    ['KLM-482 (VIN 9FB...)', 'Toyota Hilux SRX 4x4 2.8L Diesel 2024', 'Inversiones del Norte S.A.S.', '42.850 Km', 'SOAT Vigente 2027-04'],
  ],
  'mod-work-orders-kanban': [
    ['OT-2026-00842', 'KLM-482 — Toyota Hilux SRX', 'En Reparación en Bahía 02', 'Ing. Mauricio Castaño', '$ 1.850.000'],
  ],
  'mod-worker-commissions': [
    ['LIQ-TEC-2026-11', 'Ing. Mauricio Castaño (Líder)', '14 Órdenes Entregadas', '35% sobre Mano de Obra ($6.8M)', '$ 2.380.000'],
  ],
  'mod-warranties': [
    ['GAR-2026-019', 'OT-2026-00842 / Placa KLM-482', 'Sincronización e Inyectores Diesel', '90 Días o 5.000 Km', 'Certificado Emitido'],
  ],

  // srv-fleet (Nuevo Microservicio Flotas, Báscula RS-232 y RNDC)
  'mod-fleet-scale': [
    ['BAS-FL-7741', 'SXT-942 / R-4481', 'TransCarga Pesada — Hernando Valencia', '52.400 Kg', '16.800 Kg', '35.600 Kg (35.60 Ton)'],
  ],
  'mod-fleet-dispatch-rndc': [
    ['MN-2026-08841', 'Buenaventura (Valle) → Bogotá D.C.', 'WXY-812 / R-5520', 'Álvaro Gómez — Lic. C3', '$ 4.850.000'],
  ],
  'mod-trip-settlements': [
    ['LIQ-V-2026-310', 'MN-2026-08841', '$ 2.200.000', '18 Peajes + 145 Gal ACPM ($1.95M)', '$ 2.601.500'],
  ],
  'mod-tires-fleet-maint': [
    ['MICH-295-80R22-991', 'WXY-812 — Eje 1 Direccional Izq', '8.5 mm (Óptimo)', '64.200 Km', 'SOAT y Tecno Al Día'],
  ],

  // srv-appointments (Nuevo Microservicio Agendamiento v2 + IA)
  'mod-calendar-slots': [
    ['CIT-2026-0412', 'Laura Valentina Ríos — 315 884 1200', 'Dr. Alejandro Mejía — Consultorio 201', '2026-11-12 09:30 AM', 'Valoración Especializada'],
  ],
  'mod-staff-schedules': [
    ['Dr. Alejandro Mejía', 'Sede Principal — Consultorio 201', 'Lunes a Viernes 07:00 AM - 05:00 PM', '30 Minutos', 'Publicada'],
  ],
  'mod-interactive-reminders': [
    ['WSP-2026-8812', 'Laura Valentina Ríos (+57 3158841200)', 'WhatsApp Interactivo IA (24h/2h)', 'Confirmada por Botón WhatsApp', 'Cupo Asegurado'],
  ],
  'mod-queue-turnador': [
    ['A-042 (Prioritario)', 'Jorge Enrique Vargas', 'Consultorio 201', '8 Minutos', 'Llamando en Pantalla TV'],
  ],

  // srv-hotel (Nuevos submódulos)
  'mod-seasonal-rates': [
    ['Temporada Alta Puentes — Plan Americano', 'Suite Junior VIP', 'Vigencia Puentes 2026', 'Alojamiento + Desayuno Buffet', '$ 340.000'],
  ],
  'mod-housekeeping': [
    ['Habitación 304', 'Luz Marina Pineda', 'Inspeccionada — Lista Check-In', '2x Agua Cristal Cargadas a Folio', '11:40 AM'],
  ],

  // srv-ticketing (Nuevo Microservicio Taquilla QR y Mesa PQRSF SLA)
  'mod-event-tickets': [
    ['TCK-EV-99201', 'Palco VIP (Incluye Consumo)', 'Santiago Ospina', 'QR-PK-88412', '$ 65.000'],
  ],
  'mod-gate-scanner': [
    ['Portería Principal Calle 85', 'Sábado Concierto en Vivo', '340 Validados', '450 Aforo Máx', 'Ingreso Activo (75%)'],
  ],
  'mod-pqrsf-helpdesk': [
    ['PQRS-2026-00914', 'Petición Ley 1755 (15 días hábiles)', 'Marcela Quintero', '12 Días Hábiles Restantes', 'En Trámite (Verde SLA)'],
  ],
};
