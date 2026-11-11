package domain

import (
	"strings"

	"ms-comandas/internal/platform/apperr"
	"ms-comandas/internal/platform/money"
)

const (
	StatusLibre    = "Libre"
	StatusOcupada  = "Ocupada"
	StatusEnCocina = "En Cocina"
)

type MenuItem struct {
	ID        string  `json:"id"`
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Category  string  `json:"category"`
	SalePrice float64 `json:"salePrice"`
	TaxPct    float64 `json:"taxPct"`
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
	ID     string      `json:"id"`
	Name   string      `json:"name"`
	Zone   string      `json:"zone"`
	Waiter string      `json:"waiter"`
	Status string      `json:"status"`
	Items  []OrderItem `json:"items"`
	Total  float64     `json:"total"`
}

func (t DiningTable) Clone() DiningTable {
	itemsCopy := make([]OrderItem, len(t.Items))
	copy(itemsCopy, t.Items)
	t.Items = itemsCopy
	return t
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
}

type CreateMenuItemInput struct {
	Name      string  `json:"name"`
	Category  string  `json:"category"`
	SalePrice float64 `json:"salePrice"`
	TaxPct    float64 `json:"taxPct"`
}

type AddOrderItemInput struct {
	ProductID string  `json:"productId"`
	Name      string  `json:"name"`
	Price     float64 `json:"price"`
	Qty       float64 `json:"qty"`
	Note      string  `json:"note"`
}

type GastroState struct {
	NextMenuCode string        `json:"nextMenuCode"`
	Tables       []DiningTable `json:"tables"`
	Products     []MenuItem    `json:"products"`
}

func BuildDiningTable(id string, in CreateTableInput) (DiningTable, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return DiningTable{}, apperr.Validation("El nombre o número de la mesa es obligatorio")
	}
	lower := strings.ToLower(name)
	if !strings.Contains(lower, "mesa") && !strings.Contains(lower, "barra") && !strings.Contains(lower, "terraza") && !strings.Contains(lower, "reserv") {
		name = "Mesa " + name
	}
	zone := strings.TrimSpace(in.Zone)
	if zone == "" {
		zone = "Salón Principal"
	}
	waiter := strings.TrimSpace(in.Waiter)
	if waiter == "" {
		waiter = "Mesero Turno"
	}
	return DiningTable{
		ID:     strings.ToLower(strings.TrimSpace(id)),
		Name:   name,
		Zone:   zone,
		Waiter: waiter,
		Status: StatusLibre,
		Items:  []OrderItem{},
		Total:  0,
	}, nil
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
	for i := range t.Items {
		if norm.ProductID != "" && t.Items[i].ProductID == norm.ProductID && t.Items[i].Note == norm.Note {
			t.Items[i].Qty = money.RoundCents(t.Items[i].Qty + norm.Qty)
			t.Items[i].Price = norm.Price
			t.RecomputeTotal()
			if t.Status == StatusLibre {
				t.Status = StatusOcupada
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
	if t.Status == StatusLibre {
		t.Status = StatusOcupada
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
	return nil
}

func (t *DiningTable) MarkReady() error {
	if t.Status != StatusEnCocina {
		return apperr.Conflict("La comanda no se encuentra pendiente en preparación de cocina")
	}
	if len(t.Items) == 0 {
		t.Status = StatusLibre
	} else {
		t.Status = StatusOcupada
	}
	return nil
}

func (t *DiningTable) ClearAfterInvoice() {
	t.Items = []OrderItem{}
	t.Total = 0
	t.Status = StatusLibre
}
