# Recomendaciones de abastecimiento con Amazon Bedrock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una pestaña de recomendaciones de abastecimiento/vigilancia con propuestas deterministas y explicaciones opcionales de Amazon Bedrock.

**Architecture:** Un módulo Python puro calcula propuestas con el dataset sintético completo y asigna el excedente temporalmente para no duplicarlo. La API Lambda publica esas propuestas y, bajo demanda, solicita a Bedrock un resumen que no decide cantidades. Una vista React nueva mantiene las decisiones de demo en `localStorage`.

**Tech Stack:** Python 3, Boto3/Bedrock Runtime Converse, AWS Lambda + API Gateway HTTP API, React 19, Vite, CSS y `localStorage`; sin base de datos.

**Spec:** [`docs/superpowers/specs/2026-10-08-recommendations-bedrock-design.md`](../specs/2026-10-08-recommendations-bedrock-design.md)

## Global Constraints

- Usa solo los datos sintéticos del repo.
- La distancia se identifica como aproximada y no como ruta o tiempo de viaje.
- Las recomendaciones no crean órdenes, no reservan unidades y no modifican inventarios.
- Bedrock aporta texto contextual; las reglas calculan farmacia, producto, cantidad y prioridad.
- Una llamada de IA se hace solo bajo demanda y respeta el máximo del evento de una solicitud por segundo.
- Si Bedrock no está disponible, se conserva el resultado determinista y se etiqueta como `fallback/simulado`.
- El rol Lambda usa `bedrock:InvokeModel` limitado al modelo autorizado por el sandbox; no se codifican credenciales.
- La rama `main` tiene cambios locales previos en `backend/PLAN_IMPLEMENTACION_BACKEND.md`, `backend/README.md`, `backend/app.py`, `data/README.md`, `frontend/src/App.jsx` y `frontend/src/index.css`. Presérvalos. No los reviertas ni los incluyas en un commit ajeno a su autor.
- No se agregan ni ejecutan pruebas o builds en este plan; solo se hará revisión estática de los contratos salvo que el usuario pida verificar.

## Review Focus

- Caducidad ausente o vencida: el registro no puede ser origen de un traslado; identificarlo como dato desconocido cuando corresponda.
- Coordenadas ausentes o inválidas: no calcular distancia ni proponer una transferencia que dependa de proximidad.
- Un origen candidato para varios destinos: el excedente remanente se descuenta dentro del cálculo para no sugerir las mismas unidades dos veces.
- Boto3, modelo, región, credenciales o permiso ausentes: conservar recomendaciones y devolver fallback sin filtrar error interno.
- Estado de `localStorage` malformado o con identificadores de recomendaciones antiguas: ignorar o limpiar con seguridad, sin bloquear la vista.

---

## File Map

- Create `backend/recommendations.py`: motor puro de candidatos `transfer` y `watch`.
- Create `backend/bedrock_summary.py`: integración Boto3 Converse y respuesta fallback.
- Create `backend/requirements.txt`: dependencia de Boto3 para desarrollo/paquete de Lambda.
- Modify `backend/app.py`: exponer rutas de recomendaciones y ampliar CORS para POST.
- Reuse `backend/local_server.py`: ya acepta POST y pasa el cuerpo al handler; no requiere cambios de diseño.
- Create `frontend/src/RecommendationsView.jsx`: carga, tarjetas, explicación Bedrock y estado de decisiones local.
- Modify `frontend/src/App.jsx`: navegación Mapa/Recomendaciones y carga condicional de la vista.
- Modify `frontend/src/index.css`: estilos responsivos y estados de recomendación.
- Update `backend/README.md`, `backend/PLAN_IMPLEMENTACION_BACKEND.md`, `data/README.md`, `docs/README.md`, `docs/SOLUCION.md`, `docs/CASOS_DE_USO.md` y `docs/ARQUITECTURA_AWS.md`: documentar rutas, variables, permiso mínimo, asignación confirmada y límites; conservar el contenido local ya editado.

## Interfaces entre tareas

`backend/recommendations.py` expone:

```python
def build_recommendations(dataset: dict[str, Any]) -> dict[str, Any]: ...
```

Devuelve `dataStatus`, `referenceDate`, `counts` y `recommendations`. Cada recomendación usa camelCase e incluye `id`, `type` (`transfer` o `watch`), `priority`, `product`, `source` (nulo para vigilancia), `destination`, `suggestedQuantity`, `distanceKm`, `distanceType` (`straight_line_approx`), stock/cobertura y `evidence`.

`backend/bedrock_summary.py` expone:

```python
def summarize_recommendations(payload: dict[str, Any]) -> dict[str, str]: ...
```

Devuelve `provider` (`bedrock` o `fallback`) y `summary`; `notice` es opcional. No devuelve cálculos de stock generados por el modelo.

La API ofrece `GET /api/v1/recommendations` y `POST /api/v1/recommendations/analyze`. La vista React recibe `apiBase` como prop y accede a esas dos rutas. La clave local es `farmasenal.recommendationDecisions.v1`; cada valor de decisión es `simulated`, `watch` o `dismissed` y se indexa por el `id` estable de la recomendación.

---

### Task 1: Crear el motor determinista de recomendaciones

**Files:**
- Create: `backend/recommendations.py`
- Read-only inputs: `backend/app.py`, `data/*.csv`

**Interfaces:**
- Consumes: el objeto normalizado de `_load_dataset()` con `pharmacies`, `products`, `sales` e `inventory`.
- Produces: `build_recommendations(dataset) -> dict[str, Any]`, conforme al contrato de arriba.

- [x] Define estados de riesgo y una fecha de referencia común derivada de la última fecha de venta del dataset.
- [x] Genera destinos cuando el estado es `Agotado`, `Crítico` o `Bajo` y el stock actual es menor que el mínimo.
- [x] Usa como origen solo un registro `Excedente` del mismo producto, con caducidad conocida no vencida, coordenadas válidas y excedente `max(stockActual - stockMinimum, 0)`.
- [x] Empareja primero los destinos con mayor severidad y menor cobertura; ordena orígenes por distancia Haversine ascendente y descuenta en memoria la cantidad ya asignada.
- [x] Calcula cada cantidad como `min(faltante del destino hasta su mínimo, excedente remanente del origen)`; conserva faltantes parciales como vigilancia cuando no haya suministro suficiente.
- [x] Añade a `evidence` la coincidencia o ausencia de señal de ventas de la misma categoría/sector y los valores que justifican la prioridad.
- [x] Devuelve `watch` con causa explícita si el destino está en riesgo y no hay origen elegible; los registros sin coordenadas/caducidad suficiente no se presentan como transferencia segura.
- [x] Haz una revisión estática del módulo frente a los cinco casos de `Review Focus` antes de enlazarlo con la API.

### Task 2: Integrar Bedrock y rutas del API

**Files:**
- Create: `backend/bedrock_summary.py`
- Create: `backend/requirements.txt`
- Modify: `backend/app.py`

**Interfaces:**
- Consumes: `build_recommendations(dataset)` de Task 1.
- Produces: `summarize_recommendations(payload) -> {provider, summary, notice?}` y las rutas HTTP definidas arriba.

- [x] Añade el cliente Boto3 `bedrock-runtime` con `BEDROCK_MODEL_ID` obligatorio y `BEDROCK_REGION` opcional que cae en `AWS_REGION`.
- [x] Limita el prompt a conteos y propuestas sintéticas calculadas; solicita un resumen breve en español sin cantidades nuevas ni órdenes.
- [x] Devuelve un resumen fallback determinista si la configuración, Boto3, el modelo, las credenciales, el permiso o la llamada no están disponibles; no expongas el error de AWS al cliente.
- [x] Integra `GET /api/v1/recommendations` y `POST /api/v1/recommendations/analyze` en `handle_api`, leyendo el dataset completo e ignorando instrucciones enviadas en el cuerpo.
- [x] Actualiza `lambda_handler`/CORS para permitir `GET,POST,OPTIONS`; conserva el soporte POST que `local_server.py` ya tiene.
- [x] Revisa estáticamente las respuestas de ambas rutas, la forma fallback y el contrato con Task 1.

### Task 3: Construir la pestaña de recomendaciones y decisiones locales

**Files:**
- Create: `frontend/src/RecommendationsView.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `apiBase` y las rutas/propiedades definidas en Task 2.
- Produces: navegación accesible Mapa/Recomendaciones y una vista de tarjetas con acciones simuladas.

- [x] Añade estado `activeView` en `App.jsx` y presenta un control de pestañas sin reemplazar ni alterar la vista del mapa; ambas vistas conservan su estado al cambiar de pestaña.
- [x] Implementa `RecommendationsView({ apiBase })`, carga las recomendaciones completas y presenta carga, error recuperable y estado sin resultados.
- [x] Muestra conteos de transferencias/vigilancia/decisiones y tarjetas con producto, origen/destino, cantidad, cobertura, distancia aproximada y evidencias.
- [x] Lee y valida `farmasenal.recommendationDecisions.v1`; permite `Simular traslado`, `Poner en vigilancia`, `Descartar` y limpiar las decisiones locales.
- [x] Conecta **Analizar con AWS AI** con `POST /recommendations/analyze`, deshabilita llamadas repetidas durante la petición y durante un segundo tras completarla.
- [x] Identifica `Amazon Bedrock` o `modo local/simulado` según `provider`; deja claro que las acciones no actualizan inventario.
- [x] Añade foco visible, etiquetas accesibles y layout usable en móvil; no altera estilos existentes del mapa fuera de los selectores compartidos imprescindibles.
- [x] Revisa estáticamente que los campos consumidos coincidan con el contrato de Task 2 y que datos corruptos de `localStorage` no bloqueen la vista.

### Task 4: Alinear documentación de producto, backend, datos y AWS

**Files:**
- Modify: `backend/README.md`
- Modify: `backend/PLAN_IMPLEMENTACION_BACKEND.md`
- Modify: `data/README.md`
- Modify: `docs/README.md`
- Modify: `docs/SOLUCION.md`
- Modify: `docs/CASOS_DE_USO.md`
- Modify: `docs/ARQUITECTURA_AWS.md`

**Interfaces:**
- Consumes: comportamiento implementado por Tasks 1–3.
- Produces: instrucciones de demo reproducibles y una distinción explícita entre Bedrock disponible/fallback, datos sintéticos y acciones simuladas.

- [x] Actualiza contratos de rutas, variables (`BEDROCK_MODEL_ID`, región), dependencia Boto3 y permisos del rol Lambda.
- [x] Documenta instalación/configuración local y el mínimo permiso `bedrock:InvokeModel` para el modelo autorizado; documenta que API Gateway debe limitar Bedrock a 1 solicitud por segundo en el despliegue.
- [x] Documenta decisiones de navegador y que no se comparten ni modifican el inventario.
- [x] Actualiza `data/README.md` para explicar cómo se usa caducidad al evaluar un origen; conserva todas las descripciones existentes del dataset.
- [x] Registra en la guía del proyecto que el equipo confirmó la línea de mejora operativa, manteniendo la distinción entre esa confirmación y lo que dicen las fuentes oficiales.
- [x] Actualiza solución y casos de uso con el estado implementado del flujo de recomendaciones; conserva la vigilancia epidemiológica como alcance separado y no implementado.
- [x] Actualiza el plan backend/arquitectura AWS para describir inventario y recomendaciones, preservando el resto de cambios locales existentes.

### Task 5: Revisión de integración

**Files:**
- Read-only review: cambios de Tasks 1–4.

**Interfaces:**
- Consumes: todas las interfaces anteriores.
- Produces: lista de discrepancias corregidas entre reglas, API, UI y documentación.

- [x] Compara campos de la respuesta del motor con el serializado por la API y los nombres consumidos por React.
- [x] Confirma por lectura que un excedente no se asigna dos veces, que los estados sin AWS mantienen recomendaciones y que todas las acciones se guardan localmente.
- [x] Confirma que el mapa y sus filtros existentes siguen incluidos sin reescribir los cambios que ya estaban en el árbol de trabajo.
- [x] Entrega al usuario un resumen de archivos y límites visibles. No ejecutes tests/builds salvo que el usuario pida verificación.
