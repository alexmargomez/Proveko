import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  usePlatform,
  ModuleGate,
  FeatureGate,
  PkAutoCodeInput,
  PkSelect,
  PkSimpleSelect,
  PkModal,
  PkConfirmModal,
  PkPrintButton,
  PkKpiRow,
  PkLiveHeader,
  PkKanbanBoard,
  PkTicketCard,
  PkProcessNodes,
  PkTypeCards,
  PkFullscreenDialog,
  useAsyncAction,
  formatCop,
  downloadCsvUtf8,
} from '@platform/ui-sdk';
import {
  OrderChannel,
  OrderStage,
  ChannelPillKey,
  SalonDisplayMode,
  MenuItem,
  WaiterRecord,
  OrderItem,
  DiningTable,
  DraftOrderLine,
  ComandasStateResponse,
  OptionalInventoryResponse,
  VALID_MODULES,
  TABLE_ZONE_OPTIONS,
  FLOOR_ZONE_PILLS,
  DISH_CATEGORY_OPTIONS,
  DISH_TAX_OPTIONS,
  WAITER_SHIFT_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PICKUP_WINDOW_OPTIONS,
  CHANNEL_TYPE_CARDS,
  KITCHEN_NOTE_PRESETS,
  resolveChannel,
  resolveStage,
  formatOpenedElapsed,
  channelBadgeFor,
  buildOrderProcessSteps,
  buildComandaPrintPayload,
} from './comandasTypes';
import {
  TablesCatalogSection,
  MenuServicesSection,
  WaitersDirectorySection,
} from './ComandasCatalogViews';

export const ComandasView: React.FC = () => {
  const {
    activeModuleKey,
    hasService,
    hasModule,
    hasFeature,
    navigateTo,
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    toast,
  } = usePlatform();
  const { busy, run } = useAsyncAction();

  const [salonView, setSalonView] = useState<SalonDisplayMode>('floor');
  const [channelFilter, setChannelFilter] = useState<ChannelPillKey>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [floorZonePill, setFloorZonePill] = useState<string>('Todas las Zonas');

  const [nextMenuCode, setNextMenuCode] = useState('MNU-209');
  const [nextWaiterCode, setNextWaiterCode] = useState('MSR-305');
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [waiters, setWaiters] = useState<WaiterRecord[]>([]);

  // Modal detail when clicking a table or order card in Mapa de Mesas
  const [detailModalTableId, setDetailModalTableId] = useState<string | null>(null);

  // Fullscreen Order Creation Studio
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioChannel, setStudioChannel] = useState<OrderChannel>('MESA');
  const [studioTableId, setStudioTableId] = useState('');
  const [studioGuests, setStudioGuests] = useState('4');
  const [studioWaiter, setStudioWaiter] = useState('');
  const [studioCustomerName, setStudioCustomerName] = useState('');
  const [studioCustomerPhone, setStudioCustomerPhone] = useState('');
  const [studioDeliveryAddress, setStudioDeliveryAddress] = useState('');
  const [studioCashChangeFor, setStudioCashChangeFor] = useState('');
  const [studioPickupWindow, setStudioPickupWindow] = useState(PICKUP_WINDOW_OPTIONS[0].value);
  const [studioPaymentMethod, setStudioPaymentMethod] = useState('Tarjeta crédito / débito');
  const [studioMenuCategory, setStudioMenuCategory] = useState('TODAS');
  const [studioMenuSearch, setStudioMenuSearch] = useState('');
  const [studioQuickNote, setStudioQuickNote] = useState('');
  const [draftLines, setDraftLines] = useState<DraftOrderLine[]>([]);

  // Create / Edit Table Modal
  const [showTableModal, setShowTableModal] = useState(false);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [tableName, setTableName] = useState('');
  const [tableZone, setTableZone] = useState('Salón Principal');
  const [tableWaiter, setTableWaiter] = useState('');
  const [tableCapacity, setTableCapacity] = useState('4');

  // Create / Edit Dish or Service Modal
  const [showDishModal, setShowDishModal] = useState(false);
  const [editingDish, setEditingDish] = useState<MenuItem | null>(null);
  const [dishName, setDishName] = useState('');
  const [dishCategory, setDishCategory] = useState('Restaurante — Fuertes');
  const [dishPrice, setDishPrice] = useState('');
  const [dishTaxPct, setDishTaxPct] = useState('8');

  // Create / Edit Waiter Modal
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState<WaiterRecord | null>(null);
  const [waiterFullName, setWaiterFullName] = useState('');
  const [waiterDocId, setWaiterDocId] = useState('');
  const [waiterPhone, setWaiterPhone] = useState('');
  const [waiterZone, setWaiterZone] = useState('Salón Principal');
  const [waiterShift, setWaiterShift] = useState('Turno Completo');
  const [waiterActive, setWaiterActive] = useState('true');

  // Confirmation Modals
  const [itemToDelete, setItemToDelete] = useState<{ table: DiningTable; item: OrderItem } | null>(
    null
  );
  const [tableToDelete, setTableToDelete] = useState<DiningTable | null>(null);
  const [dishToDelete, setDishToDelete] = useState<MenuItem | null>(null);
  const [waiterToDelete, setWaiterToDelete] = useState<WaiterRecord | null>(null);

  const reload = useCallback(async () => {
    try {
      const data = await apiGet<ComandasStateResponse>('/api/v1/comandas/tables');
      const tableList = data.tables || [];
      const combinedMenu: MenuItem[] = (data.products || []).map((m) => ({
        ...m,
        fromInventory: false,
      }));
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
              fromInventory: true,
            });
          }
        } catch {
          // Mantiene carta gastronómica local cuando inventario no está disponible
        }
      }

      setNextMenuCode(data.nextMenuCode || 'MNU-209');
      setNextWaiterCode(data.nextWaiterCode || 'MSR-305');
      setTables(tableList);
      setMenuItems(combinedMenu);
      setWaiters(data.waiters || []);

      const physical = tableList.filter((t) => resolveChannel(t) === 'MESA');
      setStudioTableId((prev) => {
        if (prev && physical.some((t) => t.id === prev)) return prev;
        return physical.length > 0 ? physical[0].id : '';
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No fue posible cargar las comandas en vivo');
    }
  }, [apiGet, hasService, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const currentModule =
    (VALID_MODULES as readonly string[]).includes(activeModuleKey) && hasModule(activeModuleKey)
      ? activeModuleKey
      : VALID_MODULES.find((m) => hasModule(m)) || 'mapa_mesas';

  const canManageOrders =
    hasModule('mapa_mesas') ||
    hasModule('catalogo_mesas') ||
    hasModule('carta_servicios') ||
    hasModule('directorio_meseros');
  const notesEnabled = hasFeature('mapa_mesas', 'notas_preparacion');

  const physicalTables = useMemo(
    () => tables.filter((t) => resolveChannel(t) === 'MESA'),
    [tables]
  );

  const activeOrders = useMemo(
    () => tables.filter((t) => resolveStage(t) !== 'LIBRE' && (t.items || []).length > 0),
    [tables]
  );

  const detailModalTable = useMemo(
    () => (detailModalTableId ? tables.find((t) => t.id === detailModalTableId) || null : null),
    [tables, detailModalTableId]
  );

  const waiterSelectItems = useMemo(() => {
    const activeList = waiters.filter((w) => w.active);
    const seen = new Set(activeList.map((w) => w.fullName.trim().toLowerCase()));
    const out: Array<{ value: string; label: string }> = activeList.map((w) => ({
      value: w.fullName,
      label: `${w.fullName} — ${w.zone}`,
    }));
    for (const extra of [studioWaiter, tableWaiter]) {
      const clean = extra.trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        out.push({ value: clean, label: clean });
      }
    }
    if (out.length === 0) {
      out.push({ value: 'Mesero Turno', label: 'Mesero Turno' });
    }
    return out;
  }, [waiters, studioWaiter, tableWaiter]);

  const countsByChannel = useMemo(() => {
    let mesa = 0;
    let domicilio = 0;
    let llevar = 0;
    for (const ord of activeOrders) {
      const ch = resolveChannel(ord);
      if (ch === 'DOMICILIO') domicilio += 1;
      else if (ch === 'PARA_LLEVAR') llevar += 1;
      else mesa += 1;
    }
    return {
      all: activeOrders.length,
      mesa,
      domicilio,
      llevar,
    };
  }, [activeOrders]);

  const filteredActiveOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeOrders.filter((ord) => {
      const ch = resolveChannel(ord);
      if (channelFilter !== 'ALL' && ch !== channelFilter) return false;
      if (!q) return true;
      const itemsText = (ord.items || [])
        .map((i) => `${i.name} ${i.note || ''}`)
        .join(' ')
        .toLowerCase();
      return (
        (ord.orderCode || '').toLowerCase().includes(q) ||
        ord.name.toLowerCase().includes(q) ||
        (ord.customerName || '').toLowerCase().includes(q) ||
        (ord.customerPhone || '').toLowerCase().includes(q) ||
        (ord.deliveryAddress || '').toLowerCase().includes(q) ||
        (ord.waiter || '').toLowerCase().includes(q) ||
        itemsText.includes(q)
      );
    });
  }, [activeOrders, channelFilter, searchQuery]);

  const kanbanBuckets = useMemo(() => {
    const nuevas: DiningTable[] = [];
    const preparando: DiningTable[] = [];
    const listas: DiningTable[] = [];
    const entregadas: DiningTable[] = [];

    for (const ord of filteredActiveOrders) {
      const stg = resolveStage(ord);
      if (stg === 'PREPARANDO') preparando.push(ord);
      else if (stg === 'LISTA') listas.push(ord);
      else if (stg === 'ENTREGADA') entregadas.push(ord);
      else nuevas.push(ord);
    }
    return { nuevas, preparando, listas, entregadas };
  }, [filteredActiveOrders]);

  const floorZoneList = useMemo(() => {
    const base: string[] = [...FLOOR_ZONE_PILLS];
    for (const t of physicalTables) {
      if (t.zone && !base.includes(t.zone)) {
        base.push(t.zone);
      }
    }
    return base;
  }, [physicalTables]);

  const filteredFloorTables = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return physicalTables.filter((t) => {
      if (floorZonePill !== 'Todas las Zonas' && t.zone !== floorZonePill) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.zone.toLowerCase().includes(q) ||
        (t.waiter || '').toLowerCase().includes(q) ||
        (t.customerName || '').toLowerCase().includes(q) ||
        (t.orderCode || '').toLowerCase().includes(q)
      );
    });
  }, [physicalTables, floorZonePill, searchQuery]);

  const menuCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const m of menuItems) {
      if (m.category) cats.add(m.category);
    }
    return ['TODAS', ...Array.from(cats)];
  }, [menuItems]);

  const filteredStudioMenu = useMemo(() => {
    const q = studioMenuSearch.trim().toLowerCase();
    return menuItems.filter((m) => {
      if (studioMenuCategory !== 'TODAS' && m.category !== studioMenuCategory) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.code.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    });
  }, [menuItems, studioMenuCategory, studioMenuSearch]);

  const selectedStudioTable = useMemo(
    () => physicalTables.find((t) => t.id === studioTableId) || null,
    [physicalTables, studioTableId]
  );

  const draftSubtotal = useMemo(
    () => draftLines.reduce((acc, l) => acc + l.qty * l.price, 0),
    [draftLines]
  );

  const existingTableTotal =
    studioChannel === 'MESA' && selectedStudioTable ? selectedStudioTable.total || 0 : 0;
  const studioProjectedTotal = existingTableTotal + draftSubtotal;

  const totalLiveBilling = useMemo(
    () => activeOrders.reduce((acc, t) => acc + (t.total || 0), 0),
    [activeOrders]
  );

  const openOrderStudio = useCallback(
    (preset?: { channel?: OrderChannel; table?: DiningTable }) => {
      const targetChannel =
        preset?.channel ||
        (channelFilter === 'DOMICILIO'
          ? 'DOMICILIO'
          : channelFilter === 'PARA_LLEVAR'
          ? 'PARA_LLEVAR'
          : 'MESA');

      setDetailModalTableId(null);
      setStudioChannel(targetChannel);
      const fallbackWaiter = waiters.find((w) => w.active)?.fullName || 'Mesero Turno';

      if (preset?.table) {
        setStudioTableId(preset.table.id);
        setStudioWaiter(preset.table.waiter || fallbackWaiter);
        setStudioGuests(
          String(preset.table.guests && preset.table.guests > 0 ? preset.table.guests : 4)
        );
        setStudioCustomerName(preset.table.customerName || '');
        setStudioPaymentMethod(preset.table.paymentHint || 'Tarjeta crédito / débito');
      } else {
        const defaultTable =
          physicalTables.find((t) => resolveStage(t) === 'LIBRE') || physicalTables[0] || null;
        if (defaultTable) {
          setStudioTableId(defaultTable.id);
          setStudioWaiter(defaultTable.waiter || fallbackWaiter);
          setStudioGuests(
            String(defaultTable.guests && defaultTable.guests > 0 ? defaultTable.guests : 4)
          );
        } else {
          setStudioWaiter(fallbackWaiter);
        }
        setStudioCustomerName('');
        setStudioCustomerPhone('');
        setStudioDeliveryAddress('');
        setStudioCashChangeFor('');
        setStudioPaymentMethod(
          targetChannel === 'DOMICILIO' ? 'Efectivo contraentrega' : 'Tarjeta crédito / débito'
        );
      }
      setDraftLines([]);
      setStudioQuickNote('');
      setStudioMenuCategory('TODAS');
      setStudioMenuSearch('');
      setStudioOpen(true);
    },
    [channelFilter, physicalTables, waiters]
  );

  const handleSelectStudioTable = (newTableId: string) => {
    setStudioTableId(newTableId);
    const found = physicalTables.find((t) => t.id === newTableId);
    if (found) {
      setStudioWaiter(found.waiter || '');
      if (found.guests && found.guests > 0) {
        setStudioGuests(String(found.guests));
      }
      if (found.customerName) {
        setStudioCustomerName(found.customerName);
      }
    }
  };

  const addDishToDraft = (dish: MenuItem) => {
    const cleanNote = notesEnabled ? studioQuickNote.trim() : '';
    setDraftLines((prev) => {
      const existingIdx = prev.findIndex(
        (l) => l.productId === dish.id && l.note.trim() === cleanNote
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], qty: copy[existingIdx].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          draftId: `${dish.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          productId: dish.id,
          code: dish.code,
          name: dish.name,
          price: dish.salePrice,
          qty: 1,
          note: cleanNote,
        },
      ];
    });
    if (cleanNote) {
      setStudioQuickNote('');
    }
  };

  const updateDraftQty = (draftId: string, delta: number) => {
    setDraftLines((prev) =>
      prev
        .map((l) => (l.draftId === draftId ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  };

  const updateDraftNote = (draftId: string, nextNote: string) => {
    setDraftLines((prev) =>
      prev.map((l) => (l.draftId === draftId ? { ...l, note: nextNote } : l))
    );
  };

  const removeDraftLine = (draftId: string) => {
    setDraftLines((prev) => prev.filter((l) => l.draftId !== draftId));
  };

  const handleSubmitStudioOrder = () => {
    if (draftLines.length === 0) {
      toast('Agrega al menos un plato o servicio al pedido antes de confirmar');
      return;
    }
    if (studioChannel === 'MESA' && !studioTableId) {
      toast('Selecciona o crea una mesa destino para la comanda');
      return;
    }
    if (studioChannel === 'DOMICILIO') {
      if (!studioCustomerName.trim()) {
        toast('Ingresa el nombre del cliente para el domicilio');
        return;
      }
      if (!studioDeliveryAddress.trim()) {
        toast('Ingresa la dirección exacta de entrega');
        return;
      }
    }
    if (studioChannel === 'PARA_LLEVAR' && !studioCustomerName.trim()) {
      toast('Ingresa el nombre de quien retira el pedido');
      return;
    }

    const composedPaymentHint =
      studioChannel === 'DOMICILIO' && studioCashChangeFor.trim()
        ? `${studioPaymentMethod} — cambio de $${studioCashChangeFor.trim()}`
        : studioPaymentMethod;

    const effectiveAddress =
      studioChannel === 'DOMICILIO'
        ? studioDeliveryAddress.trim()
        : studioChannel === 'PARA_LLEVAR'
        ? studioPickupWindow
        : '';

    void run(async () => {
      try {
        const res = await apiPost<{ table: DiningTable }>('/api/v1/comandas/orders', {
          channel: studioChannel,
          tableId: studioChannel === 'MESA' ? studioTableId : '',
          waiter: studioWaiter.trim(),
          customerName: studioCustomerName.trim(),
          customerPhone: studioCustomerPhone.trim(),
          deliveryAddress: effectiveAddress,
          guests: studioChannel === 'MESA' ? Math.max(1, Number(studioGuests || 1)) : 0,
          paymentHint: composedPaymentHint,
          items: draftLines.map((l) => ({
            productId: l.productId,
            name: l.name,
            price: l.price,
            qty: l.qty,
            note: notesEnabled ? l.note.trim() : '',
          })),
        });
        toast(`Comanda ${res.table.orderCode || res.table.name} registrada y enviada`);
        setStudioOpen(false);
        setDraftLines([]);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible registrar la comanda');
      }
    });
  };

  const handleStageChange = (tbl: DiningTable, nextStage: OrderStage) => {
    void run(async () => {
      try {
        await apiPost(`/api/v1/comandas/tables/${encodeURIComponent(tbl.id)}/stage`, {
          stage: nextStage,
        });
        const stageLabels: Record<OrderStage, string> = {
          LIBRE: 'Libre',
          NUEVA: 'Nueva',
          PREPARANDO: 'En preparación de cocina',
          LISTA: 'Lista para despacho',
          ENTREGADA: 'Pedido entregado',
        };
        toast(`${tbl.orderCode || tbl.name}: ${stageLabels[nextStage]}`);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible actualizar la etapa');
      }
    });
  };

  // --- Table Modal Handlers ---
  const openCreateTableModal = () => {
    setEditingTable(null);
    setTableName('');
    setTableZone('Salón Principal');
    setTableCapacity('4');
    setTableWaiter(waiters.find((w) => w.active)?.fullName || '');
    setShowTableModal(true);
  };

  const openEditTableModal = (tbl: DiningTable) => {
    setEditingTable(tbl);
    setTableName(tbl.name);
    setTableZone(tbl.zone || 'Salón Principal');
    setTableCapacity(String(tbl.guests && tbl.guests > 0 ? tbl.guests : 4));
    setTableWaiter(tbl.waiter || '');
    setShowTableModal(true);
  };

  const handleSaveTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) {
      toast('Ingresa el nombre o número de la mesa');
      return;
    }
    void run(async () => {
      try {
        const payload = {
          name: tableName.trim(),
          zone: tableZone,
          waiter: tableWaiter.trim(),
          guests: Math.max(1, Number(tableCapacity || 4)),
        };
        if (editingTable) {
          const res = await apiPut<{ table: DiningTable }>(
            `/api/v1/comandas/tables/${encodeURIComponent(editingTable.id)}`,
            payload
          );
          toast(`Mesa actualizada: ${res.table.name}`);
        } else {
          const res = await apiPost<{ table: DiningTable }>('/api/v1/comandas/tables', payload);
          toast(`Mesa registrada: ${res.table.name}`);
          setStudioTableId(res.table.id);
          if (res.table.waiter) setStudioWaiter(res.table.waiter);
        }
        setShowTableModal(false);
        setEditingTable(null);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al guardar la mesa');
      }
    });
  };

  const confirmDeleteTable = () => {
    if (!tableToDelete) return;
    const target = tableToDelete;
    void run(async () => {
      try {
        await apiDelete(`/api/v1/comandas/tables/${encodeURIComponent(target.id)}`);
        toast(`Mesa eliminada: ${target.name}`);
        setTableToDelete(null);
        if (detailModalTableId === target.id) setDetailModalTableId(null);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible eliminar la mesa');
      }
    });
  };

  // --- Dish / Service Modal Handlers ---
  const openCreateDishModal = () => {
    setEditingDish(null);
    setDishName('');
    setDishCategory('Restaurante — Fuertes');
    setDishPrice('');
    setDishTaxPct('8');
    setShowDishModal(true);
  };

  const openEditDishModal = (item: MenuItem) => {
    setEditingDish(item);
    setDishName(item.name);
    setDishCategory(item.category || 'Restaurante — Fuertes');
    setDishPrice(String(item.salePrice));
    setDishTaxPct(String(item.taxPct ?? 8));
    setShowDishModal(true);
  };

  const handleSaveMenuItem = (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = Number(dishPrice);
    if (!dishName.trim() || !Number.isFinite(numericPrice) || numericPrice <= 0) {
      toast('Ingresa nombre y un precio unitario mayor a cero');
      return;
    }
    void run(async () => {
      try {
        const payload = {
          name: dishName.trim(),
          category: dishCategory,
          salePrice: numericPrice,
          taxPct: Number(dishTaxPct || 8),
        };
        if (editingDish) {
          const res = await apiPut<{ menuItem: MenuItem }>(
            `/api/v1/comandas/menu-items/${encodeURIComponent(editingDish.id)}`,
            payload
          );
          toast(`Carta actualizada: ${res.menuItem.name}`);
        } else {
          const res = await apiPost<{ menuItem: MenuItem }>('/api/v1/comandas/menu-items', payload);
          toast(`Agregado a la carta: ${res.menuItem.name}`);
        }
        setShowDishModal(false);
        setEditingDish(null);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al guardar en la carta');
      }
    });
  };

  const confirmDeleteDish = () => {
    if (!dishToDelete) return;
    const target = dishToDelete;
    void run(async () => {
      try {
        await apiDelete(`/api/v1/comandas/menu-items/${encodeURIComponent(target.id)}`);
        toast(`Ítem eliminado de la carta: ${target.name}`);
        setDishToDelete(null);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible eliminar el ítem de la carta');
      }
    });
  };

  // --- Waiter Modal Handlers ---
  const openCreateWaiterModal = () => {
    setEditingWaiter(null);
    setWaiterFullName('');
    setWaiterDocId('');
    setWaiterPhone('');
    setWaiterZone('Salón Principal');
    setWaiterShift('Turno Completo');
    setWaiterActive('true');
    setShowWaiterModal(true);
  };

  const openEditWaiterModal = (w: WaiterRecord) => {
    setEditingWaiter(w);
    setWaiterFullName(w.fullName);
    setWaiterDocId(w.docId || '');
    setWaiterPhone(w.phone || '');
    setWaiterZone(w.zone || 'Salón Principal');
    setWaiterShift(w.shift || 'Turno Completo');
    setWaiterActive(w.active ? 'true' : 'false');
    setShowWaiterModal(true);
  };

  const handleSaveWaiter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waiterFullName.trim()) {
      toast('Ingresa el nombre completo del mesero');
      return;
    }
    void run(async () => {
      try {
        const payload = {
          fullName: waiterFullName.trim(),
          docId: waiterDocId.trim(),
          phone: waiterPhone.trim(),
          zone: waiterZone,
          shift: waiterShift,
          active: waiterActive === 'true',
        };
        if (editingWaiter) {
          const res = await apiPut<{ waiter: WaiterRecord }>(
            `/api/v1/comandas/waiters/${encodeURIComponent(editingWaiter.id)}`,
            payload
          );
          toast(`Mesero actualizado: ${res.waiter.fullName}`);
        } else {
          const res = await apiPost<{ waiter: WaiterRecord }>('/api/v1/comandas/waiters', payload);
          toast(`Mesero registrado: ${res.waiter.fullName}`);
          setStudioWaiter(res.waiter.fullName);
          if (showTableModal) {
            setTableWaiter(res.waiter.fullName);
          }
        }
        setShowWaiterModal(false);
        setEditingWaiter(null);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Error al guardar el mesero');
      }
    });
  };

  const confirmDeleteWaiter = () => {
    if (!waiterToDelete) return;
    const target = waiterToDelete;
    void run(async () => {
      try {
        await apiDelete(`/api/v1/comandas/waiters/${encodeURIComponent(target.id)}`);
        toast(`Mesero eliminado: ${target.fullName}`);
        setWaiterToDelete(null);
        await reload();
      } catch (err) {
        toast(err instanceof Error ? err.message : 'No fue posible eliminar el mesero');
      }
    });
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

  const handlePassToPos = (tbl: DiningTable) => {
    if (!tbl.items || tbl.items.length === 0) {
      toast('La comanda no registra consumos activos para facturar');
      return;
    }
    if (!hasService('ms-facturacion')) {
      toast('El servicio de Facturación POS no está activo en la suscripción actual');
      return;
    }
    setDetailModalTableId(null);
    navigateTo('ms-facturacion', 'pos_mostrador', {
      linkedTableId: tbl.id,
      tableName: tbl.orderCode ? `${tbl.name} (${tbl.orderCode})` : tbl.name,
      customerName: tbl.customerName || '',
      items: tbl.items.map((it) => {
        const prod = menuItems.find((p) => p.id === it.productId);
        const isMenuDish = !it.productId || it.productId.toLowerCase().startsWith('mnu-');
        return {
          kind: isMenuDish ? 'SERVICIO' : 'PRODUCTO',
          refId: isMenuDish ? '' : it.productId,
          code: prod?.code || 'GASTRO',
          name: it.note ? `${it.name} (${it.note})` : it.name,
          qty: it.qty,
          price: it.price,
          taxPct: prod?.taxPct ?? 8,
        };
      }),
    });
    toast(`Cuenta ${tbl.orderCode || tbl.name} transferida a Caja POS`);
  };

  const handleExportCsv = () => {
    downloadCsvUtf8(
      'comandas_operacion_en_vivo.csv',
      ['Código', 'Canal', 'Mesa / Orden', 'Cliente', 'Zona / Entrega', 'Mesero / Despacho', 'Etapa', 'Platos', 'Total COP'],
      tables.map((t) => [
        t.orderCode || '—',
        resolveChannel(t),
        t.name,
        t.customerName || '—',
        t.deliveryAddress || t.zone,
        t.waiter || '—',
        resolveStage(t),
        (t.items || []).length,
        t.total,
      ])
    );
  };

  const renderKitchenTicketCard = (tbl: DiningTable) => {
    const ch = resolveChannel(tbl);
    const stg = resolveStage(tbl);
    const code = tbl.orderCode || `#${tbl.id.toUpperCase()}`;
    const timeAgo = formatOpenedElapsed(tbl.openedAt);
    const badge = channelBadgeFor(ch);

    const title =
      ch === 'MESA'
        ? tbl.customerName
          ? `${tbl.name} · ${tbl.customerName}`
          : tbl.name
        : tbl.customerName || tbl.name;

    const subtitle =
      ch === 'MESA'
        ? `${tbl.waiter || 'Mesero Turno'} · ${tbl.zone}`
        : `${tbl.waiter || 'Despacho'} · ${ch === 'DOMICILIO' ? 'Empaque domicilio' : 'Empaque mostrador'}`;

    const metaLine =
      ch === 'DOMICILIO'
        ? `Destino: ${tbl.deliveryAddress || 'Dirección registrada'}`
        : ch === 'PARA_LLEVAR'
        ? tbl.deliveryAddress || 'Retiro en mostrador principal'
        : `${tbl.guests && tbl.guests > 0 ? `${tbl.guests} comensales` : 'Servicio en salón'}`;

    const notesList = (tbl.items || [])
      .filter((it) => it.note && it.note.trim() !== '')
      .map((it) => ((tbl.items || []).length > 1 ? `${it.name}: ${it.note}` : it.note));
    const highlightNote = notesList.length > 0 ? notesList.join(' · ') : undefined;

    const totalUnits = (tbl.items || []).reduce((acc, it) => acc + it.qty, 0);

    let statusPill: { label: string; tone: 'amber' | 'blue' | 'purple' | 'emerald' } = {
      label: 'Recibida en cocina',
      tone: 'amber',
    };
    let primaryAction:
      | {
          label: string;
          tone: 'coral' | 'blue' | 'purple' | 'emerald';
          onClick: () => void;
          disabled?: boolean;
        }
      | undefined = {
      label: 'Aceptar y preparar',
      tone: 'coral',
      onClick: () => handleStageChange(tbl, 'PREPARANDO'),
      disabled: busy,
    };

    if (stg === 'PREPARANDO') {
      statusPill = { label: 'En fogones / barra', tone: 'blue' };
      primaryAction = {
        label: 'Marcar pedido listo',
        tone: 'blue',
        onClick: () => handleStageChange(tbl, 'LISTA'),
        disabled: busy,
      };
    } else if (stg === 'LISTA') {
      statusPill = { label: 'Lista en pasaplatos', tone: 'purple' };
      primaryAction = {
        label: 'Despachar pedido',
        tone: 'purple',
        onClick: () => handleStageChange(tbl, 'ENTREGADA'),
        disabled: busy,
      };
    } else if (stg === 'ENTREGADA') {
      statusPill = { label: 'Despachada', tone: 'emerald' };
      primaryAction = undefined;
    }

    return (
      <PkTicketCard
        key={tbl.id}
        code={code}
        timeAgo={timeAgo}
        channelBadge={badge}
        title={title}
        subtitle={subtitle}
        metaLine={metaLine}
        items={(tbl.items || []).map((it) => ({
          qty: it.qty,
          name: it.note ? `${it.name} (${it.note})` : it.name,
        }))}
        highlightNote={highlightNote}
        totalLabel="UNIDADES A PREPARAR"
        totalValue={`${totalUnits} plato(s)`}
        statusPill={statusPill}
        primaryAction={primaryAction}
        secondaryActions={
          <PkPrintButton label="Tirilla Cocina" payload={buildComandaPrintPayload(tbl, true)} />
        }
      />
    );
  };

  const nonTableOrders = activeOrders.filter((t) => resolveChannel(t) !== 'MESA');
  const freeTablesCount = physicalTables.filter((t) => resolveStage(t) === 'LIBRE').length;
  const occupiedTablesCount = physicalTables.length - freeTablesCount;
  const totalKitchenUnits = filteredActiveOrders
    .filter((o) => resolveStage(o) !== 'ENTREGADA')
    .reduce((acc, o) => acc + (o.items || []).reduce((s, it) => s + it.qty, 0), 0);

  return (
    <ModuleGate module={currentModule}>
      <div className="pk-stack">
        {currentModule === 'monitor_cocina' ? (
          <>
            <PkLiveHeader
              title="Pantalla Cocina y Barra (KDS)"
              liveLabel="En vivo"
              subtitle="Monitor exclusivo de preparación gastronómica por orden de llegada, notas de cocción y despacho en pasaplatos."
              pills={[
                { key: 'ALL', label: 'Todas las Comandas', count: countsByChannel.all },
                { key: 'MESA', label: 'Salón', count: countsByChannel.mesa },
                { key: 'DOMICILIO', label: 'Domicilios', count: countsByChannel.domicilio },
                { key: 'PARA_LLEVAR', label: 'Para llevar', count: countsByChannel.llevar },
              ]}
              activePill={channelFilter}
              onPillChange={(k) => setChannelFilter(k as ChannelPillKey)}
              extraActions={
                <div className="pk-row-actions">
                  <input
                    className="pk-input"
                    style={{ minWidth: 'min(100%, 240px)', minHeight: 38 }}
                    placeholder="Buscar #comanda, plato o mesa..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    disabled={busy}
                    onClick={() => void reload()}
                    title="Sincronizar monitor de cocina"
                  >
                    Actualizar
                  </button>
                </div>
              }
            />

            <PkKpiRow
              items={[
                {
                  label: 'Por Aceptar en Cocina',
                  value: String(kanbanBuckets.nuevas.length),
                  color: 'var(--pk-amber)',
                },
                {
                  label: 'En Fogones y Barra',
                  value: String(kanbanBuckets.preparando.length),
                  color: 'var(--pk-primary)',
                },
                {
                  label: 'Listas en Pasaplatos',
                  value: String(kanbanBuckets.listas.length),
                  color: '#6d28d9',
                },
                {
                  label: 'Platos Pendientes de Salir',
                  value: String(totalKitchenUnits),
                  color: 'var(--pk-emerald)',
                },
              ]}
            />

            <PkKanbanBoard
              columns={[
                {
                  key: 'NUEVA',
                  title: '1. Nuevas Recibidas',
                  dotColor: 'amber',
                  count: kanbanBuckets.nuevas.length,
                  emptyText: 'Sin comandas nuevas pendientes por aceptar',
                  children: kanbanBuckets.nuevas.map(renderKitchenTicketCard),
                },
                {
                  key: 'PREPARANDO',
                  title: '2. En Fogones y Barra',
                  dotColor: 'blue',
                  count: kanbanBuckets.preparando.length,
                  emptyText: 'Sin pedidos activos en preparación',
                  children: kanbanBuckets.preparando.map(renderKitchenTicketCard),
                },
                {
                  key: 'LISTA',
                  title: '3. Listas en Pasaplatos',
                  dotColor: 'purple',
                  count: kanbanBuckets.listas.length,
                  emptyText: 'Ningún pedido pendiente de recoger',
                  children: kanbanBuckets.listas.map(renderKitchenTicketCard),
                },
                {
                  key: 'ENTREGADA',
                  title: '4. Despachadas en Turno',
                  dotColor: 'emerald',
                  count: kanbanBuckets.entregadas.length,
                  emptyText: 'Aún no hay comandas despachadas en este filtro',
                  children: kanbanBuckets.entregadas.map(renderKitchenTicketCard),
                },
              ]}
            />
          </>
        ) : currentModule === 'catalogo_mesas' ? (
          <TablesCatalogSection
            tables={physicalTables}
            busy={busy}
            onOpenNewTable={openCreateTableModal}
            onEditTable={openEditTableModal}
            onDeleteTable={setTableToDelete}
            onOpenTableDetail={(tbl) => setDetailModalTableId(tbl.id)}
          />
        ) : currentModule === 'carta_servicios' ? (
          <MenuServicesSection
            menuItems={menuItems}
            nextMenuCode={nextMenuCode}
            busy={busy}
            onOpenNewItem={openCreateDishModal}
            onEditItem={openEditDishModal}
            onDeleteItem={setDishToDelete}
          />
        ) : currentModule === 'directorio_meseros' ? (
          <WaitersDirectorySection
            waiters={waiters}
            tables={tables}
            nextWaiterCode={nextWaiterCode}
            busy={busy}
            onOpenNewWaiter={openCreateWaiterModal}
            onEditWaiter={openEditWaiterModal}
            onDeleteWaiter={setWaiterToDelete}
          />
        ) : (
          <>
            <PkLiveHeader
              title="Mapa de Mesas y Pedidos"
              liveLabel="En vivo"
              subtitle="Haz clic sobre cualquier mesa o pedido para consultar su cuenta en modal, agregar platos o liquidar en Caja POS."
              primaryActionLabel={canManageOrders ? '+ Nueva Comanda' : undefined}
              onPrimaryAction={canManageOrders ? () => openOrderStudio() : undefined}
              extraActions={
                <>
                  <div className="pk-segmented" role="tablist" aria-label="Vista de salón y cuentas">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={salonView === 'floor'}
                      className={`pk-segmented-btn${salonView === 'floor' ? ' active' : ''}`}
                      onClick={() => setSalonView('floor')}
                    >
                      Plano de Mesas
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={salonView === 'table'}
                      className={`pk-segmented-btn${salonView === 'table' ? ' active' : ''}`}
                      onClick={() => setSalonView('table')}
                    >
                      Listado de Cuentas ({activeOrders.length})
                    </button>
                  </div>

                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    disabled={busy}
                    onClick={() => void reload()}
                    title="Actualizar estado del salón"
                  >
                    Actualizar
                  </button>
                </>
              }
            />

            <PkKpiRow
              items={[
                {
                  label: 'Mesas Disponibles',
                  value: `${freeTablesCount} / ${physicalTables.length}`,
                  color: 'var(--pk-emerald)',
                },
                {
                  label: 'Mesas Ocupadas',
                  value: String(occupiedTablesCount),
                  color: 'var(--pk-primary)',
                },
                {
                  label: 'Domicilios y Para Llevar',
                  value: String(nonTableOrders.length),
                  color: 'var(--pk-amber)',
                },
                {
                  label: 'Cuentas Abiertas',
                  value: formatCop(totalLiveBilling),
                  color: 'var(--pk-navy)',
                },
              ]}
            />

            {salonView === 'floor' ? (
              <div className="pk-stack">
                <div className="pk-card">
                  <div className="pk-card-head" style={{ flexWrap: 'wrap', gap: 12 }}>
                    <div className="pk-pill-tabs" role="tablist" aria-label="Ambientes del restaurante">
                      {floorZoneList.map((zone) => {
                        const active = floorZonePill === zone;
                        const zoneCount =
                          zone === 'Todas las Zonas'
                            ? physicalTables.length
                            : physicalTables.filter((t) => t.zone === zone).length;
                        return (
                          <button
                            key={zone}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`pk-pill-tab${active ? ' active' : ''}`}
                            onClick={() => setFloorZonePill(zone)}
                          >
                            <span>{zone}</span>
                            <span className="pk-pill-tab-count">{zoneCount}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pk-row-actions">
                      <input
                        className="pk-input"
                        style={{ minWidth: 'min(100%, 230px)' }}
                        placeholder="Buscar mesa o mesero..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pk-card-body">
                    {filteredFloorTables.length === 0 ? (
                      <div className="pk-kanban-empty">
                        No hay mesas registradas en este ambiente. Ve a la pestaña &quot;Mesas y Ambientes&quot; o crea una comanda para agregarlas.
                      </div>
                    ) : (
                      <div className="pk-cards-showcase">
                        {filteredFloorTables.map((tbl) => {
                          const stg = resolveStage(tbl);
                          const isFree = stg === 'LIBRE';
                          const dotBg = isFree
                            ? '#10b981'
                            : stg === 'NUEVA'
                            ? '#f59e0b'
                            : stg === 'PREPARANDO'
                            ? '#2563eb'
                            : stg === 'LISTA'
                            ? '#8b5cf6'
                            : '#059669';

                          const stageLabel = isFree
                            ? 'Disponible'
                            : stg === 'NUEVA'
                            ? 'Comanda Nueva'
                            : stg === 'PREPARANDO'
                            ? 'En Cocina'
                            : stg === 'LISTA'
                            ? 'Lista p/ Servir'
                            : 'Servida en Mesa';

                          return (
                            <div
                              key={tbl.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => setDetailModalTableId(tbl.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setDetailModalTableId(tbl.id);
                                }
                              }}
                              className="pk-ticket-card"
                              style={{
                                cursor: 'pointer',
                                background: isFree ? '#f8fafc' : '#ffffff',
                              }}
                            >
                              <div className="pk-ticket-top">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                  <span
                                    style={{
                                      width: 10,
                                      height: 10,
                                      borderRadius: 999,
                                      background: dotBg,
                                      boxShadow: `0 0 0 3px ${dotBg}22`,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <div>
                                    <div className="pk-ticket-code">{tbl.name}</div>
                                    <div className="pk-ticket-time">{tbl.zone}</div>
                                  </div>
                                </div>

                                <span
                                  className={`pk-ticket-status-pill ${
                                    isFree
                                      ? 'emerald'
                                      : stg === 'NUEVA'
                                      ? 'amber'
                                      : stg === 'PREPARANDO'
                                      ? 'blue'
                                      : stg === 'LISTA'
                                      ? 'purple'
                                      : 'emerald'
                                  }`}
                                >
                                  {tbl.orderCode ? `${tbl.orderCode} · ${stageLabel}` : stageLabel}
                                </span>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: 12.5,
                                  color: '#475569',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span>
                                  {tbl.guests && tbl.guests > 0 ? `${tbl.guests} puestos` : '4 puestos'}
                                </span>
                                <span>{tbl.waiter || 'Mesero Turno'}</span>
                              </div>

                              {tbl.customerName && (
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--pk-navy)' }}>
                                  {tbl.customerName}
                                </div>
                              )}

                              {!isFree && (
                                <div
                                  style={{ padding: '4px 0' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <PkProcessNodes
                                    compact
                                    steps={buildOrderProcessSteps(stg, (target) =>
                                      handleStageChange(tbl, target)
                                    )}
                                  />
                                </div>
                              )}

                              <div className="pk-ticket-total-row">
                                <span>
                                  {isFree
                                    ? 'Clic para abrir comanda'
                                    : `${(tbl.items || []).length} ítem(s) · Ver detalle`}
                                </span>
                                <span>{formatCop(tbl.total)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {nonTableOrders.length > 0 && (
                  <div className="pk-card">
                    <div className="pk-card-head">
                      <div className="pk-card-title">
                        Domicilios y Pedidos Para Llevar Activos ({nonTableOrders.length})
                      </div>
                      <div className="pk-row-actions">
                        <button
                          type="button"
                          className="pk-btn pk-btn-outline pk-btn-sm"
                          onClick={() => openOrderStudio({ channel: 'DOMICILIO' })}
                        >
                          + Domicilio
                        </button>
                        <button
                          type="button"
                          className="pk-btn pk-btn-outline pk-btn-sm"
                          onClick={() => openOrderStudio({ channel: 'PARA_LLEVAR' })}
                        >
                          + Para Llevar
                        </button>
                      </div>
                    </div>
                    <div className="pk-card-body">
                      <div className="pk-cards-showcase">
                        {nonTableOrders.map((ord) => {
                          const ch = resolveChannel(ord);
                          const stg = resolveStage(ord);
                          const badge = channelBadgeFor(ch);
                          return (
                            <div
                              key={ord.id}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setDetailModalTableId(ord.id)}
                            >
                              <PkTicketCard
                                code={ord.orderCode || `#${ord.id.toUpperCase()}`}
                                timeAgo={formatOpenedElapsed(ord.openedAt)}
                                channelBadge={badge}
                                title={ord.customerName || ord.name}
                                subtitle={`${ord.customerPhone ? `${ord.customerPhone} · ` : ''}${ord.waiter || 'Despacho'}`}
                                metaLine={ord.deliveryAddress || ord.zone}
                                items={(ord.items || []).slice(0, 3).map((it) => ({
                                  qty: it.qty,
                                  name: it.name,
                                  amount: formatCop(it.qty * it.price),
                                }))}
                                totalLabel="TOTAL CUENTA"
                                totalValue={formatCop(ord.total)}
                                processNodes={buildOrderProcessSteps(stg, (next) =>
                                  handleStageChange(ord, next)
                                )}
                                primaryAction={{
                                  label: 'Ver Cuenta / Facturar',
                                  tone: 'blue',
                                  disabled: busy,
                                  onClick: () => setDetailModalTableId(ord.id),
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="pk-card">
                <div className="pk-card-head">
                  <div className="pk-card-title">Consolidado de Cuentas y Pedidos Activos</div>
                  <div className="pk-row-actions">
                    <input
                      className="pk-input"
                      style={{ minWidth: 'min(100%, 230px)' }}
                      placeholder="Buscar código, cliente o mesa..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                      type="button"
                      className="pk-btn pk-btn-outline pk-btn-sm"
                      onClick={handleExportCsv}
                    >
                      CSV
                    </button>
                  </div>
                </div>
                <div className="pk-card-body">
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Comanda</th>
                          <th>Canal</th>
                          <th>Mesa / Cliente</th>
                          <th>Ubicación / Entrega</th>
                          <th>Flujo en Vivo</th>
                          <th>Total</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeOrders
                          .filter((t) => {
                            const ch = resolveChannel(t);
                            if (channelFilter !== 'ALL' && ch !== channelFilter) return false;
                            const q = searchQuery.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              (t.orderCode || '').toLowerCase().includes(q) ||
                              t.name.toLowerCase().includes(q) ||
                              (t.customerName || '').toLowerCase().includes(q) ||
                              (t.deliveryAddress || '').toLowerCase().includes(q)
                            );
                          })
                          .map((tbl) => {
                            const ch = resolveChannel(tbl);
                            const stg = resolveStage(tbl);
                            const badge = channelBadgeFor(ch);
                            return (
                              <tr key={tbl.id}>
                                <td style={{ fontWeight: 800 }}>{tbl.orderCode || '—'}</td>
                                <td>
                                  <span className={`pk-ticket-channel ${badge.tone}`}>
                                    {badge.label}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontWeight: 700 }}>{tbl.name}</div>
                                  {tbl.customerName && (
                                    <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>
                                      {tbl.customerName}
                                      {tbl.customerPhone ? ` · ${tbl.customerPhone}` : ''}
                                    </div>
                                  )}
                                </td>
                                <td style={{ fontSize: 12.5 }}>
                                  {ch === 'MESA'
                                    ? `${tbl.zone} · ${tbl.waiter}`
                                    : tbl.deliveryAddress || tbl.zone}
                                </td>
                                <td style={{ minWidth: 230 }}>
                                  <PkProcessNodes
                                    compact
                                    steps={buildOrderProcessSteps(stg, (next) =>
                                      handleStageChange(tbl, next)
                                    )}
                                  />
                                </td>
                                <td style={{ fontWeight: 800 }}>{formatCop(tbl.total)}</td>
                                <td>
                                  <div className="pk-row-actions">
                                    <button
                                      type="button"
                                      className="pk-btn pk-btn-outline pk-btn-sm"
                                      onClick={() => setDetailModalTableId(tbl.id)}
                                    >
                                      Ver Cuenta
                                    </button>
                                    {canManageOrders && (
                                      <button
                                        type="button"
                                        className="pk-btn pk-btn-emerald pk-btn-sm"
                                        disabled={busy}
                                        onClick={() => handlePassToPos(tbl)}
                                      >
                                        Facturar POS
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        {activeOrders.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              style={{ textAlign: 'center', color: 'var(--pk-muted)', padding: 28 }}
                            >
                              No hay cuentas activas en este momento.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Modal de Detalle de Mesa / Cuenta al hacer clic en Mapa de Mesas */}
        <PkModal
          open={Boolean(detailModalTable)}
          maxWidth={720}
          title={
            detailModalTable
              ? `${detailModalTable.name}${
                  detailModalTable.orderCode ? ` · Comanda ${detailModalTable.orderCode}` : ''
                }`
              : 'Detalle de Cuenta'
          }
          onClose={() => setDetailModalTableId(null)}
        >
          {detailModalTable && (
            <div className="pk-stack" style={{ gap: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                    {resolveChannel(detailModalTable) === 'MESA'
                      ? `${detailModalTable.zone} · Mesero: ${detailModalTable.waiter || 'Turno General'}`
                      : `${detailModalTable.customerName || detailModalTable.name} · ${
                          detailModalTable.deliveryAddress || detailModalTable.zone
                        }`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--pk-muted)' }}>
                    {resolveChannel(detailModalTable) === 'MESA'
                      ? `Capacidad: ${
                          detailModalTable.guests && detailModalTable.guests > 0
                            ? detailModalTable.guests
                            : 4
                        } puestos${
                          detailModalTable.customerName
                            ? ` · Titular: ${detailModalTable.customerName}`
                            : ''
                        }`
                      : `Medio estimado: ${detailModalTable.paymentHint || 'Caja POS'}`}
                  </div>
                </div>

                {resolveStage(detailModalTable) !== 'LIBRE' && (
                  <PkProcessNodes
                    compact
                    steps={buildOrderProcessSteps(resolveStage(detailModalTable), (next) =>
                      handleStageChange(detailModalTable, next)
                    )}
                  />
                )}
              </div>

              {(detailModalTable.items || []).length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '28px 18px',
                    borderRadius: 12,
                    border: '1px dashed #cbd5e1',
                    color: 'var(--pk-muted)',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                    Esta mesa está disponible y sin consumos activos
                  </div>
                  <div style={{ fontSize: 12.5, marginBottom: 16 }}>
                    Abre una comanda para registrar platos, bebidas o servicios gastronómicos.
                  </div>
                  {canManageOrders && (
                    <button
                      type="button"
                      className="pk-btn pk-btn-primary"
                      onClick={() => openOrderStudio({ channel: 'MESA', table: detailModalTable })}
                    >
                      + Abrir Comanda y Agregar Platos
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="pk-table-wrap">
                    <table className="pk-table">
                      <thead>
                        <tr>
                          <th>Plato / Bebida / Servicio</th>
                          <th>Cant.</th>
                          <th>Precio Unit.</th>
                          <th>Subtotal</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailModalTable.items.map((it) => (
                          <tr key={it.itemId}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{it.name}</div>
                              {it.note && (
                                <div
                                  style={{
                                    fontSize: 11.5,
                                    color: 'var(--pk-amber)',
                                    fontWeight: 600,
                                  }}
                                >
                                  Nota: {it.note}
                                </div>
                              )}
                            </td>
                            <td>{it.qty}</td>
                            <td>{formatCop(it.price)}</td>
                            <td style={{ fontWeight: 800 }}>{formatCop(it.qty * it.price)}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="pk-btn pk-btn-danger pk-btn-sm"
                                disabled={busy}
                                title="Retirar línea de la cuenta"
                                onClick={() =>
                                  setItemToDelete({ table: detailModalTable, item: it })
                                }
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderRadius: 12,
                      background: '#0f172a',
                      color: '#ffffff',
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.04em' }}>
                      TOTAL CUENTA ACUMULADA ({detailModalTable.items.length} LÍNEAS)
                    </span>
                    <strong style={{ fontSize: 18 }}>{formatCop(detailModalTable.total)}</strong>
                  </div>

                  <div
                    className="pk-row-actions"
                    style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}
                  >
                    <div className="pk-row-actions">
                      {resolveChannel(detailModalTable) === 'MESA' && canManageOrders && (
                        <button
                          type="button"
                          className="pk-btn pk-btn-outline"
                          onClick={() =>
                            openOrderStudio({ channel: 'MESA', table: detailModalTable })
                          }
                        >
                          + Agregar Platos
                        </button>
                      )}
                      <PkPrintButton
                        label="Precuenta 80mm"
                        payload={buildComandaPrintPayload(detailModalTable, false)}
                      />
                    </div>

                    {canManageOrders && (
                      <button
                        type="button"
                        className="pk-btn pk-btn-emerald"
                        disabled={busy}
                        onClick={() => handlePassToPos(detailModalTable)}
                      >
                        Pasar a Factura POS
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </PkModal>

        {/* Estudio Fullscreen para Toma de Comanda (conserva mini-diálogos rápidos de Mesa, Mesero y Plato) */}
        <PkFullscreenDialog
          open={studioOpen}
          title="Estudio Gastronómico de Toma de Comanda"
          subtitle="Selecciona la modalidad operativa, asigna mesa y mesero, personaliza notas de cocina y confirma el pedido."
          badge={{
            label:
              studioChannel === 'DOMICILIO'
                ? 'Canal Domicilio'
                : studioChannel === 'PARA_LLEVAR'
                ? 'Canal Para Llevar'
                : 'Servicio en Salón',
            tone:
              studioChannel === 'DOMICILIO'
                ? 'rose'
                : studioChannel === 'PARA_LLEVAR'
                ? 'amber'
                : 'blue',
          }}
          onClose={() => setStudioOpen(false)}
          subheader={
            <PkTypeCards
              label="1. Modalidad de Atención de la Comanda"
              options={CHANNEL_TYPE_CARDS}
              value={studioChannel}
              onChange={(next) => {
                const ch = next as OrderChannel;
                setStudioChannel(ch);
                if (ch === 'DOMICILIO') {
                  setStudioPaymentMethod('Efectivo contraentrega');
                } else {
                  setStudioPaymentMethod('Tarjeta crédito / débito');
                }
              }}
            />
          }
          footerLeft={
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', fontWeight: 700 }}>
                  NUEVOS ÍTEMS EN COMANDA
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--pk-navy)' }}>
                  {draftLines.reduce((acc, l) => acc + l.qty, 0)} unidad(es) ·{' '}
                  {formatCop(draftSubtotal)}
                </div>
              </div>
              {existingTableTotal > 0 && (
                <div style={{ borderLeft: '1px solid #cbd5e1', paddingLeft: 16 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', fontWeight: 700 }}>
                    CUENTA ACUMULADA PROYECTADA
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--pk-emerald)' }}>
                    {formatCop(studioProjectedTotal)}
                  </div>
                </div>
              )}
            </div>
          }
          footerActions={
            <>
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                disabled={busy}
                onClick={() => setStudioOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pk-btn pk-btn-primary"
                disabled={busy || draftLines.length === 0}
                onClick={handleSubmitStudioOrder}
              >
                {busy ? 'Enviando comanda...' : 'Confirmar y Enviar Comanda'}
              </button>
            </>
          }
        >
          <div className="pk-card">
            <div className="pk-card-head">
              <div className="pk-card-title">
                {studioChannel === 'MESA'
                  ? 'Datos Operativos de Mesa y Mesero'
                  : studioChannel === 'DOMICILIO'
                  ? 'Datos del Cliente y Dirección de Domicilio'
                  : 'Datos de Retiro en Mostrador'}
              </div>
            </div>
            <div className="pk-card-body">
              {studioChannel === 'MESA' && (
                <div className="pk-form-grid cols-4">
                  <PkSelect
                    label="Mesa o Ambiente Destino *"
                    items={physicalTables}
                    value={studioTableId}
                    onChange={handleSelectStudioTable}
                    getValue={(t) => t.id}
                    getLabel={(t) =>
                      `${t.name} — ${t.zone} (${
                        resolveStage(t) === 'LIBRE' ? 'Libre' : formatCop(t.total)
                      })`
                    }
                    onCreateNew={openCreateTableModal}
                    createLabel="+ Nueva Mesa"
                    searchable
                  />

                  <PkSelect
                    label="Mesero Asignado *"
                    items={waiterSelectItems}
                    value={studioWaiter}
                    onChange={setStudioWaiter}
                    getValue={(w) => w.value}
                    getLabel={(w) => w.label}
                    onCreateNew={openCreateWaiterModal}
                    createLabel="+ Nuevo Mesero"
                    searchable
                  />

                  <div className="pk-field">
                    <label>Personas en Mesa (Aforo)</label>
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={studioGuests}
                      onChange={(e) => setStudioGuests(e.target.value)}
                    />
                  </div>

                  <PkSimpleSelect
                    label="Medio de Pago Estimado"
                    value={studioPaymentMethod}
                    onChange={setStudioPaymentMethod}
                    options={PAYMENT_METHOD_OPTIONS}
                  />

                  <div className="pk-field pk-col-span-full">
                    <label>Titular de la Cuenta / Reserva (Opcional)</label>
                    <input
                      value={studioCustomerName}
                      onChange={(e) => setStudioCustomerName(e.target.value)}
                      placeholder="Ej: Familia Gómez / Reserva Empresarial"
                    />
                  </div>
                </div>
              )}

              {studioChannel === 'DOMICILIO' && (
                <div className="pk-form-grid cols-3">
                  <div className="pk-field">
                    <label>Nombre del Cliente *</label>
                    <input
                      required
                      value={studioCustomerName}
                      onChange={(e) => setStudioCustomerName(e.target.value)}
                      placeholder="Ej: Valentina Gómez"
                    />
                  </div>

                  <div className="pk-field">
                    <label>Teléfono / Celular de Contacto *</label>
                    <input
                      value={studioCustomerPhone}
                      onChange={(e) => setStudioCustomerPhone(e.target.value)}
                      placeholder="Ej: 300 412 8890"
                    />
                  </div>

                  <PkSimpleSelect
                    label="Medio de Recaudo"
                    value={studioPaymentMethod}
                    onChange={setStudioPaymentMethod}
                    options={PAYMENT_METHOD_OPTIONS}
                  />

                  <div className="pk-field" style={{ gridColumn: 'span 2' }}>
                    <label>Dirección Exacta de Entrega (Barrio, Edificio, Apto/Oficina) *</label>
                    <input
                      required
                      value={studioDeliveryAddress}
                      onChange={(e) => setStudioDeliveryAddress(e.target.value)}
                      placeholder="Ej: Cra 43A # 18-45 Apto 602, Portería Principal"
                    />
                  </div>

                  <div className="pk-field">
                    <label>Devuelta para Efectivo (COP Opcional)</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={studioCashChangeFor}
                      onChange={(e) => setStudioCashChangeFor(e.target.value)}
                      placeholder="Ej: 100000"
                    />
                  </div>
                </div>
              )}

              {studioChannel === 'PARA_LLEVAR' && (
                <div className="pk-form-grid cols-4">
                  <div className="pk-field">
                    <label>Nombre de Quien Retira *</label>
                    <input
                      required
                      value={studioCustomerName}
                      onChange={(e) => setStudioCustomerName(e.target.value)}
                      placeholder="Ej: Sebastián Morales"
                    />
                  </div>

                  <div className="pk-field">
                    <label>Teléfono de Aviso</label>
                    <input
                      value={studioCustomerPhone}
                      onChange={(e) => setStudioCustomerPhone(e.target.value)}
                      placeholder="Ej: 315 780 2314"
                    />
                  </div>

                  <PkSimpleSelect
                    label="Modalidad y Ventana de Retiro"
                    value={studioPickupWindow}
                    onChange={setStudioPickupWindow}
                    options={PICKUP_WINDOW_OPTIONS}
                  />

                  <PkSimpleSelect
                    label="Medio de Pago"
                    value={studioPaymentMethod}
                    onChange={setStudioPaymentMethod}
                    options={PAYMENT_METHOD_OPTIONS}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="pk-comandas-split">
            <div className="pk-card">
              <div className="pk-card-head" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div className="pk-card-title">Carta Interactiva de Platos y Servicios</div>
                <div className="pk-row-actions" style={{ flex: '1 1 auto', justifyContent: 'flex-end' }}>
                  <input
                    className="pk-input"
                    style={{ flex: '1 1 180px', maxWidth: 260, minWidth: 0 }}
                    placeholder="Buscar en la carta..."
                    value={studioMenuSearch}
                    onChange={(e) => setStudioMenuSearch(e.target.value)}
                  />
                  <button
                    type="button"
                    className="pk-btn pk-btn-outline pk-btn-sm"
                    onClick={openCreateDishModal}
                  >
                    + Nuevo Servicio / Plato
                  </button>
                </div>
              </div>

              <div className="pk-card-body">
                <div className="pk-pill-tabs" style={{ marginBottom: 14 }}>
                  {menuCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`pk-pill-tab${studioMenuCategory === cat ? ' active' : ''}`}
                      onClick={() => setStudioMenuCategory(cat)}
                    >
                      {cat === 'TODAS' ? 'Toda la Carta' : cat}
                    </button>
                  ))}
                </div>

                <FeatureGate module="mapa_mesas" feature="notas_preparacion">
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      borderRadius: 12,
                      padding: '10px 12px',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', marginBottom: 6 }}>
                      Nota rápida para el próximo plato a agregar (opcional)
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        className="pk-input"
                        style={{ flex: '1 1 200px', minWidth: 0, background: '#ffffff' }}
                        value={studioQuickNote}
                        onChange={(e) => setStudioQuickNote(e.target.value)}
                        placeholder="Ej: Término 3/4, sin cebolla, salsa aparte..."
                      />
                      {KITCHEN_NOTE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className="pk-btn pk-btn-outline pk-btn-sm"
                          onClick={() => setStudioQuickNote(preset)}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </FeatureGate>

                {filteredStudioMenu.length === 0 ? (
                  <div className="pk-kanban-empty">
                    No hay ítems en esta categoría. Usa &quot;+ Nuevo Servicio / Plato&quot; para ampliar la carta.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
                      gap: 12,
                    }}
                  >
                    {filteredStudioMenu.map((dish) => (
                      <div
                        key={dish.id}
                        style={{
                          border: '1px solid #dbe3ee',
                          borderRadius: 14,
                          padding: 14,
                          background: '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                            <span className="pk-badge pk-badge-slate">{dish.code}</span>
                            <span style={{ fontSize: 11, color: 'var(--pk-muted)', fontWeight: 700 }}>
                              {dish.taxPct}% Imp.
                            </span>
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a', marginTop: 8 }}>
                            {dish.name}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--pk-muted)', marginTop: 3 }}>
                            {dish.category}
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: 8,
                            borderTop: '1px dashed #e2e8f0',
                          }}
                        >
                          <strong style={{ fontSize: 15, color: 'var(--pk-navy)' }}>
                            {formatCop(dish.salePrice)}
                          </strong>
                          <button
                            type="button"
                            className="pk-btn pk-btn-primary pk-btn-sm"
                            onClick={() => addDishToDraft(dish)}
                          >
                            + Agregar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pk-ticket-card" style={{ position: 'sticky', top: 0 }}>
              <div className="pk-ticket-top">
                <div>
                  <div className="pk-ticket-code">Tiquete en Construcción</div>
                  <div className="pk-ticket-time">Previsualización inmediata para cocina</div>
                </div>
                <span className={`pk-ticket-channel ${channelBadgeFor(studioChannel).tone}`}>
                  {channelBadgeFor(studioChannel).label}
                </span>
              </div>

              <div className="pk-ticket-subject">
                <div className="pk-ticket-title">
                  {studioChannel === 'MESA'
                    ? selectedStudioTable
                      ? `${selectedStudioTable.name} · ${selectedStudioTable.zone}`
                      : 'Selecciona una mesa'
                    : studioCustomerName.trim() || 'Cliente por registrar'}
                </div>
                <div className="pk-ticket-sub">
                  {studioChannel === 'DOMICILIO'
                    ? studioDeliveryAddress.trim() || 'Dirección pendiente'
                    : studioChannel === 'PARA_LLEVAR'
                    ? studioPickupWindow
                    : `${studioGuests || 1} personas · ${studioWaiter || 'Mesero Turno'}`}
                </div>
              </div>

              {studioChannel === 'MESA' &&
                selectedStudioTable &&
                (selectedStudioTable.items || []).length > 0 && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: '8px 10px',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                      Consumo previo en {selectedStudioTable.name}:{' '}
                      {formatCop(selectedStudioTable.total)}
                    </div>
                    {selectedStudioTable.items.map((it) => (
                      <div
                        key={it.itemId}
                        style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}
                      >
                        <span>
                          {it.qty}× {it.name}
                        </span>
                        <span>{formatCop(it.qty * it.price)}</span>
                      </div>
                    ))}
                  </div>
                )}

              {draftLines.length === 0 ? (
                <div className="pk-kanban-empty">
                  Haz clic en &quot;+ Agregar&quot; sobre cualquier plato, bebida o servicio para armar la comanda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {draftLines.map((line) => (
                    <div
                      key={line.draftId}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        padding: 10,
                        background: '#f8fafc',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong style={{ fontSize: 13.5, color: '#0f172a' }}>{line.name}</strong>
                        <strong style={{ fontSize: 13.5, color: 'var(--pk-navy)' }}>
                          {formatCop(line.qty * line.price)}
                        </strong>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: 8,
                          gap: 8,
                        }}
                      >
                        <div className="pk-row-actions">
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            onClick={() => updateDraftQty(line.draftId, -1)}
                          >
                            −
                          </button>
                          <span style={{ fontWeight: 900, minWidth: 24, textAlign: 'center' }}>
                            {line.qty}
                          </span>
                          <button
                            type="button"
                            className="pk-btn pk-btn-outline pk-btn-sm"
                            onClick={() => updateDraftQty(line.draftId, 1)}
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          className="pk-btn pk-btn-danger pk-btn-sm"
                          onClick={() => removeDraftLine(line.draftId)}
                        >
                          ✕
                        </button>
                      </div>

                      {notesEnabled && (
                        <input
                          className="pk-input"
                          style={{ marginTop: 8, fontSize: 12, padding: '5px 8px', background: '#ffffff' }}
                          value={line.note}
                          onChange={(e) => updateDraftNote(line.draftId, e.target.value)}
                          placeholder="Nota de cocina para esta línea (ej: Sin cebolla)..."
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="pk-ticket-total-row">
                <span>TOTAL NUEVA COMANDA</span>
                <span>{formatCop(draftSubtotal)}</span>
              </div>

              <div className="pk-ticket-pay">Pago: {studioPaymentMethod}</div>

              <button
                type="button"
                disabled={busy || draftLines.length === 0}
                className="pk-ticket-cta coral"
                onClick={handleSubmitStudioOrder}
              >
                {busy ? 'Procesando...' : 'Confirmar y Enviar Comanda'}
              </button>
            </div>
          </div>
        </PkFullscreenDialog>

        {/* Modal Crear / Editar Mesa */}
        <PkModal
          open={showTableModal}
          title={editingTable ? `Editar ${editingTable.name}` : 'Registrar Nueva Mesa'}
          onClose={() => {
            setShowTableModal(false);
            setEditingTable(null);
          }}
        >
          <form onSubmit={handleSaveTable} className="pk-form-grid cols-2">
            <div className="pk-field">
              <label>Nombre o Número de Mesa *</label>
              <input
                required
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Ej: Mesa 5 / Reservado VIP 3"
              />
            </div>

            <PkSimpleSelect
              label="Zona / Ambiente"
              value={tableZone}
              onChange={setTableZone}
              options={TABLE_ZONE_OPTIONS}
            />

            <div className="pk-field">
              <label>Capacidad (Puestos)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={tableCapacity}
                onChange={(e) => setTableCapacity(e.target.value)}
              />
            </div>

            <PkSelect
              label="Mesero Asignado"
              items={waiterSelectItems}
              value={tableWaiter}
              onChange={setTableWaiter}
              getValue={(w) => w.value}
              getLabel={(w) => w.label}
              onCreateNew={openCreateWaiterModal}
              createLabel="+ Nuevo Mesero"
              searchable
            />

            <div className="pk-form-actions">
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                onClick={() => {
                  setShowTableModal(false);
                  setEditingTable(null);
                }}
                disabled={busy}
              >
                Cancelar
              </button>
              <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                {busy ? 'Guardando...' : editingTable ? 'Guardar Cambios' : 'Crear Mesa'}
              </button>
            </div>
          </form>
        </PkModal>

        {/* Modal Crear / Editar Servicio o Plato */}
        <PkModal
          open={showDishModal}
          title={
            editingDish
              ? `Editar ${editingDish.code} — ${editingDish.name}`
              : 'Agregar Servicio, Plato o Bebida a la Carta'
          }
          onClose={() => {
            setShowDishModal(false);
            setEditingDish(null);
          }}
        >
          <form onSubmit={handleSaveMenuItem} className="pk-form-grid cols-2">
            <PkAutoCodeInput
              label="Código Carta"
              value={editingDish ? editingDish.code : nextMenuCode}
            />

            <div className="pk-field">
              <label>Nombre del Plato, Bebida o Servicio *</label>
              <input
                required
                value={dishName}
                onChange={(e) => setDishName(e.target.value)}
                placeholder="Ej: Cazuela de Mariscos / Descorche"
              />
            </div>

            <PkSimpleSelect
              label="Categoría"
              value={dishCategory}
              onChange={setDishCategory}
              options={DISH_CATEGORY_OPTIONS}
            />

            <div className="pk-field">
              <label>Precio de Venta (COP) *</label>
              <input
                required
                type="number"
                min="100"
                step="100"
                value={dishPrice}
                onChange={(e) => setDishPrice(e.target.value)}
                placeholder="Ej: 46000"
              />
            </div>

            <div className="pk-col-span-full">
              <PkSimpleSelect
                label="Impoconsumo / IVA (%)"
                value={dishTaxPct}
                onChange={setDishTaxPct}
                options={DISH_TAX_OPTIONS}
              />
            </div>

            <div className="pk-form-actions">
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                onClick={() => {
                  setShowDishModal(false);
                  setEditingDish(null);
                }}
                disabled={busy}
              >
                Cancelar
              </button>
              <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                {busy ? 'Guardando...' : editingDish ? 'Guardar Cambios' : 'Guardar en Carta'}
              </button>
            </div>
          </form>
        </PkModal>

        {/* Modal Crear / Editar Mesero */}
        <PkModal
          open={showWaiterModal}
          title={
            editingWaiter
              ? `Editar Mesero ${editingWaiter.code}`
              : 'Registrar Nuevo Mesero o Personal de Atención'
          }
          onClose={() => {
            setShowWaiterModal(false);
            setEditingWaiter(null);
          }}
        >
          <form onSubmit={handleSaveWaiter} className="pk-form-grid cols-2">
            <PkAutoCodeInput
              label="Código Mesero"
              value={editingWaiter ? editingWaiter.code : nextWaiterCode}
            />

            <div className="pk-field">
              <label>Nombre Completo *</label>
              <input
                required
                value={waiterFullName}
                onChange={(e) => setWaiterFullName(e.target.value)}
                placeholder="Ej: Camila Restrepo"
              />
            </div>

            <div className="pk-field">
              <label>Documento de Identidad</label>
              <input
                value={waiterDocId}
                onChange={(e) => setWaiterDocId(e.target.value)}
                placeholder="Ej: 1.037.612.845"
              />
            </div>

            <div className="pk-field">
              <label>Teléfono / Celular</label>
              <input
                value={waiterPhone}
                onChange={(e) => setWaiterPhone(e.target.value)}
                placeholder="Ej: 312 458 9021"
              />
            </div>

            <PkSimpleSelect
              label="Ambiente / Zona Principal"
              value={waiterZone}
              onChange={setWaiterZone}
              options={TABLE_ZONE_OPTIONS}
            />

            <PkSimpleSelect
              label="Turno Asignado"
              value={waiterShift}
              onChange={setWaiterShift}
              options={WAITER_SHIFT_OPTIONS}
            />

            {editingWaiter && (
              <div className="pk-col-span-full">
                <PkSimpleSelect
                  label="Estado Operativo"
                  value={waiterActive}
                  onChange={setWaiterActive}
                  options={[
                    { value: 'true', label: 'Activo en Turno' },
                    { value: 'false', label: 'Inactivo / Descanso' },
                  ]}
                />
              </div>
            )}

            <div className="pk-form-actions">
              <button
                type="button"
                className="pk-btn pk-btn-outline"
                onClick={() => {
                  setShowWaiterModal(false);
                  setEditingWaiter(null);
                }}
                disabled={busy}
              >
                Cancelar
              </button>
              <button type="submit" className="pk-btn pk-btn-primary" disabled={busy}>
                {busy ? 'Guardando...' : editingWaiter ? 'Guardar Cambios' : 'Registrar Mesero'}
              </button>
            </div>
          </form>
        </PkModal>

        {/* Confirmaciones */}
        <PkConfirmModal
          open={Boolean(itemToDelete)}
          title="Retirar Línea de la Comanda"
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

        <PkConfirmModal
          open={Boolean(tableToDelete)}
          title="Eliminar Mesa del Catálogo"
          message={
            tableToDelete
              ? `¿Confirmas eliminar "${tableToDelete.name}" (${tableToDelete.zone}) del plano y catálogo?`
              : ''
          }
          confirmLabel="Eliminar Mesa"
          busy={busy}
          onConfirm={confirmDeleteTable}
          onCancel={() => setTableToDelete(null)}
        />

        <PkConfirmModal
          open={Boolean(dishToDelete)}
          title="Eliminar Ítem de la Carta"
          message={
            dishToDelete
              ? `¿Confirmas eliminar "${dishToDelete.name}" (${dishToDelete.code}) de la carta gastronómica?`
              : ''
          }
          confirmLabel="Eliminar de Carta"
          busy={busy}
          onConfirm={confirmDeleteDish}
          onCancel={() => setDishToDelete(null)}
        />

        <PkConfirmModal
          open={Boolean(waiterToDelete)}
          title="Eliminar Mesero del Directorio"
          message={
            waiterToDelete
              ? `¿Confirmas retirar a "${waiterToDelete.fullName}" (${waiterToDelete.code}) del directorio de personal?`
              : ''
          }
          confirmLabel="Eliminar Mesero"
          busy={busy}
          onConfirm={confirmDeleteWaiter}
          onCancel={() => setWaiterToDelete(null)}
        />
      </div>
    </ModuleGate>
  );
};

export default ComandasView;
