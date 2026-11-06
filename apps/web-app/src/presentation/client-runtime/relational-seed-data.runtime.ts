/**
 * Motor de Grafo Relacional con Foreign Keys Reales (Estilo FactuPOS + HC Version2).
 * Conecta Clientes, Contratos v2, Tarifarios, Vehículos/Activos, Técnicos/Empleados,
 * Productos/Bodegas, Kardex, Órdenes Kanban, Facturas POS/DIAN, Cartera CxC, Gastos y Liquidaciones.
 */
export function renderRelationalSeedDataRuntimeJs(): string {
  return `
  function pkCreateInitialRelationalDb() {
    return {
      tariffs: [
        { id: 'tar-base', code: 'TAR-MOSTRADOR', name: 'Precio Base General (0% Desc.)', discountPct: 0 },
        { id: 'tar-corp-15', code: 'TAR-CORP-2026', name: 'Tarifario Convenio Institucional (-15% v2)', discountPct: 15 },
        { id: 'tar-vip-10', code: 'TAR-VIP-10', name: 'Lista Mayorista / Flota Aliada (-10%)', discountPct: 10 }
      ],
      contracts: [
        { id: 'cnt-0084', code: 'CNT-2026-0084', customerId: 'cust-1', name: 'Convenio Suministro y Mantenimiento Anual v2', budgetCeiling: 120000000, consumedAmount: 35500000, availableBalance: 84500000, tariffId: 'tar-corp-15', status: 'ACTIVO' },
        { id: 'cnt-0112', code: 'CNT-2026-0112', customerId: 'cust-2', name: 'Contrato Flota Pesada y Repuestos del Norte', budgetCeiling: 80000000, consumedAmount: 19200000, availableBalance: 60800000, tariffId: 'tar-vip-10', status: 'ACTIVO' }
      ],
      customers: [
        { id: 'cust-1', nit: '901452110', dv: '4', name: 'Comercializadora del Valle S.A.S.', phone: '3104458890', email: 'facturacion@comvalle.co', city: 'Cali', creditLimit: 35000000, contractId: 'cnt-0084', tariffId: 'tar-corp-15' },
        { id: 'cust-2', nit: '900812441', dv: '9', name: 'Inversiones y Transportes del Norte S.A.S.', phone: '3157782210', email: 'logistica@transnorte.co', city: 'Barranquilla', creditLimit: 25000000, contractId: 'cnt-0112', tariffId: 'tar-vip-10' },
        { id: 'cust-3', nit: '79884120', dv: '3', name: 'Andrés Felipe Ospina (Particular)', phone: '3005541190', email: 'aospina@gmail.com', city: 'Bogotá D.C.', creditLimit: 5000000, contractId: '', tariffId: 'tar-base' }
      ],
      suppliers: [
        { id: 'sup-1', nit: '900412889-1', name: 'Distribuidora Nacional de Repuestos e Insumos S.A.S.', phone: '3189901122', email: 'ventas@disnacional.co', contactName: 'Ing. Roberto Ariza' },
        { id: 'sup-2', nit: '901220410-8', name: 'Importadora Andina de Lubricantes y Partes S.A.', phone: '3124405566', email: 'pedidos@impandina.co', contactName: 'Dra. Claudia Gómez' }
      ],
      warehouses: [
        { id: 'wh-central', code: 'BOD-CENTRAL-01', name: 'Bodega Central Principal', city: 'Sede Principal', manager: 'Jorge Pardo' },
        { id: 'wh-norte', code: 'BOD-NORTE-02', name: 'Bodega Norte Punto de Venta', city: 'Sede Norte', manager: 'Andrés Mejía' }
      ],
      products: [
        { id: 'prd-1', sku: '7701001', name: 'Aceite Sintético 10W-40 Alto Rendimiento (Galón)', warehouseId: 'wh-central', supplierId: 'sup-2', costPrice: 95000, salePrice: 145000, stock: 28, minStock: 6, lotNumber: 'LOT-2026-901', expirationDate: '2027-08-15' },
        { id: 'prd-2', sku: '7701002', name: 'Kit Pastillas de Freno Cerámicas Delanteras', warehouseId: 'wh-central', supplierId: 'sup-1', costPrice: 110000, salePrice: 185000, stock: 14, minStock: 5, lotNumber: 'LOT-2026-412', expirationDate: '2028-12-31' },
        { id: 'prd-3', sku: '7701003', name: 'Filtro de Aire / Combustible Original OEM', warehouseId: 'wh-central', supplierId: 'sup-1', costPrice: 32000, salePrice: 58000, stock: 4, minStock: 8, lotNumber: 'LOT-2026-109', expirationDate: '2027-05-20' },
        { id: 'prd-4', sku: '7701004', name: 'Batería Sellada Libre Mantenimiento 800 Amp', warehouseId: 'wh-norte', supplierId: 'sup-1', costPrice: 310000, salePrice: 460000, stock: 9, minStock: 3, lotNumber: 'LOT-2026-774', expirationDate: '2027-11-30' }
      ],
      vehicles: [
        { id: 'veh-1', plate: 'KLM-482', make: 'Toyota', model: 'Hilux SRX 4x4 2.8L Diesel', customerId: 'cust-2', currentMileage: 42850, nextOilChangeKm: 42500, soatDueDate: '2026-10-15', tecnoDueDate: '2027-04-20' },
        { id: 'veh-2', plate: 'WXY-812', make: 'Kenworth', model: 'T800 Tractomula 3S3', customerId: 'cust-1', currentMileage: 184200, nextOilChangeKm: 185000, soatDueDate: '2027-06-10', tecnoDueDate: '2027-06-10' },
        { id: 'veh-3', plate: 'MTX-99D', make: 'Yamaha', model: 'FZ 250 ABS', customerId: 'cust-3', currentMileage: 14900, nextOilChangeKm: 15000, soatDueDate: '2027-02-18', tecnoDueDate: '2027-02-18' }
      ],
      workers: [
        { id: 'wrk-1', docNumber: '79.412.880', name: 'Ing. Mauricio Castaño (Líder Técnico)', roleTitle: 'Especialista Senior / Mecánico Líder', commissionPct: 50, totalDayGross: 380000, phone: '3112233445' },
        { id: 'wrk-2', docNumber: '1.032.488.910', name: 'Julián David Torres (Técnico A)', roleTitle: 'Técnico de Diagnóstico y Sincronización', commissionPct: 45, totalDayGross: 240000, phone: '3145566778' },
        { id: 'wrk-3', docNumber: '52.889.104', name: 'Dra. Laura Gómez (Especialista / Consultora)', roleTitle: 'Especialista de Servicio y Atención', commissionPct: 40, totalDayGross: 150000, phone: '3168899001' }
      ],
      workOrders: [
        { id: 'ot-842', code: 'OT-2026-0842', customerId: 'cust-2', vehicleId: 'veh-1', workerId: 'wrk-1', kanbanStage: 'En Reparación', state: 'Pendiente', mileage: 42850, notes: 'Nivel combustible 1/2 tanque. Revisión inyectores y cambio aceite.', servicesList: [{ description: 'Mantenimiento Preventivo 40.000 Km + Escáner', price: 220000 }, { description: 'Calibración y Limpieza Ultrasonido Inyectores', price: 160000 }], createdAt: '2026-11-05' },
        { id: 'ot-843', code: 'OT-2026-0843', customerId: 'cust-3', vehicleId: 'veh-3', workerId: 'wrk-2', kanbanStage: 'Listo para Entrega', state: 'Pendiente', mileage: 14900, notes: 'Deja casco en recepción. Cambio pastillas y sincronización.', servicesList: [{ description: 'Sincronización General e Inyección Electrónica', price: 140000 }, { description: 'Instalación Pastillas de Freno y Purga Líquido', price: 60000 }], createdAt: '2026-11-05' },
        { id: 'ot-844', code: 'OT-2026-0844', customerId: 'cust-1', vehicleId: 'veh-2', workerId: 'wrk-1', kanbanStage: 'En Diagnóstico', state: 'Pendiente', mileage: 184200, notes: 'Ingreso a bahía pesada para diagnóstico eléctrico.', servicesList: [{ description: 'Diagnóstico Computarizado Sistema Eléctrico 24V', price: 180000 }], createdAt: '2026-11-05' }
      ],
      invoices: [
        {
          id: 'inv-10421', invoiceNumber: 'FEV-10421', date: '2026-11-05',
          customerId: 'cust-1', customerName: 'Comercializadora del Valle S.A.S.', customerNit: '901452110-4', customerPhone: '3104458890',
          contractId: 'cnt-0084', vehicleId: 'veh-2', vehiclePlate: 'WXY-812', workerId: 'wrk-1', workerName: 'Ing. Mauricio Castaño (Líder Técnico)',
          items: [{ productId: 'prd-1', sku: '7701001', name: 'Aceite Sintético 10W-40 Alto Rendimiento (Galón)', qty: 2, unitCost: 95000, unitPrice: 145000, subtotal: 290000 }, { productId: 'prd-2', sku: '7701002', name: 'Kit Pastillas de Freno Cerámicas Delanteras', qty: 1, unitCost: 110000, unitPrice: 185000, subtotal: 185000 }],
          services: [{ description: 'Mantenimiento Preventivo y Revisión de Frenos', price: 250000 }],
          subtotalProducts: 475000, subtotalServices: 250000, discountAmount: 0, total: 725000,
          paymentMethod: 'Crédito / Cartera CxC', paidAmount: 300000, pendingBalance: 425000,
          paymentNotes: 'Abono inicial transferencia $300.000 — Saldo a 30 días', glosaStatus: 'SIN_GLOSA',
          abonosHistory: [{ id: 'rc-001', date: '2026-11-05', amount: 300000, method: 'Transferencia', notes: 'Anticipo inicial' }]
        },
        {
          id: 'inv-10422', invoiceNumber: 'POS-9001', date: '2026-11-05',
          customerId: 'cust-2', customerName: 'Inversiones y Transportes del Norte S.A.S.', customerNit: '900812441-9', customerPhone: '3157782210',
          contractId: 'cnt-0112', vehicleId: 'veh-1', vehiclePlate: 'KLM-482', workerId: 'wrk-2', workerName: 'Julián David Torres (Técnico A)',
          items: [{ productId: 'prd-4', sku: '7701004', name: 'Batería Sellada Libre Mantenimiento 800 Amp', qty: 1, unitCost: 310000, unitPrice: 460000, subtotal: 460000 }],
          services: [{ description: 'Instalación de Batería y Prueba de Alternador', price: 90000 }],
          subtotalProducts: 460000, subtotalServices: 90000, discountAmount: 0, total: 550000,
          paymentMethod: 'Efectivo', paidAmount: 550000, pendingBalance: 0,
          paymentNotes: 'Pagado de contado en caja principal', glosaStatus: 'SIN_GLOSA',
          abonosHistory: []
        }
      ],
      kardexMovements: [
        { id: 'kdx-1', date: '2026-11-05', productId: 'prd-1', sku: '7701001', productName: 'Aceite Sintético 10W-40 Alto Rendimiento (Galón)', warehouseName: 'Bodega Central Principal', type: 'ENTRADA_COMPRA', qty: 30, unitCost: 95000, balanceAfter: 30, referenceDoc: 'ACT-REC-2026-118 (FE-99412)' },
        { id: 'kdx-2', date: '2026-11-05', productId: 'prd-1', sku: '7701001', productName: 'Aceite Sintético 10W-40 Alto Rendimiento (Galón)', warehouseName: 'Bodega Central Principal', type: 'SALIDA_VENTA', qty: 2, unitCost: 95000, balanceAfter: 28, referenceDoc: 'FEV-10421' },
        { id: 'kdx-3', date: '2026-11-05', productId: 'prd-4', sku: '7701004', productName: 'Batería Sellada Libre Mantenimiento 800 Amp', warehouseName: 'Bodega Norte Punto de Venta', type: 'SALIDA_VENTA', qty: 1, unitCost: 310000, balanceAfter: 9, referenceDoc: 'POS-9001' }
      ],
      expenses: [
        { id: 'exp-1', date: '2026-11-05', description: 'Compra desengrasante biodegradable e insumos de bahía', category: 'Insumos Operativos', paymentMethod: 'Efectivo', amount: 68000 },
        { id: 'exp-2', date: '2026-11-05', description: 'Flete motorizado mensajería repuestos urgentes', category: 'Transporte / Fletes', paymentMethod: 'Efectivo', amount: 35000 }
      ],
      settlements: [
        { id: 'stl-1', date: '2026-11-04', workerId: 'wrk-1', workerName: 'Ing. Mauricio Castaño (Líder Técnico)', grossAmount: 680000, commissionPct: 50, paidAmount: 340000, companyShare: 340000, notes: 'Liquidación turno anterior pagada sin novedades' }
      ],
      diningTables: [
        { id: 'tbl-1', code: 'MESA-05', zone: 'Terraza Principal', waiterName: 'Mateo Ríos', status: 'OCUPADA_COMANDA', items: [{ productId: 'prd-1', sku: '7701001', name: 'Combo Parrilla / Servicio Especial', qty: 2, price: 95000 }] },
        { id: 'tbl-2', code: 'MESA-08', zone: 'Salón VIP', waiterName: 'Laura Gómez', status: 'LIBRE', items: [] },
        { id: 'tbl-3', code: 'BARRA-02', zone: 'Barra Central', waiterName: 'Mateo Ríos', status: 'OCUPADA_COMANDA', items: [{ productId: 'prd-3', sku: '7701003', name: 'Reserva Botella / Picada', qty: 1, price: 185000 }] }
      ]
    };
  }

  function pkCalcNitDv(nitRaw) {
    var clean = String(nitRaw || '').replace(/\\D/g, '');
    if (!clean) return '0';
    var weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
    var sum = 0;
    for (var i = 0; i < clean.length && i < weights.length; i++) {
      sum += parseInt(clean.charAt(clean.length - 1 - i), 10) * weights[i];
    }
    var rem = sum % 11;
    return String(rem > 1 ? 11 - rem : rem);
  }

  function pkGetRelDb() {
    if (!STATE.relDb) STATE.relDb = pkCreateInitialRelationalDb();
    return STATE.relDb;
  }

  function pkGetCustomerById(id) {
    var list = pkGetRelDb().customers || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function pkGetVehicleById(id) {
    var list = pkGetRelDb().vehicles || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function pkGetWorkerById(id) {
    var list = pkGetRelDb().workers || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function pkGetProductById(id) {
    var list = pkGetRelDb().products || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function pkGetContractById(id) {
    var list = pkGetRelDb().contracts || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function pkGetTariffById(id) {
    var list = pkGetRelDb().tariffs || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function pkGetVehicleAlertsList(veh) {
    if (!veh) return [];
    var alerts = [];
    var curKm = Number(veh.currentMileage || 0);
    var nextKm = Number(veh.nextOilChangeKm || 0);
    if (curKm > 0 && nextKm > 0) {
      if (curKm >= nextKm) alerts.push('⚠️ Cambio de aceite VENCIDO (' + curKm.toLocaleString('es-CO') + ' / ' + nextKm.toLocaleString('es-CO') + ' km)');
      else if (nextKm - curKm <= 500) alerts.push('🔔 Próximo cambio de aceite en ' + (nextKm - curKm) + ' km');
    }
    var today = '2026-11-05';
    if (veh.soatDueDate && veh.soatDueDate <= today) alerts.push('🚨 SOAT VENCIDO (' + veh.soatDueDate + ')');
    if (veh.tecnoDueDate && veh.tecnoDueDate <= today) alerts.push('🚨 Tecnomecánica VENCIDA (' + veh.tecnoDueDate + ')');
    return alerts;
  }

  function pkPersistRelTransaction(actionType, entityPayload) {
    if (pkIsDemoMode()) {
      pkSaveDemoToLocalStorage();
      return;
    }
    var cl = pkGetActiveClient();
    if (!cl || !cl.dbName) return;
    fetch('/api/v1/client-workspace/transaction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dbName: cl.dbName,
        actionType: actionType || 'SYNC_STATE',
        entityPayload: entityPayload || {},
        fullRelationalState: pkGetRelDb()
      })
    }).catch(function() {});
  }

  function pkDownloadCsv(filename, headers, rows) {
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
