# Microservicio: Recepción y Folio de Habitación (`ms:hotel-frontdesk`)

- **Clave del Microservicio:** `ms:hotel-frontdesk`
- **Servicio Padre (Gatekeeper):** `srv:hotel`
- **Esquema PostgreSQL:** `srv_hotel`
- **Prefijo de Tablas:** `fdk_` (`srv_hotel.fdk_room_folios`)
- **Prerrequisitos (`requires`):** `["srv:hotel", "ms:hotel-rooms", "ms:invoicing-pos", "ms:crm-directory"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_HOTEL_FRONTDESK`

## ¿De qué trata este microservicio?
Controla la recepción operativa del hotel (*Front Desk*): registro de entrada (*Check-in*), salida (*Check-out*) y acumulación de cargos al **Folio de Habitación** (noches de alojamiento, minibar, restaurante y consumos POS) para su facturación consolidada al momento del Check-out.
