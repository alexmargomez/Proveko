package grpcserver

import "ms-core/backend/provisioning"

type LicensingEndpoint struct {
	Registry *provisioning.Registry
}

func New(reg *provisioning.Registry) *LicensingEndpoint {
	return &LicensingEndpoint{Registry: reg}
}
