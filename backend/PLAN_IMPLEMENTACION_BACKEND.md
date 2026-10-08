# Plan de implementación del backend — FarmaSeñal

**Estado:** API local implementada para el dashboard y las recomendaciones operativas. Los CSV son sintéticos. El equipo confirmó que su línea asignada es mejora operativa; esta confirmación del equipo no aparece en las fuentes oficiales revisadas. Los permisos AWS y el modelo de Bedrock aún deben configurarse antes de desplegar.

## Objetivo del MVP

Entregar al dashboard un mapa de farmacias con métricas seleccionables de ventas e inventario, filtros por categoría/producto, señales explicables por sector y recomendaciones operativas de abastecimiento. El sistema reporta patrones de venta agregados; no diagnostica enfermedades ni atribuye una causa al aumento.

## Datos disponibles

La fuente del entorno actual es la carpeta `data/`. Se cargan por nombre explícito estos archivos:

| Archivo | Campos usados | Relación |
| --- | --- | --- |
| `farmacias.csv` | `id_farmacia,nombre,ubicacion_sector,lat,lng` | Identifica farmacia, sector y coordenadas. |
| `productos.csv` | `id_producto,nombre,categoria` | Catálogo y agrupación por categoría. |
| `ventas.csv` | `id_venta,fecha,id_farmacia,id_producto,cantidad` | Historial de ventas para comparar ventanas. |
| `inventario.csv` | `id_inventario,id_farmacia,id_producto,stock_actual,stock_minimo,dias_cobertura,estado_stock,fecha_caducidad` | Existencias sintéticas por farmacia/producto; se une mediante sus IDs. |

El backend ignora `ventas_mes_promedio`, `precio_unitario` y `total_venta` para los cálculos. Los archivos `.md` del dataset no se procesan. Se aceptan encabezados españoles/ingleses conocidos, UTF-8 con BOM y números decimales con punto o coma decimal; una coma decimal debe estar entre comillas por el separador CSV. El inventario se etiqueta como sintético y no simula compras ni reabastecimientos. La ruta de recomendaciones usa `fecha_caducidad` del inventario para admitir como origen solo excedente con fecha conocida y posterior a la fecha de referencia de ventas; caducidad ausente o vencida impide proponer ese origen y un formato de fecha inválido invalida el dataset.

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
| `GET /api/v1/dashboard` | Farmacias georreferenciadas, catálogo, señales, métricas de ventas/inventario y KPIs. |
| `GET /api/v1/dashboard?category=<nombre>` | Filtra ventas e inventario por una categoría existente. |
| `GET /api/v1/dashboard?category=<nombre>&product_id=<id>` | Filtra además por el producto seleccionado. |
| `GET /api/v1/recommendations` | Propuestas deterministas de traslado y vigilancia para el dataset completo. |
| `POST /api/v1/recommendations/analyze` | Resumen en español de las propuestas calculadas; `provider` identifica `bedrock` o `fallback`. No procesa instrucciones del cuerpo. |

Los errores usan JSON con `error.code` y `error.message`: `503 DATA_NOT_READY` si faltan archivos, `422 DATA_INVALID` para estructura/valores inválidos, `404 CATEGORY_NOT_FOUND` si la categoría no existe y `404 PRODUCT_NOT_FOUND` si el producto no existe o no pertenece a la categoría seleccionada.

## Implementación

### Completado

- Carga y validación de los cuatro CSV; comprobación de IDs, pares farmacia/producto, fechas, cantidades y coordenadas.
- Cálculo de anomalías por sector/categoría y estado agregado para los marcadores del mapa.
- Filtros de categoría/producto para análisis de ventas e inventario, con catálogo completo en la respuesta.
- Resúmenes de stock/riesgo/cobertura por farmacia y sector, además de alertas prioritarias.
- Handler `app.lambda_handler` compatible con API Gateway HTTP API v2.
- Servidor de desarrollo local y proxy `/api` en Vite.
- Frontend conectado al dashboard, con color seleccionable, filtro por categoría/producto, opacidad, mapa Canvas y actualización manual.
- Avisos visibles sobre los límites de las señales y la ausencia de asociación producto-enfermedad validada.
- Motor de recomendaciones con excedentes temporales, caducidad segura, distancia aproximada, demanda coincidente y propuestas parciales/vigilancia.
- Resumen de Amazon Bedrock bajo demanda desde Lambda, con fallback determinista sin error interno expuesto.
- Vista de recomendaciones con decisiones locales del navegador; no se crean órdenes ni se modifica inventario.

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

Para una demo pequeña y estática, incluir los módulos Python (`app.py`, `recommendations.py`, `bedrock_summary.py`), Boto3 y los cuatro CSV sintéticos en el paquete Lambda. API Gateway HTTP API publica las rutas del contrato y limita la ruta de análisis a una solicitud por segundo; CloudWatch conserva logs operativos. Configura `BEDROCK_MODEL_ID`, opcionalmente `BEDROCK_REGION` (con `AWS_REGION` como alternativa), y permite al rol Lambda `bedrock:InvokeModel` solo sobre el modelo autorizado. S3 privado es opcional si los CSV deben actualizarse sin redesplegar. La UI usa Leaflet/CARTO, por lo que no requiere un servicio de mapas para los marcadores. Amazon Location Routes y OpenWeather no forman parte del MVP actual.

## Límites y evolución

- Los valores de inventario son una foto sintética del CSV; las recomendaciones son propuestas deterministas para simulación, no órdenes ni cambios de stock. La IA solo resume; no decide productos, sucursales, cantidades o prioridad.
- Las decisiones de traslado/vigilancia/descartar se guardan en `localStorage` en el navegador actual; no persisten en el backend ni se comparten.
- La vista por producto/sector es una señal retrospectiva de ventas, no una predicción de incidencia. Para asociar productos con enfermedades se necesita un catálogo terapéutico revisado; para estimar casos se requieren datos de vigilancia autorizados y validación experta.
- La distancia disponible es aproximada en línea recta, no una ruta vial ni un tiempo de viaje.
