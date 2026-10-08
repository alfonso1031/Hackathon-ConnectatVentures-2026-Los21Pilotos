# Frontend de FarmaSeñal

Interfaz React + Vite con mapa Leaflet. Muestra farmacias ubicadas por sector y señales de aumento de ventas por categoría, usando el backend que lee los CSV de `../data/`.

## Inicio local

Para usar la API AWS desplegada, desde `frontend` ejecuta:

```powershell
npm run dev
```

Vite toma únicamente `VITE_API_BASE_URL` del `.env` PowerShell en la raíz. No carga ni expone las credenciales AWS. Para usar el backend local en vez de AWS, inicia el [backend](../backend/README.md) y, en esa terminal de PowerShell, define `$env:VITE_API_BASE_URL = ''` antes de `npm run dev`; Vite reenvía `/api/*` a `http://127.0.0.1:8000`.

La interfaz consulta `GET /api/v1/dashboard` y ofrece una ventana de recomendaciones con filtros combinables por tipo, prioridad, decisión, producto y farmacia. Las decisiones se guardan localmente y Bedrock devuelve hasta tres señales prospectivas condicionales basadas en ventas recientes y cobertura. No son predicciones garantizadas. Los traslados son simulados y no cambian existencias.

## Clave del mapa CARTO

Solicita una clave para CARTO Basemaps en [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/); CARTO la envía por correo. Luego crea `frontend/.env.local` copiando `.env.example` y pega la clave:

```dotenv
VITE_CARTO_BASEMAPS_KEY=tu_clave_de_CARTO
```

Vite carga esa variable al iniciar: reinicia `npm run dev` después de crear o cambiar el archivo. La clave aparece en las solicitudes del navegador porque Leaflet pide las teselas directamente; restríngela en el dashboard de CARTO a `localhost:5173`, `127.0.0.1:5173` y al dominio de despliegue cuando exista. No la subas al repositorio ni la pegues en el chat. El repo ignora `.env.local`. Mantén visible la atribución de OpenStreetMap y CARTO.

El mapa usa Leaflet y las teselas CARTO. Los datos del mapa y alertas vienen del API; los marcadores muestran el estado agregado de las señales en su sector. Una variación de ventas no identifica una causa médica.
