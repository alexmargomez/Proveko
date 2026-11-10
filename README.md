# Proveko — Plataforma Empresarial Modular (Go `chi` + `gRPC` + React TypeScript)

Plataforma SaaS empresarial multi-industria construida con **Go 1.22+ (`go-chi/chi/v5` + `gRPC` + `pgxpool`)** y **React 18 + TypeScript (`.tsx`) + Vite**, empaquetada en un único binario nativo con `//go:embed` (**cero Node.js en producción**) y aislamiento estricto de **1 Base de Datos PostgreSQL física por cliente (`db_<cliente>`)**.

---

## 1. Jerarquía Arquitectónica de 4 Niveles

1. **Nivel 1 — `core/` (Servicio Central y Shell Principal):**
   - Autenticación JWT, aprovisionamiento automático de `CREATE DATABASE db_<cliente>`, catálogo maestro de licencias, `chi` API Gateway (`/api/v1/*`) y Shell visual principal (`core/frontend-shell/`).
2. **Nivel 2 — `services/ms-*/` (15 Microservicios Independientes de Primer Nivel):**
   - Todos son pares de primer nivel (no existen microservicios "hijos" ni "terciarios"). Cualquier microservicio puede invocarse desde `core` o desde otro microservicio mediante `gRPC` (por ejemplo, `ms-impresiones` es invocado por todos los demás para renderizar membretes PDF Carta y Tirilla 80mm).
   - Cada carpeta `services/ms-<nombre>/` es **100% autocontenida**: contiene su propio `manifest.json`, `migrations/001_schema.sql`, `backend/` (Go `chi` + `gRPC`) y `frontend/` (React `.tsx`).
3. **Nivel 3 — `Módulos` (Componentes internos dentro de un Microservicio):**
   - Viven dentro del código del microservicio (`backend/modules/*` y `frontend/modules/*`) y se encienden o apagan por cliente (ej. `facturas_taller` o `facturacion_dian` dentro de `ms-facturacion`).
4. **Nivel 4 — `Funcionalidades` (Switches granulares):**
   - Pueden ser **independientes** dentro del microservicio (ej. `descuento_linea`, `pagos_mixtos_cxc`) o **dependientes de un Módulo** (`dependsOnModule: "facturas_taller"` → `asignar_mecanico` y `factura_taller_pdf`). Si el módulo está inactivo, sus funcionalidades dependientes se bloquean automáticamente en UI y Backend.

---

## 2. Guía de Desarrollo

### A. Estructura de cada microservicio
Cada microservicio vive en un solo lugar predecible:
- **Backend Go (`chi` + `gRPC`):** `services/ms-<nombre>/backend/service.go`
- **Frontend React + TypeScript:** `services/ms-<nombre>/frontend/<Nombre>View.tsx`
- **SQL de Base de Datos del Cliente:** `services/ms-<nombre>/migrations/001_schema.sql`

Componentes estándar listos para usar desde `@proveko/ui-sdk`:
- `<PkAutoCodeInput label="N° Documento" value={nextCode} />` — Consecutivo automático readonly.
- `<PkEntitySelect items={...} value={...} onChange={...} onCreateNew={() => openQuickDialog('nuevo-cliente', reload)} />` — Selector relacional con diálogo `+ Nuevo`.
- `<PkPrintButton payload={...} />` — Impresión universal conectada a `ms-impresiones`.
- `<ModuleGate module="facturas_taller">...</ModuleGate>` — Muestra u oculta un módulo según licencia.
- `<FeatureGate module="facturas_taller" feature="asignar_mecanico">...</FeatureGate>` — Muestra u oculta una funcionalidad granular.

### B. Crear un nuevo Microservicio con 1 comando
```bash
make scaffold NAME=garantia TITLE="Garantías y Postventa" ICON="🛡️"
```
Luego regístralo en:
1. `core/backend/licensing/catalog.go`
2. `cmd/cluster-runner/main.go`
3. `core/frontend-shell/src/App.tsx`

---

## 3. Compilación, Pruebas y Despliegue en ALpanel

```bash
# Compilar Frontend React (.tsx) + Binario Go autocontenido
make build

# Ejecutar pruebas automatizadas (Licencias 4 niveles, gRPC y aislamiento multi-BD)
make test

# Despliegue en ALpanel (Docker Compose sin Node.js en el contenedor final)
docker compose up -d --build
```
