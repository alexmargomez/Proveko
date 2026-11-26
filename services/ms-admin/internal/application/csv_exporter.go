package application

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"ms-admin/internal/domain"
	"ms-admin/internal/platform/apperr"
	"ms-admin/internal/platform/money"
)

type serviceExportSpec struct {
	ServiceKey string
	SubPath    string
}

var businessExportCatalog = []serviceExportSpec{
	{ServiceKey: "ms-facturacion", SubPath: "/pos-state"},
	{ServiceKey: "ms-inventario", SubPath: "/pos-state"},
	{ServiceKey: "ms-clientes", SubPath: "/all"},
	{ServiceKey: "ms-compras", SubPath: "/pos-state"},
	{ServiceKey: "ms-contabilidad", SubPath: "/summary"},
	{ServiceKey: "ms-cartera", SubPath: "/pos-state"},
	{ServiceKey: "ms-reportes", SubPath: "/summary"},
	{ServiceKey: "ms-taller", SubPath: "/pos-state"},
	{ServiceKey: "ms-hoteleria", SubPath: "/rooms"},
	{ServiceKey: "ms-comandas", SubPath: "/tables"},
	{ServiceKey: "ms-nomina", SubPath: "/pos-state"},
	{ServiceKey: "ms-bancos", SubPath: "/pos-state"},
	{ServiceKey: "ms-activos", SubPath: "/pos-state"},
	{ServiceKey: "ms-crm", SubPath: "/pos-state"},
}

func (s *AdminService) GenerateTenantCSVExport(ctx context.Context, actor domain.ActorContext, tenantID, reason string) (*domain.ExportJob, error) {
	if err := s.RequirePermission(actor, "datos_negocio.exportar_csv"); err != nil {
		return nil, err
	}
	cleanTen := strings.TrimSpace(tenantID)
	if cleanTen == "" {
		return nil, apperr.Validation("Empresa destino requerida para exportación CSV")
	}
	if err := s.RequireTenantScope(actor, cleanTen); err != nil {
		return nil, err
	}
	cleanReason := strings.TrimSpace(reason)
	if actor.RequireDataReason && len(cleanReason) < 5 {
		return nil, apperr.Validation("Debes indicar un motivo o ticket (mínimo 5 caracteres) para exportar datos del cliente")
	}

	status, tenResp, err := s.core.ProxyJSON(ctx, "GET", "/api/v1/core/internal-admin/tenants/"+cleanTen, nil)
	if err != nil || status >= 400 {
		return nil, apperr.NotFound("Empresa no encontrada para exportación")
	}
	tenMap, _ := tenResp["tenant"].(map[string]any)
	companyName, _ := tenMap["companyName"].(string)
	nit, _ := tenMap["nit"].(string)
	dbName, _ := tenMap["dbName"].(string)

	activeSet := make(map[string]bool)
	var activeSvcs []string
	if rawSvcs, ok := tenMap["activeServices"].([]any); ok {
		for _, sv := range rawSvcs {
			if str, ok := sv.(string); ok && strings.TrimSpace(str) != "" {
				activeSet[str] = true
				activeSvcs = append(activeSvcs, str)
			}
		}
	}

	var zipBuf bytes.Buffer
	zw := zip.NewWriter(&zipBuf)
	filesWritten := 0

	// 1. resumen_empresa.csv
	if err := writeCSVEntry(zw, "00_resumen_empresa.csv",
		[]string{"Tenant_ID", "Razon_Social", "NIT", "Base_Datos", "Estado", "Tarifa_Mensual_COP", "Exportado_Por", "Motivo", "Fecha_UTC"},
		[][]string{{
			cleanTen, companyName, nit, dbName,
			formatCSVCell(tenMap["status"]),
			formatCSVCell(tenMap["monthlyCop"]),
			actor.Email, cleanReason, time.Now().UTC().Format(time.RFC3339),
		}},
	); err == nil {
		filesWritten++
	}

	// 2. usuarios_empresa.csv
	if uStatus, uResp, uErr := s.core.ProxyJSON(ctx, "GET", "/api/v1/core/internal-admin/tenants/"+cleanTen+"/users", nil); uErr == nil && uStatus < 400 {
		if usersRaw, ok := uResp["users"].([]any); ok {
			if n, wErr := writeObjectsAsCSV(zw, "01_usuarios_empresa.csv", usersRaw); wErr == nil && n >= 0 {
				filesWritten++
			}
		}
	}

	// 3. Business microservices active for this tenant
	includedServices := make([]string, 0)
	for _, spec := range businessExportCatalog {
		if !activeSet[spec.ServiceKey] {
			continue
		}
		info, pErr := s.core.IssueExportPassport(ctx, cleanTen, spec.ServiceKey, actor.Email)
		if pErr != nil || info.TargetURL == "" || info.Passport == "" {
			continue
		}
		fullPath := strings.TrimRight(info.APIPrefix, "/") + spec.SubPath
		bStatus, rawBody, bErr := s.core.FetchBusinessJSON(ctx, info.TargetURL, fullPath, info.Passport)
		if bErr != nil || bStatus >= 400 || len(rawBody) == 0 {
			continue
		}
		var payload map[string]any
		if err := json.Unmarshal(rawBody, &payload); err != nil {
			continue
		}
		serviceWritten := false
		for key, val := range payload {
			arr, ok := val.([]any)
			if !ok {
				continue
			}
			fileName := fmt.Sprintf("%s_%s.csv", strings.TrimPrefix(spec.ServiceKey, "ms-"), sanitizeFileToken(key))
			if _, wErr := writeObjectsAsCSV(zw, fileName, arr); wErr == nil {
				filesWritten++
				serviceWritten = true
			}
		}
		if serviceWritten {
			includedServices = append(includedServices, spec.ServiceKey)
		}
	}

	if err := zw.Close(); err != nil {
		return nil, apperr.Internal("Error finalizando archivo ZIP de exportación")
	}

	now := time.Now().UTC()
	job := &domain.ExportJob{
		JobID:            money.NewID("exp"),
		TenantID:         cleanTen,
		CompanyName:      companyName,
		RequestedBy:      actor.Email,
		Reason:           cleanReason,
		ServicesIncluded: includedServices,
		Status:           "COMPLETED",
		FileSizeBytes:    int64(zipBuf.Len()),
		ZipBytes:         zipBuf.Bytes(),
		CreatedAt:        now.Format(time.RFC3339),
		ExpiresAt:        now.Add(24 * time.Hour).Format(time.RFC3339),
	}
	if err := s.repo.SaveExportJob(ctx, job); err != nil {
		return nil, err
	}
	s.Audit(ctx, actor, "datos_negocio.exportar_csv", "export_job", job.JobID, cleanTen, cleanReason, nil, map[string]any{
		"companyName":      companyName,
		"servicesIncluded": includedServices,
		"filesWritten":     filesWritten,
		"fileSizeBytes":    job.FileSizeBytes,
	}, "SUCCESS")
	return job, nil
}

func (s *AdminService) GetExportJob(ctx context.Context, actor domain.ActorContext, jobID string) (*domain.ExportJob, error) {
	if err := s.RequirePermission(actor, "datos_negocio.exportar_csv"); err != nil {
		return nil, err
	}
	job, err := s.repo.GetExportJob(ctx, strings.TrimSpace(jobID))
	if err != nil {
		return nil, err
	}
	if err := s.RequireTenantScope(actor, job.TenantID); err != nil {
		return nil, err
	}
	return job, nil
}

func (s *AdminService) ListExportJobs(ctx context.Context, actor domain.ActorContext, tenantID string) ([]*domain.ExportJob, error) {
	if err := s.RequirePermission(actor, "datos_negocio.exportar_csv"); err != nil {
		return nil, err
	}
	if tenantID != "" {
		if err := s.RequireTenantScope(actor, tenantID); err != nil {
			return nil, err
		}
	}
	return s.repo.ListExportJobs(ctx, tenantID)
}

func writeCSVEntry(zw *zip.Writer, filename string, headers []string, rows [][]string) error {
	w, err := zw.Create(filename)
	if err != nil {
		return err
	}
	if _, err := w.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return err
	}
	cw := csv.NewWriter(w)
	cw.Comma = ';'
	if err := cw.Write(headers); err != nil {
		return err
	}
	for _, row := range rows {
		if err := cw.Write(row); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}

func writeObjectsAsCSV(zw *zip.Writer, filename string, items []any) (int, error) {
	colSet := make(map[string]bool)
	objs := make([]map[string]any, 0, len(items))
	for _, raw := range items {
		m, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		objs = append(objs, m)
		for k := range m {
			if strings.Contains(strings.ToLower(k), "password") || strings.Contains(strings.ToLower(k), "secret") {
				continue
			}
			colSet[k] = true
		}
	}
	headers := make([]string, 0, len(colSet))
	for k := range colSet {
		headers = append(headers, k)
	}
	sort.Strings(headers)
	if len(headers) == 0 {
		headers = []string{"info"}
		return 0, writeCSVEntry(zw, filename, headers, [][]string{{"Sin registros"}})
	}
	rows := make([][]string, 0, len(objs))
	for _, obj := range objs {
		row := make([]string, len(headers))
		for i, col := range headers {
			val := obj[col]
			switch typed := val.(type) {
			case map[string]any, []any:
				b, _ := json.Marshal(typed)
				row[i] = string(b)
			default:
				row[i] = formatCSVCell(val)
			}
		}
		rows = append(rows, row)
	}
	return len(rows), writeCSVEntry(zw, filename, headers, rows)
}

func sanitizeFileToken(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(strings.TrimSpace(s)) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			b.WriteRune(r)
		} else {
			b.WriteRune('_')
		}
	}
	out := strings.Trim(b.String(), "_")
	if out == "" {
		return "datos"
	}
	return out
}
