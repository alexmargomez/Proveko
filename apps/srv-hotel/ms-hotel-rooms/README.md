# Módulo Interno (Prender / Apagar): Habitaciones, Tarifas y Housekeeping (`mod:hotel-rooms`)

- **Clave del Módulo (On/Off):** `mod:hotel-rooms` (alias `ms:hotel-rooms`)
- **Pertenece al Microservicio Independiente:** `ms:hotel` (`srv:hotel`)
- **Esquema PostgreSQL:** `srv_hotel`
- **Prefijo de Tablas:** `rom_` (`srv_hotel.rom_rooms`)
- **Prerrequisitos (`requires`):** `["ms:hotel"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:hotel` que se prende o apaga según la suscripción del cliente. Administra el inventario físico de habitaciones, cabañas o suites por categoría (`STANDARD`, `SUITE`, `DELUXE`), sus tarifas por noche (`NUMERIC(19, 4)`) y su estado de camarería/aseo (`CLEAN`, `DIRTY`, `INSPECTED`). Es prerrequisito base para `mod:hotel-bookings` y `mod:hotel-frontdesk`.
