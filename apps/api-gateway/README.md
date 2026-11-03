# `@proveko/api-gateway` — Puerta Perimetral Zero-Trust y Enrutador Multi-Servidor

## Propósito
El **API Gateway** es el punto único de entrada HTTP hacia todos los servicios de **Proveko**. Aplica seguridad perimetral Zero-Trust y resuelve dinámicamente a qué servidor físico o contenedor debe enviarse cada petición.

## Responsabilidades Principales
1. **Sanitización Anti-Spoofing (`sanitizeInboundTenantHeaders`):** Purga cualquier cabecera entrante `x-proveko-*`, `x-tenant-*` o `x-cell-*` enviada desde Internet.
2. **Verificación Criptográfica y de Frescura (`DoubleKeyServiceGuard`):**
   - Verifica la firma asimétrica `Ed25519` del JWT.
   - Comprueba en Redis que `jwt.sub_ver === redis.sub_ver` (devolviendo `401 ERR_SUB_VER_STALE` si el plan cambió en caliente).
   - Valida la **Doble Llave**: que el Servicio Padre (`srv:*`) esté activo y que el Microservicio hijo (`ms:*`) esté activo o en modo `READONLY_ARCHIVE` (bloqueando `POST/PUT/PATCH/DELETE`).
3. **Rate Limiting por Tier (`TenantTierRateLimiter`):** Controla ráfagas según el plan del inquilino (`sandbox_ephemeral`, `basic`, `business`, `enterprise`).
4. **Enrutamiento Jerárquico en 2 Niveles (`UpstreamRouteRegistry`):**
   - **Nivel 1 (Servidor Dedicado por Microservicio):** Si existe `UPSTREAM_MS_<MICROSERVICE>` (ej. `UPSTREAM_MS_INVOICING_ELECTRONIC_DIAN`), enruta directamente a ese servidor dedicado.
   - **Nivel 2 (Fallback al Servidor del Servicio Padre):** Si no tiene servidor dedicado, enruta al `host-runner` del Servicio Padre (`UPSTREAM_SRV_<SERVICE>`).
