package backend

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	inventoryv1 "github.com/alexmargomez/proveko/proto/inventory/v1"
	"github.com/go-chi/chi/v5"
	"google.golang.org/grpc"
)

type Service struct {
	db            *tenantdb.Manager
	clusterSecret string
}

func NewService(db *tenantdb.Manager, clusterSecret string) *Service {
	return &Service{
		db:            db,
		clusterSecret: clusterSecret,
	}
}

func (s *Service) RegisterGRPC(srv *grpc.Server) {
	inventoryv1.RegisterInventoryServiceServer(srv, s)
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/all", s.handleGetAll)
	r.Post("/products", s.handleCreateProduct)
	r.Delete("/products/{id}", s.handleDeleteProduct)
	r.Post("/products/{id}/delta", s.handleDeltaStock)
	r.Post("/products/{id}/restock", s.handleRestockProduct)
	r.Post("/products/{id}/transfer", s.handleTransferProduct)
	r.Post("/warehouses", s.handleCreateWarehouse)
	r.Post("/requests", s.handleCreateSupplyRequest)

	return r
}

func (s *Service) DeductStock(
	ctx context.Context,
	req *inventoryv1.DeductStockRequest,
) (*inventoryv1.DeductStockResponse, error) {
	if req == nil || len(req.Items) == 0 {
		return &inventoryv1.DeductStockResponse{Ok: true, ProcessedCount: 0}, nil
	}

	tc := authguard.FromContext(ctx)
	now := time.Now().Format("2006-01-02 15:04")
	var processed int32

	err := s.db.WithWrite(ctx, tc.DBName, func(d *tenantdb.TenantData) error {
		for _, item := range req.Items {
			if item.Quantity <= 0 || strings.TrimSpace(item.ProductID) == "" {
				continue
			}
			for i := range d.Products {
				if d.Products[i].ID == item.ProductID {
					newStock := d.Products[i].Stock - item.Quantity
					if newStock < 0 {
						newStock = 0
					}
					d.Products[i].Stock = newStock

					actor := strings.TrimSpace(item.Actor)
					if actor == "" {
						actor = tc.Username
					}
					ref := strings.TrimSpace(item.ReferenceDoc)
					if ref == "" {
						ref = "VENTA POS"
					}

					mov := tenantdb.KardexMovement{
						ID:           s.db.Seq.Next(tc.DBName, "KDX", 8000),
						Date:         now,
						ProductID:    d.Products[i].ID,
						ProductName:  d.Products[i].Name,
						WarehouseID:  d.Products[i].WarehouseID,
						MovementType: "SALIDA VENTA",
						Qty:          -item.Quantity,
						UnitCost:     d.Products[i].CostPrice,
						BalanceAfter: d.Products[i].Stock,
						ReferenceDoc: ref,
						Actor:        actor,
					}
					d.Kardex = prependKardex(d.Kardex, mov)
					processed++
					break
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &inventoryv1.DeductStockResponse{
		Ok:             true,
		ProcessedCount: processed,
	}, nil
}

func (s *Service) handleGetAll(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())

	var (
		products   = []tenantdb.Product{}
		warehouses = []tenantdb.Warehouse{}
		suppliers  = []tenantdb.Supplier{}
		kardex     = []tenantdb.KardexMovement{}
		requests   = []tenantdb.GenericRecord{}
	)

	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		if len(d.Products) > 0 {
			products = append(products, d.Products...)
		}
		if len(d.Warehouses) > 0 {
			warehouses = append(warehouses, d.Warehouses...)
		}
		if len(d.Suppliers) > 0 {
			suppliers = append(suppliers, d.Suppliers...)
		}
		if len(d.Kardex) > 0 {
			kardex = append(kardex, d.Kardex...)
		}
		if d.GenericModules != nil {
			if list := d.GenericModules["solicitudes_insumos"]; len(list) > 0 {
				requests = append(requests, list...)
			}
		}
	})

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":                true,
		"nextProductCode":   s.db.Seq.Peek(tc.DBName, "PRD", 1010),
		"nextWarehouseCode": s.db.Seq.Peek(tc.DBName, "BOD", 10),
		"nextRequestCode":   s.db.Seq.Peek(tc.DBName, "REQ", 500),
		"products":          products,
		"warehouses":        warehouses,
		"suppliers":         suppliers,
		"kardex":            kardex,
		"requests":          requests,
	})
}

func (s *Service) handleCreateProduct(w http.ResponseWriter, r *http.Request) {
	var in tenantdb.Product
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos del producto inválidos")
		return
	}
	if strings.TrimSpace(in.Name) == "" {
		httpx.Error(w, http.StatusBadRequest, "El nombre del producto es obligatorio")
		return
	}

	tc := authguard.FromContext(r.Context())
	code := s.db.Seq.Next(tc.DBName, "PRD", 1010)
	now := time.Now().Format("2006-01-02 15:04")

	var created tenantdb.Product
	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		whID := strings.TrimSpace(in.WarehouseID)
		if whID == "" && len(d.Warehouses) > 0 {
			whID = d.Warehouses[0].ID
		}
		supID := strings.TrimSpace(in.SupplierID)
		if supID == "" && len(d.Suppliers) > 0 {
			supID = d.Suppliers[0].ID
		}
		cat := strings.TrimSpace(in.Category)
		if cat == "" {
			cat = "General"
		}

		created = tenantdb.Product{
			ID:          strings.ToLower(strings.ReplaceAll(code, "-", "")),
			Code:        code,
			Name:        strings.TrimSpace(in.Name),
			Category:    cat,
			WarehouseID: whID,
			SupplierID:  supID,
			CostPrice:   math.Max(0, in.CostPrice),
			SalePrice:   math.Max(0, in.SalePrice),
			TaxPct:      math.Max(0, in.TaxPct),
			Stock:       math.Max(0, in.Stock),
			MinStock:    math.Max(0, in.MinStock),
			LotCode:     strings.TrimSpace(in.LotCode),
			ExpiryDate:  strings.TrimSpace(in.ExpiryDate),
		}
		d.Products = append(d.Products, created)

		mov := tenantdb.KardexMovement{
			ID:           s.db.Seq.Next(tc.DBName, "KDX", 8000),
			Date:         now,
			ProductID:    created.ID,
			ProductName:  created.Name,
			WarehouseID:  created.WarehouseID,
			MovementType: "SALDO INICIAL",
			Qty:          created.Stock,
			UnitCost:     created.CostPrice,
			BalanceAfter: created.Stock,
			ReferenceDoc: created.Code,
			Actor:        tc.Username,
		}
		d.Kardex = prependKardex(d.Kardex, mov)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"product": created,
	})
}

func (s *Service) handleDeleteProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tc := authguard.FromContext(r.Context())

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		filtered := make([]tenantdb.Product, 0, len(d.Products))
		found := false
		for _, p := range d.Products {
			if p.ID == id {
				found = true
				continue
			}
			filtered = append(filtered, p)
		}
		if !found {
			return errors.New("producto no encontrado")
		}
		d.Products = filtered
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"ok": true})
}

type deltaPayload struct {
	Delta float64 `json:"delta"`
}

func (s *Service) handleDeltaStock(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req deltaPayload
	if err := httpx.Decode(r, &req); err != nil || req.Delta == 0 {
		httpx.Error(w, http.StatusBadRequest, "El ajuste delta debe ser distinto de cero")
		return
	}

	tc := authguard.FromContext(r.Context())
	now := time.Now().Format("2006-01-02 15:04")

	var updated tenantdb.Product
	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		idx := -1
		for i := range d.Products {
			if d.Products[i].ID == id {
				idx = i
				break
			}
		}
		if idx < 0 {
			return errors.New("producto no encontrado")
		}
		newStock := d.Products[idx].Stock + req.Delta
		if newStock < 0 {
			return errors.New("el stock del producto no puede quedar negativo")
		}
		d.Products[idx].Stock = newStock
		updated = d.Products[idx]

		movType := "AJUSTE ENTRADA"
		if req.Delta < 0 {
			movType = "AJUSTE SALIDA"
		}
		d.Kardex = prependKardex(d.Kardex, tenantdb.KardexMovement{
			ID:           s.db.Seq.Next(tc.DBName, "KDX", 8000),
			Date:         now,
			ProductID:    updated.ID,
			ProductName:  updated.Name,
			WarehouseID:  updated.WarehouseID,
			MovementType: movType,
			Qty:          req.Delta,
			UnitCost:     updated.CostPrice,
			BalanceAfter: updated.Stock,
			ReferenceDoc: "AJUSTE RÁPIDO",
			Actor:        tc.Username,
		})
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"product": updated,
	})
}

type restockPayload struct {
	Qty        float64 `json:"qty"`
	UnitCost   float64 `json:"unitCost"`
	LotCode    string  `json:"lotCode"`
	ExpiryDate string  `json:"expiryDate"`
}

func (s *Service) handleRestockProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req restockPayload
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos de surtido inválidos")
		return
	}
	if req.Qty <= 0 {
		httpx.Error(w, http.StatusBadRequest, "La cantidad a surtir debe ser mayor a cero")
		return
	}

	tc := authguard.FromContext(r.Context())
	now := time.Now().Format("2006-01-02 15:04")

	var updated tenantdb.Product
	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		idx := -1
		for i := range d.Products {
			if d.Products[i].ID == id {
				idx = i
				break
			}
		}
		if idx < 0 {
			return errors.New("producto no encontrado")
		}

		p := &d.Products[idx]
		p.Stock += req.Qty
		if req.UnitCost > 0 {
			p.CostPrice = req.UnitCost
		}
		if strings.TrimSpace(req.LotCode) != "" {
			p.LotCode = strings.TrimSpace(req.LotCode)
		}
		if strings.TrimSpace(req.ExpiryDate) != "" {
			p.ExpiryDate = strings.TrimSpace(req.ExpiryDate)
		}
		updated = *p

		ref := "ENTRADA BODEGA"
		if updated.LotCode != "" {
			ref = "LOTE " + updated.LotCode
		}

		d.Kardex = prependKardex(d.Kardex, tenantdb.KardexMovement{
			ID:           s.db.Seq.Next(tc.DBName, "KDX", 8000),
			Date:         now,
			ProductID:    updated.ID,
			ProductName:  updated.Name,
			WarehouseID:  updated.WarehouseID,
			MovementType: "ENTRADA COMPRA",
			Qty:          req.Qty,
			UnitCost:     updated.CostPrice,
			BalanceAfter: updated.Stock,
			ReferenceDoc: ref,
			Actor:        tc.Username,
		})
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"product": updated,
	})
}

type transferPayload struct {
	TargetWarehouseID string  `json:"targetWarehouseId"`
	Qty               float64 `json:"qty"`
	Note              string  `json:"note"`
}

func (s *Service) handleTransferProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req transferPayload
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos de traslado inválidos")
		return
	}
	if req.Qty <= 0 || strings.TrimSpace(req.TargetWarehouseID) == "" {
		httpx.Error(w, http.StatusBadRequest, "Selecciona la bodega destino y una cantidad mayor a cero")
		return
	}

	tc := authguard.FromContext(r.Context())
	now := time.Now().Format("2006-01-02 15:04")

	var updated tenantdb.Product
	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		idx := -1
		for i := range d.Products {
			if d.Products[i].ID == id {
				idx = i
				break
			}
		}
		if idx < 0 {
			return errors.New("producto origen no encontrado")
		}

		src := &d.Products[idx]
		if src.WarehouseID == req.TargetWarehouseID {
			return errors.New("la bodega destino debe ser diferente a la bodega actual")
		}
		if req.Qty > src.Stock {
			return fmt.Errorf("cantidad insuficiente en bodega origen (disponible: %.2f)", src.Stock)
		}

		targetWhName := req.TargetWarehouseID
		srcWhName := src.WarehouseID
		for _, w := range d.Warehouses {
			if w.ID == req.TargetWarehouseID {
				targetWhName = w.Name
			}
			if w.ID == src.WarehouseID {
				srcWhName = w.Name
			}
		}
		refNote := fmt.Sprintf("%s -> %s", srcWhName, targetWhName)
		if strings.TrimSpace(req.Note) != "" {
			refNote += " (" + strings.TrimSpace(req.Note) + ")"
		}

		if req.Qty == src.Stock {
			src.WarehouseID = req.TargetWarehouseID
			updated = *src
			d.Kardex = prependKardex(d.Kardex, tenantdb.KardexMovement{
				ID:           s.db.Seq.Next(tc.DBName, "KDX", 8000),
				Date:         now,
				ProductID:    src.ID,
				ProductName:  src.Name,
				WarehouseID:  req.TargetWarehouseID,
				MovementType: "TRASLADO BODEGA",
				Qty:          req.Qty,
				UnitCost:     src.CostPrice,
				BalanceAfter: src.Stock,
				ReferenceDoc: refNote,
				Actor:        tc.Username,
			})
			return nil
		}

		origWh := src.WarehouseID
		src.Stock -= req.Qty
		updated = *src

		destIdx := -1
		for i := range d.Products {
			if d.Products[i].Code == src.Code && d.Products[i].WarehouseID == req.TargetWarehouseID {
				destIdx = i
				break
			}
		}

		var destProd tenantdb.Product
		if destIdx >= 0 {
			d.Products[destIdx].Stock += req.Qty
			destProd = d.Products[destIdx]
		} else {
			newCode := s.db.Seq.Next(tc.DBName, "PRD", 1010)
			destProd = *src
			destProd.ID = strings.ToLower(strings.ReplaceAll(newCode, "-", ""))
			destProd.WarehouseID = req.TargetWarehouseID
			destProd.Stock = req.Qty
			d.Products = append(d.Products, destProd)
		}

		d.Kardex = prependKardex(d.Kardex, tenantdb.KardexMovement{
			ID:           s.db.Seq.Next(tc.DBName, "KDX", 8000),
			Date:         now,
			ProductID:    src.ID,
			ProductName:  src.Name,
			WarehouseID:  origWh,
			MovementType: "TRASLADO SALIDA",
			Qty:          -req.Qty,
			UnitCost:     src.CostPrice,
			BalanceAfter: src.Stock,
			ReferenceDoc: refNote,
			Actor:        tc.Username,
		})
		d.Kardex = prependKardex(d.Kardex, tenantdb.KardexMovement{
			ID:           s.db.Seq.Next(tc.DBName, "KDX", 8000),
			Date:         now,
			ProductID:    destProd.ID,
			ProductName:  destProd.Name,
			WarehouseID:  req.TargetWarehouseID,
			MovementType: "TRASLADO ENTRADA",
			Qty:          req.Qty,
			UnitCost:     destProd.CostPrice,
			BalanceAfter: destProd.Stock,
			ReferenceDoc: refNote,
			Actor:        tc.Username,
		})
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"product": updated,
	})
}

func (s *Service) handleCreateWarehouse(w http.ResponseWriter, r *http.Request) {
	var in tenantdb.Warehouse
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos de la bodega inválidos")
		return
	}
	if strings.TrimSpace(in.Name) == "" {
		httpx.Error(w, http.StatusBadRequest, "El nombre de la bodega es obligatorio")
		return
	}

	tc := authguard.FromContext(r.Context())
	code := s.db.Seq.Next(tc.DBName, "BOD", 10)
	created := tenantdb.Warehouse{
		ID:      strings.ToLower(strings.ReplaceAll(code, "-", "")),
		Code:    code,
		Name:    strings.TrimSpace(in.Name),
		City:    strings.TrimSpace(in.City),
		Manager: strings.TrimSpace(in.Manager),
	}

	if err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		d.Warehouses = append(d.Warehouses, created)
		return nil
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":        true,
		"warehouse": created,
	})
}

type supplyRequestPayload struct {
	ProductID     string  `json:"productId"`
	ProductName   string  `json:"productName"`
	WarehouseID   string  `json:"warehouseId"`
	WarehouseName string  `json:"warehouseName"`
	Qty           float64 `json:"qty"`
	Requester     string  `json:"requester"`
	Priority      string  `json:"priority"`
	Notes         string  `json:"notes"`
}

func (s *Service) handleCreateSupplyRequest(w http.ResponseWriter, r *http.Request) {
	var in supplyRequestPayload
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Datos de la requisición inválidos")
		return
	}
	if in.Qty <= 0 {
		in.Qty = 1
	}

	tc := authguard.FromContext(r.Context())
	code := s.db.Seq.Next(tc.DBName, "REQ", 500)
	now := time.Now().Format("2006-01-02 15:04")

	var record tenantdb.GenericRecord
	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		if d.GenericModules == nil {
			d.GenericModules = map[string][]tenantdb.GenericRecord{}
		}
		prodName := strings.TrimSpace(in.ProductName)
		if prodName == "" && in.ProductID != "" {
			for _, p := range d.Products {
				if p.ID == in.ProductID {
					prodName = p.Name
					break
				}
			}
		}
		if prodName == "" {
			return errors.New("selecciona o escribe el insumo solicitado")
		}

		whName := strings.TrimSpace(in.WarehouseName)
		if whName == "" && in.WarehouseID != "" {
			for _, w := range d.Warehouses {
				if w.ID == in.WarehouseID {
					whName = w.Name
					break
				}
			}
		}
		priority := strings.TrimSpace(in.Priority)
		if priority == "" {
			priority = "Normal"
		}
		requester := strings.TrimSpace(in.Requester)
		if requester == "" {
			requester = tc.Username
		}

		record = tenantdb.GenericRecord{
			ID:        code,
			CreatedAt: now,
			ModuleKey: "solicitudes_insumos",
			Fields: map[string]string{
				"productId":     in.ProductID,
				"productName":   prodName,
				"warehouseId":   in.WarehouseID,
				"warehouseName": whName,
				"qty":           fmt.Sprintf("%.2f", in.Qty),
				"requester":     requester,
				"priority":      priority,
				"status":        "Pendiente Aprobación",
				"notes":         strings.TrimSpace(in.Notes),
			},
		}
		d.GenericModules["solicitudes_insumos"] = append(
			[]tenantdb.GenericRecord{record},
			d.GenericModules["solicitudes_insumos"]...,
		)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":      true,
		"request": record,
	})
}

func prependKardex(list []tenantdb.KardexMovement, item tenantdb.KardexMovement) []tenantdb.KardexMovement {
	out := make([]tenantdb.KardexMovement, 0, len(list)+1)
	out = append(out, item)
	out = append(out, list...)
	return out
}
