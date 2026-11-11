import React, { useState, useEffect, useCallback } from 'react';
import {
  usePlatform,
  ModuleGate,
  PkAutoCodeInput,
  PkModal,
  PkPrintButton,
  PkKpiRow,
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

export const ReportesView: React.FC = () => {
  const { apiGet, apiPost, toast, hasService } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [nextSnapshotCode, setNextSnapshotCode] = useState('RPT-801');
  const [snapshots, setSnapshots] = useState<ExecutiveSnapshot[]>([]);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [snapshotNotes, setSnapshotNotes] = useState('Cierre ejecutivo consolidado del turno');

  const [report, setReport] = useState<ConsolidatedState>({
    totalSales: 0,
    totalCollected: 0,
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
      setReport({
        totalSales: execData.totalSales || 0,
        totalCollected: execData.totalCollected || 0,
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

    const cajaIncomes = Number(liveCaja?.cashIncomes || 0) + Number(liveCaja?.digitalIncomes || 0);
    const totalCollected = livePos ? invoiceCollected : cajaIncomes;

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
        setSnapshotModalOpen(false);
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
      ]),
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
      ]),
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
      ]),
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
      ]),
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
    },
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
        kpi.inventorySaleValue - kpi.inventoryCostValue,
      )}.`,
  });

  const livePrintPayload = buildBalancePrintPayload(
    `BAL-${todayStamp}`,
    new Date().toISOString().slice(0, 16).replace('T', ' '),
    report,
  );

  return (
    <ModuleGate module="centro_reportes">
      <PkKpiRow
        items={[
          { label: 'Ventas Totales', value: formatCop(report.totalSales), color: 'var(--pk-primary)' },
          { label: 'Recaudo Efectivo', value: formatCop(report.totalCollected), color: 'var(--pk-emerald)' },
          { label: 'Cartera por Cobrar', value: formatCop(report.totalPendingReceivables), color: 'var(--pk-amber)' },
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
        <div className="pk-card-head">
          <div>
            <div className="pk-card-title">📊 Centro Gerencial — Consolidación Ejecutiva, CSV UTF-8 y Balance PDF</div>
            <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
              Inventario a precio de venta: <strong>{formatCop(report.inventorySaleValue)}</strong> · Alertas bajo mínimo:{' '}
              <strong>{report.lowStockCount}</strong> · Clientes activos: <strong>{report.customersCount}</strong>
            </div>
          </div>
          <div className="pk-row-actions">
            <button
              type="button"
              className="pk-btn pk-btn-outline pk-btn-sm"
              onClick={() => setSnapshotModalOpen(true)}
            >
              💾 Guardar Corte ({nextSnapshotCode})
            </button>
            <button type="button" className="pk-btn pk-btn-emerald pk-btn-sm" onClick={handleExportSalesCsv}>
              📥 CSV Ventas
            </button>
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportInventoryCsv}>
              📥 CSV Inventario
            </button>
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportExpensesCsv}>
              📥 CSV Egresos
            </button>
            <PkPrintButton
              label="🖨️ Imprimir Balance Ejecutivo PDF"
              payload={livePrintPayload}
              variant="primary"
            />
          </div>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">🗂️ Cortes Ejecutivos Históricos Almacenados ({snapshots.length})</div>
          <div className="pk-row-actions">
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportSnapshotsCsv}>
              📥 CSV Histórico
            </button>
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void reload()}>
              🔄 Actualizar Consolidado
            </button>
          </div>
        </div>
        <div className="pk-card-body">
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Corte</th>
                  <th>Fecha / Hora</th>
                  <th>Ventas</th>
                  <th>Recaudo</th>
                  <th>Cartera CxC</th>
                  <th>Egresos</th>
                  <th>Utilidad Operativa</th>
                  <th>Inv. Costo / Venta</th>
                  <th>Observación</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                      Aún no se han guardado cortes históricos en el esquema gerencial.
                    </td>
                  </tr>
                ) : (
                  snapshots.map((snap) => (
                    <tr key={snap.id}>
                      <td><span className="pk-badge pk-badge-blue">{snap.code}</span></td>
                      <td>{snap.createdAt}</td>
                      <td style={{ fontWeight: 700 }}>{formatCop(snap.totalSales)}</td>
                      <td style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>{formatCop(snap.totalCollected)}</td>
                      <td style={{ color: 'var(--pk-amber)', fontWeight: 700 }}>
                        {formatCop(snap.totalPendingReceivables)}
                      </td>
                      <td style={{ color: 'var(--pk-rose)', fontWeight: 700 }}>{formatCop(snap.totalExpenses)}</td>
                      <td
                        style={{
                          fontWeight: 800,
                          color: snap.netOperatingProfit >= 0 ? 'var(--pk-emerald)' : 'var(--pk-rose)',
                        }}
                      >
                        {formatCop(snap.netOperatingProfit)}
                      </td>
                      <td>
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

      {hasFacturacion && (
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">🧾 Detalle Consolidado de Facturación y Cartera ({report.invoices.length})</div>
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
                    <th>Total Facturado</th>
                    <th>Recaudado</th>
                    <th>Saldo CxC</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {report.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                        Sin facturas emitidas en el periodo consultado.
                      </td>
                    </tr>
                  ) : (
                    report.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td><span className="pk-badge pk-badge-blue">{inv.code || inv.id}</span></td>
                        <td>{inv.date || inv.createdAt || '—'}</td>
                        <td style={{ fontWeight: 700 }}>{inv.customerName}</td>
                        <td>{inv.paymentMethod || 'Contado'}</td>
                        <td style={{ fontWeight: 800 }}>{formatCop(inv.total)}</td>
                        <td style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>{formatCop(inv.amountPaid)}</td>
                        <td
                          style={{
                            color: inv.pendingBalance > 0 ? 'var(--pk-amber)' : 'var(--pk-muted)',
                            fontWeight: inv.pendingBalance > 0 ? 800 : 500,
                          }}
                        >
                          {formatCop(inv.pendingBalance)}
                        </td>
                        <td>
                          <span className={`pk-badge ${inv.pendingBalance > 0 ? 'pk-badge-amber' : 'pk-badge-emerald'}`}>
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

      {hasInventario && (
        <div className="pk-card">
          <div className="pk-card-head">
            <div className="pk-card-title">📦 Valorización de Inventario y Alertas Bajo Mínimo ({report.products.length})</div>
          </div>
          <div className="pk-card-body">
            <div className="pk-table-wrap">
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Categoría</th>
                    <th>Stock</th>
                    <th>Costo Unit.</th>
                    <th>Precio Venta</th>
                    <th>Margen Unit.</th>
                    <th>Valorizado Costo</th>
                    <th>Valorizado Venta</th>
                    <th>Alerta Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {report.products.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                        No hay referencias registradas en el inventario actual.
                      </td>
                    </tr>
                  ) : (
                    report.products.map((p) => {
                      const unitMargin = p.salePrice - p.costPrice;
                      const isLow = p.stock <= p.minStock;
                      return (
                        <tr key={p.id}>
                          <td><span className="pk-badge pk-badge-slate">{p.code}</span></td>
                          <td style={{ fontWeight: 700 }}>{p.name}</td>
                          <td>{p.category}</td>
                          <td style={{ fontWeight: 800 }}>{p.stock}</td>
                          <td>{formatCop(p.costPrice)}</td>
                          <td>{formatCop(p.salePrice)}</td>
                          <td style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>+{formatCop(unitMargin)}</td>
                          <td style={{ fontWeight: 700 }}>{formatCop(p.costPrice * p.stock)}</td>
                          <td style={{ fontWeight: 800 }}>{formatCop(p.salePrice * p.stock)}</td>
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

      <PkModal
        open={snapshotModalOpen}
        title="Guardar Instantánea / Corte Ejecutivo en Histórico"
        onClose={() => setSnapshotModalOpen(false)}
      >
        <form onSubmit={handleSaveSnapshot} className="pk-form-grid">
          <PkAutoCodeInput label="Código de Corte" value={nextSnapshotCode} />
          <div className="pk-field">
            <label>Ventas Consolidadas</label>
            <input readOnly value={formatCop(report.totalSales)} />
          </div>
          <div className="pk-field">
            <label>Utilidad Operativa</label>
            <input readOnly value={formatCop(report.netOperatingProfit)} />
          </div>
          <div className="pk-field">
            <label>Nota / Etiqueta del Corte *</label>
            <input
              required
              value={snapshotNotes}
              onChange={(e) => setSnapshotNotes(e.target.value)}
              placeholder="Ej: Cierre mensual auditado"
            />
          </div>
          <div className="pk-field" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
              Confirmar Corte Histórico
            </button>
          </div>
        </form>
      </PkModal>
    </ModuleGate>
  );
};

export default ReportesView;
