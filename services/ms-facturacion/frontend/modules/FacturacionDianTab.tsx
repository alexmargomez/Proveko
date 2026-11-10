import React from 'react';
import { PkKpiRow, downloadCsvUtf8, formatCop, Invoice } from '@proveko/ui-sdk';

export interface FacturacionDianTabProps {
  invoices: Invoice[];
  onPrintInvoice: (inv: Invoice) => void;
}

export const FacturacionDianTab: React.FC<FacturacionDianTabProps> = ({
  invoices,
  onPrintInvoice,
}) => {
  const dianInvoices = invoices.filter((inv) => Boolean(inv.cufe));
  const totalTaxDian = dianInvoices.reduce((acc, inv) => acc + inv.taxTotal, 0);
  const totalBilledDian = dianInvoices.reduce((acc, inv) => acc + inv.total, 0);

  return (
    <div>
      <PkKpiRow
        items={[
          { label: 'Documentos Electrónicos con CUFE', value: String(dianInvoices.length), color: 'var(--pk-primary)' },
          { label: 'Total Facturado Electrónico', value: formatCop(totalBilledDian), color: 'var(--pk-emerald)' },
          { label: 'IVA Generado Acumulado', value: formatCop(totalTaxDian) },
        ]}
      />

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">⚡ Monitor de Facturación Electrónica DIAN y Huellas CUFE SHA-256</div>
          <button
            type="button"
            className="pk-btn pk-btn-outline pk-btn-sm"
            onClick={() =>
              downloadCsvUtf8(
                'libro_facturacion_dian_proveko.csv',
                ['PrefijoNumero', 'Fecha', 'Cliente', 'NIT', 'Subtotal', 'IVA', 'Total', 'CUFE'],
                invoices.map((inv) => [
                  inv.id,
                  inv.date,
                  inv.customerName,
                  inv.customerNit,
                  inv.subtotal,
                  inv.taxTotal,
                  inv.total,
                  inv.cufe || 'SIN-CUFE',
                ])
              )
            }
          >
            📥 Exportar Libro DIAN (.CSV)
          </button>
        </div>
        <div className="pk-card-body">
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>N° Electrónico</th>
                  <th>Fecha Emisión</th>
                  <th>Adquiriente / NIT</th>
                  <th>IVA</th>
                  <th>Total</th>
                  <th>CUFE SHA-256</th>
                  <th>Estado DIAN</th>
                  <th>Representación</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.id}</strong>
                    </td>
                    <td>{inv.date}</td>
                    <td>
                      <strong>{inv.customerName}</strong>
                      <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{inv.customerNit}</div>
                    </td>
                    <td>{formatCop(inv.taxTotal)}</td>
                    <td>
                      <strong>{formatCop(inv.total)}</strong>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <code
                        style={{
                          display: 'block',
                          fontSize: 10.5,
                          color: '#334155',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={inv.cufe}
                      >
                        {inv.cufe || 'Emitido sin módulo DIAN'}
                      </code>
                    </td>
                    <td>
                      {inv.cufe ? (
                        <span className="pk-badge pk-badge-emerald">✓ Validado DIAN</span>
                      ) : (
                        <span className="pk-badge pk-badge-slate">POS Interno</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="pk-btn pk-btn-outline pk-btn-sm"
                        onClick={() => onPrintInvoice(inv)}
                      >
                        🖨️ Imprimir PDF
                      </button>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                      No se han emitido facturas electrónicas aún.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
