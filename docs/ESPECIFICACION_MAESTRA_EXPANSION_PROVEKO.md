# Especificación Maestra de Arquitectura y Dominios — Plataforma Proveko

Este documento define el alcance funcional, los contextos delimitados (*Bounded Contexts*), el modelo de licenciamiento jerárquico de 4 niveles y el aislamiento de datos por empresa de **Proveko**.

---

## 1. Principios Arquitectónicos Corporativos

1. **Aislamiento Físico por Empresa (`Database-per-Tenant`):** Cada organización aprovisionada recibe su propia base de datos relacional PostgreSQL dedicada (`db_<slug>_<id>`), con credenciales selladas mediante cifrado envolvente `AES-256-GCM`.
2. **Independencia Estricta por Componente:** Ningún paquete transversal (`pkg/`, `ui-sdk/`, `core/`) contiene entidades, reglas o formularios de dominios verticales. Cada microservicio encapsula sus tablas SQL, lógica de dominio, adaptadores de persistencia y su propio Micro-Frontend (`ui.js`).
3. **Arquitectura Hexagonal Real (`Ports & Adapters`):**
   - `internal/domain`: Entidades, constructores con validación de invariantes financieras y puertos de repositorio libres de dependencias de transporte o base de datos.
   - `internal/application`: Casos de uso, control de idempotencia, políticas de licenciamiento y compensaciones Saga.
   - `internal/infrastructure`: Adaptadores PostgreSQL parametrizados (`$1, $2`), adaptadores equivalentes en memoria (*Liskov Substitution*), clientes/servidores `gRPC` y enrutadores HTTP.
4. **Seguridad Zero-Trust entre Servicios (`Ed25519` + Anti-Replay):** `core` conserva de manera exclusiva la llave privada `Ed25519` y emite pasaportes efímeros vinculados a la audiencia exacta del microservicio destino (`aud`) con identificador criptográfico único (`jti`). Los microservicios periféricos solo cargan la llave pública de verificación.

---

## 2. Catálogo Oficial de los 15 Microservicios (`ms-*`)

| # | Clave Servicio | Nombre Corporativo | Esquema SQL | Módulos Incluidos |
| :---: | :--- | :--- | :--- | :--- |
| 1 | `ms-facturacion` | **Facturación y Punto de Venta** | `invoicing` | `pos_mostrador`, `cotizaciones`, `facturas_taller`, `facturacion_dian` |
| 2 | `ms-clientes` | **Clientes y Terceros** | `customers` | `directorio_clientes`, `cartera_cxc`, `contratos_convenios` |
| 3 | `ms-inventario` | **Inventario y Bodegas** | `inventory` | `productos_stock`, `bodegas_traslados`, `kardex_lotes`, `solicitudes_insumos` |
| 4 | `ms-caja` | **Caja y Tesorería** | `treasury` | `arqueo_gastos`, `bancos_tesoreria` |
| 5 | `ms-comandas` | **Mesas y Comandas** | `gastro` | `mapa_mesas`, `monitor_cocina` |
| 6 | `ms-hoteleria` | **Hotelería y Alojamiento** | `hospitality` | `recepcion_habitaciones`, `tarifas_temporadas` |
| 7 | `ms-taller` | **Taller y Órdenes de Servicio** | `workshop` | `tablero_ordenes`, `hoja_vida_vehiculos`, `comisiones_tecnicos` |
| 8 | `ms-bascula` | **Báscula y Transporte de Carga** | `scale` | `pesaje_camionero`, `flota_conductores`, `rutas_manifiestos` |
| 9 | `ms-compras` | **Compras y Proveedores** | `procurement` | `directorio_proveedores`, `ordenes_compra` |
| 10 | `ms-agenda` | **Agenda y Reservas** | `scheduling` | `calendario_citas` |
| 11 | `ms-taquilla` | **Taquilla y Entradas** | `ticketing` | `venta_boletas` |
| 12 | `ms-nomina` | **Personal y Nómina** | `payroll` | `liquidacion_nomina` |
| 13 | `ms-contabilidad` | **Contabilidad PUC** | `accounting` | `comprobantes_puc` |
| 14 | `ms-reportes` | **Reportes y Exportación** | `reporting` | `centro_reportes` |
| 15 | `ms-impresiones` | **Impresiones y Membretes** | `printing` | `config_membretes` |

---

## 3. Perfiles Sectoriales de Suscripción

1. **Suite Empresarial Completa (`full`):** Habilita la totalidad de áreas comerciales, logísticas, financieras y operativas.
2. **Comercio y Punto de Venta (`comercio`):** Facturación, Clientes, Inventario, Caja, Compras, Reportes e Impresiones.
3. **Centro Automotriz y Repuestos (`automotriz`):** Taller, Facturación con módulo `facturas_taller`, Clientes, Inventario, Caja, Compras, Reportes e Impresiones.
4. **Restaurante y Gastronomía (`restaurante`):** Mesas y Comandas, Facturación, Inventario, Caja, Compras, Reportes e Impresiones.
5. **Hotelería y Alojamiento (`hotel`):** Hotelería, Comandas, Agenda, Clientes, Facturación, Caja, Reportes e Impresiones.
6. **Logística Pesada y Acopio (`logistica`):** Báscula Camionera, Clientes, Inventario, Facturación, Caja, Reportes e Impresiones.
