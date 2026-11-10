package proto

import (
	"encoding/json"

	"google.golang.org/grpc"
	"google.golang.org/grpc/encoding"
)

// CodecName es el subtipo de codificación binaria estructurada sobre HTTP/2 gRPC
// que permite compilar sin requerir el binario C++ externo protoc instalado en host/Alpine,
// preservando 100% el transporte google.golang.org/grpc, interceptores, metadata y bufconn/TCP.
const CodecName = "proveko-rpc"

type structCodec struct{}

func (structCodec) Name() string { return CodecName }

func (structCodec) Marshal(v any) ([]byte, error) {
	return json.Marshal(v)
}

func (structCodec) Unmarshal(data []byte, v any) error {
	return json.Unmarshal(data, v)
}

func init() {
	encoding.RegisterCodec(structCodec{})
}

// DefaultCallOptions fuerza el subtipo de codec en invocaciones gRPC cliente.
func DefaultCallOptions() grpc.DialOption {
	return grpc.WithDefaultCallOptions(grpc.CallContentSubtype(CodecName))
}
