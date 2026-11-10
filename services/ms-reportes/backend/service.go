package backend

import (
	"net/http"

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

func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(authguard.PropagateHeadersToContext(s.clusterSecret))

	r.Get("/executive", s.handleExecutiveReport)

	return r
}

func (s *Service) handleExecutiveReport(w http.ResponseWriter, r *http.Request) {
	tc := authguard.FromContext(r.Context())

	s.db.WithRead(r.Context(), tc.DBName, func(d *tenantdb.TenantData) {
		var (
			totalSales              float64
			totalCollected          float64
			totalPendingReceivables float64
			totalExpenses           float64
			inventoryCostValue      float64
			inventorySaleValue      float64
			lowStockCount           int
		)

		invoices := d.Invoices
		if invoices == nil {
			invoices = []tenantdb.Invoice{}
		}
		for _, inv := range invoices {
			totalSales += inv.Total
			totalCollected += inv.AmountPaid
			totalPendingReceivables += inv.PendingBalance
		}

		expenses := d.Expenses
		if expenses == nil {
			expenses = []tenantdb.Expense{}
		}
		for _, exp := range expenses {
			totalExpenses += exp.Amount
		}

		products := d.Products
		if products == nil {
			products = []tenantdb.Product{}
		}
		for _, p := range products {
			inventoryCostValue += p.CostPrice * p.Stock
			inventorySaleValue += p.SalePrice * p.Stock
			if p.Stock <= p.MinStock {
				lowStockCount++
			}
		}

		netOperatingProfit := totalSales - totalExpenses

		httpx.JSON(w, http.StatusOK, map[string]any{
			"ok":                      true,
			"totalSales":              totalSales,
			"totalCollected":          totalCollected,
			"totalPendingReceivables": totalPendingReceivables,
			"totalExpenses":           totalExpenses,
			"netOperatingProfit":      netOperatingProfit,
			"inventoryCostValue":      inventoryCostValue,
			"inventorySaleValue":      inventorySaleValue,
			"lowStockCount":           lowStockCount,
			"customersCount":          len(d.Customers),
			"workOrdersCount":         len(d.WorkOrders),
			"scaleTicketsCount":       len(d.ScaleTickets),
			"invoices":                invoices,
			"expenses":                expenses,
			"products":                products,
		})
	})
}
