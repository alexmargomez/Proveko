# Módulo Interno (Prender / Apagar): Reservas y Calendario de Ocupación (`mod:hotel-bookings`)

- **Clave del Módulo (On/Off):** `mod:hotel-bookings` (alias `ms:hotel-bookings`)
- **Pertenece al Microservicio Independiente:** `ms:hotel` (`srv:hotel`)
- **Esquema PostgreSQL:** `srv_hotel`
- **Prefijo de Tablas:** `bkg_` (`srv_hotel.bkg_reservations`)
- **Prerrequisitos (`requires`):** `["ms:hotel", "mod:hotel-rooms", "mod:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:hotel` que se prende o apaga según la suscripción del cliente. Gestiona el motor de reservas hoteleras por rango de fechas (`checkInDate` -> `checkOutDate`), vinculando al huésped desde `mod:crm-directory` con la habitación de `mod:hotel-rooms` y liquidando el total estimado por noches con `MoneyDecimal`.
