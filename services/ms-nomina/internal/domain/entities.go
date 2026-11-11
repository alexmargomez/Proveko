package domain

import (
	"strings"

	"ms-nomina/internal/platform/apperr"
	"ms-nomina/internal/platform/money"
)

const (
	SchemaName       = "payroll"
	ModuleKeyPayroll = "liquidacion_nomina"

	EmployeeSeqPrefix = "EMP"
	EmployeeSeqStart  = 100
	PayrollSeqPrefix  = "NOM"
	PayrollSeqStart   = 300

	DefaultPosition = "Colaborador Operativo"
)

type Employee struct {
	ID         string  `json:"id"`
	Code       string  `json:"code"`
	Name       string  `json:"name"`
	DocNumber  string  `json:"docNumber"`
	Position   string  `json:"position"`
	BaseSalary float64 `json:"baseSalary"`
	Phone      string  `json:"phone"`
	Active     bool    `json:"active"`
	CreatedAt  string  `json:"createdAt"`
}

func (e *Employee) Clone() *Employee {
	if e == nil {
		return nil
	}
	cp := *e
	return &cp
}

type PayrollSettlement struct {
	ID               string  `json:"id"`
	Code             string  `json:"code"`
	EmployeeID       string  `json:"employeeId"`
	EmployeeCode     string  `json:"employeeCode"`
	EmployeeName     string  `json:"employeeName"`
	EmployeeDoc      string  `json:"employeeDoc"`
	EmployeePosition string  `json:"employeePosition"`
	Period           string  `json:"period"`
	BaseSalary       float64 `json:"baseSalary"`
	Bonuses          float64 `json:"bonuses"`
	Deductions       float64 `json:"deductions"`
	NetPay           float64 `json:"netPay"`
	CreatedAt        string  `json:"createdAt"`
}

func (p *PayrollSettlement) Clone() *PayrollSettlement {
	if p == nil {
		return nil
	}
	cp := *p
	return &cp
}

type CreateEmployeeInput struct {
	Name       string  `json:"name"`
	DocNumber  string  `json:"docNumber"`
	Position   string  `json:"position"`
	Specialty  string  `json:"specialty"`
	BaseSalary float64 `json:"baseSalary"`
	Phone      string  `json:"phone"`
}

func (in CreateEmployeeInput) ResolvedPosition() string {
	if p := strings.TrimSpace(in.Position); p != "" {
		return p
	}
	if s := strings.TrimSpace(in.Specialty); s != "" {
		return s
	}
	return DefaultPosition
}

type CreatePayrollInput struct {
	EmployeeID string  `json:"employeeId"`
	WorkerID   string  `json:"workerId"`
	Period     string  `json:"period"`
	BaseSalary float64 `json:"baseSalary"`
	Bonuses    float64 `json:"bonuses"`
	Deductions float64 `json:"deductions"`
}

func (in CreatePayrollInput) ResolvedEmployeeID() string {
	if id := strings.TrimSpace(in.EmployeeID); id != "" {
		return id
	}
	return strings.TrimSpace(in.WorkerID)
}

type AllState struct {
	NextCode         string               `json:"nextCode"`
	NextEmployeeCode string               `json:"nextEmployeeCode"`
	Employees        []*Employee          `json:"employees"`
	Payrolls         []*PayrollSettlement `json:"payrolls"`
}

func NewEmployee(id, code string, in CreateEmployeeInput, createdAt string) (*Employee, error) {
	name := strings.TrimSpace(in.Name)
	doc := strings.TrimSpace(in.DocNumber)
	if name == "" || doc == "" {
		return nil, apperr.Validation("El nombre completo y el número de documento del colaborador son obligatorios")
	}
	if !money.IsFinite(in.BaseSalary) || in.BaseSalary < 0 {
		return nil, apperr.Validation("El salario base contractual no puede ser negativo")
	}
	base := money.RoundCents(in.BaseSalary)
	if base == 0 {
		base = 1423500
	}
	return &Employee{
		ID:         id,
		Code:       code,
		Name:       name,
		DocNumber:  doc,
		Position:   in.ResolvedPosition(),
		BaseSalary: base,
		Phone:      strings.TrimSpace(in.Phone),
		Active:     true,
		CreatedAt:  createdAt,
	}, nil
}

func ValidatePayrollAmounts(baseSalary, bonuses, deductions float64) (base, bon, ded, net float64, err error) {
	if !money.IsFinite(baseSalary) || baseSalary <= 0 {
		return 0, 0, 0, 0, apperr.Validation("El salario base de liquidación debe ser mayor a cero")
	}
	if !money.IsFinite(bonuses) || bonuses < 0 {
		return 0, 0, 0, 0, apperr.Validation("Las bonificaciones no pueden ser negativas")
	}
	if !money.IsFinite(deductions) || deductions < 0 {
		return 0, 0, 0, 0, apperr.Validation("Las deducciones no pueden ser negativas")
	}
	base = money.RoundCents(baseSalary)
	bon = money.RoundCents(bonuses)
	ded = money.RoundCents(deductions)
	net = money.RoundCents(base + bon - ded)
	if !money.IsFinite(net) || net < 0 {
		return 0, 0, 0, 0, apperr.Validation("Las deducciones no pueden superar el total devengado")
	}
	return base, bon, ded, net, nil
}

func NewPayrollSettlement(code string, emp *Employee, in CreatePayrollInput, createdAt string) (*PayrollSettlement, error) {
	if emp == nil {
		return nil, apperr.NotFound("Colaborador no encontrado en nómina")
	}
	period := strings.TrimSpace(in.Period)
	if period == "" {
		return nil, apperr.Validation("El periodo de liquidación es obligatorio")
	}
	base, bon, ded, net, err := ValidatePayrollAmounts(in.BaseSalary, in.Bonuses, in.Deductions)
	if err != nil {
		return nil, err
	}
	return &PayrollSettlement{
		ID:               code,
		Code:             code,
		EmployeeID:       emp.ID,
		EmployeeCode:     emp.Code,
		EmployeeName:     emp.Name,
		EmployeeDoc:      emp.DocNumber,
		EmployeePosition: emp.Position,
		Period:           period,
		BaseSalary:       base,
		Bonuses:          bon,
		Deductions:       ded,
		NetPay:           net,
		CreatedAt:        createdAt,
	}, nil
}
