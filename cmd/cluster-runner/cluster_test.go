package main

import "testing"

func TestDefaultGatewayEndpoint(t *testing.T) {
	if got := DefaultGatewayEndpoint(); got == "" {
		t.Fatal("expected non-empty default gateway endpoint")
	}
}
