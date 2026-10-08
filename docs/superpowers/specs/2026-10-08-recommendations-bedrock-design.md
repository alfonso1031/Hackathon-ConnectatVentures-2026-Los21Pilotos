# Diseño: recomendaciones de abastecimiento con Amazon Bedrock

**Fecha:** 2026-10-08  
**Estado:** diseño aprobado e implementado localmente; integración AWS pendiente de configuración y despliegue.
**Producto:** FarmaSeñal — Los 21 Pilotos.  
**Línea confirmada por el equipo:** mejora operativa para Farmaenlace.

## Objetivo

Agregar una ventana de recomendaciones que ayude al planificador a decidir qué farmacias abastecer, cuáles vigilar y qué traslados vale la pena simular. La propuesta combina las señales de venta, el inventario y la ubicación de las farmacias. Amazon Bedrock explica y resume las propuestas que calculan reglas deterministas; las personas conservan la decisión final.

## Alcance

- Añadir una pestaña **Recomendaciones** junto a la vista del mapa.
- Analizar el dataset sintético completo, sin depender de los filtros activos del mapa.
- Detectar destinos con inventario agotado, crítico o bajo y buscar un origen con excedente seguro del mismo producto.
- Priorizar usando estado y días de cobertura, tendencia reciente de ventas y distancia aproximada entre sucursales.
- Mostrar destinos para vigilancia cuando existe riesgo de stock y no se encuentra un origen elegible.
- Permitir simular un traslado, marcar vigilancia o descartar una recomendación. Guardar esas decisiones solo en `localStorage` del navegador.
- Añadir un resumen explicativo de Amazon Bedrock mediante una solicitud explícita desde la interfaz.
- Mantener visibles las etiquetas de datos sintéticos y de distancia aproximada.

## Fuera de alcance

- Crear órdenes reales, reservar unidades o modificar inventarios.
- Persistir decisiones en un backend, compartirlas entre usuarios o conectarse a SAP/Vendix.
- Usar datos reales de Farmaenlace, de clientes o datos personales/regulados.
- Calcular rutas viales o tiempos de conducción. La distancia será una aproximación geográfica en línea recta.
- Dar consejo médico o atribuir ventas a enfermedades.
- Crear recursos de AWS, desplegar la app o almacenar credenciales durante esta implementación.

## Arquitectura y componentes

1. **Motor determinista de recomendaciones en Python.** Lee farmacias, ventas e inventario mediante el dataset que ya consume el backend. Devuelve candidatos explicables con campos y evidencias concretas.
2. **API actual de Lambda.** Expone `GET /api/v1/recommendations` para los candidatos y `POST /api/v1/recommendations/analyze` para solicitar el resumen de IA. El servidor local utiliza el mismo handler.
3. **Servicio de Amazon Bedrock.** El backend llama a `bedrock-runtime` con Boto3 y la API Converse. El modelo se configura por variable de entorno; el cliente toma credenciales del rol de Lambda en AWS o de la cadena local de credenciales durante desarrollo. El navegador no recibe credenciales.
4. **Vista React de recomendaciones.** La pestaña consume el endpoint, presenta los candidatos y permite registrar decisiones locales. El resumen de Bedrock se solicita bajo demanda.

## Reglas de recomendación

- Un destino puede recibir una propuesta cuando un registro del producto tenga estado `Agotado`, `Crítico` o `Bajo` y sus unidades estén por debajo del mínimo.
- Un origen solo aporta unidades cuando el mismo producto está marcado `Excedente`; la disponibilidad transferible es `max(stockActual - stockMinimum, 0)`.
- No se transfiere entre una farmacia y sí misma. Se excluye un registro vencido según la fecha de referencia del dataset. Si la caducidad no está disponible, el registro queda marcado como dato desconocido y no se propone como origen. Se requiere coordenadas válidas para calcular la distancia.
- La cantidad propuesta es el mínimo entre el faltante del destino hasta su mínimo y el excedente seguro del origen. Si varios orígenes pueden atender el caso, se consideran por distancia aproximada ascendente. El cálculo descuenta de manera temporal el excedente ya asignado a otra propuesta para evitar sugerir dos veces las mismas unidades; no cambia el inventario original. Una cobertura parcial puede generar una propuesta parcial y el faltante seguirá visible.
- Las propuestas se ordenan por severidad del inventario, menor cobertura y presencia/variación de una señal de ventas de la misma categoría y sector; la distancia sirve para ordenar alternativas comparables. Los criterios y valores que sustentan cada prioridad se mostrarán en la tarjeta.
- Si hay riesgo en el destino pero no existe excedente elegible, el sistema propone vigilancia e informa la causa. Una señal de demanda coincidente se añade como evidencia; nunca reemplaza los datos de stock.
- La distancia se calcula con las coordenadas y se identifica como aproximada; no se presenta como ruta ni tiempo de viaje.

## Contrato de API

### `GET /api/v1/recommendations`

Devuelve estado sintético, fecha de referencia, contadores y recomendaciones ordenadas. Cada recomendación incluye identificador estable, tipo (`transfer` o `watch`), prioridad, producto, farmacia destino, farmacia origen si existe, cantidad sugerida, distancia aproximada, cobertura, estado de stock y evidencia de ventas/inventario.

### `POST /api/v1/recommendations/analyze`

El backend construye el prompt a partir del resumen sintético calculado y solicita a Bedrock un resumen corto y explicativo. No acepta instrucciones arbitrarias del navegador ni delega al modelo el cálculo de cantidades, el emparejamiento o una decisión de inventario. La respuesta incluye el proveedor (`bedrock` o `fallback`) para que la interfaz identifique el modo real.

## AWS, cuotas y manejo de errores

- Configuración prevista: identificador de modelo y región por variables de entorno; uso del rol de ejecución de Lambda, sin claves AWS codificadas. `Converse` requiere `bedrock:InvokeModel`; se limitará la política al recurso/modelo autorizado por el sandbox.
- Una solicitud se envía únicamente al pulsar **Analizar con AWS AI**. La interfaz evita solicitudes repetidas y respeta el máximo de una solicitud por segundo descrito en `docs/GUIA_AWS.md`. Si el API Gateway del despliegue tiene throttling disponible, se configurará con el mismo límite para cubrir llamadas concurrentes.
- Si Boto3, la configuración, el modelo o los permisos no están disponibles, el API conserva las recomendaciones deterministas y devuelve un resumen alternativo claramente marcado como `fallback/simulado`. No expone credenciales, errores internos ni stack traces.
- Si el CSV falta o no es válido, la vista muestra el error del API y ofrece reintentar. Si no hay candidatos, presenta un estado vacío explicable.
- La salida generativa solo puede aportar texto contextual. Las cifras, farmacia, producto, cantidad y prioridad provienen de las reglas y permanecen visibles para revisión humana.

## Interfaz y decisiones

- Navegación superior entre **Mapa** y **Recomendaciones**.
- Indicadores compactos para traslados propuestos, farmacias en vigilancia y decisiones registradas.
- Tarjetas con el origen/destino, producto, cantidad, cobertura, distancia aproximada y motivos verificables.
- Acciones: **Simular traslado**, **Poner en vigilancia** y **Descartar**. Son decisiones del usuario guardadas en `localStorage`; no cambian el dataset.
- Botón **Analizar con AWS AI**, estado de carga y etiqueta del resultado (`Amazon Bedrock` o `modo local/simulado`).
- Los identificadores de decisiones se versionan en una clave propia de `localStorage` para permitir limpiar el estado de la demo sin alterar el dataset.

## Evidencia de valor según la rúbrica

| Criterio | Peso | Evidencia que mostrará la demo |
|---|---:|---|
| Propuesta de valor e impacto | 30 | Destinos de alto riesgo vinculados a stock/cobertura y alternativas cercanas; conteo de propuestas y vigilancia como métricas de demo, sin llamarlas ahorro real. |
| Calidad técnica y ejecución | 25 | Flujo visible desde CSV sintéticos a API, recomendación trazable, resumen Bedrock cuando está disponible y acciones claramente simuladas. |
| Novedad y diferenciación | 20 | Coordinación geográfica entre sucursales que incorpora excedentes, demanda y proximidad en una vista operativa. |
| Viabilidad e implementación | 15 | Configuración pequeña sobre Lambda existente; datos e integraciones faltantes identificados para un piloto real. |
| Claridad de presentación y demo | 10 | Una pestaña enfocada con prioridades, razones y decisiones en una sola secuencia demostrable. |

## Criterios de aceptación del diseño

1. La nueva pestaña usa el dataset sintético completo y muestra una explicación para cada propuesta.
2. Ninguna recomendación transfiere más que el excedente seguro ni eleva el destino por encima del mínimo definido en esta fase.
3. Los aumentos de venta pueden elevar prioridad o aportar evidencia, pero no producen por sí solos una orden ni una afirmación médica.
4. Las decisiones siguen visibles al recargar el mismo navegador y están identificadas como locales/simuladas.
5. El resumen Bedrock se invoca desde el backend; si AWS no está listo, la experiencia mantiene el cálculo local y etiqueta el fallback.
6. Ninguna pantalla afirma que se ejecutó un traslado, que se modificó el stock o que el impacto económico se midió en la operación real.

## Referencias técnicas

- [Amazon Bedrock: APIs soportadas y recomendación de `bedrock-runtime`/Converse](https://docs.aws.amazon.com/bedrock/latest/userguide/apis.html).
- [Amazon Bedrock: inferencia con Converse y permiso `bedrock:InvokeModel`](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html).
- [AWS Lambda: permisos mínimos en el rol de ejecución](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html).
- Límites del evento y datos sintéticos: [`docs/GUIA_AWS.md`](../../GUIA_AWS.md) y [`AGENTS.md`](../../../AGENTS.md).
