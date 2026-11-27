package domain

import "context"

type ProductQuote struct {
	ProductID      string
	Code           string
	Name           string
	SalePrice      float64
	TaxPct         float64
	AvailableStock float64
}

type StockMovementItem struct {
	ProductID    string
	Quantity     float64
	UnitCost     float64
	WarehouseID  string
	MovementType string
	ReferenceDoc string
	Actor        string
}

type InventoryPort interface {
	QuoteProducts(ctx context.Context, productIDs []string) (map[string]ProductQuote, error)
	DeductStock(ctx context.Context, idemKey string, items []StockMovementItem) error
	RestockItems(ctx context.Context, idemKey string, items []StockMovementItem) error
}

type CommercialTerms struct {
	CustomerID      string
	CustomerName    string
	CustomerNIT     string
	CustomerPhone   string
	CustomerAddress string
	ContractID      string
	ContractCode    string
	DiscountPct     float64
	CreditLimit     float64
	CurrentDebt     float64
}

type ReceivableDeltaInput struct {
	IdempotencyKey        string
	CustomerID            string
	ContractID            string
	InvoiceID             string
	InvoiceNumber         string
	IssueDate             string
	InvoiceTotal          float64
	DebtDelta             float64
	ContractConsumedDelta float64
}

type CustomersPort interface {
	ResolveCommercialTerms(ctx context.Context, customerID, contractID string) (CommercialTerms, error)
	ApplyReceivableDelta(ctx context.Context, input ReceivableDeltaInput) error
}

type WorkshopPort interface {
	RegisterInvoicedOrder(ctx context.Context, workOrderID, mechanicID string, laborGross float64, invoiceNumber string) (mechanicName string, err error)
}

type HospitalityPort interface {
	CompleteRoomCheckout(ctx context.Context, roomID, invoiceNumber string) error
}

type GastroPort interface {
	ClearInvoicedTable(ctx context.Context, tableID, invoiceNumber string) error
}

type PrintPort interface {
	RenderInvoice(ctx context.Context, inv Invoice) (html string, err error)
}

type Repository interface {
	PeekSequences(ctx context.Context, dbName string) (nextInvoice string, nextQuote string, err error)
	PeekNoteSequences(ctx context.Context, dbName string) (nextCreditNote string, nextDebitNote string, err error)
	ReserveInvoiceNumber(ctx context.Context, dbName string) (string, error)
	ReserveDraftInvoiceNumber(ctx context.Context, dbName string) (string, error)
	ReserveQuoteNumber(ctx context.Context, dbName string) (string, error)
	ReserveCreditNoteNumber(ctx context.Context, dbName string) (string, error)
	ReserveDebitNoteNumber(ctx context.Context, dbName string) (string, error)
	ReserveDraftNoteNumber(ctx context.Context, dbName string, noteKind string) (string, error)

	FindInvoiceByIdempotencyKey(ctx context.Context, dbName, idemKey string) (*Invoice, error)
	GetInvoiceByID(ctx context.Context, dbName, id string) (*Invoice, error)
	SaveInvoice(ctx context.Context, dbName string, inv Invoice, idemKey string) error
	ReplaceInvoice(ctx context.Context, dbName, oldID string, inv Invoice) error
	ListInvoices(ctx context.Context, dbName string) ([]Invoice, error)

	GetAdjustmentNoteByID(ctx context.Context, dbName, id string) (*AdjustmentNote, error)
	SaveAdjustmentNote(ctx context.Context, dbName, oldID string, note AdjustmentNote) error
	ListAdjustmentNotes(ctx context.Context, dbName string) ([]AdjustmentNote, error)

	GetDianTransmission(ctx context.Context, dbName, documentKind, documentID string) (*DianTransmission, error)
	UpsertDianTransmission(ctx context.Context, dbName string, dt DianTransmission) error
	ListDianTransmissions(ctx context.Context, dbName string) ([]DianTransmission, error)

	CreateQuote(ctx context.Context, dbName string, quote Quote) error
	ListQuotes(ctx context.Context, dbName string) ([]Quote, error)
	GetSummary(ctx context.Context, dbName string) (SalesSummary, error)
}
