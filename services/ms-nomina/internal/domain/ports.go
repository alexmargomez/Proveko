package domain

import "context"

type Repository interface {
	GetAll(ctx context.Context, dbName string) (*AllState, error)
	CreateEmployee(ctx context.Context, dbName, idemKey string, in CreateEmployeeInput) (*Employee, error)
	CreatePayroll(ctx context.Context, dbName, idemKey string, in CreatePayrollInput) (*PayrollSettlement, error)
}
