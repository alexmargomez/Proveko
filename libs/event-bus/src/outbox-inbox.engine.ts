import type { ActiveServicesTree, MicroserviceKey } from '@proveko/shared-kernel';

export interface ProvekoDomainEventEnvelope<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  tenantId: string;
  cellId: string;
  branchId: string;
  occurredAtIso: string;
  activeServicesSnapshot: ActiveServicesTree;
  payload: TPayload;
}

export interface OutboxStoragePort {
  insertOutboxEvent(envelope: ProvekoDomainEventEnvelope): Promise<void>;
  markEventPublished(tenantId: string, eventId: string): Promise<void>;
  fetchPendingEventsForTenant(
    tenantId: string,
    limit: number,
  ): Promise<ProvekoDomainEventEnvelope[]>;
}

export interface DirtyTenantsSetPort {
  markTenantDirty(tenantId: string): Promise<void>;
  removeCleanTenant(tenantId: string): Promise<void>;
  getDirtyTenants(): Promise<string[]>;
}

export interface BrokerPublisherPort {
  publishIdempotent(
    subject: string,
    msgId: string,
    envelope: ProvekoDomainEventEnvelope,
  ): Promise<void>;
}

export interface InboxDeduplicationPort {
  /**
   * Intenta insertar `(event_id, consumer_key)` en `<schema>.inbox_processed_events`.
   * Retorna `true` si es la primera vez que se procesa, o `false` si ya existía (duplicado).
   */
  tryRecordProcessedEvent(
    tenantId: string,
    schemaName: string,
    eventId: string,
    consumerKey: MicroserviceKey | string,
  ): Promise<boolean>;
}

/**
 * Motor Híbrido Transactional Outbox (Post-Commit Relay + Redis Dirty-Set Sweeper, Cero Polling Ciego)
 * + Transactional Inbox Idempotente [P2-03]
 */
export class HybridOutboxInboxEngine {
  constructor(
    private readonly outboxStorage: OutboxStoragePort,
    private readonly dirtySet: DirtyTenantsSetPort,
    private readonly broker: BrokerPublisherPort,
    private readonly inboxPort: InboxDeduplicationPort,
  ) {}

  /**
   * Paso 1: Se invoca dentro de la transacción ACID de negocio y luego dispara el relay inmediato
   */
  public async enqueueAndRelayImmediate(envelope: ProvekoDomainEventEnvelope): Promise<void> {
    await this.outboxStorage.insertOutboxEvent(envelope);
    await this.dirtySet.markTenantDirty(envelope.tenantId);

    // Intento de despacho inmediato Post-Commit con Msg-Id para deduplicación nativa en NATS JetStream
    try {
      await this.broker.publishIdempotent(envelope.eventType, envelope.eventId, envelope);
      await this.outboxStorage.markEventPublished(envelope.tenantId, envelope.eventId);
      const remaining = await this.outboxStorage.fetchPendingEventsForTenant(envelope.tenantId, 1);
      if (remaining.length === 0) {
        await this.dirtySet.removeCleanTenant(envelope.tenantId);
      }
    } catch {
      // Si el broker falla momentáneamente, el tenant queda en `proveko:outbox:dirty_tenants`
      // para ser drenado por `sweepDirtyTenants()` sin perder jamás el evento.
    }
  }

  /**
   * Sweeper inteligente: solo consulta las bases de datos de los inquilinos marcados en el Set de Redis
   * Cero queries SQL cuando todos los tenants están al día.
   */
  public async sweepDirtyTenants(batchSize = 50): Promise<number> {
    const dirtyTenants = await this.dirtySet.getDirtyTenants();
    let totalPublished = 0;

    for (const tenantId of dirtyTenants) {
      const pending = await this.outboxStorage.fetchPendingEventsForTenant(tenantId, batchSize);
      if (pending.length === 0) {
        await this.dirtySet.removeCleanTenant(tenantId);
        continue;
      }

      let allSucceeded = true;
      for (const ev of pending) {
        try {
          await this.broker.publishIdempotent(ev.eventType, ev.eventId, ev);
          await this.outboxStorage.markEventPublished(tenantId, ev.eventId);
          totalPublished += 1;
        } catch {
          allSucceeded = false;
          break;
        }
      }

      if (allSucceeded && pending.length < batchSize) {
        await this.dirtySet.removeCleanTenant(tenantId);
      }
    }

    return totalPublished;
  }

  /**
   * Wrapper Transactional Inbox: Garantiza procesamiento exactamente-una-vez por microservicio consumidor
   * y verifica además que el microservicio consumidor esté ACTIVO en el snapshot del tenant.
   */
  public async consumeWithIdempotentInbox(
    envelope: ProvekoDomainEventEnvelope,
    parentServiceSchema: string,
    parentServiceKey: keyof ActiveServicesTree,
    consumerMicroservice: MicroserviceKey,
    handler: (envelope: ProvekoDomainEventEnvelope) => Promise<void>,
  ): Promise<{ executed: boolean; reason: 'EXECUTED' | 'SKIPPED_INACTIVE' | 'SKIPPED_DUPLICATE' }> {
    const activeChildren = envelope.activeServicesSnapshot[parentServiceKey] ?? [];
    if (!activeChildren.includes(consumerMicroservice)) {
      return { executed: false, reason: 'SKIPPED_INACTIVE' };
    }

    const isFirstTime = await this.inboxPort.tryRecordProcessedEvent(
      envelope.tenantId,
      parentServiceSchema,
      envelope.eventId,
      consumerMicroservice,
    );

    if (!isFirstTime) {
      return { executed: false, reason: 'SKIPPED_DUPLICATE' };
    }

    await handler(envelope);
    return { executed: true, reason: 'EXECUTED' };
  }
}
