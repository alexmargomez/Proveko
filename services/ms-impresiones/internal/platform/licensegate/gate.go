package licensegate

import (
	"context"
	"strings"

	"ms-impresiones/internal/platform/apperr"
	"ms-impresiones/internal/platform/authguard"
)

type ModuleManifest struct {
	ModuleKey     string `json:"moduleKey"`
	DisplayName   string `json:"displayName"`
	TabIcon       string `json:"tabIcon"`
	DefaultActive bool   `json:"defaultActive"`
	Summary       string `json:"summary"`
}

type SubmoduleManifest struct {
	SubmoduleKey    string `json:"submoduleKey"`
	DisplayName     string `json:"displayName"`
	DependsOnModule string `json:"dependsOnModule"`
	DefaultActive   bool   `json:"defaultActive"`
	Summary         string `json:"summary,omitempty"`
}

type FeatureManifest struct {
	FeatureKey         string `json:"featureKey"`
	DisplayName        string `json:"displayName"`
	DependsOnModule    string `json:"dependsOnModule"`
	DependsOnSubmodule string `json:"dependsOnSubmodule,omitempty"`
	DefaultActive      bool   `json:"defaultActive"`
}

type ServiceManifest struct {
	ServiceKey   string              `json:"serviceKey"`
	DisplayName  string              `json:"displayName"`
	Icon         string              `json:"icon"`
	APIPrefix    string              `json:"apiPrefix"`
	UIBundlePath string              `json:"uiBundlePath"`
	BundleHash   string              `json:"bundleHash,omitempty"`
	Capabilities []string            `json:"capabilities,omitempty"`
	Category     string              `json:"category"`
	Summary      string              `json:"summary"`
	Modules      []ModuleManifest    `json:"modules"`
	Submodules   []SubmoduleManifest `json:"submodules,omitempty"`
	Features     []FeatureManifest   `json:"features"`
}

func ValidateCatalog(catalog []ServiceManifest) error {
	seen := make(map[string]bool, len(catalog))
	for _, s := range catalog {
		sk := strings.TrimSpace(s.ServiceKey)
		if sk == "" || sk == "*" || strings.Contains(sk, "*") {
			return apperr.Validation("serviceKey inválido o comodín prohibido: " + s.ServiceKey)
		}
		if seen[sk] {
			return apperr.Validation("serviceKey duplicado en catálogo: " + sk)
		}
		seen[sk] = true
		if sk != "ms-platform" && len(s.Modules) == 0 {
			return apperr.Validation("el microservicio " + sk + " debe declarar al menos un módulo")
		}
		for _, m := range s.Modules {
			mk := strings.TrimSpace(m.ModuleKey)
			if mk == "" || strings.Contains(mk, "*") {
				return apperr.Validation("moduleKey inválido o comodín prohibido: " + m.ModuleKey)
			}
		}
		for _, sm := range s.Submodules {
			smk := strings.TrimSpace(sm.SubmoduleKey)
			if smk == "" || strings.Contains(smk, "*") {
				return apperr.Validation("submoduleKey inválido o comodín prohibido: " + sm.SubmoduleKey)
			}
		}
		for _, f := range s.Features {
			fk := strings.TrimSpace(f.FeatureKey)
			if fk == "" || strings.Contains(fk, "*") {
				return apperr.Validation("featureKey inválido o comodín prohibido: " + f.FeatureKey)
			}
		}
	}
	return nil
}

func ValidateSubscriptionState(catalog []ServiceManifest, activeServices, activeModules, activeFeatures []string) error {
	return ValidateSubscriptionState4(catalog, activeServices, activeModules, nil, activeFeatures)
}

func ValidateSubscriptionState4(catalog []ServiceManifest, activeServices, activeModules, activeSubmodules, activeFeatures []string) error {
	knownServices := make(map[string]bool, len(catalog))
	modOwner := make(map[string]string)
	type subRule struct {
		svc string
		mod string
	}
	type featRule struct {
		svc    string
		mod    string
		submod string
	}
	subMeta := make(map[string]subRule)
	featMeta := make(map[string]featRule)

	for _, s := range catalog {
		knownServices[s.ServiceKey] = true
		for _, m := range s.Modules {
			modOwner[m.ModuleKey] = s.ServiceKey
		}
		for _, sm := range s.Submodules {
			subMeta[sm.SubmoduleKey] = subRule{svc: s.ServiceKey, mod: sm.DependsOnModule}
		}
		for _, f := range s.Features {
			featMeta[f.FeatureKey] = featRule{svc: s.ServiceKey, mod: f.DependsOnModule, submod: f.DependsOnSubmodule}
		}
	}

	svcSet := make(map[string]bool, len(activeServices))
	for _, sk := range activeServices {
		sk = strings.TrimSpace(sk)
		if sk == "*" || !knownServices[sk] {
			return apperr.Validation("Microservicio desconocido o comodín no permitido: " + sk)
		}
		svcSet[sk] = true
	}

	modSet := make(map[string]bool, len(activeModules))
	for _, mk := range activeModules {
		mk = strings.TrimSpace(mk)
		owner, ok := modOwner[mk]
		if mk == "*" || !ok {
			return apperr.Validation("Módulo desconocido o comodín no permitido: " + mk)
		}
		if !svcSet[owner] {
			return apperr.Validation("El módulo " + mk + " requiere activar el microservicio " + owner)
		}
		modSet[mk] = true
	}

	subSet := make(map[string]bool)
	if activeSubmodules != nil {
		for _, smk := range activeSubmodules {
			smk = strings.TrimSpace(smk)
			meta, ok := subMeta[smk]
			if smk == "*" || !ok {
				return apperr.Validation("Submódulo desconocido o comodín no permitido: " + smk)
			}
			if !svcSet[meta.svc] {
				return apperr.Validation("El submódulo " + smk + " requiere activar el microservicio " + meta.svc)
			}
			if meta.mod != "" && !modSet[meta.mod] {
				return apperr.Validation("El submódulo " + smk + " depende del módulo " + meta.mod + ", que se encuentra desactivado")
			}
			subSet[smk] = true
		}
	}

	for _, fk := range activeFeatures {
		fk = strings.TrimSpace(fk)
		meta, ok := featMeta[fk]
		if fk == "*" || !ok {
			return apperr.Validation("Funcionalidad desconocida o comodín no permitida: " + fk)
		}
		if !svcSet[meta.svc] {
			return apperr.Validation("La funcionalidad " + fk + " requiere activar el microservicio " + meta.svc)
		}
		if meta.mod != "" && !modSet[meta.mod] {
			return apperr.Validation("La funcionalidad " + fk + " depende del módulo " + meta.mod + ", que se encuentra desactivado")
		}
		if activeSubmodules != nil && meta.submod != "" && !subSet[meta.submod] {
			return apperr.Validation("La funcionalidad " + fk + " depende del submódulo " + meta.submod + ", que se encuentra desactivado")
		}
	}
	return nil
}

func HasService(ctx context.Context, serviceKey string) bool {
	tc := authguard.FromContext(ctx)
	return containsExact(tc.ActiveServices, serviceKey)
}

func HasModule(ctx context.Context, moduleKey string) bool {
	tc := authguard.FromContext(ctx)
	return containsExact(tc.ActiveModules, moduleKey)
}

func HasSubmodule(ctx context.Context, requiredModule, submoduleKey string) bool {
	tc := authguard.FromContext(ctx)
	if requiredModule != "" && !containsExact(tc.ActiveModules, requiredModule) {
		return false
	}
	if tc.ActiveSubmodules == nil {
		return true
	}
	return containsExact(tc.ActiveSubmodules, submoduleKey)
}

func HasFeature(ctx context.Context, requiredModule, featureKey string) bool {
	tc := authguard.FromContext(ctx)
	if requiredModule != "" && !containsExact(tc.ActiveModules, requiredModule) {
		return false
	}
	return containsExact(tc.ActiveFeatures, featureKey)
}

func CheckModule(ctx context.Context, moduleKey string) error {
	if !HasModule(ctx, moduleKey) {
		return apperr.Forbidden("El módulo " + moduleKey + " no está activo en la suscripción de esta empresa")
	}
	return nil
}

func CheckSubmodule(ctx context.Context, requiredModule, submoduleKey string) error {
	if !HasSubmodule(ctx, requiredModule, submoduleKey) {
		return apperr.Forbidden("El submódulo " + submoduleKey + " no está activo en la suscripción de esta empresa")
	}
	return nil
}

func CheckFeature(ctx context.Context, requiredModule, featureKey string) error {
	if !HasFeature(ctx, requiredModule, featureKey) {
		return apperr.Forbidden("La funcionalidad " + featureKey + " no está activa en la suscripción de esta empresa")
	}
	return nil
}

func containsExact(list []string, target string) bool {
	for _, item := range list {
		if item == target {
			return true
		}
	}
	return false
}
