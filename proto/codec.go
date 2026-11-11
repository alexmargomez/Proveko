package proto

import (
	"encoding/json"

	"google.golang.org/grpc"
	"google.golang.org/grpc/encoding"
)

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

func DefaultCallOptions() grpc.DialOption {
	return grpc.WithDefaultCallOptions(grpc.CallContentSubtype(CodecName))
}
