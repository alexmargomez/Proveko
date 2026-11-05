import { describe, expect, it } from 'vitest';
import { Ed25519JwtVault } from '@proveko/crypto-vault';
import { DoubleKeyServiceGuard } from '@proveko/service-guard';
import { PROVEKO_ERROR_CODES, type ProvekoJwtClaims } from '@proveko/shared-kernel';
import {
  BillingSubscriptionService,
  ModularSubscriptionQuoteEngine,
} from '../../control-plane/billing-service/src/index.js';
import { createSrvCrmHostRunner } from '../../srv-crm/host-runner/src/index.js';
import { createSrvFinanceHostRunner } from '../../srv-finance/host-runner/src/index.js';
import { createSrvGastroHostRunner } from '../../srv-gastro/host-runner/src/index.js';
import { createSrvHotelHostRunner } from '../../srv-hotel/host-runner/src/index.js';
import { createSrvInventoryHostRunner } from '../../srv-inventory/host-runner/src/index.js';
import { createSrvInvoicingHostRunner } from '../../srv-invoicing/host-runner/src/index.js';
import { createStandaloneInvoicingElectronicDianServer } from '../../srv-invoicing/ms-invoicing-electronic-dian/src/index.js';
import {
  ProvekoWorkstationHttpClient,
  evaluateWorkstationCapabilityGate,
} from '../../web-app/src/index.js';
import {
  ProvekoApiGateway,
  startProvekoClusterNodeHttpServer,
  UpstreamRouteRegistry,
} from '../src/index.js';

describe('Proveko — Full Outward Ecosystem: API Gateway, Multi-Server Topology, Billing, 6 Parent Services (20 Microservices) & Workstation', () => {
  it('1. Distribución en Múltiples Servidores: Host-Runner en Servidor 2 + Microservicio DIAN aislado en Servidor 3 + Enrutamiento 2 Niveles en API Gateway', async () => {
    const keyPair = Ed25519JwtVault.generateKeyPairEntry('kid-2026-main');
    const jwtVault = new Ed25519JwtVault('kid-2026-main', [keyPair]);

    let redisSubVer = 4;
    const guard = new DoubleKeyServiceGuard(jwtVault, {
      getCurrentSubVer: async () => redisSubVer,
    });

    // Servidor 2: Host-Runner de Facturación corriendo SOLO POS, Recibo Simple y Cotizaciones (excluye DIAN porque DIAN vive en el Servidor 3)
    const server2InvoicingHost = createSrvInvoicingHostRunner(
      guard,
      'ms:invoicing-pos,ms:invoicing-simple-receipt,ms:invoicing-quotes',
      'server-02:host-runner:srv:invoicing',
    );
    expect(server2InvoicingHost.getMountedMicroserviceKeys()).toEqual([
      'ms:invoicing-pos',
      'ms:invoicing-simple-receipt',
      'ms:invoicing-quotes',
    ]);
    expect(server2InvoicingHost.hasMicroservice('ms:invoicing-electronic-dian')).toBe(false);

    // Servidor 3: Servidor Dedicado exclusivo para Facturación Electrónica DIAN
    const server3DedicatedDian = createStandaloneInvoicingElectronicDianServer(
      guard,
      'server-03:dedicated:ms:invoicing-electronic-dian',
    );

    // Servidor 4: Host-Runner de Inventario con todos sus 4 microservicios hijos
    const server4InventoryHost = createSrvInventoryHostRunner(
      guard,
      '*',
      'server-04:host-runner:srv:inventory',
    );

    // Configurar el Registro de Enrutamiento de 2 Niveles en el API Gateway
    const upstreamRegistry = new UpstreamRouteRegistry({});
    upstreamRegistry.registerParentServiceHostServer(
      'srv:invoicing',
      'http://10.10.0.20:4100',
      server2InvoicingHost,
    );
    upstreamRegistry.registerDedicatedMicroserviceServer(
      'ms:invoicing-electronic-dian',
      'http://10.10.0.30:4199',
      server3DedicatedDian,
    );
    upstreamRegistry.registerParentServiceHostServer(
      'srv:inventory',
      'http://10.10.0.40:4200',
      server4InventoryHost,
    );

    const gateway = new ProvekoApiGateway(guard, upstreamRegistry);

    const token = jwtVault.signAccessToken({
      tenant_id: 'tenant-bar-01',
      cell_id: 'cell-db-01',
      user_id: 'usr-01',
      role_key: 'admin',
      tier: 'business',
      is_sandbox: false,
      active_branch_id: 'br-main',
      allowed_branch_ids: ['br-main', 'br-north'],
      sub_ver: 4,
      services: {
        'srv:invoicing': ['ms:invoicing-pos', 'ms:invoicing-electronic-dian'],
        'srv:inventory': ['ms:inventory-stock', 'ms:inventory-recipes', 'ms:inventory-lots'],
        'srv:crm': ['ms:crm-directory'],
      },
      readonly_microservices: ['ms:invoicing-simple-receipt'],
    });

    // A) Petición a POS -> El Gateway la envía al Servidor 2 (PARENT_SERVICE_HOST_RUNNER)
    const posRes = await gateway.handleGatewayRequest({
      method: 'POST',
      url: '/api/v1/srv:invoicing/ms:invoicing-pos/checkout',
      headers: {
        authorization: `Bearer ${token}`,
        'x-tenant-id': 'spoofed-hacker-tenant', // Debe ser purgado por el Gateway
      },
      body: {
        contactId: 'dir-customer-99',
        lines: [{ sku: 'BURGER-01', quantity: '2.0000', unitPrice: '25000.0000', taxPercent: '8.00' }],
      },
    });

    expect(posRes.status).toBe(201);
    expect(posRes.headers['x-proveko-routing-mode']).toBe('PARENT_SERVICE_HOST_RUNNER');
    expect(posRes.headers['x-proveko-gateway-routed-to']).toBe('server-02:host-runner:srv:invoicing');
    expect((posRes.body as any).tenantId).toBe('tenant-bar-01');
    expect((posRes.body as any).grandTotal).toBe('54000.0000');
    expect((posRes.body as any).resolvedFiscalEmitter).toBe('ms:invoicing-electronic-dian');

    // B) Petición a Facturación DIAN -> El Gateway la envía automáticamente al Servidor 3 Dedicado (DEDICATED_MICROSERVICE_SERVER)
    const dianRes = await gateway.handleGatewayRequest({
      method: 'POST',
      url: '/api/v1/srv:invoicing/ms:invoicing-electronic-dian/invoices/emit',
      headers: { authorization: `Bearer ${token}` },
      body: {
        prefixAndNumber: 'SETP990000123',
        issuerNit: '901999888',
        customerNit: '222222222222',
        subtotal: '100000.0000',
        ivaPercent: '19.00',
      },
    });

    expect(dianRes.status).toBe(201);
    expect(dianRes.headers['x-proveko-routing-mode']).toBe('DEDICATED_MICROSERVICE_SERVER');
    expect(dianRes.headers['x-proveko-gateway-routed-to']).toBe(
      'server-03:dedicated:ms:invoicing-electronic-dian',
    );
    expect((dianRes.body as any).grandTotal).toBe('119000.0000');
    expect((dianRes.body as any).cufeSha384).toHaveLength(96);

    // C) Petición a ms:invoicing-simple-receipt (en READONLY_ARCHIVE porque fue reemplazado por DIAN):
    // GET histórico funciona (200), pero POST nuevo recibo es bloqueado (403 ERR_MICROSERVICE_READONLY_ARCHIVE)
    const archiveGetRes = await gateway.handleGatewayRequest({
      method: 'GET',
      url: '/api/v1/srv:invoicing/ms:invoicing-simple-receipt/receipts',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(archiveGetRes.status).toBe(200);
    expect((archiveGetRes.body as any).isReadonlyArchive).toBe(true);

    const archivePostRes = await gateway.handleGatewayRequest({
      method: 'POST',
      url: '/api/v1/srv:invoicing/ms:invoicing-simple-receipt/receipts',
      headers: { authorization: `Bearer ${token}` },
      body: { consecutiveNumber: 'RCP-0002', customerName: 'Test', totalAmount: '10000.0000' },
    });
    expect(archivePostRes.status).toBe(403);
    expect((archivePostRes.body as any).error_code).toBe(
      PROVEKO_ERROR_CODES.ERR_MICROSERVICE_READONLY_ARCHIVE,
    );

    // D) Si sub_ver en Redis sube a 5, el Gateway rechaza el token viejo con 401 ERR_SUB_VER_STALE
    redisSubVer = 5;
    const staleRes = await gateway.handleGatewayRequest({
      method: 'GET',
      url: '/api/v1/srv:inventory/ms:inventory-stock/items',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(staleRes.status).toBe(401);
    expect((staleRes.body as any).error_code).toBe(PROVEKO_ERROR_CODES.ERR_SUB_VER_STALE);
  });

  it('2. Billing-Service: Cotizador Modular (Gatekeeper, Requires, Mutex Conflict y Descuento Preset) + Webhook HMAC-SHA256 Idempotente', async () => {
    const quoteEngine = new ModularSubscriptionQuoteEngine();

    // A) Intentar cotizar un microservicio sin su Servicio Padre Gatekeeper falla con 422 ERR_PARENT_SERVICE_DISABLED
    expect(() =>
      quoteEngine.calculateQuote({
        enabledServices: [],
        selectedMicroservices: ['ms:inventory-stock'],
      }),
    ).toThrowError(/parent gatekeeper service/);

    // B) Intentar cotizar dos microservicios del mismo mutex_group (Recibo Simple + Facturación DIAN) falla con 409 ERR_MUTEX_GROUP_CONFLICT
    expect(() =>
      quoteEngine.calculateQuote({
        enabledServices: ['srv:invoicing', 'srv:crm'],
        selectedMicroservices: [
          'ms:crm-directory',
          'ms:invoicing-pos',
          'ms:invoicing-simple-receipt',
          'ms:invoicing-electronic-dian',
        ],
      }),
    ).toThrowError(/Cannot bill mutually exclusive microservices/);

    // C) Cotizar el Preset Comercial de Bar/Restaurante aplica 15% de descuento exacto + IVA 19% con Decimal
    const gastroQuote = quoteEngine.calculateQuote({
      enabledServices: ['srv:invoicing', 'srv:inventory', 'srv:gastro', 'srv:crm'],
      selectedMicroservices: [
        'ms:crm-directory', // 9
        'ms:invoicing-pos', // 19
        'ms:invoicing-simple-receipt', // 5
        'ms:inventory-stock', // 19
        'ms:inventory-recipes', // 15
        'ms:gastro-tables', // 15
        'ms:gastro-kds', // 19
        'ms:gastro-split-check', // 9
      ],
      presetKey: 'preset:gastro-bar-restaurant',
    });

    // Subtotal = 9 + 19 + 5 + 19 + 15 + 15 + 19 + 9 = 110.0000 USD
    // Descuento 15% = 16.5000 USD -> Neto = 93.5000 USD -> IVA 19% = 17.7650 USD -> Total = 111.2650 USD
    expect(gastroQuote.subtotalUsd).toBe('110.0000');
    expect(gastroQuote.discountUsd).toBe('16.5000');
    expect(gastroQuote.netBeforeTaxUsd).toBe('93.5000');
    expect(gastroQuote.taxUsd).toBe('17.7650');
    expect(gastroQuote.totalMonthlyUsd).toBe('111.2650');

    // D) Procesar Webhook firmado con HMAC-SHA256 e idempotencia
    let provisionedCalls = 0;
    const billingService = new BillingSubscriptionService('whsec_proveko_2026', {
      enableServicesAndMicroservices: async () => {
        provisionedCalls += 1;
        return { newSubVer: 2 };
      },
    });

    const rawWebhook = JSON.stringify({
      webhookEventId: 'evt_wompi_998877',
      provider: 'wompi',
      tenantId: 'tenant-gastro-77',
      enabledServices: gastroQuote.enabledServices,
      selectedMicroservices: gastroQuote.selectedMicroservices.map((m) => m.microserviceKey),
      presetKey: 'preset:gastro-bar-restaurant',
      paidAmountUsd: '111.2650',
    });

    const signature = billingService.signWebhookPayload(rawWebhook);
    const firstProcess = await billingService.processPaymentConfirmedWebhook(rawWebhook, signature);
    expect(firstProcess.alreadyProcessed).toBe(false);
    expect(firstProcess.newSubVer).toBe(2);
    expect(provisionedCalls).toBe(1);

    // Reintento duplicado del mismo webhook no vuelve a aprovisionar
    const duplicateProcess = await billingService.processPaymentConfirmedWebhook(
      rawWebhook,
      signature,
    );
    expect(duplicateProcess.alreadyProcessed).toBe(true);
    expect(provisionedCalls).toBe(1);
  });

  it('3. Ejecución de los 6 Servicios Padres (CRM, Inventario, Facturación, Gastro, Hotel, Finanzas PUC) + Single-Flight Refresh en Web-App', async () => {
    const keyPair = Ed25519JwtVault.generateKeyPairEntry('kid-2026-all');
    const jwtVault = new Ed25519JwtVault('kid-2026-all', [keyPair]);
    const guard = new DoubleKeyServiceGuard(jwtVault);

    const crmRunner = createSrvCrmHostRunner(guard);
    const invRunner = createSrvInventoryHostRunner(guard);
    const gastroRunner = createSrvGastroHostRunner(guard);
    const hotelRunner = createSrvHotelHostRunner(guard);
    const financeRunner = createSrvFinanceHostRunner(guard);

    const fullClaims: Omit<ProvekoJwtClaims, 'iss' | 'aud' | 'jti' | 'iat' | 'exp'> = {
      tenant_id: 'tenant-enterprise-01',
      cell_id: 'cell-db-01',
      user_id: 'usr-admin',
      role_key: 'owner',
      tier: 'enterprise',
      is_sandbox: false,
      active_branch_id: 'br-01',
      allowed_branch_ids: ['br-01', 'br-02'],
      sub_ver: 10,
      services: {
        'srv:crm': ['ms:crm-directory', 'ms:crm-pipelines', 'ms:crm-loyalty'],
        'srv:inventory': [
          'ms:inventory-stock',
          'ms:inventory-recipes',
          'ms:inventory-lots',
          'ms:inventory-transfers',
        ],
        'srv:invoicing': ['ms:invoicing-pos', 'ms:invoicing-electronic-dian', 'ms:invoicing-quotes'],
        'srv:gastro': ['ms:gastro-tables', 'ms:gastro-kds', 'ms:gastro-split-check'],
        'srv:hotel': ['ms:hotel-rooms', 'ms:hotel-bookings', 'ms:hotel-frontdesk'],
        'srv:finance': ['ms:finance-ar-ap', 'ms:finance-accounting-puc'],
      },
      readonly_microservices: ['ms:invoicing-simple-receipt', 'ms:finance-cashbook'],
    };

    const bearer = `Bearer ${jwtVault.signAccessToken(fullClaims)}`;

    // 1. Inventario: Explosión de Receta BOM y asignación de Lotes FEFO
    const recipeRes = await invRunner.dispatch('ms:inventory-recipes', {
      method: 'POST',
      path: '/recipes/explode-cost',
      headers: { authorization: bearer },
      body: {
        finishedProductSku: 'COCKTAIL-MOJITO',
        soldQuantity: '3.0000',
        ingredients: [
          { ingredientSku: 'RUM-ML', quantityRequired: '60.0000', unitCost: '85.5000' },
          { ingredientSku: 'MINT-GR', quantityRequired: '10.0000', unitCost: '40.0000' },
        ],
      },
    });
    expect(recipeRes.status).toBe(201);
    expect((recipeRes.body as any).totalRecipeCost).toBe('16590.0000');

    const fefoRes = await invRunner.dispatch('ms:inventory-lots', {
      method: 'POST',
      path: '/batches/allocate-fefo',
      headers: { authorization: bearer },
      body: {
        sku: 'MED-AMOX-500',
        requestedQty: '15.0000',
        batches: [
          { batchCode: 'LOT-LATE', expirationDate: '2027-06-01', availableQty: '20.0000' },
          { batchCode: 'LOT-SOON', expirationDate: '2026-12-15', availableQty: '10.0000' },
        ],
      },
    });
    expect(fefoRes.status).toBe(201);
    expect((fefoRes.body as any).allocations).toEqual([
      { batchCode: 'LOT-SOON', expirationDate: '2026-12-15', allocatedQty: '10.0000' },
      { batchCode: 'LOT-LATE', expirationDate: '2027-06-01', allocatedQty: '5.0000' },
    ]);

    // 2. Gastro: División de cuenta por silla con propina Decimal
    const splitRes = await gastroRunner.dispatch('ms:gastro-split-check', {
      method: 'POST',
      path: '/checks/split-by-seats',
      headers: { authorization: bearer },
      body: {
        tableCode: 'MESA-12',
        tipRatePercent: '10.00',
        seatSubtotals: [
          { seatNumber: 1, subtotal: '45000.0000' },
          { seatNumber: 2, subtotal: '30000.0000' },
        ],
      },
    });
    expect(splitRes.status).toBe(201);
    expect((splitRes.body as any).splits[0].totalDue).toBe('49500.0000');

    // 3. Hotel: Reserva por noches y cargo al folio en recepción
    const bookingRes = await hotelRunner.dispatch('ms:hotel-bookings', {
      method: 'POST',
      path: '/reservations',
      headers: { authorization: bearer },
      body: {
        guestContactId: 'dir-guest-01',
        roomNumber: '304',
        nightsCount: 3,
        nightlyRate: '180000.0000',
      },
    });
    expect(bookingRes.status).toBe(201);
    expect((bookingRes.body as any).estimatedTotal).toBe('540000.0000');

    // 4. Finanzas PUC: Partida doble cuadrada vs descuadrada
    const unbalancedPucRes = await financeRunner.dispatch('ms:finance-accounting-puc', {
      method: 'POST',
      path: '/journal/post-voucher',
      headers: { authorization: bearer },
      body: {
        voucherNumber: 'CBTE-001',
        lines: [
          { pucAccountCode: '110505', thirdPartyContactId: 'dir-1', debit: '100.0000', credit: '0.0000' },
          { pucAccountCode: '413501', thirdPartyContactId: 'dir-1', debit: '0.0000', credit: '90.0000' },
        ],
      },
    });
    expect(unbalancedPucRes.status).toBe(422);

    const balancedPucRes = await financeRunner.dispatch('ms:finance-accounting-puc', {
      method: 'POST',
      path: '/journal/post-voucher',
      headers: { authorization: bearer },
      body: {
        voucherNumber: 'CBTE-002',
        lines: [
          { pucAccountCode: '110505', thirdPartyContactId: 'dir-1', debit: '119000.0000', credit: '0.0000' },
          { pucAccountCode: '413501', thirdPartyContactId: 'dir-1', debit: '0.0000', credit: '100000.0000' },
          { pucAccountCode: '240801', thirdPartyContactId: 'dir-1', debit: '0.0000', credit: '19000.0000' },
        ],
      },
    });
    expect(balancedPucRes.status).toBe(201);
    expect((balancedPucRes.body as any).balanced).toBe(true);

    // 5. CRM Loyalty: Acumulación de puntos
    const loyaltyRes = await crmRunner.dispatch('ms:crm-loyalty', {
      method: 'POST',
      path: '/accrue',
      headers: { authorization: bearer },
      body: { contactId: 'dir-1', invoiceAmount: '200000.0000' },
    });
    expect(loyaltyRes.status).toBe(201);
    expect((loyaltyRes.body as any).pointsEarned).toBe('10000.0000');

    // 6. Web-App: Single-Flight Silent Refresh deduplica 5 errores 401 ERR_SUB_VER_STALE concurrentes en 1 solo refresh
    const initialClaims = jwtVault.verifyAccessToken(bearer.slice(7));
    const webClient = new ProvekoWorkstationHttpClient(
      'old-token',
      {
        ...initialClaims,
        services: { 'srv:invoicing': ['ms:invoicing-pos', 'ms:invoicing-simple-receipt'] },
        readonly_microservices: [],
      },
      {
        refreshAccessToken: async () => ({
          newAccessToken: 'fresh-token-v11',
          newClaims: {
            ...initialClaims,
            sub_ver: 11,
            services: { 'srv:invoicing': ['ms:invoicing-pos', 'ms:invoicing-electronic-dian'] },
            readonly_microservices: ['ms:invoicing-simple-receipt'],
          },
        }),
      },
      {
        tenantId: 'tenant-enterprise-01',
        branchId: 'br-01',
        documentEmitMode: 'ms:invoicing-simple-receipt',
        customerTaxId: '900111222',
        items: [
          {
            lineId: '1',
            sku: 'PROD-1',
            name: 'Producto 1',
            quantityFixed4: '2.0000',
            unitPriceFixed4: '10000.0000',
            taxRatePercent: '19.00',
          },
        ],
        reconciledNotice: null,
      },
    );

    const concurrentResults = await Promise.all(
      [1, 2, 3, 4, 5].map(() =>
        webClient.executeWithSilentRefresh<Record<string, unknown>>(async (tok) => {
          if (tok === 'Bearer old-token') {
            return {
              status: 401,
              body: { error_code: PROVEKO_ERROR_CODES.ERR_SUB_VER_STALE },
            };
          }
          return {
            status: 200,
            body: { ok: true, usedToken: tok },
          };
        }),
      ),
    );

    expect(webClient.refreshCallCount).toBe(1);
    expect(concurrentResults.every((r) => r.status === 200)).toBe(true);
    expect(webClient.getActivePosCart()?.documentEmitMode).toBe('ms:invoicing-electronic-dian');

    // 7. Evaluador de <CapabilityGate> para Servicio Padre vacío vs Readonly Archive
    const emptyGate = evaluateWorkstationCapabilityGate(
      { services: { 'srv:inventory': [] }, readonly_microservices: [] },
      'srv:inventory',
    );
    expect(emptyGate.mode).toBe('PARENT_GATEKEEPER_EMPTY_CONTAINER');

    const archiveGate = evaluateWorkstationCapabilityGate(
      webClient.getCurrentClaims(),
      'srv:invoicing',
      'ms:invoicing-simple-receipt',
    );
    expect(archiveGate.mode).toBe('READONLY_ARCHIVE_BANNER');
  });

  it('4. Auditoría SOLID Hexagonal (20 Módulos), Rutas Unificadas /api/v1/ms:*/mod:*, Prevención Path Traversal y Recuperación TOCTOU en Webhooks', async () => {
    const keyPair = Ed25519JwtVault.generateKeyPairEntry('kid-2026-solid');
    const jwtVault = new Ed25519JwtVault('kid-2026-solid', [keyPair]);
    const guard = new DoubleKeyServiceGuard(jwtVault);

    const invRunner = createSrvInventoryHostRunner(guard);
    const financeRunner = createSrvFinanceHostRunner(guard);

    const upstreamRegistry = new UpstreamRouteRegistry({});
    upstreamRegistry.registerParentServiceHostServer(
      'ms:inventory',
      'http://10.10.0.40:4200',
      invRunner,
    );
    upstreamRegistry.registerParentServiceHostServer(
      'ms:finance',
      'http://10.10.0.60:4600',
      financeRunner,
    );

    const gateway = new ProvekoApiGateway(guard, upstreamRegistry);

    const token = jwtVault.signAccessToken({
      tenant_id: 'tenant-solid-01',
      cell_id: 'cell-db-01',
      user_id: 'usr-01',
      role_key: 'admin',
      tier: 'business',
      is_sandbox: false,
      active_branch_id: 'br-01',
      allowed_branch_ids: ['br-01', 'br-02'],
      sub_ver: 1,
      services: {
        'srv:inventory': ['ms:inventory-stock', 'ms:inventory-transfers'],
        'srv:finance': ['ms:finance-accounting-puc'],
      },
      readonly_microservices: [],
    });

    // 1. Enrutamiento con Nomenclatura Unificada `/api/v1/ms:inventory/mod:inventory-stock/items?page=1&limit=25`
    const stockGetRes = await gateway.handleGatewayRequest({
      method: 'GET',
      url: '/api/v1/ms:inventory/mod:inventory-stock/items?page=1&limit=25',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(stockGetRes.status).toBe(200);
    expect(stockGetRes.headers['x-proveko-parent-microservice']).toBe('ms:inventory');
    expect(stockGetRes.headers['x-proveko-module']).toBe('mod:inventory-stock');

    // 2. Prevención de Path Traversal (`..` / `%2e%2e`) en el API Gateway -> 400 ERR_VALIDATION_FAILED
    const traversalRes = await gateway.handleGatewayRequest({
      method: 'GET',
      url: '/api/v1/ms:inventory/mod:inventory-stock/items/..%2f..%2fadmin',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(traversalRes.status).toBe(400);
    expect((traversalRes.body as any).error_code).toBe(PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED);

    // 3. Invariantes de Dominio Hexagonal en `mod:inventory-stock`: rechazar stock insuficiente y cantidades negativas
    const negativeStockRes = await gateway.handleGatewayRequest({
      method: 'POST',
      url: '/api/v1/ms:inventory/mod:inventory-stock/movements',
      headers: { authorization: `Bearer ${token}` },
      body: {
        sku: 'SKU-LAPTOP',
        name: 'Laptop Pro',
        movementType: 'IN',
        quantity: '-5.0000',
        unitCost: '1000.0000',
      },
    });
    expect(negativeStockRes.status).toBe(422);
    expect((negativeStockRes.body as any).error_code).toBe(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
    );

    const outMovementInsufficientRes = await gateway.handleGatewayRequest({
      method: 'POST',
      url: '/api/v1/ms:inventory/mod:inventory-stock/movements',
      headers: { authorization: `Bearer ${token}` },
      body: {
        sku: 'SKU-LAPTOP',
        name: 'Laptop Pro',
        movementType: 'OUT',
        quantity: '10.0000',
        unitCost: '1000.0000',
      },
    });
    expect(outMovementInsufficientRes.status).toBe(422);

    // 4. Invariante de Dominio en `mod:inventory-transfers`: bloquear transferencia circular a la misma sucursal
    const circularTransferRes = await gateway.handleGatewayRequest({
      method: 'POST',
      url: '/api/v1/ms:inventory/mod:inventory-transfers/transfers',
      headers: { authorization: `Bearer ${token}` },
      body: {
        targetBranchId: 'br-01', // Igual a active_branch_id ('br-01')
        items: [{ sku: 'SKU-LAPTOP', quantity: '2.0000' }],
      },
    });
    expect(circularTransferRes.status).toBe(422);

    // 5. Invariante de Dominio en `mod:finance-accounting-puc`: bloquear línea con Débito > 0 y Crédito > 0 simultáneos y descuadre contable
    const simultaneousDebitCreditRes = await gateway.handleGatewayRequest({
      method: 'POST',
      url: '/api/v1/ms:finance/mod:finance-accounting-puc/journal/post-voucher',
      headers: { authorization: `Bearer ${token}` },
      body: {
        voucherNumber: 'CBTE-ERR-LINE',
        lines: [
          {
            pucAccountCode: '110505',
            thirdPartyContactId: 'dir-1',
            debit: '50.0000',
            credit: '50.0000',
          },
          {
            pucAccountCode: '413501',
            thirdPartyContactId: 'dir-1',
            debit: '0.0000',
            credit: '50.0000',
          },
        ],
      },
    });
    expect(simultaneousDebitCreditRes.status).toBe(422);
    expect((simultaneousDebitCreditRes.body as any).error_code).toBe(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
    );

    const imbalanceRes = await gateway.handleGatewayRequest({
      method: 'POST',
      url: '/api/v1/ms:finance/mod:finance-accounting-puc/journal/post-voucher',
      headers: { authorization: `Bearer ${token}` },
      body: {
        voucherNumber: 'CBTE-IMBALANCE',
        lines: [
          {
            pucAccountCode: '110505',
            thirdPartyContactId: 'dir-1',
            debit: '100.0000',
            credit: '0.0000',
          },
          {
            pucAccountCode: '413501',
            thirdPartyContactId: 'dir-1',
            debit: '0.0000',
            credit: '80.0000',
          },
        ],
      },
    });
    expect(imbalanceRes.status).toBe(422);
    expect((imbalanceRes.body as any).error_code).toBe(
      PROVEKO_ERROR_CODES.ERR_ACCOUNTING_IMBALANCE,
    );

    // 6. Billing Webhook: bloqueo TOCTOU + liberación de lock si falla el downstream + validación de JSON y monto
    let shouldFailProvision = true;
    const billingService = new BillingSubscriptionService('whsec_solid_2026', {
      enableServicesAndMicroservices: async () => {
        if (shouldFailProvision) {
          throw new Error('Downstream Core-Service temporary network error');
        }
        return { newSubVer: 3 };
      },
    });

    // JSON malformado firmado válidamente -> 422 ERR_VALIDATION_FAILED
    const badJson = '{malformed-json';
    const badJsonSig = billingService.signWebhookPayload(badJson);
    await expect(
      billingService.processPaymentConfirmedWebhook(badJson, badJsonSig),
    ).rejects.toMatchObject({
      errorCode: PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      statusCode: 422,
    });

    // Monto pagado no coincide con la cotización -> 422 ERR_PAYMENT_AMOUNT_MISMATCH
    const mismatchPayload = JSON.stringify({
      webhookEventId: 'evt_mismatch_01',
      provider: 'stripe',
      tenantId: 'tenant-solid-01',
      enabledServices: ['srv:crm'],
      selectedMicroservices: ['ms:crm-directory'],
      paidAmountUsd: '1.0000',
    });
    await expect(
      billingService.processPaymentConfirmedWebhook(
        mismatchPayload,
        billingService.signWebhookPayload(mismatchPayload),
      ),
    ).rejects.toMatchObject({
      errorCode: PROVEKO_ERROR_CODES.ERR_PAYMENT_AMOUNT_MISMATCH,
      statusCode: 422,
    });

    // Si falla el aprovisionamiento downstream, libera el lock para que el reintento del proveedor de pagos tenga éxito
    const validPayload = JSON.stringify({
      webhookEventId: 'evt_retry_01',
      provider: 'stripe',
      tenantId: 'tenant-solid-01',
      enabledServices: ['srv:crm'],
      selectedMicroservices: ['ms:crm-directory'],
      paidAmountUsd: '10.7100', // 9.0000 + 19% IVA (1.7100) = 10.7100
    });
    const validSig = billingService.signWebhookPayload(validPayload);

    await expect(
      billingService.processPaymentConfirmedWebhook(validPayload, validSig),
    ).rejects.toThrowError(/Downstream Core-Service temporary network error/);

    shouldFailProvision = false;
    const recoveredWebhook = await billingService.processPaymentConfirmedWebhook(
      validPayload,
      validSig,
    );
    expect(recoveredWebhook.alreadyProcessed).toBe(false);
    expect(recoveredWebhook.newSubVer).toBe(3);
  });

  it('5. Cluster Multi-Contenedor ALpanel sobre HTTP Real: Contenedores Independientes ms-invoicing, ms-inventory, core-service y api-gateway comunicándose por red TCP', async () => {
    const sharedMasterSeed = 'proveko-alpanel-cluster-test-seed-2026';
    const sharedKid = 'kid-alpanel-2026';

    // 1. Levantar contenedor independiente de Microservicio ms-invoicing
    const msInvoicingContainer = await startProvekoClusterNodeHttpServer({
      nodeRole: 'ms-host-runner',
      port: 0,
      host: '127.0.0.1',
      parentService: 'ms:invoicing',
      nodeId: 'proveko_ms_invoicing',
      jwtMasterSeed: sharedMasterSeed,
      jwtKid: sharedKid,
    });

    // 2. Levantar contenedor independiente de Microservicio ms-inventory
    const msInventoryContainer = await startProvekoClusterNodeHttpServer({
      nodeRole: 'ms-host-runner',
      port: 0,
      host: '127.0.0.1',
      parentService: 'ms:inventory',
      nodeId: 'proveko_ms_inventory',
      jwtMasterSeed: sharedMasterSeed,
      jwtKid: sharedKid,
    });

    // 3. Levantar contenedor independiente de Control Plane core-service
    const coreServiceContainer = await startProvekoClusterNodeHttpServer({
      nodeRole: 'core-service',
      port: 0,
      host: '127.0.0.1',
      nodeId: 'proveko_core_service',
      jwtMasterSeed: sharedMasterSeed,
      jwtKid: sharedKid,
    });

    // 4. Levantar contenedor api-gateway apuntando por red HTTP real a los contenedores ms-invoicing y ms-inventory
    const apiGatewayContainer = await startProvekoClusterNodeHttpServer({
      nodeRole: 'api-gateway',
      port: 0,
      host: '127.0.0.1',
      nodeId: 'proveko_api_gateway',
      jwtMasterSeed: sharedMasterSeed,
      jwtKid: sharedKid,
      env: {
        UPSTREAM_MS_INVOICING: msInvoicingContainer.baseUrl,
        UPSTREAM_MS_INVENTORY: msInventoryContainer.baseUrl,
      },
    });

    try {
      // A) Verificar healthcheck de core-service (6 microservicios, 20 módulos y 23 archivos .sql de migración)
      const coreHealthRes = await fetch(`${coreServiceContainer.baseUrl}/health`);
      expect(coreHealthRes.status).toBe(200);
      const coreHealthJson = (await coreHealthRes.json()) as any;
      expect(coreHealthJson.servicesCount).toBe(6);
      expect(coreHealthJson.modulesCount).toBe(20);
      expect(coreHealthJson.sqlMigrationsCount).toBe(23);

      // B) Emitir token firmado con la semilla Ed25519 del cluster y enviar petición HTTP al contenedor api-gateway
      const token = apiGatewayContainer.jwtVault.signAccessToken({
        tenant_id: 'tenant-alpanel-01',
        cell_id: 'cell-db-01',
        user_id: 'usr-alpanel',
        role_key: 'admin',
        tier: 'business',
        is_sandbox: false,
        active_branch_id: 'br-01',
        allowed_branch_ids: ['br-01'],
        sub_ver: 1,
        services: {
          'srv:invoicing': ['ms:invoicing-electronic-dian', 'ms:invoicing-pos'],
          'srv:inventory': ['ms:inventory-stock'],
        },
        readonly_microservices: [],
      });

      const dianHttpRes = await fetch(
        `${apiGatewayContainer.baseUrl}/api/v1/ms:invoicing/mod:invoicing-electronic-dian/invoices/emit`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prefixAndNumber: 'SETP990000777',
            issuerNit: '901999888',
            customerNit: '222222222222',
            subtotal: '200000.0000',
            ivaPercent: '19.00',
          }),
        },
      );

      expect(dianHttpRes.status).toBe(201);
      expect(dianHttpRes.headers.get('x-proveko-routing-mode')).toBe('PARENT_SERVICE_HOST_RUNNER');
      expect(dianHttpRes.headers.get('x-proveko-gateway-base-url')).toBe(
        msInvoicingContainer.baseUrl,
      );
      expect(dianHttpRes.headers.get('x-proveko-parent-microservice')).toBe('ms:invoicing');
      expect(dianHttpRes.headers.get('x-proveko-module')).toBe('mod:invoicing-electronic-dian');

      const dianBody = (await dianHttpRes.json()) as any;
      expect(dianBody.grandTotal).toBe('238000.0000');
      expect(dianBody.cufeSha384).toHaveLength(96);

      // C) Seguridad de Microservicio Instalado Fuera (Otro VPS):
      // Si un atacante intenta llamar directo a la URL del microservicio saltándose el API Gateway
      // (incluso teniendo un JWT Ed25519 válido), el Sello HMAC-SHA256 de Clúster lo bloquea con 403.
      const directBypassNoHmacRes = await fetch(`${msInvoicingContainer.baseUrl}/invoices/emit`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
          'x-proveko-target-parent': 'ms:invoicing',
          'x-proveko-target-module': 'mod:invoicing-electronic-dian',
        },
        body: JSON.stringify({
          prefixAndNumber: 'SETP990000778',
          issuerNit: '901999888',
          customerNit: '222222222222',
          subtotal: '100000.0000',
          ivaPercent: '19.00',
        }),
      });
      expect(directBypassNoHmacRes.status).toBe(403);
      const bypassNoHmacBody = (await directBypassNoHmacRes.json()) as any;
      expect(bypassNoHmacBody.error_code).toBe(PROVEKO_ERROR_CODES.ERR_CLUSTER_SIGNATURE_INVALID);

      // D) Si intenta falsificar la firma HMAC-SHA256 sin tener PROVEKO_CLUSTER_SECRET, también recibe 403
      const directBypassForgedHmacRes = await fetch(
        `${msInvoicingContainer.baseUrl}/invoices/emit`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
            'x-proveko-target-parent': 'ms:invoicing',
            'x-proveko-target-module': 'mod:invoicing-electronic-dian',
            'x-proveko-cluster-ts': String(Math.floor(Date.now() / 1000)),
            'x-proveko-cluster-sig': '0'.repeat(64),
          },
          body: JSON.stringify({
            prefixAndNumber: 'SETP990000779',
            issuerNit: '901999888',
            customerNit: '222222222222',
            subtotal: '100000.0000',
            ivaPercent: '19.00',
          }),
        },
      );
      expect(directBypassForgedHmacRes.status).toBe(403);
      const bypassForgedBody = (await directBypassForgedHmacRes.json()) as any;
      expect(bypassForgedBody.error_code).toBe(PROVEKO_ERROR_CODES.ERR_CLUSTER_SIGNATURE_INVALID);
    } finally {
      await Promise.all([
        apiGatewayContainer.close(),
        coreServiceContainer.close(),
        msInventoryContainer.close(),
        msInvoicingContainer.close(),
      ]);
    }
  });
});

