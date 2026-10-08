# Frontend de FarmaSeñal

Interfaz React + Vite con mapa Leaflet. Muestra farmacias ubicadas por sector y señales de aumento de ventas por categoría, usando el backend que lee los CSV de `../data/`.

## Inicio local

Desde la raíz inicia el [backend](../backend/README.md). En otra terminal:

```powershell
cd frontend
npm run dev
```

Vite reenvía `/api/*` a `http://127.0.0.1:8000`. La interfaz consulta `GET /api/v1/dashboard` y puede filtrar las señales por categoría. No contiene inventario ni acciones de reabastecimiento porque los CSV actuales no incluyen existencias.

## Clave del mapa CARTO

Solicita una clave para CARTO Basemaps en [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/); CARTO la envía por correo. Luego crea `frontend/.env.local` copiando `.env.example` y pega la clave:

```dotenv
VITE_CARTO_BASEMAPS_KEY=tu_clave_de_CARTO
```

Vite carga esa variable al iniciar: reinicia `npm run dev` después de crear o cambiar el archivo. La clave aparece en las solicitudes del navegador porque Leaflet pide las teselas directamente; restríngela en el dashboard de CARTO a `localhost:5173`, `127.0.0.1:5173` y al dominio de despliegue cuando exista. No la subas al repositorio ni la pegues en el chat. El repo ignora `.env.local`. Mantén visible la atribución de OpenStreetMap y CARTO.

El mapa usa Leaflet y las teselas CARTO. Los datos del mapa y alertas vienen del API; los marcadores muestran el estado agregado de las señales en su sector. Una variación de ventas no identifica una causa médica.
