package grpcx

import (
	"context"
	"net"
	"strings"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/proto"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/test/bufconn"
)

const bufSize = 1024 * 1024

func NewServer(clusterSecret string) *grpc.Server {
	return grpc.NewServer(grpc.UnaryInterceptor(func(
		ctx context.Context,
		req any,
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (any, error) {
		if md, ok := metadata.FromIncomingContext(ctx); ok {
			tID := firstMD(md, "x-tenant-id")
			dbN := firstMD(md, "x-tenant-db")
			sig := firstMD(md, "x-cluster-sig")
			if tID != "" && dbN != "" && (clusterSecret == "" || authguard.VerifyInternalHeaders(clusterSecret, tID, dbN, sig)) {
				ctx = authguard.WithContext(ctx, authguard.TenantContext{
					TenantID:       tID,
					DBName:         dbN,
					Username:       firstMD(md, "x-user-name"),
					Role:           firstMD(md, "x-user-role"),
					ActiveServices: splitCSV(firstMD(md, "x-active-services")),
					ActiveModules:  splitCSV(firstMD(md, "x-active-modules")),
					ActiveFeatures: splitCSV(firstMD(md, "x-active-features")),
				})
			}
		}
		return handler(ctx, req)
	}))
}

func clientMetadataInterceptor(clusterSecret string) grpc.UnaryClientInterceptor {
	return func(
		ctx context.Context,
		method string,
		req, reply any,
		cc *grpc.ClientConn,
		invoker grpc.UnaryInvoker,
		opts ...grpc.CallOption,
	) error {
		tc := authguard.FromContext(ctx)
		md := metadata.Pairs(
			"x-tenant-id", tc.TenantID,
			"x-tenant-db", tc.DBName,
			"x-user-name", tc.Username,
			"x-user-role", tc.Role,
			"x-active-services", strings.Join(tc.ActiveServices, ","),
			"x-active-modules", strings.Join(tc.ActiveModules, ","),
			"x-active-features", strings.Join(tc.ActiveFeatures, ","),
			"x-cluster-sig", authguard.SignInternalHeaders(clusterSecret, tc.TenantID, tc.DBName),
		)
		return invoker(metadata.NewOutgoingContext(ctx, md), method, req, reply, cc, opts...)
	}
}

func ServeInMemory(srv *grpc.Server, clusterSecret string) (*grpc.ClientConn, error) {
	lis := bufconn.Listen(bufSize)
	go func() { _ = srv.Serve(lis) }()
	return grpc.NewClient(
		"passthrough:///bufnet",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return lis.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		proto.DefaultCallOptions(),
		grpc.WithUnaryInterceptor(clientMetadataInterceptor(clusterSecret)),
	)
}

func DialTCP(addr, clusterSecret string) (*grpc.ClientConn, error) {
	return grpc.NewClient(
		addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		proto.DefaultCallOptions(),
		grpc.WithUnaryInterceptor(clientMetadataInterceptor(clusterSecret)),
	)
}

func firstMD(md metadata.MD, key string) string {
	vals := md.Get(key)
	if len(vals) > 0 {
		return vals[0]
	}
	return ""
}

func splitCSV(v string) []string {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return strings.Split(v, ",")
}
