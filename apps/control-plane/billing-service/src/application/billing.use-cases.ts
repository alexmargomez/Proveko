import crypto from 'node:crypto';
import {
  type IndustryPresetKey,
  type MicroserviceKey,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  type ServiceKey,
} from '@proveko/shared-kernel';
import {
  type ModularQuoteBreakdown,
  ModularSubscriptionQuoteEngine,
} from '../domain/pricing-catalog.js';

export interface CoreCapabilityProvisioningPort {
  enableServicesAndMicroservices(
    tenantId: string,
    services: ReadonlyArray<ServiceKey>,
    microservices: ReadonlyArray<MicroserviceKey>,
  ): Promise<{ newSubVer: number }>;
}

export interface PaymentWebhookPayload {
  webhookEventId: string;
  provider: 'wompi' | 'stripe' | 'mercadopago';
  tenantId: string;
  enabledServices: ServiceKey[];
  selectedMicroservices: MicroserviceKey[];
  presetKey?: IndustryPresetKey;
  paidAmountUsd: string;
}

/**
 * Procesador de Suscripciones y Webhooks de Pasarela de Pago (`@proveko/billing-service`):
 * 1. Verifica firma HMAC-SHA256 con `crypto.timingSafeEqual`.
 * 2. Garantiza idempotencia por `webhookEventId`.
 * 3. Valida que el monto pagado coincida exactamente con la cotización `MoneyDecimal` (`NUMERIC(19,4)`).
 * 4. Dispara el aprovisionamiento en `core-service` (habilitando los Servicios Padres Gatekeepers y Microservicios Hijos).
 */
export class BillingSubscriptionService {
  private readonly processedWebhookIds = new Set<string>();
  private readonly quoteEngine = new ModularSubscriptionQuoteEngine();

  constructor(
    private readonly webhookHmacSecret: string,
    private readonly coreProvisioningPort: CoreCapabilityProvisioningPort,
  ) {}

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

    const payload = JSON.parse(rawPayload) as PaymentWebhookPayload;

    const quote = this.quoteEngine.calculateQuote({
      enabledServices: payload.enabledServices,
      selectedMicroservices: payload.selectedMicroservices,
      presetKey: payload.presetKey,
    });

    if (this.processedWebhookIds.has(payload.webhookEventId)) {
      return {
        alreadyProcessed: true,
        quote,
        newSubVer: null,
      };
    }

    if (quote.totalMonthlyUsd !== payload.paidAmountUsd) {
      throw new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_MISSING_PREREQUISITES,
        422,
        `Paid amount (${payload.paidAmountUsd}) does not match calculated modular quote (${quote.totalMonthlyUsd}).`,
        {
          expected_total_usd: quote.totalMonthlyUsd,
          received_paid_usd: payload.paidAmountUsd,
        },
      );
    }

    this.processedWebhookIds.add(payload.webhookEventId);

    const { newSubVer } = await this.coreProvisioningPort.enableServicesAndMicroservices(
      payload.tenantId,
      payload.enabledServices,
      payload.selectedMicroservices,
    );

    return {
      alreadyProcessed: false,
      quote,
      newSubVer,
    };
  }
}
