# `@proveko/core-service` — Servicio Central del Plano de Control

## Propósito
El **`core-service`** es el cerebro del Plano de Control de **Proveko**. Administra la autenticación Zero-Trust (`Ed25519` + `Argon2id` con semáforo Bulkhead), el catálogo maestro de inquilinos y celdas (`Database-per-Tenant`), el motor del grafo de capacidades (`srv:*` y `ms:*`) y el **Pool de Sandboxes Pre-Calentados (< 30 ms)** para conversión de tráfico de pauta publicitaria.

## Responsabilidades Principales
1. **Motor del Grafo de Capacidades (`CapabilityGraphEngine`):**
   - Evalúa activación (`canActivate`): verifica el Servicio Padre Gatekeeper (`parentService`), prerrequisitos (`requiresServices`, `requiresMicroservices`), conflictos de exclusión mutua (`mutex_group`) y reemplazos automáticos (`supersedes` -> `READONLY_ARCHIVE`).
   - Evalúa desactivación (`canDeactivate`): verifica dependencias inversas (`reverse_requires`) e implementa el corte en cascada cuando se apaga un Servicio Padre.
2. **Saga de Aprovisionamiento en 3 Fases:**
   - Reserva serializada (`PROVISIONING`) -> Ejecución DDL/Migraciones por `admin_port` con `pg_advisory_lock` -> Conmutación atómica a `ACTIVE` + incremento monotónico de `sub_ver` en Redis mediante Script Lua.
3. **Bóveda Criptográfica por Sobre (`EnvelopeCryptoVault`):**
   - Cifra las credenciales de base de datos de cada inquilino con una `DEK` única (`AES-256-GCM` + `AAD`) envuelta por la `KEK` activa.
4. **Motor de Conversión para Pauta (`Warm Demo Sandbox Pool`):**
   - Entrega entornos de demostración pre-migrados en `< 30 ms` según los 4 Presets Comerciales (`Bar/Restaurante`, `Comercio/Retail DIAN`, `Hotel/Alojamiento`, `Distribuidora/Farmacia FEFO`) y permite reclamarlos como cuenta definitiva sin perder datos.
