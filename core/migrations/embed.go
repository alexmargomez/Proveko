package migrations

import _ "embed"

//go:embed 001_tenants_and_users.sql
var tenantsSQL string

//go:embed 002_catalog_and_subscriptions.sql
var subscriptionsSQL string

func SchemaSQL() string {
	return tenantsSQL + "\n" + subscriptionsSQL
}
