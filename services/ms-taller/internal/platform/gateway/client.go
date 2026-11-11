package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"path"
	"strings"
	"time"

	"ms-taller/internal/platform/apperr"
	"ms-taller/internal/platform/authguard"
	"ms-taller/internal/platform/security"
)

type Client struct {
	gatewayURL string
	s2sKey     string
	httpClient *http.Client
}

func NewClient(gatewayURL, s2sKey string) *Client {
	trimmed := strings.TrimRight(strings.TrimSpace(gatewayURL), "/")
	if trimmed == "" {
		return nil
	}
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   2 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          128,
		MaxIdleConnsPerHost:   32,
		IdleConnTimeout:       60 * time.Second,
		TLSHandshakeTimeout:   4 * time.Second,
		ResponseHeaderTimeout: 5 * time.Second,
	}
	return &Client{
		gatewayURL: trimmed,
		s2sKey:     s2sKey,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   6 * time.Second,
		},
	}
}

func (c *Client) FetchVerifierPublicKey(ctx context.Context) (string, error) {
	if c == nil || c.gatewayURL == "" {
		return "", errors.New("gateway url not configured")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.gatewayURL+"/api/v1/gateway/public-key", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set(security.S2SKeyHeader, c.s2sKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gateway public-key returned status %d", resp.StatusCode)
	}
	var out struct {
		PublicKeyHex string `json:"publicKeyHex"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if strings.TrimSpace(out.PublicKeyHex) == "" {
		return "", errors.New("empty publicKeyHex from gateway")
	}
	return strings.TrimSpace(out.PublicKeyHex), nil
}

func (c *Client) RegisterWithRetry(manifestJSON []byte, servicePublicURL string) {
	if c == nil || c.gatewayURL == "" || strings.TrimSpace(servicePublicURL) == "" {
		return
	}
	go func() {
		backoffs := []time.Duration{0, 300 * time.Millisecond, 1 * time.Second, 2 * time.Second, 5 * time.Second}
		for _, wait := range backoffs {
			if wait > 0 {
				time.Sleep(wait)
			}
			ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
			err := c.RegisterOnce(ctx, manifestJSON, servicePublicURL)
			cancel()
			if err == nil {
				break
			}
		}
		ticker := time.NewTicker(20 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
			_ = c.RegisterOnce(ctx, manifestJSON, servicePublicURL)
			cancel()
		}
	}()
}

func (c *Client) RegisterOnce(ctx context.Context, manifestJSON []byte, servicePublicURL string) error {
	if c == nil || c.gatewayURL == "" {
		return errors.New("gateway url not configured")
	}
	payload := map[string]any{
		"serviceUrl": strings.TrimRight(strings.TrimSpace(servicePublicURL), "/"),
		"manifest":   json.RawMessage(manifestJSON),
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.gatewayURL+"/api/v1/gateway/register", bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(security.S2SKeyHeader, c.s2sKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("gateway register returned status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) CallS2S(ctx context.Context, targetService, method, endpointPath, idemKey string, reqBody any, respDst any) error {
	if c == nil || c.gatewayURL == "" {
		return apperr.Upstream("Dirección del Gateway S2S no configurada")
	}
	tc := authguard.FromContext(ctx)
	if strings.TrimSpace(tc.RawPassport) == "" {
		return apperr.Unauthorized("Pasaporte S2S de origen no disponible en el contexto")
	}
	hopNonce, err := security.NewNonceHex()
	if err != nil {
		return apperr.Internal("No fue posible generar nonce criptográfico S2S")
	}
	cleanEndpoint := path.Clean("/" + strings.TrimLeft(endpointPath, "/"))
	targetURL := fmt.Sprintf("%s/api/v1/s2s/%s%s", c.gatewayURL, targetService, cleanEndpoint)

	callCtx := ctx
	if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		var cancel context.CancelFunc
		callCtx, cancel = context.WithTimeout(ctx, 4*time.Second)
		defer cancel()
	}

	var bodyReader io.Reader
	if reqBody != nil {
		raw, err := json.Marshal(reqBody)
		if err != nil {
			return apperr.Internal("Error al serializar carga S2S")
		}
		bodyReader = bytes.NewReader(raw)
	}

	req, err := http.NewRequestWithContext(callCtx, method, targetURL, bodyReader)
	if err != nil {
		return apperr.Upstream("Error al preparar solicitud hacia " + targetService)
	}
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	hopSig := security.SignHopMAC(c.s2sKey, tc.RawPassport, hopNonce, method, targetService, cleanEndpoint)
	req.Header.Set(security.S2SKeyHeader, c.s2sKey)
	req.Header.Set(security.PassportHeader, tc.RawPassport)
	req.Header.Set(security.HopNonceHeader, hopNonce)
	req.Header.Set(security.HopSigHeader, hopSig)
	if strings.TrimSpace(idemKey) != "" {
		req.Header.Set("Idempotency-Key", strings.TrimSpace(idemKey))
	} else if strings.TrimSpace(tc.IdempotencyKey) != "" {
		req.Header.Set("Idempotency-Key", strings.TrimSpace(tc.IdempotencyKey))
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return apperr.Upstream("El servicio " + targetService + " no responde a través del Gateway")
	}
	defer resp.Body.Close()

	rawResp, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return apperr.Upstream("Respuesta incompleta desde " + targetService)
	}

	if resp.StatusCode >= 400 {
		var errEnvelope struct {
			Error string `json:"error"`
		}
		_ = json.Unmarshal(rawResp, &errEnvelope)
		return apperr.FromHTTPStatus(resp.StatusCode, errEnvelope.Error, targetService)
	}

	if respDst != nil && len(rawResp) > 0 {
		if err := json.Unmarshal(rawResp, respDst); err != nil {
			return apperr.Upstream("Contrato JSON inesperado recibido desde " + targetService)
		}
	}
	return nil
}
