package application

import (
	"context"
	"strings"

	"ms-clientes/internal/platform/apperr"
	"ms-clientes/internal/platform/authguard"
	"ms-clientes/internal/platform/licensegate"
	"ms-clientes/internal/domain"
)

type Service struct {
	repo domain.Repository
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

func requireTenant(ctx context.Context) (authguard.TenantContext, error) {
	tc := authguard.FromContext(ctx)
	if strings.TrimSpace(tc.DBName) == "" {
		return authguard.TenantContext{}, apperr.Unauthorized("Contexto de empresa no disponible")
	}
	return tc, nil
}

func (s *Service) GetAll(ctx context.Context) (domain.DirectorySnapshot, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.DirectorySnapshot{}, err
	}
	if !licensegate.HasModule(ctx, "directorio_clientes") &&
		!licensegate.HasModule(ctx, "cartera_cxc") &&
		!licensegate.HasModule(ctx, "contratos_convenios") {
		return domain.DirectorySnapshot{}, apperr.Forbidden("Ningún módulo de clientes o cartera está activo en la suscripción de esta empresa")
	}
	return s.repo.GetAll(ctx, tc.DBName)
}

func (s *Service) CreateCustomer(ctx context.Context, in domain.CreateCustomerInput) (domain.Customer, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Customer{}, err
	}
	if err := licensegate.CheckModule(ctx, "directorio_clientes"); err != nil {
		return domain.Customer{}, err
	}
	if _, err := domain.BuildCustomer("CLI-TMP", in, nil, nil); err != nil {
		return domain.Customer{}, err
	}
	return s.repo.CreateCustomer(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) DeleteCustomer(ctx context.Context, customerID string) error {
	tc, err := requireTenant(ctx)
	if err != nil {
		return err
	}
	if err := licensegate.CheckModule(ctx, "directorio_clientes"); err != nil {
		return err
	}
	cleanID := strings.TrimSpace(customerID)
	if cleanID == "" {
		return apperr.Validation("El identificador del cliente es obligatorio")
	}
	return s.repo.DeleteCustomer(ctx, tc.DBName, cleanID)
}

func (s *Service) CreateTariff(ctx context.Context, in domain.CreateTariffInput) (domain.Tariff, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Tariff{}, err
	}
	if err := licensegate.CheckModule(ctx, "contratos_convenios"); err != nil {
		return domain.Tariff{}, err
	}
	if _, err := domain.BuildTariff("TRF-TMP", in); err != nil {
		return domain.Tariff{}, err
	}
	return s.repo.CreateTariff(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) CreateContract(ctx context.Context, in domain.CreateContractInput) (domain.Contract, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Contract{}, err
	}
	if err := licensegate.CheckModule(ctx, "contratos_convenios"); err != nil {
		return domain.Contract{}, err
	}
	if _, err := domain.BuildContract("CNV-TMP", in, nil); err != nil {
		return domain.Contract{}, err
	}
	return s.repo.CreateContract(ctx, tc.DBName, tc.IdempotencyKey, in)
}

func (s *Service) RegisterAbono(ctx context.Context, invoiceID string, in domain.RegisterAbonoInput) (domain.Receivable, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.Receivable{}, err
	}
	if err := licensegate.CheckModule(ctx, "cartera_cxc"); err != nil {
		return domain.Receivable{}, err
	}
	cleanInvoiceID := strings.TrimSpace(invoiceID)
	if cleanInvoiceID == "" {
		return domain.Receivable{}, apperr.Validation("El identificador de la factura es obligatorio")
	}
	return s.repo.RegisterAbono(ctx, tc.DBName, tc.IdempotencyKey, cleanInvoiceID, in)
}

func (s *Service) ResolveCommercialTerms(ctx context.Context, customerID, contractID string) (domain.CommercialTerms, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.CommercialTerms{}, err
	}
	cleanCust := strings.TrimSpace(customerID)
	cleanCnt := strings.TrimSpace(contractID)
	if cleanCust == "" && cleanCnt == "" {
		return domain.CommercialTerms{}, apperr.Validation("Se requiere customer_id o contract_id para resolver condiciones comerciales")
	}
	return s.repo.ResolveCommercialTerms(ctx, tc.DBName, cleanCust, cleanCnt)
}

func (s *Service) ApplyReceivableDelta(ctx context.Context, in domain.ReceivableDeltaInput) (domain.ReceivableDeltaResult, error) {
	tc, err := requireTenant(ctx)
	if err != nil {
		return domain.ReceivableDeltaResult{}, err
	}
	if strings.TrimSpace(in.IdempotencyKey) == "" {
		in.IdempotencyKey = strings.TrimSpace(tc.IdempotencyKey)
	}
	validated, err := domain.ValidateReceivableDelta(in)
	if err != nil {
		return domain.ReceivableDeltaResult{}, err
	}
	enforceCreditLimit := licensegate.HasFeature(ctx, "cartera_cxc", "cupo_credito_control")
	return s.repo.ApplyReceivableDelta(ctx, tc.DBName, validated, enforceCreditLimit)
}
