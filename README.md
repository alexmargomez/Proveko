# Proveko — Plataforma Empresarial Modular

Plataforma SaaS empresarial multi-industria construida en **Go 1.22+ (`go-chi/chi/v5`, `gRPC`, `pgxpool`)** y **React 18 + TypeScript + Vite**, compilada en un binario autónomo con activos estáticos embebidos (`//go:embed`) y aislamiento de **una base de datos PostgreSQL independiente por cliente (`db_<cliente>`)**.

---

## 1. Arquitectura Modular de 4 Niveles

1. **Nivel 1 — `core/` (Núcleo Central y Shell Web):**
   - Autenticación JWT, aprovisionamiento automático de bases de datos por empresa (`CREATE DATABASE db_<cliente>`), catálogo central de licencias, API Gateway HTTP (`chi`) y aplicación principal en `core/frontend-shell/`.
2. **Nivel 2 — `services/ms-*/` (Microservicios de Primer Nivel):**
   - Servicios independientes y autocontenidos (`ms-facturacion`, `ms-clientes`, `ms-inventario`, `ms-caja`, `ms-comandas`, `ms-hoteleria`, `ms-taller`, `ms-bascula`, `ms-compras`, `ms-agenda`, `ms-taquilla`, `ms-nomina`, `ms-contabilidad`, `ms-reportes`, `ms-impresiones`).
   - Cada servicio contiene su propio `manifest.json`, migraciones SQL (`migrations/001_schema.sql`), capa de negocio en Go (`backend/`) y vistas en React + TypeScript (`frontend/`), comunicándose entre sí mediante contratos tipados `gRPC`.
3. **Nivel 3 — `Módulos` (Componentes internos de cada Microservicio):**
   - Unidades funcionales alojadas dentro del microservicio (`backend/modules/*` y `frontend/modules/*`) que se habilitan o deshabilitan por suscripción empresarial (ej. `facturas_taller` y `facturacion_dian` en `ms-facturacion`).
4. **Nivel 4 — `Funcionalidades` (Capacidades granulares):**
   - Reglas operativas independientes del microservicio (ej. `descuento_linea`, `pagos_mixtos_cxc`) o dependientes de un módulo activo (`dependsOnModule: "facturas_taller"` → `asignar_mecanico`, `factura_taller_pdf`).

---

## 2. Guía de Desarrollo

### Estructura de cada microservicio
- **Backend (`chi` + `gRPC`):** `services/ms-<nombre>/backend/service.go`
- **Frontend (`React` + `TypeScript`):** `services/ms-<nombre>/frontend/<Nombre>View.tsx`
- **Esquema SQL por cliente:** `services/ms-<nombre>/migrations/001_schema.sql`

### Componentes compartidos (`@proveko/ui-sdk`)
- `<PkAutoCodeInput />`: Consecutivo documental automático de solo lectura.
- `<PkEntitySelect />`: Selector relacional tipado con creación rápida en diálogo modal.
- `<PkPrintButton />`: Emisión de documentos imprimibles conectada a `ms-impresiones`.
- `<ModuleGate />` y `<FeatureGate />`: Control declarativo de visibilidad según licencia activa.

### Generación de nuevos microservicios
```bash
make scaffold NAME=garantia TITLE="Garantías y Postventa" ICON="🛡️"
```
Registrar el servicio generado en `core/backend/licensing/catalog.go`, `cmd/cluster-runner/main.go` y `core/frontend-shell/src/App.tsx`.

---

## 3. Compilación, Pruebas y Despliegue

```bash
make build
make test
docker compose up -d --build
```
