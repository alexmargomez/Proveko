package migrations

import _ "embed"

//go:embed 001_tenants_and_users.sql
var tenantsSQL string

//go:embed 002_catalog_and_subscriptions.sql
var subscriptionsSQL string

//go:embed 003_tenant_users_and_commercial.sql
var tenantUsersAndCommercialSQL string

//go:embed 004_platform_staff_roles_and_sessions.sql
var platformStaffSQL string

func SchemaSQL() string {
	return tenantsSQL + "\n" + subscriptionsSQL + "\n" + tenantUsersAndCommercialSQL + "\n" + platformStaffSQL
}
