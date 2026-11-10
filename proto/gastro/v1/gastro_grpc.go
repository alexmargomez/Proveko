package gastrov1

import (
	"context"

	_ "github.com/alexmargomez/proveko/proto"
	"google.golang.org/grpc"
)

type ClearTableEvent struct {
	TableID       string `json:"table_id"`
	InvoiceNumber string `json:"invoice_number"`
}

type ClearTableResponse struct {
	Ok bool `json:"ok"`
}

type GastroServiceServer interface {
	ClearInvoicedTable(context.Context, *ClearTableEvent) (*ClearTableResponse, error)
}

type GastroServiceClient interface {
	ClearInvoicedTable(ctx context.Context, in *ClearTableEvent, opts ...grpc.CallOption) (*ClearTableResponse, error)
}

type gastroServiceClient struct{ cc grpc.ClientConnInterface }

func NewGastroServiceClient(cc grpc.ClientConnInterface) GastroServiceClient {
	return &gastroServiceClient{cc: cc}
}

func (c *gastroServiceClient) ClearInvoicedTable(ctx context.Context, in *ClearTableEvent, opts ...grpc.CallOption) (*ClearTableResponse, error) {
	out := new(ClearTableResponse)
	if err := c.cc.Invoke(ctx, "/proveko.gastro.v1.GastroService/ClearInvoicedTable", in, out, opts...); err != nil {
		return nil, err
	}
	return out, nil
}

func RegisterGastroServiceServer(s grpc.ServiceRegistrar, srv GastroServiceServer) {
	s.RegisterService(&GastroService_ServiceDesc, srv)
}

func _GastroService_ClearInvoicedTable_Handler(srv any, ctx context.Context, dec func(any) error, interceptor grpc.UnaryServerInterceptor) (any, error) {
	in := new(ClearTableEvent)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(GastroServiceServer).ClearInvoicedTable(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/proveko.gastro.v1.GastroService/ClearInvoicedTable"}
	handler := func(ctx context.Context, req any) (any, error) {
		return srv.(GastroServiceServer).ClearInvoicedTable(ctx, req.(*ClearTableEvent))
	}
	return interceptor(ctx, in, info, handler)
}

var GastroService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "proveko.gastro.v1.GastroService",
	HandlerType: (*GastroServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{MethodName: "ClearInvoicedTable", Handler: _GastroService_ClearInvoicedTable_Handler},
	},
	Streams: []grpc.StreamDesc{},
}
