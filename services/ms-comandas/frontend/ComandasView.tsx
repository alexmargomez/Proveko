import React, { useState, useEffect, useCallback } from 'react';
import {
  usePlatform,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkModal,
  PkConfirmModal,
  PkPrintButton,
  PkKpiRow,
  useAsyncAction,
  formatCop,
  downloadCsvUtf8,
} from '@platform/ui-sdk';

interface MenuItem {
  id: string;
  code: string;
  name: string;
  category: string;
  salePrice: number;
  taxPct: number;
}

interface OrderItem {
  itemId: string;
  productId: string;
  name: string;
  qty: number;
  price: number;
  note: string;
}

interface DiningTable {
  id: string;
  name: string;
  zone: string;
  waiter: string;
  status: string;
  items: OrderItem[];
  total: number;
}

interface ComandasStateResponse {
  ok: boolean;
  nextMenuCode: string;
  tables: DiningTable[];
  products: MenuItem[];
}

interface OptionalInventoryResponse {
  ok?: boolean;
  products?: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    salePrice: number;
    taxPct?: number;
  }>;
}

const VALID_MODULES = ['mapa_mesas', 'monitor_cocina'] as const;

export const ComandasView: React.FC = () => {
  const {
    activeModuleKey,
    hasService,
    hasModule,
    hasFeature,
    navigateTo,
    apiGet,
    apiPost,
    apiDelete,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [nextMenuCode, setNextMenuCode] = useState('MNU-206');
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>('');

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [qty, setQty] = useState<string>('1');
  const [note, setNote] = useState<string>('');

  const [showNewTableModal, setShowNewTableModal] = useState(false);
  const [tableName, setTableName] = useState('');
  const [tableZone, setTableZone] = useState('Salón Principal');
  const [tableWaiter, setTableWaiter] = useState('Camila Restrepo');

  const [showNewDishModal, setShowNewDishModal] = useState(false);
  const [dishName, setDishName] = useState('');
  const [dishCategory, setDishCategory] = useState('Restaurante — Fuertes');
  const [dishPrice, setDishPrice] = useState('');
  const [dishTaxPct, setDishTaxPct] = useState('8');

  const [itemToDelete, setItemToDelete] = useState<{ table: DiningTable; item: OrderItem } | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<ComandasStateResponse>('/api/v1/comandas/tables');
      const tableList = data.tables || [];
      const combinedMenu: MenuItem[] = [...(data.products || [])];
      const seenCodes = new Set(combinedMenu.map((m) => m.code.toUpperCase()));
      const seenIds = new Set(combinedMenu.map((m) => m.id));

      if (hasService('ms-inventario')) {
        try {
          const inv = await apiGet<OptionalInventoryResponse>('/api/v1/inventario/all');
          for (const p of inv.products || []) {
            if (!p || p.salePrice <= 0) continue;
            if (seenIds.has(p.id) || seenCodes.has((p.code || '').toUpperCase())) continue;
            seenIds.add(p.id);
            if (p.code) seenCodes.add(p.code.toUpperCase());
            combinedMenu.push({
              id: p.id,
              code: p.code || 'CAT',
              name: p.name,
              category: p.category || 'Catálogo Inventario',
              salePrice: p.salePrice,
              taxPct: p.taxPct ?? 8,
            });
          }
        } catch {
          // Catálogo local permanece operativo si inventario no responde
        }
      }

      setNextMenuCode(data.nextMenuCode || 'MNU-206');
      setTables(tableList);
      setMenuItems(combinedMenu);

      setSelectedTableId((prev) => {
        if (prev && tableList.some((t) => t.id === prev)) return prev;
        return tableList.length > 0 ? tableList[0].id : '';
      });
      setSelectedProductId((prev) => {
        if (prev && combinedMenu.some((m) => m.id === prev)) return prev;
        return combinedMenu.length > 0 ? combinedMenu[0].id : '';
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No fue posible cargar las mesas y comandas');
    }
  }, [apiGet, hasService, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const currentTab =
    (VALID_MODULES as readonly string[]).includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : VALID_MODULES.find((m) => hasModule(m)) || 'mapa_mesas';

  const activeTable = tables.find((t) => t.id === selectedTableId) || tables[0] || null;
  const kitchenTables = tables.filter((t) => t.status === 'En Cocina');
  const occupiedCount = tables.filter((t) => t.status !== 'Libre').length;
  const activeSalesSum = tables.reduce((acc, t) => acc + (t.total || 0), 0);
  const notesEnabled = hasFeature('mapa_mesas', 'notas_preparacion');

  const handleCreateTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) {
      toast('Ingresa el nombre o número de la mesa');
      return;
    }
    void run(async () => {
      try {
        const res = await apiPost<{ table: DiningTable }>('/api/v1/comandas/tables', {
          name: tableName.trim(),
          zone: tableZone,
          waiter: tableWaiter.trim(),
        });
        toast(`Mesa registrada: ${res.table.name}`);
        setTableName('');
        setShowNewTableModal(false);
        await reload();
        setSelectedTableId(res.table.id);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al registrar la mesa');
      }
    });
  };

  const handleCreateMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = Number(dishPrice);
    if (!dishName.trim() || !Number.isFinite(numericPrice) || numericPrice <= 0) {
      toast('Ingresa nombre del plato y un precio de venta mayor a cero');
      return;
    }
    void run(async () => {
      try {
        const res = await apiPost<{ menuItem: MenuItem }>('/api/v1/comandas/menu-items', {
          name: dishName.trim(),
          category: dishCategory,
          salePrice: numericPrice,
          taxPct: Number(dishTaxPct || 8),
        });
        toast(`Plato agregado al menú: ${res.menuItem.name}`);
        setDishName('');
        setDishPrice('');
        setShowNewDishModal(false);
        await reload();
        setSelectedProductId(res.menuItem.id);
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al agregar plato al menú');
      }
    });
  };

  const addProductToActiveTable = (prod: MenuItem, customQty?: number) => {
    if (!activeTable) {
      toast('Selecciona primero una mesa para cargar el pedido');
      return;
    }
    const itemQty = customQty ?? Number(qty || 1);
    if (!Number.isFinite(itemQty) || itemQty <= 0) {
      toast('La cantidad debe ser mayor a cero');
      return;
    }
    void run(async () => {
      try {
        await apiPost(`/api/v1/comandas/tables/${encodeURIComponent(activeTable.id)}/items`, {
          productId: prod.id,
          name: prod.name,
          price: prod.salePrice,
          qty: itemQty,
          note: notesEnabled && customQty === undefined ? note.trim() : '',
        });
        if (customQty === undefined) {
          setNote('');
          setQty('1');
        }
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al cargar plato en la mesa');
      }
    });
  };

  const handleSubmitSelectedDish = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = menuItems.find((p) => p.id === selectedProductId);
    if (!prod) {
      toast('Selecciona un plato o bebida del menú');
      return;
    }
    addProductToActiveTable(prod);
  };

  const confirmRemoveItem = () => {
    if (!itemToDelete) return;
    const { table, item } = itemToDelete;
    void run(async () => {
      try {
        await apiDelete(
          `/api/v1/comandas/tables/${encodeURIComponent(table.id)}/items/${encodeURIComponent(item.itemId)}`
        );
        toast(`Línea retirada de ${table.name}`);
        setItemToDelete(null);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible retirar el plato');
      }
    });
  };

  const handleSendKitchen = () => {
    if (!activeTable) return;
    void run(async () => {
      try {
        await apiPost(`/api/v1/comandas/tables/${encodeURIComponent(activeTable.id)}/send-kitchen`, {});
        toast(`Comanda de ${activeTable.name} enviada a cocina y barra`);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible enviar la comanda a cocina');
      }
    });
  };

  const handleMarkReady = (tbl: DiningTable) => {
    void run(async () => {
      try {
        await apiPost(`/api/v1/comandas/tables/${encodeURIComponent(tbl.id)}/ready`, {});
        toast(`Pedido de ${tbl.name} marcado como listo para entrega`);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible actualizar el pedido');
      }
    });
  };

  const handlePassToPos = (tbl: DiningTable) => {
    if (!tbl.items || tbl.items.length === 0) {
      toast('La mesa no registra consumos activos para facturar');
      return;
    }
    if (!hasService('ms-facturacion')) {
      toast('El servicio de Facturación POS no está activo en la suscripción actual');
      return;
    }
    navigateTo('ms-facturacion', 'pos_mostrador', {
      linkedTableId: tbl.id,
      tableName: tbl.name,
      items: tbl.items.map((it) => {
        const prod = menuItems.find((p) => p.id === it.productId);
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
    toast(`Cuenta de ${tbl.name} transferida a Caja POS`);
  };

  const handleExportActiveTablesCsv = () => {
    downloadCsvUtf8(
      'estado_mesas_comandas.csv',
      ['ID Mesa', 'Mesa', 'Zona', 'Mesero', 'Estado', 'Platos', 'Total COP'],
      tables.map((t) => [t.id, t.name, t.zone, t.waiter, t.status, (t.items || []).length, t.total])
    );
  };

  const buildTablePrintPayload = (tbl: DiningTable, forKitchen: boolean): Record<string, unknown> => ({
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
    subtotal: forKitchen ? 0 : tbl.total,
    grand_total: forKitchen ? 0 : tbl.total,
    notes: forKitchen
      ? 'COMANDA DE PREPARACIÓN COCINA Y BARRA'
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
              { label: 'Mesas Ocupadas', value: String(occupiedCount), color: 'var(--pk-primary)' },
              { label: 'Comandas en Cocina', value: String(kitchenTables.length), color: 'var(--pk-amber)' },
              { label: 'Consumo Activo en Salón', value: formatCop(activeSalesSum), color: 'var(--pk-emerald)' },
            ]}
          />

          <div className="pk-grid-2">
            <div className="pk-card">
              <div className="pk-card-head">
                <div className="pk-card-title">🍽️ Mapa de Salón, Terraza y Barra</div>
                <div className="pk-row-actions">
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    onClick={handleExportActiveTablesCsv}
                  >
                    📥 CSV
                  </button>
                  <button
                    type="button"
                    className="pk-btn pk-btn-primary pk-btn-sm"
                    onClick={() => setShowNewTableModal(true)}
                  >
                    + Nueva Mesa
                  </button>
                </div>
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
                            {(tbl.items || []).length} línea(s)
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
                <div className="pk-row-actions">
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    onClick={() => setShowNewDishModal(true)}
                  >
                    + Nuevo Plato
                  </button>
                  {activeTable && <span className={badgeClassForStatus(activeTable.status)}>{activeTable.status}</span>}
                </div>
              </div>
              <div className="pk-card-body">
                {!activeTable ? (
                  <div style={{ color: 'var(--pk-muted)' }}>Crea o selecciona una mesa para registrar pedidos.</div>
                ) : (
                  <>
                    <form onSubmit={handleSubmitSelectedDish} style={{ marginBottom: 12 }}>
                      <div className="pk-form-grid">
                        <div className="pk-field">
                          <label>Carta / Platos y Bebidas</label>
                          <select
                            value={selectedProductId}
                            onChange={(e) => setSelectedProductId(e.target.value)}
                          >
                            {menuItems.map((p) => (
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
                            step="1"
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
                            placeholder="Ej: Término 3/4, sin cebolla, bebida sin hielo..."
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
                        <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                          ➕ Cargar a {activeTable.name}
                        </button>
                      </div>
                    </form>

                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                        ⚡ Adición Rápida de Carta:
                      </div>
                      <div className="pk-row-actions">
                        {menuItems.slice(0, 6).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            disabled={busy}
                            onClick={() => addProductToActiveTable(p, 1)}
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
                                Mesa disponible sin consumos registrados.
                              </td>
                            </tr>
                          ) : (
                            activeTable.items.map((it) => (
                              <tr key={it.itemId}>
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
                                    disabled={busy}
                                    onClick={() => setItemToDelete({ table: activeTable, item: it })}
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
                          disabled={busy || (activeTable.items || []).length === 0}
                          onClick={handleSendKitchen}
                        >
                          👨‍🍳 Enviar a Cocina
                        </button>
                        <PkPrintButton
                          label="🖨️ Precuenta 80mm"
                          payload={buildTablePrintPayload(activeTable, false)}
                        />
                        <button
                          type="button"
                          className="pk-btn pk-btn-emerald pk-btn-sm"
                          disabled={busy || (activeTable.items || []).length === 0}
                          onClick={() => handlePassToPos(activeTable)}
                        >
                          💵 Cobrar en Caja POS
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <PkModal
            open={showNewTableModal}
            title="Registrar Nueva Mesa o Ubicación"
            onClose={() => setShowNewTableModal(false)}
          >
            <form onSubmit={handleCreateTable} className="pk-form-grid">
              <div className="pk-field">
                <label>Nombre o Número de Mesa *</label>
                <input
                  required
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="Ej: Mesa 5 / Barra 2"
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
                  placeholder="Nombre del mesero responsable"
                />
              </div>
              <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
                <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                  💾 Crear Mesa
                </button>
              </div>
            </form>
          </PkModal>

          <PkModal
            open={showNewDishModal}
            title="Agregar Plato o Bebida a la Carta"
            onClose={() => setShowNewDishModal(false)}
          >
            <form onSubmit={handleCreateMenuItem} className="pk-form-grid">
              <PkAutoCodeInput label="Código Carta" value={nextMenuCode} />
              <div className="pk-field">
                <label>Nombre del Plato o Bebida *</label>
                <input
                  required
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  placeholder="Ej: Bandeja Ejecutiva Especial"
                />
              </div>
              <div className="pk-field">
                <label>Categoría</label>
                <select value={dishCategory} onChange={(e) => setDishCategory(e.target.value)}>
                  <option value="Restaurante — Fuertes">Restaurante — Fuertes</option>
                  <option value="Restaurante — Entradas">Restaurante — Entradas</option>
                  <option value="Barra y Bebidas">Barra y Bebidas</option>
                  <option value="Postres y Cafetería">Postres y Cafetería</option>
                </select>
              </div>
              <div className="pk-field">
                <label>Precio de Venta (COP) *</label>
                <input
                  required
                  type="number"
                  min="100"
                  step="100"
                  value={dishPrice}
                  onChange={(e) => setDishPrice(e.target.value)}
                  placeholder="Ej: 36000"
                />
              </div>
              <div className="pk-field">
                <label>Impoconsumo / IVA (%)</label>
                <select value={dishTaxPct} onChange={(e) => setDishTaxPct(e.target.value)}>
                  <option value="8">8% Impoconsumo</option>
                  <option value="19">19% IVA</option>
                  <option value="0">0% Exento</option>
                </select>
              </div>
              <div className="pk-field" style={{ justifyContent: 'flex-end' }}>
                <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                  💾 Guardar en Carta
                </button>
              </div>
            </form>
          </PkModal>

          <PkConfirmModal
            open={Boolean(itemToDelete)}
            title="Retirar Plato de la Comanda"
            message={
              itemToDelete
                ? `¿Confirmas retirar "${itemToDelete.item.name}" (${itemToDelete.item.qty} und.) de ${itemToDelete.table.name}?`
                : ''
            }
            confirmLabel="Retirar Línea"
            busy={busy}
            onConfirm={confirmRemoveItem}
            onCancel={() => setItemToDelete(null)}
          />
        </ModuleGate>
      )}

      {currentTab === 'monitor_cocina' && (
        <ModuleGate module="monitor_cocina">
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                👨‍🍳 Monitor en Vivo de Cocina y Barra ({kitchenTables.length} pendientes)
              </div>
              <button
                type="button"
                className="pk-btn pk-btn-outline pk-btn-sm"
                disabled={busy}
                onClick={() => void reload()}
              >
                🔄 Actualizar Pantalla
              </button>
            </div>
            <div className="pk-card-body">
              {kitchenTables.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--pk-muted)' }}>
                  No hay comandas pendientes de preparación en este momento.
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
                        {(tbl.items || []).map((it) => (
                          <div key={it.itemId} style={{ marginBottom: 8 }}>
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
                          disabled={busy}
                          onClick={() => handleMarkReady(tbl)}
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

export default ComandasView;
