package printingv1

import (
	"context"

	_ "github.com/alexmargomez/proveko/proto"
	"google.golang.org/grpc"
)

type PrintLineItem struct {
	Code        string  `json:"code"`
	Description string  `json:"description"`
	Quantity    float64 `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	TaxPct      float64 `json:"tax_pct"`
	Subtotal    float64 `json:"subtotal"`
}

type RenderDocumentRequest struct {
	DocumentType    string            `json:"document_type"`
	LayoutVariant   string            `json:"layout_variant"`
	DocumentNumber  string            `json:"document_number"`
	IssueDate       string            `json:"issue_date"`
	CustomerName    string            `json:"customer_name"`
	CustomerNit     string            `json:"customer_nit"`
	CustomerPhone   string            `json:"customer_phone"`
	CustomerAddress string            `json:"customer_address"`
	PaymentMethod   string            `json:"payment_method"`
	ExtraFields     map[string]string `json:"extra_fields"`
	Items           []PrintLineItem   `json:"items"`
	Subtotal        float64           `json:"subtotal"`
	DiscountTotal   float64           `json:"discount_total"`
	TaxTotal        float64           `json:"tax_total"`
	GrandTotal      float64           `json:"grand_total"`
	PendingBalance  float64           `json:"pending_balance"`
	Notes           string            `json:"notes"`
}

type RenderDocumentResponse struct {
	Title         string `json:"title"`
	Format        string `json:"format"`
	HTMLPrintable string `json:"html_printable"`
}

type PrintServiceServer interface {
	RenderDocument(context.Context, *RenderDocumentRequest) (*RenderDocumentResponse, error)
}

type PrintServiceClient interface {
	RenderDocument(ctx context.Context, in *RenderDocumentRequest, opts ...grpc.CallOption) (*RenderDocumentResponse, error)
}

type printServiceClient struct{ cc grpc.ClientConnInterface }

func NewPrintServiceClient(cc grpc.ClientConnInterface) PrintServiceClient {
	return &printServiceClient{cc: cc}
}

func (c *printServiceClient) RenderDocument(ctx context.Context, in *RenderDocumentRequest, opts ...grpc.CallOption) (*RenderDocumentResponse, error) {
	out := new(RenderDocumentResponse)
	if err := c.cc.Invoke(ctx, "/proveko.printing.v1.PrintService/RenderDocument", in, out, opts...); err != nil {
		return nil, err
	}
	return out, nil
}

func RegisterPrintServiceServer(s grpc.ServiceRegistrar, srv PrintServiceServer) {
	s.RegisterService(&PrintService_ServiceDesc, srv)
}

func _PrintService_RenderDocument_Handler(srv any, ctx context.Context, dec func(any) error, interceptor grpc.UnaryServerInterceptor) (any, error) {
	in := new(RenderDocumentRequest)
	if err := dec(in); err != nil {
		return nil, err
	}
	if interceptor == nil {
		return srv.(PrintServiceServer).RenderDocument(ctx, in)
	}
	info := &grpc.UnaryServerInfo{Server: srv, FullMethod: "/proveko.printing.v1.PrintService/RenderDocument"}
	handler := func(ctx context.Context, req any) (any, error) {
		return srv.(PrintServiceServer).RenderDocument(ctx, req.(*RenderDocumentRequest))
	}
	return interceptor(ctx, in, info, handler)
}

var PrintService_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "proveko.printing.v1.PrintService",
	HandlerType: (*PrintServiceServer)(nil),
	Methods: []grpc.MethodDesc{
		{MethodName: "RenderDocument", Handler: _PrintService_RenderDocument_Handler},
	},
	Streams: []grpc.StreamDesc{},
}
