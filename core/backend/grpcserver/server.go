package grpcserver

import (
	"context"

	"github.com/alexmargomez/proveko/core/backend/provisioning"
	corev1 "github.com/alexmargomez/proveko/proto/core/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type Server struct {
	reg *provisioning.Registry
}

func New(reg *provisioning.Registry) *Server {
	return &Server{reg: reg}
}

func (s *Server) ResolveTenantContext(_ context.Context, req *corev1.ResolveTenantRequest) (*corev1.TenantLicenseContext, error) {
	rec, ok := s.reg.Get(req.TenantID)
	if !ok {
		return nil, status.Errorf(codes.NotFound, "tenant not found: %s", req.TenantID)
	}
	return &corev1.TenantLicenseContext{
		TenantID:       rec.TenantID,
		CompanyName:    rec.CompanyName,
		DBName:         rec.DBName,
		ActiveServices: rec.ActiveServices,
		ActiveModules:  rec.ActiveModules,
		ActiveFeatures: rec.ActiveFeatures,
	}, nil
}
