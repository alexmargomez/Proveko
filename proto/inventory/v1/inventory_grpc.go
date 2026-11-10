package inventoryv1

import (
	"context"

	_ "github.com/alexmargomez/proveko/proto"
	"google.golang.org/grpc"
)

type StockDeltaItem struct {
	ProductID    string  `json:"product_id"`
	Quantity     float64 `json:"quantity"`
	ReferenceDoc string  `json:"reference_doc"`
	Actor        string  `json:"actor"`
}

type DeductStockRequest struct {
	Items []StockDeltaItem `json:"items"`
}

type DeductStockResponse struct {
	Ok             bool  `json:"ok"`
	ProcessedCount int32 `json:"processed_count"`
}

type InventoryServiceServer interface {
	DeductStock(context.Context, *DeductStockRequest) (*DeductStockResponse, error)
}

type InventoryServiceClient interface {
	DeductStock(ctx context.Context, in *DeductStockRequest, opts ...grpc.CallOption) (*DeductStockResponse, error)
}

type inventoryServiceClient struct{ cc grpc.ClientConnInterface }

func NewInventoryServiceClient(cc grpc.ClientConnInterface) InventoryServiceClient {
	return &inventoryServiceClient{cc: cc}
}

func (c *inventoryServiceClient) DeductStock(ctx context.Context, in *DeductStockRequest, opts ...grpc.CallOption) (*DeductStockResponse, error) {
	out := new(DeductStockResponse)
	if err := c.cc.Invoke(ctx, "/proveko.inventory.v1.InventoryService/DeductStock", in, out, opts...); err != nil {
		return nil, err
	}
	return out, nil
}

func RegisterInventoryServiceServer(s grpc.ServiceRegistrar, srv InventoryServiceServer) {
	s.RegisterService(&InventoryService_ServiceDesc, srv)
}

func _InventoryService_DeductStock_Handler(srv any, ctx context.Context, dec func(any) error, interceptor grpc.UnaryServerInterceptor) (any, error) {
	in := new(DeductStockRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InventoryServiceServer).DeductStock(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/proveko.inventory.v1.InventoryService/DeductStock"}
	handler := func(ctx context.Context, req any) (any, error) {
		return srv.(InventoryServiceServer).DeductStock(ctx, req.(*DeductStockRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var InventoryService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "proveko.inventory.v1.InventoryService",
	HandlerType: (*InventoryServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{MethodName: "DeductStock", Handler: _InventoryService_DeductStock_Handler},
	},
	Streams: []grpc.StreamDesc{},
}
