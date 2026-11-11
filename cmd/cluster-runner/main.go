package main

import (
	"fmt"
	"os"
)

func DefaultGatewayEndpoint() string {
	if v := os.Getenv("GATEWAY_URL"); v != "" {
		return v
	}
	return "http://localhost:4000"
}

func main() {
	fmt.Printf("Gateway endpoint configured at %s\n", DefaultGatewayEndpoint())
}
