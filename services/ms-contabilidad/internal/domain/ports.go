package domain

import "context"

type Repository interface {
	GetAll(ctx context.Context, dbName string) (*AllState, error)
	CreatePucAccount(ctx context.Context, dbName, idemKey string, in CreatePucAccountInput) (*PucAccount, error)
	CreateVoucher(ctx context.Context, dbName, idemKey string, in CreateVoucherInput) (*AccountingVoucher, error)
}
