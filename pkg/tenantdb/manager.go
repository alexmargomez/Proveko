package tenantdb

import "platform-pkg/dbpool"

func NormalizeDatabaseIdentifier(raw string) (string, error) {
	return dbpool.SanitizeTenantDBName(raw)
}
