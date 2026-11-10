package customersv1

import (
	"context"

	_ "github.com/alexmargomez/proveko/proto"
	"google.golang.org/grpc"
)

type ReceivableDeltaRequest struct {
	CustomerID            string  `json:"customer_id"`
	ContractID            string  `json:"contract_id"`
	DebtDelta             float64 `json:"debt_delta"`
	ContractConsumedDelta float64 `json:"contract_consumed_delta"`
}

type ReceivableDeltaResponse struct {
	Ok           bool    `json:"ok"`
	CustomerName string  `json:"customer_name"`
	CustomerNit  string  `json:"customer_nit"`
	UpdatedDebt  float64 `json:"updated_debt"`
}

type CustomerServiceServer interface {
	ApplyAccountReceivableDelta(context.Context, *ReceivableDeltaRequest) (*ReceivableDeltaResponse, error)
}

type CustomerServiceClient interface {
	ApplyAccountReceivableDelta(ctx context.Context, in *ReceivableDeltaRequest, opts ...grpc.CallOption) (*ReceivableDeltaResponse, error)
}

type customerServiceClient struct{ cc grpc.ClientConnInterface }

func NewCustomerServiceClient(cc grpc.ClientConnInterface) CustomerServiceClient {
	return &customerServiceClient{cc: cc}
}

func (c *customerServiceClient) ApplyAccountReceivableDelta(ctx context.Context, in *ReceivableDeltaRequest, opts ...grpc.CallOption) (*ReceivableDeltaResponse, error) {
	out := new(ReceivableDeltaResponse)
	if err := c.cc.Invoke(ctx, "/proveko.customers.v1.CustomerService/ApplyAccountReceivableDelta", in, out, opts...); err != nil {
		return nil, err
	}
	return out, nil
}

func RegisterCustomerServiceServer(s grpc.ServiceRegistrar, srv CustomerServiceServer) {
	s.RegisterService(&CustomerService_ServiceDesc, srv)
}

func _CustomerService_ApplyAccountReceivableDelta_Handler(srv any, ctx context.Context, dec func(any) error, interceptor grpc.UnaryServerInterceptor) (any, error) {
	in := new(ReceivableDeltaRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(CustomerServiceServer).ApplyAccountReceivableDelta(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/proveko.customers.v1.CustomerService/ApplyAccountReceivableDelta"}
	handler := func(ctx context.Context, req any) (any, error) {
		return srv.(CustomerServiceServer).ApplyAccountReceivableDelta(ctx, req.(*ReceivableDeltaRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var CustomerService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "proveko.customers.v1.CustomerService",
	HandlerType: (*CustomerServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{MethodName: "ApplyAccountReceivableDelta", Handler: _CustomerService_ApplyAccountReceivableDelta_Handler},
	},
	Streams: []grpc.StreamDesc{},
}
