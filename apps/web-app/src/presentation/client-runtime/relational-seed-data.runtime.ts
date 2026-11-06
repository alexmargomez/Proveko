/**
 * Base de Datos Relacional Normalizada en Memoria/PostgreSQL (<= 200 líneas).
 * Tablas enlazadas: tariffs, contracts, customers, suppliers, warehouses, products,
 * vehicles, drivers, carriers, hotelRooms, pucAccounts, workers, workOrders, invoices,
 * kardexMovements, expenses, settlements, diningTables.
 */
export function renderRelationalSeedDataRuntimeJs(): string {
  return `
  function pkCreateInitialRelationalDb() {
    return {
      tariffs: [
        { id: 'trf-plena', code: 'TAR-NORMAL', name: 'Precio General Mostrador', discountPct: 0 },
        { id: 'trf-corp-15', code: 'TAR-CORP-15', name: 'Tarifa Convenio Empresarial', discountPct: 15 },
        { id: 'trf-vip-10', code: 'TAR-MAYOR-10', name: 'Lista Mayorista / Cliente Frecuente', discountPct: 10 }
      ],
      contracts: [
        { id: 'cnt-particular', code: 'CONTADO', entityName: 'Venta Directa / Particular', tariffName: 'Precio General (0%)', budgetCeiling: 0, consumedAmount: 0, availableBalance: 0, status: 'Activo' },
        { id: 'cnt-0084', code: 'CNV-2026-084', entityName: 'Comercializadora del Valle S.A.S.', tariffName: 'Tarifa Convenio (-15%)', budgetCeiling: 120000000, consumedAmount: 35500000, availableBalance: 84500000, status: 'Activo' },
        { id: 'cnt-0112', code: 'CNV-2026-112', entityName: 'Transportes del Norte S.A.S.', tariffName: 'Lista Mayorista (-10%)', budgetCeiling: 80000000, consumedAmount: 19200000, availableBalance: 60800000, status: 'Activo' }
      ],
      customers: [
        { id: 'cust-1', docType: 'NIT', nit: '901452110', dv: '4', name: 'Comercializadora del Valle S.A.S.', businessType: 'Jurídica', taxRegime: 'Responsable de IVA', phone: '3104458890', email: 'compras@comvalle.co', city: 'Cali', address: 'Av. 6N # 28-10', creditLimit: 35000000, currentDebt: 425000, contractId: 'cnt-0084', tariffId: 'trf-corp-15' },
        { id: 'cust-2', docType: 'NIT', nit: '900812441', dv: '9', name: 'Inversiones y Transportes del Norte S.A.S.', businessType: 'Jurídica', taxRegime: 'Responsable de IVA', phone: '3157782210', email: 'logistica@transnorte.co', city: 'Barranquilla', address: 'Vía 40 # 73-290', creditLimit: 25000000, currentDebt: 0, contractId: 'cnt-0112', tariffId: 'trf-vip-10' },
        { id: 'cust-3', docType: 'CC', nit: '79884120', dv: '', name: 'Andrés Felipe Ospina (Particular)', businessType: 'Natural', taxRegime: 'No Responsable', phone: '3005541190', email: 'aospina@gmail.com', city: 'Bogotá', address: 'Calle 80 # 15-40', creditLimit: 5000000, currentDebt: 0, contractId: 'cnt-particular', tariffId: 'trf-plena' }
      ],
      suppliers: [
        { id: 'sup-1', nit: '900412889-1', name: 'Distribuidora Nacional de Repuestos e Insumos S.A.S.', contactName: 'Roberto Ariza', city: 'Bogotá', phone: '3189901122' },
        { id: 'sup-2', nit: '901220410-8', name: 'Importadora Andina de Lubricantes y Suministros S.A.', contactName: 'Claudia Gómez', city: 'Medellín', phone: '3124405566' }
      ],
      warehouses: [
        { id: 'wh-central', code: 'BOD-01', name: 'Bodega Central Principal', city: 'Sede Principal', manager: 'Jorge Pardo' },
        { id: 'wh-norte', code: 'BOD-02', name: 'Bodega Punto de Venta Norte', city: 'Sede Norte', manager: 'Andrés Mejía' }
      ],
      carriers: [
        { id: 'car-1', nit: '900771220-8', name: 'Transportes Rápidos del Norte S.A.S.', city: 'Barranquilla', phone: '3004419080', rndcCode: 'RNDC-4410' },
        { id: 'car-2', nit: '890102440-3', name: 'TransCarga Pesada Nacional S.A.', city: 'Bogotá', phone: '3158821090', rndcCode: 'RNDC-8821' },
        { id: 'car-3', nit: '901550310-1', name: 'Logística y Fletes del Pacífico S.A.S.', city: 'Cali', phone: '3116654321', rndcCode: 'RNDC-5503' }
      ],
      drivers: [
        { id: 'drv-1', docNumber: '72.184.990', name: 'Hernando Valencia Ríos', licenseCategory: 'C3 Pesados', phone: '3108842211', carrierId: 'car-2', carrierName: 'TransCarga Pesada Nacional S.A.', assignedPlate: 'SXT-942' },
        { id: 'drv-2', docNumber: '80.412.330', name: 'Jairo Alberto Morales', licenseCategory: 'C3 Tractocamión', phone: '3159914400', carrierId: 'car-1', carrierName: 'Transportes Rápidos del Norte S.A.S.', assignedPlate: 'WXY-812' },
        { id: 'drv-3', docNumber: '1.045.712.800', name: 'Luis Fernando Cano', licenseCategory: 'C2 Camión Rígido', phone: '3014458812', carrierId: 'car-3', carrierName: 'Logística y Fletes del Pacífico S.A.S.', assignedPlate: 'KLM-482' }
      ],
      hotelRooms: [
        { id: 'rm-101', roomNumber: 'Habitación 101', roomType: 'Sencilla Ejecutiva', floor: 'Piso 1', nightlyRate: 145000, status: 'Disponible', guestId: '', guestName: '', checkInDate: '', nights: 1, extrasTotal: 0 },
        { id: 'rm-204', roomNumber: 'Habitación 204', roomType: 'Doble Superior', floor: 'Piso 2', nightlyRate: 210000, status: 'Ocupada', guestId: 'cust-1', guestName: 'Comercializadora del Valle S.A.S.', checkInDate: '2026-11-05', nights: 2, extrasTotal: 45000 },
        { id: 'rm-301', roomNumber: 'Suite 301', roomType: 'Suite Familiar / Balcón', floor: 'Piso 3', nightlyRate: 320000, status: 'Ocupada', guestId: 'cust-3', guestName: 'Andrés Felipe Ospina (Particular)', checkInDate: '2026-11-05', nights: 1, extrasTotal: 0 },
        { id: 'rm-102', roomNumber: 'Cabaña 04', roomType: 'Cabaña Campestre (4 Pers.)', floor: 'Zona Verde', nightlyRate: 380000, status: 'Disponible', guestId: '', guestName: '', checkInDate: '', nights: 1, extrasTotal: 0 }
      ],
      pucAccounts: [
        { id: 'puc-1105', code: '110505', name: '110505 - Caja General Principal' },
        { id: 'puc-1110', code: '111005', name: '111005 - Bancos Moneda Nacional' },
        { id: 'puc-1305', code: '130505', name: '130505 - Clientes Nacionales (Cartera)' },
        { id: 'puc-1435', code: '143501', name: '143501 - Mercancías no Fabricadas por la Empresa' },
        { id: 'puc-2205', code: '220505', name: '220505 - Proveedores Nacionales' },
        { id: 'puc-4135', code: '413501', name: '413501 - Comercio al por Mayor y al por Menor' },
        { id: 'puc-5105', code: '510506', name: '510506 - Sueldos y Gastos de Personal' }
      ],
      products: [
        { id: 'prd-1', code: 'ACE-10W40', sku: 'ACE-10W40', name: 'Aceite Sintético 10W-40 Alto Rendimiento (Galón)', category: 'Lubricantes y Fluidos', warehouseId: 'wh-central', supplierId: 'sup-2', costPrice: 95000, salePrice: 145000, taxPct: 19, stock: 28, minStock: 6, lotCode: 'LOT-2026-901', expiryDate: '2027-08-15' },
        { id: 'prd-2', code: 'FRE-204', sku: 'FRE-204', name: 'Juego Pastillas de Freno Cerámicas Delanteras', category: 'Frenos y Seguridad', warehouseId: 'wh-central', supplierId: 'sup-1', costPrice: 110000, salePrice: 185000, taxPct: 19, stock: 14, minStock: 5, lotCode: 'LOT-2026-412', expiryDate: '2028-12-31' },
        { id: 'prd-3', code: 'FIL-309', sku: 'FIL-309', name: 'Filtro de Aire y Combustible Original', category: 'Filtros y Motor', warehouseId: 'wh-central', supplierId: 'sup-1', costPrice: 32000, salePrice: 58000, taxPct: 19, stock: 4, minStock: 8, lotCode: 'LOT-2026-109', expiryDate: '2027-05-20' },
        { id: 'prd-4', code: 'BAT-800A', sku: 'BAT-800A', name: 'Batería Sellada Libre Mantenimiento 800 Amp', category: 'Eléctricos y Baterías', warehouseId: 'wh-norte', supplierId: 'sup-1', costPrice: 310000, salePrice: 460000, taxPct: 19, stock: 9, minStock: 3, lotCode: 'LOT-2026-774', expiryDate: '2027-11-30' }
      ],
      vehicles: [
        { id: 'veh-1', plate: 'KLM-482', brand: 'Toyota Hilux SRX 4x4 Diesel', modelYear: '2024', customerId: 'cust-2', customerName: 'Inversiones y Transportes del Norte S.A.S.', currentKm: 42850, nextOilChangeKm: 42500, soatExpiry: '2026-10-15', tecnoExpiry: '2027-04-20', notes: 'Revisión de inyectores y cambio de aceite' },
        { id: 'veh-2', plate: 'WXY-812', brand: 'Kenworth T800 Tractocamión 3S3', modelYear: '2023', customerId: 'cust-1', customerName: 'Comercializadora del Valle S.A.S.', currentKm: 184200, nextOilChangeKm: 185000, soatExpiry: '2027-06-10', tecnoExpiry: '2027-06-10', notes: 'Mantenimiento preventivo de flota' },
        { id: 'veh-3', plate: 'SXT-942', brand: 'International ProStar Cabezote + R-4481', modelYear: '2025', customerId: 'cust-2', customerName: 'Inversiones y Transportes del Norte S.A.S.', currentKm: 64900, nextOilChangeKm: 70000, soatExpiry: '2027-02-18', tecnoExpiry: '2027-02-18', notes: 'Tractomula de carga pesada' }
      ],
      workers: [
        { id: 'wk-1', docNumber: '79412880', name: 'Carlos Andrés Méndez', specialty: 'Mecánico Líder / Especialista', commissionPct: 50, totalDayGross: 380000, phone: '3112233445' },
        { id: 'wk-2', docNumber: '1032488910', name: 'Julián David Torres', specialty: 'Técnico de Diagnóstico y Servicio', commissionPct: 45, totalDayGross: 240000, phone: '3145566778' },
        { id: 'wk-3', docNumber: '52889104', name: 'Laura Marcela Gómez', specialty: 'Asesora Comercial / Atención', commissionPct: 40, totalDayGross: 150000, phone: '3168899001' }
      ],
      workOrders: [
        { id: 'OT-3041', createdAt: '2026-11-05 08:30', customerId: 'cust-2', customerName: 'Inversiones y Transportes del Norte S.A.S.', vehicleId: 'veh-1', plate: 'KLM-482', vehicleBrand: 'Toyota Hilux SRX 4x4', currentKm: 42850, nextOilKm: 47850, workerId: 'wk-1', workerName: 'Carlos Andrés Méndez', status: 'En Proceso', services: [{ description: 'Mantenimiento 40.000 Km + Escáner', price: 220000 }, { description: 'Limpieza Ultrasonido de Inyectores', price: 160000 }], totalEstimated: 380000 },
        { id: 'OT-3042', createdAt: '2026-11-05 09:15', customerId: 'cust-3', customerName: 'Andrés Felipe Ospina', vehicleId: 'veh-3', plate: 'SXT-942', vehicleBrand: 'International ProStar', currentKm: 64900, nextOilKm: 70000, workerId: 'wk-2', workerName: 'Julián David Torres', status: 'Listo para Entrega', services: [{ description: 'Sincronización e Inyección Electrónica', price: 140000 }, { description: 'Cambio de Pastillas de Freno', price: 60000 }], totalEstimated: 200000 },
        { id: 'OT-3043', createdAt: '2026-11-05 10:00', customerId: 'cust-1', customerName: 'Comercializadora del Valle S.A.S.', vehicleId: 'veh-2', plate: 'WXY-812', vehicleBrand: 'Kenworth T800', currentKm: 184200, nextOilKm: 190000, workerId: 'wk-1', workerName: 'Carlos Andrés Méndez', status: 'Recibido', services: [{ description: 'Diagnóstico Eléctrico Computarizado 24V', price: 180000 }], totalEstimated: 180000 }
      ],
      invoices: [
        {
          id: 'FEVP-9010', cufe: 'CUFE-9010-2026', date: '2026-11-05 09:40',
          customerId: 'cust-1', customerName: 'Comercializadora del Valle S.A.S.', customerNit: '901452110-4',
          contractId: 'cnt-0084', vehicleId: 'veh-2', plate: 'WXY-812',
          items: [{ kind: 'PRODUCTO', refId: 'prd-1', code: 'ACE-10W40', name: 'Aceite Sintético 10W-40 (Galón)', qty: 2, price: 145000 }, { kind: 'SERVICIO', refId: 'SRV-1', code: 'MO', name: 'Mantenimiento Preventivo y Frenos', qty: 1, price: 435000 }],
          subtotal: 725000, discountTotal: 0, taxTotal: 0, total: 725000,
          paymentMethod: 'Crédito / Cartera CxC', amountPaid: 300000, pendingBalance: 425000,
          status: 'Pendiente CxC', glosaStatus: 'Vigente',
          abonosHistory: [{ id: 'RC-1001', date: '2026-11-05', amount: 300000, method: 'Transferencia / Nequi', note: 'Anticipo inicial' }]
        },
        {
          id: 'FEVP-9009', cufe: 'CUFE-9009-2026', date: '2026-11-05 08:20',
          customerId: 'cust-2', customerName: 'Inversiones y Transportes del Norte S.A.S.', customerNit: '900812441-9',
          contractId: 'cnt-0112', vehicleId: 'veh-1', plate: 'KLM-482',
          items: [{ kind: 'PRODUCTO', refId: 'prd-4', code: 'BAT-800A', name: 'Batería Sellada 800 Amp', qty: 1, price: 460000 }, { kind: 'SERVICIO', refId: 'SRV-2', code: 'MO', name: 'Instalación y Prueba de Alternador', qty: 1, price: 90000 }],
          subtotal: 550000, discountTotal: 0, taxTotal: 0, total: 550000,
          paymentMethod: 'Efectivo', amountPaid: 550000, pendingBalance: 0,
          status: 'Pagada', glosaStatus: 'Cerrada',
          abonosHistory: [{ id: 'RC-1000', date: '2026-11-05', amount: 550000, method: 'Efectivo', note: 'Pago en Caja' }]
        }
      ],
      kardexMovements: [
        { id: 'KDX-101', date: '2026-11-05 08:00', productId: 'prd-1', productName: 'Aceite Sintético 10W-40 (Galón)', warehouseId: 'wh-central', movementType: 'ENTRADA_COMPRA', qty: 30, unitCost: 95000, balanceAfter: 30, referenceDoc: 'FAC-PROV-118', actor: 'Bodega' },
        { id: 'KDX-102', date: '2026-11-05 09:40', productId: 'prd-1', productName: 'Aceite Sintético 10W-40 (Galón)', warehouseId: 'wh-central', movementType: 'SALIDA_VENTA', qty: -2, unitCost: 95000, balanceAfter: 28, referenceDoc: 'FEVP-9010', actor: 'Caja' }
      ],
      expenses: [
        { id: 'EGR-201', date: '2026-11-05 08:50', category: 'Insumos Operativos', description: 'Compra de insumos de limpieza y papelería', paymentSource: 'Efectivo Caja', amount: 68000, responsible: 'Caja' },
        { id: 'EGR-202', date: '2026-11-05 10:10', category: 'Transporte y Mensajería', description: 'Domicilio de repuestos urgentes', paymentSource: 'Efectivo Caja', amount: 35000, responsible: 'Caja' }
      ],
      settlements: [
        { id: 'LIQ-301', date: '2026-11-04 18:00', workerId: 'wk-1', workerName: 'Carlos Andrés Méndez', grossLabor: 680000, commissionPct: 50, technicianPayout: 340000, companyRetention: 340000 }
      ],
      diningTables: [
        { id: 'tbl-1', name: 'Mesa 1 — Terraza', waiter: 'Mateo Ríos', diners: 4, status: 'Ocupada', items: [{ productId: 'cmd-1', name: 'Punta de Anca a la Parrilla', qty: 2, price: 42000, note: 'Término 3/4' }, { productId: 'cmd-2', name: 'Limonada de Coco', qty: 2, price: 12000, note: 'Sin azúcar' }], total: 108000 },
        { id: 'tbl-2', name: 'Mesa 2 — Salón Principal', waiter: 'Laura Gómez', diners: 0, status: 'Libre', items: [], total: 0 },
        { id: 'tbl-3', name: 'Mesa 3 — VIP', waiter: 'Mateo Ríos', diners: 3, status: 'En Cocina', items: [{ productId: 'cmd-3', name: 'Picada Especial para Compartir', qty: 1, price: 58000, note: 'Extra patacón' }, { productId: 'cmd-4', name: 'Cerveza Club Colombia', qty: 3, price: 9000, note: 'Bien fría' }], total: 85000 },
        { id: 'tbl-4', name: 'Barra 1', waiter: 'Laura Gómez', diners: 0, status: 'Libre', items: [], total: 0 }
      ]
    };
  }

  function pkFindById(list, id) {
    if (!Array.isArray(list) || !id) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return null;
  }

  function pkNormalizeRelDb(raw) {
    var seed = pkCreateInitialRelationalDb();
    if (!raw || typeof raw !== 'object') return seed;
    var keys = ['tariffs', 'contracts', 'customers', 'suppliers', 'warehouses', 'carriers', 'drivers', 'hotelRooms', 'pucAccounts', 'products', 'vehicles', 'workers', 'workOrders', 'invoices', 'kardexMovements', 'expenses', 'settlements', 'diningTables'];
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      if (!Array.isArray(raw[key]) || raw[key].length === 0) raw[key] = seed[key];
    }
    return raw;
  }

  function pkPersistRelationalTx(actionType, entityPayload) {
    if (pkIsDemoMode()) { pkSaveDemoToLocalStorage(); return; }
    var cl = pkGetActiveClient();
    if (!cl || !cl.dbName) return;
    fetch('/api/v1/client-workspace/transaction', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dbName: cl.dbName, actionType: actionType || 'SYNC_STATE', entityPayload: entityPayload || {}, fullRelationalState: STATE.relDb })
    }).catch(function() {});
  }

  function pkDownloadCsvUtf8(filename, headers, rows) {
    var escCell = function(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [headers.map(escCell).join(';')];
    for (var i = 0; i < rows.length; i++) lines.push(rows[i].map(escCell).join(';'));
    var blob = new Blob(['\\uFEFF' + lines.join('\\r\\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.setAttribute('download', filename);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
`;
}
