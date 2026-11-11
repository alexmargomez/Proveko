package domain

import "context"

type Repository interface {
	GetAll(ctx context.Context, dbName string) (DirectorySnapshot, error)
	CreateCustomer(ctx context.Context, dbName, idemKey string, in CreateCustomerInput) (Customer, error)
	DeleteCustomer(ctx context.Context, dbName, customerID string) error
	CreateTariff(ctx context.Context, dbName, idemKey string, in CreateTariffInput) (Tariff, error)
	CreateContract(ctx context.Context, dbName, idemKey string, in CreateContractInput) (Contract, error)
	RegisterAbono(ctx context.Context, dbName, idemKey, invoiceID string, in RegisterAbonoInput) (Receivable, error)
	ResolveCommercialTerms(ctx context.Context, dbName, customerID, contractID string) (CommercialTerms, error)
	ApplyReceivableDelta(ctx context.Context, dbName string, in ReceivableDeltaInput, enforceCreditLimit bool) (ReceivableDeltaResult, error)
}
