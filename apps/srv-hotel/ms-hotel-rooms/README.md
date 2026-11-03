# Microservicio: Habitaciones, Tarifas y Housekeeping (`ms:hotel-rooms`)

- **Clave del Microservicio:** `ms:hotel-rooms`
- **Servicio Padre (Gatekeeper):** `srv:hotel`
- **Esquema PostgreSQL:** `srv_hotel`
- **Prefijo de Tablas:** `rom_` (`srv_hotel.rom_rooms`)
- **Prerrequisitos (`requires`):** `["srv:hotel"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_HOTEL_ROOMS`

## ¿De qué trata este microservicio?
Administra el inventario físico de habitaciones, cabañas o suites por categoría (`STANDARD`, `SUITE`, `DELUXE`), sus tarifas por noche (`NUMERIC(19, 4)`) y su estado de camarería/aseo (`CLEAN`, `DIRTY`, `INSPECTED`). Es prerrequisito base para `ms:hotel-bookings` y `ms:hotel-frontdesk`.
