# Dataset sintético de FarmaSeñal

La API consume únicamente estos cuatro archivos CSV de esta carpeta. Los archivos `.md` que acompañan al dataset son documentación y no se cargan.

## Archivos y columnas

### `farmacias.csv`

```text
id_farmacia,nombre,ubicacion_sector,lat,lng,ventas_mes_promedio
```

Una fila por farmacia. `ventas_mes_promedio` es un valor agregado de referencia; no representa existencias y no se usa para calcular las alertas. Las coordenadas pueden ser negativas.

### `productos.csv`

```text
id_producto,nombre,categoria,precio_unitario,fecha_caducidad
```

Una fila por producto. Para el análisis se usan `id_producto`, `nombre` y `categoria`. Precio y la caducidad a nivel de producto no participan en la señal de ventas ni en la selección de orígenes; la caducidad de inventario se toma de `inventario.csv`.

### `ventas.csv`

```text
id_venta,fecha,id_farmacia,id_producto,cantidad,total_venta
```

Una fila por venta. La API usa fecha, farmacia, producto y cantidad; `total_venta` no participa en el cálculo.

### `inventario.csv`

```text
id_inventario,id_farmacia,nombre_farmacia,sector,id_producto,nombre_producto,categoria,stock_actual,stock_minimo,dias_cobertura,estado_stock,lote,fecha_caducidad
```

Una fila por producto en una farmacia. El backend valida que `id_farmacia` e `id_producto` existan en sus catálogos y que no haya más de una fila por par. Usa stock actual, mínimo, días de cobertura y estado para el mapa y las alertas de inventario. Al generar recomendaciones, también evalúa la caducidad: un excedente solo es origen elegible si la fecha está informada y es posterior a la fecha de referencia (última venta del dataset). Si la fecha falta, el registro no puede ser origen; si el formato de fecha es inválido, la API marca el dataset como inválido. Un registro vencido no se propone como traslado. Lote se conserva en el CSV y no participa en estos cálculos.

## Formato y validación

- Archivos UTF-8, con o sin BOM, delimitados por coma.
- Los números decimales pueden usar punto o coma decimal, como en los CSV actuales (`-0,091653`). Si se usa coma decimal, el campo debe ir entre comillas. No uses separadores de miles.
- Las fechas deben usar `AAAA-MM-DD`.
- Las llaves `id_farmacia` e `id_producto` de ventas deben existir en sus CSV de referencia; `id_venta` debe ser único si está presente.
- Las mismas llaves de inventario deben existir en los catálogos; los valores de stock/cobertura no pueden ser negativos y el estado debe ser `Agotado`, `Bajo`, `Crítico`, `Normal` o `Excedente`.
- Los CSV deben contener datos sintéticos. No se leen archivos por comodín: cambiar nombres requiere configurar `PHARMACIES_CSV`, `PRODUCTS_CSV`, `SALES_CSV` o `INVENTORY_CSV`.

## Límites de interpretación

El inventario es sintético y representa una foto del stock, no un registro de compras a proveedores. La vista de recomendaciones propone traslados entre sucursales con reglas deterministas, cantidades limitadas al faltante y al excedente seguro, y distancia aproximada en línea recta; no reserva unidades, crea órdenes ni modifica el inventario. Las decisiones son locales al navegador. El análisis de ventas compara ventas agregadas por sector, categoría y producto para mostrar aumentos preliminares; las ventas no identifican la causa ni confirman una enfermedad. Los nombres con problemas de codificación deben corregirse en el CSV fuente.
