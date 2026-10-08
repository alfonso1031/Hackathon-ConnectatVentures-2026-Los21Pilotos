# Plan de implementación del backend — FarmaSeñal

**Estado:** API local implementada para el frontend actual. Los CSV son sintéticos. La asignación oficial del reto y los permisos AWS deben confirmarse antes de desplegar.

## Objetivo del MVP

Entregar al dashboard un mapa de farmacias y señales explicables cuando las ventas de una categoría aumenten en un sector. El sistema reporta patrones de venta agregados; no diagnostica enfermedades ni atribuye una causa al aumento.

## Datos disponibles

La fuente del entorno actual es la carpeta `data/`. Se cargan por nombre explícito estos archivos:

| Archivo | Campos usados | Relación |
| --- | --- | --- |
| `farmacias.csv` | `id_farmacia,nombre,ubicacion_sector,lat,lng` | Identifica farmacia, sector y coordenadas. |
| `productos.csv` | `id_producto,nombre,categoria` | Catálogo y agrupación por categoría. |
| `ventas.csv` | `id_venta,fecha,id_farmacia,id_producto,cantidad` | Historial de ventas para comparar ventanas. |

El backend ignora `ventas_mes_promedio`, `precio_unitario`, `fecha_caducidad` y `total_venta` para esta señal. Los archivos `.md` del dataset no se procesan. Se aceptan encabezados españoles/ingleses conocidos, UTF-8 con BOM y números decimales con punto o coma decimal; una coma decimal debe estar entre comillas por el separador CSV.

No existe un archivo de inventario ni de compras a proveedores. La API y la interfaz no deben mostrar stock disponible, cobertura o una acción de reabastecimiento como si esos valores fueran reales. Si el MVP vuelve a incluir logística, se debe generar o recibir un inventario sintético explícito y etiquetarlo como tal.

## Modelo de señal de demanda

Por cada combinación sector/categoría, calcula:

1. Unidades y transacciones de los 30 días que terminan en la fecha de venta más reciente.
2. Unidades y transacciones de los 90 días calendario inmediatamente anteriores.
3. Tasa diaria observada = unidades recientes / 30; tasa de referencia = unidades base / 90.
4. Señal si la tasa observada es al menos 1,5 veces la referencia, hay al menos 2 transacciones recientes y 3 en la referencia.
5. Severidad alta desde 2 veces la referencia; entre 1,5 y 2 veces se marca como alza observada.

Es una regla de detección de anomalías temporales con umbrales transparentes, no un modelo entrenado. Muestra periodos, cantidades y porcentaje de cambio. Una muestra pequeña produce pocas señales; no se debe bajar el mínimo de datos para forzar alertas.

## Contrato HTTP

| Método y ruta | Respuesta |
| --- | --- |
| `GET /health` | Estado del servicio. |
| `GET /api/v1/dashboard` | Farmacias georreferenciadas, señales, categorías, periodos de comparación y KPIs. |
| `GET /api/v1/dashboard?category=<nombre>` | La misma respuesta filtrada por una categoría existente. |

Los errores usan JSON con `error.code` y `error.message`: `503 DATA_NOT_READY` si faltan archivos, `422 DATA_INVALID` para estructura/valores inválidos y `404 CATEGORY_NOT_FOUND` si el filtro no existe.

## Implementación

### Completado

- Carga y validación de los tres CSV; comprobación de IDs, fechas, cantidades y coordenadas.
- Cálculo de anomalías por sector/categoría y estado agregado para los marcadores del mapa.
- Handler `app.lambda_handler` compatible con API Gateway HTTP API v2.
- Servidor de desarrollo local y proxy `/api` en Vite.
- Frontend conectado al dashboard, con filtro por categoría, mapa, alertas, KPIs, estados de error y actualización.
- Aviso visible de que la señal no constituye diagnóstico médico.

### Ejecución local

Desde la raíz:

```powershell
python backend/local_server.py
```

En otra terminal:

```powershell
cd frontend
npm run dev
```

## Despliegue AWS opcional

Para una demo pequeña y estática, incluir `app.py` y los tres CSV sintéticos en el paquete Lambda es suficiente. API Gateway HTTP API publica las rutas del contrato; CloudWatch conserva logs operativos. S3 privado es opcional si los CSV deben actualizarse sin redesplegar. La UI usa Leaflet/CARTO, por lo que no requiere un servicio de mapas para los marcadores. Amazon Location Routes y OpenWeather no forman parte del MVP actual.

## Próxima fase si se incorpora inventario

- Agregar un CSV explícito de existencias por farmacia/producto, con fecha de corte y unidades disponibles.
- Calcular cobertura con la tasa de ventas y, solo entonces, evaluar alertas de quiebre.
- Simular traslados en memoria con límites de reserva; distinguir distancia geográfica de ruta vial.
- Añadir datos de compras a proveedor únicamente si el caso de uso los requiere.

Para una hipótesis de salud pública harían falta datos validados y autorizados de vigilancia epidemiológica, junto con revisión experta. Las ventas por sí solas no permiten identificar una enfermedad.
