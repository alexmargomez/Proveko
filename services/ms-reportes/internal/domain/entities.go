package domain

import (
	"strings"

	"ms-reportes/internal/platform/apperr"
	"ms-reportes/internal/platform/money"
)

const (
	SchemaName         = "reporting"
	ModuleKeyReporting = "centro_reportes"

	SnapshotSeqPrefix = "RPT"
	SnapshotSeqStart  = 800
)

type ExecutiveSnapshot struct {
	ID                      string  `json:"id"`
	Code                    string  `json:"code"`
	TotalSales              float64 `json:"totalSales"`
	TotalCollected          float64 `json:"totalCollected"`
	TotalPendingReceivables float64 `json:"totalPendingReceivables"`
	TotalExpenses           float64 `json:"totalExpenses"`
	NetOperatingProfit      float64 `json:"netOperatingProfit"`
	InventoryCostValue      float64 `json:"inventoryCostValue"`
	InventorySaleValue      float64 `json:"inventorySaleValue"`
	LowStockCount           int     `json:"lowStockCount"`
	CustomersCount          int     `json:"customersCount"`
	Notes                   string  `json:"notes"`
	CreatedBy               string  `json:"createdBy"`
	CreatedAt               string  `json:"createdAt"`
}

func (s *ExecutiveSnapshot) Clone() *ExecutiveSnapshot {
	if s == nil {
		return nil
	}
	cp := *s
	return &cp
}

type CreateSnapshotInput struct {
	TotalSales              float64  `json:"totalSales"`
	TotalCollected          float64  `json:"totalCollected"`
	TotalPendingReceivables float64  `json:"totalPendingReceivables"`
	TotalExpenses           float64  `json:"totalExpenses"`
	NetOperatingProfit      *float64 `json:"netOperatingProfit"`
	InventoryCostValue      float64  `json:"inventoryCostValue"`
	InventorySaleValue      float64  `json:"inventorySaleValue"`
	LowStockCount           int      `json:"lowStockCount"`
	CustomersCount          int      `json:"customersCount"`
	Notes                   string   `json:"notes"`
}

type SnapshotsState struct {
	NextCode         string               `json:"nextCode"`
	NextSnapshotCode string               `json:"nextSnapshotCode"`
	Snapshots        []*ExecutiveSnapshot `json:"snapshots"`
}

type ExecutiveReport struct {
	NextCode                string               `json:"nextCode"`
	NextSnapshotCode        string               `json:"nextSnapshotCode"`
	TotalSales              float64              `json:"totalSales"`
	TotalCollected          float64              `json:"totalCollected"`
	TotalPendingReceivables float64              `json:"totalPendingReceivables"`
	TotalExpenses           float64              `json:"totalExpenses"`
	NetOperatingProfit      float64              `json:"netOperatingProfit"`
	InventoryCostValue      float64              `json:"inventoryCostValue"`
	InventorySaleValue      float64              `json:"inventorySaleValue"`
	LowStockCount           int                  `json:"lowStockCount"`
	CustomersCount          int                  `json:"customersCount"`
	Snapshots               []*ExecutiveSnapshot `json:"snapshots"`
}

func validateNonNegativeMoney(v float64, label string) (float64, error) {
	if !money.IsFinite(v) || v < 0 {
		return 0, apperr.Validation(label + " debe ser un monto válido mayor o igual a cero")
	}
	return money.RoundCents(v), nil
}

func NewExecutiveSnapshot(code, createdBy string, in CreateSnapshotInput, createdAt string) (*ExecutiveSnapshot, error) {
	sales, err := validateNonNegativeMoney(in.TotalSales, "Ventas totales")
	if err != nil {
		return nil, err
	}
	collected, err := validateNonNegativeMoney(in.TotalCollected, "Recaudo efectivo")
	if err != nil {
		return nil, err
	}
	receivables, err := validateNonNegativeMoney(in.TotalPendingReceivables, "Cartera por cobrar")
	if err != nil {
		return nil, err
	}
	expenses, err := validateNonNegativeMoney(in.TotalExpenses, "Egresos operativos")
	if err != nil {
		return nil, err
	}
	invCost, err := validateNonNegativeMoney(in.InventoryCostValue, "Costo de inventario")
	if err != nil {
		return nil, err
	}
	invSale, err := validateNonNegativeMoney(in.InventorySaleValue, "Valor de venta de inventario")
	if err != nil {
		return nil, err
	}
	if in.LowStockCount < 0 || in.CustomersCount < 0 {
		return nil, apperr.Validation("Los conteos estadísticos del corte no pueden ser negativos")
	}

	netProfit := money.RoundCents(sales - expenses)
	if in.NetOperatingProfit != nil {
		if !money.IsFinite(*in.NetOperatingProfit) {
			return nil, apperr.Validation("Utilidad operativa inválida")
		}
		netProfit = money.RoundCents(*in.NetOperatingProfit)
	}

	author := strings.TrimSpace(createdBy)
	if author == "" {
		author = "gerencia"
	}
	notes := strings.TrimSpace(in.Notes)
	if notes == "" {
		notes = "Corte ejecutivo consolidado"
	}

	return &ExecutiveSnapshot{
		ID:                      code,
		Code:                    code,
		TotalSales:              sales,
		TotalCollected:          collected,
		TotalPendingReceivables: receivables,
		TotalExpenses:           expenses,
		NetOperatingProfit:      netProfit,
		InventoryCostValue:      invCost,
		InventorySaleValue:      invSale,
		LowStockCount:           in.LowStockCount,
		CustomersCount:          in.CustomersCount,
		Notes:                   notes,
		CreatedBy:               author,
		CreatedAt:               createdAt,
	}, nil
}
