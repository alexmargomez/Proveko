package memory

import (
	"context"
	"strings"
	"sync"
	"time"

	"ms-taller/internal/platform/apperr"
	"ms-taller/internal/platform/money"
	"ms-taller/internal/platform/seqmem"
	"ms-taller/internal/domain"
)

const (
	baseVehicleSeq    = 203
	baseWorkerSeq     = 105
	baseOrderSeq      = 705
	baseSettlementSeq = 305
)

type tenantStore struct {
	vehicles       []domain.Vehicle
	workers        []domain.Worker
	orders         []domain.WorkOrder
	settlements    []domain.Settlement
	idemVehicles   map[string]domain.Vehicle
	idemWorkers    map[string]domain.Worker
	idemOrders     map[string]domain.WorkOrder
	idemSettles    map[string]domain.Settlement
	idemInvoiceRPC map[string]domain.InvoiceSyncResult
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
	now := time.Now()
	st := &tenantStore{
		vehicles: []domain.Vehicle{
			{
				ID:              "veh-201",
				Plate:           "KLP842",
				Brand:           "Toyota Hilux 2.8 4x4",
				VehicleType:     "Camioneta",
				CustomerID:      "cli-101",
				CustomerName:    "Inversiones Andinas S.A.S.",
				CurrentKm:       68400,
				NextOilKm:       73400,
				NextOilChangeKm: 73400,
				SoatExpiry:      "2027-04-18",
			},
			{
				ID:              "veh-202",
				Plate:           "MTR519",
				Brand:           "Mazda CX-30 Grand Touring",
				VehicleType:     "Automóvil",
				CustomerID:      "cli-102",
				CustomerName:    "Distribuidora del Valle Ltda.",
				CurrentKm:       34200,
				NextOilKm:       39200,
				NextOilChangeKm: 39200,
				SoatExpiry:      "2027-08-05",
			},
			{
				ID:              "veh-203",
				Plate:           "FQZ910",
				Brand:           "Chevrolet NHR Reward Euro VI",
				VehicleType:     "Utilitario / Carga",
				CustomerID:      "",
				CustomerName:    "Logística Metropolitana S.A.S.",
				CurrentKm:       112500,
				NextOilKm:       117500,
				NextOilChangeKm: 117500,
				SoatExpiry:      "2027-02-22",
			},
		},
		workers: []domain.Worker{
			{
				ID:            "tec-104",
				Code:          "TEC-104",
				Name:          "Ricardo Ospina",
				DocNumber:     "71.384.920",
				Specialty:     "Inyección Electrónica y Diagnóstico",
				CommissionPct: 40,
				Phone:         "3104829104",
				TotalDayGross: 220000,
			},
			{
				ID:            "tec-105",
				Code:          "TEC-105",
				Name:          "Julián Morales",
				DocNumber:     "1.026.584.119",
				Specialty:     "Frenos, Suspensión y Sincronización",
				CommissionPct: 35,
				Phone:         "3158291044",
				TotalDayGross: 140000,
			},
		},
		orders: []domain.WorkOrder{
			{
				ID:             "OT-705",
				CreatedAt:      now.Add(-45 * time.Minute).Format("2006-01-02 15:04"),
				CustomerID:     "cli-101",
				CustomerName:   "Inversiones Andinas S.A.S.",
				VehicleID:      "veh-201",
				Plate:          "KLP842",
				VehicleBrand:   "Toyota Hilux 2.8 4x4",
				CurrentKm:      68400,
				NextOilKm:      73400,
				WorkerID:       "tec-104",
				WorkerName:     "Ricardo Ospina",
				Status:         domain.OrderStatusEnProceso,
				ServiceDesc:    "Mantenimiento preventivo 70.000 km, cambio de aceite sintético y filtros",
				TotalEstimated: 420000,
			},
			{
				ID:             "OT-704",
				CreatedAt:      now.Add(-2 * time.Hour).Format("2006-01-02 15:04"),
				CustomerID:     "cli-102",
				CustomerName:   "Distribuidora del Valle Ltda.",
				VehicleID:      "veh-202",
				Plate:          "MTR519",
				VehicleBrand:   "Mazda CX-30 Grand Touring",
				CurrentKm:      34200,
				NextOilKm:      39200,
				WorkerID:       "tec-105",
				WorkerName:     "Julián Morales",
				Status:         domain.OrderStatusListo,
				ServiceDesc:    "Rectificación de discos delanteros, cambio de pastillas cerámicas y alineación",
				TotalEstimated: 310000,
			},
		},
		settlements: []domain.Settlement{
			{
				ID:               "LIQ-305",
				Date:             now.Add(-24 * time.Hour).Format("2006-01-02 15:04"),
				WorkerID:         "tec-104",
				WorkerName:       "Ricardo Ospina",
				GrossLabor:       350000,
				CommissionPct:    40,
				TechnicianPayout: 140000,
				CompanyRetention: 210000,
			},
		},
		idemVehicles:   make(map[string]domain.Vehicle),
		idemWorkers:    make(map[string]domain.Worker),
		idemOrders:     make(map[string]domain.WorkOrder),
		idemSettles:    make(map[string]domain.Settlement),
		idemInvoiceRPC: make(map[string]domain.InvoiceSyncResult),
	}
	r.tenants[dbName] = st
	return st
}

func (r *Repository) GetState(_ context.Context, dbName string) (domain.WorkshopState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	vehicles := make([]domain.Vehicle, len(st.vehicles))
	copy(vehicles, st.vehicles)
	workers := make([]domain.Worker, len(st.workers))
	copy(workers, st.workers)
	orders := make([]domain.WorkOrder, len(st.orders))
	copy(orders, st.orders)
	settlements := make([]domain.Settlement, len(st.settlements))
	copy(settlements, st.settlements)

	return domain.WorkshopState{
		NextOrderCode:   r.seq.Peek(dbName, "OT", baseOrderSeq),
		NextWorkerCode:  r.seq.Peek(dbName, "TEC", baseWorkerSeq),
		NextVehicleCode: r.seq.Peek(dbName, "VEH", baseVehicleSeq),
		Orders:          orders,
		Workers:         workers,
		Settlements:     settlements,
		Vehicles:        vehicles,
	}, nil
}

func (r *Repository) CreateVehicle(_ context.Context, dbName, idemKey string, in domain.CreateVehicleInput) (domain.Vehicle, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemVehicles[cleanKey]; ok {
			return prev, nil
		}
	}

	normPlate := domain.NormalizePlate(in.Plate)
	for _, v := range st.vehicles {
		if v.Plate == normPlate {
			return domain.Vehicle{}, apperr.Conflict("Ya existe un vehículo registrado con la placa " + normPlate)
		}
	}

	seqCode := r.seq.Next(dbName, "VEH", baseVehicleSeq)
	veh, err := domain.BuildVehicle(seqCode, in)
	if err != nil {
		return domain.Vehicle{}, err
	}
	st.vehicles = append(st.vehicles, veh)
	if cleanKey != "" {
		st.idemVehicles[cleanKey] = veh
	}
	return veh, nil
}

func (r *Repository) DeleteVehicle(_ context.Context, dbName, vehicleID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	for _, o := range st.orders {
		if o.VehicleID == vehicleID && o.Status != domain.OrderStatusEntregado {
			return apperr.Conflict("No se puede eliminar un vehículo con órdenes de trabajo activas en el taller")
		}
	}

	for i := range st.vehicles {
		if st.vehicles[i].ID == vehicleID {
			st.vehicles = append(st.vehicles[:i], st.vehicles[i+1:]...)
			return nil
		}
	}
	return apperr.NotFound("Vehículo no encontrado")
}

func (r *Repository) CreateWorkOrder(_ context.Context, dbName, idemKey string, in domain.CreateWorkOrderInput) (domain.WorkOrder, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemOrders[cleanKey]; ok {
			return prev, nil
		}
	}

	vehIdx := -1
	for i := range st.vehicles {
		if st.vehicles[i].ID == in.VehicleID || strings.EqualFold(st.vehicles[i].Plate, in.VehicleID) {
			vehIdx = i
			break
		}
	}
	if vehIdx < 0 {
		return domain.WorkOrder{}, apperr.NotFound("Vehículo no encontrado")
	}

	var workerName string
	if strings.TrimSpace(in.WorkerID) != "" {
		for _, wk := range st.workers {
			if wk.ID == in.WorkerID || strings.EqualFold(wk.Code, in.WorkerID) {
				workerName = wk.Name
				in.WorkerID = wk.ID
				break
			}
		}
	}

	vehCopy := st.vehicles[vehIdx]
	orderCode := r.seq.Next(dbName, "OT", baseOrderSeq)
	order, err := domain.BuildWorkOrder(orderCode, in, &vehCopy, workerName, time.Now())
	if err != nil {
		return domain.WorkOrder{}, err
	}

	st.vehicles[vehIdx] = vehCopy
	st.orders = append([]domain.WorkOrder{order}, st.orders...)
	if cleanKey != "" {
		st.idemOrders[cleanKey] = order
	}
	return order, nil
}

func (r *Repository) AdvanceWorkOrderStage(_ context.Context, dbName, orderID, requestedStatus string) (domain.WorkOrder, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	for i := range st.orders {
		if st.orders[i].ID == orderID {
			candidate := st.orders[i]
			if err := candidate.AdvanceStage(requestedStatus); err != nil {
				return domain.WorkOrder{}, err
			}
			st.orders[i] = candidate
			return candidate, nil
		}
	}
	return domain.WorkOrder{}, apperr.NotFound("Orden de trabajo no encontrada")
}

func (r *Repository) CreateWorker(_ context.Context, dbName, idemKey string, in domain.CreateWorkerInput) (domain.Worker, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemWorkers[cleanKey]; ok {
			return prev, nil
		}
	}

	code := r.seq.Next(dbName, "TEC", baseWorkerSeq)
	wk, err := domain.BuildWorker(code, in)
	if err != nil {
		return domain.Worker{}, err
	}
	st.workers = append(st.workers, wk)
	if cleanKey != "" {
		st.idemWorkers[cleanKey] = wk
	}
	return wk, nil
}

func (r *Repository) SettleWorker(_ context.Context, dbName, idemKey, workerID string) (domain.Settlement, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemSettles[cleanKey]; ok {
			return prev, nil
		}
	}

	for i := range st.workers {
		if st.workers[i].ID == workerID || strings.EqualFold(st.workers[i].Code, workerID) {
			candidate := st.workers[i]
			liqCode := r.seq.Next(dbName, "LIQ", baseSettlementSeq)
			settlement, err := candidate.Settle(liqCode, time.Now())
			if err != nil {
				return domain.Settlement{}, err
			}
			st.workers[i] = candidate
			st.settlements = append([]domain.Settlement{settlement}, st.settlements...)
			if cleanKey != "" {
				st.idemSettles[cleanKey] = settlement
			}
			return settlement, nil
		}
	}
	return domain.Settlement{}, apperr.NotFound("Técnico especialista no encontrado")
}

func (r *Repository) RegisterInvoicedOrderAndCommission(_ context.Context, dbName string, in domain.InvoiceSyncInput) (domain.InvoiceSyncResult, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(in.IdempotencyKey)
	if cleanKey != "" {
		if prev, ok := st.idemInvoiceRPC[cleanKey]; ok {
			return prev, nil
		}
	}

	res := domain.InvoiceSyncResult{Ok: true}
	orderID := strings.TrimSpace(in.WorkOrderID)
	vehID := strings.TrimSpace(in.VehicleID)
	mechID := strings.TrimSpace(in.MechanicID)

	if orderID != "" {
		for i := range st.orders {
			if st.orders[i].ID == orderID {
				st.orders[i].Status = domain.OrderStatusEntregado
				res.Plate = st.orders[i].Plate
				res.VehicleBrand = st.orders[i].VehicleBrand
				res.CurrentKm = st.orders[i].CurrentKm
				res.NextOilKm = st.orders[i].NextOilKm
				if vehID == "" {
					vehID = st.orders[i].VehicleID
				}
				if mechID == "" {
					mechID = st.orders[i].WorkerID
				}
				break
			}
		}
	}

	if res.Plate == "" && vehID != "" {
		for _, v := range st.vehicles {
			if v.ID == vehID || strings.EqualFold(v.Plate, vehID) {
				res.Plate = v.Plate
				res.VehicleBrand = v.Brand
				res.CurrentKm = v.CurrentKm
				res.NextOilKm = v.NextOilKm
				break
			}
		}
	}

	if mechID != "" {
		for i := range st.workers {
			if st.workers[i].ID == mechID || strings.EqualFold(st.workers[i].Code, mechID) {
				res.MechanicName = st.workers[i].Name
				if money.IsFinite(in.LaborGross) && in.LaborGross > 0 {
					st.workers[i].TotalDayGross = money.RoundCents(st.workers[i].TotalDayGross + in.LaborGross)
				}
				break
			}
		}
	}

	if cleanKey != "" {
		st.idemInvoiceRPC[cleanKey] = res
	}
	return res, nil
}
