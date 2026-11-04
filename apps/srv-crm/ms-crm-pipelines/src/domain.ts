import { MoneyDecimal, PROVEKO_ERROR_CODES, ProvekoDomainError } from '@proveko/shared-kernel';

export type PipelineStageKey = 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'WON' | 'LOST';

export interface CreatePipelineDealDto {
  contactId: string;
  stageKey: PipelineStageKey;
  expectedValue: string;
}

export interface PipelineDealRecord {
  tenantId: string;
  contactId: string;
  stageKey: PipelineStageKey;
  expectedValue: string;
}

/**
 * Puerto de Repositorio del Embudo Comercial CRM (SOLID DIP)
 */
export interface CrmPipelinesRepositoryPort {
  listByTenant(tenantId: string): Promise<PipelineDealRecord[]>;
  saveDeal(deal: PipelineDealRecord): Promise<PipelineDealRecord>;
}

const VALID_STAGES: ReadonlySet<string> = new Set<PipelineStageKey>([
  'LEAD',
  'QUALIFIED',
  'PROPOSAL',
  'WON',
  'LOST',
]);

export function buildValidatedPipelineDeal(
  tenantId: string,
  input: CreatePipelineDealDto,
): PipelineDealRecord {
  if (typeof input.contactId !== 'string' || input.contactId.trim().length === 0) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Field "contactId" is required.',
    );
  }
  if (!input.stageKey || !VALID_STAGES.has(input.stageKey)) {
    throw new ProvekoDomainError(
      PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
      422,
      'Invalid "stageKey"; expected LEAD, QUALIFIED, PROPOSAL, WON, or LOST.',
    );
  }
  const expectedValue = MoneyDecimal.from(input.expectedValue)
    .assertNonNegative('expectedValue')
    .toFixed4();

  return {
    tenantId,
    contactId: input.contactId.trim(),
    stageKey: input.stageKey,
    expectedValue,
  };
}
