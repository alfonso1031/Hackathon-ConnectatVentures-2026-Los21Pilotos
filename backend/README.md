# Backend de FarmaSeñal

API en Python que lee `data/farmacias.csv`, `data/productos.csv`, `data/ventas.csv` y `data/inventario.csv`. Usa la biblioteca estándar para las reglas; Boto3 es la dependencia del resumen opcional de Bedrock. Comparte el mismo handler entre el servidor local y AWS Lambda con API Gateway HTTP API v2.

## Ejecutar localmente

Desde la raíz del repositorio, inicia el backend:

```powershell
python backend/local_server.py
```

En otra terminal, inicia el frontend:

```powershell
cd frontend
npm run dev
```

Vite reenvía `/api/*` al backend en `http://127.0.0.1:8000`. Configura `DATA_DIR` si los CSV están en otra carpeta; puedes cambiar sus nombres con `PHARMACIES_CSV`, `PRODUCTS_CSV`, `SALES_CSV` e `INVENTORY_CSV`.

## API

- `GET /health`: disponibilidad del proceso.
- `GET /api/v1/dashboard`: datos del mapa, KPIs y alertas de ventas agregadas por sector/categoría.
- `GET /api/v1/dashboard?category=Respiratorios`: filtra las señales por categoría. El valor debe coincidir con el catálogo del CSV.
- `GET /api/v1/dashboard?category=Respiratorios&product_id=P001`: además filtra las ventas y el inventario por producto.
- `GET /api/v1/recommendations`: propuestas deterministas de traslado y vigilancia calculadas sobre los cuatro CSV completos, sin depender de los filtros del mapa.
- `POST /api/v1/recommendations/analyze`: solicita hasta tres señales prospectivas breves a Amazon Bedrock, basadas en la variación reciente de ventas y la cobertura actual; no son predicciones garantizadas ni un modelo entrenado. Si Bedrock no está configurado o no responde, devuelve hasta tres señales por reglas con `provider=fallback`.

La respuesta incluye el catálogo completo de productos, ventas recientes y su variación por sector, registros de inventario por farmacia, alertas de stock bajo y resúmenes de riesgo por sector. Los filtros de categoría y producto se aplican tanto a ventas como a inventario.

El dashboard compara unidades vendidas en los últimos 30 días disponibles con el promedio diario de los 90 días anteriores. Publica una señal cuando la tasa reciente aumenta al menos 50%, hay al menos 2 transacciones en la ventana reciente y 3 en la línea base. La severidad es alta desde un aumento de 100%. Es una regla explicable de anomalías, no un modelo entrenado ni una predicción de enfermedades.

El inventario procede del CSV sintético y se une mediante `id_farmacia` e `id_producto`. Stock, mínimo, estado y días de cobertura son los valores del archivo. La ruta de recomendaciones considera destinos agotados, críticos o bajos por debajo del mínimo, busca excedente del mismo producto y descarta como origen los registros con caducidad desconocida/vencida o coordenadas inválidas. El cargador rechaza fechas de caducidad con formato inválido. Ordena alternativas por distancia geográfica aproximada y descuenta el excedente dentro del cálculo para no proponer las mismas unidades más de una vez. No cambia el CSV ni crea órdenes. Las alertas no identifican la causa de un aumento ni constituyen diagnósticos.

## AWS

La demo está desplegada en AWS: la función `farmasenal-recommendations-api` (`app.lambda_handler`) recibe las rutas de una HTTP API de API Gateway. Lee los CSV sintéticos incluidos en el paquete Lambda. La API publica `GET /health`, `GET /api/v1/dashboard`, `GET /api/v1/recommendations` y `POST /api/v1/recommendations/analyze`. El análisis tiene límite de una solicitud por segundo y una ráfaga de una. El rol `farmasenal-recommendations-execution` permite `bedrock:InvokeModel` solo para el modelo configurado; también tiene permisos básicos de CloudWatch Logs. El endpoint está guardado en `VITE_API_BASE_URL` del `.env` local del repositorio.

El modelo activo es `amazon.nova-micro-v1:0` en `us-east-1`, configurado mediante `BEDROCK_MODEL_ID` y `BEDROCK_REGION`; si falta `BEDROCK_REGION`, el código usa `AWS_REGION`. La inferencia ocurre en Lambda con el rol de ejecución; las claves AWS no deben guardarse en variables del frontend ni publicarse en el repositorio. La HTTP API no tiene autenticación y sirve únicamente los datos sintéticos de la demo. No la uses con información real regulada.

El handler permite configurar `FRONTEND_ORIGIN` para CORS. Las decisiones de la UI viven solo en el `localStorage` del navegador; no requieren base de datos y no se comparten entre usuarios. En desarrollo local, instala `python -m pip install -r backend/requirements.txt`; si Bedrock no está configurado o no responde, la ruta conserva las propuestas y devuelve el fallback.

Ejemplo local en PowerShell, usando el perfil temporal y el modelo que la organización haya habilitado:

```powershell
$env:BEDROCK_MODEL_ID = "<modelo-autorizado>"
$env:BEDROCK_REGION = "<region-habilitada>"
$env:AWS_PROFILE = "<perfil-temporal>"
python backend/local_server.py
```

El frontend conserva Leaflet y las teselas CARTO; no requiere una API de mapas para dibujar los marcadores. Amazon Location Routes solo tendría sentido si se agregaran rutas viales. OpenWeather no aporta a la detección basada en ventas y queda fuera del flujo actual.

Los datos de la demo deben ser sintéticos. Las señales no son diagnósticos ni evidencia de brotes.
