package memory

import (
	"context"
	"strings"
	"sync"
	"time"

	"ms-nomina/internal/platform/apperr"
	"ms-nomina/internal/platform/money"
	"ms-nomina/internal/platform/seqmem"
	"ms-nomina/internal/domain"
)

type tenantBucket struct {
	employees     []*domain.Employee
	payrolls      []*domain.PayrollSettlement
	idemEmployees map[string]*domain.Employee
	idemPayrolls  map[string]*domain.PayrollSettlement
}

type Repository struct {
	mu      sync.Mutex
	seq     *seqmem.MemoryGenerator
	buckets map[string]*tenantBucket
}

func NewRepository() *Repository {
	return &Repository{
		seq:     seqmem.NewMemory(),
		buckets: make(map[string]*tenantBucket),
	}
}

func (r *Repository) ensureSeededLocked(dbName string) *tenantBucket {
	if b, ok := r.buckets[dbName]; ok {
		return b
	}
	now := time.Now().UTC().Format("2006-01-02 15:04")
	ym := time.Now().UTC().Format("2006-01")

	empCode1 := r.seq.Next(dbName, domain.EmployeeSeqPrefix, domain.EmployeeSeqStart)
	empCode2 := r.seq.Next(dbName, domain.EmployeeSeqPrefix, domain.EmployeeSeqStart)
	nomCode1 := r.seq.Next(dbName, domain.PayrollSeqPrefix, domain.PayrollSeqStart)

	b := &tenantBucket{
		employees: []*domain.Employee{
			{
				ID:         "emp-demo-1",
				Code:       empCode1,
				Name:       "Laura Marcela Gómez",
				DocNumber:  "1032488910",
				Position:   "Coordinadora Administrativa",
				BaseSalary: 2450000,
				Phone:      "3157204419",
				Active:     true,
				CreatedAt:  now,
			},
			{
				ID:         "emp-demo-2",
				Code:       empCode2,
				Name:       "Carlos Andrés Medina",
				DocNumber:  "1019044812",
				Position:   "Líder de Operaciones y Logística",
				BaseSalary: 1950000,
				Phone:      "3114908821",
				Active:     true,
				CreatedAt:  now,
			},
		},
		payrolls: []*domain.PayrollSettlement{
			{
				ID:               nomCode1,
				Code:             nomCode1,
				EmployeeID:       "emp-demo-1",
				EmployeeCode:     empCode1,
				EmployeeName:     "Laura Marcela Gómez",
				EmployeeDoc:      "1032488910",
				EmployeePosition: "Coordinadora Administrativa",
				Period:           ym + " — Q1 (1 al 15)",
				BaseSalary:       1225000,
				Bonuses:          95000,
				Deductions:       98000,
				NetPay:           1222000,
				CreatedAt:        now,
			},
		},
		idemEmployees: make(map[string]*domain.Employee),
		idemPayrolls:  make(map[string]*domain.PayrollSettlement),
	}
	r.buckets[dbName] = b
	return b
}

func (r *Repository) GetAll(_ context.Context, dbName string) (*domain.AllState, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	employees := make([]*domain.Employee, len(b.employees))
	for i, emp := range b.employees {
		employees[i] = emp.Clone()
	}
	payrolls := make([]*domain.PayrollSettlement, len(b.payrolls))
	for i, pay := range b.payrolls {
		payrolls[i] = pay.Clone()
	}

	return &domain.AllState{
		NextCode:         r.seq.Peek(dbName, domain.PayrollSeqPrefix, domain.PayrollSeqStart),
		NextEmployeeCode: r.seq.Peek(dbName, domain.EmployeeSeqPrefix, domain.EmployeeSeqStart),
		Employees:        employees,
		Payrolls:         payrolls,
	}, nil
}

func (r *Repository) CreateEmployee(_ context.Context, dbName, idemKey string, in domain.CreateEmployeeInput) (*domain.Employee, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	if idemKey != "" {
		if cached, ok := b.idemEmployees[idemKey]; ok {
			return cached.Clone(), nil
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	if _, err := domain.NewEmployee("tmp", "TMP", in, now); err != nil {
		return nil, err
	}

	docNorm := strings.TrimSpace(in.DocNumber)
	for _, existing := range b.employees {
		if strings.EqualFold(existing.DocNumber, docNorm) {
			return nil, apperr.Conflict("Ya existe un colaborador registrado con ese número de documento")
		}
	}

	code := r.seq.Next(dbName, domain.EmployeeSeqPrefix, domain.EmployeeSeqStart)
	emp, err := domain.NewEmployee(money.NewID("emp"), code, in, now)
	if err != nil {
		return nil, err
	}

	b.employees = append([]*domain.Employee{emp.Clone()}, b.employees...)
	if idemKey != "" {
		b.idemEmployees[idemKey] = emp.Clone()
	}
	return emp.Clone(), nil
}

func (r *Repository) CreatePayroll(_ context.Context, dbName, idemKey string, in domain.CreatePayrollInput) (*domain.PayrollSettlement, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	b := r.ensureSeededLocked(dbName)
	if idemKey != "" {
		if cached, ok := b.idemPayrolls[idemKey]; ok {
			return cached.Clone(), nil
		}
	}

	empID := in.ResolvedEmployeeID()
	var matchedEmp *domain.Employee
	for _, emp := range b.employees {
		if emp.ID == empID || emp.Code == empID {
			matchedEmp = emp
			break
		}
	}
	if matchedEmp == nil {
		return nil, apperr.NotFound("Colaborador no encontrado en nómina")
	}

	periodNorm := strings.TrimSpace(in.Period)
	for _, existing := range b.payrolls {
		if existing.EmployeeID == matchedEmp.ID && strings.EqualFold(existing.Period, periodNorm) {
			return nil, apperr.Conflict("El colaborador ya fue liquidado en el periodo seleccionado")
		}
	}

	now := time.Now().UTC().Format("2006-01-02 15:04")
	if _, err := domain.NewPayrollSettlement("TMP", matchedEmp, in, now); err != nil {
		return nil, err
	}

	code := r.seq.Next(dbName, domain.PayrollSeqPrefix, domain.PayrollSeqStart)
	settlement, err := domain.NewPayrollSettlement(code, matchedEmp, in, now)
	if err != nil {
		return nil, err
	}

	b.payrolls = append([]*domain.PayrollSettlement{settlement.Clone()}, b.payrolls...)
	if idemKey != "" {
		b.idemPayrolls[idemKey] = settlement.Clone()
	}
	return settlement.Clone(), nil
}
