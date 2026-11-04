# `@proveko/api-gateway` — Puerta Perimetral Zero-Trust y Enrutador de Microservicios

## Propósito
El **API Gateway** es el punto único de entrada HTTP hacia todos los **Microservicios Independientes (`ms:<dominio>`)** de **Proveko**. Aplica seguridad perimetral Zero-Trust, verifica qué **Módulos internos (`mod:<dominio>-<modulo>`)** tiene prendidos o apagados el cliente y enruta la petición hacia el servidor donde corre el Microservicio correspondiente.

## Responsabilidades Principales
1. **Sanitización Anti-Spoofing (`sanitizeInboundTenantHeaders`):** Purga cualquier cabecera entrante `x-proveko-*`, `x-tenant-*` o `x-cell-*` enviada desde Internet y bloquea intentos de Path Traversal (`..`, `%2e%2e`).
2. **Verificación Criptográfica y de Módulos Activos (`DoubleKeyServiceGuard`):**
   - Verifica la firma asimétrica `Ed25519` del JWT.
   - Comprueba en Redis que `jwt.sub_ver === redis.sub_ver` (devolviendo `401 ERR_SUB_VER_STALE` si el cliente prendió o apagó módulos en caliente).
   - Valida la **Doble Llave**: que el **Microservicio (`ms:<dominio>`)** esté activo y que el **Módulo interno (`mod:<dominio>-<modulo>`)** esté prendido (`ACTIVE`) o en modo histórico (`READONLY_ARCHIVE`, donde se permiten lecturas `GET/HEAD` y se bloquean escrituras `POST/PUT/PATCH/DELETE`).
3. **Rate Limiting por Tier (`TenantTierRateLimiter`):** Controla ráfagas con cota LRU según el plan del inquilino (`sandbox_ephemeral`, `basic`, `business`, `enterprise`).
4. **Enrutamiento hacia los Microservicios Independientes (`UpstreamRouteRegistry`):**
   - Enruta cada petición `/api/v1/ms:<microservicio>/mod:<modulo>/*` al servidor donde se encuentra desplegado ese Microservicio (`UPSTREAM_MS_<DOMINIO>` / `UPSTREAM_SRV_<DOMINIO>`).
