package application

import (
	"strings"
	"sync"

	"ms-platform/internal/domain"
	"ms-platform/internal/platform/apperr"
)

type Service struct {
	mu        sync.RWMutex
	contracts []domain.S2SContractSpec
	standards []domain.PlatformStandard
}

func NewService() *Service {
	return &Service{
		contracts: []domain.S2SContractSpec{
			{
				ContractKey:    "inventory.quote",
				TargetService:  "ms-inventario",
				Method:         "POST",
				GatewayPath:    "/api/v1/s2s/ms-inventario/internal-s2s/quote",
				RequiredFields: []string{"productIds"},
				Summary:        "Cotización autoritativa de precios, impuestos y existencias de inventario.",
			},
			{
				ContractKey:    "inventory.deduct",
				TargetService:  "ms-inventario",
				Method:         "POST",
				GatewayPath:    "/api/v1/s2s/ms-inventario/internal-s2s/deduct",
				RequiredFields: []string{"idempotencyKey", "items"},
				Summary:        "Descuento transaccional e idempotente de existencias por venta.",
			},
			{
				ContractKey:    "inventory.restock",
				TargetService:  "ms-inventario",
				Method:         "POST",
				GatewayPath:    "/api/v1/s2s/ms-inventario/internal-s2s/restock",
				RequiredFields: []string{"idempotencyKey", "items"},
				Summary:        "Reabastecimiento con costo promedio ponderado o reverso compensatorio Saga.",
			},
			{
				ContractKey:    "customers.commercial_terms",
				TargetService:  "ms-clientes",
				Method:         "POST",
				GatewayPath:    "/api/v1/s2s/ms-clientes/internal-s2s/commercial-terms",
				RequiredFields: []string{"customerId"},
				Summary:        "Consulta de condiciones comerciales, convenio y tarifa aplicable al cliente.",
			},
			{
				ContractKey:    "customers.receivable_delta",
				TargetService:  "ms-clientes",
				Method:         "POST",
				GatewayPath:    "/api/v1/s2s/ms-clientes/internal-s2s/receivable-delta",
				RequiredFields: []string{"idempotencyKey", "customerId", "invoiceId"},
				Summary:        "Afectación idempotente de cartera CxC y control de cupo de crédito.",
			},
			{
				ContractKey:    "workshop.invoice_sync",
				TargetService:  "ms-taller",
				Method:         "POST",
				GatewayPath:    "/api/v1/s2s/ms-taller/internal-s2s/invoice-sync",
				RequiredFields: []string{"idempotencyKey", "invoiceNumber"},
				Summary:        "Cierre de orden de taller y liquidación de comisión técnica al facturar.",
			},
			{
				ContractKey:    "hospitality.checkout",
				TargetService:  "ms-hoteleria",
				Method:         "POST",
				GatewayPath:    "/api/v1/s2s/ms-hoteleria/internal-s2s/checkout",
				RequiredFields: []string{"idempotencyKey", "roomId", "invoiceNumber"},
				Summary:        "Check-out automático de habitación vinculada a factura emitida.",
			},
			{
				ContractKey:    "gastro.clear_table",
				TargetService:  "ms-comandas",
				Method:         "POST",
				GatewayPath:    "/api/v1/s2s/ms-comandas/internal-s2s/clear-table",
				RequiredFields: []string{"idempotencyKey", "tableId", "invoiceNumber"},
				Summary:        "Liberación de mesa gastronómica al liquidar cuenta en facturación.",
			},
			{
				ContractKey:    "printing.render",
				TargetService:  "ms-impresiones",
				Method:         "POST",
				GatewayPath:    "/api/v1/s2s/ms-impresiones/render",
				RequiredFields: []string{"document_type", "document_number"},
				Summary:        "Generación segura de documento imprimible HTML sanitizado.",
			},
		},
		standards: []domain.PlatformStandard{
			{Key: "hub_and_spoke_gateway", Description: "Todo tráfico cliente-servidor y S2S fluye exclusivamente por GATEWAY_URL."},
			{Key: "ed25519_single_use_passport", Description: "Cada salto HTTP exige llave S2S y pasaporte asimétrico Ed25519 con protección anti-replay."},
			{Key: "share_nothing_modules", Description: "Cada microservicio compila y despliega de forma aislada sin compartir carpetas de código."},
		},
	}
}

func (s *Service) ListContracts() []domain.S2SContractSpec {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]domain.S2SContractSpec, len(s.contracts))
	copy(out, s.contracts)
	return out
}

func (s *Service) RegisterContract(spec domain.S2SContractSpec) (domain.S2SContractSpec, error) {
	spec.ContractKey = strings.TrimSpace(spec.ContractKey)
	spec.TargetService = strings.TrimSpace(spec.TargetService)
	spec.Method = strings.ToUpper(strings.TrimSpace(spec.Method))
	spec.GatewayPath = strings.TrimSpace(spec.GatewayPath)
	spec.Summary = strings.TrimSpace(spec.Summary)
	if spec.ContractKey == "" || spec.TargetService == "" || spec.GatewayPath == "" {
		return domain.S2SContractSpec{}, apperr.Validation("contractKey, targetService y gatewayPath son obligatorios")
	}
	if spec.Method == "" {
		spec.Method = "POST"
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for i, existing := range s.contracts {
		if existing.ContractKey == spec.ContractKey {
			s.contracts[i] = spec
			return spec, nil
		}
	}
	s.contracts = append(s.contracts, spec)
	return spec, nil
}

func (s *Service) ListStandards() []domain.PlatformStandard {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]domain.PlatformStandard, len(s.standards))
	copy(out, s.standards)
	return out
}

func (s *Service) ValidatePayload(contractKey string, payload map[string]any) (domain.ValidationResult, error) {
	key := strings.TrimSpace(contractKey)
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, spec := range s.contracts {
		if spec.ContractKey == key {
			var missing []string
			for _, reqField := range spec.RequiredFields {
				if v, ok := payload[reqField]; !ok || v == nil {
					missing = append(missing, reqField)
				}
			}
			return domain.ValidationResult{
				Valid:         len(missing) == 0,
				ContractKey:   spec.ContractKey,
				MissingFields: missing,
			}, nil
		}
	}
	return domain.ValidationResult{}, apperr.NotFound("Contrato S2S no registrado: " + key)
}
