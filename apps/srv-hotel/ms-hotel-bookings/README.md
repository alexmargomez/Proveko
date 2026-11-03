# Microservicio: Reservas y Calendario de Ocupación (`ms:hotel-bookings`)

- **Clave del Microservicio:** `ms:hotel-bookings`
- **Servicio Padre (Gatekeeper):** `srv:hotel`
- **Esquema PostgreSQL:** `srv_hotel`
- **Prefijo de Tablas:** `bkg_` (`srv_hotel.bkg_reservations`)
- **Prerrequisitos (`requires`):** `["srv:hotel", "ms:hotel-rooms", "ms:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_HOTEL_BOOKINGS`

## ¿De qué trata este microservicio?
Gestiona el motor de reservas hoteleras por rango de fechas (`checkInDate` -> `checkOutDate`), vinculando al huésped desde `ms:crm-directory` con la habitación de `ms:hotel-rooms` y liquidando el total estimado por noches con `MoneyDecimal`.
