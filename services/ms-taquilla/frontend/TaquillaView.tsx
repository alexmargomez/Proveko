import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  ModuleGate,
  PkAutoCodeInput,
  PkEntitySelect,
  PkPrintButton,
  PkKpiRow,
  Customer,
  PrintDocumentPayload,
  formatCop,
} from '@proveko/ui-sdk';

interface TicketRecord {
  id: string;
  createdAt: string;
  moduleKey: string;
  fields: Record<string, string>;
}

interface TaquillaAllResponse {
  ok: boolean;
  nextCode: string;
  customers: Customer[];
  tickets: TicketRecord[];
}

export const TaquillaView: React.FC = () => {
  const { apiGet, apiPost, toast, openQuickDialog, dialogVersion } = useProveko();

  const [nextCode, setNextCode] = useState('TKT-5006');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tickets, setTickets] = useState<TicketRecord[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [eventName, setEventName] = useState('Ingreso General / Acceso Evento');
  const [zone, setZone] = useState('General');
  const [qty, setQty] = useState('1');
  const [unitPrice, setUnitPrice] = useState('35000');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<TaquillaAllResponse>('/api/v1/taquilla/all');
      const custList = data.customers || [];
      setNextCode(data.nextCode || 'TKT-5006');
      setCustomers(custList);
      setTickets(data.tickets || []);
      setCustomerId((prev) => (prev && custList.some((c) => c.id === prev) ? prev : custList[0]?.id || ''));
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void reload();
  }, [reload, dialogVersion]);

  const handleIssueTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = Number(qty || 0);
    const numPrice = Number(unitPrice || 0);
    if (!eventName.trim() || numQty <= 0 || numPrice < 0) {
      toast('Ingresa el evento/servicio, una cantidad válida y el precio de la boleta.');
      return;
    }
    await apiPost('/api/v1/taquilla/tickets', {
      customerId,
      eventName,
      zone,
      qty: numQty,
      unitPrice: numPrice,
    });
    toast('Boleta emitida y lista para impresión térmica');
    setQty('1');
    await reload();
  };

  const buildTicketPayload = (tkt: TicketRecord): PrintDocumentPayload => {
    const q = Number(tkt.fields?.qty || 1);
    const price = Number(tkt.fields?.unitPrice || 0);
    const total = Number(tkt.fields?.total || q * price);
    return {
      document_type: 'BOLETA / TIQUETE DE ACCESO',
      layout_variant: 'tirilla_80mm',
      document_number: tkt.id,
      issue_date: tkt.createdAt,
      customer_name: tkt.fields?.customerName || 'Comprador Mostrador',
      customer_nit: tkt.fields?.customerNit || '',
      payment_method: 'Taquilla Directa',
      extra_fields: {
        Evento: tkt.fields?.eventName || '',
        Localidad: tkt.fields?.zone || 'General',
        'Pases Autorizados': String(q),
      },
      items: [
        {
          code: tkt.id,
          description: `${tkt.fields?.eventName || 'Entrada'} — Localidad: ${tkt.fields?.zone || 'General'}`,
          quantity: q,
          unit_price: price,
          subtotal: total,
        },
      ],
      subtotal: total,
      grand_total: total,
      notes: 'Tiquete válido únicamente para la fecha y localidad indicadas. Conserve su colilla.',
    };
  };

  const totalAdmissions = tickets.reduce((acc, t) => acc + Number(t.fields?.qty || 0), 0);
  const totalBoxOffice = tickets.reduce((acc, t) => acc + Number(t.fields?.total || 0), 0);
  const previewTotal = Number(qty || 0) * Number(unitPrice || 0);

  return (
    <ModuleGate module="venta_boletas">
      <PkKpiRow
        items={[
          { label: 'Transacciones Taquilla', value: String(tickets.length), color: 'var(--pk-primary)' },
          { label: 'Entradas / Personas', value: String(totalAdmissions), color: 'var(--pk-emerald)' },
          { label: 'Recaudo Total Taquilla', value: formatCop(totalBoxOffice), color: '#0f172a' },
          { label: 'Próximo Tiquete', value: nextCode, color: 'var(--pk-amber)' },
        ]}
      />

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">🎟️ Taquilla Ágil — Emisión de Boletas y Entradas</div>
          <span className="pk-badge pk-badge-emerald">Total a Cobrar: {formatCop(previewTotal)}</span>
        </div>
        <div className="pk-card-body">
          <form onSubmit={handleIssueTicket} className="pk-form-grid">
            <PkAutoCodeInput label="Consecutivo Boleta" value={nextCode} />
            <PkEntitySelect
              label="Comprador *"
              items={customers}
              value={customerId}
              onChange={setCustomerId}
              getValue={(c) => c.id}
              getLabel={(c) => `${c.name} (${c.nit})`}
              onCreateNew={() => openQuickDialog('nuevo-cliente', () => void reload())}
              createLabel="+ Nuevo Cliente"
              searchable
            />
            <div className="pk-field">
              <label>Evento / Servicio / Atracción *</label>
              <input
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Ej: Concierto Principal / Pasadía Parque"
              />
            </div>
            <div className="pk-field">
              <label>Localidad / Zona</label>
              <select value={zone} onChange={(e) => setZone(e.target.value)}>
                <option value="General">General</option>
                <option value="VIP / Preferencial">VIP / Preferencial</option>
                <option value="Palco Empresarial">Palco Empresarial</option>
                <option value="Cortesía Autorizada">Cortesía Autorizada</option>
              </select>
            </div>
            <div className="pk-field">
              <label>Cantidad Entradas *</label>
              <input
                required
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="pk-field">
              <label>Precio Unitario ($) *</label>
              <input
                required
                type="number"
                min="0"
                step="any"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
            <div className="pk-field">
              <button type="submit" className="pk-btn pk-btn-primary">
                🎟️ Emitir Boleta
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">🧾 Boletas Emitidas en Turno ({tickets.length})</div>
        </div>
        <div className="pk-card-body">
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Boleta</th>
                  <th>Fecha / Hora</th>
                  <th>Comprador</th>
                  <th>Evento / Servicio</th>
                  <th>Localidad</th>
                  <th>Cant.</th>
                  <th>Unitario</th>
                  <th>Total</th>
                  <th>Tirilla 80mm</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                      Aún no se han emitido boletas en el turno actual.
                    </td>
                  </tr>
                ) : (
                  tickets.map((tkt) => (
                    <tr key={tkt.id}>
                      <td>
                        <span className="pk-badge pk-badge-amber">{tkt.id}</span>
                      </td>
                      <td>{tkt.createdAt}</td>
                      <td style={{ fontWeight: 700 }}>{tkt.fields?.customerName}</td>
                      <td>{tkt.fields?.eventName}</td>
                      <td>
                        <span className="pk-badge pk-badge-blue">{tkt.fields?.zone}</span>
                      </td>
                      <td style={{ fontWeight: 800 }}>{tkt.fields?.qty}</td>
                      <td>{formatCop(Number(tkt.fields?.unitPrice || 0))}</td>
                      <td style={{ fontWeight: 800, color: 'var(--pk-emerald)' }}>
                        {formatCop(Number(tkt.fields?.total || 0))}
                      </td>
                      <td>
                        <PkPrintButton label="🖨️ Imprimir Boleta" payload={buildTicketPayload(tkt)} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ModuleGate>
  );
};
