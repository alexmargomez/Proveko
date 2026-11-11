package inventoryv1

import (
	"context"

	"google.golang.org/grpc"
	_ "platform-contracts"
)

type QuoteProductsRequest struct {
	ProductIDs []string `json:"product_ids"`
}

type ProductQuote struct {
	ProductID      string  `json:"product_id"`
	Code           string  `json:"code"`
	Name           string  `json:"name"`
	SalePrice      float64 `json:"sale_price"`
	TaxPct         float64 `json:"tax_pct"`
	AvailableStock float64 `json:"available_stock"`
}

type QuoteProductsResponse struct {
	Products []ProductQuote `json:"products"`
}

type StockDeltaItem struct {
	ProductID    string  `json:"product_id"`
	Quantity     float64 `json:"quantity"`
	UnitCost     float64 `json:"unit_cost"`
	WarehouseID  string  `json:"warehouse_id"`
	MovementType string  `json:"movement_type"`
	ReferenceDoc string  `json:"reference_doc"`
	Actor        string  `json:"actor"`
}

type DeductStockRequest struct {
	IdempotencyKey string           `json:"idempotency_key"`
	Items          []StockDeltaItem `json:"items"`
}

type DeductStockResponse struct {
	Ok             bool  `json:"ok"`
	ProcessedCount int32 `json:"processed_count"`
}

type RestockItemsRequest struct {
	IdempotencyKey string           `json:"idempotency_key"`
	Items          []StockDeltaItem `json:"items"`
}

type RestockItemsResponse struct {
	Ok             bool  `json:"ok"`
	ProcessedCount int32 `json:"processed_count"`
}

type InventoryServiceServer interface {
	QuoteProducts(context.Context, *QuoteProductsRequest) (*QuoteProductsResponse, error)
	DeductStock(context.Context, *DeductStockRequest) (*DeductStockResponse, error)
	RestockItems(context.Context, *RestockItemsRequest) (*RestockItemsResponse, error)
}

type InventoryServiceClient interface {
	QuoteProducts(ctx context.Context, in *QuoteProductsRequest, opts ...grpc.CallOption) (*QuoteProductsResponse, error)
	DeductStock(ctx context.Context, in *DeductStockRequest, opts ...grpc.CallOption) (*DeductStockResponse, error)
	RestockItems(ctx context.Context, in *RestockItemsRequest, opts ...grpc.CallOption) (*RestockItemsResponse, error)
}

type inventoryServiceClient struct{ cc grpc.ClientConnInterface }

func NewInventoryServiceClient(cc grpc.ClientConnInterface) InventoryServiceClient {
	return &inventoryServiceClient{cc: cc}
}

func (c *inventoryServiceClient) QuoteProducts(ctx context.Context, in *QuoteProductsRequest, opts ...grpc.CallOption) (*QuoteProductsResponse, error) {
	out := new(QuoteProductsResponse)
	if err := c.cc.Invoke(ctx, "/proveko.inventory.v1.InventoryService/QuoteProducts", in, out, opts...); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *inventoryServiceClient) DeductStock(ctx context.Context, in *DeductStockRequest, opts ...grpc.CallOption) (*DeductStockResponse, error) {
	out := new(DeductStockResponse)
	if err := c.cc.Invoke(ctx, "/proveko.inventory.v1.InventoryService/DeductStock", in, out, opts...); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *inventoryServiceClient) RestockItems(ctx context.Context, in *RestockItemsRequest, opts ...grpc.CallOption) (*RestockItemsResponse, error) {
	out := new(RestockItemsResponse)
	if err := c.cc.Invoke(ctx, "/proveko.inventory.v1.InventoryService/RestockItems", in, out, opts...); err != nil {
		return nil, err
	}
	return out, nil
}

func RegisterInventoryServiceServer(s grpc.ServiceRegistrar, srv InventoryServiceServer) {
	s.RegisterService(&InventoryService_ServiceDesc, srv)
}

func _InventoryService_QuoteProducts_Handler(srv any, ctx context.Context, dec func(any) error, interceptor grpc.UnaryServerInterceptor) (any, error) {
	in := new(QuoteProductsRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InventoryServiceServer).QuoteProducts(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/proveko.inventory.v1.InventoryService/QuoteProducts"}
	handler := func(ctx context.Context, req any) (any, error) {
		return srv.(InventoryServiceServer).QuoteProducts(ctx, req.(*QuoteProductsRequest))
	}
	return interceptor(ctx, in, info, handler)
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

func _InventoryService_RestockItems_Handler(srv any, ctx context.Context, dec func(any) error, interceptor grpc.UnaryServerInterceptor) (any, error) {
	in := new(RestockItemsRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(InventoryServiceServer).RestockItems(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/proveko.inventory.v1.InventoryService/RestockItems"}
	handler := func(ctx context.Context, req any) (any, error) {
		return srv.(InventoryServiceServer).RestockItems(ctx, req.(*RestockItemsRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var InventoryService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "proveko.inventory.v1.InventoryService",
	HandlerType: (*InventoryServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{MethodName: "QuoteProducts", Handler: _InventoryService_QuoteProducts_Handler},
		{MethodName: "DeductStock", Handler: _InventoryService_DeductStock_Handler},
		{MethodName: "RestockItems", Handler: _InventoryService_RestockItems_Handler},
	},
	Streams: []grpc.StreamDesc{},
}
