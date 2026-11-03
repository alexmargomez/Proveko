import Fastify, { type FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  MICROSERVICE_KEYS,
  type MicroserviceKey,
  PROVEKO_ERROR_CODES,
  ProvekoDomainError,
  SEED_INDUSTRY_PRESETS,
  SEED_MICROSERVICES_CATALOG,
  SEED_SERVICES_CATALOG,
  SERVICE_KEYS,
  type ServiceKey,
} from '@proveko/shared-kernel';
import { AuthAndRoutingUseCases } from '../../application/auth/auth.use-cases.js';
import { CatalogCapabilityUseCases } from '../../application/catalog/catalog.use-cases.js';
import { OnboardingAndGrowthUseCases } from '../../application/onboarding/onboarding.use-cases.js';

const ActivateServiceDto = z.object({
  tenantId: z.string().min(3),
  serviceKey: z.enum(SERVICE_KEYS),
});

const ActivateMicroserviceDto = z.object({
  tenantId: z.string().min(3),
  microserviceKey: z.enum(MICROSERVICE_KEYS),
});

const InstantSandboxDto = z.object({
  presetKey: z.string().min(3),
});

const LoginDto = z.object({
  tenantId: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  branchId: z.string().optional(),
});

const RefreshDto = z.object({
  token: z.string().min(10),
});

export interface CoreServiceHttpDependencies {
  authUseCases: AuthAndRoutingUseCases;
  catalogUseCases: CatalogCapabilityUseCases;
  onboardingUseCases: OnboardingAndGrowthUseCases;
}

/**
 * Servidor HTTP de alta velocidad sobre Fastify para `core-service`
 * Incluye serialización de errores determinista RFC 9457 Problem Details [P3-01]
 */
export function buildCoreServiceFastifyServer(
  deps: CoreServiceHttpDependencies,
): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ProvekoDomainError) {
      return reply
        .status(error.statusCode)
        .header('content-type', 'application/problem+json')
        .send(error.toProblemDetails());
    }

    if (error instanceof z.ZodError) {
      const domainErr = new ProvekoDomainError(
        PROVEKO_ERROR_CODES.ERR_VALIDATION_FAILED,
        422,
        'Input validation failed.',
        { issues: error.issues },
      );
      return reply
        .status(422)
        .header('content-type', 'application/problem+json')
        .send(domainErr.toProblemDetails());
    }

    return reply.status(500).send({
      type: 'https://errors.proveko.com/internal_error',
      title: 'INTERNAL_SERVER_ERROR',
      status: 500,
      detail: error instanceof Error ? error.message : 'Unexpected error',
    });
  });

  // 1. Endpoint Público Cacheable para la Portada Comercial y Simulador de Pauta Publicitaria
  app.get('/api/v1/public/catalog/presets', async () => {
    return {
      services: SEED_SERVICES_CATALOG,
      microservices: SEED_MICROSERVICES_CATALOG,
      presets: SEED_INDUSTRY_PRESETS,
    };
  });

  // 2. Asignación Instantánea (<30ms) de Sandbox Pre-Calentado para visitantes de anuncios
  app.post('/api/v1/onboarding/instant-sandbox', async (request, reply) => {
    const body = InstantSandboxDto.parse(request.body);
    const result = await deps.onboardingUseCases.assignWarmSandboxForAdVisitor(body.presetKey);
    return reply.status(201).send(result);
  });

  // 3. Autenticación Multi-Sede y Emisión JWT Ed25519
  app.post('/api/v1/auth/login', async (request) => {
    const body = LoginDto.parse(request.body);
    return deps.authUseCases.login(
      body.tenantId,
      body.email,
      body.password,
      body.branchId,
    );
  });

  // 4. Silent Refresh cuando cambia `sub_ver` en caliente (`ERR_SUB_VER_STALE`)
  app.post('/api/v1/auth/refresh', async (request) => {
    const body = RefreshDto.parse(request.body);
    return deps.authUseCases.refreshCapabilitiesToken(body.token);
  });

  // 5. Activación y Desactivación de Servicios Padres Gatekeepers (`srv:*`)
  app.post('/api/v1/catalog/services/activate', async (request) => {
    const body = ActivateServiceDto.parse(request.body);
    return deps.catalogUseCases.activateParentService(
      body.tenantId,
      body.serviceKey as ServiceKey,
    );
  });

  app.post('/api/v1/catalog/services/deactivate', async (request) => {
    const body = ActivateServiceDto.parse(request.body);
    return deps.catalogUseCases.deactivateParentService(
      body.tenantId,
      body.serviceKey as ServiceKey,
    );
  });

  // 6. Saga de Activación y Desactivación de Microservicios (`ms:*`)
  app.post('/api/v1/catalog/microservices/activate', async (request) => {
    const body = ActivateMicroserviceDto.parse(request.body);
    return deps.catalogUseCases.activateMicroservice(
      body.tenantId,
      body.microserviceKey as MicroserviceKey,
    );
  });

  app.post('/api/v1/catalog/microservices/deactivate', async (request) => {
    const body = ActivateMicroserviceDto.parse(request.body);
    return deps.catalogUseCases.deactivateMicroservice(
      body.tenantId,
      body.microserviceKey as MicroserviceKey,
    );
  });

  // 7. Endpoint Interno para resolver el Sobre Cifrado KEK+DEK (`@proveko/tenant-db-resolver`)
  app.get<{ Params: { tenantId: string } }>(
    '/api/v1/internal/tenants/:tenantId/connection-envelope',
    async (request) => {
      const envelope = await deps.authUseCases.resolveEncryptedConnectionEnvelope(
        request.params.tenantId,
      );
      return { envelope };
    },
  );

  return app;
}
