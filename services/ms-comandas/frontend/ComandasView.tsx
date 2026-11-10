import React, { useState, useEffect, useCallback } from 'react';
import {
  useProveko,
  ModuleGate,
  FeatureGate,
  PkEntityDialog,
  PkPrintButton,
  PkKpiRow,
  DiningTable,
  Product,
  PrintDocumentPayload,
  formatCop,
} from '@proveko/ui-sdk';

interface ComandasResponse {
  ok: boolean;
  tables: DiningTable[];
  products: Product[];
}

export const ComandasView: React.FC = () => {
  const {
    activeModuleKey,
    hasModule,
    apiGet,
    apiPost,
    apiDelete,
    toast,
    sendToPosCheckout,
    dialogVersion,
  } = useProveko();

  const [tables, setTables] = useState<DiningTable[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>('');

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [qty, setQty] = useState<string>('1');
  const [note, setNote] = useState<string>('');

  const [showNewTableModal, setShowNewTableModal] = useState(false);
  const [tableName, setTableName] = useState('');
  const [tableZone, setTableZone] = useState('Salón Principal');
  const [tableWaiter, setTableWaiter] = useState('Camila (Mesera)');

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<ComandasResponse>('/api/v1/comandas/tables');
      const list = data.tables || [];
      const prods = data.products || [];
      setTables(list);
      setProducts(prods);
      setSelectedTableId((prev) => {
        if (prev && list.some((t) => t.id === prev)) return prev;
        return list.length > 0 ? list[0].id : '';
      });
      setSelectedProductId((prev) => {
        if (prev && prods.some((p) => p.id === prev)) return prev;
        const gastro = prods.find((p) => p.category.toLowerCase().includes('restaurante')) || prods[0];
        return gastro ? gastro.id : '';
      });
    } catch {
    }
  }, [apiGet]);

  useEffect(() => {
    void reload();
  }, [reload, dialogVersion]);

  const validModules = ['mapa_mesas', 'monitor_cocina'];
  const currentTab =
    validModules.includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : validModules.find((m) => hasModule(m)) || 'mapa_mesas';

  const activeTable = tables.find((t) => t.id === selectedTableId) || tables[0] || null;
  const kitchenTables = tables.filter((t) => t.status === 'En Cocina');
  const occupiedCount = tables.filter((t) => t.status !== 'Libre').length;
  const activeSalesSum = tables.reduce((acc, t) => acc + (t.total || 0), 0);

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) return;
    const res = await apiPost<{ table: DiningTable }>('/api/v1/comandas/tables', {
      name: tableName,
      zone: tableZone,
      waiter: tableWaiter,
    });
    toast(`Mesa creada: ${res.table.name}`);
    setTableName('');
    setShowNewTableModal(false);
    await reload();
    setSelectedTableId(res.table.id);
  };

  const handleAddProductToTable = async (prod: Product, customQty?: number) => {
    if (!activeTable) {
      toast('Selecciona primero una mesa');
      return;
    }
    const itemQty = customQty ?? Math.max(1, Number(qty || 1));
    await apiPost(`/api/v1/comandas/tables/${activeTable.id}/items`, {
      productId: prod.id,
      name: prod.name,
      price: prod.salePrice,
      qty: itemQty,
      note,
    });
    setNote('');
    setQty('1');
    await reload();
  };

  const handleSubmitSelectedDish = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) {
      toast('Selecciona un plato o bebida del catálogo');
      return;
    }
    await handleAddProductToTable(prod);
  };

  const handleRemoveItem = async (index: number) => {
    if (!activeTable) return;
    await apiDelete(`/api/v1/comandas/tables/${activeTable.id}/items/${index}`);
    await reload();
  };

  const handleSendKitchen = async () => {
    if (!activeTable) return;
    await apiPost(`/api/v1/comandas/tables/${activeTable.id}/send-kitchen`, {});
    toast(`👨‍🍳 Comanda de ${activeTable.name} enviada a cocina`);
    await reload();
  };

  const handleMarkReady = async (tbl: DiningTable) => {
    await apiPost(`/api/v1/comandas/tables/${tbl.id}/ready`, {});
    toast(`✅ Pedido de ${tbl.name} marcado como listo y entregado`);
    await reload();
  };

  const handlePassToPos = (tbl: DiningTable) => {
    if (!tbl.items || tbl.items.length === 0) {
      toast('La mesa no tiene consumos activos para facturar.');
      return;
    }
    sendToPosCheckout({
      linkedTableId: tbl.id,
      items: tbl.items.map((it) => {
        const prod = products.find((p) => p.id === it.productId);
        return {
          kind: 'PRODUCTO',
          refId: it.productId || tbl.id,
          code: prod?.code || 'GASTRO',
          name: it.note ? `${it.name} (${it.note})` : it.name,
          qty: it.qty,
          price: it.price,
          taxPct: prod?.taxPct ?? 8,
        };
      }),
    });
    toast(`Cuenta de ${tbl.name} enviada a Caja POS`);
  };

  const buildTablePrintPayload = (tbl: DiningTable, forKitchen: boolean): PrintDocumentPayload => ({
    document_type: 'COMANDA',
    layout_variant: 'tirilla_80mm',
    document_number: `${forKitchen ? 'COC' : 'PRE'}-${tbl.id.toUpperCase()}`,
    issue_date: new Date().toISOString().slice(0, 16).replace('T', ' '),
    customer_name: `${tbl.name} — ${tbl.zone}`,
    extra_fields: {
      Mesa: tbl.name,
      Zona: tbl.zone,
      Mesero: tbl.waiter,
      Estado: tbl.status,
    },
    items: (tbl.items || []).map((it, idx) => ({
      code: `P-${idx + 1}`,
      description: it.note ? `${it.name} [Nota: ${it.note}]` : it.name,
      quantity: it.qty,
      unit_price: forKitchen ? 0 : it.price,
      subtotal: forKitchen ? 0 : it.qty * it.price,
    })),
    subtotal: tbl.total,
    grand_total: tbl.total,
    notes: forKitchen
      ? 'COMANDA DE PREPARACIÓN COCINA / BARRA'
      : 'PRECUENTA INFORMATIVA — Solicite su factura electrónica en Caja.',
  });

  const badgeClassForStatus = (status: string): string => {
    if (status === 'En Cocina') return 'pk-badge pk-badge-amber';
    if (status === 'Ocupada') return 'pk-badge pk-badge-blue';
    return 'pk-badge pk-badge-emerald';
  };

  return (
    <div>
      {currentTab === 'mapa_mesas' && (
        <ModuleGate module="mapa_mesas">
          <PkKpiRow
            items={[
              { label: 'Total Mesas', value: String(tables.length) },
              { label: 'Mesas Activas', value: String(occupiedCount), color: 'var(--pk-primary)' },
              { label: 'Pedidos en Cocina', value: String(kitchenTables.length), color: 'var(--pk-amber)' },
              { label: 'Consumo en Salón', value: formatCop(activeSalesSum), color: 'var(--pk-emerald)' },
            ]}
          />

          <div className="pk-grid-2">
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🍽️ Salón, Terraza y Barra</div>
                <button
                  type="button"
                  className="pk-btn pk-btn-outline pk-btn-sm"
                  onClick={() => setShowNewTableModal(true)}
                >
                  ➕ Nueva Mesa
                </button>
              </div>
              <div className="pk-card-body">
                <div className="pk-cards-grid">
                  {tables.map((tbl) => {
                    const selected = activeTable?.id === tbl.id;
                    return (
                      <div
                        key={tbl.id}
                        onClick={() => setSelectedTableId(tbl.id)}
                        style={{
                          border: selected ? '2px solid var(--pk-primary)' : '1px solid var(--pk-border)',
                          borderRadius: 10,
                          padding: 12,
                          background: selected ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: 15 }}>{tbl.name}</strong>
                          <span className={badgeClassForStatus(tbl.status)}>{tbl.status}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--pk-muted)', marginTop: 4 }}>
                          📍 {tbl.zone} · 🧑 {tbl.waiter}
                        </div>
                        <div
                          style={{
                            marginTop: 10,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontSize: 12, color: '#334155' }}>
                            {(tbl.items || []).length} plato(s)
                          </span>
                          <span style={{ fontWeight: 800, fontSize: 15 }}>{formatCop(tbl.total)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">
                  {activeTable ? `🧾 Comanda Activa — ${activeTable.name}` : 'Selecciona una Mesa'}
                </div>
                {activeTable && <span className={badgeClassForStatus(activeTable.status)}>{activeTable.status}</span>}
              </div>
              <div className="pk-card-body">
                {!activeTable ? (
                  <div style={{ color: 'var(--pk-muted)' }}>Crea o selecciona una mesa para tomar pedido.</div>
                ) : (
                  <>
                    <form onSubmit={handleSubmitSelectedDish} style={{ marginBottom: 12 }}>
                      <div className="pk-form-grid">
                        <div className="pk-field">
                          <label>Catálogo Platos / Bebidas</label>
                          <select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} — {formatCop(p.salePrice)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="pk-field">
                          <label>Cantidad</label>
                          <input
                            type="number"
                            min="1"
                            value={qty}
                            onChange={(e) => setQty(e.target.value)}
                          />
                        </div>
                      </div>

                      <FeatureGate module="mapa_mesas" feature="notas_preparacion">
                        <div className="pk-field" style={{ marginTop: 8 }}>
                          <label>Nota de Cocina / Término de Preparación</label>
                          <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Ej: Término 3/4, sin cebolla, bebida al clima..."
                          />
                          <div className="pk-row-actions" style={{ marginTop: 4 }}>
                            {['Término 3/4', 'Bien asado', 'Sin cebolla', 'Para llevar'].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                className="pk-btn pk-btn-outline pk-btn-sm"
                                onClick={() => setNote(preset)}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </FeatureGate>

                      <div style={{ marginTop: 10 }}>
                        <button type="submit" className="pk-btn pk-btn-primary">
                          ➕ Agregar a {activeTable.name}
                        </button>
                      </div>
                    </form>

                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        ⚡ Toque Rápido Menú:
                      </div>
                      <div className="pk-row-actions">
                        {products.slice(0, 6).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            onClick={() => void handleAddProductToTable(p, 1)}
                          >
                            + {p.name} ({formatCop(p.salePrice)})
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pk-table-wrap">
                      <table className="pk-table">
                        <thead>
                          <tr>
                            <th>Plato / Bebida</th>
                            <th>Cant.</th>
                            <th>Subtotal</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(activeTable.items || []).length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ textAlign: 'center', color: 'var(--pk-muted)' }}>
                                Mesa libre sin pedidos registrados.
                              </td>
                            </tr>
                          ) : (
                            activeTable.items.map((it, idx) => (
                              <tr key={`${it.productId}-${idx}`}>
                                <td>
                                  <div style={{ fontWeight: 700 }}>{it.name}</div>
                                  {it.note && (
                                    <div style={{ fontSize: 11, color: 'var(--pk-amber)', fontWeight: 700 }}>
                                      📝 {it.note}
                                    </div>
                                  )}
                                </td>
                                <td>{it.qty}</td>
                                <td style={{ fontWeight: 700 }}>{formatCop(it.qty * it.price)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="pk-btn pk-btn-danger pk-btn-sm"
                                    onClick={() => void handleRemoveItem(idx)}
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                      }}
                    >
                      <div style={{ fontSize: 17, fontWeight: 800 }}>
                        Total Mesa: {formatCop(activeTable.total)}
                      </div>
                      <div className="pk-row-actions">
                        <button
                          type="button"
                          className="pk-btn pk-btn-amber pk-btn-sm"
                          onClick={() => void handleSendKitchen()}
                        >
                          👨‍🍳 Enviar a Cocina
                        </button>
                        <PkPrintButton
                          label="🖨️ Precuenta / Comanda"
                          payload={buildTablePrintPayload(activeTable, false)}
                        />
                        <button
                          type="button"
                          className="pk-btn pk-btn-emerald pk-btn-sm"
                          onClick={() => handlePassToPos(activeTable)}
                        >
                          💵 Pasar a Caja POS
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <PkEntityDialog
            open={showNewTableModal}
            title="➕ Registrar Nueva Mesa o Ubicación"
            onClose={() => setShowNewTableModal(false)}
          >
            <form onSubmit={handleCreateTable} className="pk-form-grid">
              <div className="pk-field">
                <label>Nombre o Número de Mesa *</label>
                <input
                  required
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="Ej: Mesa 4 / Barra 1"
                />
              </div>
              <div className="pk-field">
                <label>Zona / Ambiente</label>
                <select value={tableZone} onChange={(e) => setTableZone(e.target.value)}>
                  <option value="Salón Principal">Salón Principal</option>
                  <option value="Terraza">Terraza</option>
                  <option value="VIP / Segundo Piso">VIP / Segundo Piso</option>
                  <option value="Barra">Barra</option>
                </select>
              </div>
              <div className="pk-field">
                <label>Mesero Asignado</label>
                <input
                  value={tableWaiter}
                  onChange={(e) => setTableWaiter(e.target.value)}
                  placeholder="Nombre del mesero"
                />
              </div>
              <div className="pk-field">
                <button type="submit" className="pk-btn pk-btn-primary">
                  💾 Crear Mesa
                </button>
              </div>
            </form>
          </PkEntityDialog>
        </ModuleGate>
      )}

      {currentTab === 'monitor_cocina' && (
        <ModuleGate module="monitor_cocina">
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                👨‍🍳 Monitor en Vivo de Cocina y Barra ({kitchenTables.length} pendientes)
              </div>
              <button type="button" className="pk-btn pk-btn-outline pk-btn-sm" onClick={() => void reload()}>
                🔄 Actualizar Pantalla
              </button>
            </div>
            <div className="pk-card-body">
              {kitchenTables.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--pk-muted)' }}>
                  No hay comandas pendientes en preparación en este momento.
                </div>
              ) : (
                <div className="pk-cards-grid">
                  {kitchenTables.map((tbl) => (
                    <div
                      key={tbl.id}
                      style={{
                        border: '2px solid var(--pk-amber)',
                        borderRadius: 12,
                        padding: 14,
                        background: '#fffbeb',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 16 }}>{tbl.name}</strong>
                        <span className="pk-badge pk-badge-amber">🔥 En Cocina</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 10 }}>
                        📍 {tbl.zone} · Mesero: {tbl.waiter}
                      </div>

                      <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 8, marginBottom: 12 }}>
                        {(tbl.items || []).map((it, idx) => (
                          <div key={idx} style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 800, fontSize: 13.5 }}>
                              {it.qty}x {it.name}
                            </div>
                            {it.note && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#92400e',
                                  background: '#fef3c7',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  marginTop: 2,
                                  display: 'inline-block',
                                  fontWeight: 700,
                                }}
                              >
                                ⚠️ Nota: {it.note}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="pk-row-actions">
                        <button
                          type="button"
                          className="pk-btn pk-btn-emerald pk-btn-sm"
                          onClick={() => void handleMarkReady(tbl)}
                        >
                          ✅ Pedido Listo
                        </button>
                        <PkPrintButton
                          label="🖨️ Comanda Cocina"
                          payload={buildTablePrintPayload(tbl, true)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ModuleGate>
      )}
    </div>
  );
};
