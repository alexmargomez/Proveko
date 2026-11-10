package backend

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
	"github.com/alexmargomez/proveko/pkg/tenantdb"
	"github.com/go-chi/chi/v5"
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

type createSupplierRequest struct {
	Nit   string `json:"nit"`
	Name  string `json:"name"`
	City  string `json:"city"`
	Phone string `json:"phone"`
}

type createPurchaseOrderRequest struct {
	SupplierID  string  `json:"supplierId"`
	ProductID   string  `json:"productId"`
	WarehouseID string  `json:"warehouseId"`
	Qty         float64 `json:"qty"`
	UnitCost    float64 `json:"unitCost"`
}

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/all", s.handleGetAll)
	r.Post("/suppliers", s.handleCreateSupplier)
	r.Post("/orders", s.handleCreateOrder)

	return r
}

func (s *Service) handleGetAll(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())
	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		suppliers := d.Suppliers
		if suppliers == nil {
			suppliers = []tenantdb.Supplier{}
		}
		products := d.Products
		if products == nil {
			products = []tenantdb.Product{}
		}
		warehouses := d.Warehouses
		if warehouses == nil {
			warehouses = []tenantdb.Warehouse{}
		}
		orders := d.GenericModules["ordenes_compra"]
		if orders == nil {
			orders = []tenantdb.GenericRecord{}
		}

		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":               true,
			"nextSupplierCode": s.db.Seq.Peek(tc.DBName, "PRV", 205),
			"nextOrderCode":    s.db.Seq.Peek(tc.DBName, "OC", 805),
			"suppliers":        suppliers,
			"products":         products,
			"warehouses":       warehouses,
			"orders":           orders,
		})
	})
}

func (s *Service) handleCreateSupplier(w http.ResponseWriter, r *http.Request) {
	var req createSupplierRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato JSON inválido para proveedor")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.Nit = strings.TrimSpace(req.Nit)
	req.City = strings.TrimSpace(req.City)
	req.Phone = strings.TrimSpace(req.Phone)

	if req.Name == "" || req.Nit == "" {
		httpx.Error(w, http.StatusBadRequest, "El NIT y la razón social del proveedor son obligatorios")
		return
	}
	if req.City == "" {
		req.City = "Bogotá D.C."
	}

	tc := authguard.FromContext(r.Context())
	var created tenantdb.Supplier

	if err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		code := s.db.Seq.Next(tc.DBName, "PRV", 205)
		created = tenantdb.Supplier{
			ID:    fmt.Sprintf("sup-%d", time.Now().UnixNano()),
			Code:  code,
			Nit:   req.Nit,
			Name:  req.Name,
			City:  req.City,
			Phone: req.Phone,
		}
		d.Suppliers = append([]tenantdb.Supplier{created}, d.Suppliers...)
		return nil
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":       true,
		"supplier": created,
	})
}

func (s *Service) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	var req createPurchaseOrderRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Formato JSON inválido para la orden de compra")
		return
	}
	if req.Qty <= 0 {
		httpx.Error(w, http.StatusBadRequest, "La cantidad a ingresar debe ser mayor a cero")
		return
	}
	if req.UnitCost < 0 {
		httpx.Error(w, http.StatusBadRequest, "El costo unitario no puede ser negativo")
		return
	}

	tc := authguard.FromContext(r.Context())
	actor := tc.Username
	if strings.TrimSpace(actor) == "" {
		actor = "compras@proveko.com"
	}

	var createdOrder tenantdb.GenericRecord
	var kardexEntry tenantdb.KardexMovement

	err := s.db.WithWrite(r.Context(), tc.DBName, func(d *tenantdb.TenantData) error {
		if d.GenericModules == nil {
			d.GenericModules = map[string][]tenantdb.GenericRecord{}
		}

		var supplier tenantdb.Supplier
		foundSupplier := false
		for _, sup := range d.Suppliers {
			if sup.ID == req.SupplierID {
				supplier = sup
				foundSupplier = true
				break
			}
		}
		if !foundSupplier {
			return errors.New("selecciona un proveedor válido")
		}

		prodIdx := -1
		for i := range d.Products {
			if d.Products[i].ID == req.ProductID {
				prodIdx = i
				break
			}
		}
		if prodIdx < 0 {
			return errors.New("selecciona un producto válido del catálogo")
		}

		warehouseID := strings.TrimSpace(req.WarehouseID)
		warehouseName := "Bodega Principal"
		if warehouseID == "" {
			warehouseID = d.Products[prodIdx].WarehouseID
		}
		for _, wh := range d.Warehouses {
			if wh.ID == warehouseID {
				warehouseName = wh.Name
				break
			}
		}

		unitCost := req.UnitCost
		if unitCost <= 0 {
			unitCost = d.Products[prodIdx].CostPrice
		}

		d.Products[prodIdx].Stock += req.Qty
		d.Products[prodIdx].CostPrice = unitCost
		d.Products[prodIdx].SupplierID = supplier.ID
		if warehouseID != "" {
			d.Products[prodIdx].WarehouseID = warehouseID
		}

		updatedProd := d.Products[prodIdx]
		orderCode := s.db.Seq.Next(tc.DBName, "OC", 805)
		nowStr := time.Now().Format("2006-01-02 15:04")
		totalCost := req.Qty * unitCost

		kardexEntry = tenantdb.KardexMovement{
			ID:           s.db.Seq.Next(tc.DBName, "KDX", 4000),
			Date:         nowStr,
			ProductID:    updatedProd.ID,
			ProductName:  updatedProd.Name,
			WarehouseID:  warehouseID,
			MovementType: "ENTRADA OC",
			Qty:          req.Qty,
			UnitCost:     unitCost,
			BalanceAfter: updatedProd.Stock,
			ReferenceDoc: orderCode,
			Actor:        actor,
		}
		d.Kardex = append([]tenantdb.KardexMovement{kardexEntry}, d.Kardex...)

		createdOrder = tenantdb.GenericRecord{
			ID:        orderCode,
			CreatedAt: nowStr,
			ModuleKey: "ordenes_compra",
			Fields: map[string]string{
				"supplierId":    supplier.ID,
				"supplierCode":  supplier.Code,
				"supplierName":  supplier.Name,
				"supplierNit":   supplier.Nit,
				"productId":     updatedProd.ID,
				"productCode":   updatedProd.Code,
				"productName":   updatedProd.Name,
				"warehouseId":   warehouseID,
				"warehouseName": warehouseName,
				"qty":           strconv.FormatFloat(req.Qty, 'f', -1, 64),
				"unitCost":      strconv.FormatFloat(unitCost, 'f', 0, 64),
				"totalCost":     strconv.FormatFloat(totalCost, 'f', 0, 64),
				"balanceAfter":  strconv.FormatFloat(updatedProd.Stock, 'f', -1, 64),
				"status":        "Recibida en Bodega",
			},
		}
		d.GenericModules["ordenes_compra"] = append([]tenantdb.GenericRecord{createdOrder}, d.GenericModules["ordenes_compra"]...)
		return nil
	})
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, map[string]any{
		"ok":     true,
		"order":  createdOrder,
		"kardex": kardexEntry,
	})
}
