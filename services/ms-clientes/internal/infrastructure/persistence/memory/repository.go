package memory

import (
	"context"
	"strings"
	"sync"
	"time"

	"ms-clientes/internal/platform/apperr"
	"ms-clientes/internal/platform/seqmem"
	"ms-clientes/internal/domain"
)

type tenantStore struct {
	tariffs       []domain.Tariff
	contracts     []domain.Contract
	customers     []domain.Customer
	receivables   []domain.Receivable
	idemCustomers map[string]domain.Customer
	idemTariffs   map[string]domain.Tariff
	idemContracts map[string]domain.Contract
	idemAbonos    map[string]domain.Receivable
	idemDeltas    map[string]domain.ReceivableDeltaResult
}

type Repository struct {
	mu      sync.Mutex
	seq     *seqmem.MemoryGenerator
	tenants map[string]*tenantStore
}

var _ domain.Repository = (*Repository)(nil)

func NewRepository() *Repository {
	return &Repository{
		seq:     seqmem.NewMemory(),
		tenants: make(map[string]*tenantStore),
	}
}

func (r *Repository) ensureSeeded(dbName string) *tenantStore {
	if st, ok := r.tenants[dbName]; ok {
		return st
	}
	seed := domain.InitialSeedBundle(time.Now())

	tariffs := make([]domain.Tariff, len(seed.Tariffs))
	for i, t := range seed.Tariffs {
		tariffs[i] = t.Clone()
	}
	contracts := make([]domain.Contract, len(seed.Contracts))
	for i, c := range seed.Contracts {
		contracts[i] = c.Clone()
	}
	customers := make([]domain.Customer, len(seed.Customers))
	for i, c := range seed.Customers {
		customers[i] = c.Clone()
	}
	receivables := make([]domain.Receivable, len(seed.Receivables))
	for i, rec := range seed.Receivables {
		receivables[i] = rec.Clone()
	}

	st := &tenantStore{
		tariffs:       tariffs,
		contracts:     contracts,
		customers:     customers,
		receivables:   receivables,
		idemCustomers: make(map[string]domain.Customer),
		idemTariffs:   make(map[string]domain.Tariff),
		idemContracts: make(map[string]domain.Contract),
		idemAbonos:    make(map[string]domain.Receivable),
		idemDeltas:    make(map[string]domain.ReceivableDeltaResult),
	}
	r.tenants[dbName] = st
	return st
}

func (r *Repository) GetAll(_ context.Context, dbName string) (domain.DirectorySnapshot, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)

	customers := make([]domain.Customer, len(st.customers))
	for i, c := range st.customers {
		customers[i] = c.Clone()
	}
	contracts := make([]domain.Contract, len(st.contracts))
	for i, c := range st.contracts {
		contracts[i] = c.Clone()
	}
	tariffs := make([]domain.Tariff, len(st.tariffs))
	for i, t := range st.tariffs {
		tariffs[i] = t.Clone()
	}
	pending := make([]domain.Receivable, 0, len(st.receivables))
	for _, rec := range st.receivables {
		if rec.PendingBalance > 0 {
			pending = append(pending, rec.Clone())
		}
	}

	return domain.DirectorySnapshot{
		NextCustomerCode: r.seq.Peek(dbName, "CLI", domain.BaseCustomerSeq),
		NextContractCode: r.seq.Peek(dbName, "CNV", domain.BaseContractSeq),
		NextTariffCode:   r.seq.Peek(dbName, "TRF", domain.BaseTariffSeq),
		Customers:        customers,
		Contracts:        contracts,
		Tariffs:          tariffs,
		PendingInvoices:  pending,
	}, nil
}

func (r *Repository) CreateCustomer(_ context.Context, dbName, idemKey string, in domain.CreateCustomerInput) (domain.Customer, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)
	cleanIdem := strings.TrimSpace(idemKey)
	if cleanIdem != "" {
		if cached, ok := st.idemCustomers[cleanIdem]; ok {
			return cached.Clone(), nil
		}
	}

	trimmedNit := strings.TrimSpace(in.Nit)
	for _, existing := range st.customers {
		if strings.EqualFold(existing.Nit, trimmedNit) {
			return domain.Customer{}, apperr.Conflict("Ya existe un cliente registrado con ese NIT o documento")
		}
	}

	var resolvedContract *domain.Contract
	if cntID := strings.TrimSpace(in.ContractID); cntID != "" {
		for i := range st.contracts {
			if st.contracts[i].ID == cntID {
				cp := st.contracts[i].Clone()
				resolvedContract = &cp
				break
			}
		}
		if resolvedContract == nil {
			return domain.Customer{}, apperr.NotFound("El contrato comercial seleccionado no existe")
		}
	}

	var resolvedTariff *domain.Tariff
	tariffID := strings.TrimSpace(in.TariffID)
	if tariffID != "" {
		for i := range st.tariffs {
			if st.tariffs[i].ID == tariffID {
				cp := st.tariffs[i].Clone()
				resolvedTariff = &cp
				break
			}
		}
		if resolvedTariff == nil {
			return domain.Customer{}, apperr.NotFound("La tarifa comercial seleccionada no existe")
		}
	} else if resolvedContract != nil && resolvedContract.TariffID != "" {
		for i := range st.tariffs {
			if st.tariffs[i].ID == resolvedContract.TariffID {
				cp := st.tariffs[i].Clone()
				resolvedTariff = &cp
				break
			}
		}
	}

	if _, err := domain.BuildCustomer("CLI-TMP", in, resolvedContract, resolvedTariff); err != nil {
		return domain.Customer{}, err
	}

	code := r.seq.Next(dbName, "CLI", domain.BaseCustomerSeq)
	created, err := domain.BuildCustomer(code, in, resolvedContract, resolvedTariff)
	if err != nil {
		return domain.Customer{}, err
	}

	st.customers = append([]domain.Customer{created.Clone()}, st.customers...)
	if cleanIdem != "" {
		st.idemCustomers[cleanIdem] = created.Clone()
	}
	return created.Clone(), nil
}

func (r *Repository) DeleteCustomer(_ context.Context, dbName, customerID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)
	cleanID := strings.TrimSpace(customerID)

	idx := -1
	for i := range st.customers {
		if st.customers[i].ID == cleanID {
			idx = i
			break
		}
	}
	if idx < 0 {
		return apperr.NotFound("Cliente no encontrado")
	}
	if st.customers[idx].CurrentDebt > 0 {
		return apperr.Conflict("No es posible eliminar un cliente con saldo pendiente en cartera")
	}
	for _, rec := range st.receivables {
		if rec.CustomerID == cleanID && rec.PendingBalance > 0 {
			return apperr.Conflict("No es posible eliminar un cliente con facturas pendientes por cobrar")
		}
	}

	for i := range st.receivables {
		if st.receivables[i].CustomerID == cleanID {
			st.receivables[i].CustomerID = ""
		}
	}

	st.customers = append(st.customers[:idx], st.customers[idx+1:]...)
	return nil
}

func (r *Repository) CreateTariff(_ context.Context, dbName, idemKey string, in domain.CreateTariffInput) (domain.Tariff, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)
	cleanIdem := strings.TrimSpace(idemKey)
	if cleanIdem != "" {
		if cached, ok := st.idemTariffs[cleanIdem]; ok {
			return cached.Clone(), nil
		}
	}

	if _, err := domain.BuildTariff("TRF-TMP", in); err != nil {
		return domain.Tariff{}, err
	}
	code := r.seq.Next(dbName, "TRF", domain.BaseTariffSeq)
	created, err := domain.BuildTariff(code, in)
	if err != nil {
		return domain.Tariff{}, err
	}

	st.tariffs = append(st.tariffs, created.Clone())
	if cleanIdem != "" {
		st.idemTariffs[cleanIdem] = created.Clone()
	}
	return created.Clone(), nil
}

func (r *Repository) CreateContract(_ context.Context, dbName, idemKey string, in domain.CreateContractInput) (domain.Contract, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)
	cleanIdem := strings.TrimSpace(idemKey)
	if cleanIdem != "" {
		if cached, ok := st.idemContracts[cleanIdem]; ok {
			return cached.Clone(), nil
		}
	}

	var resolvedTariff *domain.Tariff
	if trfID := strings.TrimSpace(in.TariffID); trfID != "" {
		for i := range st.tariffs {
			if st.tariffs[i].ID == trfID {
				cp := st.tariffs[i].Clone()
				resolvedTariff = &cp
				break
			}
		}
		if resolvedTariff == nil {
			return domain.Contract{}, apperr.NotFound("La tarifa asociada al contrato no existe")
		}
	}

	if _, err := domain.BuildContract("CNV-TMP", in, resolvedTariff); err != nil {
		return domain.Contract{}, err
	}
	code := r.seq.Next(dbName, "CNV", domain.BaseContractSeq)
	created, err := domain.BuildContract(code, in, resolvedTariff)
	if err != nil {
		return domain.Contract{}, err
	}

	st.contracts = append([]domain.Contract{created.Clone()}, st.contracts...)
	if cleanIdem != "" {
		st.idemContracts[cleanIdem] = created.Clone()
	}
	return created.Clone(), nil
}

func (r *Repository) RegisterAbono(_ context.Context, dbName, idemKey, invoiceID string, in domain.RegisterAbonoInput) (domain.Receivable, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)
	cleanIdem := strings.TrimSpace(idemKey)
	if cleanIdem != "" {
		if cached, ok := st.idemAbonos[cleanIdem]; ok {
			return cached.Clone(), nil
		}
	}

	cleanInvID := strings.TrimSpace(invoiceID)
	recIdx := -1
	for i := range st.receivables {
		if st.receivables[i].InvoiceID == cleanInvID {
			recIdx = i
			break
		}
	}
	if recIdx < 0 {
		return domain.Receivable{}, apperr.NotFound("Factura o cuenta por cobrar no encontrada")
	}

	custIdx := -1
	var custPtr *domain.Customer
	if st.receivables[recIdx].CustomerID != "" {
		for i := range st.customers {
			if st.customers[i].ID == st.receivables[recIdx].CustomerID {
				custIdx = i
				cp := st.customers[i].Clone()
				custPtr = &cp
				break
			}
		}
	}

	now := time.Now()
	if _, _, _, err := domain.ApplyAbono(st.receivables[recIdx], custPtr, "ABN-TMP", in, now); err != nil {
		return domain.Receivable{}, err
	}

	abonoCode := r.seq.Next(dbName, "ABN", domain.BaseAbonoSeq)
	updatedRec, updatedCust, _, err := domain.ApplyAbono(st.receivables[recIdx], custPtr, abonoCode, in, now)
	if err != nil {
		return domain.Receivable{}, err
	}

	st.receivables[recIdx] = updatedRec.Clone()
	if custIdx >= 0 && updatedCust != nil {
		st.customers[custIdx] = updatedCust.Clone()
	}
	if cleanIdem != "" {
		st.idemAbonos[cleanIdem] = updatedRec.Clone()
	}
	return updatedRec.Clone(), nil
}

func (r *Repository) ResolveCommercialTerms(_ context.Context, dbName, customerID, contractID string) (domain.CommercialTerms, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)

	var cust *domain.Customer
	if cleanCust := strings.TrimSpace(customerID); cleanCust != "" {
		for i := range st.customers {
			if st.customers[i].ID == cleanCust {
				cp := st.customers[i].Clone()
				cust = &cp
				break
			}
		}
		if cust == nil {
			return domain.CommercialTerms{}, apperr.NotFound("Cliente no encontrado")
		}
	}

	var cnt *domain.Contract
	effectiveCntID := strings.TrimSpace(contractID)
	if effectiveCntID != "" {
		for i := range st.contracts {
			if st.contracts[i].ID == effectiveCntID {
				cp := st.contracts[i].Clone()
				cnt = &cp
				break
			}
		}
		if cnt == nil {
			return domain.CommercialTerms{}, apperr.NotFound("Contrato comercial no encontrado")
		}
	} else if cust != nil && cust.ContractID != "" {
		for i := range st.contracts {
			if st.contracts[i].ID == cust.ContractID {
				cp := st.contracts[i].Clone()
				cnt = &cp
				break
			}
		}
	}

	var discountPct float64
	tariffID := ""
	if cnt != nil && cnt.TariffID != "" {
		tariffID = cnt.TariffID
	} else if cust != nil && cust.TariffID != "" {
		tariffID = cust.TariffID
	}
	if tariffID != "" {
		for i := range st.tariffs {
			if st.tariffs[i].ID == tariffID {
				discountPct = st.tariffs[i].DiscountPct
				break
			}
		}
	}

	var out domain.CommercialTerms
	if cust != nil {
		out.CustomerID = cust.ID
		out.CustomerName = cust.Name
		out.CustomerNit = cust.Nit
		out.CustomerPhone = cust.Phone
		out.CustomerAddress = cust.Address
	} else if cnt != nil {
		out.CustomerName = cnt.Name
		out.CustomerNit = cnt.EntityNit
	}
	if cnt != nil {
		out.ContractID = cnt.ID
		out.ContractCode = cnt.Code
	}
	out.DiscountPct = discountPct
	return out, nil
}

func (r *Repository) ApplyReceivableDelta(_ context.Context, dbName string, in domain.ReceivableDeltaInput, enforceCreditLimit bool) (domain.ReceivableDeltaResult, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	st := r.ensureSeeded(dbName)
	if in.IdempotencyKey != "" {
		if cached, ok := st.idemDeltas[in.IdempotencyKey]; ok {
			return cached, nil
		}
	}

	validated, err := domain.ValidateReceivableDelta(in)
	if err != nil {
		return domain.ReceivableDeltaResult{}, err
	}

	custIdx := -1
	if validated.CustomerID != "" {
		for i := range st.customers {
			if st.customers[i].ID == validated.CustomerID {
				custIdx = i
				break
			}
		}
		if custIdx < 0 {
			return domain.ReceivableDeltaResult{}, apperr.NotFound("Cliente no encontrado")
		}
		if err := domain.EvaluateCreditLimit(st.customers[custIdx], validated.DebtDelta, enforceCreditLimit); err != nil {
			return domain.ReceivableDeltaResult{}, err
		}
	}

	effectiveContractID := validated.ContractID
	if effectiveContractID == "" && validated.ContractConsumedDelta != 0 && custIdx >= 0 {
		effectiveContractID = st.customers[custIdx].ContractID
	}

	cntIdx := -1
	if effectiveContractID != "" {
		for i := range st.contracts {
			if st.contracts[i].ID == effectiveContractID {
				cntIdx = i
				break
			}
		}
		if cntIdx < 0 && validated.ContractID != "" {
			return domain.ReceivableDeltaResult{}, apperr.NotFound("Contrato comercial no encontrado")
		}
		if cntIdx >= 0 {
			if err := domain.EvaluateContractCeiling(st.contracts[cntIdx], validated.ContractConsumedDelta); err != nil {
				return domain.ReceivableDeltaResult{}, err
			}
		}
	}

	var res domain.ReceivableDeltaResult
	res.Ok = true

	if custIdx >= 0 {
		st.customers[custIdx].CurrentDebt = domain.ComputeUpdatedDebt(st.customers[custIdx].CurrentDebt, validated.DebtDelta)
		res.CustomerName = st.customers[custIdx].Name
		res.CustomerNit = st.customers[custIdx].Nit
		res.UpdatedDebt = st.customers[custIdx].CurrentDebt

		if validated.DebtDelta != 0 {
			lookupInvID := validated.InvoiceID
			if lookupInvID == "" {
				lookupInvID = validated.InvoiceNumber
			}
			recIdx := -1
			var existingRec *domain.Receivable
			if lookupInvID != "" {
				for i := range st.receivables {
					if st.receivables[i].InvoiceID == lookupInvID {
						recIdx = i
						cp := st.receivables[i].Clone()
						existingRec = &cp
						break
					}
				}
			}
			nextRec := domain.BuildOrUpdateReceivable(existingRec, st.customers[custIdx], validated, time.Now())
			if nextRec != nil {
				if recIdx >= 0 {
					st.receivables[recIdx] = nextRec.Clone()
				} else {
					st.receivables = append([]domain.Receivable{nextRec.Clone()}, st.receivables...)
				}
			}
		}
	} else if cntIdx >= 0 {
		res.CustomerName = st.contracts[cntIdx].Name
		res.CustomerNit = st.contracts[cntIdx].EntityNit
	}

	if cntIdx >= 0 && validated.ContractConsumedDelta != 0 {
		consumed, avail := domain.ComputeUpdatedContractBalances(
			st.contracts[cntIdx].BudgetCeiling,
			st.contracts[cntIdx].ConsumedAmount,
			validated.ContractConsumedDelta,
		)
		st.contracts[cntIdx].ConsumedAmount = consumed
		st.contracts[cntIdx].AvailableBalance = avail
	}

	if validated.IdempotencyKey != "" {
		st.idemDeltas[validated.IdempotencyKey] = res
	}
	return res, nil
}
