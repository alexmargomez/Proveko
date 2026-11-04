# Módulo Interno (Prender / Apagar): Recetas, Escandallos y Explosión BOM (`mod:inventory-recipes`)

- **Clave del Módulo (On/Off):** `mod:inventory-recipes` (alias `ms:inventory-recipes`)
- **Pertenece al Microservicio Independiente:** `ms:inventory` (`srv:inventory`)
- **Esquema PostgreSQL:** `srv_inventory`
- **Prefijo de Tablas:** `rec_` (`srv_inventory.rec_recipes`)
- **Prerrequisitos (`requires`):** `["ms:inventory", "mod:inventory-stock"]`
- **Grupo de Exclusión (`mutex_group`):** `null`

## ¿De qué trata este módulo?
Es un módulo interno del Microservicio `ms:inventory` que se prende o apaga según la suscripción del cliente (ideal para bares, restaurantes, cafeterías y producción ligera). Permite definir la fórmula o escandallo (*Bill of Materials — BOM*) de cada plato, cóctel o producto compuesto para descontar automáticamente gramos, mililitros o unidades de insumos al vender el producto terminado y calcular el costo real de la receta.

## Endpoints Principales
- `GET /api/v1/ms:inventory/mod:inventory-recipes/recipes`: Lista las recetas configuradas.
- `POST /api/v1/ms:inventory/mod:inventory-recipes/recipes/explode-cost`: Calcula la explosión de insumos y el costo total de producción para una cantidad vendida.
