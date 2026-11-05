# Especificación Maestra de Expansión Total de Proveko: 14 Microservicios, 54 Submódulos, 26 Funcionalidades y 88 Tablas Relacionales

Este documento especifica la arquitectura completa de expansión de **Proveko** inspirada en:
1. **`hc_version2`** (Terceros, Contratos con Bolsa Presupuestal, Tarifarios Multidimensionales, Bodegas/Ubicaciones/Topes, Lotes con Semáforo Naranja/Rojo, Actas de Recepción Técnica, Kardex Valorizado, Solicitudes de Bodega en 3 Etapas, Canastas/Kits de Insumos, Órdenes de Compra `EgresoOrden`, Facturación Agrupada, Cajas/Cierres, Glosas/Disputas, Agendamiento por Franjas/Recursos, Recordatorios Interactivos WhatsApp/IA, Turnador Digital de Filas y Motor Constructor Dinámico de Reportes).
2. **`FixMotor`** (POS Híbrido Repuestos + Mano de Obra + Cotizaciones por WhatsApp sin descontar stock, Parque Automotor con Semáforo SOAT/Tecnomecánica/Aceite, Recepción Técnica 360° y Tablero Kanban de 5 Etapas, Inventario Valorizado Costo vs Venta con Margen/Markup, Pagos Mixtos, Cartera por Edades, Arqueo de Caja Real `efectivoNetoCaja`, Estado de Resultados Operativo P&G en vivo y Liquidación Auditable de Comisiones de Técnicos `WorkerSettlements`).
3. **Ecosistema Propio (`DocForge_API`, `ColombiaLex_API`, `DataGuard_API`, `HookRelay_API`, `Proyecto Raíz del Río`, `Plataforma Zapatoqueando`, `API_SM`)**.
4. **Benchmarking ERP Colombia (`Siigo Nube / Siigo POS`, `Alegra`, `Loggro`, `World Office`, `Odoo Enterprise l10n_co`, `DIAN UBL 2.1 Anexo Técnico 1.9`)**.

---

## 1. Los 14 Microservicios de Dominio (`srv-*`)

| # | Clave Servicio | Nombre Público (Módulo Principal) | Esquema BD | Submódulos Incluidos (`mod-*`) |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `srv-crm` | **Clientes, Proveedores, Contratos y CRM (v2)** | `srv_crm` | `mod-directory`, `mod-contracts`, `mod-pipelines`, `mod-loyalty`, `mod-customer-360` |
| 2 | `srv-invoicing` | **Facturación DIAN, Caja POS Híbrida y Glosas** | `srv_invoicing` | `mod-pos`, `mod-dian`, `mod-quotes`, `mod-tariffs`, `mod-grouped-billing`, `mod-glosas-disputes`, `mod-layaway` |
| 3 | `srv-inventory` | **Inventario Valorizado, Bodegas WMS y Producción** | `srv_inventory` | `mod-stock`, `mod-warehouses`, `mod-transfers`, `mod-recipes`, `mod-lots`, `mod-tech-reception`, `mod-physical-count`, `mod-price-importer` |
| 4 | `srv-procurement` | **Compras, Órdenes de Compra, RADIAN y Doc Soporte** | `srv_procurement` | `mod-purchase-orders`, `mod-purchase-invoices`, `mod-support-doc-dse`, `mod-radian-events`, `mod-landed-costs` |
| 5 | `srv-treasury` | **Tesorería, Cartera CxC/CxP, Bancos y Cajas Menores** | `srv_treasury` | `mod-receivables-cxc`, `mod-payables-cxp`, `mod-banks-reconciliation`, `mod-petty-cash` |
| 6 | `srv-finance` | **Contabilidad PUC NIIF, Centros de Costo y Exógena** | `srv_finance` | `mod-cashbook`, `mod-arap`, `mod-puc`, `mod-cost-centers`, `mod-fixed-assets`, `mod-exogena-taxes` |
| 7 | `srv-hr-payroll` | **RRHH, Nómina Electrónica DIAN, PILA y Prestaciones** | `srv_hr_payroll` | `mod-employees-contracts`, `mod-payroll-settlement`, `mod-social-benefits-pila`, `mod-electronic-payroll-dian` |
| 8 | `srv-reports` | **Reportes Financieros, Analítica BI y Exportador** | `srv_reports` | `mod-financial-reports`, `mod-sales-profitability-reports`, `mod-inventory-reports`, `mod-tax-dian-reports`, `mod-custom-report-builder` |
| 9 | `srv-gastro` | **Restaurantes, Bares, Mesas, Comandas KDS y Domicilios** | `srv_gastro` | `mod-tables`, `mod-kds`, `mod-split`, `mod-modifiers-menu`, `mod-deliveries` |
| 10 | `srv-workshop` | **Talleres Automotrices, OT Kanban y Comisiones (FixMotor)** | `srv_workshop` | `mod-vehicles-assets`, `mod-work-orders-kanban`, `mod-worker-commissions`, `mod-warranties` |
| 11 | `srv-fleet` | **Flotas, Tractomulas, Báscula Camionera y RNDC** | `srv_fleet` | `mod-scale`, `mod-fleet-dispatch-rndc`, `mod-trip-settlements`, `mod-tires-fleet-maint` |
| 12 | `srv-appointments` | **Agendamiento, Cupos, Recordatorios IA y Turnador (v2)** | `srv_appointments` | `mod-calendar-slots`, `mod-staff-schedules`, `mod-interactive-reminders`, `mod-queue-turnador` |
| 13 | `srv-hotel` | **Hotelería, Habitaciones, Folios y Housekeeping** | `srv_hotel` | `mod-bookings`, `mod-rooms`, `mod-seasonal-rates`, `mod-housekeeping` |
| 14 | `srv-ticketing` | **Taquilla de Tickets QR, Portería y Mesa PQRSF** | `srv_ticketing` | `mod-tickets`, `mod-gate-scanner`, `mod-pqrsf-helpdesk` |

---

## 2. Los 9 Grupos de Clientes (Tipos de Negocio en `proveko_groups_db`)

1. **`comercio-retail`**: Comercio, Tienda, Supermercado & Ferretería (`$149.000 COP/mes`).
2. **`restaurante-gastro`**: Restaurante, Cafetería & Gastrobar (`$189.000 COP/mes`).
3. **`bares-discotecas`**: Bares, Licoreras & Entretenimiento Nocturno (`$179.000 COP/mes`).
4. **`talleres-fixmotor`**: Talleres Automotrices, Motos, Servitecas & Repuestos (`$199.000 COP/mes`).
5. **`reservas-tickets-hotel`**: Hoteles, Alojamiento, Parques & Taquilla de Eventos (`$219.000 COP/mes`).
6. **`servicios-citas-v2`**: Centros de Servicios, Consultorios, Estética & Agendamiento (`$189.000 COP/mes`).
7. **`distribuidora-mayorista`**: Distribuidora Mayorista, Importadora & Multi-Bodega (`$239.000 COP/mes`).
8. **`agro-logistica-bascula`**: Agroindustria, Acopio, Báscula Camionera & Transporte de Carga (`$279.000 COP/mes`).
9. **`erp-corporativo-integral`**: Empresa Industrial / Corporativa Todo-en-Uno (`$349.000 COP/mes`).
