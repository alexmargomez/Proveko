import { createHash, randomUUID } from 'node:crypto';
import {
  type MicroserviceKey,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  type ServiceKey,
} from '@proveko/shared-kernel';
import type {
  AppliedMigrationRecord,
  FileBasedMigrationEngine,
  MigrationDatabaseDriverPort,
} from './file-migration.engine.js';

export interface TenantDatabaseBackupManifest {
  readonly backupId: string;
  readonly tenantId: string;
  readonly cellId: string;
  readonly dbName: string;
  readonly reason: 'MANUAL_SNAPSHOT' | 'PRE_MIGRATION_SAFETY' | 'SCHEDULED_DAILY';
  readonly createdAtIso: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
  readonly activeServicesSnapshot: Partial<Record<ServiceKey, MicroserviceKey[]>>;
  readonly appliedMigrationsSnapshot: ReadonlyArray<AppliedMigrationRecord>;
}

export interface RestoreTenantDatabaseResult {
  readonly backupId: string;
  readonly tenantId: string;
  readonly dbName: string;
  readonly restoredMigrationsCount: number;
  readonly catchUpNewMigrationsApplied: string[];
  readonly restoredAtIso: string;
}

export type DatabaseMigrationHealthStatus =
  | 'UP_TO_DATE'
  | 'PENDING_MIGRATIONS'
  | 'CHECKSUM_DRIFT'
  | 'MIGRATION_FAILED';

export interface PerDatabaseTelemetryInput {
  readonly tenantId: string;
  readonly cellId: string;
  readonly dbName: string;
  readonly queryLatencyP95Ms: number;
  readonly activeConnections: number;
  readonly maxConnections: number;
  readonly storageUsedMb: number;
  readonly storageQuotaMb: number;
  readonly migrationStatus: DatabaseMigrationHealthStatus;
  readonly lastBackupAtIso: string | null;
}

export interface PerDatabaseHealthSnapshot extends PerDatabaseTelemetryInput {
  readonly connectionUtilizationPercent: number;
  readonly storageUtilizationPercent: number;
  readonly overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  readonly evaluatedAtIso: string;
}

export type GranularAlertCategory =
  | 'HIGH_QUERY_LATENCY'
  | 'CONNECTION_POOL_SATURATION'
  | 'STORAGE_QUOTA_THRESHOLD'
  | 'BACKUP_OVERDUE'
  | 'MIGRATION_FAILURE_OR_DRIFT';

export interface GranularDatabaseAlert {
  readonly alertId: string;
  readonly tenantId: string;
  readonly cellId: string;
  readonly dbName: string;
  readonly category: GranularAlertCategory;
  readonly severity: 'WARNING' | 'CRITICAL';
  readonly message: string;
  readonly metricValue: number | string;
  readonly thresholdValue: number | string;
  readonly triggeredAtIso: string;
}

export interface GranularAlertThresholds {
  readonly latencyWarningMs?: number;
  readonly latencyCriticalMs?: number;
  readonly connectionSaturationWarningPct?: number;
  readonly storageQuotaWarningPct?: number;
  readonly maxBackupAgeHours?: number;
}

/**
 * 1. Pilar Operation: `Backups por cliente` (`Base A`, `Base B`, `Base C`, `Base D`)
 * Permite tomar backups aislados por la base de datos de un cliente específico, verificar su
 * integridad SHA-256 y restaurar esa base individual aplicando automáticamente las migraciones nuevas posteriores.
 */
export class PerTenantBackupManager {
  private readonly backupsByDb = new Map<string, TenantDatabaseBackupManifest[]>();

  constructor(
    private readonly migrationDriver: Pick<
      MigrationDatabaseDriverPort,
      'getAppliedMigrations'
    > & {
      getAllAppliedRecordsForDatabase?: (dbName: string) => AppliedMigrationRecord[];
    },
    private readonly migrationEngine?: FileBasedMigrationEngine,
  ) {}

  public async createDatabaseBackup(params: {
    tenantId: string;
    cellId: string;
    dbName: string;
    reason: TenantDatabaseBackupManifest['reason'];
    activeServicesSnapshot: Partial<Record<ServiceKey, MicroserviceKey[]>>;
    simulatedSizeBytes?: number;
  }): Promise<TenantDatabaseBackupManifest> {
    const appliedMigrationsSnapshot = this.migrationDriver.getAllAppliedRecordsForDatabase
      ? this.migrationDriver.getAllAppliedRecordsForDatabase(params.dbName)
      : [];

    const canonicalPayload = JSON.stringify({
      tenantId: params.tenantId,
      cellId: params.cellId,
      dbName: params.dbName,
      activeServices: params.activeServicesSnapshot,
      migrations: appliedMigrationsSnapshot.map((m) => ({
        moduleKey: m.moduleKey,
        filename: m.filename,
        checksumSha256: m.checksumSha256,
      })),
    });

    const checksumSha256 = createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
    const manifest: TenantDatabaseBackupManifest = Object.freeze({
      backupId: `bkp_${params.dbName}_${randomUUID().slice(0, 8)}`,
      tenantId: params.tenantId,
      cellId: params.cellId,
      dbName: params.dbName,
      reason: params.reason,
      createdAtIso: new Date().toISOString(),
      sizeBytes: params.simulatedSizeBytes ?? 1024 * 1024 * 25,
      checksumSha256,
      activeServicesSnapshot: params.activeServicesSnapshot,
      appliedMigrationsSnapshot,
    });

    const list = this.backupsByDb.get(params.dbName) ?? [];
    list.push(manifest);
    this.backupsByDb.set(params.dbName, list);
    return manifest;
  }

  public listBackupsForDatabase(dbName: string): TenantDatabaseBackupManifest[] {
    return [...(this.backupsByDb.get(dbName) ?? [])];
  }

  public async restoreDatabaseBackup(params: {
    dbName: string;
    backupId: string;
    expectedChecksumSha256?: string;
    catchUpPendingMigrations?: boolean;
  }): Promise<RestoreTenantDatabaseResult> {
    const list = this.backupsByDb.get(params.dbName) ?? [];
    const manifest = list.find((b) => b.backupId === params.backupId);
    if (!manifest) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
        404,
        `Backup "${params.backupId}" not found for database "${params.dbName}".`,
      );
    }

    if (
      params.expectedChecksumSha256 &&
      params.expectedChecksumSha256 !== manifest.checksumSha256
    ) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_BACKUP_INTEGRITY_FAILED,
        422,
        `Backup integrity check failed for "${params.backupId}" on database "${params.dbName}".`,
        {
          expected_checksum: params.expectedChecksumSha256,
          actual_checksum: manifest.checksumSha256,
        },
      );
    }

    const catchUpNewMigrationsApplied: string[] = [];
    if (params.catchUpPendingMigrations && this.migrationEngine) {
      const entries = Object.entries(manifest.activeServicesSnapshot) as Array<
        [ServiceKey, MicroserviceKey[] | undefined]
      >;
      for (const [parentService, modules] of entries) {
        if (!modules) continue;
        for (const moduleKey of modules) {
          const res = await this.migrationEngine.migrateModuleForTenantDatabase({
            tenantId: manifest.tenantId,
            dbName: manifest.dbName,
            parentService,
            moduleKey,
          });
          catchUpNewMigrationsApplied.push(...res.appliedNewMigrations);
        }
      }
    }

    return {
      backupId: manifest.backupId,
      tenantId: manifest.tenantId,
      dbName: manifest.dbName,
      restoredMigrationsCount: manifest.appliedMigrationsSnapshot.length,
      catchUpNewMigrationsApplied,
      restoredAtIso: new Date().toISOString(),
    };
  }
}

/**
 * 2. Pilar Operation: `Monitoreo por base` + `Alertas más finas` (`Base A`, `Base B`, `Base C`, `Base D`)
 * Mide la salud individual de cada base de datos de cliente y emite alertas granulares únicamente
 * sobre la base afectada sin contaminar el resto de la flota.
 */
export class PerDatabaseHealthAndAlertMonitor {
  private readonly snapshotsByDb = new Map<string, PerDatabaseHealthSnapshot>();
  private readonly latencyWarningMs: number;
  private readonly latencyCriticalMs: number;
  private readonly connectionSaturationWarningPct: number;
  private readonly storageQuotaWarningPct: number;
  private readonly maxBackupAgeHours: number;

  constructor(thresholds?: GranularAlertThresholds) {
    this.latencyWarningMs = thresholds?.latencyWarningMs ?? 120;
    this.latencyCriticalMs = thresholds?.latencyCriticalMs ?? 300;
    this.connectionSaturationWarningPct = thresholds?.connectionSaturationWarningPct ?? 85;
    this.storageQuotaWarningPct = thresholds?.storageQuotaWarningPct ?? 80;
    this.maxBackupAgeHours = thresholds?.maxBackupAgeHours ?? 24;
  }

  public evaluateDatabaseHealth(
    input: PerDatabaseTelemetryInput,
    nowMs: number = Date.now(),
  ): {
    snapshot: PerDatabaseHealthSnapshot;
    alerts: GranularDatabaseAlert[];
  } {
    const connectionUtilizationPercent =
      input.maxConnections > 0
        ? Math.round((input.activeConnections / input.maxConnections) * 100)
        : 0;
    const storageUtilizationPercent =
      input.storageQuotaMb > 0
        ? Math.round((input.storageUsedMb / input.storageQuotaMb) * 100)
        : 0;

    const alerts: GranularDatabaseAlert[] = [];
    const triggeredAtIso = new Date(nowMs).toISOString();

    // 1. Alerta fina por latencia de consultas en esta base específica
    if (input.queryLatencyP95Ms >= this.latencyCriticalMs) {
      alerts.push({
        alertId: `alt_lat_${input.dbName}`,
        tenantId: input.tenantId,
        cellId: input.cellId,
        dbName: input.dbName,
        category: 'HIGH_QUERY_LATENCY',
        severity: 'CRITICAL',
        message: `Database "${input.dbName}" P95 query latency (${input.queryLatencyP95Ms}ms) exceeded critical threshold (${this.latencyCriticalMs}ms).`,
        metricValue: input.queryLatencyP95Ms,
        thresholdValue: this.latencyCriticalMs,
        triggeredAtIso,
      });
    } else if (input.queryLatencyP95Ms >= this.latencyWarningMs) {
      alerts.push({
        alertId: `alt_lat_${input.dbName}`,
        tenantId: input.tenantId,
        cellId: input.cellId,
        dbName: input.dbName,
        category: 'HIGH_QUERY_LATENCY',
        severity: 'WARNING',
        message: `Database "${input.dbName}" P95 query latency (${input.queryLatencyP95Ms}ms) exceeded warning threshold (${this.latencyWarningMs}ms).`,
        metricValue: input.queryLatencyP95Ms,
        thresholdValue: this.latencyWarningMs,
        triggeredAtIso,
      });
    }

    // 2. Alerta fina por saturación del micro-pool de conexiones de esta base
    if (connectionUtilizationPercent >= this.connectionSaturationWarningPct) {
      alerts.push({
        alertId: `alt_conn_${input.dbName}`,
        tenantId: input.tenantId,
        cellId: input.cellId,
        dbName: input.dbName,
        category: 'CONNECTION_POOL_SATURATION',
        severity: connectionUtilizationPercent >= 95 ? 'CRITICAL' : 'WARNING',
        message: `Database "${input.dbName}" connection pool utilization is at ${connectionUtilizationPercent}% (${input.activeConnections}/${input.maxConnections}).`,
        metricValue: connectionUtilizationPercent,
        thresholdValue: this.connectionSaturationWarningPct,
        triggeredAtIso,
      });
    }

    // 3. Alerta fina por cuota de almacenamiento de esta base
    if (storageUtilizationPercent >= this.storageQuotaWarningPct) {
      alerts.push({
        alertId: `alt_stg_${input.dbName}`,
        tenantId: input.tenantId,
        cellId: input.cellId,
        dbName: input.dbName,
        category: 'STORAGE_QUOTA_THRESHOLD',
        severity: storageUtilizationPercent >= 95 ? 'CRITICAL' : 'WARNING',
        message: `Database "${input.dbName}" storage usage is at ${storageUtilizationPercent}% (${input.storageUsedMb}MB / ${input.storageQuotaMb}MB).`,
        metricValue: storageUtilizationPercent,
        thresholdValue: this.storageQuotaWarningPct,
        triggeredAtIso,
      });
    }

    // 4. Alerta fina por fallo o alteración (drift) de migraciones en esta base
    if (
      input.migrationStatus === 'CHECKSUM_DRIFT' ||
      input.migrationStatus === 'MIGRATION_FAILED'
    ) {
      alerts.push({
        alertId: `alt_mig_${input.dbName}`,
        tenantId: input.tenantId,
        cellId: input.cellId,
        dbName: input.dbName,
        category: 'MIGRATION_FAILURE_OR_DRIFT',
        severity: 'CRITICAL',
        message: `Database "${input.dbName}" reported migration status "${input.migrationStatus}".`,
        metricValue: input.migrationStatus,
        thresholdValue: 'UP_TO_DATE',
        triggeredAtIso,
      });
    }

    // 5. Alerta fina por antigüedad del backup de este cliente
    if (!input.lastBackupAtIso) {
      alerts.push({
        alertId: `alt_bkp_${input.dbName}`,
        tenantId: input.tenantId,
        cellId: input.cellId,
        dbName: input.dbName,
        category: 'BACKUP_OVERDUE',
        severity: 'WARNING',
        message: `Database "${input.dbName}" has no registered backup snapshot.`,
        metricValue: 'NONE',
        thresholdValue: `${this.maxBackupAgeHours}h`,
        triggeredAtIso,
      });
    } else {
      const backupAgeHours = (nowMs - Date.parse(input.lastBackupAtIso)) / (1000 * 60 * 60);
      if (backupAgeHours > this.maxBackupAgeHours) {
        alerts.push({
          alertId: `alt_bkp_${input.dbName}`,
          tenantId: input.tenantId,
          cellId: input.cellId,
          dbName: input.dbName,
          category: 'BACKUP_OVERDUE',
          severity: 'WARNING',
          message: `Database "${input.dbName}" last backup is ${Math.round(backupAgeHours)}h old (threshold: ${this.maxBackupAgeHours}h).`,
          metricValue: Math.round(backupAgeHours),
          thresholdValue: this.maxBackupAgeHours,
          triggeredAtIso,
        });
      }
    }

    const hasCritical = alerts.some((a) => a.severity === 'CRITICAL');
    const overallHealth: PerDatabaseHealthSnapshot['overallHealth'] = hasCritical
      ? 'CRITICAL'
      : alerts.length > 0
        ? 'DEGRADED'
        : 'HEALTHY';

    const snapshot: PerDatabaseHealthSnapshot = Object.freeze({
      ...input,
      connectionUtilizationPercent,
      storageUtilizationPercent,
      overallHealth,
      evaluatedAtIso: triggeredAtIso,
    });

    this.snapshotsByDb.set(input.dbName, snapshot);
    return { snapshot, alerts };
  }

  public getDatabaseSnapshot(dbName: string): PerDatabaseHealthSnapshot | null {
    return this.snapshotsByDb.get(dbName) ?? null;
  }
}
