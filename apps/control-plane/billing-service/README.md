# `@proveko/billing-service` — Cotizador Modular, Planes y Suscripciones SaaS

## Propósito
El **`billing-service`** gestiona el modelo comercial modular de **Proveko**: cotiza combinaciones personalizadas de Servicios Padres (`srv:*`) y Microservicios Hijos (`ms:*`), aplica descuentos automáticos por Preset Comercial y procesa webhooks de pasarelas de pago (`Wompi`, `Stripe`, `MercadoPago`) para activar capacidades en tiempo real.

## Responsabilidades Principales
1. **Cotizador Modular (`ModularSubscriptionQuoteEngine`):**
   - Calcula subtotales, descuentos de paquete (15%–20% en Presets Comerciales) e impuestos con `MoneyDecimal` (`decimal.js`, `NUMERIC(19, 4)`).
   - Garantiza que ningún cliente pague por un microservicio huérfano sin su Servicio Padre Gatekeeper ni pague doble por dos microservicios del mismo `mutex_group` (ej. Recibo Simple + Facturación DIAN).
2. **Procesador de Webhooks Firmados (`BillingSubscriptionService`):**
   - Verifica firmas `HMAC-SHA256` en tiempo constante (`crypto.timingSafeEqual`).
   - Garantiza idempotencia estricta por `webhookEventId` en `billing_webhook_inbox`.
   - Invoca a `core-service` tras confirmar el pago para aprovisionar los esquemas y actualizar `sub_ver` en caliente.
