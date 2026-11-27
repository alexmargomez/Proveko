import React, { useMemo, useState } from 'react';
import {
  PkKpiRow,
  PkLiveHeader,
  formatCop,
  downloadCsvUtf8,
} from '@platform/ui-sdk';
import {
  DiningTable,
  MenuItem,
  WaiterRecord,
  resolveStage,
} from './comandasTypes';

interface TablesCatalogProps {
  tables: DiningTable[];
  busy: boolean;
  onOpenNewTable: () => void;
  onEditTable: (tbl: DiningTable) => void;
  onDeleteTable: (tbl: DiningTable) => void;
  onOpenTableDetail: (tbl: DiningTable) => void;
}

export const TablesCatalogSection: React.FC<TablesCatalogProps> = ({
  tables,
  busy,
  onOpenNewTable,
  onEditTable,
  onDeleteTable,
  onOpenTableDetail,
}) => {
  const [zonePill, setZonePill] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const zones = useMemo(() => {
    const set = new Set<string>();
    for (const t of tables) {
      if (t.zone) set.add(t.zone);
    }
    return Array.from(set);
  }, [tables]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((t) => {
      if (zonePill !== 'ALL' && t.zone !== zonePill) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.zone.toLowerCase().includes(q) ||
        (t.waiter || '').toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [tables, zonePill, search]);

  const totalSeats = useMemo(
    () => tables.reduce((acc, t) => acc + (t.guests && t.guests > 0 ? t.guests : 4), 0),
    [tables]
  );
  const freeCount = useMemo(
    () => tables.filter((t) => resolveStage(t) === 'LIBRE').length,
    [tables]
  );

  return (
    <div className="pk-stack">
      <PkLiveHeader
        title="Mesas y Ambientes"
        subtitle="Listado maestro de mesas físicas del establecimiento, capacidad de puestos, ambientes y mesero responsable."
        primaryActionLabel="+ Nueva Mesa"
        onPrimaryAction={onOpenNewTable}
        pills={[
          { key: 'ALL', label: 'Todos los Ambientes', count: tables.length },
          ...zones.map((z) => ({
            key: z,
            label: z,
            count: tables.filter((t) => t.zone === z).length,
          })),
        ]}
        activePill={zonePill}
        onPillChange={setZonePill}
        extraActions={
          <div className="pk-row-actions">
            <input
              className="pk-input"
              style={{ minWidth: 'min(100%, 230px)', minHeight: 38 }}
              placeholder="Buscar mesa, ambiente o mesero..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="pk-btn pk-btn-outline pk-btn-sm"
              onClick={() =>
                downloadCsvUtf8(
                  'catalogo_mesas.csv',
                  ['Código', 'Mesa', 'Ambiente', 'Capacidad', 'Mesero Asignado', 'Estado', 'Consumo Actual'],
                  tables.map((t) => [
                    t.id.toUpperCase(),
                    t.name,
                    t.zone,
                    t.guests && t.guests > 0 ? t.guests : 4,
                    t.waiter || 'Sin asignar',
                    resolveStage(t) === 'LIBRE' ? 'Disponible' : 'Ocupada',
                    t.total,
                  ])
                )
              }
            >
              CSV
            </button>
          </div>
        }
      />

      <PkKpiRow
        items={[
          {
            label: 'Mesas Registradas',
            value: String(tables.length),
            color: 'var(--pk-navy)',
          },
          {
            label: 'Aforo Total Instalado',
            value: `${totalSeats} puestos`,
            color: 'var(--pk-primary)',
          },
          {
            label: 'Disponibles Ahora',
            value: String(freeCount),
            color: 'var(--pk-emerald)',
          },
          {
            label: 'Con Cuenta Activa',
            value: String(tables.length - freeCount),
            color: 'var(--pk-amber)',
          },
        ]}
      />

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">Directorio de Mesas ({filtered.length})</div>
        </div>
        <div className="pk-card-body">
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Mesa / Ubicación</th>
                  <th>Ambiente / Zona</th>
                  <th>Capacidad</th>
                  <th>Mesero Base</th>
                  <th>Estado Operativo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tbl) => {
                  const stg = resolveStage(tbl);
                  const isFree = stg === 'LIBRE';
                  return (
                    <tr key={tbl.id}>
                      <td>
                        <strong>{tbl.name}</strong>
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                          {tbl.id.toUpperCase()}
                        </div>
                      </td>
                      <td>{tbl.zone}</td>
                      <td>{tbl.guests && tbl.guests > 0 ? `${tbl.guests} puestos` : '4 puestos'}</td>
                      <td>{tbl.waiter || 'Turno General'}</td>
                      <td>
                        <span className={`pk-badge ${isFree ? 'pk-badge-emerald' : 'pk-badge-blue'}`}>
                          {isFree
                            ? 'Disponible'
                            : `${tbl.orderCode ? `${tbl.orderCode} · ` : ''}${formatCop(tbl.total)}`}
                        </span>
                      </td>
                      <td>
                        <div className="pk-row-actions">
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            onClick={() => onOpenTableDetail(tbl)}
                          >
                            Ver Cuenta
                          </button>
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            disabled={busy}
                            onClick={() => onEditTable(tbl)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="pk-btn pk-btn-danger pk-btn-sm"
                            disabled={busy || !isFree}
                            title={
                              isFree
                                ? 'Eliminar mesa'
                                : 'Liquida o retira la cuenta abierta antes de eliminar la mesa'
                            }
                            onClick={() => onDeleteTable(tbl)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}
                    >
                      No hay mesas registradas para el filtro seleccionado.
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

interface MenuServicesProps {
  menuItems: MenuItem[];
  nextMenuCode: string;
  busy: boolean;
  onOpenNewItem: () => void;
  onEditItem: (item: MenuItem) => void;
  onDeleteItem: (item: MenuItem) => void;
}

export const MenuServicesSection: React.FC<MenuServicesProps> = ({
  menuItems,
  nextMenuCode,
  busy,
  onOpenNewItem,
  onEditItem,
  onDeleteItem,
}) => {
  const [catPill, setCatPill] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const m of menuItems) {
      if (m.category) set.add(m.category);
    }
    return Array.from(set);
  }, [menuItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menuItems.filter((m) => {
      if (catPill !== 'ALL' && m.category !== catPill) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    });
  }, [menuItems, catPill, search]);

  const localItemsCount = useMemo(
    () => menuItems.filter((m) => !m.fromInventory).length,
    [menuItems]
  );
  const avgPrice = useMemo(() => {
    if (menuItems.length === 0) return 0;
    return menuItems.reduce((acc, m) => acc + m.salePrice, 0) / menuItems.length;
  }, [menuItems]);

  return (
    <div className="pk-stack">
      <PkLiveHeader
        title="Carta y Servicios Gastronómicos"
        subtitle="Catálogo completo de platos, bebidas y servicios de atención con tarifas e impuestos para comandas y facturación."
        primaryActionLabel="+ Nuevo Servicio / Plato"
        onPrimaryAction={onOpenNewItem}
        pills={[
          { key: 'ALL', label: 'Toda la Carta', count: menuItems.length },
          ...categories.map((c) => ({
            key: c,
            label: c,
            count: menuItems.filter((m) => m.category === c).length,
          })),
        ]}
        activePill={catPill}
        onPillChange={setCatPill}
        extraActions={
          <div className="pk-row-actions">
            <input
              className="pk-input"
              style={{ minWidth: 'min(100%, 230px)', minHeight: 38 }}
              placeholder="Buscar código, plato o servicio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="pk-btn pk-btn-outline pk-btn-sm"
              onClick={() =>
                downloadCsvUtf8(
                  'carta_y_servicios.csv',
                  ['Código', 'Nombre', 'Categoría', 'Impuesto %', 'Precio Venta COP', 'Origen'],
                  menuItems.map((m) => [
                    m.code,
                    m.name,
                    m.category,
                    m.taxPct,
                    m.salePrice,
                    m.fromInventory ? 'Inventario Bodega' : 'Carta Gastronómica',
                  ])
                )
              }
            >
              CSV
            </button>
          </div>
        }
      />

      <PkKpiRow
        items={[
          {
            label: 'Total en Carta',
            value: String(menuItems.length),
            color: 'var(--pk-navy)',
          },
          {
            label: 'Platos / Servicios Propios',
            value: String(localItemsCount),
            color: 'var(--pk-primary)',
          },
          {
            label: 'Categorías Activas',
            value: String(categories.length),
            color: 'var(--pk-emerald)',
          },
          {
            label: 'Precio Promedio',
            value: formatCop(avgPrice),
            color: 'var(--pk-amber)',
          },
        ]}
      />

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">Listado de Platos, Bebidas y Servicios ({filtered.length})</div>
          <span className="pk-badge pk-badge-slate">Próximo Código: {nextMenuCode}</span>
        </div>
        <div className="pk-card-body">
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Plato, Bebida o Servicio</th>
                  <th>Categoría</th>
                  <th>Impuesto</th>
                  <th>Precio Unitario</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.code}</strong>
                    </td>
                    <td>
                      <strong>{item.name}</strong>
                      {item.fromInventory && (
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                          Sincronizado desde Inventario
                        </div>
                      )}
                    </td>
                    <td>{item.category}</td>
                    <td>{item.taxPct}%</td>
                    <td>
                      <strong>{formatCop(item.salePrice)}</strong>
                    </td>
                    <td>
                      {item.fromInventory ? (
                        <span className="pk-badge pk-badge-slate">Inventario</span>
                      ) : (
                        <div className="pk-row-actions">
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            disabled={busy}
                            onClick={() => onEditItem(item)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="pk-btn pk-btn-danger pk-btn-sm"
                            disabled={busy}
                            onClick={() => onDeleteItem(item)}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}
                    >
                      No se encontraron platos ni servicios para los filtros actuales.
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

interface WaitersDirectoryProps {
  waiters: WaiterRecord[];
  tables: DiningTable[];
  nextWaiterCode: string;
  busy: boolean;
  onOpenNewWaiter: () => void;
  onEditWaiter: (waiter: WaiterRecord) => void;
  onDeleteWaiter: (waiter: WaiterRecord) => void;
}

export const WaitersDirectorySection: React.FC<WaitersDirectoryProps> = ({
  waiters,
  tables,
  nextWaiterCode,
  busy,
  onOpenNewWaiter,
  onEditWaiter,
  onDeleteWaiter,
}) => {
  const [statusPill, setStatusPill] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [search, setSearch] = useState('');

  const activeOrderCountByWaiter = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tables) {
      if (resolveStage(t) === 'LIBRE' || (t.items || []).length === 0) continue;
      const key = (t.waiter || '').trim().toLowerCase();
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [tables]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return waiters.filter((w) => {
      if (statusPill === 'ACTIVE' && !w.active) return false;
      if (statusPill === 'INACTIVE' && w.active) return false;
      if (!q) return true;
      return (
        w.fullName.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q) ||
        (w.docId || '').toLowerCase().includes(q) ||
        (w.phone || '').toLowerCase().includes(q) ||
        (w.zone || '').toLowerCase().includes(q)
      );
    });
  }, [waiters, statusPill, search]);

  const activeWaitersCount = useMemo(
    () => waiters.filter((w) => w.active).length,
    [waiters]
  );

  return (
    <div className="pk-stack">
      <PkLiveHeader
        title="Meseros y Personal de Atención"
        subtitle="Directorio operativo de meseros, anfitriones y baristas con asignación de ambiente, turno y cuentas en atención."
        primaryActionLabel="+ Nuevo Mesero"
        onPrimaryAction={onOpenNewWaiter}
        pills={[
          { key: 'ALL', label: 'Todo el Personal', count: waiters.length },
          { key: 'ACTIVE', label: 'Activos en Turno', count: activeWaitersCount },
          {
            key: 'INACTIVE',
            label: 'Inactivos',
            count: waiters.length - activeWaitersCount,
          },
        ]}
        activePill={statusPill}
        onPillChange={(k) => setStatusPill(k as 'ALL' | 'ACTIVE' | 'INACTIVE')}
        extraActions={
          <div className="pk-row-actions">
            <input
              className="pk-input"
              style={{ minWidth: 'min(100%, 230px)', minHeight: 38 }}
              placeholder="Buscar mesero, documento o zona..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="pk-btn pk-btn-outline pk-btn-sm"
              onClick={() =>
                downloadCsvUtf8(
                  'directorio_meseros.csv',
                  ['Código', 'Nombre Completo', 'Documento', 'Teléfono', 'Ambiente Base', 'Turno', 'Estado'],
                  waiters.map((w) => [
                    w.code,
                    w.fullName,
                    w.docId || '—',
                    w.phone || '—',
                    w.zone,
                    w.shift,
                    w.active ? 'Activo' : 'Inactivo',
                  ])
                )
              }
            >
              CSV
            </button>
          </div>
        }
      />

      <PkKpiRow
        items={[
          {
            label: 'Personal Registrado',
            value: String(waiters.length),
            color: 'var(--pk-navy)',
          },
          {
            label: 'Meseros Activos',
            value: String(activeWaitersCount),
            color: 'var(--pk-emerald)',
          },
          {
            label: 'Cuentas Atendidas Hoy',
            value: String(
              Array.from(activeOrderCountByWaiter.values()).reduce((a, b) => a + b, 0)
            ),
            color: 'var(--pk-primary)',
          },
          {
            label: 'Inactivos / Descanso',
            value: String(waiters.length - activeWaitersCount),
            color: 'var(--pk-amber)',
          },
        ]}
      />

      <div className="pk-card">
        <div className="pk-card-head">
          <div className="pk-card-title">Listado de Meseros ({filtered.length})</div>
          <span className="pk-badge pk-badge-slate">Próximo Código: {nextWaiterCode}</span>
        </div>
        <div className="pk-card-body">
          <div className="pk-table-wrap">
            <table className="pk-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Mesero / Documento</th>
                  <th>Contacto</th>
                  <th>Ambiente / Turno</th>
                  <th>Cuentas en Vivo</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => {
                  const liveCount =
                    activeOrderCountByWaiter.get(w.fullName.trim().toLowerCase()) || 0;
                  return (
                    <tr key={w.id}>
                      <td>
                        <strong>{w.code}</strong>
                      </td>
                      <td>
                        <strong>{w.fullName}</strong>
                        {w.docId && (
                          <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>
                            ID: {w.docId}
                          </div>
                        )}
                      </td>
                      <td>{w.phone || '—'}</td>
                      <td>
                        <div>{w.zone}</div>
                        <div style={{ fontSize: 11, color: 'var(--pk-muted)' }}>{w.shift}</div>
                      </td>
                      <td>
                        {liveCount > 0 ? (
                          <span className="pk-badge pk-badge-blue">{liveCount} activa(s)</span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--pk-muted)' }}>Sin cuentas</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`pk-badge ${
                            w.active ? 'pk-badge-emerald' : 'pk-badge-slate'
                          }`}
                        >
                          {w.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="pk-row-actions">
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            disabled={busy}
                            onClick={() => onEditWaiter(w)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="pk-btn pk-btn-danger pk-btn-sm"
                            disabled={busy}
                            onClick={() => onDeleteWaiter(w)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}
                    >
                      No hay meseros registrados para el filtro actual. Usa &quot;+ Nuevo Mesero&quot; para registrar personal.
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
