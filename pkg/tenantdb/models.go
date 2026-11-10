package tenantdb

type BrandingConfig struct {
	CompanyName    string `json:"companyName"`
	Nit            string `json:"nit"`
	TaxRegime      string `json:"taxRegime"`
	Address        string `json:"address"`
	Phone          string `json:"phone"`
	Email          string `json:"email"`
	DianResolution string `json:"dianResolution"`
	FooterWarranty string `json:"footerWarranty"`
	PrimaryColor   string `json:"primaryColor"`
	DefaultFormat  string `json:"defaultFormat"` // carta_membrete | media_carta | tirilla_80mm
}

type Tariff struct {
	ID          string  `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	DiscountPct float64 `json:"discountPct"`
}

type Contract struct {
	ID               string  `json:"id"`
	Code             string  `json:"code"`
	EntityName       string  `json:"entityName"`
	TariffID         string  `json:"tariffId"`
	TariffName       string  `json:"tariffName"`
	BudgetCeiling    float64 `json:"budgetCeiling"`
	ConsumedAmount   float64 `json:"consumedAmount"`
	AvailableBalance float64 `json:"availableBalance"`
	Status           string  `json:"status"`
}

type Customer struct {
	ID          string  `json:"id"`
	Code        string  `json:"code"`
	DocType     string  `json:"docType"`
	Nit         string  `json:"nit"`
	DV          string  `json:"dv"`
	Name        string  `json:"name"`
	TaxRegime   string  `json:"taxRegime"`
	Phone       string  `json:"phone"`
	Email       string  `json:"email"`
	City        string  `json:"city"`
	Address     string  `json:"address"`
	ContractID  string  `json:"contractId"`
	TariffID    string  `json:"tariffId"`
	CreditLimit float64 `json:"creditLimit"`
	CurrentDebt float64 `json:"currentDebt"`
}

type Vehicle struct {
	ID              string `json:"id"`
	Plate           string `json:"plate"`
	Brand           string `json:"brand"`
	ModelYear       string `json:"modelYear"`
	CustomerID      string `json:"customerId"`
	CustomerName    string `json:"customerName"`
	CurrentKm       int    `json:"currentKm"`
	NextOilChangeKm int    `json:"nextOilChangeKm"`
	SoatExpiry      string `json:"soatExpiry"`
	Notes           string `json:"notes"`
}

type Driver struct {
	ID              string `json:"id"`
	Code            string `json:"code"`
	Name            string `json:"name"`
	DocNumber       string `json:"docNumber"`
	LicenseCategory string `json:"licenseCategory"`
	Phone           string `json:"phone"`
	VehicleID       string `json:"vehicleId"`
	AssignedPlate   string `json:"assignedPlate"`
	Status          string `json:"status"`
}

type Carrier struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Nit         string `json:"nit"`
	Name        string `json:"name"`
	VehicleType string `json:"vehicleType"`
	RouteZone   string `json:"routeZone"`
	Phone       string `json:"phone"`
}

type Supplier struct {
	ID    string `json:"id"`
	Code  string `json:"code"`
	Nit   string `json:"nit"`
	Name  string `json:"name"`
	City  string `json:"city"`
	Phone string `json:"phone"`
}

type Warehouse struct {
	ID      string `json:"id"`
	Code    string `json:"code"`
	Name    string `json:"name"`
	City    string `json:"city"`
	Manager string `json:"manager"`
}

type Product struct {
	ID          string  `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Category    string  `json:"category"`
	WarehouseID string  `json:"warehouseId"`
	SupplierID  string  `json:"supplierId"`
	CostPrice   float64 `json:"costPrice"`
	SalePrice   float64 `json:"salePrice"`
	TaxPct      float64 `json:"taxPct"`
	Stock       float64 `json:"stock"`
	MinStock    float64 `json:"minStock"`
	LotCode     string  `json:"lotCode"`
	ExpiryDate  string  `json:"expiryDate"`
}

type KardexMovement struct {
	ID           string  `json:"id"`
	Date         string  `json:"date"`
	ProductID    string  `json:"productId"`
	ProductName  string  `json:"productName"`
	WarehouseID  string  `json:"warehouseId"`
	MovementType string  `json:"movementType"`
	Qty          float64 `json:"qty"`
	UnitCost     float64 `json:"unitCost"`
	BalanceAfter float64 `json:"balanceAfter"`
	ReferenceDoc string  `json:"referenceDoc"`
	Actor        string  `json:"actor"`
}

type InvoiceItem struct {
	Kind       string  `json:"kind"` // PRODUCTO | SERVICIO
	RefID      string  `json:"refId"`
	Code       string  `json:"code"`
	Name       string  `json:"name"`
	Qty        float64 `json:"qty"`
	Price      float64 `json:"price"`
	TaxPct     float64 `json:"taxPct"`
	WorkerID   string  `json:"workerId"`
	WorkerName string  `json:"workerName"`
}

type AbonoRecord struct {
	ID     string  `json:"id"`
	Date   string  `json:"date"`
	Amount float64 `json:"amount"`
	Method string  `json:"method"`
	Note   string  `json:"note"`
}

type Invoice struct {
	ID             string            `json:"id"`
	Cufe           string            `json:"cufe"`
	Date           string            `json:"date"`
	CustomerID     string            `json:"customerId"`
	CustomerName   string            `json:"customerName"`
	CustomerNit    string            `json:"customerNit"`
	ContractID     string            `json:"contractId"`
	VehicleID      string            `json:"vehicleId"`
	Plate          string            `json:"plate"`
	MechanicID     string            `json:"mechanicId"`
	MechanicName   string            `json:"mechanicName"`
	WorkshopMeta   map[string]string `json:"workshopMeta"`
	LayoutVariant  string            `json:"layoutVariant"`
	Items          []InvoiceItem     `json:"items"`
	Subtotal       float64           `json:"subtotal"`
	DiscountTotal  float64           `json:"discountTotal"`
	TaxTotal       float64           `json:"taxTotal"`
	Total          float64           `json:"total"`
	PaymentMethod  string            `json:"paymentMethod"`
	AmountPaid     float64           `json:"amountPaid"`
	PendingBalance float64           `json:"pendingBalance"`
	Status         string            `json:"status"`
	AbonosHistory  []AbonoRecord     `json:"abonosHistory"`
}

type Expense struct {
	ID            string  `json:"id"`
	Date          string  `json:"date"`
	Category      string  `json:"category"`
	Description   string  `json:"description"`
	Amount        float64 `json:"amount"`
	PaymentSource string  `json:"paymentSource"`
	Responsible   string  `json:"responsible"`
}

type Worker struct {
	ID            string  `json:"id"`
	Code          string  `json:"code"`
	Name          string  `json:"name"`
	DocNumber     string  `json:"docNumber"`
	Specialty     string  `json:"specialty"`
	CommissionPct float64 `json:"commissionPct"`
	Phone         string  `json:"phone"`
	TotalDayGross float64 `json:"totalDayGross"`
}

type WorkOrder struct {
	ID             string  `json:"id"`
	CreatedAt      string  `json:"createdAt"`
	CustomerID     string  `json:"customerId"`
	CustomerName   string  `json:"customerName"`
	VehicleID      string  `json:"vehicleId"`
	Plate          string  `json:"plate"`
	VehicleBrand   string  `json:"vehicleBrand"`
	CurrentKm      int     `json:"currentKm"`
	NextOilKm      int     `json:"nextOilKm"`
	WorkerID       string  `json:"workerId"`
	WorkerName     string  `json:"workerName"`
	Status         string  `json:"status"`
	ServiceDesc    string  `json:"serviceDesc"`
	TotalEstimated float64 `json:"totalEstimated"`
}

type Settlement struct {
	ID               string  `json:"id"`
	Date             string  `json:"date"`
	WorkerID         string  `json:"workerId"`
	WorkerName       string  `json:"workerName"`
	GrossLabor       float64 `json:"grossLabor"`
	CommissionPct    float64 `json:"commissionPct"`
	TechnicianPayout float64 `json:"technicianPayout"`
	CompanyRetention float64 `json:"companyRetention"`
}

type GastroItem struct {
	ProductID string  `json:"productId"`
	Name      string  `json:"name"`
	Qty       float64 `json:"qty"`
	Price     float64 `json:"price"`
	Note      string  `json:"note"`
}

type DiningTable struct {
	ID     string       `json:"id"`
	Name   string       `json:"name"`
	Zone   string       `json:"zone"`
	Waiter string       `json:"waiter"`
	Status string       `json:"status"` // Libre | Ocupada | En Cocina
	Items  []GastroItem `json:"items"`
	Total  float64      `json:"total"`
}

type HotelRoom struct {
	ID          string  `json:"id"`
	RoomNumber  string  `json:"roomNumber"`
	RoomType    string  `json:"roomType"`
	Floor       string  `json:"floor"`
	NightlyRate float64 `json:"nightlyRate"`
	Status      string  `json:"status"` // Disponible | Ocupada
	CheckInCode string  `json:"checkInCode"`
	GuestID     string  `json:"guestId"`
	GuestName   string  `json:"guestName"`
	CheckInDate string  `json:"checkInDate"`
	Nights      int     `json:"nights"`
	ExtrasTotal float64 `json:"extrasTotal"`
}

type CargoRoute struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Description string `json:"description"`
	Origin      string `json:"origin"`
	Destination string `json:"destination"`
}

type ScaleTicket struct {
	ID          string  `json:"id"`
	Date        string  `json:"date"`
	VehicleID   string  `json:"vehicleId"`
	Plate       string  `json:"plate"`
	DriverID    string  `json:"driverId"`
	DriverName  string  `json:"driverName"`
	CarrierID   string  `json:"carrierId"`
	CarrierName string  `json:"carrierName"`
	CargoID     string  `json:"cargoId"`
	CargoDesc   string  `json:"cargoDesc"`
	GrossKg     float64 `json:"grossKg"`
	TareKg      float64 `json:"tareKg"`
	NetKg       float64 `json:"netKg"`
	Status      string  `json:"status"`
}

type PucAccount struct {
	ID       string `json:"id"`
	Code     string `json:"code"`
	Name     string `json:"name"`
	Category string `json:"category"`
}

type GenericRecord struct {
	ID        string            `json:"id"`
	CreatedAt string            `json:"createdAt"`
	ModuleKey string            `json:"moduleKey"`
	Fields    map[string]string `json:"fields"`
}
