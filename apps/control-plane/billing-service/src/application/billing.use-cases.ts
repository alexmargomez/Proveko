import crypto from 'node:crypto';
import {
  type IndustryPresetKey,
  type MicroserviceKey,
  type ModuleKey,
  MoneyDecimal,
  normalizeModuleKey,
  normalizeParentMicroserviceKey,
  type ParentMicroserviceKey,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  type ServiceKey,
} from '@proveko/shared-kernel';
import {
  type ModularQuoteBreakdown,
  ModularSubscriptionQuoteEngine,
  type SubscriptionQuoteCalculatorPort,
} from '../domain/pricing-catalog.js';

export interface CoreCapabilityProvisioningPort {
  enableServicesAndMicroservices(
    tenantId: string,
    services: ReadonlyArray<ServiceKey>,
    microservices: ReadonlyArray<MicroserviceKey>,
  ): Promise<{ newSubVer: number }>;
}

/**
 * Puerto de Repositorio para el Inbox de Webhooks de Pasarela de Pago (SOLID DIP + SRP)
 * Resuelve la condición de carrera TOCTOU mediante bloqueo atómico (`IN_FLIGHT`) y permite
 * liberar el bloqueo (`releaseLock`) si la llamada al Control Plane falla para habilitar reintentos.
 */
export interface WebhookInboxRepositoryPort {
  tryAcquireLock(
    webhookEventId: string,
  ): Promise<'ACQUIRED' | 'ALREADY_PROCESSED' | 'IN_FLIGHT'>;
  markProcessed(webhookEventId: string): Promise<void>;
  releaseLock(webhookEventId: string): Promise<void>;
}

export class InMemoryWebhookInboxRepositoryAdapter implements WebhookInboxRepositoryPort {
  private readonly states = new Map<string, 'IN_FLIGHT' | 'PROCESSED'>();

  public async tryAcquireLock(
    webhookEventId: string,
  ): Promise<'ACQUIRED' | 'ALREADY_PROCESSED' | 'IN_FLIGHT'> {
    const current = this.states.get(webhookEventId);
    if (current === 'PROCESSED') {
      return 'ALREADY_PROCESSED';
    }
    if (current === 'IN_FLIGHT') {
      return 'IN_FLIGHT';
    }
    this.states.set(webhookEventId, 'IN_FLIGHT');
    return 'ACQUIRED';
  }

  public async markProcessed(webhookEventId: string): Promise<void> {
    this.states.set(webhookEventId, 'PROCESSED');
  }

  public async releaseLock(webhookEventId: string): Promise<void> {
    if (this.states.get(webhookEventId) === 'IN_FLIGHT') {
      this.states.delete(webhookEventId);
    }
  }
}

export interface PaymentWebhookPayload {
  webhookEventId: string;
  provider: 'wompi' | 'stripe' | 'mercadopago';
  tenantId: string;
  enabledServices: Array<ParentMicroserviceKey | ServiceKey>;
  selectedMicroservices: Array<ModuleKey | MicroserviceKey>;
  presetKey?: IndustryPresetKey;
  paidAmountUsd: string;
}

const VALID_PROVIDERS = new Set(['wompi', 'stripe', 'mercadopago']);

function parseAndValidateWebhookPayload(rawPayload: string): PaymentWebhookPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Malformed JSON in payment webhook payload.',
    );
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Payment webhook payload must be a JSON object.',
    );
  }

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.webhookEventId !== 'string' || obj.webhookEventId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Missing or invalid "webhookEventId" in payment webhook payload.',
    );
  }
  if (typeof obj.provider !== 'string' || !VALID_PROVIDERS.has(obj.provider)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Invalid payment "provider"; expected wompi, stripe, or mercadopago.',
    );
  }
  if (typeof obj.tenantId !== 'string' || obj.tenantId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Missing or invalid "tenantId" in payment webhook payload.',
    );
  }
  if (!Array.isArray(obj.enabledServices) || !Array.isArray(obj.selectedMicroservices)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      '"enabledServices" and "selectedMicroservices" must be arrays.',
    );
  }
  if (typeof obj.paidAmountUsd !== 'string' || obj.paidAmountUsd.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Missing or invalid "paidAmountUsd" in payment webhook payload.',
    );
  }

  // Validar que paidAmountUsd sea un decimal válido y no negativo
  MoneyDecimal.from(obj.paidAmountUsd).assertNonNegative('paidAmountUsd');

  return {
    webhookEventId: obj.webhookEventId.trim(),
    provider: obj.provider as PaymentWebhookPayload['provider'],
    tenantId: obj.tenantId.trim(),
    enabledServices: obj.enabledServices as Array<ParentMicroserviceKey | ServiceKey>,
    selectedMicroservices: obj.selectedMicroservices as Array<ModuleKey | MicroserviceKey>,
    presetKey: obj.presetKey as IndustryPresetKey | undefined,
    paidAmountUsd: MoneyDecimal.from(obj.paidAmountUsd).toFixed4(),
  };
}

/**
 * Procesador de Suscripciones y Webhooks de Pasarela de Pago (`@proveko/billing-service`):
 * 1. Verifica firma HMAC-SHA256 con `crypto.timingSafeEqual`.
 * 2. Garantiza idempotencia atómica libre de TOCTOU por `webhookEventId` con rollback en caso de fallo downstream.
 * 3. Valida que el monto pagado coincida exactamente con la cotización `MoneyDecimal` (`NUMERIC(19,4)`).
 * 4. Dispara el aprovisionamiento en `core-service` (habilitando los Microservicios Padres Gatekeepers y Módulos Hijos).
 */
export class BillingSubscriptionService {
  private readonly quoteEngine: SubscriptionQuoteCalculatorPort;
  private readonly inboxRepo: WebhookInboxRepositoryPort;

  constructor(
    private readonly webhookHmacSecret: string,
    private readonly coreProvisioningPort: CoreCapabilityProvisioningPort,
    options?: {
      quoteEngine?: SubscriptionQuoteCalculatorPort;
      inboxRepo?: WebhookInboxRepositoryPort;
    },
  ) {
    this.quoteEngine = options?.quoteEngine ?? new ModularSubscriptionQuoteEngine();
    this.inboxRepo = options?.inboxRepo ?? new InMemoryWebhookInboxRepositoryAdapter();
  }

  public signWebhookPayload(rawPayload: string): string {
    return crypto.createHmac('sha256', this.webhookHmacSecret).update(rawPayload).digest('hex');
  }

  public async processPaymentConfirmedWebhook(
    rawPayload: string,
    signatureHeader: string,
  ): Promise<{
    alreadyProcessed: boolean;
    quote: ModularQuoteBreakdown;
    newSubVer: number | null;
  }> {
    const expectedSig = this.signWebhookPayload(rawPayload);
    const sigBuf = Buffer.from(signatureHeader, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_TOKEN_INVALID,
        401,
        'Invalid payment gateway HMAC-SHA256 signature.',
      );
    }

    const payload = parseAndValidateWebhookPayload(rawPayload);
    const normalizedServices = payload.enabledServices.map((s) =>
      normalizeParentMicroserviceKey(s),
    );
    const normalizedModules = payload.selectedMicroservices.map((m) =>
      normalizeModuleKey(m),
    );

    const quote = this.quoteEngine.calculateQuote({
      enabledServices: normalizedServices,
      selectedMicroservices: normalizedModules,
      presetKey: payload.presetKey,
    });

    if (quote.totalMonthlyUsd !== payload.paidAmountUsd) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_PAYMENT_AMOUNT_MISMATCH,
        422,
        `Paid amount (${payload.paidAmountUsd}) does not match calculated modular quote (${quote.totalMonthlyUsd}).`,
        {
          expected_total_usd: quote.totalMonthlyUsd,
          received_paid_usd: payload.paidAmountUsd,
        },
      );
    }

    const lockResult = await this.inboxRepo.tryAcquireLock(payload.webhookEventId);
    if (lockResult === 'ALREADY_PROCESSED' || lockResult === 'IN_FLIGHT') {
      return {
        alreadyProcessed: true,
        quote,
        newSubVer: null,
      };
    }

    try {
      const { newSubVer } = await this.coreProvisioningPort.enableServicesAndMicroservices(
        payload.tenantId,
        normalizedServices,
        normalizedModules,
      );
      await this.inboxRepo.markProcessed(payload.webhookEventId);
      return {
        alreadyProcessed: false,
        quote,
        newSubVer,
      };
    } catch (provisioningError) {
      await this.inboxRepo.releaseLock(payload.webhookEventId);
      throw provisioningError;
    }
  }
}

