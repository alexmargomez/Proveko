# Módulo Interno (Prender / Apagar): Recepción y Folio de Habitación (`mod:hotel-frontdesk`)

- **Clave del Módulo (On/Off):** `mod:hotel-frontdesk` (alias `ms:hotel-frontdesk`)
- **Pertenece al Microservicio Independiente:** `ms:hotel` (`srv:hotel`)
- **Esquema PostgreSQL:** `srv_hotel`
- **Prefijo de Tablas:** `fdk_` (`srv_hotel.fdk_room_folios`)
- **Prerrequisitos (`requires`):** `["ms:hotel", "mod:hotel-rooms", "mod:invoicing-pos", "mod:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:hotel` que se prende o apaga según la suscripción del cliente. Controla la recepción operativa del hotel (*Front Desk*): registro de entrada (*Check-in*), salida (*Check-out*) y acumulación de cargos al **Folio de Habitación** (noches de alojamiento, minibar, restaurante y consumos POS) para su facturación consolidada al momento del Check-out.
