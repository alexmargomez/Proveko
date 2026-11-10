package backend

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/licensegate"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	gastrov1 "github.com/alexmargomez/proveko/proto/gastro/v1"
	"github.com/alexmargomez/proveko/services/ms-comandas/migrations"
	"github.com/go-chi/chi/v5"
	"google.golang.org/grpc"
)

type Service struct {
	db            *tenantdb.Manager
	clusterSecret string
}

var _ gastrov1.GastroServiceServer = (*Service)(nil)

func NewService(db *tenantdb.Manager, clusterSecret string) *Service {
	if db != nil {
		db.RegisterServiceMigration("ms-comandas", migrations.SchemaSQL)
	}
	return &Service{
		db:            db,
		clusterSecret: clusterSecret,
	}
}

func (s *Service) RegisterGRPC(srv *grpc.Server) {
	gastrov1.RegisterGastroServiceServer(srv, s)
}

func (s *Service) ClearInvoicedTable(ctx context.Context, req *gastrov1.ClearTableEvent) (*gastrov1.ClearTableResponse, error) {
	if req == nil || strings.TrimSpace(req.TableID) == "" {
		return &gastrov1.ClearTableResponse{Ok: false}, nil
	}
	tc := authguard.FromContext(ctx)
	targetID := strings.TrimSpace(req.TableID)

	err := s.db.WithWrite(ctx, tc.DBName, func(d *tenantdb.TenantData) error {
		for i := range d.DiningTables {
			if d.DiningTables[i].ID == targetID || strings.EqualFold(d.DiningTables[i].Name, targetID) {
				d.DiningTables[i].Items = []tenantdb.GastroItem{}
				d.DiningTables[i].Total = 0
				d.DiningTables[i].Status = "Libre"
				break
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &gastrov1.ClearTableResponse{Ok: true}, nil
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/tables", s.handleGetTables)
	r.With(licensegate.RequireModule("mapa_mesas")).Post("/tables", s.handleCreateTable)
	r.With(licensegate.RequireModule("mapa_mesas")).Post("/tables/{id}/items", s.handleAddItem)
	r.With(licensegate.RequireModule("mapa_mesas")).Delete("/tables/{id}/items/{index}", s.handleDeleteItem)
	r.With(licensegate.RequireModule("mapa_mesas")).Post("/tables/{id}/send-kitchen", s.handleSendKitchen)
	r.Post("/tables/{id}/ready", s.handleMarkReady)

	return r
}

func (s *Service) handleGetTables(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())

	var (
		tables   []tenantdb.DiningTable
		products []tenantdb.Product
	)

	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		tables = make([]tenantdb.DiningTable, len(d.DiningTables))
		copy(tables, d.DiningTables)
		for i := range tables {
			if tables[i].Items == nil {
				tables[i].Items = []tenantdb.GastroItem{}
			}
		}
		products = make([]tenantdb.Product, len(d.Products))
		copy(products, d.Products)
	})

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"tables":   tables,
		"products": products,
	})
}

type createTableReq struct {
	Name   string `json:"name"`
	Zone   string `json:"zone"`
	Waiter string `json:"waiter"`
}

func (s *Service) handleCreateTable(w http.ResponseWriter, r *http.Request) {
	var req createTableReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato de mesa inválido")
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		httpx.Error(w, http.StatusBadRequest, "El nombre o número de la mesa es obligatorio")
		return
	}
	if !strings.Contains(strings.ToLower(name), "mesa") && !strings.Contains(strings.ToLower(name), "barra") {
		name = "Mesa " + name
	}
	zone := strings.TrimSpace(req.Zone)
	if zone == "" {
		zone = "Salón Principal"
	}
	waiter := strings.TrimSpace(req.Waiter)
	if waiter == "" {
		waiter = "Mesero Turno"
	}

	tc := authguard.FromContext(r.Context())
	newTable := tenantdb.DiningTable{
		ID:     strings.ToLower(s.db.Seq.Next(tc.DBName, "TBL", 10)),
		Name:   name,
		Zone:   zone,
		Waiter: waiter,
		Status: "Libre",
		Items:  []tenantdb.GastroItem{},
		Total:  0,
	}

	if err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		d.DiningTables = append(d.DiningTables, newTable)
		return nil
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":    true,
		"table": newTable,
	})
}

type addItemReq struct {
	ProductID string  `json:"productId"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Qty       float64 `json:"qty"`
	Note      string  `json:"note"`
}

func (s *Service) handleAddItem(w http.ResponseWriter, r *http.Request) {
	tableID := strings.TrimSpace(chi.URLParam(r, "id"))
	var req addItemReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato de ítem inválido")
		return
	}
	if req.Qty <= 0 {
		req.Qty = 1
	}

	tc := authguard.FromContext(r.Context())
	if !licensegate.HasFeature(r.Context(), "mapa_mesas", "notas_preparacion") && len(tc.ActiveModules) > 0 {
		req.Note = ""
	}
	req.Note = strings.TrimSpace(req.Note)

	errNotFound := errors.New("mesa no encontrada")
	errInvalid := errors.New("plato o producto inválido")
	var updated tenantdb.DiningTable

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		if req.ProductID != "" && (strings.TrimSpace(req.Name) == "" || req.Price <= 0) {
			for _, p := range d.Products {
				if p.ID == req.ProductID {
					if strings.TrimSpace(req.Name) == "" {
						req.Name = p.Name
					}
					if req.Price <= 0 {
						req.Price = p.SalePrice
					}
					break
				}
			}
		}
		req.Name = strings.TrimSpace(req.Name)
		if req.Name == "" || req.Price <= 0 {
			return errInvalid
		}

		for i := range d.DiningTables {
			if d.DiningTables[i].ID == tableID {
				tbl := &d.DiningTables[i]
				merged := false
				for j := range tbl.Items {
					if req.ProductID != "" && tbl.Items[j].ProductID == req.ProductID && tbl.Items[j].Note == req.Note {
						tbl.Items[j].Qty += req.Qty
						tbl.Items[j].Price = req.Price
						merged = true
						break
					}
				}
				if !merged {
					tbl.Items = append(tbl.Items, tenantdb.GastroItem{
						ProductID: req.ProductID,
						Name:      req.Name,
						Qty:       req.Qty,
						Price:     req.Price,
						Note:      req.Note,
					})
				}
				tbl.Total = computeTableTotal(tbl.Items)
				tbl.Status = "Ocupada"
				updated = *tbl
				return nil
			}
		}
		return errNotFound
	})
	if errors.Is(err, errInvalid) {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, errNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"table": updated,
	})
}

func (s *Service) handleDeleteItem(w http.ResponseWriter, r *http.Request) {
	tableID := strings.TrimSpace(chi.URLParam(r, "id"))
	idx, err := strconv.Atoi(chi.URLParam(r, "index"))
	if err != nil || idx < 0 {
		httpx.Error(w, http.StatusBadRequest, "Índice de ítem inválido")
		return
	}

	tc := authguard.FromContext(r.Context())
	errNotFound := errors.New("mesa o ítem no encontrado")
	var updated tenantdb.DiningTable

	wErr := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		for i := range d.DiningTables {
			if d.DiningTables[i].ID == tableID {
				tbl := &d.DiningTables[i]
				if idx >= len(tbl.Items) {
					return errNotFound
				}
				tbl.Items = append(tbl.Items[:idx], tbl.Items[idx+1:]...)
				tbl.Total = computeTableTotal(tbl.Items)
				if len(tbl.Items) == 0 {
					tbl.Status = "Libre"
				}
				updated = *tbl
				return nil
			}
		}
		return errNotFound
	})
	if errors.Is(wErr, errNotFound) {
		httpx.Error(w, http.StatusNotFound, wErr.Error())
		return
	}
	if wErr != nil {
		httpx.Error(w, http.StatusInternalServerError, wErr.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"table": updated,
	})
}

func (s *Service) handleSendKitchen(w http.ResponseWriter, r *http.Request) {
	tableID := strings.TrimSpace(chi.URLParam(r, "id"))
	tc := authguard.FromContext(r.Context())
	errNotFound := errors.New("mesa no encontrada")
	errEmpty := errors.New("agrega al menos un plato antes de enviar a cocina")
	var updated tenantdb.DiningTable

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		for i := range d.DiningTables {
			if d.DiningTables[i].ID == tableID {
				if len(d.DiningTables[i].Items) == 0 {
					return errEmpty
				}
				d.DiningTables[i].Status = "En Cocina"
				updated = d.DiningTables[i]
				return nil
			}
		}
		return errNotFound
	})
	if errors.Is(err, errEmpty) {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	if errors.Is(err, errNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"table": updated,
	})
}

func (s *Service) handleMarkReady(w http.ResponseWriter, r *http.Request) {
	if !licensegate.HasModule(r.Context(), "monitor_cocina") && !licensegate.HasModule(r.Context(), "mapa_mesas") {
		httpx.Error(w, http.StatusForbidden, "No tienes módulo habilitado para actualizar comandas")
		return
	}
	tableID := strings.TrimSpace(chi.URLParam(r, "id"))
	tc := authguard.FromContext(r.Context())
	errNotFound := errors.New("mesa no encontrada")
	var updated tenantdb.DiningTable

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		for i := range d.DiningTables {
			if d.DiningTables[i].ID == tableID {
				if len(d.DiningTables[i].Items) == 0 {
					d.DiningTables[i].Status = "Libre"
				} else {
					d.DiningTables[i].Status = "Ocupada"
				}
				updated = d.DiningTables[i]
				return nil
			}
		}
		return errNotFound
	})
	if errors.Is(err, errNotFound) {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":    true,
		"table": updated,
	})
}

func computeTableTotal(items []tenantdb.GastroItem) float64 {
	var sum float64
	for _, it := range items {
		sum += it.Qty * it.Price
	}
	return sum
}
