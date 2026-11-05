import type { MicroserviceFrontendDefinition } from '../../web-app/src/domain/contracts/platform-hub.contract.js';

/**
 * Frontend interno del Microservicio `srv-inventory` (Módulo Principal: Inventario, Bodegas y Pesaje).
 * Submódulos en interpestañas (apartados grandes dentro del microservicio):
 *  - Existencias y Catálogo (`mod-stock`)
 *  - Bodegas y Ubicaciones (`mod-warehouses`)
 *  - Solicitudes para Traslados (`mod-transfers`)
 *  - Recetas y Producción BOM (`mod-recipes`)
 *  - Control de Lotes y Vencimientos (`mod-lots`)
 *  - Báscula Camionera y Tractomulas (`mod-scale`)
 * Funcionalidades (Componentes minis):
 *  - Firma de encargado (`comp-manager-signature`)
 *  - Seleccionar transportista (`comp-carrier-select`)
 *  - Destare automático Bruto / Tara / Neto (`comp-scale-tare`)
 */
export const SRV_INVENTORY_FRONTEND_VIEW: MicroserviceFrontendDefinition = {
  serviceKey: 'srv-inventory',
  externalPrincipalModuleName: 'Inventario, Bodegas y Logística',
  icon: '📦',
  subtitle: 'Existencias, apartado de bodegas, solicitudes para traslados, recetas, lotes y báscula camionera.',
  standaloneMonthlyUsd: 34,
  submodules: [
    {
      moduleKey: 'mod-stock',
      parentServiceKey: 'srv-inventory',
      externalSubmoduleName: 'Existencias y Catálogo',
      tabIcon: '📊',
      summary: 'Kardex valorizado de productos, insumos, costo promedio ponderado y punto de reorden.',
      monthlyAddonUsd: 10,
      actionButtonLabel: 'Registrar Producto / Ajuste',
      tableHeaders: ['Código SKU', 'Producto / Insumo', 'Bodega Base', 'Disponible', 'Stock Mínimo', 'Costo Unitario'],
      fields: [
        { key: 'sku', label: 'Código SKU', type: 'text', placeholder: 'INS-00412' },
        { key: 'productName', label: 'Nombre del Producto o Insumo', type: 'text', placeholder: 'Cemento Gris Estructural 50Kg' },
        { key: 'warehouseName', label: 'Bodega Asignada', type: 'select', options: ['Bodega Central Principal', 'Bodega Norte Punto Venta', 'Bodega Materia Prima'] },
        { key: 'onHandQty', label: 'Cantidad Disponible', type: 'number', placeholder: '180' },
        { key: 'minStock', label: 'Alerta Stock Mínimo', type: 'number', placeholder: '30' },
        { key: 'unitCost', label: 'Costo Unitario ($)', type: 'number', placeholder: '31500' },
      ],
    },
    {
      moduleKey: 'mod-warehouses',
      parentServiceKey: 'srv-inventory',
      externalSubmoduleName: 'Bodegas',
      tabIcon: '🏭',
      summary: 'Administración de bodegas físicas, centros de acopio, capacidad instalada y responsable.',
      monthlyAddonUsd: 12,
      actionButtonLabel: 'Crear / Actualizar Bodega',
      tableHeaders: ['Código', 'Nombre de Bodega', 'Ciudad / Sede', 'Capacidad', 'Encargado / Firma', 'Estado'],
      fields: [
        { key: 'warehouseCode', label: 'Código de Bodega', type: 'text', placeholder: 'BOD-NORTE-02' },
        { key: 'warehouseTitle', label: 'Nombre de la Bodega', type: 'text', placeholder: 'Bodega Logística Zona Franca' },
        { key: 'cityLocation', label: 'Ciudad / Dirección', type: 'text', placeholder: 'Yumbo — Autopista Cali Km 4' },
        { key: 'capacityTons', label: 'Capacidad Operativa (Ton / Posiciones)', type: 'text', placeholder: '450 Toneladas / 120 Estibas' },
        {
          key: 'managerSignature',
          label: 'Firma de Encargado de Bodega',
          type: 'text',
          placeholder: 'Firmado: Jorge Eliecer Pardo (Jefe de Bodega)',
          requiredFeatureKey: 'comp-manager-signature',
        },
      ],
    },
    {
      moduleKey: 'mod-transfers',
      parentServiceKey: 'srv-inventory',
      externalSubmoduleName: 'Solicitudes para Traslados',
      tabIcon: '🔄',
      summary: 'Solicitudes de traslado entre bodegas con despacho, recepción, transportista y firma de encargado.',
      monthlyAddonUsd: 14,
      actionButtonLabel: 'Emitir Solicitud de Traslado',
      tableHeaders: ['Solicitud', 'Bodega Origen', 'Bodega Destino', 'Ítem y Cantidad', 'Transportista', 'Firma Encargado'],
      fields: [
        { key: 'originWarehouse', label: 'Bodega Origen', type: 'select', options: ['Bodega Central Principal', 'Planta de Producción', 'Bodega Zona Franca'] },
        { key: 'targetWarehouse', label: 'Bodega Destino', type: 'select', options: ['Bodega Norte Punto Venta', 'Bodega Sur Despachos', 'Bodega Principal'] },
        { key: 'itemSummary', label: 'Producto y Cantidad a Trasladar', type: 'text', placeholder: '120 Sacos Harina Fortificada x 50Kg' },
        {
          key: 'carrierName',
          label: 'Seleccionar Transportista',
          type: 'select',
          options: ['Transportes Rápidos del Norte S.A.S.', 'Flota Propia — Camión NPR Placa WXY-412', 'Logística Nacional Carga Segura'],
          requiredFeatureKey: 'comp-carrier-select',
        },
        {
          key: 'managerSignature',
          label: 'Firma de Encargado que Autoriza',
          type: 'text',
          placeholder: 'Autorizado: Ing. Andrés Mejía',
          requiredFeatureKey: 'comp-manager-signature',
        },
      ],
    },
    {
      moduleKey: 'mod-recipes',
      parentServiceKey: 'srv-inventory',
      externalSubmoduleName: 'Recetas y Producción',
      tabIcon: '🧪',
      summary: 'Fórmulas de producción y escandallos con descuento automático de insumos por unidad.',
      monthlyAddonUsd: 14,
      actionButtonLabel: 'Guardar Receta / Fórmula',
      tableHeaders: ['Código', 'Producto Terminado', 'Insumos de la Receta', 'Rendimiento', 'Costo Total'],
      hasVisualRecipeBuilder: true,
      fields: [
        { key: 'finishedName', label: 'Producto Terminado / Plato', type: 'text', placeholder: 'Mezcla Lista / Menú Ejecutivo' },
        { key: 'yieldQty', label: 'Rendimiento por Lote', type: 'number', placeholder: '1' },
      ],
    },
    {
      moduleKey: 'mod-lots',
      parentServiceKey: 'srv-inventory',
      externalSubmoduleName: 'Lotes y Vencimientos',
      tabIcon: '📅',
      summary: 'Trazabilidad sanitaria por lote, fecha de vencimiento y despacho prioritario FEFO.',
      monthlyAddonUsd: 10,
      actionButtonLabel: 'Registrar Lote',
      tableHeaders: ['N° Lote', 'Producto', 'Bodega', 'Vencimiento', 'Cantidad', 'Estado FEFO'],
      fields: [
        { key: 'lotCode', label: 'Número de Lote', type: 'text', placeholder: 'LOT-2026-884' },
        { key: 'productName', label: 'Producto', type: 'text', placeholder: 'Lácteo / Insumo Perecedero' },
        { key: 'expiryDate', label: 'Fecha de Vencimiento', type: 'date' },
        { key: 'qty', label: 'Cantidad del Lote', type: 'number', placeholder: '250' },
      ],
    },
    {
      moduleKey: 'mod-scale',
      parentServiceKey: 'srv-inventory',
      externalSubmoduleName: 'Báscula y Tractomulas',
      tabIcon: '🚛',
      summary: 'Control de tractomulas en báscula camionera, pesaje Bruto/Tara/Neto, transportista y muelle.',
      monthlyAddonUsd: 19,
      actionButtonLabel: 'Emitir Tiquete de Báscula',
      tableHeaders: ['Tiquete', 'Placa / Remolque', 'Transportista / Conductor', 'Peso Bruto', 'Peso Tara', 'Peso Neto'],
      hasTruckScaleWeighbridge: true,
      fields: [
        { key: 'truckPlate', label: 'Placa Cabezote / Remolque', type: 'text', placeholder: 'SXT-942 / R-4481' },
        { key: 'driverName', label: 'Conductor y Cédula', type: 'text', placeholder: 'Hernando Valencia — CC 79.412.880' },
        {
          key: 'carrierCompany',
          label: 'Seleccionar Transportista',
          type: 'select',
          options: ['TransCarga Pesada de Colombia', 'Cooperativa de Tractomulas del Sur', 'Particular / Flota Propia'],
          requiredFeatureKey: 'comp-carrier-select',
        },
        { key: 'cargoType', label: 'Carga y Muelle Asignado', type: 'text', placeholder: 'Granel Maíz Amarillo — Muelle 3' },
      ],
    },
  ],
  features: [
    {
      componentKey: 'comp-manager-signature',
      externalName: 'Firma de encargado',
      description: 'Exige registrar la firma o nombre del encargado responsable en bodegas, traslados y remisiones.',
      parentModuleKey: 'independent',
      includedByDefault: true,
      monthlyAddonUsd: 5,
    },
    {
      componentKey: 'comp-carrier-select',
      externalName: 'Seleccionar transportista',
      description: 'Habilita el selector de empresa transportista y placa en traslados de bodega y báscula.',
      parentModuleKey: 'mod-transfers',
      includedByDefault: true,
      monthlyAddonUsd: 5,
    },
    {
      componentKey: 'comp-scale-tare',
      externalName: 'Cálculo automático Bruto / Tara / Neto en báscula',
      description: 'Calcula en vivo el peso neto destarado en kilogramos y toneladas para tractomulas.',
      parentModuleKey: 'mod-scale',
      includedByDefault: true,
      monthlyAddonUsd: 6,
    },
  ],
};
