package memory

import (
	"context"
	"strings"
	"sync"
	"time"

	"ms-bascula/internal/platform/apperr"
	"ms-bascula/internal/platform/seqmem"
	"ms-bascula/internal/domain"
)

const (
	baseTicketSeq  = 1005
	baseVehicleSeq = 302
	baseDriverSeq  = 202
	baseCarrierSeq = 402
	baseRouteSeq   = 105
)

type tenantStore struct {
	vehicles     []domain.HeavyVehicle
	drivers      []domain.Driver
	carriers     []domain.Carrier
	routes       []domain.CargoRoute
	tickets      []domain.ScaleTicket
	idemVehicles map[string]domain.HeavyVehicle
	idemDrivers  map[string]domain.Driver
	idemCarriers map[string]domain.Carrier
	idemRoutes   map[string]domain.CargoRoute
	idemTickets  map[string]domain.ScaleTicket
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
		vehicles: []domain.HeavyVehicle{
			{ID: "cam-301", Code: "CAM-301", Plate: "TRK941", Brand: "Kenworth T800 Cummins ISX", AxleConfig: "C3S3 Tractocamión 6 Ejes", ReferenceTareKg: 16200},
			{ID: "cam-302", Code: "CAM-302", Plate: "WLP628", Brand: "International ProStar Euro V", AxleConfig: "C3S2 Dobletroque", ReferenceTareKg: 14800},
		},
		drivers: []domain.Driver{
			{ID: "cond-201", Code: "COND-201", Name: "Hernando Quintero", DocNumber: "79.482.110", LicenseCategory: "C3", Phone: "3114902218"},
			{ID: "cond-202", Code: "COND-202", Name: "Wilson Valderrama", DocNumber: "80.192.445", LicenseCategory: "C3", Phone: "3168204190"},
		},
		carriers: []domain.Carrier{
			{ID: "trn-401", Code: "TRN-401", Name: "Transportes Interoceánicos S.A.S.", Nit: "900.512.330-4", City: "Buenaventura", Phone: "6022418800"},
			{ID: "trn-402", Code: "TRN-402", Name: "Logística de Carga Nacional S.A.", Nit: "890.904.118-2", City: "Medellín", Phone: "6043229100"},
		},
		routes: []domain.CargoRoute{
			{ID: "car-104", Code: "CAR-104", Description: "Granel Agrícola — Maíz Amarillo Importado", Origin: "Puerto Buenaventura", Destination: "Planta Mosquera"},
			{ID: "car-105", Code: "CAR-105", Description: "Clinker y Agregados Industriales", Origin: "Planta Nobsa", Destination: "Zona Franca Bogotá"},
		},
		tickets: []domain.ScaleTicket{
			{
				ID:          "BAS-1005",
				Date:        now.Add(-50 * time.Minute).Format("2006-01-02 15:04"),
				VehicleID:   "cam-301",
				Plate:       "TRK941",
				DriverID:    "cond-201",
				DriverName:  "Hernando Quintero",
				CarrierID:   "trn-401",
				CarrierName: "Transportes Interoceánicos S.A.S.",
				CargoID:     "car-104",
				CargoDesc:   "Granel Agrícola — Maíz Amarillo Importado (Puerto Buenaventura -> Planta Mosquera)",
				GrossKg:     51400,
				TareKg:      16200,
				NetKg:       35200,
				Status:      "Pesaje Completado",
			},
		},
		idemVehicles: make(map[string]domain.HeavyVehicle),
		idemDrivers:  make(map[string]domain.Driver),
		idemCarriers: make(map[string]domain.Carrier),
		idemRoutes:   make(map[string]domain.CargoRoute),
		idemTickets:  make(map[string]domain.ScaleTicket),
	}
	r.tenants[dbName] = st
	return st
}

func (r *Repository) GetState(_ context.Context, dbName string) (domain.ScaleState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	vehicles := make([]domain.HeavyVehicle, len(st.vehicles))
	copy(vehicles, st.vehicles)
	drivers := make([]domain.Driver, len(st.drivers))
	copy(drivers, st.drivers)
	carriers := make([]domain.Carrier, len(st.carriers))
	copy(carriers, st.carriers)
	routes := make([]domain.CargoRoute, len(st.routes))
	copy(routes, st.routes)
	tickets := make([]domain.ScaleTicket, len(st.tickets))
	copy(tickets, st.tickets)

	return domain.ScaleState{
		NextTicketCode:  r.seq.Peek(dbName, "BAS", baseTicketSeq),
		NextVehicleCode: r.seq.Peek(dbName, "CAM", baseVehicleSeq),
		NextDriverCode:  r.seq.Peek(dbName, "COND", baseDriverSeq),
		NextCarrierCode: r.seq.Peek(dbName, "TRN", baseCarrierSeq),
		NextRouteCode:   r.seq.Peek(dbName, "CAR", baseRouteSeq),
		Tickets:         tickets,
		Vehicles:        vehicles,
		Drivers:         drivers,
		Carriers:        carriers,
		Routes:          routes,
	}, nil
}

func (r *Repository) CreateVehicle(_ context.Context, dbName, idemKey string, in domain.CreateHeavyVehicleInput) (domain.HeavyVehicle, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemVehicles[cleanKey]; ok {
			return prev, nil
		}
	}

	normPlate := domain.NormalizeHeavyPlate(in.Plate)
	for _, v := range st.vehicles {
		if v.Plate == normPlate {
			return domain.HeavyVehicle{}, apperr.Conflict("Ya existe un tractocamión registrado con la placa " + normPlate)
		}
	}

	code := r.seq.Next(dbName, "CAM", baseVehicleSeq)
	veh, err := domain.BuildHeavyVehicle(code, in)
	if err != nil {
		return domain.HeavyVehicle{}, err
	}
	st.vehicles = append(st.vehicles, veh)
	if cleanKey != "" {
		st.idemVehicles[cleanKey] = veh
	}
	return veh, nil
}

func (r *Repository) CreateDriver(_ context.Context, dbName, idemKey string, in domain.CreateDriverInput) (domain.Driver, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemDrivers[cleanKey]; ok {
			return prev, nil
		}
	}

	code := r.seq.Next(dbName, "COND", baseDriverSeq)
	drv, err := domain.BuildDriver(code, in)
	if err != nil {
		return domain.Driver{}, err
	}
	st.drivers = append(st.drivers, drv)
	if cleanKey != "" {
		st.idemDrivers[cleanKey] = drv
	}
	return drv, nil
}

func (r *Repository) CreateCarrier(_ context.Context, dbName, idemKey string, in domain.CreateCarrierInput) (domain.Carrier, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemCarriers[cleanKey]; ok {
			return prev, nil
		}
	}

	code := r.seq.Next(dbName, "TRN", baseCarrierSeq)
	car, err := domain.BuildCarrier(code, in)
	if err != nil {
		return domain.Carrier{}, err
	}
	st.carriers = append(st.carriers, car)
	if cleanKey != "" {
		st.idemCarriers[cleanKey] = car
	}
	return car, nil
}

func (r *Repository) CreateRoute(_ context.Context, dbName, idemKey string, in domain.CreateCargoRouteInput) (domain.CargoRoute, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemRoutes[cleanKey]; ok {
			return prev, nil
		}
	}

	code := r.seq.Next(dbName, "CAR", baseRouteSeq)
	rt, err := domain.BuildCargoRoute(code, in)
	if err != nil {
		return domain.CargoRoute{}, err
	}
	st.routes = append(st.routes, rt)
	if cleanKey != "" {
		st.idemRoutes[cleanKey] = rt
	}
	return rt, nil
}

func (r *Repository) CreateTicket(_ context.Context, dbName, idemKey string, in domain.CreateScaleTicketInput) (domain.ScaleTicket, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureTenantLocked(dbName)
	cleanKey := strings.TrimSpace(idemKey)
	if cleanKey != "" {
		if prev, ok := st.idemTickets[cleanKey]; ok {
			return prev, nil
		}
	}

	var (
		veh      domain.HeavyVehicle
		foundVeh bool
		drv      domain.Driver
		foundDrv bool
		car      domain.Carrier
		foundCar bool
		rt       domain.CargoRoute
		foundRt  bool
	)
	for _, v := range st.vehicles {
		if v.ID == in.VehicleID || strings.EqualFold(v.Code, in.VehicleID) || strings.EqualFold(v.Plate, in.VehicleID) {
			veh = v
			foundVeh = true
			break
		}
	}
	if !foundVeh {
		return domain.ScaleTicket{}, apperr.NotFound("Tractocamión o vehículo pesado no encontrado")
	}

	for _, d := range st.drivers {
		if d.ID == in.DriverID || strings.EqualFold(d.Code, in.DriverID) {
			drv = d
			foundDrv = true
			break
		}
	}
	if !foundDrv {
		return domain.ScaleTicket{}, apperr.NotFound("Conductor no encontrado")
	}

	for _, c := range st.carriers {
		if c.ID == in.CarrierID || strings.EqualFold(c.Code, in.CarrierID) {
			car = c
			foundCar = true
			break
		}
	}
	if !foundCar {
		return domain.ScaleTicket{}, apperr.NotFound("Empresa transportadora no encontrada")
	}

	for _, rItem := range st.routes {
		if rItem.ID == in.CargoID || strings.EqualFold(rItem.Code, in.CargoID) {
			rt = rItem
			foundRt = true
			break
		}
	}
	if !foundRt {
		return domain.ScaleTicket{}, apperr.NotFound("Tipo de carga o ruta no encontrado")
	}

	code := r.seq.Next(dbName, "BAS", baseTicketSeq)
	tk, err := domain.BuildScaleTicket(code, in, veh, drv, car, rt, time.Now())
	if err != nil {
		return domain.ScaleTicket{}, err
	}
	st.tickets = append([]domain.ScaleTicket{tk}, st.tickets...)
	if cleanKey != "" {
		st.idemTickets[cleanKey] = tk
	}
	return tk, nil
}
