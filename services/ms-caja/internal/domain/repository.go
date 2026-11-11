package domain

import "context"

type Repository interface {
	GetSnapshot(ctx context.Context, dbName string) (TreasurySnapshot, error)
	CreateIncome(ctx context.Context, dbName, idemKey string, in CreateIncomeInput, actor string) (CashIncome, error)
	CreateExpense(ctx context.Context, dbName, idemKey string, in CreateExpenseInput, actor string) (Expense, error)
	DeleteExpense(ctx context.Context, dbName, expenseID string) error
	CreateBankMovement(ctx context.Context, dbName, idemKey string, in CreateBankMovementInput, actor string) (BankMovement, error)
}
