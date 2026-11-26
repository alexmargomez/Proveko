package migrations

import _ "embed"

//go:embed 001_schema.sql
var schemaSQL string

func SchemaSQL() string {
	return schemaSQL
}
