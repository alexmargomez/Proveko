package memory

import (
	"context"
	"strings"
	"sync"

	"ms-comandas/internal/platform/apperr"
	"ms-comandas/internal/platform/seqmem"
	"ms-comandas/internal/domain"
)

const (
	baseTableSeq = 104
	baseMenuSeq  = 205
)

type tenantStore struct {
	tables      []domain.DiningTable
	menuItems   []domain.MenuItem
	idemTables  map[string]domain.DiningTable
	idemMenu    map[string]domain.MenuItem
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
	st := &tenantStore{
		menuItems: []domain.MenuItem{
			{ID: "mnu-201", Code: "MNU-201", Name: "Punta de Anca a la Parrilla 350g", Category: "Restaurante — Fuertes", SalePrice: 48000, TaxPct: 8},
			{ID: "mnu-202", Code: "MNU-202", Name: "Salmón Sellado en Mantequilla de Finas Hierbas", Category: "Restaurante — Fuertes", SalePrice: 52000, TaxPct: 8},
			{ID: "mnu-203", Code: "MNU-203", Name: "Ceviche Clásico de Camarón", Category: "Restaurante — Entradas", SalePrice: 32000, TaxPct: 8},
			{ID: "mnu-204", Code: "MNU-204", Name: "Limonada de Coco Natural", Category: "Barra y Bebidas", SalePrice: 12000, TaxPct: 8},
			{ID: "mnu-205", Code: "MNU-205", Name: "Café Espresso Doble Origen", Category: "Barra y Bebidas", SalePrice: 8500, TaxPct: 8},
		},
		tables: []domain.DiningTable{
			{
				ID:     "tbl-101",
				Name:   "Mesa 1",
				Zone:   "Salón Principal",
				Waiter: "Camila Restrepo",
				Status: domain.StatusEnCocina,
				Items: []domain.OrderItem{
					{ItemID: "itm-seed-101a", ProductID: "mnu-201", Name: "Punta de Anca a la Parrilla 350g", Qty: 2, Price: 48000, Note: "Término 3/4"},
					{ItemID: "itm-seed-101b", ProductID: "mnu-204", Name: "Limonada de Coco Natural", Qty: 2, Price: 12000, Note: ""},
				},
				Total: 120000,
			},
			{
				ID:     "tbl-102",
				Name:   "Mesa 2",
				Zone:   "Terraza",
				Waiter: "Andrés Mejía",
				Status: domain.StatusOcupada,
				Items: []domain.OrderItem{
					{ItemID: "itm-seed-102a", ProductID: "mnu-203", Name: "Ceviche Clásico de Camarón", Qty: 1, Price: 32000, Note: "Sin cebolla roja"},
				},
				Total: 32000,
			},
			{
				ID:     "tbl-103",
				Name:   "Mesa 3",
				Zone:   "Salón Principal",
				Waiter: "Camila Restrepo",
				Status: domain.StatusLibre,
				Items:  []domain.OrderItem{},
				Total:  0,
			},
			{
				ID:     "tbl-104",
				Name:   "Barra 1",
				Zone:   "Barra",
				Waiter: "Andrés Mejía",
				Status: domain.StatusLibre,
				Items:  []domain.OrderItem{},
				Total:  0,
			},
		},
		idemTables:  make(map[string]domain.DiningTable),
		idemMenu:    make(map[string]domain.MenuItem),
		idemAddItem: make(map[string]domain.DiningTable),
		idemCleared: make(map[string]bool),
	}
	r.tenants[dbName] = st
	return st
}

func (r *Repository) GetState(_ context.Context, dbName string) (domain.GastroState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	tables := make([]domain.DiningTable, len(st.tables))
	for i := range st.tables {
		tables[i] = st.tables[i].Clone()
	}
	menu := make([]domain.MenuItem, len(st.menuItems))
	copy(menu, st.menuItems)

	return domain.GastroState{
		NextMenuCode: r.seq.Peek(dbName, "MNU", baseMenuSeq),
		Tables:       tables,
		Products:     menu,
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

	seqCode := r.seq.Next(dbName, "TBL", baseTableSeq)
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

	seqCode := r.seq.Next(dbName, "MNU", baseMenuSeq)
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

	if in.ProductID != "" && (strings.TrimSpace(in.Name) == "" || in.Price <= 0) {
		for _, m := range st.menuItems {
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

	for i := range st.tables {
		if st.tables[i].ID == tableID {
			candidate := st.tables[i].Clone()
			if _, _, err := candidate.AddOrMergeItem(in); err != nil {
				return domain.DiningTable{}, err
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
			if err := candidate.MarkReady(); err != nil {
				return domain.DiningTable{}, err
			}
			st.tables[i] = candidate
			return candidate.Clone(), nil
		}
	}
	return domain.DiningTable{}, apperr.NotFound("Mesa no encontrada")
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
		if st.tables[i].ID == tableID || strings.EqualFold(st.tables[i].Name, tableID) {
			st.tables[i].ClearAfterInvoice()
			if cleanKey != "" {
				st.idemCleared[cleanKey] = true
			}
			return true, nil
		}
	}
	return false, apperr.NotFound("Mesa no encontrada")
}
