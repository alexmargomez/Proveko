package domain

import "context"

type Repository interface {
	ListSnapshots(ctx context.Context, dbName string) (*SnapshotsState, error)
	CreateSnapshot(ctx context.Context, dbName, idemKey, createdBy string, in CreateSnapshotInput) (*ExecutiveSnapshot, error)
}
