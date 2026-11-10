package workshopv1

import (
	"context"

	_ "github.com/alexmargomez/proveko/proto"
	"google.golang.org/grpc"
)

type WorkshopInvoiceEvent struct {
	WorkOrderID   string  `json:"work_order_id"`
	MechanicID    string  `json:"mechanic_id"`
	LaborGross    float64 `json:"labor_gross"`
	InvoiceNumber string  `json:"invoice_number"`
}

type WorkshopInvoiceResponse struct {
	Ok           bool   `json:"ok"`
	MechanicName string `json:"mechanic_name"`
}

type WorkshopServiceServer interface {
	RegisterInvoicedOrderAndCommission(context.Context, *WorkshopInvoiceEvent) (*WorkshopInvoiceResponse, error)
}

type WorkshopServiceClient interface {
	RegisterInvoicedOrderAndCommission(ctx context.Context, in *WorkshopInvoiceEvent, opts ...grpc.CallOption) (*WorkshopInvoiceResponse, error)
}

type workshopServiceClient struct{ cc grpc.ClientConnInterface }

func NewWorkshopServiceClient(cc grpc.ClientConnInterface) WorkshopServiceClient {
	return &workshopServiceClient{cc: cc}
}

func (c *workshopServiceClient) RegisterInvoicedOrderAndCommission(ctx context.Context, in *WorkshopInvoiceEvent, opts ...grpc.CallOption) (*WorkshopInvoiceResponse, error) {
	out := new(WorkshopInvoiceResponse)
	if err := c.cc.Invoke(ctx, "/proveko.workshop.v1.WorkshopService/RegisterInvoicedOrderAndCommission", in, out, opts...); err != nil {
		return nil, err
	}
	return out, nil
}

func RegisterWorkshopServiceServer(s grpc.ServiceRegistrar, srv WorkshopServiceServer) {
	s.RegisterService(&WorkshopService_ServiceDesc, srv)
}

func _WorkshopService_RegisterInvoicedOrderAndCommission_Handler(srv any, ctx context.Context, dec func(any) error, interceptor grpc.UnaryServerInterceptor) (any, error) {
	in := new(WorkshopInvoiceEvent)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(WorkshopServiceServer).RegisterInvoicedOrderAndCommission(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/proveko.workshop.v1.WorkshopService/RegisterInvoicedOrderAndCommission"}
	handler := func(ctx context.Context, req any) (any, error) {
		return srv.(WorkshopServiceServer).RegisterInvoicedOrderAndCommission(ctx, req.(*WorkshopInvoiceEvent))
	}
	return interceptor(ctx, in, info, handler)
}

var WorkshopService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "proveko.workshop.v1.WorkshopService",
	HandlerType: (*WorkshopServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{MethodName: "RegisterInvoicedOrderAndCommission", Handler: _WorkshopService_RegisterInvoicedOrderAndCommission_Handler},
	},
	Streams: []grpc.StreamDesc{},
}
