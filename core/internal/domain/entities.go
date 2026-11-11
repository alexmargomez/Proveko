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
	ID             string         `json:"id"`
	TenantID       string         `json:"tenantId"`
	CompanyName    string         `json:"companyName"`
	Nit            string         `json:"nit"`
	AdminUsername  string         `json:"adminUsername"`
	PasswordHash   string         `json:"-"`
	Role           string         `json:"-"`
	DBName         string         `json:"dbName"`
	SealedDSN      SealedEnvelope `json:"-"`
	BusinessPreset string         `json:"businessPreset"`
	Status           string         `json:"status"`
	ActiveServices   []string       `json:"activeServices"`
	ActiveModules    []string       `json:"activeModules"`
	ActiveSubmodules []string       `json:"activeSubmodules"`
	ActiveFeatures   []string       `json:"activeFeatures"`
	CreatedAt        string         `json:"createdAt"`
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
	AdminUsername  string   `json:"adminUsername"`
	AdminEmail     string   `json:"adminEmail"`
	Password       string   `json:"password"`
	BusinessPreset string   `json:"businessPreset"`
	Industry       string   `json:"industry"`
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
