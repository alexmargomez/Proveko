# Servicio Padre: Gastronomía, Bares y Restaurantes (`srv:gastro`)

- **Identificador del Servicio Padre (Gatekeeper):** `srv:gastro`
- **Esquema PostgreSQL por Inquilino:** `srv_gastro` (`pgSchema('srv_gastro')`)
- **Variable de Entorno en API Gateway:** `UPSTREAM_SRV_GASTRO`

## Regla de Compuerta (Service Gatekeeper)
Habilitar únicamente `srv:gastro` sin microservicios hijos no expone pantallas, pero es obligatorio para habilitar cualquiera de sus 3 microservicios especializados en restaurantes, bares y cafés.

## Microservicios Hijos del Grupo
1. [`ms:gastro-tables`](./ms-gastro-tables/README.md) — Mapa de Salones, Mesas y Ocupación (Prefijo: `tbl_`)
2. [`ms:gastro-kds`](./ms-gastro-kds/README.md) — Comandas de Cocina y Barra KDS (Prefijo: `kds_`)
3. [`ms:gastro-split-check`](./ms-gastro-split-check/README.md) — División de Cuentas por Silla/Ítem y Propinas (Prefijo: `spl_`)
