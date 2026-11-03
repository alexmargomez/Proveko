import crypto from 'node:crypto';
import { Ed25519JwtVault, EnvelopeCryptoVault } from '@proveko/crypto-vault';
import {
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  SEED_INDUSTRY_PRESETS,
  type TenantTier,
} from '@proveko/shared-kernel';
import {
  type TenantBranchEntity,
  type TenantEntity,
  buildJwtCapabilitiesProjection,
} from '../../domain/entities/core-entities.js';
import type {
  DatabaseCellRepositoryPort,
  SubscriptionCatalogRepositoryPort,
  TenantRepositoryPort,
  UserRepositoryPort,
  WarmSandboxRepositoryPort,
} from '../../domain/ports/repositories.port.js';
import { CapabilityGraphEngine } from '../../domain/services/capability-graph.engine.js';
import { CellAllocatorEngine } from '../../domain/services/cell-allocator.engine.js';
import {
  CssThemeTokensVo,
  type WorkstationThemeConfig,
} from '../../domain/value-objects/css-theme-tokens.vo.js';
import type {
  ControlOutboxPort,
  PasswordHasherPort,
  TenantDatabaseProvisionerPort,
  TenantStateCachePort,
  UnitOfWorkPort,
} from '../ports/outbound.ports.js';

export interface InstantDemoSessionResult {
  tenantId: string;
  cellId: string;
  dbName: string;
  presetKey: string;
  accessToken: string;
  expiresAtIso: string;
}

export interface RegisterTenantInput {
  slug: string;
  legalName: string;
  taxIdNit: string;
  adminEmail: string;
  adminFullName: string;
  adminPasswordPlain: string;
  tier: TenantTier;
  presetKey: string;
  customTheme?: Partial<WorkstationThemeConfig>;
}

/**
 * Casos de Uso de Conversión de Tráfico de Pauta Publicitaria (Growth Engine) y Registro de Tenants
 */
export class OnboardingAndGrowthUseCases {
  constructor(
    private readonly uow: UnitOfWorkPort,
    private readonly tenantRepo: TenantRepositoryPort,
    private readonly cellRepo: DatabaseCellRepositoryPort,
    private readonly catalogRepo: SubscriptionCatalogRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly sandboxRepo: WarmSandboxRepositoryPort,
    private readonly cellAllocator: CellAllocatorEngine,
    private readonly graphEngine: CapabilityGraphEngine,
    private readonly cryptoVault: EnvelopeCryptoVault,
    private readonly jwtVault: Ed25519JwtVault,
    private readonly passwordHasher: PasswordHasherPort,
    private readonly dbProvisioner: TenantDatabaseProvisionerPort,
    private readonly stateCache: TenantStateCachePort,
    private readonly outbox: ControlOutboxPort,
  ) {}

  /**
   * Asigna en <30ms una Base de Datos Pre-Calentada del Warm Demo Sandbox Pool
   * para visitantes que hacen clic en pauta publicitaria (Meta Ads / Google Ads / TikTok Ads)
   */
  public async assignWarmSandboxForAdVisitor(
    presetKey: string,
  ): Promise<InstantDemoSessionResult> {
    const preset = SEED_INDUSTRY_PRESETS.find((p) => p.key === presetKey);
    if (!preset) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
        404,
        `Industry preset "${presetKey}" does not exist.`,
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 horas TTL

    const session = await this.uow.runInTransaction(async (tx) => {
      const warmSlot = await this.sandboxRepo.acquireNextReadySandboxSlot(presetKey, tx);
      if (!warmSlot) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_SANDBOX_POOL_EMPTY,
          503,
          `No warm sandbox slots currently available for preset "${presetKey}".`,
        );
      }

      const tenantId = `tnt-sbx-${warmSlot.sandboxId}`;
      const branchId = `br-sbx-${warmSlot.sandboxId}`;
      const demoUserId = `usr-sbx-${warmSlot.sandboxId}`;

      // Re-sellar el sobre criptográfico vinculándolo al nuevo tenantId del sandbox (AAD guard)
      const unsealedCreds = this.cryptoVault.unsealDatabaseCredentials(
        warmSlot.encryptedConnectionEnvelope,
        warmSlot.sandboxId,
        warmSlot.cellId,
      );
      const tenantEnvelope = this.cryptoVault.sealDatabaseCredentials(
        tenantId,
        warmSlot.cellId,
        unsealedCreds,
      );

      const defaultTheme = CssThemeTokensVo.createDefaultCorporateTheme().toConfig();

      const tenant: TenantEntity = {
        id: tenantId,
        slug: `demo-${warmSlot.sandboxId}`,
        legalName: `Demo Interactiva — ${preset.name}`,
        taxIdNit: '900000000-1',
        tier: 'sandbox_ephemeral',
        isSandbox: true,
        status: 'ACTIVE',
        cellId: warmSlot.cellId,
        dbName: warmSlot.dbName,
        encryptedConnectionEnvelope: tenantEnvelope,
        subVer: 1,
        themeConfig: defaultTheme,
        sandboxExpiresAtIso: expiresAt.toISOString(),
        createdAtIso: now.toISOString(),
      };

      await this.tenantRepo.saveTenant(tenant, tx);

      const mainBranch: TenantBranchEntity = {
        id: branchId,
        tenantId,
        code: 'MAIN',
        name: 'Sede Principal Demo',
        cityCodeDian: '11001',
        defaultWarehouseId: 'wh-main-01',
        isMain: true,
        status: 'ACTIVE',
      };
      await this.tenantRepo.saveBranch(mainBranch, tx);

      for (const srvKey of preset.services) {
        await this.catalogRepo.upsertParentService(
          {
            tenantId,
            serviceKey: srvKey,
            status: 'ACTIVE',
            activatedAtIso: now.toISOString(),
          },
          tx,
        );
      }

      for (const msKey of preset.microservices) {
        const def = this.graphEngine.getDefinition(msKey);
        await this.catalogRepo.upsertMicroservice(
          {
            tenantId,
            microserviceKey: msKey,
            parentServiceKey: def.parentService,
            mutexGroup: def.mutexGroup,
            status: 'ACTIVE',
            supersededByKey: null,
            activatedAtIso: now.toISOString(),
            archivedAtIso: null,
          },
          tx,
        );
      }

      warmSlot.status = 'ASSIGNED_EPHEMERAL';
      warmSlot.assignedTenantId = tenantId;
      await this.sandboxRepo.updateSandboxSlot(warmSlot, tx);

      const parentSubs = await this.catalogRepo.findParentServicesByTenant(tenantId, tx);
      const msSubs = await this.catalogRepo.findMicroservicesByTenant(tenantId, tx);
      const projection = buildJwtCapabilitiesProjection(parentSubs, msSubs);

      const accessToken = this.jwtVault.signAccessToken({
        tenant_id: tenantId,
        cell_id: warmSlot.cellId,
        user_id: demoUserId,
        role_key: 'tenant_admin',
        tier: 'sandbox_ephemeral',
        is_sandbox: true,
        active_branch_id: branchId,
        allowed_branch_ids: [branchId],
        sub_ver: 1,
        services: projection.services,
        readonly_microservices: projection.readonlyMicroservices,
        ttlSeconds: 7200,
      });

      return {
        tenantId,
        cellId: warmSlot.cellId,
        dbName: warmSlot.dbName,
        presetKey,
        accessToken,
        expiresAtIso: expiresAt.toISOString(),
        tenantEnvelope,
      };
    });

    await this.stateCache.setMonotonicSubVer(session.tenantId, 1);
    await this.stateCache.cacheEncryptedEnvelope(session.tenantId, session.tenantEnvelope);

    return {
      tenantId: session.tenantId,
      cellId: session.cellId,
      dbName: session.dbName,
      presetKey: session.presetKey,
      accessToken: session.accessToken,
      expiresAtIso: session.expiresAtIso,
    };
  }

  /**
   * Promueve un Sandbox Efímero a Tenant Permanente conservando todas sus tablas y datos creados en la prueba
   */
  public async claimSandboxToPermanentTenant(
    sandboxTenantId: string,
    legalName: string,
    taxIdNit: string,
    targetTier: Exclude<TenantTier, 'sandbox_ephemeral'>,
  ): Promise<TenantEntity> {
    const updated = await this.uow.runInTransaction(async (tx) => {
      const tenant = await this.tenantRepo.findByIdForUpdate(sandboxTenantId, tx);
      if (!tenant) {
        throw new ProvekoDomainError(
          PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
          404,
          `Sandbox tenant "${sandboxTenantId}" not found.`,
        );
      }

      tenant.legalName = legalName;
      tenant.taxIdNit = taxIdNit;
      tenant.tier = targetTier;
      tenant.isSandbox = false;
      tenant.sandboxExpiresAtIso = null;
      tenant.subVer += 1;

      await this.tenantRepo.saveTenant(tenant, tx);
      return tenant;
    });

    await this.stateCache.setMonotonicSubVer(updated.id, updated.subVer);
    return updated;
  }

  /**
   * Registro completo de un nuevo Inquilino con asignación de Celda, Envelope Encryption KEK+DEK y Preset inicial
   */
  public async registerNewTenant(input: RegisterTenantInput): Promise<{
    tenant: TenantEntity;
    mainBranch: TenantBranchEntity;
    adminUserId: string;
    accessToken: string;
  }> {
    const preset = SEED_INDUSTRY_PRESETS.find((p) => p.key === input.presetKey);
    if (!preset) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_NOT_FOUND,
        404,
        `Industry preset "${input.presetKey}" not found.`,
      );
    }

    const themeVo = input.customTheme
      ? CssThemeTokensVo.createCustomTenantTheme(input.customTheme)
      : CssThemeTokensVo.createDefaultCorporateTheme();

    const allCells = await this.cellRepo.listAllCells();
    const selectedCell = this.cellAllocator.selectOptimalCell(allCells, input.tier, false);

    const tenantId = `tnt-${crypto.randomUUID().slice(0, 8)}`;
    const branchId = `br-${crypto.randomUUID().slice(0, 8)}`;
    const adminUserId = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const dbName = `db_tenant_${tenantId.replace(/-/g, '_')}`;
    const dbUser = `u_${tenantId.replace(/-/g, '_')}`;
    const dbPassword = crypto.randomBytes(24).toString('base64url');

    // 1. Crear físicamente la base de datos en la Celda seleccionada (`adminPort`)
    await this.dbProvisioner.provisionTenantDatabase(
      selectedCell,
      dbName,
      dbUser,
      dbPassword,
    );

    // 2. Aprovisionar los esquemas y migraciones del Preset Comercial seleccionado
    for (const srvKey of preset.services) {
      await this.dbProvisioner.provisionServiceSchemaAndMigrations(
        selectedCell,
        dbName,
        srvKey,
      );
    }
    for (const msKey of preset.microservices) {
      const def = this.graphEngine.getDefinition(msKey);
      await this.dbProvisioner.provisionServiceSchemaAndMigrations(
        selectedCell,
        dbName,
        def.parentService,
        msKey,
      );
    }

    // 3. Cifrar credenciales con Envelope Encryption (KEK + DEK única por tenant)
    const encryptedEnvelope = this.cryptoVault.sealDatabaseCredentials(
      tenantId,
      selectedCell.id,
      {
        host: selectedCell.host,
        adminPort: selectedCell.adminPort,
        poolerPort: selectedCell.poolerPort,
        dbName,
        username: dbUser,
        password: dbPassword,
      },
    );

    const passwordHash = await this.passwordHasher.hashPassword(input.adminPasswordPlain);
    const nowIso = new Date().toISOString();

    const result = await this.uow.runInTransaction(async (tx) => {
      const tenant: TenantEntity = {
        id: tenantId,
        slug: input.slug,
        legalName: input.legalName,
        taxIdNit: input.taxIdNit,
        tier: input.tier,
        isSandbox: false,
        status: 'ACTIVE',
        cellId: selectedCell.id,
        dbName,
        encryptedConnectionEnvelope: encryptedEnvelope,
        subVer: 1,
        themeConfig: themeVo.toConfig(),
        sandboxExpiresAtIso: null,
        createdAtIso: nowIso,
      };

      await this.tenantRepo.saveTenant(tenant, tx);
      await this.cellRepo.incrementCellTenantCount(selectedCell.id, 1, tx);

      const mainBranch: TenantBranchEntity = {
        id: branchId,
        tenantId,
        code: 'MAIN',
        name: 'Sede Principal',
        cityCodeDian: '11001',
        defaultWarehouseId: 'wh-main-01',
        isMain: true,
        status: 'ACTIVE',
      };
      await this.tenantRepo.saveBranch(mainBranch, tx);

      await this.userRepo.saveUser(
        {
          id: adminUserId,
          tenantId,
          email: input.adminEmail,
          fullName: input.adminFullName,
          passwordHash,
          roleKey: 'tenant_admin',
          allowedBranchIds: [branchId],
          defaultBranchId: branchId,
          isActive: true,
        },
        tx,
      );

      for (const srvKey of preset.services) {
        await this.catalogRepo.upsertParentService(
          {
            tenantId,
            serviceKey: srvKey,
            status: 'ACTIVE',
            activatedAtIso: nowIso,
          },
          tx,
        );
      }

      for (const msKey of preset.microservices) {
        const def = this.graphEngine.getDefinition(msKey);
        await this.catalogRepo.upsertMicroservice(
          {
            tenantId,
            microserviceKey: msKey,
            parentServiceKey: def.parentService,
            mutexGroup: def.mutexGroup,
            status: 'ACTIVE',
            supersededByKey: null,
            activatedAtIso: nowIso,
            archivedAtIso: null,
          },
          tx,
        );
      }

      const parentSubs = await this.catalogRepo.findParentServicesByTenant(tenantId, tx);
      const msSubs = await this.catalogRepo.findMicroservicesByTenant(tenantId, tx);
      const projection = buildJwtCapabilitiesProjection(parentSubs, msSubs);

      await this.outbox.appendEvent(
        {
          eventId: `ev-${crypto.randomUUID()}`,
          eventType: 'tenant.provisioned',
          tenantId,
          subVer: 1,
          payload: {
            cell_id: selectedCell.id,
            db_name: dbName,
            preset_key: input.presetKey,
            services: projection.services,
          },
        },
        tx,
      );

      const accessToken = this.jwtVault.signAccessToken({
        tenant_id: tenantId,
        cell_id: selectedCell.id,
        user_id: adminUserId,
        role_key: 'tenant_admin',
        tier: input.tier,
        is_sandbox: false,
        active_branch_id: branchId,
        allowed_branch_ids: [branchId],
        sub_ver: 1,
        services: projection.services,
        readonly_microservices: projection.readonlyMicroservices,
      });

      return { tenant, mainBranch, adminUserId, accessToken };
    });

    await this.stateCache.setMonotonicSubVer(tenantId, 1);
    await this.stateCache.cacheEncryptedEnvelope(tenantId, encryptedEnvelope);

    return result;
  }
}
