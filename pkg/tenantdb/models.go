package tenantdb

type TenantDatabaseDescriptor struct {
	TenantID string `json:"tenantId"`
	DBName   string `json:"dbName"`
}
