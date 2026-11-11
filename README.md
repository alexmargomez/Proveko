# Proveko — Plataforma Empresarial de Microservicios Autónomos

Plataforma empresarial multi-industria diseñada bajo **Arquitectura Hexagonal (Ports & Adapters)**, **Bounded Contexts DDD**, **topología Hub-and-Spoke gobernada por Gateway (`GATEWAY_URL`)**, **seguridad Zero-Trust S2S (`Ed25519` + `X-S2S-Hop-Nonce`)** y **aislamiento físico de una base de datos PostgreSQL dedicada por empresa (`db_<cliente>`)**.

---

## 1. Arquitectura Share-Nothing y Topología Hub-and-Spoke

1. **`core/` (`module ms-core`, Puerto `4000`) — Gateway Central y Plano de Control:**
   - Autenticación corporativa con `Argon2id`, aprovisionamiento aislado de bases de datos por empresa (`CREATE DATABASE`), gestión de licenciamiento jerárquico de 4 niveles y enrutamiento centralizado tanto Norte-Sur (`/api/v1/{servicio}/*`) como Este-Oeste S2S (`/api/v1/s2s/{servicioDestino}/*`) firmando pasaportes `Ed25519` de un solo uso (`jti`) y audiencia estricta (`aud`).
   - Registro dinámico de microservicios (`POST /api/v1/gateway/register`) y entrega de llave pública de verificación (`GET /api/v1/gateway/public-key`).
2. **`services/ms-platform/` (`module ms-platform`, Puerto `4100`) — Estándares y UI-SDK Remoto:**
   - Sirve en tiempo de ejecución vía Gateway el UI-SDK corporativo en ESM (`/api/v1/platform/ui-sdk.js`), los shims singleton de React (`/api/v1/platform/react-shim.js`, `/api/v1/platform/jsx-runtime-shim.js`), la hoja de estilos institucional (`/api/v1/platform/theme.css`), las declaraciones TypeScript descargables (`/api/v1/platform/ui-sdk.d.ts`) y el catálogo formal de contratos S2S (`/api/v1/platform/contracts`).
3. **`services/ms-*/` (`module ms-<slug>`, Puertos `4101..4115`) — 15 Microservicios 100% Independientes:**
   - Cada microservicio compila y despliega de forma completamente autónoma (`GOWORK=off go build ./cmd/main.go`, `docker build .`) sin directivas `replace` ni referencias a carpetas externas (`../../`).
   - En su `.env`, cada microservicio únicamente requiere `GATEWAY_URL` (más `SERVICE_PUBLIC_URL`, `S2S_SHARED_KEY`, `PORT` y sus credenciales `DB_*`). Toda comunicación entre microservicios viaja exclusivamente a través del Gateway (`/api/v1/s2s/{target}/*`).

---

## 2. Catálogo de Microservicios Autónomos

| Servicio | Módulo Go | Esquema SQL | Puerto HTTP | Responsabilidad de Dominio |
| :--- | :--- | :--- | :---: | :--- |
| `ms-core` | `ms-core` | `public` | `4000` | Gateway central S2S/Norte-Sur, identidad `Argon2id`, licencias y aprovisionamiento multi-DB. |
| `ms-platform` | `ms-platform` | — | `4100` | Distribución en red de `@platform/ui-sdk` (ESM), estilos corporativos y contratos S2S. |
| `ms-facturacion` | `ms-facturacion` | `invoicing` | `4101` | Punto de venta, cotizaciones, numeración electrónica CUFE y orquestación Saga vía Gateway. |
| `ms-clientes` | `ms-clientes` | `customers` | `4102` | Terceros, convenios comerciales, tarifarios, cupos de crédito y cartera CxC. |
| `ms-inventario` | `ms-inventario` | `inventory` | `4103` | Bodegas, existencias, costo promedio ponderado (WAC), traslados y Kardex. |
| `ms-caja` | `ms-caja` | `treasury` | `4104` | Arqueo diario de efectivo, ingresos, egresos y conciliación bancaria. |
| `ms-comandas` | `ms-comandas` | `gastro` | `4105` | Mesas, pedidos gastronómicos, monitor de cocina y precuentas. |
| `ms-hoteleria` | `ms-hoteleria` | `hospitality` | `4106` | Habitaciones, tarifas por noche, Check-In, consumos y Check-Out. |
| `ms-taller` | `ms-taller` | `workshop` | `4107` | Vehículos por placa, órdenes de trabajo, kilometraje y comisiones técnicas. |
| `ms-bascula` | `ms-bascula` | `scale` | `4108` | Tractocamiones, conductores, transportadoras, rutas y pesaje Bruto/Tara/Neto. |
| `ms-compras` | `ms-compras` | `procurement` | `4109` | Proveedores, órdenes de compra y entrada automática de mercancía vía Gateway S2S. |
| `ms-agenda` | `ms-agenda` | `scheduling` | `4110` | Recursos profesionales, control anti-solapamiento de citas y reservas. |
| `ms-taquilla` | `ms-taquilla` | `ticketing` | `4111` | Eventos con control de aforo y emisión de boletas térmicas. |
| `ms-nomina` | `ms-nomina` | `payroll` | `4112` | Colaboradores, liquidación salarial por periodo y desprendibles de pago. |
| `ms-contabilidad` | `ms-contabilidad` | `accounting` | `4113` | Catálogo PUC y comprobantes contables de partida doble. |
| `ms-reportes` | `ms-reportes` | `reporting` | `4114` | Indicadores consolidados, cortes ejecutivos y exportación CSV/PDF. |
| `ms-impresiones` | `ms-impresiones` | `printing` | `4115` | Membretes corporativos y estrategias seguras `html/template` (Carta, Media Carta, Tirilla 80mm, Taller). |

---

## 3. Compilación Autónoma, Pruebas y Despliegue

```bash
cp .env.example .env
make build
make test
docker compose up -d --build
```

### Despliegue aislado de un único microservicio en otro servidor

```bash
scp -r services/ms-facturacion servidor-remoto:/opt/ms-facturacion
ssh servidor-remoto "cd /opt/ms-facturacion && docker build -t ms-facturacion . && docker run -d --env-file .env -p 4101:4101 ms-facturacion"
```

### Generación de un nuevo microservicio autónomo

```bash
make scaffold NAME=garantia TITLE="Garantías y Postventa" ICON="🛡️"
```
