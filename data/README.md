# Dataset sintético de FarmaSeñal

La API consume únicamente estos tres archivos CSV de esta carpeta. Los archivos `.md` que acompañan al dataset son documentación y no se cargan.

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

Una fila por producto. Para el análisis se usan `id_producto`, `nombre` y `categoria`. Precio y caducidad no participan en la señal de ventas de esta versión.

### `ventas.csv`

```text
id_venta,fecha,id_farmacia,id_producto,cantidad,total_venta
```

Una fila por venta. La API usa fecha, farmacia, producto y cantidad; `total_venta` no participa en el cálculo.

## Formato y validación

- Archivos UTF-8, con o sin BOM, delimitados por coma.
- Los números decimales pueden usar punto o coma decimal, como en los CSV actuales (`-0,091653`). Si se usa coma decimal, el campo debe ir entre comillas. No uses separadores de miles.
- Las fechas deben usar `AAAA-MM-DD`.
- Las llaves `id_farmacia` e `id_producto` de ventas deben existir en sus CSV de referencia; `id_venta` debe ser único si está presente.
- Los CSV deben contener datos sintéticos. No se leen archivos por comodín: cambiar nombres requiere configurar `PHARMACIES_CSV`, `PRODUCTS_CSV` o `SALES_CSV`.

## Límites de interpretación

El dataset no contiene existencias, compras a proveedores ni diagnósticos. Por eso el backend no presenta stock ni simula reabastecimientos. Compara ventas agregadas por sector y categoría para mostrar aumentos preliminares; un aumento de ventas no identifica la causa ni confirma una enfermedad. Los nombres con problemas de codificación deben corregirse en el CSV fuente.
