package s2s

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"ms-admin/internal/domain"
	"ms-admin/internal/platform/security"
)

type CoreAdminClient struct {
	gatewayURL string
	s2sKey     string
	httpClient *http.Client
}

func NewCoreAdminClient(gatewayURL, s2sKey string) *CoreAdminClient {
	return &CoreAdminClient{
		gatewayURL: strings.TrimRight(strings.TrimSpace(gatewayURL), "/"),
		s2sKey:     s2sKey,
		httpClient: &http.Client{Timeout: 12 * time.Second},
	}
}

func (c *CoreAdminClient) ProxyJSON(ctx context.Context, method, path string, body any) (int, map[string]any, error) {
	if c.gatewayURL == "" {
		return http.StatusBadGateway, nil, errors.New("GATEWAY_URL no configurado en ms-admin")
	}
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return http.StatusBadRequest, nil, err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.gatewayURL+path, reader)
	if err != nil {
		return http.StatusInternalServerError, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(security.S2SKeyHeader, c.s2sKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return http.StatusBadGateway, nil, err
	}
	defer resp.Body.Close()

	rawResp, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	var parsed map[string]any
	if len(rawResp) > 0 {
		_ = json.Unmarshal(rawResp, &parsed)
	}
	if parsed == nil {
		parsed = map[string]any{"ok": resp.StatusCode < 400}
	}
	return resp.StatusCode, parsed, nil
}

func (c *CoreAdminClient) IssueExportPassport(ctx context.Context, tenantID, targetService, actorEmail string) (domain.ExportPassportInfo, error) {
	status, payload, err := c.ProxyJSON(ctx, http.MethodPost, "/api/v1/core/internal-admin/export-passport", map[string]any{
		"tenantId":      tenantID,
		"targetService": targetService,
		"actorEmail":    actorEmail,
	})
	if err != nil {
		return domain.ExportPassportInfo{}, err
	}
	if status >= 400 {
		msg, _ := payload["error"].(string)
		if msg == "" {
			msg = "No fue posible emitir pasaporte de exportación para " + targetService
		}
		return domain.ExportPassportInfo{}, errors.New(msg)
	}
	info := domain.ExportPassportInfo{
		Passport:  strVal(payload["passport"]),
		TargetURL: strVal(payload["targetUrl"]),
		APIPrefix: strVal(payload["apiPrefix"]),
	}
	if ten, ok := payload["tenant"].(map[string]any); ok {
		info.CompanyName = strVal(ten["companyName"])
		if svcs, ok := ten["activeServices"].([]any); ok {
			for _, s := range svcs {
				if str := strVal(s); str != "" {
					info.ActiveSvcs = append(info.ActiveSvcs, str)
				}
			}
		}
	}
	return info, nil
}

func (c *CoreAdminClient) FetchBusinessJSON(ctx context.Context, targetURL, fullPath, passport string) (int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(targetURL, "/")+fullPath, nil)
	if err != nil {
		return http.StatusInternalServerError, nil, err
	}
	req.Header.Set(security.S2SKeyHeader, c.s2sKey)
	req.Header.Set(security.PassportHeader, passport)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return http.StatusBadGateway, nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	return resp.StatusCode, raw, err
}

func strVal(v any) string {
	s, _ := v.(string)
	return strings.TrimSpace(s)
}
