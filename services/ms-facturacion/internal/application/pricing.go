package application

import (
	"context"
	"hash/fnv"
	"strings"

	"ms-facturacion/internal/domain"
	"ms-facturacion/internal/platform/apperr"
	"ms-facturacion/internal/platform/licensegate"
	"ms-facturacion/internal/platform/money"
)

func hashStripeIndex(dbName, idemKey string, numStripes int) int {
	h := fnv.New32a()
	_, _ = h.Write([]byte(dbName))
	_, _ = h.Write([]byte("::"))
	_, _ = h.Write([]byte(idemKey))
	return int(h.Sum32() % uint32(numStripes))
}

func (s *Service) normalizeAndPriceItems(ctx context.Context, rawItems []domain.InvoiceItem, requireCatalogForProductID bool) ([]domain.InvoiceItem, float64, error) {
	normalized := make([]domain.InvoiceItem, 0, len(rawItems))
	productIDSet := make(map[string]bool)
	var productIDs []string

	for _, raw := range rawItems {
		if !money.IsFinite(raw.Quantity) || raw.Quantity <= 0 {
			return nil, 0, apperr.Validation("La cantidad de cada ítem debe ser mayor a cero")
		}
		itemType := strings.ToUpper(strings.TrimSpace(raw.ItemType))
		if itemType == "" {
			itemType = domain.ItemTypeProducto
		}
		if itemType != domain.ItemTypeProducto && itemType != domain.ItemTypeServicio {
			return nil, 0, apperr.Validation("El tipo de ítem debe ser PRODUCTO o SERVICIO")
		}

		prodID := strings.TrimSpace(raw.ProductID)
		if itemType == domain.ItemTypeServicio {
			prodID = ""
		}
		if prodID != "" && !productIDSet[prodID] {
			productIDSet[prodID] = true
			productIDs = append(productIDs, prodID)
		}

		normalized = append(normalized, domain.InvoiceItem{
			ProductID:   prodID,
			Code:        strings.TrimSpace(raw.Code),
			Description: strings.TrimSpace(raw.Description),
			ItemType:    itemType,
			Quantity:    money.RoundCents(raw.Quantity),
			UnitPrice:   raw.UnitPrice,
			TaxPct:      raw.TaxPct,
			WorkerID:    strings.TrimSpace(raw.WorkerID),
			WorkerName:  strings.TrimSpace(raw.WorkerName),
		})
	}

	if len(productIDs) > 0 {
		inventoryAvailable := s.inventoryPort != nil && licensegate.HasService(ctx, "ms-inventario")
		if !inventoryAvailable {
			if requireCatalogForProductID {
				return nil, 0, apperr.Forbidden("El microservicio de inventario no está activo para validar precios de catálogo")
			}
		} else {
			quotesMap, err := s.inventoryPort.QuoteProducts(ctx, productIDs)
			if err != nil {
				return nil, 0, err
			}
			for i := range normalized {
				pid := normalized[i].ProductID
				if pid == "" {
					continue
				}
				q, ok := quotesMap[pid]
				if !ok {
					return nil, 0, apperr.NotFound("El producto " + pid + " no existe en el catálogo de inventario")
				}
				normalized[i].UnitPrice = q.SalePrice
				normalized[i].TaxPct = q.TaxPct
				if strings.TrimSpace(q.Code) != "" {
					normalized[i].Code = strings.TrimSpace(q.Code)
				}
				if normalized[i].Description == "" {
					normalized[i].Description = strings.TrimSpace(q.Name)
				}
			}
		}
	}

	subtotal := 0.0
	for i := range normalized {
		it := &normalized[i]
		if !money.IsFinite(it.UnitPrice) || it.UnitPrice <= 0 {
			return nil, 0, apperr.Validation("El precio unitario de cada ítem debe ser mayor a cero")
		}
		if !money.IsFinite(it.TaxPct) || it.TaxPct < 0 || it.TaxPct > 100 {
			return nil, 0, apperr.Validation("El porcentaje de impuesto del ítem es inválido")
		}
		if it.Code == "" {
			it.Code = "ITEM"
		}
		if it.Description == "" {
			if it.ProductID != "" {
				it.Description = "Producto " + it.Code
			} else {
				return nil, 0, apperr.Validation("La descripción de cada ítem es obligatoria")
			}
		}
		it.UnitPrice = money.RoundCents(it.UnitPrice)
		it.TaxPct = money.RoundCents(it.TaxPct)
		it.Subtotal = money.RoundCents(it.Quantity * it.UnitPrice)
		subtotal = money.RoundCents(subtotal + it.Subtotal)
	}
	return normalized, subtotal, nil
}
