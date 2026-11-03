# Servicio Padre: Hotelería y Alojamiento (`srv:hotel`)

- **Identificador del Servicio Padre (Gatekeeper):** `srv:hotel`
- **Esquema PostgreSQL por Inquilino:** `srv_hotel` (`pgSchema('srv_hotel')`)
- **Variable de Entorno en API Gateway:** `UPSTREAM_SRV_HOTEL`

## Regla de Compuerta (Service Gatekeeper)
Habilitar únicamente `srv:hotel` sin microservicios hijos no expone pantallas, pero es obligatorio para habilitar cualquiera de sus 3 microservicios de operación hotelera.

## Microservicios Hijos del Grupo
1. [`ms:hotel-rooms`](./ms-hotel-rooms/README.md) — Habitaciones, Tarifas y Housekeeping (Prefijo: `rom_`)
2. [`ms:hotel-bookings`](./ms-hotel-bookings/README.md) — Reservas y Calendario de Ocupación (Prefijo: `bkg_`)
3. [`ms:hotel-frontdesk`](./ms-hotel-frontdesk/README.md) — Recepción Check-in/Check-out y Folio de Habitación (Prefijo: `fdk_`)
