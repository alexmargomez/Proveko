package application

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"strings"
	"time"

	"ms-admin/internal/domain"
	"ms-admin/internal/platform/apperr"
	"ms-admin/internal/platform/money"
)

type AdminService struct {
	repo domain.AdminRepository
	core domain.CoreControlClient
}

func NewAdminService(repo domain.AdminRepository, core domain.CoreControlClient) *AdminService {
	return &AdminService{repo: repo, core: core}
}

func (s *AdminService) RequirePermission(actor domain.ActorContext, perm string) error {
	if actor.Plane != "platform" && actor.Role != "superadmin" {
		return apperr.Forbidden("Acceso exclusivo para personal interno de plataforma")
	}
	if !actor.HasPermission(perm) {
		return apperr.Forbidden("Tu rol no cuenta con el permiso requerido: " + perm)
	}
	return nil
}

func (s *AdminService) RequireTenantScope(actor domain.ActorContext, tenantID string) error {
	if !actor.CanAccessTenant(tenantID) {
		return apperr.Forbidden("Tu cuenta no tiene alcance asignado sobre esta empresa")
	}
	return nil
}

func (s *AdminService) Audit(ctx context.Context, actor domain.ActorContext, action, targetType, targetID, tenantID, reason string, before, after map[string]any, status string) {
	if status == "" {
		status = "SUCCESS"
	}
	role := actor.PlatformRole
	if role == "" {
		role = actor.Role
	}
	_ = s.repo.RecordAudit(ctx, &domain.AuditLog{
		LogID:       money.NewID("aud"),
		ActorUserID: actor.UserID,
		ActorEmail:  actor.Email,
		ActorRole:   role,
		Action:      action,
		TargetType:  targetType,
		TargetID:    targetID,
		TenantID:    tenantID,
		Reason:      strings.TrimSpace(reason),
		Before:      before,
		After:       after,
		IPAddress:   actor.IPAddress,
		UserAgent:   actor.UserAgent,
		Status:      status,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *AdminService) Overview(ctx context.Context, actor domain.ActorContext) (map[string]any, error) {
	if err := s.RequirePermission(actor, "empresas.ver"); err != nil {
		return nil, err
	}
	_, tenPayload, err := s.core.ProxyJSON(ctx, "GET", "/api/v1/core/internal-admin/tenants", nil)
	if err != nil {
		return nil, apperr.Internal("No fue posible consultar el registro de empresas")
	}
	rawTenants, _ := tenPayload["tenants"].([]any)
	filteredTenants := make([]map[string]any, 0, len(rawTenants))
	var totalActive, totalSuspended, totalMaintenance, totalDemo int
	var mrrCop int64

	for _, item := range rawTenants {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		tID, _ := m["tenantId"].(string)
		if !actor.CanAccessTenant(tID) {
			continue
		}
		filteredTenants = append(filteredTenants, m)
		isDemo, _ := m["isDemo"].(bool)
		if isDemo {
			totalDemo++
		}
		st, _ := m["status"].(string)
		if strings.EqualFold(st, "SUSPENDED") {
			totalSuspended++
		} else {
			totalActive++
			if !isDemo {
				if custom, ok := asInt64(m["customMonthlyCop"]); ok && custom > 0 {
					mrrCop += custom
				} else if monthly, ok := asInt64(m["monthlyCop"]); ok {
					mrrCop += monthly
				}
			}
		}
		if maint, _ := m["maintenanceMode"].(bool); maint {
			totalMaintenance++
		}
	}

	var servicesHealth []any
	if actor.HasPermission("plataforma.salud_servicios") {
		if _, hPayload, hErr := s.core.ProxyJSON(ctx, "GET", "/api/v1/core/internal-admin/services/health", nil); hErr == nil {
			servicesHealth, _ = hPayload["services"].([]any)
		}
	}

	var recentAudit []*domain.AuditLog
	if actor.HasPermission("auditoria.ver") {
		recentAudit, _ = s.repo.ListAudit(ctx, domain.AuditFilter{Limit: 12})
	}
	announcements, _ := s.repo.ListAnnouncements(ctx, true)
	flags, _ := s.repo.ListFeatureFlags(ctx)

	return map[string]any{
		"ok": true,
		"kpis": map[string]any{
			"totalTenants":       len(filteredTenants),
			"activeTenants":      totalActive,
			"suspendedTenants":   totalSuspended,
			"maintenanceTenants": totalMaintenance,
			"demoTenants":        totalDemo,
			"mrrCop":             mrrCop,
			"activeFlags":        len(flags),
			"activeAnnouncements": len(announcements),
		},
		"servicesHealth": servicesHealth,
		"recentAudit":    recentAudit,
	}, nil
}

func (s *AdminService) ForwardCore(ctx context.Context, method, path string, body any) (int, map[string]any, error) {
	return s.core.ProxyJSON(ctx, method, path, body)
}

func (s *AdminService) GetTenantMetadata(ctx context.Context, actor domain.ActorContext, tenantID string) (*domain.TenantMetadata, error) {
	if err := s.RequirePermission(actor, "empresas.ver"); err != nil {
		return nil, err
	}
	if err := s.RequireTenantScope(actor, tenantID); err != nil {
		return nil, err
	}
	return s.repo.GetTenantMetadata(ctx, tenantID)
}

func (s *AdminService) UpdateTenantMetadata(ctx context.Context, actor domain.ActorContext, tenantID string, in domain.TenantMetadata) (*domain.TenantMetadata, error) {
	if err := s.RequirePermission(actor, "empresas.editar_cuotas"); err != nil {
		return nil, err
	}
	if err := s.RequireTenantScope(actor, tenantID); err != nil {
		return nil, err
	}
	tier := strings.ToUpper(strings.TrimSpace(in.SupportTier))
	if tier == "" {
		tier = "STANDARD"
	}
	meta := &domain.TenantMetadata{
		TenantID:       tenantID,
		BillingNotes:   strings.TrimSpace(in.BillingNotes),
		SupportTier:    tier,
		InternalTags:   in.InternalTags,
		AccountManager: strings.TrimSpace(in.AccountManager),
		UpdatedAt:      time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.repo.UpsertTenantMetadata(ctx, meta); err != nil {
		return nil, err
	}
	s.Audit(ctx, actor, "empresas.editar_metadata", "tenant", tenantID, tenantID, "", nil, map[string]any{
		"supportTier":    meta.SupportTier,
		"accountManager": meta.AccountManager,
	}, "SUCCESS")
	return meta, nil
}

func (s *AdminService) ListFeatureFlags(ctx context.Context, actor domain.ActorContext) ([]*domain.FeatureFlag, error) {
	if err := s.RequirePermission(actor, "catalogo.ver"); err != nil {
		return nil, err
	}
	return s.repo.ListFeatureFlags(ctx)
}

func (s *AdminService) UpsertFeatureFlag(ctx context.Context, actor domain.ActorContext, in domain.FeatureFlag) (*domain.FeatureFlag, error) {
	if err := s.RequirePermission(actor, "catalogo.feature_flags"); err != nil {
		return nil, err
	}
	key := strings.ToLower(strings.TrimSpace(in.FlagKey))
	if key == "" {
		return nil, apperr.Validation("La clave del feature flag es obligatoria")
	}
	name := strings.TrimSpace(in.DisplayName)
	if name == "" {
		name = key
	}
	flag := &domain.FeatureFlag{
		FlagKey:         key,
		DisplayName:     name,
		Description:     strings.TrimSpace(in.Description),
		EnabledGlobal:   in.EnabledGlobal,
		EnabledTenants:  in.EnabledTenants,
		DisabledTenants: in.DisabledTenants,
		UpdatedBy:       actor.Email,
		UpdatedAt:       time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.repo.UpsertFeatureFlag(ctx, flag); err != nil {
		return nil, err
	}
	s.Audit(ctx, actor, "catalogo.feature_flags", "feature_flag", key, "", "", nil, map[string]any{
		"enabledGlobal":  flag.EnabledGlobal,
		"enabledTenants": flag.EnabledTenants,
	}, "SUCCESS")
	return flag, nil
}

func (s *AdminService) DeleteFeatureFlag(ctx context.Context, actor domain.ActorContext, flagKey string) error {
	if err := s.RequirePermission(actor, "catalogo.feature_flags"); err != nil {
		return err
	}
	if err := s.repo.DeleteFeatureFlag(ctx, strings.ToLower(strings.TrimSpace(flagKey))); err != nil {
		return err
	}
	s.Audit(ctx, actor, "catalogo.feature_flag_eliminar", "feature_flag", flagKey, "", "", nil, nil, "SUCCESS")
	return nil
}

func (s *AdminService) ListAnnouncements(ctx context.Context, actor domain.ActorContext) ([]*domain.Announcement, error) {
	if err := s.RequirePermission(actor, "empresas.ver"); err != nil {
		return nil, err
	}
	return s.repo.ListAnnouncements(ctx, false)
}

func (s *AdminService) ListClientAnnouncements(ctx context.Context, tenantID string) ([]*domain.Announcement, error) {
	all, err := s.repo.ListAnnouncements(ctx, true)
	if err != nil {
		return nil, err
	}
	out := make([]*domain.Announcement, 0)
	for _, a := range all {
		if strings.EqualFold(a.TargetScope, "ALL") || len(a.TargetTenants) == 0 {
			out = append(out, a)
			continue
		}
		for _, t := range a.TargetTenants {
			if strings.TrimSpace(t) == strings.TrimSpace(tenantID) {
				out = append(out, a)
				break
			}
		}
	}
	return out, nil
}

func (s *AdminService) CreateAnnouncement(ctx context.Context, actor domain.ActorContext, in domain.Announcement) (*domain.Announcement, error) {
	if err := s.RequirePermission(actor, "plataforma.anuncios"); err != nil {
		return nil, err
	}
	if strings.TrimSpace(in.Title) == "" || strings.TrimSpace(in.Message) == "" {
		return nil, apperr.Validation("Título y mensaje del anuncio son obligatorios")
	}
	sev := strings.ToUpper(strings.TrimSpace(in.Severity))
	if sev != "INFO" && sev != "WARNING" && sev != "CRITICAL" {
		sev = "INFO"
	}
	scope := strings.ToUpper(strings.TrimSpace(in.TargetScope))
	if scope != "SPECIFIC" {
		scope = "ALL"
	}
	ann := &domain.Announcement{
		AnnouncementID: money.NewID("ann"),
		Title:          strings.TrimSpace(in.Title),
		Message:        strings.TrimSpace(in.Message),
		Severity:       sev,
		TargetScope:    scope,
		TargetTenants:  in.TargetTenants,
		StartsAt:       strings.TrimSpace(in.StartsAt),
		EndsAt:         strings.TrimSpace(in.EndsAt),
		Active:         true,
		CreatedBy:      actor.Email,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.repo.CreateAnnouncement(ctx, ann); err != nil {
		return nil, err
	}
	s.Audit(ctx, actor, "plataforma.anuncio_crear", "announcement", ann.AnnouncementID, "", "", nil, map[string]any{
		"title":    ann.Title,
		"severity": ann.Severity,
		"scope":    ann.TargetScope,
	}, "SUCCESS")
	return ann, nil
}

func (s *AdminService) UpdateAnnouncement(ctx context.Context, actor domain.ActorContext, id string, in domain.Announcement) (*domain.Announcement, error) {
	if err := s.RequirePermission(actor, "plataforma.anuncios"); err != nil {
		return nil, err
	}
	in.AnnouncementID = strings.TrimSpace(id)
	if in.Severity == "" {
		in.Severity = "INFO"
	}
	if in.TargetScope == "" {
		in.TargetScope = "ALL"
	}
	if err := s.repo.UpdateAnnouncement(ctx, &in); err != nil {
		return nil, err
	}
	s.Audit(ctx, actor, "plataforma.anuncio_editar", "announcement", id, "", "", nil, map[string]any{
		"title":  in.Title,
		"active": in.Active,
	}, "SUCCESS")
	return &in, nil
}

func (s *AdminService) DeleteAnnouncement(ctx context.Context, actor domain.ActorContext, id string) error {
	if err := s.RequirePermission(actor, "plataforma.anuncios"); err != nil {
		return err
	}
	if err := s.repo.DeleteAnnouncement(ctx, id); err != nil {
		return err
	}
	s.Audit(ctx, actor, "plataforma.anuncio_eliminar", "announcement", id, "", "", nil, nil, "SUCCESS")
	return nil
}

func (s *AdminService) ListAudit(ctx context.Context, actor domain.ActorContext, filter domain.AuditFilter) ([]*domain.AuditLog, error) {
	if err := s.RequirePermission(actor, "auditoria.ver"); err != nil {
		return nil, err
	}
	return s.repo.ListAudit(ctx, filter)
}

func (s *AdminService) ExportAuditCSV(ctx context.Context, actor domain.ActorContext, filter domain.AuditFilter) ([]byte, error) {
	if err := s.RequirePermission(actor, "auditoria.exportar"); err != nil {
		return nil, err
	}
	filter.Limit = 500
	logs, err := s.repo.ListAudit(ctx, filter)
	if err != nil {
		return nil, err
	}
	var buf bytes.Buffer
	buf.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(&buf)
	w.Comma = ';'
	_ = w.Write([]string{"Fecha_UTC", "Actor_Correo", "Rol", "Accion", "Tipo_Objetivo", "Objetivo_ID", "Empresa_ID", "Motivo", "Estado", "IP"})
	for _, l := range logs {
		_ = w.Write([]string{l.CreatedAt, l.ActorEmail, l.ActorRole, l.Action, l.TargetType, l.TargetID, l.TenantID, l.Reason, l.Status, l.IPAddress})
	}
	w.Flush()
	return buf.Bytes(), nil
}

func asInt64(v any) (int64, bool) {
	switch n := v.(type) {
	case float64:
		return int64(n), true
	case int64:
		return n, true
	case int:
		return int64(n), true
	default:
		return 0, false
	}
}

func formatCSVCell(v any) string {
	if v == nil {
		return ""
	}
	switch val := v.(type) {
	case string:
		return strings.ReplaceAll(strings.ReplaceAll(val, "\r", " "), "\n", " ")
	case float64:
		if val == float64(int64(val)) {
			return fmt.Sprintf("%d", int64(val))
		}
		return strings.ReplaceAll(fmt.Sprintf("%.2f", val), ".", ",")
	case bool:
		if val {
			return "SI"
		}
		return "NO"
	default:
		return fmt.Sprintf("%v", val)
	}
}
