package domain

import (
	"strings"

	"ms-core/internal/platform/licensegate"
)

type TenantUser struct {
	UserID          string   `json:"userId"`
	TenantID        string   `json:"tenantId"`
	Username        string   `json:"username"`
	Email           string   `json:"email"`
	FullName        string   `json:"fullName"`
	PasswordHash    string   `json:"-"`
	InternalRole    string   `json:"internalRole"`
	IsCompanyAdmin  bool     `json:"isCompanyAdmin"`
	AllowedServices []string `json:"allowedServices"`
	AllowedModules  []string `json:"allowedModules"`
	Status          string   `json:"status"`
	SessionVersion  int      `json:"sessionVersion"`
	CreatedAt       string   `json:"createdAt"`
}

func (u *TenantUser) Clone() *TenantUser {
	if u == nil {
		return nil
	}
	cp := *u
	if cp.SessionVersion <= 0 {
		cp.SessionVersion = 1
	}
	cp.AllowedServices = cloneStrings(u.AllowedServices)
	cp.AllowedModules = cloneStrings(u.AllowedModules)
	return &cp
}

type CreateTenantUserInput struct {
	Username        string   `json:"username"`
	Email           string   `json:"email"`
	FullName        string   `json:"fullName"`
	Password        string   `json:"password"`
	InternalRole    string   `json:"internalRole"`
	IsCompanyAdmin  bool     `json:"isCompanyAdmin"`
	AllowedServices []string `json:"allowedServices"`
	AllowedModules  []string `json:"allowedModules"`
}

type UpdateTenantUserInput struct {
	FullName        string   `json:"fullName"`
	Email           string   `json:"email"`
	Password        string   `json:"password"`
	InternalRole    string   `json:"internalRole"`
	IsCompanyAdmin  *bool    `json:"isCompanyAdmin,omitempty"`
	AllowedServices []string `json:"allowedServices"`
	AllowedModules  []string `json:"allowedModules"`
	Status          string   `json:"status"`
}

type ModuleActivationRequest struct {
	RequestID       string   `json:"requestId"`
	TenantID        string   `json:"tenantId"`
	CompanyName     string   `json:"companyName"`
	RequestedBy     string   `json:"requestedBy"`
	AddedServices   []string `json:"addedServices"`
	AddedModules    []string `json:"addedModules"`
	AddedSubmodules []string `json:"addedSubmodules"`
	AddedFeatures   []string `json:"addedFeatures"`
	MonthlyCopAfter int64    `json:"monthlyCopAfter"`
	Status          string   `json:"status"`
	CreatedAt       string   `json:"createdAt"`
}

type BusinessPresetSpec struct {
	Key              string   `json:"key"`
	Name             string   `json:"name"`
	Badge            string   `json:"badge"`
	Description      string   `json:"description"`
	BaseMonthlyCop   int64    `json:"baseMonthlyCop"`
	IncludedServices []string `json:"includedServices"`
}

type PricingMatrixCOP struct {
	ExtraServiceCop   int64 `json:"extraServiceCop"`
	ExtraModuleCop    int64 `json:"extraModuleCop"`
	ExtraSubmoduleCop int64 `json:"extraSubmoduleCop"`
	ExtraFeatureCop   int64 `json:"extraFeatureCop"`
}

type RoleTemplateSpec struct {
	RoleKey             string   `json:"roleKey"`
	DisplayName         string   `json:"displayName"`
	Description         string   `json:"description"`
	IsCompanyAdmin      bool     `json:"isCompanyAdmin"`
	RecommendedServices []string `json:"recommendedServices"`
	RecommendedModules  []string `json:"recommendedModules"`
}

type EffectiveLicense struct {
	ActiveServices   []string `json:"activeServices"`
	ActiveModules    []string `json:"activeModules"`
	ActiveSubmodules []string `json:"activeSubmodules"`
	ActiveFeatures   []string `json:"activeFeatures"`
}

func DefaultPricingMatrixCOP() PricingMatrixCOP {
	return PricingMatrixCOP{
		ExtraServiceCop:   35000,
		ExtraModuleCop:    15000,
		ExtraSubmoduleCop: 9000,
		ExtraFeatureCop:   5000,
	}
}

func OfficialBusinessPresets(cat []licensegate.ServiceManifest) []BusinessPresetSpec {
	allKeys := make([]string, 0, len(cat))
	for _, s := range cat {
		allKeys = append(allKeys, s.ServiceKey)
	}
	return []BusinessPresetSpec{
		{
			Key:              "comercio",
			Name:             "Comercio, Tienda y Ferretería",
			Badge:            "Comercio y Ventas",
			Description:      "Punto de Venta POS, Inventario, Compras a Proveedores, Clientes y Cartera, Cuadre de Caja y Reportes.",
			BaseMonthlyCop:   169000,
			IncludedServices: []string{"ms-facturacion", "ms-inventario", "ms-compras", "ms-clientes", "ms-caja", "ms-reportes", "ms-impresiones"},
		},
		{
			Key:              "restaurante",
			Name:             "Restaurante, Gastrobar y Cafetería",
			Badge:            "Gastronomía",
			Description:      "Mapa de Mesas, Comandas de Cocina y Barra, División de Cuentas, POS, Inventario, Caja y Reportes.",
			BaseMonthlyCop:   199000,
			IncludedServices: []string{"ms-comandas", "ms-facturacion", "ms-inventario", "ms-compras", "ms-clientes", "ms-caja", "ms-reportes", "ms-impresiones"},
		},
		{
			Key:              "bares",
			Name:             "Bares, Licores y Eventos",
			Badge:            "Bares y Acceso",
			Description:      "Mesas y Barra, Taquilla y Entradas con QR, POS Rápido, Control de Licores y Arqueo de Turno.",
			BaseMonthlyCop:   199000,
			IncludedServices: []string{"ms-comandas", "ms-taquilla", "ms-facturacion", "ms-inventario", "ms-clientes", "ms-caja", "ms-reportes", "ms-impresiones"},
		},
		{
			Key:              "automotriz",
			Name:             "Centro Automotriz, Taller y Repuestos",
			Badge:            "Taller y Repuestos",
			Description:      "Recepción de Vehículos, Tablero de Órdenes de Servicio, Comisiones de Técnicos, Bodega de Repuestos y POS.",
			BaseMonthlyCop:   229000,
			IncludedServices: []string{"ms-taller", "ms-inventario", "ms-compras", "ms-facturacion", "ms-clientes", "ms-caja", "ms-reportes", "ms-impresiones"},
		},
		{
			Key:              "hotel",
			Name:             "Hoteles, Cabañas, Clubes y Pasadías",
			Badge:            "Hotelería y Turismo",
			Description:      "Rack de Habitaciones, Check-In / Check-Out, Reservas, Restaurante, Pasadías/Taquilla y Facturación.",
			BaseMonthlyCop:   229000,
			IncludedServices: []string{"ms-hoteleria", "ms-taquilla", "ms-comandas", "ms-facturacion", "ms-clientes", "ms-caja", "ms-reportes", "ms-impresiones"},
		},
		{
			Key:              "citas",
			Name:             "Centros de Servicios, Consultorios y Agenda",
			Badge:            "Agenda y Convenios",
			Description:      "Agenda de Citas y Profesionales, Directorio de Clientes y Convenios, Cartera, Caja y Facturación.",
			BaseMonthlyCop:   249000,
			IncludedServices: []string{"ms-agenda", "ms-clientes", "ms-facturacion", "ms-inventario", "ms-caja", "ms-reportes", "ms-impresiones"},
		},
		{
			Key:              "mayorista",
			Name:             "Distribuidora Mayorista y Multi-Bodega",
			Badge:            "Mayorista y Finanzas",
			Description:      "Facturación, Cotizaciones, Multi-Bodega, Órdenes de Compra, Cartera CxC/CxP, Contabilidad PUC y Reportes.",
			BaseMonthlyCop:   259000,
			IncludedServices: []string{"ms-facturacion", "ms-inventario", "ms-compras", "ms-caja", "ms-clientes", "ms-contabilidad", "ms-reportes", "ms-impresiones"},
		},
		{
			Key:              "logistica",
			Name:             "Agroindustria, Transporte de Carga y Báscula",
			Badge:            "Pesaje y Flota",
			Description:      "Pesaje Camionero (Bruto/Tara/Neto), Despachos, Bodegas, Compras, Tesorería, Contabilidad y Tiquetes.",
			BaseMonthlyCop:   289000,
			IncludedServices: []string{"ms-bascula", "ms-inventario", "ms-compras", "ms-facturacion", "ms-caja", "ms-clientes", "ms-contabilidad", "ms-reportes", "ms-impresiones"},
		},
		{
			Key:              "full",
			Name:             "Suite Empresarial Integral Multi-Sede",
			Badge:            "Suite Completa",
			Description:      "Incluye las 15 áreas operativas: Comercial, Inventario, Gastronomía, Hotelería, Taller, Báscula, Nómina y Contabilidad.",
			BaseMonthlyCop:   389000,
			IncludedServices: allKeys,
		},
	}
}

func FindPresetSpec(cat []licensegate.ServiceManifest, rawKey string) (BusinessPresetSpec, bool) {
	k := strings.ToLower(strings.TrimSpace(rawKey))
	aliases := map[string]string{
		"comercio-retail":          "comercio",
		"comercio minorista":       "comercio",
		"comercio mayorista":       "mayorista",
		"distribuidora-mayorista":  "mayorista",
		"restaurante-gastro":       "restaurante",
		"bares-discotecas":         "bares",
		"taller":                   "automotriz",
		"hospitalidad":             "hotel",
		"reservas-tickets-hotel":   "hotel",
		"servicios":                "citas",
		"bascula":                  "logistica",
		"agro-logistica-bascula":   "logistica",
		"erp-corporativo-integral": "full",
		"general":                  "full",
	}
	if mapped, ok := aliases[k]; ok {
		k = mapped
	}
	presets := OfficialBusinessPresets(cat)
	for _, p := range presets {
		if p.Key == k {
			return p, true
		}
	}
	return BusinessPresetSpec{}, false
}

func CalculateSubscriptionCop(cat []licensegate.ServiceManifest, presetKey string, activeSvcs []string) int64 {
	pricing := DefaultPricingMatrixCOP()
	preset, ok := FindPresetSpec(cat, presetKey)
	if !ok {
		preset, _ = FindPresetSpec(cat, "comercio")
	}
	if preset.Key == "full" {
		return preset.BaseMonthlyCop
	}
	baseSet := make(map[string]bool, len(preset.IncludedServices))
	for _, s := range preset.IncludedServices {
		baseSet[s] = true
	}
	total := preset.BaseMonthlyCop
	for _, sk := range activeSvcs {
		if !baseSet[sk] && sk != "ms-impresiones" {
			total += pricing.ExtraServiceCop
		}
	}
	if total > 389000 {
		total = 389000
	}
	return total
}

func OfficialRoleTemplates() []RoleTemplateSpec {
	return []RoleTemplateSpec{
		{
			RoleKey:             "admin_empresa",
			DisplayName:         "Administrador General",
			Description:         "Control total de la empresa, creación de empleados, asignación de permisos y activación de módulos.",
			IsCompanyAdmin:      true,
			RecommendedServices: []string{"*"},
			RecommendedModules:  []string{"*"},
		},
		{
			RoleKey:             "cajero",
			DisplayName:         "Cajero y Facturador",
			Description:         "Punto de Venta POS, emisión de facturas, clientes y cuadre de turno en caja.",
			IsCompanyAdmin:      false,
			RecommendedServices: []string{"ms-facturacion", "ms-caja", "ms-clientes", "ms-impresiones"},
			RecommendedModules:  []string{"pos_mostrador", "facturacion_dian", "cotizaciones", "arqueo_turnos", "recibos_egresos", "directorio_clientes", "cartera_cxc"},
		},
		{
			RoleKey:             "vendedor",
			DisplayName:         "Asesor Comercial / Mostrador",
			Description:         "Cotizaciones, ventas de mostrador, consulta de existencias, reservas y atención de clientes.",
			IsCompanyAdmin:      false,
			RecommendedServices: []string{"ms-facturacion", "ms-clientes", "ms-inventario", "ms-agenda", "ms-taquilla", "ms-impresiones"},
			RecommendedModules:  []string{"pos_mostrador", "cotizaciones", "directorio_clientes", "catalogo_productos"},
		},
		{
			RoleKey:             "mesero",
			DisplayName:         "Mesero / Atención de Salón",
			Description:         "Mapa de mesas, toma de pedidos, adiciones, división de cuentas y envío de comandas.",
			IsCompanyAdmin:      false,
			RecommendedServices: []string{"ms-comandas", "ms-clientes", "ms-impresiones"},
			RecommendedModules:  []string{},
		},
		{
			RoleKey:             "cocina",
			DisplayName:         "Cocina y Barra (KDS)",
			Description:         "Tablero de preparación de comandas en tiempo real y despacho a salón.",
			IsCompanyAdmin:      false,
			RecommendedServices: []string{"ms-comandas"},
			RecommendedModules:  []string{},
		},
		{
			RoleKey:             "bodega",
			DisplayName:         "Jefe de Bodega y Compras",
			Description:         "Catálogo de productos, existencias multi-bodega, traslados, órdenes de compra y pesaje.",
			IsCompanyAdmin:      false,
			RecommendedServices: []string{"ms-inventario", "ms-compras", "ms-bascula", "ms-impresiones"},
			RecommendedModules:  []string{},
		},
		{
			RoleKey:             "tecnico",
			DisplayName:         "Técnico / Jefe de Taller",
			Description:         "Recepción de vehículos, órdenes de trabajo, diagnóstico, repuestos y liquidación técnica.",
			IsCompanyAdmin:      false,
			RecommendedServices: []string{"ms-taller", "ms-inventario", "ms-agenda", "ms-impresiones"},
			RecommendedModules:  []string{},
		},
		{
			RoleKey:             "recepcion",
			DisplayName:         "Recepción Hotelera y Reservas",
			Description:         "Rack de habitaciones, check-in, check-out, reservas, cargos a huésped y clientes.",
			IsCompanyAdmin:      false,
			RecommendedServices: []string{"ms-hoteleria", "ms-agenda", "ms-clientes", "ms-facturacion", "ms-impresiones"},
			RecommendedModules:  []string{},
		},
		{
			RoleKey:             "contador",
			DisplayName:         "Contador y Nómina",
			Description:         "Plan Único de Cuentas PUC, comprobantes contables, liquidación de nómina e informes gerenciales.",
			IsCompanyAdmin:      false,
			RecommendedServices: []string{"ms-contabilidad", "ms-nomina", "ms-reportes", "ms-facturacion", "ms-compras", "ms-caja", "ms-impresiones"},
			RecommendedModules:  []string{},
		},
	}
}

func ComputeEffectiveLicense(tenant *Tenant, user *TenantUser, callerRole string, cat []licensegate.ServiceManifest) EffectiveLicense {
	if tenant == nil {
		return EffectiveLicense{}
	}
	if callerRole == RoleSuperAdmin {
		return EffectiveLicense{
			ActiveServices:   cloneStrings(tenant.ActiveServices),
			ActiveModules:    cloneStrings(tenant.ActiveModules),
			ActiveSubmodules: cloneStrings(tenant.ActiveSubmodules),
			ActiveFeatures:   cloneStrings(tenant.ActiveFeatures),
		}
	}
	if user == nil {
		return EffectiveLicense{}
	}
	if user.IsCompanyAdmin || hasWildcard(user.AllowedServices) {
		return EffectiveLicense{
			ActiveServices:   cloneStrings(tenant.ActiveServices),
			ActiveModules:    cloneStrings(tenant.ActiveModules),
			ActiveSubmodules: cloneStrings(tenant.ActiveSubmodules),
			ActiveFeatures:   cloneStrings(tenant.ActiveFeatures),
		}
	}

	tenantSvcSet := toSet(tenant.ActiveServices)
	userSvcSet := toSet(user.AllowedServices)

	effSvcs := make([]string, 0, len(tenant.ActiveServices))
	effSvcSet := make(map[string]bool)
	for _, sk := range tenant.ActiveServices {
		if userSvcSet[sk] || (sk == "ms-impresiones" && len(user.AllowedServices) > 0) {
			effSvcs = append(effSvcs, sk)
			effSvcSet[sk] = true
		}
	}

	modOwner := make(map[string]string)
	subOwner := make(map[string]licensegate.SubmoduleManifest)
	subSvc := make(map[string]string)
	featOwner := make(map[string]licensegate.FeatureManifest)
	featSvc := make(map[string]string)

	for _, svc := range cat {
		if !tenantSvcSet[svc.ServiceKey] {
			continue
		}
		for _, m := range svc.Modules {
			modOwner[m.ModuleKey] = svc.ServiceKey
		}
		for _, sm := range svc.Submodules {
			subOwner[sm.SubmoduleKey] = sm
			subSvc[sm.SubmoduleKey] = svc.ServiceKey
		}
		for _, f := range svc.Features {
			featOwner[f.FeatureKey] = f
			featSvc[f.FeatureKey] = svc.ServiceKey
		}
	}

	wildcardMods := hasWildcard(user.AllowedModules)
	noModRestriction := len(user.AllowedModules) == 0
	userModSet := toSet(user.AllowedModules)

	effMods := make([]string, 0, len(tenant.ActiveModules))
	effModSet := make(map[string]bool)
	for _, mk := range tenant.ActiveModules {
		ownerSvc := modOwner[mk]
		if !effSvcSet[ownerSvc] {
			continue
		}
		if wildcardMods || noModRestriction || userModSet[mk] || ownerSvc == "ms-impresiones" {
			effMods = append(effMods, mk)
			effModSet[mk] = true
		}
	}

	if !wildcardMods && !noModRestriction {
		svcHasAnyMod := make(map[string]bool)
		for _, mk := range effMods {
			svcHasAnyMod[modOwner[mk]] = true
		}
		hasUnknownMod := false
		for um := range userModSet {
			if _, known := modOwner[um]; !known {
				hasUnknownMod = true
				break
			}
		}
		if !hasUnknownMod {
			for _, mk := range tenant.ActiveModules {
				ownerSvc := modOwner[mk]
				if effSvcSet[ownerSvc] && !svcHasAnyMod[ownerSvc] {
					specifiedAnyForSvc := false
					for um := range userModSet {
						if modOwner[um] == ownerSvc {
							specifiedAnyForSvc = true
							break
						}
					}
					if !specifiedAnyForSvc {
						effMods = append(effMods, mk)
						effModSet[mk] = true
					}
				}
			}
		}
	}

	effSubs := make([]string, 0, len(tenant.ActiveSubmodules))
	effSubSet := make(map[string]bool)
	for _, sk := range tenant.ActiveSubmodules {
		sm, ok := subOwner[sk]
		if !ok || !effSvcSet[subSvc[sk]] {
			continue
		}
		if sm.DependsOnModule != "" && !effModSet[sm.DependsOnModule] {
			continue
		}
		effSubs = append(effSubs, sk)
		effSubSet[sk] = true
	}

	effFeats := make([]string, 0, len(tenant.ActiveFeatures))
	for _, fk := range tenant.ActiveFeatures {
		fm, ok := featOwner[fk]
		if !ok || !effSvcSet[featSvc[fk]] {
			continue
		}
		if fm.DependsOnModule != "" && !effModSet[fm.DependsOnModule] {
			continue
		}
		if fm.DependsOnSubmodule != "" && !effSubSet[fm.DependsOnSubmodule] {
			continue
		}
		effFeats = append(effFeats, fk)
	}

	return EffectiveLicense{
		ActiveServices:   effSvcs,
		ActiveModules:    effMods,
		ActiveSubmodules: effSubs,
		ActiveFeatures:   effFeats,
	}
}

func hasWildcard(items []string) bool {
	for _, it := range items {
		if strings.TrimSpace(it) == "*" {
			return true
		}
	}
	return false
}

func toSet(items []string) map[string]bool {
	out := make(map[string]bool, len(items))
	for _, it := range items {
		v := strings.TrimSpace(it)
		if v != "" {
			out[v] = true
		}
	}
	return out
}
