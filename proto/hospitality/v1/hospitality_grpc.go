package hospitalityv1

import (
	"context"

	"google.golang.org/grpc"
	_ "platform-contracts"
)

type RoomCheckoutEvent struct {
	IdempotencyKey string `json:"idempotency_key"`
	RoomID         string `json:"room_id"`
	InvoiceNumber  string `json:"invoice_number"`
}

type RoomCheckoutResponse struct {
	Ok         bool   `json:"ok"`
	RoomNumber string `json:"room_number"`
}

type HospitalityServiceServer interface {
	CompleteRoomCheckout(context.Context, *RoomCheckoutEvent) (*RoomCheckoutResponse, error)
}

type HospitalityServiceClient interface {
	CompleteRoomCheckout(ctx context.Context, in *RoomCheckoutEvent, opts ...grpc.CallOption) (*RoomCheckoutResponse, error)
}

type hospitalityServiceClient struct{ cc grpc.ClientConnInterface }

func NewHospitalityServiceClient(cc grpc.ClientConnInterface) HospitalityServiceClient {
	return &hospitalityServiceClient{cc: cc}
}

func (c *hospitalityServiceClient) CompleteRoomCheckout(ctx context.Context, in *RoomCheckoutEvent, opts ...grpc.CallOption) (*RoomCheckoutResponse, error) {
	out := new(RoomCheckoutResponse)
	if err := c.cc.Invoke(ctx, "/proveko.hospitality.v1.HospitalityService/CompleteRoomCheckout", in, out, opts...); err != nil {
		return nil, err
	}
	return out, nil
}

func RegisterHospitalityServiceServer(s grpc.ServiceRegistrar, srv HospitalityServiceServer) {
	s.RegisterService(&HospitalityService_ServiceDesc, srv)
}

func _HospitalityService_CompleteRoomCheckout_Handler(srv any, ctx context.Context, dec func(any) error, interceptor grpc.UnaryServerInterceptor) (any, error) {
	in := new(RoomCheckoutEvent)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(HospitalityServiceServer).CompleteRoomCheckout(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/proveko.hospitality.v1.HospitalityService/CompleteRoomCheckout"}
	handler := func(ctx context.Context, req any) (any, error) {
		return srv.(HospitalityServiceServer).CompleteRoomCheckout(ctx, req.(*RoomCheckoutEvent))
	}
	return interceptor(ctx, in, info, handler)
}

var HospitalityService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "proveko.hospitality.v1.HospitalityService",
	HandlerType: (*HospitalityServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{MethodName: "CompleteRoomCheckout", Handler: _HospitalityService_CompleteRoomCheckout_Handler},
	},
	Streams: []grpc.StreamDesc{},
}
