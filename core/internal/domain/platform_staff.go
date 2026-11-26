package domain

import "strings"

const (
	PlaneTenant   = "tenant"
	PlanePlatform = "platform"

	PlatformRoleSuperAdmin       = "superadmin"
	PlatformRoleAdminOperaciones = "admin_operaciones"
	PlatformRoleSoporteN1        = "soporte_n1"
	PlatformRoleSoporteN2        = "soporte_n2"
	PlatformRoleDesarrollador    = "desarrollador"
	PlatformRoleComercial        = "comercial"
	PlatformRoleFacturacionSaaS  = "facturacion_saas"
	PlatformRoleAuditor          = "auditor"
)

type PlatformPermissionSpec struct {
	Key         string `json:"key"`
	Category    string `json:"category"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Sensitive   bool   `json:"sensitive,omitempty"`
}

type PlatformRole struct {
	RoleKey           string   `json:"roleKey"`
	DisplayName       string   `json:"displayName"`
	Description       string   `json:"description"`
	IsSystem          bool     `json:"isSystem"`
	RequireMFA        bool     `json:"requireMfa"`
	RequireDataReason bool     `json:"requireDataReason"`
	Permissions       []string `json:"permissions"`
	CreatedAt         string   `json:"createdAt"`
	UpdatedAt         string   `json:"updatedAt"`
}

func (r *PlatformRole) Clone() *PlatformRole {
	if r == nil {
		return nil
	}
	cp := *r
	cp.Permissions = cloneStrings(r.Permissions)
	return &cp
}

type PlatformUser struct {
	UserID             string   `json:"userId"`
	Email              string   `json:"email"`
	FullName           string   `json:"fullName"`
	PasswordHash       string   `json:"-"`
	RoleKey            string   `json:"roleKey"`
	Status             string   `json:"status"`
	MFAEnabled         bool     `json:"mfaEnabled"`
	MFARequired        bool     `json:"mfaRequired"`
	MFASecretEncrypted string   `json:"-"`
	AllowedTenants     []string `json:"allowedTenants"`
	SessionVersion     int      `json:"sessionVersion"`
	LastLoginAt        string   `json:"lastLoginAt"`
	CreatedAt          string   `json:"createdAt"`
	UpdatedAt          string   `json:"updatedAt"`
}

func (u *PlatformUser) Clone() *PlatformUser {
	if u == nil {
		return nil
	}
	cp := *u
	if cp.SessionVersion <= 0 {
		cp.SessionVersion = 1
	}
	cp.AllowedTenants = cloneStrings(u.AllowedTenants)
	return &cp
}

type CreatePlatformRoleInput struct {
	RoleKey           string   `json:"roleKey"`
	DisplayName       string   `json:"displayName"`
	Description       string   `json:"description"`
	RequireMFA        bool     `json:"requireMfa"`
	RequireDataReason bool     `json:"requireDataReason"`
	Permissions       []string `json:"permissions"`
}

type UpdatePlatformRoleInput struct {
	DisplayName       string   `json:"displayName"`
	Description       string   `json:"description"`
	RequireMFA        *bool    `json:"requireMfa,omitempty"`
	RequireDataReason *bool    `json:"requireDataReason,omitempty"`
	Permissions       []string `json:"permissions"`
}

type CreatePlatformUserInput struct {
	Email          string   `json:"email"`
	FullName       string   `json:"fullName"`
	Password       string   `json:"password"`
	RoleKey        string   `json:"roleKey"`
	MFARequired    bool     `json:"mfaRequired"`
	AllowedTenants []string `json:"allowedTenants"`
}

type UpdatePlatformUserInput struct {
	FullName       string   `json:"fullName"`
	Password       string   `json:"password"`
	RoleKey        string   `json:"roleKey"`
	Status         string   `json:"status"`
	MFARequired    *bool    `json:"mfaRequired,omitempty"`
	AllowedTenants []string `json:"allowedTenants"`
}

type ServiceCommercialOverride struct {
	ServiceKey         string `json:"serviceKey"`
	PubliclySellable   bool   `json:"publiclySellable"`
	VisibleInStore     bool   `json:"visibleInStore"`
	CustomExtraCop     int64  `json:"customExtraCop,omitempty"`
	CustomDisplayName  string `json:"customDisplayName,omitempty"`
	MaintenanceBlocked bool   `json:"maintenanceBlocked,omitempty"`
}

type PresetCommercialOverride struct {
	PresetKey        string `json:"presetKey"`
	VisibleInStore   bool   `json:"visibleInStore"`
	CustomMonthlyCop int64  `json:"customMonthlyCop,omitempty"`
}

type CatalogOverrideConfig struct {
	Services map[string]ServiceCommercialOverride `json:"services"`
	Presets  map[string]PresetCommercialOverride  `json:"presets"`
	Pricing  *PricingMatrixCOP                    `json:"pricing,omitempty"`
}

func DefaultCatalogOverrideConfig() CatalogOverrideConfig {
	return CatalogOverrideConfig{
		Services: make(map[string]ServiceCommercialOverride),
		Presets:  make(map[string]PresetCommercialOverride),
	}
}

func OfficialPlatformPermissions() []PlatformPermissionSpec {
	return []PlatformPermissionSpec{
		// 1. Empresas (Tenants)
		{Key: "empresas.ver", Category: "Empresas", Label: "Ver empresas", Description: "Listar empresas registradas y ver su ficha técnica y licencias."},
		{Key: "empresas.crear", Category: "Empresas", Label: "Crear empresas", Description: "Aprovisionar nuevas empresas y bases de datos aisladas."},
		{Key: "empresas.editar_suscripcion", Category: "Empresas", Label: "Editar suscripciones", Description: "Activar o desactivar microservicios, módulos, submódulos y funciones."},
		{Key: "empresas.editar_cuotas", Category: "Empresas", Label: "Editar cuotas y tarifas", Description: "Ajustar cupo máximo de usuarios y tarifa mensual personalizada."},
		{Key: "empresas.suspender", Category: "Empresas", Label: "Suspender y reactivar", Description: "Suspender o reactivar el acceso operativo de una empresa.", Sensitive: true},
		{Key: "empresas.mantenimiento", Category: "Empresas", Label: "Modo mantenimiento", Description: "Activar modo mantenimiento individual por empresa con mensaje personalizado."},

		// 2. Usuarios de Clientes
		{Key: "usuarios_cliente.ver", Category: "Usuarios de Clientes", Label: "Ver usuarios de clientes", Description: "Consultar el directorio de usuarios internos de una empresa."},
		{Key: "usuarios_cliente.crear", Category: "Usuarios de Clientes", Label: "Crear usuarios de clientes", Description: "Crear usuarios internos en nombre de una empresa cliente."},
		{Key: "usuarios_cliente.editar", Category: "Usuarios de Clientes", Label: "Editar y suspender usuarios", Description: "Modificar roles, módulos permitidos o suspender usuarios de un cliente."},
		{Key: "usuarios_cliente.reset_password", Category: "Usuarios de Clientes", Label: "Restablecer contraseñas", Description: "Establecer una nueva contraseña segura para un usuario de cliente.", Sensitive: true},
		{Key: "usuarios_cliente.revocar_sesiones", Category: "Usuarios de Clientes", Label: "Revocar sesiones activas", Description: "Invalidar inmediatamente todos los tokens activos de un usuario o empresa.", Sensitive: true},

		// 3. Datos de Negocio y Soporte
		{Key: "datos_negocio.ver", Category: "Datos de Negocio y Soporte", Label: "Ver datos de negocio del cliente", Description: "Permite abrir la vista de soporte sobre datos operativos del cliente.", Sensitive: true},
		{Key: "soporte.impersonar_lectura", Category: "Datos de Negocio y Soporte", Label: "Ingresar como soporte (Solo Lectura)", Description: "Impersonar la estación de un cliente bloqueando cualquier mutación.", Sensitive: true},
		{Key: "soporte.impersonar_escritura", Category: "Datos de Negocio y Soporte", Label: "Ingresar como soporte (Lectura y Escritura)", Description: "Impersonar la estación de un cliente con capacidad de corrección operativa.", Sensitive: true},
		{Key: "datos_negocio.exportar_csv", Category: "Datos de Negocio y Soporte", Label: "Exportar datos del cliente (ZIP CSV)", Description: "Generar y descargar un paquete ZIP con tablas CSV compatibles con Excel.", Sensitive: true},

		// 4. Catálogo Comercial y Flags
		{Key: "catalogo.ver", Category: "Catálogo y Flags", Label: "Ver catálogo comercial", Description: "Consultar precios, paquetes, visibilidad comercial y feature flags."},
		{Key: "catalogo.editar_visibilidad", Category: "Catálogo y Flags", Label: "Visibilidad de servicios", Description: "Ocultar o publicar servicios y paquetes en el registro público y tienda."},
		{Key: "catalogo.editar_precios", Category: "Catálogo y Flags", Label: "Editar precios comerciales", Description: "Modificar precios base de paquetes y valores de servicios adicionales.", Sensitive: true},
		{Key: "catalogo.feature_flags", Category: "Catálogo y Flags", Label: "Gestionar feature flags", Description: "Activar o desactivar flags globales o por empresa específica."},

		// 5. Plataforma y Personal Interno
		{Key: "plataforma.usuarios_ver", Category: "Personal y Plataforma", Label: "Ver personal interno", Description: "Consultar la lista de operadores, soporte y administradores de plataforma."},
		{Key: "plataforma.usuarios_gestionar", Category: "Personal y Plataforma", Label: "Gestionar personal interno", Description: "Crear, editar, suspender operadores y configurar su 2FA TOTP.", Sensitive: true},
		{Key: "plataforma.roles_gestionar", Category: "Personal y Plataforma", Label: "Gestionar roles y permisos", Description: "Crear roles personalizados y activar o desactivar switches de permisos.", Sensitive: true},
		{Key: "plataforma.anuncios", Category: "Personal y Plataforma", Label: "Publicar anuncios globales", Description: "Emitir banners informativos o avisos de mantenimiento hacia clientes."},
		{Key: "plataforma.salud_servicios", Category: "Personal y Plataforma", Label: "Ver salud de microservicios", Description: "Inspeccionar el registro y estado de salud de los microservicios."},

		// 6. Auditoría
		{Key: "auditoria.ver", Category: "Auditoría", Label: "Consultar bitácora de auditoría", Description: "Inspeccionar el registro inmutable de acciones administrativas."},
		{Key: "auditoria.exportar", Category: "Auditoría", Label: "Exportar bitácora de auditoría", Description: "Descargar el historial de auditoría en formato CSV."},
	}
}

func IsValidPlatformPermission(key string) bool {
	clean := strings.TrimSpace(key)
	if clean == "*" {
		return true
	}
	for _, spec := range OfficialPlatformPermissions() {
		if spec.Key == clean {
			return true
		}
	}
	return false
}

func OfficialPlatformRoles(now string) []*PlatformRole {
	return []*PlatformRole{
		{
			RoleKey:           PlatformRoleSuperAdmin,
			DisplayName:       "SuperAdministrador",
			Description:       "Control total de la plataforma, personal interno, roles, catálogo comercial y empresas.",
			IsSystem:          true,
			RequireMFA:        false,
			RequireDataReason: false,
			Permissions:       []string{"*"},
			CreatedAt:         now,
			UpdatedAt:         now,
		},
		{
			RoleKey:           PlatformRoleAdminOperaciones,
			DisplayName:       "Administrador de Operaciones",
			Description:       "Gestiona empresas, licencias, cuotas, usuarios de clientes, catálogo y anuncios sin administrar personal interno.",
			IsSystem:          true,
			RequireMFA:        false,
			RequireDataReason: true,
			Permissions: []string{
				"empresas.ver", "empresas.crear", "empresas.editar_suscripcion", "empresas.editar_cuotas",
				"empresas.suspender", "empresas.mantenimiento",
				"usuarios_cliente.ver", "usuarios_cliente.crear", "usuarios_cliente.editar",
				"usuarios_cliente.reset_password", "usuarios_cliente.revocar_sesiones",
				"catalogo.ver", "catalogo.editar_visibilidad", "catalogo.feature_flags",
				"plataforma.anuncios", "plataforma.salud_servicios",
				"auditoria.ver",
			},
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			RoleKey:           PlatformRoleSoporteN1,
			DisplayName:       "Soporte Técnico N1",
			Description:       "Atención al cliente, gestión de usuarios, reinicio de contraseñas y soporte en modo solo lectura con motivo auditado.",
			IsSystem:          true,
			RequireMFA:        false,
			RequireDataReason: true,
			Permissions: []string{
				"empresas.ver",
				"usuarios_cliente.ver", "usuarios_cliente.editar", "usuarios_cliente.reset_password", "usuarios_cliente.revocar_sesiones",
				"datos_negocio.ver", "soporte.impersonar_lectura",
				"plataforma.salud_servicios",
			},
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			RoleKey:           PlatformRoleSoporteN2,
			DisplayName:       "Soporte Avanzado N2",
			Description:       "Soporte técnico avanzado con ajustes de licencias, mantenimiento, exportación CSV e impersonación controlada.",
			IsSystem:          true,
			RequireMFA:        false,
			RequireDataReason: true,
			Permissions: []string{
				"empresas.ver", "empresas.editar_suscripcion", "empresas.editar_cuotas", "empresas.mantenimiento",
				"usuarios_cliente.ver", "usuarios_cliente.crear", "usuarios_cliente.editar",
				"usuarios_cliente.reset_password", "usuarios_cliente.revocar_sesiones",
				"datos_negocio.ver", "soporte.impersonar_lectura", "soporte.impersonar_escritura", "datos_negocio.exportar_csv",
				"catalogo.ver", "plataforma.salud_servicios", "auditoria.ver",
			},
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			RoleKey:           PlatformRoleDesarrollador,
			DisplayName:       "Desarrollador / SRE",
			Description:       "Diagnóstico técnico, estado de microservicios, feature flags, modo mantenimiento y auditoría.",
			IsSystem:          true,
			RequireMFA:        false,
			RequireDataReason: true,
			Permissions: []string{
				"empresas.ver", "empresas.mantenimiento",
				"catalogo.ver", "catalogo.feature_flags",
				"plataforma.salud_servicios", "auditoria.ver",
			},
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			RoleKey:           PlatformRoleComercial,
			DisplayName:       "Comercial y Ventas",
			Description:       "Alta de empresas, configuración de planes comerciales, precios, visibilidad del catálogo y anuncios.",
			IsSystem:          true,
			RequireMFA:        false,
			RequireDataReason: true,
			Permissions: []string{
				"empresas.ver", "empresas.crear", "empresas.editar_suscripcion", "empresas.editar_cuotas",
				"catalogo.ver", "catalogo.editar_visibilidad", "catalogo.editar_precios",
				"plataforma.anuncios",
			},
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			RoleKey:           PlatformRoleFacturacionSaaS,
			DisplayName:       "Facturación y Cartera SaaS",
			Description:       "Control de cartera, suspensiones y reactivaciones por pago, cuotas y exportación de datos.",
			IsSystem:          true,
			RequireMFA:        false,
			RequireDataReason: true,
			Permissions: []string{
				"empresas.ver", "empresas.editar_suscripcion", "empresas.editar_cuotas", "empresas.suspender",
				"datos_negocio.exportar_csv", "plataforma.anuncios", "auditoria.ver",
			},
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			RoleKey:           PlatformRoleAuditor,
			DisplayName:       "Auditor de Cumplimiento",
			Description:       "Acceso estrictamente de solo lectura sobre empresas, usuarios de clientes y bitácora de auditoría.",
			IsSystem:          true,
			RequireMFA:        false,
			RequireDataReason: true,
			Permissions: []string{
				"empresas.ver", "usuarios_cliente.ver", "catalogo.ver",
				"plataforma.usuarios_ver", "plataforma.salud_servicios",
				"auditoria.ver", "auditoria.exportar",
			},
			CreatedAt: now,
			UpdatedAt: now,
		},
	}
}

func HasPlatformPermission(perms []string, required string) bool {
	req := strings.TrimSpace(required)
	if req == "" {
		return true
	}
	for _, p := range perms {
		clean := strings.TrimSpace(p)
		if clean == "*" || clean == req {
			return true
		}
	}
	return false
}

func CanAccessTenant(allowedTenants []string, tenantID string) bool {
	if len(allowedTenants) == 0 {
		return true
	}
	target := strings.TrimSpace(tenantID)
	for _, t := range allowedTenants {
		clean := strings.TrimSpace(t)
		if clean == "*" || (target != "" && clean == target) {
			return true
		}
	}
	return false
}
