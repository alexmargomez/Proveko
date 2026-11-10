package licensegate

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/alexmargomez/proveko/pkg/authguard"
	"github.com/alexmargomez/proveko/pkg/httpx"
)

type ModuleManifest struct {
	ModuleKey     string `json:"moduleKey"`
	DisplayName   string `json:"displayName"`
	TabIcon       string `json:"tabIcon"`
	DefaultActive bool   `json:"defaultActive"`
	Summary       string `json:"summary"`
}

type FeatureManifest struct {
	FeatureKey      string `json:"featureKey"`
	DisplayName     string `json:"displayName"`
	DependsOnModule string `json:"dependsOnModule"`
	DefaultActive   bool   `json:"defaultActive"`
}

type ServiceManifest struct {
	ServiceKey  string            `json:"serviceKey"`
	DisplayName string            `json:"displayName"`
	Icon        string            `json:"icon"`
	APIPrefix   string            `json:"apiPrefix"`
	Category    string            `json:"category"`
	Summary     string            `json:"summary"`
	Modules     []ModuleManifest  `json:"modules"`
	Features    []FeatureManifest `json:"features"`
}

// ValidateSubscriptionState aplica la regla inquebrantable de los 4 niveles:
// 1. Ningún módulo o funcionalidad de un microservicio puede estar activo si el microservicio no está activo.
// 2. Ninguna funcionalidad con DependsOnModule puede activarse si su módulo requerido está desactivado.
func ValidateSubscriptionState(catalog []ServiceManifest, activeServices, activeModules, activeFeatures []string) error {
	svcSet := toSet(activeServices)
	modSet := toSet(activeModules)

	modOwner := map[string]string{}
	featMeta := map[string]struct {
		svc string
		mod string
	}{}

	for _, s := range catalog {
		for _, m := range s.Modules {
			modOwner[m.ModuleKey] = s.ServiceKey
		}
		for _, f := range s.Features {
			featMeta[f.FeatureKey] = struct {
				svc string
				mod string
			}{svc: s.ServiceKey, mod: f.DependsOnModule}
		}
	}

	for _, mk := range activeModules {
		if owner, ok := modOwner[mk]; ok && !svcSet[owner] {
			return fmt.Errorf("el módulo %s requiere que el microservicio %s esté activo", mk, owner)
		}
	}
	for _, fk := range activeFeatures {
		meta, ok := featMeta[fk]
		if !ok {
			return errors.New("funcionalidad desconocida: " + fk)
		}
		if !svcSet[meta.svc] {
			return fmt.Errorf("la funcionalidad %s requiere que el microservicio %s esté activo", fk, meta.svc)
		}
		if meta.mod != "" && !modSet[meta.mod] {
			return fmt.Errorf("la funcionalidad %s depende del módulo %s, el cual está desactivado", fk, meta.mod)
		}
	}
	return nil
}

func HasService(ctx context.Context, serviceKey string) bool {
	tc := authguard.FromContext(ctx)
	if len(tc.ActiveServices) == 0 {
		return true
	}
	return contains(tc.ActiveServices, serviceKey)
}

func HasModule(ctx context.Context, moduleKey string) bool {
	tc := authguard.FromContext(ctx)
	if len(tc.ActiveModules) == 0 {
		return true
	}
	return contains(tc.ActiveModules, moduleKey)
}

func HasFeature(ctx context.Context, requiredModule, featureKey string) bool {
	tc := authguard.FromContext(ctx)
	if len(tc.ActiveFeatures) == 0 && len(tc.ActiveModules) == 0 {
		return false
	}
	if requiredModule != "" && !contains(tc.ActiveModules, requiredModule) {
		return false
	}
	return contains(tc.ActiveFeatures, featureKey)
}

func RequireModule(moduleKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !HasModule(r.Context(), moduleKey) {
				httpx.Error(w, http.StatusForbidden, "El módulo "+moduleKey+" no está habilitado para esta empresa")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func toSet(items []string) map[string]bool {
	m := make(map[string]bool, len(items))
	for _, it := range items {
		m[it] = true
	}
	return m
}

func contains(list []string, target string) bool {
	for _, it := range list {
		if it == target || it == "*" {
			return true
		}
	}
	return false
}
