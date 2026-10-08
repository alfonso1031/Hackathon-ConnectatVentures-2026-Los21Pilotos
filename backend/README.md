# Backend de FarmaSeñal

API en Python que lee `data/farmacias.csv`, `data/productos.csv` y `data/ventas.csv`. Usa la biblioteca estándar y comparte el mismo handler entre el servidor local y AWS Lambda con API Gateway HTTP API v2.

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

Vite reenvía `/api/*` al backend en `http://127.0.0.1:8000`. Configura `DATA_DIR` si los CSV están en otra carpeta; puedes cambiar sus nombres con `PHARMACIES_CSV`, `PRODUCTS_CSV` y `SALES_CSV`.

## API

- `GET /health`: disponibilidad del proceso.
- `GET /api/v1/dashboard`: datos del mapa, KPIs y alertas de ventas agregadas por sector/categoría.
- `GET /api/v1/dashboard?category=Respiratorios`: filtra las señales por categoría. El valor debe coincidir con el catálogo del CSV.

El dashboard compara unidades vendidas en los últimos 30 días disponibles con el promedio diario de los 90 días anteriores. Publica una señal cuando la tasa reciente aumenta al menos 50%, hay al menos 2 transacciones en la ventana reciente y 3 en la línea base. La severidad es alta desde un aumento de 100%. La regla es explicable y sirve como prototipo de anomalías; no es un modelo de aprendizaje automático ni predice enfermedades.

Los CSV no incluyen inventario actual ni compras a proveedores. El backend no calcula días de cobertura, no ofrece stock ni crea simulaciones de reabastecimiento. Una señal de ventas es una variación observada y no identifica su causa.

## AWS

El handler es `app.lambda_handler`. Para Lambda, empaca `app.py` con los tres CSV bajo `data/`, o configura `DATA_DIR` si los archivos se leen de almacenamiento privado autorizado. API Gateway debe enrutar `GET /health` y `GET /api/v1/dashboard` a la función. El handler permite configurar `FRONTEND_ORIGIN` para CORS. No hace falta base de datos para el prototipo.

El frontend conserva Leaflet y las teselas CARTO; no requiere una API de mapas para dibujar los marcadores. Amazon Location Routes solo tendría sentido si se agregaran rutas viales. OpenWeather no aporta a la detección basada en ventas y queda fuera del flujo actual.

Los datos de la demo deben ser sintéticos. Las señales no son diagnósticos ni evidencia de brotes.
