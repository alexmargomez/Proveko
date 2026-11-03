# Microservicio: Recetas, Escandallos y BOM (`ms:inventory-recipes`)

- **Clave del Microservicio:** `ms:inventory-recipes`
- **Servicio Padre (Gatekeeper):** `srv:inventory`
- **Esquema PostgreSQL:** `srv_inventory`
- **Prefijo de Tablas:** `rec_` (`srv_inventory.rec_headers`, `srv_inventory.rec_bom_ingredients`)
- **Prerrequisitos (`requires`):** `["srv:inventory", "ms:inventory-stock"]`
- **Grupo de Exclusión (`mutex_group`):** `null`
- **Override de Servidor Dedicado:** `UPSTREAM_MS_INVENTORY_RECIPES`

## ¿De qué trata este microservicio?
Diseñado para bares, restaurantes, cafeterías y producción ligera. Permite definir la fórmula o escandallo (*Bill of Materials — BOM*) de cada plato, cóctel o producto compuesto para descontar automáticamente gramos, mililitros o unidades de insumos al vender el producto terminado y calcular el costo real de la receta.

## Endpoints Principales
- `GET /api/v1/srv:inventory/ms:inventory-recipes/recipes`: Lista las recetas configuradas.
- `POST /api/v1/srv:inventory/ms:inventory-recipes/recipes/explode-cost`: Calcula la explosión de insumos y el costo total de producción para una cantidad vendida.
