import { describe, expect, it } from 'vitest';
import {
  Ed25519JwtVault,
  EnvelopeCryptoVault,
} from '@proveko/crypto-vault';
import { HybridOutboxInboxEngine } from '@proveko/event-bus';
import { CustomFieldsAndWebhookGuard } from '@proveko/rules-engine';
import {
  DoubleKeyServiceGuard,
  TenantContextStorage,
  sanitizeInboundTenantHeaders,
} from '@proveko/service-guard';
import {
  MoneyDecimal,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
} from '@proveko/shared-kernel';
import {
  TenantConnectionPoolManager,
  type TenantSqlClient,
} from '@proveko/tenant-db-resolver';
import { PosCartCapabilityReconciler } from '@proveko/ui-kit';
import {
  AuthAndRoutingUseCases,
  BulkheadPasswordHasher,
  CapabilityGraphEngine,
  CatalogCapabilityUseCases,
  CellAllocatorEngine,
  CssThemeTokensVo,
  type DatabaseCellEntity,
  MonotonicTenantStateCacheAdapter,
  OnboardingAndGrowthUseCases,
  type TenantBranchEntity,
  type TenantEntity,
  type TenantMicroserviceSubscriptionEntity,
  type TenantServiceSubscriptionEntity,
  type UserEntity,
  type WarmSandboxSlotEntity,
  buildCoreServiceFastifyServer,
} from '../src/index.js';

function createInMemoryControlPlaneHarness() {
  const kek1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const kek2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

  const cryptoVault = new EnvelopeCryptoVault({
    activeKekId: 'kek-v1',
    keysHex: { 'kek-v1': kek1, 'kek-v2': kek2 },
  });

  const keyPair1 = Ed25519JwtVault.generateKeyPairEntry('ed-key-2026-01');
  const jwtVault = new Ed25519JwtVault('ed-key-2026-01', [keyPair1]);

  const cells = new Map<string, DatabaseCellEntity>([
    [
      'cell-db-01',
      {
        id: 'cell-db-01',
        code: 'CELL-A',
        host: '10.0.10.11',
        adminPort: 5432,
        poolerPort: 6432,
        maxTenants: 20,
        currentTenants: 4,
        tierTarget: 'business',
        isSandboxCell: false,
        status: 'ONLINE',
      },
    ],
    [
      'cell-sandbox-01',
      {
        id: 'cell-sandbox-01',
        code: 'CELL-SBX',
        host: '10.0.10.99',
        adminPort: 5432,
        poolerPort: 6432,
        maxTenants: 100,
        currentTenants: 2,
        tierTarget: 'sandbox_ephemeral',
        isSandboxCell: true,
        status: 'ONLINE',
      },
    ],
  ]);

  const tenants = new Map<string, TenantEntity>();
  const branches = new Map<string, TenantBranchEntity[]>();
  const parentSubs = new Map<string, TenantServiceSubscriptionEntity[]>();
  const msSubs = new Map<string, TenantMicroserviceSubscriptionEntity[]>();
  const users = new Map<string, UserEntity>();
  const outboxEvents: Array<Record<string, unknown>> = [];
  const provisionedSchemas: string[] = [];

  const warmSandboxEnvelope = cryptoVault.sealDatabaseCredentials(
    'sbx-001',
    'cell-sandbox-01',
    {
      host: '10.0.10.99',
      adminPort: 5432,
      poolerPort: 6432,
      dbName: 'db_sandbox_001',
      username: 'u_sbx_001',
      password: 'sbx_secret_password',
    },
  );

  const warmSlots = new Map<string, WarmSandboxSlotEntity>([
    [
      'sbx-001',
      {
        sandboxId: 'sbx-001',
        cellId: 'cell-sandbox-01',
        dbName: 'db_sandbox_001',
        presetKey: 'preset:gastro-bar-restaurant',
        encryptedConnectionEnvelope: warmSandboxEnvelope,
        status: 'READY_WARM',
        assignedTenantId: null,
      },
    ],
  ]);

  const uow = {
    runInTransaction: async <T>(work: (tx: { txId: string }) => Promise<T>) =>
      work({ txId: 'tx-mem-1' }),
  };

  const tenantRepo = {
    findById: async (id: string) => tenants.get(id) ?? null,
    findByIdForUpdate: async (id: string) => tenants.get(id) ?? null,
    saveTenant: async (t: TenantEntity) => {
      tenants.set(t.id, { ...t });
    },
    findBranchesByTenant: async (tenantId: string) => branches.get(tenantId) ?? [],
    saveBranch: async (b: TenantBranchEntity) => {
      const list = branches.get(b.tenantId) ?? [];
      list.push(b);
      branches.set(b.tenantId, list);
    },
  };

  const cellRepo = {
    listAllCells: async () => Array.from(cells.values()),
    findById: async (id: string) => cells.get(id) ?? null,
    incrementCellTenantCount: async (cellId: string, delta: number) => {
      const c = cells.get(cellId);
      if (c) c.currentTenants += delta;
    },
  };

  const catalogRepo = {
    findParentServicesByTenant: async (tenantId: string) => [
      ...(parentSubs.get(tenantId) ?? []),
    ],
    upsertParentService: async (sub: TenantServiceSubscriptionEntity) => {
      const list = parentSubs.get(sub.tenantId) ?? [];
      const idx = list.findIndex((s) => s.serviceKey === sub.serviceKey);
      if (idx >= 0) list[idx] = { ...sub };
      else list.push({ ...sub });
      parentSubs.set(sub.tenantId, list);
    },
    findMicroservicesByTenant: async (tenantId: string) => [
      ...(msSubs.get(tenantId) ?? []),
    ],
    upsertMicroservice: async (sub: TenantMicroserviceSubscriptionEntity) => {
      const list = msSubs.get(sub.tenantId) ?? [];
      const idx = list.findIndex((m) => m.microserviceKey === sub.microserviceKey);
      if (idx >= 0) list[idx] = { ...sub };
      else list.push({ ...sub });
      msSubs.set(sub.tenantId, list);
    },
  };

  const userRepo = {
    findByEmailAndTenant: async (email: string, tenantId: string) =>
      Array.from(users.values()).find(
        (u) => u.email === email && u.tenantId === tenantId,
      ) ?? null,
    findById: async (id: string) => users.get(id) ?? null,
    saveUser: async (u: UserEntity) => {
      users.set(u.id, { ...u });
    },
  };

  const sandboxRepo = {
    acquireNextReadySandboxSlot: async (presetKey: string) =>
      Array.from(warmSlots.values()).find(
        (s) => s.presetKey === presetKey && s.status === 'READY_WARM',
      ) ?? null,
    updateSandboxSlot: async (slot: WarmSandboxSlotEntity) => {
      warmSlots.set(slot.sandboxId, { ...slot });
    },
  };

  const dbProvisioner = {
    provisionTenantDatabase: async (_cell: DatabaseCellEntity, dbName: string) => {
      provisionedSchemas.push(`CREATE_DB:${dbName}`);
    },
    provisionServiceSchemaAndMigrations: async (
      _cell: DatabaseCellEntity,
      dbName: string,
      serviceKey: string,
      microserviceKey?: string,
    ) => {
      const tag = microserviceKey
        ? `${dbName}:${serviceKey}:${microserviceKey}`
        : `${dbName}:${serviceKey}`;
      provisionedSchemas.push(tag);
      return {
        appliedMigrations: microserviceKey ? [`001_init_${microserviceKey}`] : [],
      };
    },
  };

  const stateCache = new MonotonicTenantStateCacheAdapter();
  const passwordHasher = new BulkheadPasswordHasher({
    maxConcurrentHashes: 4,
    maxQueueSize: 10,
  });
  const graphEngine = new CapabilityGraphEngine();
  const cellAllocator = new CellAllocatorEngine();

  const outbox = {
    appendEvent: async (ev: unknown) => {
      outboxEvents.push(ev as Record<string, unknown>);
    },
  };

  const catalogUseCases = new CatalogCapabilityUseCases(
    uow,
    tenantRepo,
    cellRepo,
    catalogRepo,
    graphEngine,
    dbProvisioner,
    stateCache,
    outbox,
  );

  const onboardingUseCases = new OnboardingAndGrowthUseCases(
    uow,
    tenantRepo,
    cellRepo,
    catalogRepo,
    userRepo,
    sandboxRepo,
    cellAllocator,
    graphEngine,
    cryptoVault,
    jwtVault,
    passwordHasher,
    dbProvisioner,
    stateCache,
    outbox,
  );

  const authUseCases = new AuthAndRoutingUseCases(
    tenantRepo,
    userRepo,
    catalogRepo,
    passwordHasher,
    jwtVault,
    stateCache,
  );

  return {
    cryptoVault,
    jwtVault,
    stateCache,
    catalogRepo,
    dbProvisioner,
    catalogUseCases,
    onboardingUseCases,
    authUseCases,
    provisionedSchemas,
    outboxEvents,
    kek1,
    kek2,
  };
}

describe('Proveko — Core-Service & Inner Ring Libraries (Audit Verification Suite)', () => {
  it('1. Regla del Servicio Padre Gatekeeper, Dependencias (requires), Supersedes a READONLY_ARCHIVE y Reconciliación del Carrito POS', async () => {
    const harness = createInMemoryControlPlaneHarness();

    // 1. Registrar inquilino con el preset de Bar/Restaurante (incluye ms:invoicing-simple-receipt activo)
    const reg = await harness.onboardingUseCases.registerNewTenant({
      slug: 'la-terraza-gastrobar',
      legalName: 'La Terraza Gastrobar S.A.S.',
      taxIdNit: '901456789-2',
      adminEmail: 'gerencia@laterraza.co',
      adminFullName: 'Carlos Mendoza',
      adminPasswordPlain: 'ClaveSegura2026!',
      tier: 'business',
      presetKey: 'preset:gastro-bar-restaurant',
    });

    const initialClaims = harness.jwtVault.verifyAccessToken(reg.accessToken);
    expect(initialClaims.sub_ver).toBe(1);
    expect(initialClaims.services['srv:invoicing']).toContain('ms:invoicing-simple-receipt');
    expect(initialClaims.services['srv:inventory']).toContain('ms:inventory-recipes');
    expect(initialClaims.readonly_microservices).toHaveLength(0);

    // 2. El cajero tiene un carrito POS en curso con modo 'ms:invoicing-simple-receipt'
    const activeCart = {
      tenantId: reg.tenant.id,
      branchId: reg.mainBranch.id,
      documentEmitMode: 'ms:invoicing-simple-receipt' as const,
      customerTaxId: '222222222222',
      items: [
        {
          lineId: 'l1',
          sku: 'HAMB-01',
          name: 'Hamburguesa Artesanal',
          quantityFixed4: '2.0000',
          unitPriceFixed4: '32500.0000',
          taxRatePercent: '8',
        },
      ],
      reconciledNotice: null,
    };

    expect(PosCartCapabilityReconciler.calculateCartTotalFixed4(activeCart.items)).toBe(
      '70200.0000',
    );

    // 3. El cliente evoluciona y activa Facturación Electrónica DIAN (`ms:invoicing-electronic-dian`)
    // Esta activación debe:
    // - Reemplazar automáticamente (`supersedes`) a `ms:invoicing-simple-receipt` pasándolo a `READONLY_ARCHIVE`
    // - Incrementar `sub_ver` a 2 en PostgreSQL y en Redis
    const activation = await harness.catalogUseCases.activateMicroservice(
      reg.tenant.id,
      'ms:invoicing-electronic-dian',
    );

    expect(activation.subVer).toBe(2);
    expect(activation.services['srv:invoicing']).toContain('ms:invoicing-electronic-dian');
    expect(activation.services['srv:invoicing']).not.toContain('ms:invoicing-simple-receipt');
    expect(activation.readonlyMicroservices).toContain('ms:invoicing-simple-receipt');
    expect(activation.supersededToReadonly).toEqual(['ms:invoicing-simple-receipt']);

    // 4. Si el cliente intenta usar su token viejo (sub_ver = 1), el DoubleKeyServiceGuard detecta ERR_SUB_VER_STALE
    const guard = new DoubleKeyServiceGuard(harness.jwtVault, harness.stateCache);
    await expect(
      guard.verifyAndExecute(
        {
          authorizationHeader: `Bearer ${reg.accessToken}`,
          method: 'POST',
        },
        'srv:invoicing',
        'ms:invoicing-pos',
        async () => 'ok',
      ),
    ).rejects.toMatchObject({
      errorCode: PROVEKO_ERROR_CODES.ERR_SUB_VER_STALE,
      statusCode: 401,
    });

    // 5. El Frontend ejecuta Silent Refresh (`refreshCapabilitiesToken`) y reconcilia el carrito POS sin perder ítems
    const refreshed = await harness.authUseCases.refreshCapabilitiesToken(reg.accessToken);
    expect(refreshed.subVer).toBe(2);
    const newClaims = harness.jwtVault.verifyAccessToken(refreshed.accessToken);

    const reconciledCart = PosCartCapabilityReconciler.reconcileCartOnSubVerUpdate(
      activeCart,
      newClaims,
    );
    expect(reconciledCart.documentEmitMode).toBe('ms:invoicing-electronic-dian');
    expect(reconciledCart.items).toHaveLength(1);
    expect(reconciledCart.reconciledNotice).toContain('ms:invoicing-electronic-dian');

    // 6. Verificar que `ms:invoicing-simple-receipt` permite lectura histórica (GET) pero bloquea escritura (POST)
    const historicalGet = await guard.verifyAndExecute(
      {
        authorizationHeader: `Bearer ${refreshed.accessToken}`,
        method: 'GET',
      },
      'srv:invoicing',
      'ms:invoicing-simple-receipt',
      async (ctx) => ({
        tenantId: ctx.tenantId,
        isReadonly: ctx.isReadonlyArchive,
      }),
    );
    expect(historicalGet.isReadonly).toBe(true);

    await expect(
      guard.verifyAndExecute(
        {
          authorizationHeader: `Bearer ${refreshed.accessToken}`,
          method: 'POST',
        },
        'srv:invoicing',
        'ms:invoicing-simple-receipt',
        async () => 'should-not-run',
      ),
    ).rejects.toMatchObject({
      errorCode: PROVEKO_ERROR_CODES.ERR_MICROSERVICE_READONLY_ARCHIVE,
      statusCode: 403,
    });

    // 7. Bloqueo de dependencias inversas (`reverse_requires`): intentar apagar `ms:crm-directory`
    // mientras `ms:invoicing-electronic-dian` y `ms:invoicing-pos` dependen de él debe arrojar 409
    await expect(
      harness.catalogUseCases.deactivateMicroservice(reg.tenant.id, 'ms:crm-directory'),
    ).rejects.toMatchObject({
      errorCode: PROVEKO_ERROR_CODES.ERR_DEPENDENT_MICROSERVICES_ACTIVE,
      statusCode: 409,
    });

    // 8. Corte Maestro en Cascada (Kill-Switch del Servicio Padre `srv:gastro`):
    // Si se apaga el Servicio Padre `srv:gastro`, todos sus microservicios hijos quedan bloqueados en el Gateway
    const afterParentOff = await harness.catalogUseCases.deactivateParentService(
      reg.tenant.id,
      'srv:gastro',
    );
    expect(afterParentOff.services['srv:gastro']).toBeUndefined();
    const tokenAfterOff = await harness.authUseCases.refreshCapabilitiesToken(
      refreshed.accessToken,
    );

    await expect(
      guard.verifyAndExecute(
        {
          authorizationHeader: `Bearer ${tokenAfterOff.accessToken}`,
          method: 'GET',
        },
        'srv:gastro',
        'ms:gastro-tables',
        async () => 'blocked',
      ),
    ).rejects.toMatchObject({
      errorCode: PROVEKO_ERROR_CODES.ERR_PARENT_SERVICE_DISABLED,
      statusCode: 403,
    });
  });

  it('2. Envelope Encryption (KEK + DEK), Rotación de Llave sin Downtime, Anti-Tampering AAD y Micro-Pools con Graceful Drain', async () => {
    const harness = createInMemoryControlPlaneHarness();

    const envelope = harness.cryptoVault.sealDatabaseCredentials(
      'tenant-001',
      'cell-db-01',
      {
        host: '10.0.10.11',
        adminPort: 5432,
        poolerPort: 6432,
        dbName: 'db_tenant_001',
        username: 'u_t001',
        password: 'super_secret_db_password',
      },
    );

    // El sobre serializado para Redis jamás contiene la contraseña en texto plano
    expect(JSON.stringify(envelope)).not.toContain('super_secret_db_password');

    // Si un atacante intenta usar el sobre de `tenant-001` para `tenant-002`, falla la verificación AAD
    expect(() =>
      harness.cryptoVault.unsealDatabaseCredentials(envelope, 'tenant-002', 'cell-db-01'),
    ).toThrowError(ProvekoDomainError);

    // Rotación a kek-v2 sin descifrar ni perder acceso
    const rotatedVault = new EnvelopeCryptoVault({
      activeKekId: 'kek-v2',
      keysHex: { 'kek-v1': harness.kek1, 'kek-v2': harness.kek2 },
    });
    const reWrapped = rotatedVault.reWrapEnvelopeToActiveKek(envelope);
    expect(reWrapped.kekId).toBe('kek-v2');
    const unsealed = rotatedVault.unsealDatabaseCredentials(
      reWrapped,
      'tenant-001',
      'cell-db-01',
    );
    expect(unsealed.password).toBe('super_secret_db_password');

    // Probar TenantConnectionPoolManager con Graceful Drain al expulsar de LRU
    const executedSql: string[] = [];
    const poolManager = new TenantConnectionPoolManager(
      rotatedVault,
      {
        getEncryptedEnvelope: async (tenantId, cellId) =>
          rotatedVault.sealDatabaseCredentials(tenantId, cellId, {
            host: '10.0.10.11',
            adminPort: 5432,
            poolerPort: 6432,
            dbName: `db_${tenantId}`,
            username: `u_${tenantId}`,
            password: `pw_${tenantId}`,
          }),
      },
      (_creds, maxConnections) => ({
        maxConnections,
        connect: async (): Promise<TenantSqlClient> => ({
          query: async <R = Record<string, unknown>>(sql: string) => {
            executedSql.push(sql);
            return { rows: [] as R[] };
          },
          release: () => {},
        }),
        query: async <R = Record<string, unknown>>(sql: string) => {
          executedSql.push(sql);
          return { rows: [] as R[] };
        },
        end: async () => {
          executedSql.push('POOL_ENDED');
        },
      }),
      { maxActiveTenantPools: 2 },
    );

    const token = harness.jwtVault.signAccessToken({
      tenant_id: 't1',
      cell_id: 'cell-db-01',
      user_id: 'u1',
      role_key: 'admin',
      tier: 'business',
      is_sandbox: false,
      active_branch_id: 'br-1',
      allowed_branch_ids: ['br-1'],
      sub_ver: 1,
      services: { 'srv:inventory': ['ms:inventory-stock'] },
      readonly_microservices: [],
    });

    const guard = new DoubleKeyServiceGuard(harness.jwtVault);
    await guard.verifyAndExecute(
      { authorizationHeader: `Bearer ${token}`, method: 'POST' },
      'srv:inventory',
      'ms:inventory-stock',
      async () => {
        await poolManager.executeInServiceTransaction('srv:inventory', async (client) => {
          await client.query('INSERT INTO "srv_inventory"."stk_items" (sku) VALUES ($1)', [
            'SKU-100',
          ]);
        });
      },
    );

    expect(executedSql).toEqual([
      'BEGIN',
      'SET LOCAL search_path TO srv_inventory, public',
      'INSERT INTO "srv_inventory"."stk_items" (sku) VALUES ($1)',
      'COMMIT',
    ]);

    await poolManager.drainAll();
    expect(executedSql).toContain('POOL_ENDED');
  });

  it('3. Warm Demo Sandbox Pool (<30ms para Pauta Publicitaria), Validación WCAG AA + Anti-XSS de Temas, JSONB/SSRF Guards y Outbox/Inbox', async () => {
    const harness = createInMemoryControlPlaneHarness();
    const app = buildCoreServiceFastifyServer({
      authUseCases: harness.authUseCases,
      catalogUseCases: harness.catalogUseCases,
      onboardingUseCases: harness.onboardingUseCases,
    });

    // 1. Asignación instantánea de Sandbox vía Fastify HTTP
    const sbxRes = await app.inject({
      method: 'POST',
      url: '/api/v1/onboarding/instant-sandbox',
      payload: { presetKey: 'preset:gastro-bar-restaurant' },
    });
    expect(sbxRes.statusCode).toBe(201);
    const sbxBody = sbxRes.json<{
      tenantId: string;
      accessToken: string;
      dbName: string;
    }>();
    expect(sbxBody.dbName).toBe('db_sandbox_001');

    // Promover Sandbox a Tenant permanente conservando su base de datos
    const promoted = await harness.onboardingUseCases.claimSandboxToPermanentTenant(
      sbxBody.tenantId,
      'Restaurante El Fogón S.A.S.',
      '900888777-1',
      'business',
    );
    expect(promoted.isSandbox).toBe(false);
    expect(promoted.tier).toBe('business');

    // 2. Validación de Temas: bloquear estilo oscuro neón y bloquear inyección XSS
    expect(() =>
      CssThemeTokensVo.createCustomTenantTheme({
        surfaceCanvasHex: '#020617', // Lienzo oscuro prohibido en Workstation
      }),
    ).toThrowError(ProvekoDomainError);

    expect(() =>
      CssThemeTokensVo.createCustomTenantTheme({
        primaryColorHex: '#FFFF00', // Amarillo sin contraste suficiente con texto blanco
      }),
    ).toThrowError(ProvekoDomainError);

    expect(() =>
      CssThemeTokensVo.createCustomTenantTheme({
        primaryColorHex: 'red; } </style><script>alert(1)</script>',
      }),
    ).toThrowError(ProvekoDomainError);

    // 3. Sanitización de cabeceras y bloqueo Anti-SSRF / JSONB Bomb
    const cleanedHeaders = sanitizeInboundTenantHeaders({
      'x-tenant-id': 'spoofed-tenant',
      'x-proveko-internal': 'true',
      'content-type': 'application/json',
    });
    expect(cleanedHeaders['x-tenant-id']).toBeUndefined();
    expect(cleanedHeaders['content-type']).toBe('application/json');

    expect(() =>
      CustomFieldsAndWebhookGuard.assertPublicWebhookTargetIp('169.254.169.254'),
    ).toThrowError(ProvekoDomainError);
    expect(() =>
      CustomFieldsAndWebhookGuard.assertPublicWebhookTargetIp('10.0.0.15'),
    ).toThrowError(ProvekoDomainError);

    // 4. Idempotencia exacta en HybridOutboxInboxEngine
    const processedSet = new Set<string>();
    const dirtyTenants = new Set<string>();
    const publishedMessages: string[] = [];

    const eventEngine = new HybridOutboxInboxEngine(
      {
        insertOutboxEvent: async () => {},
        markEventPublished: async () => {},
        fetchPendingEventsForTenant: async () => [],
      },
      {
        markTenantDirty: async (t) => {
          dirtyTenants.add(t);
        },
        removeCleanTenant: async (t) => {
          dirtyTenants.delete(t);
        },
        getDirtyTenants: async () => Array.from(dirtyTenants),
      },
      {
        publishIdempotent: async (_subj, msgId) => {
          publishedMessages.push(msgId);
        },
      },
      {
        tryRecordProcessedEvent: async (tenantId, schema, eventId, consumerKey) => {
          const key = `${tenantId}:${schema}:${eventId}:${consumerKey}`;
          if (processedSet.has(key)) return false;
          processedSet.add(key);
          return true;
        },
      },
    );

    const saleEvent: import('@proveko/event-bus').ProvekoDomainEventEnvelope = {
      eventId: 'ev-sale-001',
      eventType: 'invoicing.pos.sale_completed',
      tenantId: promoted.id,
      cellId: promoted.cellId,
      branchId: 'br-01',
      occurredAtIso: new Date().toISOString(),
      activeServicesSnapshot: {
        'srv:inventory': ['ms:inventory-stock', 'ms:inventory-recipes'],
      },
      payload: { total: MoneyDecimal.from('50000').toFixed4() },
    };

    await eventEngine.enqueueAndRelayImmediate(saleEvent);
    expect(publishedMessages).toEqual(['ev-sale-001']);
    expect(dirtyTenants.size).toBe(0);

    let recipeDeductions = 0;
    const firstRun = await eventEngine.consumeWithIdempotentInbox(
      saleEvent,
      'srv_inventory',
      'srv:inventory',
      'ms:inventory-recipes',
      async () => {
        recipeDeductions += 1;
      },
    );
    const duplicateRun = await eventEngine.consumeWithIdempotentInbox(
      saleEvent,
      'srv_inventory',
      'srv:inventory',
      'ms:inventory-recipes',
      async () => {
        recipeDeductions += 1;
      },
    );

    expect(firstRun.reason).toBe('EXECUTED');
    expect(duplicateRun.reason).toBe('SKIPPED_DUPLICATE');
    expect(recipeDeductions).toBe(1);

    await app.close();
  });

  it('4. Auditoría SOLID & Chaos: Transacción Compensatoria Saga en Fase 2, Bloqueo Cross-Parent en Desactivación Padre, SSRF IPv4-mapped IPv6 y Nomenclatura Unificada (ms:*/mod:*)', async () => {
    const harness = createInMemoryControlPlaneHarness();

    const reg = await harness.onboardingUseCases.registerNewTenant({
      slug: 'hotel-central-bogota',
      legalName: 'Hotel Central Bogotá S.A.S.',
      taxIdNit: '901222333-4',
      adminEmail: 'admin@hotelcentral.co',
      adminFullName: 'Laura Gómez',
      adminPasswordPlain: 'ClaveHotel2026!',
      tier: 'business',
      presetKey: 'preset:gastro-bar-restaurant',
    });

    // 1. Nomenclatura Unificada: activar Microservicio Padre `ms:hotel` y Módulo `mod:hotel-rooms`
    await harness.catalogUseCases.activateParentMicroservice(reg.tenant.id, 'ms:hotel');
    const modRes = await harness.catalogUseCases.activateModule(reg.tenant.id, 'mod:hotel-rooms');
    expect(modRes.services['srv:hotel']).toContain('ms:hotel-rooms');

    // 2. Bloqueo Cross-Parent: intentar apagar el Microservicio Padre `ms:crm` mientras `ms:invoicing-pos` (en `srv:invoicing`)
    // depende de `ms:crm-directory` debe ser bloqueado con 409 ERR_DEPENDENT_MICROSERVICES_ACTIVE
    await expect(
      harness.catalogUseCases.deactivateParentMicroservice(reg.tenant.id, 'ms:crm'),
    ).rejects.toMatchObject({
      errorCode: PROVEKO_ERROR_CODES.ERR_DEPENDENT_MICROSERVICES_ACTIVE,
      statusCode: 409,
    });

    // 3. Transacción Compensatoria de la Saga: si la Fase 2 (DDL/Migraciones) falla al activar `mod:hotel-bookings`,
    // el módulo no debe quedar huérfano en `PROVISIONING`, sino revertirse a `DISABLED`
    const originalProvision = harness.dbProvisioner.provisionServiceSchemaAndMigrations;
    harness.dbProvisioner.provisionServiceSchemaAndMigrations = async () => {
      throw new Error('Simulated PostgreSQL cell connection timeout during Umzug migration');
    };

    await expect(
      harness.catalogUseCases.activateModule(reg.tenant.id, 'mod:hotel-bookings'),
    ).rejects.toThrowError(/Simulated PostgreSQL cell connection timeout/);

    const subsAfterFailedMigration = await harness.catalogRepo.findMicroservicesByTenant(
      reg.tenant.id,
    );
    const failedBookingSub = subsAfterFailedMigration.find(
      (s) => s.microserviceKey === 'ms:hotel-bookings',
    );
    expect(failedBookingSub?.status).toBe('DISABLED');

    // Restaurar provisioner y verificar que el reintento ahora sí pasa a ACTIVE
    harness.dbProvisioner.provisionServiceSchemaAndMigrations = originalProvision;
    const retryActivation = await harness.catalogUseCases.activateModule(
      reg.tenant.id,
      'mod:hotel-bookings',
    );
    expect(retryActivation.services['srv:hotel']).toContain('ms:hotel-bookings');

    // 4. Bloqueo Anti-SSRF para direcciones IPv4-mapped IPv6 (`::ffff:169.254.169.254`, `::ffff:127.0.0.1`, `::ffff:7f00:1`)
    expect(() =>
      CustomFieldsAndWebhookGuard.assertPublicWebhookTargetIp('::ffff:169.254.169.254'),
    ).toThrowError(ProvekoDomainError);
    expect(() =>
      CustomFieldsAndWebhookGuard.assertPublicWebhookTargetIp('::ffff:127.0.0.1'),
    ).toThrowError(ProvekoDomainError);
    expect(() =>
      CustomFieldsAndWebhookGuard.assertPublicWebhookTargetIp('::ffff:7f00:1'),
    ).toThrowError(ProvekoDomainError);
  });
});

