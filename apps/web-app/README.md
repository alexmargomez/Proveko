# `@proveko/web-app` — Portada Comercial y Estación de Trabajo Profesional

## Propósito
Aplicación Frontend de **Proveko** dividida en dos capas:
1. **Capa 1 — Portada Comercial Pública (`/`):** Diseñada para tráfico de pauta publicitaria con configurador interactivo de Servicios/Microservicios y botón de **Demo Instantánea en 1 Clic** (< 30 ms).
2. **Capa 2 — Estación de Trabajo Corporativa (`/app/*`):** Interfaz de alta densidad operativa (fondo claro `#F8FAFC` / `#FFFFFF`, sidebar azul marino `#0F172A`, cifras contables `tabular-nums`).

## Componentes Clave
- **`ProvekoWorkstationHttpClient` (`Single-Flight Silent Refresh`):** Intercepta respuestas `401 ERR_SUB_VER_STALE` cuando la empresa activa un módulo en caliente, deduplica el refresco del token en una sola llamada de red y reconcilia el carrito POS (`PosCartCapabilityReconciler`) sin perder ni un solo ítem.
- **`evaluateWorkstationCapabilityGate` (`<CapabilityGate>` y `<ReadonlyArchiveBanner>`):** Evalúa si un módulo debe renderizarse en modo interactivo completo, en modo contenedor vacío del Servicio Padre, en modo archivo histórico de solo lectura (`READONLY_ARCHIVE`) o con vista previa de activación.
