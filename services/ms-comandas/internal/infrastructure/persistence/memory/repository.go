package memory

import (
	"context"
	"strings"
	"sync"

	"ms-comandas/internal/domain"
	"ms-comandas/internal/platform/apperr"
	"ms-comandas/internal/platform/seqmem"
)

const demoDBName = "db_demo_empresa"

func isDemo(dbName string) bool {
	return strings.TrimSpace(dbName) == demoDBName
}

func tableSeqBase(dbName string) int {
	if isDemo(dbName) {
		return domain.DemoBaseTableSeq
	}
	return domain.BaseTableSeq
}

func menuSeqBase(dbName string) int {
	if isDemo(dbName) {
		return domain.DemoBaseMenuSeq
	}
	return domain.BaseMenuSeq
}

func waiterSeqBase(dbName string) int {
	if isDemo(dbName) {
		return domain.DemoBaseWaiterSeq
	}
	return domain.BaseWaiterSeq
}

func orderSeqBase(dbName string) int {
	if isDemo(dbName) {
		return domain.DemoBaseOrderSeq
	}
	return domain.BaseOrderSeq
}

type tenantStore struct {
	tables      []domain.DiningTable
	menuItems   []domain.MenuItem
	waiters     []domain.Waiter
	idemTables  map[string]domain.DiningTable
	idemMenu    map[string]domain.MenuItem
	idemWaiters map[string]domain.Waiter
	idemOrders  map[string]domain.DiningTable
	idemAddItem map[string]domain.DiningTable
	idemCleared map[string]bool
}

type Repository struct {
	mu      sync.Mutex
	seq     *seqmem.MemoryGenerator
	tenants map[string]*tenantStore
}

var _ domain.Repository = (*Repository)(nil)

func NewRepository() *Repository {
	return &Repository{
		seq:     seqmem.NewMemory(),
		tenants: make(map[string]*tenantStore),
	}
}

func (r *Repository) ensureTenantLocked(dbName string) *tenantStore {
	if st, ok := r.tenants[dbName]; ok {
		return st
	}
	if !isDemo(dbName) {
		st := &tenantStore{
			tables:      []domain.DiningTable{},
			menuItems:   []domain.MenuItem{},
			waiters:     []domain.Waiter{},
			idemTables:  make(map[string]domain.DiningTable),
			idemMenu:    make(map[string]domain.MenuItem),
			idemWaiters: make(map[string]domain.Waiter),
			idemOrders:  make(map[string]domain.DiningTable),
			idemAddItem: make(map[string]domain.DiningTable),
			idemCleared: make(map[string]bool),
		}
		r.tenants[dbName] = st
		return st
	}
	st := &tenantStore{
		menuItems:   domain.DemoMenuItems(),
		tables:      domain.DemoDiningTables(),
		waiters:     domain.DemoWaiters(),
		idemTables:  make(map[string]domain.DiningTable),
		idemMenu:    make(map[string]domain.MenuItem),
		idemWaiters: make(map[string]domain.Waiter),
		idemOrders:  make(map[string]domain.DiningTable),
		idemAddItem: make(map[string]domain.DiningTable),
		idemCleared: make(map[string]bool),
	}
	r.tenants[dbName] = st
	return st
}

func resolveMenuDefaults(menu []domain.MenuItem, in domain.AddOrderItemInput) domain.AddOrderItemInput {
	if in.ProductID != "" && (strings.TrimSpace(in.Name) == "" || in.Price <= 0) {
		for _, m := range menu {
			if m.ID == in.ProductID || strings.EqualFold(m.Code, in.ProductID) {
				if strings.TrimSpace(in.Name) == "" {
					in.Name = m.Name
				}
				if in.Price <= 0 {
					in.Price = m.SalePrice
				}
				break
			}
		}
	}
	return in
}

func (r *Repository) GetState(_ context.Context, dbName string) (domain.GastroState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	tables := make([]domain.DiningTable, len(st.tables))
	for i := range st.tables {
		cloned := st.tables[i].Clone()
		cloned.NormalizeState()
		tables[i] = cloned
	}
	menu := make([]domain.MenuItem, len(st.menuItems))
	copy(menu, st.menuItems)

	waiters := make([]domain.Waiter, len(st.waiters))
	copy(waiters, st.waiters)

	return domain.GastroState{
		NextMenuCode:   r.seq.Peek(dbName, "MNU", menuSeqBase(dbName)),
		NextWaiterCode: r.seq.Peek(dbName, "MSR", waiterSeqBase(dbName)),
		Tables:         tables,
		Products:       menu,
		Waiters:        waiters,
	}, nil
}

func (r *Repository) CreateTable(_ context.Context, dbName, idemKey string, in domain.CreateTableInput) (domain.DiningTable, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemTables[cleanKey]; ok {
			return prev.Clone(), nil
		}
	}

	seqCode := r.seq.Next(dbName, "TBL", tableSeqBase(dbName))
	tbl, err := domain.BuildDiningTable(seqCode, in)
	if err != nil {
		return domain.DiningTable{}, err
	}
	st.tables = append(st.tables, tbl.Clone())
	if cleanKey != "" {
		st.idemTables[cleanKey] = tbl.Clone()
	}
	return tbl.Clone(), nil
}

func (r *Repository) UpdateTable(_ context.Context, dbName, tableID string, in domain.UpdateTableInput) (domain.DiningTable, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	for i := range st.tables {
		if st.tables[i].ID == tableID {
			candidate := st.tables[i].Clone()
			candidate.NormalizeState()
			if err := candidate.ApplyTableUpdate(in); err != nil {
				return domain.DiningTable{}, err
			}
			st.tables[i] = candidate
			return candidate.Clone(), nil
		}
	}
	return domain.DiningTable{}, apperr.NotFound("Mesa no encontrada")
}

func (r *Repository) DeleteTable(_ context.Context, dbName, tableID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	for i := range st.tables {
		if st.tables[i].ID == tableID {
			if len(st.tables[i].Items) > 0 {
				return apperr.Conflict("No se puede eliminar una mesa con consumos activos; liquida o retira los platos primero")
			}
			st.tables = append(st.tables[:i], st.tables[i+1:]...)
			return nil
		}
	}
	return apperr.NotFound("Mesa no encontrada")
}

func (r *Repository) CreateMenuItem(_ context.Context, dbName, idemKey string, in domain.CreateMenuItemInput) (domain.MenuItem, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemMenu[cleanKey]; ok {
			return prev, nil
		}
	}

	seqCode := r.seq.Next(dbName, "MNU", menuSeqBase(dbName))
	item, err := domain.BuildMenuItem(seqCode, in)
	if err != nil {
		return domain.MenuItem{}, err
	}
	st.menuItems = append(st.menuItems, item)
	if cleanKey != "" {
		st.idemMenu[cleanKey] = item
	}
	return item, nil
}

func (r *Repository) UpdateMenuItem(_ context.Context, dbName, itemID string, in domain.UpdateMenuItemInput) (domain.MenuItem, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	for i := range st.menuItems {
		if st.menuItems[i].ID == itemID || strings.EqualFold(st.menuItems[i].Code, itemID) {
			candidate := st.menuItems[i]
			if err := candidate.ApplyMenuItemUpdate(in); err != nil {
				return domain.MenuItem{}, err
			}
			st.menuItems[i] = candidate
			return candidate, nil
		}
	}
	return domain.MenuItem{}, apperr.NotFound("Plato o servicio no encontrado en la carta")
}

func (r *Repository) DeleteMenuItem(_ context.Context, dbName, itemID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	for i := range st.menuItems {
		if st.menuItems[i].ID == itemID || strings.EqualFold(st.menuItems[i].Code, itemID) {
			st.menuItems = append(st.menuItems[:i], st.menuItems[i+1:]...)
			return nil
		}
	}
	return apperr.NotFound("Plato o servicio no encontrado en la carta")
}

func (r *Repository) CreateWaiter(_ context.Context, dbName, idemKey string, in domain.CreateWaiterInput) (domain.Waiter, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemWaiters[cleanKey]; ok {
			return prev, nil
		}
	}

	seqCode := r.seq.Next(dbName, "MSR", waiterSeqBase(dbName))
	waiter, err := domain.BuildWaiter(seqCode, in)
	if err != nil {
		return domain.Waiter{}, err
	}
	st.waiters = append(st.waiters, waiter)
	if cleanKey != "" {
		st.idemWaiters[cleanKey] = waiter
	}
	return waiter, nil
}

func (r *Repository) UpdateWaiter(_ context.Context, dbName, waiterID string, in domain.UpdateWaiterInput) (domain.Waiter, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	for i := range st.waiters {
		if st.waiters[i].ID == waiterID || strings.EqualFold(st.waiters[i].Code, waiterID) {
			candidate := st.waiters[i]
			if err := candidate.ApplyWaiterUpdate(in); err != nil {
				return domain.Waiter{}, err
			}
			st.waiters[i] = candidate
			return candidate, nil
		}
	}
	return domain.Waiter{}, apperr.NotFound("Mesero no encontrado")
}

func (r *Repository) DeleteWaiter(_ context.Context, dbName, waiterID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	for i := range st.waiters {
		if st.waiters[i].ID == waiterID || strings.EqualFold(st.waiters[i].Code, waiterID) {
			st.waiters = append(st.waiters[:i], st.waiters[i+1:]...)
			return nil
		}
	}
	return apperr.NotFound("Mesero no encontrado")
}

func (r *Repository) CreateOrder(_ context.Context, dbName, idemKey string, in domain.CreateOrderInput) (domain.DiningTable, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemOrders[cleanKey]; ok {
			return prev.Clone(), nil
		}
	}

	norm, err := domain.ValidateCreateOrderInput(in)
	if err != nil {
		return domain.DiningTable{}, err
	}

	if norm.Channel == domain.ChannelMesa {
		for i := range st.tables {
			if st.tables[i].ID == norm.TableID {
				candidate := st.tables[i].Clone()
				candidate.NormalizeState()
				ordSeq := ""
				if strings.TrimSpace(candidate.OrderCode) == "" {
					ordSeq = r.seq.Next(dbName, "ORD", orderSeqBase(dbName))
				}
				candidate.ApplyTableOrderMetadata(ordSeq, norm)
				for _, rawIt := range norm.Items {
					resolved := resolveMenuDefaults(st.menuItems, rawIt)
					if _, _, err := candidate.AddOrMergeItem(resolved); err != nil {
						return domain.DiningTable{}, err
					}
				}
				candidate.OrderStage = domain.StageNueva
				candidate.Status = domain.StatusOcupada
				st.tables[i] = candidate
				if cleanKey != "" {
					st.idemOrders[cleanKey] = candidate.Clone()
				}
				return candidate.Clone(), nil
			}
		}
		return domain.DiningTable{}, apperr.NotFound("Mesa no encontrada")
	}

	ordSeq := r.seq.Next(dbName, "ORD", orderSeqBase(dbName))
	ticket := domain.BuildStandaloneOrder(ordSeq, norm)
	for _, rawIt := range norm.Items {
		resolved := resolveMenuDefaults(st.menuItems, rawIt)
		if _, _, err := ticket.AddOrMergeItem(resolved); err != nil {
			return domain.DiningTable{}, err
		}
	}
	ticket.OrderStage = domain.StageNueva
	ticket.Status = domain.StatusOcupada
	st.tables = append(st.tables, ticket.Clone())
	if cleanKey != "" {
		st.idemOrders[cleanKey] = ticket.Clone()
	}
	return ticket.Clone(), nil
}

func (r *Repository) AddItemToTable(_ context.Context, dbName, idemKey, tableID string, in domain.AddOrderItemInput) (domain.DiningTable, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemAddItem[cleanKey]; ok {
			return prev.Clone(), nil
		}
	}

	in = resolveMenuDefaults(st.menuItems, in)

	for i := range st.tables {
		if st.tables[i].ID == tableID {
			candidate := st.tables[i].Clone()
			candidate.NormalizeState()
			if _, _, err := candidate.AddOrMergeItem(in); err != nil {
				return domain.DiningTable{}, err
			}
			if strings.TrimSpace(candidate.OrderCode) == "" {
				candidate.OrderCode = domain.FormatOrderCode(r.seq.Next(dbName, "ORD", orderSeqBase(dbName)))
			}
			st.tables[i] = candidate
			if cleanKey != "" {
				st.idemAddItem[cleanKey] = candidate.Clone()
			}
			return candidate.Clone(), nil
		}
	}
	return domain.DiningTable{}, apperr.NotFound("Mesa no encontrada")
}

func (r *Repository) RemoveItemFromTable(_ context.Context, dbName, tableID, itemID string) (domain.DiningTable, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	for i := range st.tables {
		if st.tables[i].ID == tableID {
			candidate := st.tables[i].Clone()
			candidate.NormalizeState()
			if err := candidate.RemoveItem(itemID); err != nil {
				return domain.DiningTable{}, err
			}
			st.tables[i] = candidate
			return candidate.Clone(), nil
		}
	}
	return domain.DiningTable{}, apperr.NotFound("Mesa no encontrada")
}

func (r *Repository) SendToKitchen(_ context.Context, dbName, tableID string) (domain.DiningTable, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	for i := range st.tables {
		if st.tables[i].ID == tableID {
			candidate := st.tables[i].Clone()
			candidate.NormalizeState()
			if err := candidate.SendToKitchen(); err != nil {
				return domain.DiningTable{}, err
			}
			st.tables[i] = candidate
			return candidate.Clone(), nil
		}
	}
	return domain.DiningTable{}, apperr.NotFound("Mesa no encontrada")
}

func (r *Repository) MarkReady(_ context.Context, dbName, tableID string) (domain.DiningTable, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	for i := range st.tables {
		if st.tables[i].ID == tableID {
			candidate := st.tables[i].Clone()
			candidate.NormalizeState()
			if err := candidate.MarkReady(); err != nil {
				return domain.DiningTable{}, err
			}
			st.tables[i] = candidate
			return candidate.Clone(), nil
		}
	}
	return domain.DiningTable{}, apperr.NotFound("Mesa no encontrada")
}

func (r *Repository) AdvanceStage(_ context.Context, dbName, tableID, stage string) (domain.DiningTable, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	for i := range st.tables {
		if st.tables[i].ID == tableID {
			candidate := st.tables[i].Clone()
			candidate.NormalizeState()
			if err := candidate.SetStage(stage); err != nil {
				return domain.DiningTable{}, err
			}
			st.tables[i] = candidate
			return candidate.Clone(), nil
		}
	}
	return domain.DiningTable{}, apperr.NotFound("Comanda o mesa no encontrada")
}

func (r *Repository) ClearInvoicedTable(_ context.Context, dbName, idemKey, tableID, _ string) (bool, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemCleared[cleanKey]; ok {
			return prev, nil
		}
	}

	for i := range st.tables {
		tbl := &st.tables[i]
		if tbl.ID == tableID || strings.EqualFold(tbl.Name, tableID) || (tbl.OrderCode != "" && strings.EqualFold(tbl.OrderCode, tableID)) {
			if tbl.IsStandaloneTicket() {
				st.tables = append(st.tables[:i], st.tables[i+1:]...)
			} else {
				tbl.ClearAfterInvoice()
			}
			if cleanKey != "" {
				st.idemCleared[cleanKey] = true
			}
			return true, nil
		}
	}
	return false, apperr.NotFound("Mesa no encontrada")
}
