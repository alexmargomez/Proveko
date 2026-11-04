# Microservicio Independiente: Hotelería y Alojamiento (`ms:hotel` / `srv:hotel`)

- **Identificador del Microservicio:** `ms:hotel` (alias `srv:hotel`)
- **Esquema PostgreSQL Aislado por Inquilino:** `srv_hotel` (`pgSchema('srv_hotel')`)
- **Variable de Servidor en API Gateway:** `UPSTREAM_MS_HOTEL` (o `UPSTREAM_SRV_HOTEL`)

## Naturaleza del Microservicio y sus Módulos Internos
`ms:hotel` es un **Microservicio Independiente** desplegable en su propio servidor/contenedor. Dentro de él viven sus **Módulos internos (`mod:hotel-*`)**, los cuales se **prenden y apagan dinámicamente por cliente** según las herramientas hoteleras contratadas.

## Módulos Internos (Prender / Apagar)
1. [`mod:hotel-rooms`](./ms-hotel-rooms/README.md) — Habitaciones, Tarifas y Housekeeping (Prefijo: `rom_`)
2. [`mod:hotel-bookings`](./ms-hotel-bookings/README.md) — Reservas y Calendario de Ocupación (Prefijo: `bkg_`)
3. [`mod:hotel-frontdesk`](./ms-hotel-frontdesk/README.md) — Recepción Check-in/Check-out y Folio de Habitación (Prefijo: `fdk_`)
