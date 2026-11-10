import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  ModuleGate,
  PkPrintButton,
  PkKpiRow,
  Invoice,
  Expense,
  Product,
  PrintDocumentPayload,
  downloadCsvUtf8,
  formatCop,
} from '@proveko/ui-sdk';

interface ExecutiveReportResponse {
  ok: boolean;
  totalSales: number;
  totalCollected: number;
  totalPendingReceivables: number;
  totalExpenses: number;
  netOperatingProfit: number;
  inventoryCostValue: number;
  inventorySaleValue: number;
  lowStockCount: number;
  customersCount?: number;
  workOrdersCount?: number;
  scaleTicketsCount?: number;
  invoices: Invoice[];
  expenses: Expense[];
  products: Product[];
}

export const ReportesView: React.FC = () => {
  const { apiGet, toast, dialogVersion } = useProveko();

  const [report, setReport] = useState<ExecutiveReportResponse>({
    ok: true,
    totalSales: 0,
    totalCollected: 0,
    totalPendingReceivables: 0,
    totalExpenses: 0,
    netOperatingProfit: 0,
    inventoryCostValue: 0,
    inventorySaleValue: 0,
    lowStockCount: 0,
    customersCount: 0,
    workOrdersCount: 0,
    scaleTicketsCount: 0,
    invoices: [],
    expenses: [],
    products: [],
  });

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<ExecutiveReportResponse>('/api/v1/reportes/executive');
      setReport({
        ok: true,
        totalSales: data.totalSales || 0,
        totalCollected: data.totalCollected || 0,
        totalPendingReceivables: data.totalPendingReceivables || 0,
        totalExpenses: data.totalExpenses || 0,
        netOperatingProfit: data.netOperatingProfit || 0,
        inventoryCostValue: data.inventoryCostValue || 0,
        inventorySaleValue: data.inventorySaleValue || 0,
        lowStockCount: data.lowStockCount || 0,
        customersCount: data.customersCount || 0,
        workOrdersCount: data.workOrdersCount || 0,
        scaleTicketsCount: data.scaleTicketsCount || 0,
        invoices: data.invoices || [],
        expenses: data.expenses || [],
        products: data.products || [],
      });
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void reload();
  }, [reload, dialogVersion]);

  const todayStamp = new Date().toISOString().slice(0, 10);

  const handleExportSalesCsv = () => {
    downloadCsvUtf8(
      `proveko_ventas_${todayStamp}.csv`,
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
        inv.id,
        inv.date,
        inv.customerName,
        inv.customerNit,
        inv.paymentMethod,
        inv.subtotal,
        inv.taxTotal,
        inv.total,
        inv.amountPaid,
        inv.pendingBalance,
        inv.status,
      ])
    );
    toast('Archivo Excel CSV de Ventas descargado correctamente');
  };

  const handleExportInventoryCsv = () => {
    downloadCsvUtf8(
      `proveko_inventario_valorizado_${todayStamp}.csv`,
      [
        'Codigo',
        'Producto',
        'Categoria',
        'Stock Actual',
        'Stock Minimo',
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
    toast('Archivo Excel CSV de Inventario Valorizado descargado');
  };

  const handleExportExpensesCsv = () => {
    downloadCsvUtf8(
      `proveko_gastos_operativos_${todayStamp}.csv`,
      ['Consecutivo', 'Fecha', 'Categoria', 'Concepto', 'Origen Fondos', 'Responsable', 'Valor'],
      report.expenses.map((exp) => [
        exp.id,
        exp.date,
        exp.category,
        exp.description,
        exp.paymentSource,
        exp.responsible,
        exp.amount,
      ])
    );
    toast('Archivo Excel CSV de Gastos Operativos descargado');
  };

  const executivePrintPayload: PrintDocumentPayload = {
    document_type: 'BALANCE EJECUTIVO Y ESTADO GERENCIAL',
    layout_variant: 'carta_membrete',
    document_number: `BAL-${todayStamp}`,
    issue_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    customer_name: 'Informe Consolidado de Gerencia y Operaciones',
    payment_method: 'Consolidado Multi-Módulo',
    extra_fields: {
      'Ventas Totales Facturadas': formatCop(report.totalSales),
      'Recaudo Efectivo Ingresado': formatCop(report.totalCollected),
      'Cartera Pendiente por Cobrar': formatCop(report.totalPendingReceivables),
      'Gastos Operativos': formatCop(report.totalExpenses),
      'Inventario a Costo': formatCop(report.inventoryCostValue),
      'Inventario a Precio Venta': formatCop(report.inventorySaleValue),
      'Alertas Stock Mínimo': `${report.lowStockCount} referencias`,
    },
    items: [
      {
        code: 'KPI-VEN',
        description: `Ingresos Operacionales por Facturación (${report.invoices.length} facturas emitidas)`,
        quantity: 1,
        unit_price: report.totalSales,
        subtotal: report.totalSales,
      },
      {
        code: 'KPI-EGR',
        description: `Menos: Gastos y Egresos Operativos de Caja (${report.expenses.length} comprobantes)`,
        quantity: 1,
        unit_price: -report.totalExpenses,
        subtotal: -report.totalExpenses,
      },
    ],
    subtotal: report.totalSales,
    discount_total: report.totalExpenses,
    grand_total: report.netOperatingProfit,
    pending_balance: report.totalPendingReceivables,
    notes: `Utilidad potencial estimada sobre inventario actual: ${formatCop(
      report.inventorySaleValue - report.inventoryCostValue
    )}.`,
  };

  return (
    <ModuleGate module="centro_reportes">
      <PkKpiRow
        items={[
          { label: 'Ventas Totales', value: formatCop(report.totalSales), color: 'var(--pk-primary)' },
          { label: 'Recaudo Efectivo', value: formatCop(report.totalCollected), color: 'var(--pk-emerald)' },
          { label: 'Cartera por Cobrar', value: formatCop(report.totalPendingReceivables), color: 'var(--pk-amber)' },
          { label: 'Gastos', value: formatCop(report.totalExpenses), color: 'var(--pk-rose)' },
          {
            label: 'Utilidad Operativa',
            value: formatCop(report.netOperatingProfit),
            color: report.netOperatingProfit >= 0 ? 'var(--pk-emerald)' : 'var(--pk-rose)',
          },
          { label: 'Valor Inventario', value: formatCop(report.inventoryCostValue), color: '#0f172a' },
        ]}
      />

      <div className="pk-card">
        <div className="pk-card-head">
          <div>
            <div className="pk-card-title">📊 Centro Gerencial de Exportación Excel (CSV UTF-8) y Balance PDF</div>
            <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 2 }}>
              Inventario potencial a precio de venta: <strong>{formatCop(report.inventorySaleValue)}</strong> ·
              Referencias en stock crítico: <strong>{report.lowStockCount}</strong> · Clientes activos:{' '}
              <strong>{report.customersCount || 0}</strong>
            </div>
          </div>
          <div className="pk-row-actions">
            <button type="button" className="pk-btn pk-btn-emerald pk-btn-sm" onClick={handleExportSalesCsv}>
              📥 Excel Ventas (.CSV)
            </button>
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportInventoryCsv}>
              📥 Excel Inventario Valorizado (.CSV)
            </button>
            <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={handleExportExpensesCsv}>
              📥 Excel Gastos (.CSV)
            </button>
            <PkPrintButton
              label="🖨️ Imprimir Balance Ejecutivo PDF"
              payload={executivePrintPayload}
              variant="primary"
            />
          </div>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">🧾 Comparativo de Últimas Ventas y Estado de Recaudo ({report.invoices.length})</div>
          <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void reload()}>
            🔄 Actualizar Corte
          </button>
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
                      Aún no se registran facturas emitidas en la base de datos del cliente.
                    </td>
                  </tr>
                ) : (
                  report.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>
                        <span className="pk-badge pk-badge-blue">{inv.id}</span>
                      </td>
                      <td>{inv.date}</td>
                      <td style={{ fontWeight: 700 }}>{inv.customerName}</td>
                      <td>{inv.paymentMethod}</td>
                      <td style={{ fontWeight: 800 }}>{formatCop(inv.total)}</td>
                      <td style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>
                        {formatCop(inv.amountPaid)}
                      </td>
                      <td
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
                          {inv.status}
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

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">📦 Rentabilidad y Valorización por Producto ({report.products.length})</div>
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
                  <th>% Rentab.</th>
                  <th>Valorizado Costo</th>
                  <th>Estado Stock</th>
                </tr>
              </thead>
              <tbody>
                {report.products.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                      No hay productos registrados en el catálogo.
                    </td>
                  </tr>
                ) : (
                  report.products.map((p) => {
                    const unitMargin = p.salePrice - p.costPrice;
                    const marginPct = p.salePrice > 0 ? Math.round((unitMargin / p.salePrice) * 100) : 0;
                    const isLow = p.stock <= p.minStock;
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="pk-badge pk-badge-slate">{p.code}</span>
                        </td>
                        <td style={{ fontWeight: 700 }}>{p.name}</td>
                        <td>{p.category}</td>
                        <td style={{ fontWeight: 800 }}>{p.stock}</td>
                        <td>{formatCop(p.costPrice)}</td>
                        <td>{formatCop(p.salePrice)}</td>
                        <td style={{ color: 'var(--pk-emerald)', fontWeight: 700 }}>
                          +{formatCop(unitMargin)}
                        </td>
                        <td>
                          <span className="pk-badge pk-badge-emerald">{marginPct}%</span>
                        </td>
                        <td style={{ fontWeight: 800 }}>{formatCop(p.costPrice * p.stock)}</td>
                        <td>
                          <span className={`pk-badge ${isLow ? 'pk-badge-amber' : 'pk-badge-blue'}`}>
                            {isLow ? '⚠️ Reabastecer' : 'Óptimo'}
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
    </ModuleGate>
  );
};
