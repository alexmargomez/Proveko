package domain

type S2SContractSpec struct {
	ContractKey    string   `json:"contractKey"`
	TargetService  string   `json:"targetService"`
	Method         string   `json:"method"`
	GatewayPath    string   `json:"gatewayPath"`
	RequiredFields []string `json:"requiredFields"`
	Summary        string   `json:"summary"`
}

type PlatformStandard struct {
	Key         string `json:"key"`
	Description string `json:"description"`
}

type ValidationResult struct {
	Valid         bool     `json:"valid"`
	ContractKey   string   `json:"contractKey"`
	MissingFields []string `json:"missingFields,omitempty"`
}
