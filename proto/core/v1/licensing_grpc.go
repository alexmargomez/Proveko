package corev1

import (
	"context"

	_ "github.com/alexmargomez/proveko/proto"
	"google.golang.org/grpc"
)

type ResolveTenantRequest struct {
	TenantID string `json:"tenant_id"`
}

type TenantLicenseContext struct {
	TenantID       string   `json:"tenant_id"`
	CompanyName    string   `json:"company_name"`
	DBName         string   `json:"db_name"`
	ActiveServices []string `json:"active_services"`
	ActiveModules  []string `json:"active_modules"`
	ActiveFeatures []string `json:"active_features"`
}

type LicensingServiceServer interface {
	ResolveTenantContext(context.Context, *ResolveTenantRequest) (*TenantLicenseContext, error)
}

type LicensingServiceClient interface {
	ResolveTenantContext(ctx context.Context, in *ResolveTenantRequest, opts ...grpc.CallOption) (*TenantLicenseContext, error)
}

type licensingServiceClient struct{ cc grpc.ClientConnInterface }

func NewLicensingServiceClient(cc grpc.ClientConnInterface) LicensingServiceClient {
	return &licensingServiceClient{cc: cc}
}

func (c *licensingServiceClient) ResolveTenantContext(ctx context.Context, in *ResolveTenantRequest, opts ...grpc.CallOption) (*TenantLicenseContext, error) {
	out := new(TenantLicenseContext)
	err := c.cc.Invoke(ctx, "/proveko.core.v1.LicensingService/ResolveTenantContext", in, out, opts...)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func RegisterLicensingServiceServer(s grpc.ServiceRegistrar, srv LicensingServiceServer) {
	s.RegisterService(&LicensingService_ServiceDesc, srv)
}

func _LicensingService_ResolveTenantContext_Handler(srv any, ctx context.Context, dec func(any) error, interceptor grpc.UnaryServerInterceptor) (any, error) {
	in := new(ResolveTenantRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(LicensingServiceServer).ResolveTenantContext(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/proveko.core.v1.LicensingService/ResolveTenantContext"}
	handler := func(ctx context.Context, req any) (any, error) {
		return srv.(LicensingServiceServer).ResolveTenantContext(ctx, req.(*ResolveTenantRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var LicensingService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "proveko.core.v1.LicensingService",
	HandlerType: (*LicensingServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{MethodName: "ResolveTenantContext", Handler: _LicensingService_ResolveTenantContext_Handler},
	},
	Streams: []grpc.StreamDesc{},
}
