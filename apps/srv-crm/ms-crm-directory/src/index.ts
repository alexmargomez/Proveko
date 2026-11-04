import {
  type DoubleKeyServiceGuard,
  type ProvekoMicroservicePlugin,
  StandaloneMicroserviceServer,
  defineProvekoMicroservice,
} from '@proveko/service-guard';
import { CrmDirectoryUseCases } from './application.js';
import type { CreateDirectoryContactDto, CrmDirectoryRepositoryPort } from './domain.js';
import { InMemoryCrmDirectoryRepositoryAdapter } from './infrastructure.js';

export * from './domain.js';
export * from './application.js';
export * from './infrastructure.js';

export function buildCrmDirectoryPlugin(
  repository: CrmDirectoryRepositoryPort = new InMemoryCrmDirectoryRepositoryAdapter(),
): Readonly<ProvekoMicroservicePlugin> {
  const useCases = new CrmDirectoryUseCases(repository);

  return defineProvekoMicroservice({
    parentService: 'srv:crm',
    microserviceKey: 'ms:crm-directory',
    tablePrefix: 'dir_',
    version: '1.0.0',
    routes: [
      {
        method: 'GET',
        subPath: '/contacts',
        description: 'Listar terceros/clientes del directorio CRM del inquilino activo',
        handler: async (ctx) =>
          useCases.listContacts(ctx.tenantId, ctx.activeBranchId, ctx.isReadonlyArchive),
      },
      {
        method: 'POST',
        subPath: '/contacts',
        description: 'Crear tercero/cliente validando custom_fields JSONB y límite de crédito Decimal',
        handler: async (ctx, req) =>
          useCases.createContact(
            ctx.tenantId,
            ctx.activeBranchId,
            (req.body ?? {}) as CreateDirectoryContactDto,
          ),
      },
    ],
  });
}

export const msCrmDirectoryPlugin = buildCrmDirectoryPlugin();

/**
 * Permite levantar `mod:crm-directory` (`ms:crm-directory`) completamente solo en un servidor dedicado
 */
export function createStandaloneCrmDirectoryServer(
  guard: DoubleKeyServiceGuard,
  serverNodeId?: string,
  repository?: CrmDirectoryRepositoryPort,
): StandaloneMicroserviceServer {
  const plugin = repository ? buildCrmDirectoryPlugin(repository) : msCrmDirectoryPlugin;
  return new StandaloneMicroserviceServer(plugin, guard, serverNodeId);
}

