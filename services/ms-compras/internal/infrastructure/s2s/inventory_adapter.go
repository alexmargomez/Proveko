package s2s

import (
	"context"
	"net/http"

	"ms-compras/internal/domain"
	"ms-compras/internal/platform/apperr"
	"ms-compras/internal/platform/gateway"
)

type stockDeltaWireItem struct {
	ProductID    string  `json:"productId"`
	Quantity     float64 `json:"quantity"`
	UnitCost     float64 `json:"unitCost,omitempty"`
	WarehouseID  string  `json:"warehouseId,omitempty"`
	MovementType string  `json:"movementType,omitempty"`
	ReferenceDoc string  `json:"referenceDoc,omitempty"`
	Actor        string  `json:"actor,omitempty"`
}

type stockDeltaWireRequest struct {
	IdempotencyKey string               `json:"idempotencyKey"`
	Items          []stockDeltaWireItem `json:"items"`
}

type InventoryAdapter struct {
	gw *gateway.Client
}

func NewInventoryAdapter(gw *gateway.Client) domain.InventoryRestockPort {
	if gw == nil {
		return nil
	}
	return &InventoryAdapter{gw: gw}
}

func (a *InventoryAdapter) RestockItem(ctx context.Context, in domain.InventoryRestockInput) error {
	if a == nil || a.gw == nil {
		return nil
	}
	var resp struct {
		Ok bool `json:"ok"`
	}
	payload := stockDeltaWireRequest{
		IdempotencyKey: in.IdempotencyKey,
		Items: []stockDeltaWireItem{
			{
				ProductID:    in.ProductID,
				Quantity:     in.Quantity,
				UnitCost:     in.UnitCost,
				WarehouseID:  in.WarehouseID,
				MovementType: "ENTRADA_COMPRA",
				ReferenceDoc: in.ReferenceDoc,
				Actor:        in.Actor,
			},
		},
	}
	if err := a.gw.CallS2S(ctx, "ms-inventario", http.MethodPost, "/internal-s2s/restock", in.IdempotencyKey, payload, &resp); err != nil {
		return err
	}
	if !resp.Ok {
		return apperr.Unprocessable("ms-inventario rechazó la recepción de mercancía")
	}
	return nil
}

func (a *InventoryAdapter) CompensateRestock(ctx context.Context, in domain.InventoryRestockInput) error {
	if a == nil || a.gw == nil {
		return nil
	}
	compIdem := in.IdempotencyKey + ":rollback"
	var resp struct {
		Ok bool `json:"ok"`
	}
	payload := stockDeltaWireRequest{
		IdempotencyKey: compIdem,
		Items: []stockDeltaWireItem{
			{
				ProductID:    in.ProductID,
				Quantity:     in.Quantity,
				WarehouseID:  in.WarehouseID,
				ReferenceDoc: "REVERSO-OC " + in.ReferenceDoc,
				Actor:        in.Actor,
			},
		},
	}
	return a.gw.CallS2S(ctx, "ms-inventario", http.MethodPost, "/internal-s2s/deduct", compIdem, payload, &resp)
}
