package domain

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"ms-comandas/internal/platform/apperr"
	"ms-comandas/internal/platform/money"
)

const (
	StatusLibre    = "Libre"
	StatusOcupada  = "Ocupada"
	StatusEnCocina = "En Cocina"

	ChannelMesa       = "MESA"
	ChannelDomicilio  = "DOMICILIO"
	ChannelParaLlevar = "PARA_LLEVAR"

	StageLibre      = "LIBRE"
	StageNueva      = "NUEVA"
	StagePreparando = "PREPARANDO"
	StageLista      = "LISTA"
	StageEntregada  = "ENTREGADA"

	DemoBaseTableSeq  = 106
	DemoBaseMenuSeq   = 208
	DemoBaseWaiterSeq = 304
	DemoBaseOrderSeq  = 47
	BaseTableSeq      = 100
	BaseMenuSeq       = 200
	BaseWaiterSeq     = 300
	BaseOrderSeq      = 0
)

type MenuItem struct {
	ID        string  `json:"id"`
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Category  string  `json:"category"`
	SalePrice float64 `json:"salePrice"`
	TaxPct    float64 `json:"taxPct"`
}

type Waiter struct {
	ID       string `json:"id"`
	Code     string `json:"code"`
	FullName string `json:"fullName"`
	DocID    string `json:"docId"`
	Phone    string `json:"phone"`
	Zone     string `json:"zone"`
	Shift    string `json:"shift"`
	Active   bool   `json:"active"`
}

type OrderItem struct {
	ItemID    string  `json:"itemId"`
	ProductID string  `json:"productId"`
	Name      string  `json:"name"`
	Qty       float64 `json:"qty"`
	Price     float64 `json:"price"`
	Note      string  `json:"note"`
}

type DiningTable struct {
	ID              string      `json:"id"`
	Name            string      `json:"name"`
	Zone            string      `json:"zone"`
	Waiter          string      `json:"waiter"`
	Status          string      `json:"status"`
	OrderCode       string      `json:"orderCode"`
	Channel         string      `json:"channel"`
	OrderStage      string      `json:"orderStage"`
	CustomerName    string      `json:"customerName"`
	CustomerPhone   string      `json:"customerPhone"`
	DeliveryAddress string      `json:"deliveryAddress"`
	Guests          int         `json:"guests"`
	PaymentHint     string      `json:"paymentHint"`
	OpenedAt        string      `json:"openedAt"`
	Items           []OrderItem `json:"items"`
	Total           float64     `json:"total"`
}

func NowTimestamp() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func FormatOrderCode(seqCode string) string {
	clean := strings.TrimSpace(seqCode)
	if clean == "" {
		return ""
	}
	if strings.HasPrefix(clean, "#") {
		return clean
	}
	parts := strings.Split(clean, "-")
	last := parts[len(parts)-1]
	if n, err := strconv.Atoi(last); err == nil && n > 0 {
		if n < 10000 {
			return fmt.Sprintf("#%04d", n)
		}
		return fmt.Sprintf("#%d", n)
	}
	return "#" + strings.ToUpper(clean)
}

func (t DiningTable) Clone() DiningTable {
	itemsCopy := make([]OrderItem, len(t.Items))
	copy(itemsCopy, t.Items)
	t.Items = itemsCopy
	return t
}

func (t *DiningTable) IsStandaloneTicket() bool {
	ch := strings.ToUpper(strings.TrimSpace(t.Channel))
	return ch == ChannelDomicilio || ch == ChannelParaLlevar
}

func (t *DiningTable) NormalizeState() {
	if t.Items == nil {
		t.Items = []OrderItem{}
	}
	ch := strings.ToUpper(strings.TrimSpace(t.Channel))
	if ch != ChannelMesa && ch != ChannelDomicilio && ch != ChannelParaLlevar {
		ch = ChannelMesa
	}
	t.Channel = ch

	stage := strings.ToUpper(strings.TrimSpace(t.OrderStage))
	switch {
	case t.Status == StatusLibre && len(t.Items) == 0:
		t.OrderStage = StageLibre
	case t.Status == StatusEnCocina:
		t.OrderStage = StagePreparando
	case stage == StageNueva || stage == StagePreparando || stage == StageLista || stage == StageEntregada:
		t.OrderStage = stage
	case t.Status != StatusLibre || len(t.Items) > 0:
		t.OrderStage = StageNueva
		if t.Status == StatusLibre {
			t.Status = StatusOcupada
		}
	default:
		t.OrderStage = StageLibre
	}
}

func (t *DiningTable) RecomputeTotal() {
	var sum float64
	for _, it := range t.Items {
		sum += it.Qty * it.Price
	}
	t.Total = money.RoundCents(sum)
}

type CreateTableInput struct {
	Name   string `json:"name"`
	Zone   string `json:"zone"`
	Waiter string `json:"waiter"`
	Guests int    `json:"guests"`
}

type UpdateTableInput struct {
	Name   string `json:"name"`
	Zone   string `json:"zone"`
	Waiter string `json:"waiter"`
	Guests int    `json:"guests"`
}

type CreateMenuItemInput struct {
	Name      string  `json:"name"`
	Category  string  `json:"category"`
	SalePrice float64 `json:"salePrice"`
	TaxPct    float64 `json:"taxPct"`
}

type UpdateMenuItemInput struct {
	Name      string  `json:"name"`
	Category  string  `json:"category"`
	SalePrice float64 `json:"salePrice"`
	TaxPct    float64 `json:"taxPct"`
}

type CreateWaiterInput struct {
	FullName string `json:"fullName"`
	DocID    string `json:"docId"`
	Phone    string `json:"phone"`
	Zone     string `json:"zone"`
	Shift    string `json:"shift"`
	Active   *bool  `json:"active"`
}

type UpdateWaiterInput struct {
	FullName string `json:"fullName"`
	DocID    string `json:"docId"`
	Phone    string `json:"phone"`
	Zone     string `json:"zone"`
	Shift    string `json:"shift"`
	Active   *bool  `json:"active"`
}

type AddOrderItemInput struct {
	ProductID string  `json:"productId"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Qty       float64 `json:"qty"`
	Note      string  `json:"note"`
}

type CreateOrderInput struct {
	Channel         string              `json:"channel"`
	TableID         string              `json:"tableId"`
	Waiter          string              `json:"waiter"`
	CustomerName    string              `json:"customerName"`
	CustomerPhone   string              `json:"customerPhone"`
	DeliveryAddress string              `json:"deliveryAddress"`
	Guests          int                 `json:"guests"`
	PaymentHint     string              `json:"paymentHint"`
	Items           []AddOrderItemInput `json:"items"`
}

type GastroState struct {
	NextMenuCode   string        `json:"nextMenuCode"`
	NextWaiterCode string        `json:"nextWaiterCode"`
	Tables         []DiningTable `json:"tables"`
	Products       []MenuItem    `json:"products"`
	Waiters        []Waiter      `json:"waiters"`
}

func formatTableName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	if name == "" {
		return "", apperr.Validation("El nombre o número de la mesa es obligatorio")
	}
	lower := strings.ToLower(name)
	if !strings.Contains(lower, "mesa") && !strings.Contains(lower, "barra") && !strings.Contains(lower, "terraza") && !strings.Contains(lower, "reserv") && !strings.Contains(lower, "vip") {
		name = "Mesa " + name
	}
	return name, nil
}

func BuildDiningTable(id string, in CreateTableInput) (DiningTable, error) {
	name, err := formatTableName(in.Name)
	if err != nil {
		return DiningTable{}, err
	}
	zone := strings.TrimSpace(in.Zone)
	if zone == "" {
		zone = "Salón Principal"
	}
	waiter := strings.TrimSpace(in.Waiter)
	if waiter == "" {
		waiter = "Mesero Turno"
	}
	guests := in.Guests
	if guests < 0 {
		guests = 0
	}
	return DiningTable{
		ID:         strings.ToLower(strings.TrimSpace(id)),
		Name:       name,
		Zone:       zone,
		Waiter:     waiter,
		Status:     StatusLibre,
		Channel:    ChannelMesa,
		OrderStage: StageLibre,
		Guests:     guests,
		Items:      []OrderItem{},
		Total:      0,
	}, nil
}

func (t *DiningTable) ApplyTableUpdate(in UpdateTableInput) error {
	if t.IsStandaloneTicket() {
		return apperr.Validation("Solo se pueden editar mesas físicas de salón")
	}
	name, err := formatTableName(in.Name)
	if err != nil {
		return err
	}
	zone := strings.TrimSpace(in.Zone)
	if zone == "" {
		zone = "Salón Principal"
	}
	waiter := strings.TrimSpace(in.Waiter)
	if waiter == "" {
		waiter = "Mesero Turno"
	}
	t.Name = name
	t.Zone = zone
	t.Waiter = waiter
	if in.Guests > 0 {
		t.Guests = in.Guests
	}
	return nil
}

func ValidateCreateOrderInput(in CreateOrderInput) (CreateOrderInput, error) {
	ch := strings.ToUpper(strings.TrimSpace(in.Channel))
	if ch == "" {
		ch = ChannelMesa
	}
	if ch != ChannelMesa && ch != ChannelDomicilio && ch != ChannelParaLlevar {
		return CreateOrderInput{}, apperr.Validation("Canal de comanda inválido: use MESA, DOMICILIO o PARA_LLEVAR")
	}
	if len(in.Items) == 0 {
		return CreateOrderInput{}, apperr.Validation("Agrega al menos un plato o bebida para crear la comanda")
	}
	for _, it := range in.Items {
		if !money.IsFinite(it.Qty) || it.Qty <= 0 {
			return CreateOrderInput{}, apperr.Validation("La cantidad de cada línea debe ser mayor a cero")
		}
	}

	in.Channel = ch
	in.TableID = strings.TrimSpace(in.TableID)
	in.Waiter = strings.TrimSpace(in.Waiter)
	in.CustomerName = strings.TrimSpace(in.CustomerName)
	in.CustomerPhone = strings.TrimSpace(in.CustomerPhone)
	in.DeliveryAddress = strings.TrimSpace(in.DeliveryAddress)
	in.PaymentHint = strings.TrimSpace(in.PaymentHint)
	if in.Guests < 0 {
		in.Guests = 0
	}

	switch ch {
	case ChannelMesa:
		if in.TableID == "" {
			return CreateOrderInput{}, apperr.Validation("Selecciona una mesa para registrar la comanda en salón")
		}
	case ChannelDomicilio:
		if in.CustomerName == "" {
			return CreateOrderInput{}, apperr.Validation("El nombre del cliente es obligatorio para pedidos a domicilio")
		}
		if in.DeliveryAddress == "" {
			return CreateOrderInput{}, apperr.Validation("La dirección de entrega es obligatoria para pedidos a domicilio")
		}
	case ChannelParaLlevar:
		if in.CustomerName == "" {
			return CreateOrderInput{}, apperr.Validation("El nombre del cliente es obligatorio para pedidos para llevar")
		}
	}
	return in, nil
}

func BuildStandaloneOrder(ordSeqCode string, in CreateOrderInput) DiningTable {
	orderCode := FormatOrderCode(ordSeqCode)
	id := strings.ToLower(strings.TrimSpace(ordSeqCode))
	name := "Para llevar " + orderCode
	zone := "Mostrador / Para llevar"
	waiter := in.Waiter
	if in.Channel == ChannelDomicilio {
		name = "Domicilio " + orderCode
		zone = "Domicilios"
		if waiter == "" {
			waiter = "Despacho Domicilios"
		}
	} else if waiter == "" {
		waiter = "Mostrador Despacho"
	}

	return DiningTable{
		ID:              id,
		Name:            name,
		Zone:            zone,
		Waiter:          waiter,
		Status:          StatusOcupada,
		OrderCode:       orderCode,
		Channel:         in.Channel,
		OrderStage:      StageNueva,
		CustomerName:    in.CustomerName,
		CustomerPhone:   in.CustomerPhone,
		DeliveryAddress: in.DeliveryAddress,
		Guests:          0,
		PaymentHint:     in.PaymentHint,
		OpenedAt:        NowTimestamp(),
		Items:           []OrderItem{},
		Total:           0,
	}
}

func (t *DiningTable) ApplyTableOrderMetadata(ordSeqCode string, in CreateOrderInput) {
	t.Channel = ChannelMesa
	if t.OrderCode == "" && strings.TrimSpace(ordSeqCode) != "" {
		t.OrderCode = FormatOrderCode(ordSeqCode)
	}
	if in.Waiter != "" {
		t.Waiter = in.Waiter
	}
	if in.Guests > 0 {
		t.Guests = in.Guests
	}
	if in.CustomerName != "" {
		t.CustomerName = in.CustomerName
	}
	if in.CustomerPhone != "" {
		t.CustomerPhone = in.CustomerPhone
	}
	if in.PaymentHint != "" {
		t.PaymentHint = in.PaymentHint
	}
	if t.OpenedAt == "" {
		t.OpenedAt = NowTimestamp()
	}
	t.Status = StatusOcupada
	t.OrderStage = StageNueva
}

func requirePositiveFinite(v float64, label string) (float64, error) {
	if !money.IsFinite(v) || v <= 0 {
		return 0, apperr.Validation("El valor de " + label + " debe ser un número positivo válido")
	}
	return money.RoundCents(v), nil
}

func BuildMenuItem(code string, in CreateMenuItemInput) (MenuItem, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return MenuItem{}, apperr.Validation("El nombre del plato o bebida es obligatorio")
	}
	price, err := requirePositiveFinite(in.SalePrice, "precio de venta")
	if err != nil {
		return MenuItem{}, err
	}
	taxPct := in.TaxPct
	if taxPct < 0 || taxPct > 100 || !money.IsFinite(taxPct) {
		return MenuItem{}, apperr.Validation("El porcentaje de impuesto debe estar entre 0% y 100%")
	}
	category := strings.TrimSpace(in.Category)
	if category == "" {
		category = "Restaurante"
	}
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	return MenuItem{
		ID:        strings.ToLower(cleanCode),
		Code:      cleanCode,
		Name:      name,
		Category:  category,
		SalePrice: price,
		TaxPct:    money.RoundCents(taxPct),
	}, nil
}

func (m *MenuItem) ApplyMenuItemUpdate(in UpdateMenuItemInput) error {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return apperr.Validation("El nombre del plato o servicio es obligatorio")
	}
	price, err := requirePositiveFinite(in.SalePrice, "precio de venta")
	if err != nil {
		return err
	}
	if in.TaxPct < 0 || in.TaxPct > 100 || !money.IsFinite(in.TaxPct) {
		return apperr.Validation("El porcentaje de impuesto debe estar entre 0% y 100%")
	}
	category := strings.TrimSpace(in.Category)
	if category == "" {
		category = "Restaurante"
	}
	m.Name = name
	m.Category = category
	m.SalePrice = price
	m.TaxPct = money.RoundCents(in.TaxPct)
	return nil
}

func BuildWaiter(code string, in CreateWaiterInput) (Waiter, error) {
	fullName := strings.TrimSpace(in.FullName)
	if fullName == "" {
		return Waiter{}, apperr.Validation("El nombre completo del mesero es obligatorio")
	}
	zone := strings.TrimSpace(in.Zone)
	if zone == "" {
		zone = "Salón Principal"
	}
	shift := strings.TrimSpace(in.Shift)
	if shift == "" {
		shift = "Turno General"
	}
	active := true
	if in.Active != nil {
		active = *in.Active
	}
	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	return Waiter{
		ID:       strings.ToLower(cleanCode),
		Code:     cleanCode,
		FullName: fullName,
		DocID:    strings.TrimSpace(in.DocID),
		Phone:    strings.TrimSpace(in.Phone),
		Zone:     zone,
		Shift:    shift,
		Active:   active,
	}, nil
}

func (w *Waiter) ApplyWaiterUpdate(in UpdateWaiterInput) error {
	fullName := strings.TrimSpace(in.FullName)
	if fullName == "" {
		return apperr.Validation("El nombre completo del mesero es obligatorio")
	}
	zone := strings.TrimSpace(in.Zone)
	if zone == "" {
		zone = "Salón Principal"
	}
	shift := strings.TrimSpace(in.Shift)
	if shift == "" {
		shift = "Turno General"
	}
	w.FullName = fullName
	w.DocID = strings.TrimSpace(in.DocID)
	w.Phone = strings.TrimSpace(in.Phone)
	w.Zone = zone
	w.Shift = shift
	if in.Active != nil {
		w.Active = *in.Active
	}
	return nil
}

func NormalizeOrderItemInput(in AddOrderItemInput) (AddOrderItemInput, error) {
	qty, err := requirePositiveFinite(in.Qty, "cantidad")
	if err != nil {
		return AddOrderItemInput{}, err
	}
	price, err := requirePositiveFinite(in.Price, "precio unitario")
	if err != nil {
		return AddOrderItemInput{}, err
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return AddOrderItemInput{}, apperr.Validation("El nombre del plato o bebida es obligatorio")
	}
	return AddOrderItemInput{
		ProductID: strings.TrimSpace(in.ProductID),
		Name:      name,
		Price:     price,
		Qty:       qty,
		Note:      strings.TrimSpace(in.Note),
	}, nil
}

func (t *DiningTable) AddOrMergeItem(in AddOrderItemInput) (OrderItem, bool, error) {
	norm, err := NormalizeOrderItemInput(in)
	if err != nil {
		return OrderItem{}, false, err
	}
	if strings.TrimSpace(t.Channel) == "" {
		t.Channel = ChannelMesa
	}
	wasFree := t.Status == StatusLibre || t.OrderStage == StageLibre || strings.TrimSpace(t.OrderStage) == ""

	for i := range t.Items {
		if norm.ProductID != "" && t.Items[i].ProductID == norm.ProductID && t.Items[i].Note == norm.Note {
			t.Items[i].Qty = money.RoundCents(t.Items[i].Qty + norm.Qty)
			t.Items[i].Price = norm.Price
			t.RecomputeTotal()
			if wasFree {
				t.Status = StatusOcupada
				t.OrderStage = StageNueva
			}
			if t.OpenedAt == "" {
				t.OpenedAt = NowTimestamp()
			}
			return t.Items[i], true, nil
		}
	}
	created := OrderItem{
		ItemID:    money.NewID("itm"),
		ProductID: norm.ProductID,
		Name:      norm.Name,
		Qty:       norm.Qty,
		Price:     norm.Price,
		Note:      norm.Note,
	}
	t.Items = append(t.Items, created)
	t.RecomputeTotal()
	if wasFree {
		t.Status = StatusOcupada
		t.OrderStage = StageNueva
	}
	if t.OpenedAt == "" {
		t.OpenedAt = NowTimestamp()
	}
	return created, false, nil
}

func (t *DiningTable) RemoveItem(itemID string) error {
	target := strings.TrimSpace(itemID)
	if target == "" {
		return apperr.Validation("El identificador de la línea es obligatorio")
	}
	found := -1
	for i := range t.Items {
		if t.Items[i].ItemID == target {
			found = i
			break
		}
	}
	if found < 0 {
		return apperr.NotFound("Plato o bebida no encontrado en la comanda")
	}
	t.Items = append(t.Items[:found], t.Items[found+1:]...)
	t.RecomputeTotal()
	if len(t.Items) == 0 {
		t.Status = StatusLibre
		t.OrderStage = StageLibre
		if !t.IsStandaloneTicket() {
			t.OrderCode = ""
			t.OpenedAt = ""
		}
	}
	return nil
}

func (t *DiningTable) SendToKitchen() error {
	if len(t.Items) == 0 {
		return apperr.Validation("Agrega al menos un plato o bebida antes de enviar la comanda a cocina")
	}
	if t.Status != StatusOcupada && t.Status != StatusEnCocina {
		return apperr.Conflict("La mesa debe estar ocupada para enviar pedido a cocina")
	}
	t.Status = StatusEnCocina
	t.OrderStage = StagePreparando
	return nil
}

func (t *DiningTable) MarkReady() error {
	if t.Status != StatusEnCocina && t.OrderStage != StagePreparando {
		return apperr.Conflict("La comanda no se encuentra pendiente en preparación de cocina")
	}
	if len(t.Items) == 0 {
		t.Status = StatusLibre
		t.OrderStage = StageLibre
	} else {
		t.Status = StatusOcupada
		t.OrderStage = StageLista
	}
	return nil
}

func (t *DiningTable) SetStage(stage string) error {
	if len(t.Items) == 0 {
		return apperr.Validation("Agrega al menos un plato o bebida antes de actualizar la etapa de la comanda")
	}
	clean := strings.ToUpper(strings.TrimSpace(stage))
	switch clean {
	case StageNueva:
		t.OrderStage = StageNueva
		t.Status = StatusOcupada
	case StagePreparando:
		t.OrderStage = StagePreparando
		t.Status = StatusEnCocina
	case StageLista:
		t.OrderStage = StageLista
		t.Status = StatusOcupada
	case StageEntregada:
		t.OrderStage = StageEntregada
		t.Status = StatusOcupada
	default:
		return apperr.Validation("Etapa de comanda inválida: use NUEVA, PREPARANDO, LISTA o ENTREGADA")
	}
	return nil
}

func (t *DiningTable) ClearAfterInvoice() {
	t.Items = []OrderItem{}
	t.Total = 0
	t.Status = StatusLibre
	t.OrderStage = StageLibre
	t.OrderCode = ""
	t.CustomerName = ""
	t.CustomerPhone = ""
	t.DeliveryAddress = ""
	t.PaymentHint = ""
	t.OpenedAt = ""
}

func DemoMenuItems() []MenuItem {
	return []MenuItem{
		{ID: "mnu-201", Code: "MNU-201", Name: "Punta de Anca a la Parrilla 350g", Category: "Restaurante — Fuertes", SalePrice: 48000, TaxPct: 8},
		{ID: "mnu-202", Code: "MNU-202", Name: "Salmón Sellado en Mantequilla de Finas Hierbas", Category: "Restaurante — Fuertes", SalePrice: 52000, TaxPct: 8},
		{ID: "mnu-203", Code: "MNU-203", Name: "Ceviche Clásico de Camarón", Category: "Restaurante — Entradas", SalePrice: 32000, TaxPct: 8},
		{ID: "mnu-204", Code: "MNU-204", Name: "Limonada de Coco Natural", Category: "Barra y Bebidas", SalePrice: 12000, TaxPct: 8},
		{ID: "mnu-205", Code: "MNU-205", Name: "Café Espresso Doble Origen", Category: "Postres y Cafetería", SalePrice: 8500, TaxPct: 8},
		{ID: "mnu-206", Code: "MNU-206", Name: "Lomo al Trapo con Papas Rústicas", Category: "Restaurante — Fuertes", SalePrice: 54000, TaxPct: 8},
		{ID: "mnu-207", Code: "MNU-207", Name: "Carpaccio Artesanal de Res", Category: "Restaurante — Entradas", SalePrice: 29000, TaxPct: 8},
		{ID: "mnu-208", Code: "MNU-208", Name: "Volcán Tibio de Chocolate Artesanal", Category: "Postres y Cafetería", SalePrice: 18500, TaxPct: 8},
	}
}

func DemoWaiters() []Waiter {
	return []Waiter{
		{ID: "msr-301", Code: "MSR-301", FullName: "Camila Restrepo", DocID: "1.037.612.845", Phone: "312 458 9021", Zone: "Salón Principal", Shift: "Turno Completo", Active: true},
		{ID: "msr-302", Code: "MSR-302", FullName: "Andrés Mejía", DocID: "1.017.204.519", Phone: "300 845 1290", Zone: "Terraza", Shift: "Turno Tarde / Noche", Active: true},
		{ID: "msr-303", Code: "MSR-303", FullName: "Laura Pineda", DocID: "1.152.448.703", Phone: "315 620 4418", Zone: "VIP / Reservados", Shift: "Turno Apertura", Active: true},
		{ID: "msr-304", Code: "MSR-304", FullName: "Santiago Ríos", DocID: "1.036.981.330", Phone: "320 714 0092", Zone: "Barra", Shift: "Turno Noche", Active: true},
	}
}

func DemoDiningTables() []DiningTable {
	return []DiningTable{
		{
			ID:              "ord-47",
			Name:            "Domicilio #0047",
			Zone:            "Domicilios",
			Waiter:          "Despacho Domicilios",
			Status:          StatusOcupada,
			OrderCode:       "#0047",
			Channel:         ChannelDomicilio,
			OrderStage:      StageNueva,
			CustomerName:    "Valentina Gómez",
			CustomerPhone:   "300 412 8890",
			DeliveryAddress: "Cra 43A # 18-45 Apto 602, El Poblado",
			Guests:          0,
			PaymentHint:     "Efectivo — devuelta de $100.000",
			OpenedAt:        "Hace 3 min",
			Items: []OrderItem{
				{ItemID: "itm-seed-47a", ProductID: "mnu-202", Name: "Salmón Sellado en Mantequilla de Finas Hierbas", Qty: 1, Price: 52000, Note: "Sin cebolla, salsa aparte"},
				{ItemID: "itm-seed-47b", ProductID: "mnu-204", Name: "Limonada de Coco Natural", Qty: 2, Price: 12000, Note: ""},
			},
			Total: 76000,
		},
		{
			ID:            "tbl-102",
			Name:          "Mesa 2",
			Zone:          "Terraza",
			Waiter:        "Andrés Mejía",
			Status:        StatusOcupada,
			OrderCode:     "#0046",
			Channel:       ChannelMesa,
			OrderStage:    StageNueva,
			CustomerName:  "Familia Cárdenas",
			Guests:        3,
			PaymentHint:   "Tarjeta crédito en mesa",
			OpenedAt:      "Hace 5 min",
			Items: []OrderItem{
				{ItemID: "itm-seed-102a", ProductID: "mnu-203", Name: "Ceviche Clásico de Camarón", Qty: 1, Price: 32000, Note: "Sin cebolla roja"},
				{ItemID: "itm-seed-102b", ProductID: "mnu-207", Name: "Carpaccio Artesanal de Res", Qty: 1, Price: 29000, Note: ""},
			},
			Total: 61000,
		},
		{
			ID:            "tbl-101",
			Name:          "Mesa 1",
			Zone:          "Salón Principal",
			Waiter:        "Camila Restrepo",
			Status:        StatusEnCocina,
			OrderCode:     "#0044",
			Channel:       ChannelMesa,
			OrderStage:    StagePreparando,
			CustomerName:  "Reserva Corporativa Norte",
			Guests:        4,
			PaymentHint:   "Transferencia empresarial",
			OpenedAt:      "Hace 12 min",
			Items: []OrderItem{
				{ItemID: "itm-seed-101a", ProductID: "mnu-201", Name: "Punta de Anca a la Parrilla 350g", Qty: 2, Price: 48000, Note: "Término 3/4"},
				{ItemID: "itm-seed-101b", ProductID: "mnu-204", Name: "Limonada de Coco Natural", Qty: 2, Price: 12000, Note: ""},
			},
			Total: 120000,
		},
		{
			ID:              "ord-45",
			Name:            "Para llevar #0045",
			Zone:            "Mostrador / Para llevar",
			Waiter:          "Mostrador Despacho",
			Status:          StatusEnCocina,
			OrderCode:       "#0045",
			Channel:         ChannelParaLlevar,
			OrderStage:      StagePreparando,
			CustomerName:    "Sebastián Morales",
			CustomerPhone:   "315 780 2314",
			DeliveryAddress: "Recoge en mostrador principal",
			Guests:          0,
			PaymentHint:     "Pago con código QR",
			OpenedAt:        "Hace 9 min",
			Items: []OrderItem{
				{ItemID: "itm-seed-45a", ProductID: "mnu-206", Name: "Lomo al Trapo con Papas Rústicas", Qty: 1, Price: 54000, Note: "Empaque térmico individual"},
				{ItemID: "itm-seed-45b", ProductID: "mnu-208", Name: "Volcán Tibio de Chocolate Artesanal", Qty: 1, Price: 18500, Note: ""},
			},
			Total: 72500,
		},
		{
			ID:              "ord-43",
			Name:            "Domicilio #0043",
			Zone:            "Domicilios",
			Waiter:          "Mensajería Propia",
			Status:          StatusOcupada,
			OrderCode:       "#0043",
			Channel:         ChannelDomicilio,
			OrderStage:      StageLista,
			CustomerName:    "Carolina Ospina",
			CustomerPhone:   "310 654 1198",
			DeliveryAddress: "Calle 10B # 36-22 Oficina 404",
			Guests:          0,
			PaymentHint:     "Datáfono inalámbrico",
			OpenedAt:        "Hace 18 min",
			Items: []OrderItem{
				{ItemID: "itm-seed-43a", ProductID: "mnu-203", Name: "Ceviche Clásico de Camarón", Qty: 2, Price: 32000, Note: "Picante medio"},
				{ItemID: "itm-seed-43b", ProductID: "mnu-205", Name: "Café Espresso Doble Origen", Qty: 2, Price: 8500, Note: ""},
			},
			Total: 81000,
		},
		{
			ID:            "tbl-105",
			Name:          "Reservado VIP 1",
			Zone:          "VIP / Reservados",
			Waiter:        "Camila Restrepo",
			Status:        StatusOcupada,
			OrderCode:     "#0041",
			Channel:       ChannelMesa,
			OrderStage:    StageEntregada,
			CustomerName:  "Dr. Mauricio Henao",
			Guests:        2,
			PaymentHint:   "Factura electrónica corporativa",
			OpenedAt:      "Hace 34 min",
			Items: []OrderItem{
				{ItemID: "itm-seed-105a", ProductID: "mnu-206", Name: "Lomo al Trapo con Papas Rústicas", Qty: 1, Price: 54000, Note: "Bien asado"},
				{ItemID: "itm-seed-105b", ProductID: "mnu-202", Name: "Salmón Sellado en Mantequilla de Finas Hierbas", Qty: 1, Price: 52000, Note: ""},
				{ItemID: "itm-seed-105c", ProductID: "mnu-204", Name: "Limonada de Coco Natural", Qty: 2, Price: 12000, Note: "Sin azúcar"},
			},
			Total: 130000,
		},
		{
			ID:              "ord-42",
			Name:            "Para llevar #0042",
			Zone:            "Mostrador / Para llevar",
			Waiter:          "Mostrador Despacho",
			Status:          StatusOcupada,
			OrderCode:       "#0042",
			Channel:         ChannelParaLlevar,
			OrderStage:      StageEntregada,
			CustomerName:    "Natalia Vélez",
			CustomerPhone:   "320 911 4502",
			DeliveryAddress: "Entregado en barra de despacho",
			Guests:          0,
			PaymentHint:     "Contado efectivo",
			OpenedAt:        "Hace 26 min",
			Items: []OrderItem{
				{ItemID: "itm-seed-42a", ProductID: "mnu-201", Name: "Punta de Anca a la Parrilla 350g", Qty: 1, Price: 48000, Note: "Término medio"},
			},
			Total: 48000,
		},
		{
			ID:         "tbl-103",
			Name:       "Mesa 3",
			Zone:       "Salón Principal",
			Waiter:     "Camila Restrepo",
			Status:     StatusLibre,
			Channel:    ChannelMesa,
			OrderStage: StageLibre,
			Guests:     4,
			Items:      []OrderItem{},
			Total:      0,
		},
		{
			ID:         "tbl-104",
			Name:       "Mesa 4",
			Zone:       "Terraza",
			Waiter:     "Andrés Mejía",
			Status:     StatusLibre,
			Channel:    ChannelMesa,
			OrderStage: StageLibre,
			Guests:     4,
			Items:      []OrderItem{},
			Total:      0,
		},
		{
			ID:         "tbl-106",
			Name:       "Reservado VIP 2",
			Zone:       "VIP / Reservados",
			Waiter:     "Camila Restrepo",
			Status:     StatusLibre,
			Channel:    ChannelMesa,
			OrderStage: StageLibre,
			Guests:     6,
			Items:      []OrderItem{},
			Total:      0,
		},
	}
}
