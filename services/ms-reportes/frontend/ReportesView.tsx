import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkAutoCodeInput,
  PkSimpleSelect,
  PkPrintButton,
  PkKpiRow,
  PkLiveHeader,
  PkTicketCard,
  PkProcessNodes,
  PkTypeCards,
  PkFullscreenDialog,
  PkProgressBar,
  PkDistributionStrip,
  useAsyncAction,
  downloadCsvUtf8,
  formatCop,
} from '@platform/ui-sdk';

interface ExecutiveSnapshot {
  id: string;
  code: string;
  totalSales: number;
  totalCollected: number;
  totalPendingReceivables: number;
  totalExpenses: number;
  netOperatingProfit: number;
  inventoryCostValue: number;
  inventorySaleValue: number;
  lowStockCount: number;
  customersCount: number;
  notes: string;
  createdBy: string;
  createdAt: string;
}

interface ExecutiveApiResponse {
  ok: boolean;
  nextCode?: string;
  nextSnapshotCode?: string;
  totalSales: number;
  totalCollected: number;
  totalPendingReceivables: number;
  totalExpenses: number;
  netOperatingProfit: number;
  inventoryCostValue: number;
  inventorySaleValue: number;
  lowStockCount: number;
  customersCount: number;
  snapshots?: ExecutiveSnapshot[];
}

interface RemoteInvoice {
  id: string;
  code?: string;
  date?: string;
  createdAt?: string;
  customerName: string;
  customerNit?: string;
  paymentMethod?: string;
  subtotal?: number;
  taxTotal?: number;
  total: number;
  amountPaid: number;
  pendingBalance: number;
  status?: string;
}

interface RemoteExpense {
  id: string;
  code?: string;
  date?: string;
  createdAt?: string;
  category: string;
  description: string;
  paymentSource?: string;
  responsible?: string;
  amount: number;
}

interface RemoteProduct {
  id: string;
  code: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  costPrice: number;
  salePrice: number;
  lotCode?: string;
}

interface RemoteCustomer {
  id: string;
  name: string;
  nit: string;
  balance?: number;
}

interface ConsolidatedState {
  totalSales: number;
  totalCollected: number;
  cashCollected: number;
  digitalCollected: number;
  totalPendingReceivables: number;
  totalExpenses: number;
  netOperatingProfit: number;
  inventoryCostValue: number;
  inventorySaleValue: number;
  lowStockCount: number;
  customersCount: number;
  invoices: RemoteInvoice[];
  expenses: RemoteExpense[];
  products: RemoteProduct[];
}

const INVOICE_FILTER_OPTIONS = [
  { value: '', label: 'Todas las facturas del periodo' },
  { value: 'paid', label: 'Facturas pagadas (Saldo $0)' },
  { value: 'pending', label: 'Con cartera pendiente por cobrar (CxC)' },
];

const STOCK_FILTER_OPTIONS = [
  { value: '', label: 'Todo el catálogo valorizado' },
  { value: 'low', label: 'Solo alertas de stock bajo mínimo' },
  { value: 'optimal', label: 'Solo referencias en nivel óptimo' },
];

const SNAPSHOT_TYPE_CARDS = [
  {
    key: 'turno',
    icon: '📊',
    title: 'Corte Operativo de Turno / Día',
    description: 'Congela ventas, recaudos en efectivo/digital, egresos de caja y alertas activas del día.',
    badge: 'Diario',
  },
  {
    key: 'mensual',
    icon: '🏛️',
    title: 'Balance Ejecutivo de Gerencia',
    description: 'Estado consolidado de resultados operativos, utilidad neta y rotación de cartera para junta.',
    badge: 'Junta',
  },
  {
    key: 'auditoria',
    icon: '🔍',
    title: 'Auditoría de Cartera e Inventario',
    description: 'Instantánea de control interno sobre capital en inventario valorizado y cuentas por cobrar.',
    badge: 'Control',
  },
];

export const ReportesView: React.FC = () => {
  const { apiGet, apiPost, toast, hasService } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [activePill, setActivePill] = useState<string>('vision_360');
  const [displayMode, setDisplayMode] = useState<'board' | 'table'>('board');
  const [snapshotStudioOpen, setSnapshotStudioOpen] = useState(false);
  const [snapshotTypeKey, setSnapshotTypeKey] = useState<string>('turno');

  const [nextSnapshotCode, setNextSnapshotCode] = useState('RPT-801');
  const [snapshots, setSnapshots] = useState<ExecutiveSnapshot[]>([]);
  const [snapshotNotes, setSnapshotNotes] = useState('Cierre ejecutivo consolidado del turno');
  const [invoiceFilter, setInvoiceFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');

  const [report, setReport] = useState<ConsolidatedState>({
    totalSales: 0,
    totalCollected: 0,
    cashCollected: 0,
    digitalCollected: 0,
    totalPendingReceivables: 0,
    totalExpenses: 0,
    netOperatingProfit: 0,
    inventoryCostValue: 0,
    inventorySaleValue: 0,
    lowStockCount: 0,
    customersCount: 0,
    invoices: [],
    expenses: [],
    products: [],
  });

  const hasFacturacion = hasService('ms-facturacion');
  const hasCaja = hasService('ms-caja');
  const hasInventario = hasService('ms-inventario');
  const hasClientes = hasService('ms-clientes');

  const reload = useCallback(async () => {
    const [execRes, posRes, cajaRes, invRes, cliRes] = await Promise.allSettled([
      apiGet<ExecutiveApiResponse>('/api/v1/reportes/executive'),
      hasFacturacion
        ? apiGet<{ invoices?: RemoteInvoice[] }>('/api/v1/facturacion/pos-state')
        : Promise.resolve(null),
      hasCaja
        ? apiGet<{
            cashIncomes?: number;
            digitalIncomes?: number;
            totalExpenses?: number;
            expenses?: RemoteExpense[];
          }>('/api/v1/caja/summary')
        : Promise.resolve(null),
      hasInventario
        ? apiGet<{ products?: RemoteProduct[] }>('/api/v1/inventario/all')
        : Promise.resolve(null),
      hasClientes
        ? apiGet<{ customers?: RemoteCustomer[] }>('/api/v1/clientes/all')
        : Promise.resolve(null),
    ]);

    const execData = execRes.status === 'fulfilled' ? execRes.value : null;
    if (execData) {
      setNextSnapshotCode(execData.nextSnapshotCode || execData.nextCode || 'RPT-801');
      setSnapshots(execData.snapshots || []);
    }

    const livePos = posRes.status === 'fulfilled' && posRes.value ? posRes.value : null;
    const liveCaja = cajaRes.status === 'fulfilled' && cajaRes.value ? cajaRes.value : null;
    const liveInv = invRes.status === 'fulfilled' && invRes.value ? invRes.value : null;
    const liveCli = cliRes.status === 'fulfilled' && cliRes.value ? cliRes.value : null;

    const anyLiveSource = Boolean(livePos || liveCaja || liveInv || liveCli);

    if (!anyLiveSource && execData) {
      const col = execData.totalCollected || 0;
      setReport({
        totalSales: execData.totalSales || 0,
        totalCollected: col,
        cashCollected: Math.round(col * 0.55),
        digitalCollected: Math.max(0, col - Math.round(col * 0.55)),
        totalPendingReceivables: execData.totalPendingReceivables || 0,
        totalExpenses: execData.totalExpenses || 0,
        netOperatingProfit: execData.netOperatingProfit || 0,
        inventoryCostValue: execData.inventoryCostValue || 0,
        inventorySaleValue: execData.inventorySaleValue || 0,
        lowStockCount: execData.lowStockCount || 0,
        customersCount: execData.customersCount || 0,
        invoices: [],
        expenses: [],
        products: [],
      });
      return;
    }

    const invoices = livePos?.invoices || [];
    const expenses = liveCaja?.expenses || [];
    const products = liveInv?.products || [];
    const customers = liveCli?.customers || [];

    const totalSales = invoices.reduce((acc, inv) => acc + Number(inv.total || 0), 0);
    const invoiceCollected = invoices.reduce((acc, inv) => acc + Number(inv.amountPaid || 0), 0);
    const invoiceReceivables = invoices.reduce((acc, inv) => acc + Number(inv.pendingBalance || 0), 0);

    const rawCash = Number(liveCaja?.cashIncomes || 0);
    const rawDigital = Number(liveCaja?.digitalIncomes || 0);
    const cajaIncomes = rawCash + rawDigital;
    const totalCollected = livePos ? invoiceCollected : cajaIncomes;

    let cashCollected = rawCash;
    let digitalCollected = rawDigital;
    if (cashCollected + digitalCollected <= 0 && totalCollected > 0) {
      for (const inv of invoices) {
        const paid = Number(inv.amountPaid || 0);
        const pm = (inv.paymentMethod || '').toLowerCase();
        if (pm.includes('transfer') || pm.includes('tarjeta') || pm.includes('nequi') || pm.includes('digital')) {
          digitalCollected += paid;
        } else {
          cashCollected += paid;
        }
      }
    }

    const customerReceivables = customers.reduce((acc, c) => acc + Math.max(0, Number(c.balance || 0)), 0);
    const totalPendingReceivables = livePos ? invoiceReceivables : customerReceivables;

    const totalExpenses =
      liveCaja && typeof liveCaja.totalExpenses === 'number'
        ? liveCaja.totalExpenses
        : expenses.reduce((acc, exp) => acc + Number(exp.amount || 0), 0);

    let inventoryCostValue = 0;
    let inventorySaleValue = 0;
    let lowStockCount = 0;
    for (const p of products) {
      const stk = Number(p.stock || 0);
      const minStk = Number(p.minStock || 0);
      inventoryCostValue += Number(p.costPrice || 0) * stk;
      inventorySaleValue += Number(p.salePrice || 0) * stk;
      if (stk <= minStk) {
        lowStockCount += 1;
      }
    }

    const netOperatingProfit = totalSales - totalExpenses;

    setReport({
      totalSales,
      totalCollected,
      cashCollected,
      digitalCollected,
      totalPendingReceivables,
      totalExpenses,
      netOperatingProfit,
      inventoryCostValue,
      inventorySaleValue,
      lowStockCount,
      customersCount: customers.length,
      invoices,
      expenses,
      products,
    });
  }, [apiGet, hasFacturacion, hasCaja, hasInventario, hasClientes]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const todayStamp = new Date().toISOString().slice(0, 10);

  const handleSelectSnapshotType = (key: string) => {
    setSnapshotTypeKey(key);
    if (key === 'turno') {
      setSnapshotNotes('Cierre ejecutivo consolidado del turno operativo');
    } else if (key === 'mensual') {
      setSnapshotNotes('Balance gerencial consolidado para comité directivo');
    } else {
      setSnapshotNotes('Auditoría interna de cartera CxC e inventario valorizado');
    }
  };

  const handleSaveSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      try {
        const res = await apiPost<{ ok: boolean; snapshot: ExecutiveSnapshot }>('/api/v1/reportes/snapshots', {
          totalSales: report.totalSales,
          totalCollected: report.totalCollected,
          totalPendingReceivables: report.totalPendingReceivables,
          totalExpenses: report.totalExpenses,
          netOperatingProfit: report.netOperatingProfit,
          inventoryCostValue: report.inventoryCostValue,
          inventorySaleValue: report.inventorySaleValue,
          lowStockCount: report.lowStockCount,
          customersCount: report.customersCount,
          notes: snapshotNotes.trim() || 'Corte ejecutivo consolidado',
        });
        toast(`Corte ejecutivo ${res.snapshot.code} almacenado en histórico`);
        setSnapshotStudioOpen(false);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible guardar el corte ejecutivo');
      }
    });
  };

  const handleExportSalesCsv = () => {
    downloadCsvUtf8(
      `reporte_ventas_${todayStamp}.csv`,
      [
        'Factura',
        'Fecha',
        'Cliente',
        'NIT',
        'Medio de Pago',
        'Subtotal',
        'Impuestos',
        'Total Factura',
        'Recaudado',
        'Saldo Cartera CxC',
        'Estado',
      ],
      report.invoices.map((inv) => [
        inv.code || inv.id,
        inv.date || inv.createdAt || '',
        inv.customerName,
        inv.customerNit || '',
        inv.paymentMethod || 'Contado',
        inv.subtotal ?? inv.total,
        inv.taxTotal ?? 0,
        inv.total,
        inv.amountPaid,
        inv.pendingBalance,
        inv.status || (inv.pendingBalance > 0 ? 'Pendiente' : 'Pagada'),
      ])
    );
    toast('Archivo CSV UTF-8 de Ventas descargado correctamente');
  };

  const handleExportInventoryCsv = () => {
    downloadCsvUtf8(
      `reporte_inventario_valorizado_${todayStamp}.csv`,
      [
        'Código',
        'Producto',
        'Categoría',
        'Stock Actual',
        'Stock Mínimo',
        'Costo Unitario',
        'Precio Venta',
        'Margen Unitario',
        'Valorizado Costo',
        'Valorizado Venta',
        'Lote',
      ],
      report.products.map((p) => [
        p.code,
        p.name,
        p.category,
        p.stock,
        p.minStock,
        p.costPrice,
        p.salePrice,
        p.salePrice - p.costPrice,
        p.costPrice * p.stock,
        p.salePrice * p.stock,
        p.lotCode || '',
      ])
    );
    toast('Archivo CSV UTF-8 de Inventario Valorizado descargado');
  };

  const handleExportExpensesCsv = () => {
    downloadCsvUtf8(
      `reporte_egresos_operativos_${todayStamp}.csv`,
      ['Consecutivo', 'Fecha', 'Categoría', 'Concepto', 'Origen Fondos', 'Responsable', 'Valor'],
      report.expenses.map((exp) => [
        exp.code || exp.id,
        exp.date || exp.createdAt || '',
        exp.category,
        exp.description,
        exp.paymentSource || 'Caja',
        exp.responsible || 'Operación',
        exp.amount,
      ])
    );
    toast('Archivo CSV UTF-8 de Egresos Operativos descargado');
  };

  const handleExportSnapshotsCsv = () => {
    downloadCsvUtf8(
      `reporte_cortes_historicos_${todayStamp}.csv`,
      [
        'Corte',
        'Fecha',
        'Ventas Totales',
        'Recaudo Efectivo',
        'Cartera CxC',
        'Egresos Operativos',
        'Utilidad Operativa',
        'Inventario Costo',
        'Inventario Venta',
        'Alertas Stock',
        'Observaciones',
      ],
      snapshots.map((s) => [
        s.code,
        s.createdAt,
        s.totalSales,
        s.totalCollected,
        s.totalPendingReceivables,
        s.totalExpenses,
        s.netOperatingProfit,
        s.inventoryCostValue,
        s.inventorySaleValue,
        s.lowStockCount,
        s.notes,
      ])
    );
    toast('Archivo CSV UTF-8 de Cortes Ejecutivos descargado');
  };

  const buildBalancePrintPayload = (
    docNum: string,
    issueDate: string,
    kpi: {
      totalSales: number;
      totalCollected: number;
      totalPendingReceivables: number;
      totalExpenses: number;
      netOperatingProfit: number;
      inventoryCostValue: number;
      inventorySaleValue: number;
      lowStockCount: number;
      notes?: string;
    }
  ): Record<string, unknown> => ({
    document_type: 'BALANCE EJECUTIVO Y ESTADO GERENCIAL',
    layout_variant: 'carta_membrete',
    document_number: docNum,
    issue_date: issueDate,
    customer_name: 'Informe Consolidado de Gerencia y Operaciones',
    payment_method: 'Consolidación Multi-Servicio',
    extra_fields: {
      'Ventas Totales Facturadas': formatCop(kpi.totalSales),
      'Recaudo Efectivo Ingresado': formatCop(kpi.totalCollected),
      'Cartera Pendiente por Cobrar': formatCop(kpi.totalPendingReceivables),
      'Egresos Operativos': formatCop(kpi.totalExpenses),
      'Inventario a Costo': formatCop(kpi.inventoryCostValue),
      'Inventario a Precio Venta': formatCop(kpi.inventorySaleValue),
      'Alertas Stock Mínimo': `${kpi.lowStockCount} referencias`,
    },
    items: [
      {
        code: 'KPI-VEN',
        description: 'Ingresos Operacionales Consolidados por Ventas',
        quantity: 1,
        unit_price: kpi.totalSales,
        subtotal: kpi.totalSales,
      },
      {
        code: 'KPI-EGR',
        description: 'Menos: Egresos y Gastos Operativos Registrados',
        quantity: 1,
        unit_price: -kpi.totalExpenses,
        subtotal: -kpi.totalExpenses,
      },
    ],
    subtotal: kpi.totalSales,
    discount_total: kpi.totalExpenses,
    grand_total: kpi.netOperatingProfit,
    pending_balance: kpi.totalPendingReceivables,
    notes:
      kpi.notes ||
      `Utilidad bruta potencial estimada sobre inventario valorizado: ${formatCop(
        kpi.inventorySaleValue - kpi.inventoryCostValue
      )}.`,
  });

  const livePrintPayload = buildBalancePrintPayload(
    `BAL-${todayStamp}`,
    new Date().toISOString().slice(0, 16).replace('T', ' '),
    report
  );

  const filteredInvoices = report.invoices.filter((inv) => {
    if (invoiceFilter === 'paid') return inv.pendingBalance <= 0;
    if (invoiceFilter === 'pending') return inv.pendingBalance > 0;
    return true;
  });

  const filteredProducts = report.products.filter((p) => {
    const isLow = p.stock <= p.minStock;
    if (stockFilter === 'low') return isLow;
    if (stockFilter === 'optimal') return !isLow;
    return true;
  });

  const collectionRatePct =
    report.totalSales > 0 ? Math.min(100, (report.totalCollected / report.totalSales) * 100) : 100;
  const operatingMarginPct =
    report.totalSales > 0 ? Math.max(0, Math.min(100, (report.netOperatingProfit / report.totalSales) * 100)) : 0;
  const optimalStockPct =
    report.products.length > 0
      ? ((report.products.length - report.lowStockCount) / report.products.length) * 100
      : 100;

  const clientLeaderboard = useMemo(() => {
    const map = new Map<string, { name: string; billed: number; paid: number; pending: number }>();
    for (const inv of report.invoices) {
      const key = inv.customerName || 'Cliente Mostrador';
      const cur = map.get(key) || { name: key, billed: 0, paid: 0, pending: 0 };
      cur.billed += Number(inv.total || 0);
      cur.paid += Number(inv.amountPaid || 0);
      cur.pending += Number(inv.pendingBalance || 0);
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.billed - a.billed)
      .slice(0, 5);
  }, [report.invoices]);

  return (
    <ModuleGate module="centro_reportes">
      <div className="pk-stack">
        <PkLiveHeader
          title="Centro de Inteligencia y Analítica Ejecutiva"
          liveLabel=" Consolidado en tiempo real"
          subtitle="Tablero gerencial multi-servicio de ventas, recaudo efectivo, cartera CxC, inventario valorizado y cortes auditables."
          pills={[
            { key: 'vision_360', label: '🌐 Visión 360°', count: snapshots.length },
            { key: 'comercial_cartera', label: '💳 Comercial y Cartera', count: report.invoices.length },
            { key: 'inventario_operacion', label: '📦 Inventario y Operación', count: report.products.length },
          ]}
          activePill={activePill}
          onPillChange={setActivePill}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          boardLabel="🎛️ Lienzo Ejecutivo"
          tableLabel="📋 Tablas Detalladas"
          primaryActionLabel="+ Generar Corte Gerencial"
          onPrimaryAction={() => setSnapshotStudioOpen(true)}
          extraActions={
            <>
              <button type="button" className="pk-btn pk-btn-outline" onClick={() => void reload()}>
                🔄 Actualizar
              </button>
              <PkPrintButton label="🖨️ Balance PDF" payload={livePrintPayload} variant="primary" />
            </>
          }
        />

        <PkKpiRow
          items={[
            { label: 'Ventas Totales', value: formatCop(report.totalSales), color: 'var(--pk-primary)' },
            { label: 'Recaudo Efectivo', value: formatCop(report.totalCollected), color: 'var(--pk-emerald)' },
            {
              label: 'Cartera por Cobrar',
              value: formatCop(report.totalPendingReceivables),
              color: 'var(--pk-amber)',
            },
            { label: 'Egresos Operativos', value: formatCop(report.totalExpenses), color: 'var(--pk-rose)' },
            {
              label: 'Utilidad Operativa',
              value: formatCop(report.netOperatingProfit),
              color: report.netOperatingProfit >= 0 ? 'var(--pk-emerald)' : 'var(--pk-rose)',
            },
            { label: 'Inventario (Costo)', value: formatCop(report.inventoryCostValue), color: '#0f172a' },
          ]}
        />

        <div className="pk-card">
          <div className="pk-card-head" style={{ background: '#ffffff' }}>
            <div style={{ fontSize: 13, color: '#475569' }}>
              Valor comercial inventario: <strong>{formatCop(report.inventorySaleValue)}</strong> · Alertas bajo
              mínimo: <strong>{report.lowStockCount}</strong> · Clientes consolidados:{' '}
              <strong>{report.customersCount}</strong>
            </div>
            <div className="pk-row-actions">
              <button type="button" className="pk-btn pk-btn-emerald pk-btn-sm" onClick={handleExportSalesCsv}>
                📥 CSV Ventas
              </button>
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportInventoryCsv}>
                📥 CSV Inventario
              </button>
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportExpensesCsv}>
                📥 CSV Egresos
              </button>
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportSnapshotsCsv}>
                📥 CSV Cortes
              </button>
            </div>
          </div>
        </div>

        {(activePill === 'vision_360' || activePill === 'comercial_cartera') && (
          <div className="pk-grid-2">
            <PkDistributionStrip
              title="Mix de Liquidez y Cartera: Efectivo vs Digital vs Cuentas por Cobrar (CxC)"
              segments={[
                {
                  label: 'Efectivo en Caja',
                  value: Math.max(report.cashCollected, 0),
                  displayValue: formatCop(report.cashCollected),
                  color: '#10b981',
                },
                {
                  label: 'Canales Digitales / Bancos',
                  value: Math.max(report.digitalCollected, 0),
                  displayValue: formatCop(report.digitalCollected),
                  color: '#0284c7',
                },
                {
                  label: 'Cartera CxC Pendiente',
                  value: Math.max(report.totalPendingReceivables, 0),
                  displayValue: formatCop(report.totalPendingReceivables),
                  color: '#f59e0b',
                },
              ]}
            />

            <PkDistributionStrip
              title="Estructura Financiera: Recaudo Ingresado vs Egresos vs Capital en Inventario"
              segments={[
                {
                  label: 'Recaudo Efectivo Total',
                  value: Math.max(report.totalCollected, 0),
                  displayValue: formatCop(report.totalCollected),
                  color: '#10b981',
                },
                {
                  label: 'Egresos Operativos',
                  value: Math.max(report.totalExpenses, 0),
                  displayValue: formatCop(report.totalExpenses),
                  color: '#ef4444',
                },
                {
                  label: 'Inventario Valorizado (Venta)',
                  value: Math.max(report.inventorySaleValue, 0),
                  displayValue: formatCop(report.inventorySaleValue),
                  color: '#8b5cf6',
                },
              ]}
            />
          </div>
        )}

        {activePill === 'vision_360' && (
          <div className="pk-grid-3">
            <div className="pk-card">
              <div className="pk-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--pk-muted)', textTransform: 'uppercase' }}>
                  Salud de Recaudo Efectivo
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--pk-navy)' }}>
                  {collectionRatePct.toFixed(1)}%
                </div>
                <PkProgressBar
                  label="Facturación convertida en caja"
                  valueLabel={formatCop(report.totalCollected)}
                  pct={collectionRatePct}
                  tone="emerald"
                />
              </div>
            </div>

            <div className="pk-card">
              <div className="pk-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--pk-muted)', textTransform: 'uppercase' }}>
                  Margen Operativo Consolidado
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: report.netOperatingProfit >= 0 ? 'var(--pk-emerald)' : 'var(--pk-rose)',
                  }}
                >
                  {formatCop(report.netOperatingProfit)}
                </div>
                <PkProgressBar
                  label="Rentabilidad sobre ingresos"
                  valueLabel={`${operatingMarginPct.toFixed(1)}%`}
                  pct={operatingMarginPct}
                  tone={report.netOperatingProfit >= 0 ? 'blue' : 'rose'}
                />
              </div>
            </div>

            <div className="pk-card">
              <div className="pk-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--pk-muted)', textTransform: 'uppercase' }}>
                  Cobertura Óptima de Inventario
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--pk-navy)' }}>
                  {optimalStockPct.toFixed(0)}%
                </div>
                <PkProgressBar
                  label="Referencias sobre stock mínimo"
                  valueLabel={`${report.lowStockCount} alertas`}
                  pct={optimalStockPct}
                  tone={report.lowStockCount > 0 ? 'amber' : 'emerald'}
                />
              </div>
            </div>
          </div>
        )}

        {(activePill === 'vision_360' || activePill === 'comercial_cartera' || activePill === 'inventario_operacion') &&
          displayMode === 'board' && (
            <div className="pk-grid-2">
              {(activePill === 'vision_360' || activePill === 'comercial_cartera') && (
                <div className="pk-card">
                  <div className="pk-card-head">
                    <div className="pk-card-title">💳 Salud de Recaudo por Principales Clientes</div>
                    <span className="pk-badge pk-badge-blue">{clientLeaderboard.length} cuentas</span>
                  </div>
                  <div className="pk-card-body">
                    {clientLeaderboard.length === 0 ? (
                      <div style={{ color: 'var(--pk-muted)', fontSize: 13 }}>
                        Aún no se registran facturas consolidadas para graficar comportamiento por cliente.
                      </div>
                    ) : (
                      <div className="pk-stack" style={{ gap: 14 }}>
                        {clientLeaderboard.map((cli) => {
                          const paidPct = cli.billed > 0 ? (cli.paid / cli.billed) * 100 : 100;
                          return (
                            <div key={cli.name}>
                              <PkProgressBar
                                label={`${cli.name} · Facturado ${formatCop(cli.billed)}`}
                                valueLabel={
                                  cli.pending > 0
                                    ? `CxC: ${formatCop(cli.pending)} (${Math.round(paidPct)}% pagado)`
                                    : '100% Al día'
                                }
                                pct={paidPct}
                                tone={cli.pending > 0 ? 'amber' : 'emerald'}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(activePill === 'vision_360' || activePill === 'inventario_operacion') && (
                <div className="pk-card">
                  <div className="pk-card-head">
                    <div className="pk-card-title">📦 Termómetro de Abastecimiento por Producto</div>
                    <span className="pk-badge pk-badge-emerald">{report.products.length} SKU</span>
                  </div>
                  <div className="pk-card-body">
                    {report.products.length === 0 ? (
                      <div style={{ color: 'var(--pk-muted)', fontSize: 13 }}>
                        Sin referencias activas en el servicio de inventario.
                      </div>
                    ) : (
                      <div className="pk-stack" style={{ gap: 14 }}>
                        {report.products.slice(0, 6).map((p) => {
                          const targetOpt = Math.max(1, (p.minStock || 5) * 2.5);
                          const healthPct = Math.min(100, (p.stock / targetOpt) * 100);
                          const isLow = p.stock <= p.minStock;
                          return (
                            <div key={p.id}>
                              <PkProgressBar
                                label={`${p.code} · ${p.name}`}
                                valueLabel={`${p.stock} uds (Mín: ${p.minStock}) · ${formatCop(p.salePrice * p.stock)}`}
                                pct={healthPct}
                                tone={isLow ? 'rose' : 'emerald'}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

        {activePill === 'vision_360' && (
          displayMode === 'board' ? (
            <div className="pk-stack">
              <div className="pk-row-between">
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--pk-navy)' }}>
                  🗂️ Cortes Ejecutivos Históricos Auditados ({snapshots.length})
                </div>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  onClick={() => setSnapshotStudioOpen(true)}
                >
                  + Capturar Nuevo Corte ({nextSnapshotCode})
                </button>
              </div>
              {snapshots.length === 0 ? (
                <div className="pk-card">
                  <div className="pk-card-body" style={{ textAlign: 'center', padding: 36, color: 'var(--pk-muted)' }}>
                    Aún no se han guardado cortes gerenciales históricos. Haz clic en "+ Generar Corte Gerencial".
                  </div>
                </div>
              ) : (
                <div className="pk-cards-showcase">
                  {snapshots.map((snap) => (
                    <PkTicketCard
                      key={snap.id}
                      code={`#${snap.code}`}
                      timeAgo={snap.createdAt}
                      channelBadge={{
                        label: snap.netOperatingProfit >= 0 ? 'Superávit Operativo' : 'Déficit Operativo',
                        tone: snap.netOperatingProfit >= 0 ? 'emerald' : 'coral',
                      }}
                      title={snap.notes || 'Corte Ejecutivo Consolidado'}
                      subtitle={`Clientes: ${snap.customersCount} · Alertas Stock: ${snap.lowStockCount}`}
                      items={[
                        { name: 'Ventas Facturadas', amount: formatCop(snap.totalSales) },
                        { name: 'Recaudo Efectivo', amount: formatCop(snap.totalCollected) },
                        { name: 'Cartera CxC Pendiente', amount: formatCop(snap.totalPendingReceivables) },
                        { name: 'Egresos Operativos', amount: `-${formatCop(snap.totalExpenses)}` },
                      ]}
                      totalLabel="UTILIDAD OPERATIVA"
                      totalValue={formatCop(snap.netOperatingProfit)}
                      processNodes={[
                        { step: 1, label: '1. Consolidación', status: 'done' },
                        { step: 2, label: '2. Auditoría', status: 'done' },
                        { step: 3, label: '3. PDF Oficial', status: 'done' },
                      ]}
                      secondaryActions={
                        <PkPrintButton
                          label="🖨️ Imprimir Balance PDF"
                          payload={buildBalancePrintPayload(snap.code, snap.createdAt, snap)}
                          variant="primary"
                        />
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🗂️ Cortes Ejecutivos Históricos Almacenados ({snapshots.length})</div>
              </div>
              <div className="pk-card-body">
                <div className="pk-table-wrap">
                  <table className="pk-table">
                    <thead>
                      <tr>
                        <th>Corte</th>
                        <th>Fecha / Hora</th>
                        <th className="pk-num">Ventas</th>
                        <th className="pk-num">Recaudo</th>
                        <th className="pk-num">Cartera CxC</th>
                        <th className="pk-num">Egresos</th>
                        <th className="pk-num">Utilidad Operativa</th>
                        <th className="pk-num">Inv. Costo / Venta</th>
                        <th>Observación</th>
                        <th>PDF</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshots.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                            Sin cortes históricos almacenados.
                          </td>
                        </tr>
                      ) : (
                        snapshots.map((snap) => (
                          <tr key={snap.id}>
                            <td>
                              <span className="pk-badge pk-badge-blue">{snap.code}</span>
                            </td>
                            <td>{snap.createdAt}</td>
                            <td className="pk-num">{formatCop(snap.totalSales)}</td>
                            <td className="pk-num" style={{ color: 'var(--pk-emerald)' }}>
                              {formatCop(snap.totalCollected)}
                            </td>
                            <td className="pk-num" style={{ color: 'var(--pk-amber)' }}>
                              {formatCop(snap.totalPendingReceivables)}
                            </td>
                            <td className="pk-num" style={{ color: 'var(--pk-rose)' }}>
                              {formatCop(snap.totalExpenses)}
                            </td>
                            <td
                              className="pk-num"
                              style={{
                                fontWeight: 800,
                                color: snap.netOperatingProfit >= 0 ? 'var(--pk-emerald)' : 'var(--pk-rose)',
                              }}
                            >
                              {formatCop(snap.netOperatingProfit)}
                            </td>
                            <td className="pk-num">
                              <div>{formatCop(snap.inventoryCostValue)}</div>
                              <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                                Venta: {formatCop(snap.inventorySaleValue)}
                              </div>
                            </td>
                            <td>{snap.notes}</td>
                            <td>
                              <PkPrintButton
                                label="🖨️ PDF"
                                payload={buildBalancePrintPayload(snap.code, snap.createdAt, snap)}
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        )}

        {hasFacturacion && (displayMode === 'table' || activePill === 'comercial_cartera') && (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                🧾 Detalle Consolidado de Facturación y Cartera ({filteredInvoices.length})
              </div>
            </div>
            <div className="pk-datatable-toolbar">
              <div style={{ minWidth: 300 }}>
                <PkSimpleSelect
                  ariaLabel="Filtrar estado de facturas"
                  value={invoiceFilter}
                  onChange={setInvoiceFilter}
                  allowClear
                  placeholder="Todas las facturas del periodo"
                  options={INVOICE_FILTER_OPTIONS}
                />
              </div>
              <span className="pk-badge pk-badge-slate">{filteredInvoices.length} facturas</span>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Factura</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Medio de Pago</th>
                      <th className="pk-num">Total Facturado</th>
                      <th className="pk-num">Recaudado</th>
                      <th className="pk-num">Saldo CxC</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                          Sin facturas emitidas para el criterio seleccionado.
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv) => (
                        <tr key={inv.id}>
                          <td>
                            <span className="pk-badge pk-badge-blue">{inv.code || inv.id}</span>
                          </td>
                          <td>{inv.date || inv.createdAt || '—'}</td>
                          <td style={{ fontWeight: 700 }}>{inv.customerName}</td>
                          <td>{inv.paymentMethod || 'Contado'}</td>
                          <td className="pk-num" style={{ fontWeight: 800 }}>
                            {formatCop(inv.total)}
                          </td>
                          <td className="pk-num" style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>
                            {formatCop(inv.amountPaid)}
                          </td>
                          <td
                            className="pk-num"
                            style={{
                              color: inv.pendingBalance > 0 ? 'var(--pk-amber)' : 'var(--pk-muted)',
                              fontWeight: inv.pendingBalance > 0 ? 800 : 500,
                            }}
                          >
                            {formatCop(inv.pendingBalance)}
                          </td>
                          <td>
                            <span
                              className={`pk-badge ${
                                inv.pendingBalance > 0 ? 'pk-badge-amber' : 'pk-badge-emerald'
                              }`}
                            >
                              {inv.status || (inv.pendingBalance > 0 ? 'Pendiente' : 'Pagada')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {hasInventario && (displayMode === 'table' || activePill === 'inventario_operacion') && (
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                📦 Valorización de Inventario y Alertas Bajo Mínimo ({filteredProducts.length})
              </div>
            </div>
            <div className="pk-datatable-toolbar">
              <div style={{ minWidth: 300 }}>
                <PkSimpleSelect
                  ariaLabel="Filtrar nivel de stock"
                  value={stockFilter}
                  onChange={setStockFilter}
                  allowClear
                  placeholder="Todo el catálogo valorizado"
                  options={STOCK_FILTER_OPTIONS}
                />
              </div>
              <span className="pk-badge pk-badge-slate">{filteredProducts.length} referencias</span>
            </div>
            <div className="pk-card-body">
              <div className="pk-table-wrap">
                <table className="pk-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Producto</th>
                      <th>Categoría</th>
                      <th className="pk-num">Stock</th>
                      <th className="pk-num">Costo Unit.</th>
                      <th className="pk-num">Precio Venta</th>
                      <th className="pk-num">Margen Unit.</th>
                      <th className="pk-num">Valorizado Costo</th>
                      <th className="pk-num">Valorizado Venta</th>
                      <th>Alerta Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}>
                          No hay referencias registradas para el filtro seleccionado.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const unitMargin = p.salePrice - p.costPrice;
                        const isLow = p.stock <= p.minStock;
                        return (
                          <tr key={p.id}>
                            <td>
                              <span className="pk-badge pk-badge-slate">{p.code}</span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{p.name}</td>
                            <td>{p.category}</td>
                            <td className="pk-num" style={{ fontWeight: 800 }}>
                              {p.stock}
                            </td>
                            <td className="pk-num">{formatCop(p.costPrice)}</td>
                            <td className="pk-num">{formatCop(p.salePrice)}</td>
                            <td className="pk-num" style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>
                              +{formatCop(unitMargin)}
                            </td>
                            <td className="pk-num" style={{ fontWeight: 700 }}>
                              {formatCop(p.costPrice * p.stock)}
                            </td>
                            <td className="pk-num" style={{ fontWeight: 800 }}>
                              {formatCop(p.salePrice * p.stock)}
                            </td>
                            <td>
                              <span className={`pk-badge ${isLow ? 'pk-badge-amber' : 'pk-badge-emerald'}`}>
                                {isLow ? `⚠️ Bajo mínimo (${p.minStock})` : 'Óptimo'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <PkFullscreenDialog
        open={snapshotStudioOpen}
        title="Estudio de Emisión y Archivo de Corte Ejecutivo"
        subtitle="Verifica las cifras consolidadas en tiempo real, clasifica el corte gerencial y archívalo con respaldo PDF."
        badge={{ label: nextSnapshotCode, tone: 'emerald' }}
        onClose={() => setSnapshotStudioOpen(false)}
        subheader={
          <PkTypeCards
            label="1. Alcance del Corte Gerencial"
            options={SNAPSHOT_TYPE_CARDS}
            value={snapshotTypeKey}
            onChange={handleSelectSnapshotType}
          />
        }
        footerLeft={
          <span className={`pk-badge ${report.netOperatingProfit >= 0 ? 'pk-badge-emerald' : 'pk-badge-rose'}`}>
            UTILIDAD OPERATIVA CONSOLIDADA: {formatCop(report.netOperatingProfit)}
          </span>
        }
        footerActions={
          <>
            <PkPrintButton
              label="🖨️ Previsualizar Balance PDF"
              payload={buildBalancePrintPayload(nextSnapshotCode, todayStamp, {
                ...report,
                notes: snapshotNotes,
              })}
            />
            <button
              type="button"
              className="pk-btn pk-btn-outline"
              onClick={() => setSnapshotStudioOpen(false)}
              disabled={busy}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="pk-snapshot-studio-form"
              className="pk-btn pk-btn-primary"
              disabled={busy}
            >
              {busy ? 'Archivando...' : '💾 Confirmar y Guardar Corte Histórico'}
            </button>
          </>
        }
      >
        <PkKpiRow
          items={[
            { label: 'Ventas Consolidadas', value: formatCop(report.totalSales), color: 'var(--pk-primary)' },
            { label: 'Recaudo Efectivo', value: formatCop(report.totalCollected), color: 'var(--pk-emerald)' },
            { label: 'Cartera CxC', value: formatCop(report.totalPendingReceivables), color: 'var(--pk-amber)' },
            { label: 'Egresos Operativos', value: formatCop(report.totalExpenses), color: 'var(--pk-rose)' },
          ]}
        />

        <PkDistributionStrip
          title="Composición de Ingresos que quedará congelada en el Corte"
          segments={[
            {
              label: 'Efectivo en Caja',
              value: Math.max(report.cashCollected, 0),
              displayValue: formatCop(report.cashCollected),
              color: '#10b981',
            },
            {
              label: 'Canales Digitales',
              value: Math.max(report.digitalCollected, 0),
              displayValue: formatCop(report.digitalCollected),
              color: '#0284c7',
            },
            {
              label: 'Saldo CxC Pendiente',
              value: Math.max(report.totalPendingReceivables, 0),
              displayValue: formatCop(report.totalPendingReceivables),
              color: '#f59e0b',
            },
          ]}
        />

        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">2. Acta y Observaciones del Cierre Gerencial</div>
          </div>
          <div className="pk-card-body">
            <form id="pk-snapshot-studio-form" onSubmit={handleSaveSnapshot} className="pk-form-grid cols-2">
              <PkAutoCodeInput label="Código de Corte" value={nextSnapshotCode} />
              <div className="pk-field">
                <label>Inventario Valorizado (Costo / Venta)</label>
                <input
                  readOnly
                  value={`${formatCop(report.inventoryCostValue)} costo · ${formatCop(report.inventorySaleValue)} venta`}
                />
              </div>
              <div className="pk-field pk-col-span-full">
                <label>Nota / Etiqueta Oficial del Corte *</label>
                <input
                  required
                  value={snapshotNotes}
                  onChange={(e) => setSnapshotNotes(e.target.value)}
                  placeholder="Ej: Cierre mensual auditado por gerencia"
                />
              </div>
            </form>
          </div>
        </div>
      </PkFullscreenDialog>
    </ModuleGate>
  );
};

export default ReportesView;
