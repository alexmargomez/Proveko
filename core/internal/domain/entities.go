package domain

const (
	RoleSuperAdmin = "superadmin"
	RoleCliente    = "cliente"
)

type SealedEnvelope struct {
	KEKID      string `json:"kek_id"`
	WrappedDEK string `json:"wrapped_dek"`
	Ciphertext string `json:"ciphertext"`
}

type Tenant struct {
	ID               string         `json:"id"`
	TenantID         string         `json:"tenantId"`
	CompanyName      string         `json:"companyName"`
	Nit              string         `json:"nit"`
	AdminUsername    string         `json:"adminUsername"`
	PasswordHash     string         `json:"-"`
	Role             string         `json:"-"`
	DBName           string         `json:"dbName"`
	SealedDSN        SealedEnvelope `json:"-"`
	BusinessPreset   string         `json:"businessPreset"`
	PaymentStatus      string         `json:"paymentStatus"`
	MonthlyCop         int64          `json:"monthlyCop"`
	CustomMonthlyCop   int64          `json:"customMonthlyCop,omitempty"`
	MaxUsersAllowed    int            `json:"maxUsersAllowed"`
	SessionVersion     int            `json:"sessionVersion"`
	MaintenanceMode    bool           `json:"maintenanceMode"`
	MaintenanceMessage string         `json:"maintenanceMessage,omitempty"`
	IsDemo             bool           `json:"isDemo"`
	Status             string         `json:"status"`
	ActiveServices     []string       `json:"activeServices"`
	ActiveModules      []string       `json:"activeModules"`
	ActiveSubmodules   []string       `json:"activeSubmodules"`
	ActiveFeatures     []string       `json:"activeFeatures"`
	CreatedAt          string         `json:"createdAt"`
}

func (t *Tenant) Clone() *Tenant {
	if t == nil {
		return nil
	}
	cp := *t
	if cp.ID == "" {
		cp.ID = cp.TenantID
	}
	if cp.TenantID == "" {
		cp.TenantID = cp.ID
	}
	if cp.PaymentStatus == "" {
		cp.PaymentStatus = "ACTIVA_VERIFICADA"
	}
	if cp.MaxUsersAllowed <= 0 {
		cp.MaxUsersAllowed = 15
	}
	if cp.SessionVersion <= 0 {
		cp.SessionVersion = 1
	}
	cp.ActiveServices = cloneStrings(t.ActiveServices)
	cp.ActiveModules = cloneStrings(t.ActiveModules)
	cp.ActiveSubmodules = cloneStrings(t.ActiveSubmodules)
	cp.ActiveFeatures = cloneStrings(t.ActiveFeatures)
	return &cp
}

type CreateTenantInput struct {
	TenantID       string   `json:"tenantId"`
	CompanyName    string   `json:"companyName"`
	Nit            string   `json:"nit"`
	AdminFullName  string   `json:"adminFullName"`
	AdminUsername  string   `json:"adminUsername"`
	AdminEmail     string   `json:"adminEmail"`
	Password       string   `json:"password"`
	BusinessPreset string   `json:"businessPreset"`
	Industry       string   `json:"industry"`
	PaymentMethod  string   `json:"paymentMethod"`
	IsDemo         bool     `json:"-"`
	Services       []string `json:"activeServices"`
	Modules        []string `json:"activeModules"`
	Submodules     []string `json:"activeSubmodules"`
	Features       []string `json:"activeFeatures"`
}

func cloneStrings(src []string) []string {
	if src == nil {
		return []string{}
	}
	out := make([]string, len(src))
	copy(out, src)
	return out
}
