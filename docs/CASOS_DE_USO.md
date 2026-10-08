# Casos de uso — FarmaSeñal

**Estado:** propuesta para el prototipo; estos casos describen el comportamiento esperado y no confirman que ya esté implementado.

## Propósito y alcance

El flujo principal de FarmaSeñal es operativo: el planificador consulta la demanda proyectada, simula un traslado entre sucursales y compara el resultado con una estrategia base. Como caso complementario, un analista podría visualizar cambios de ventas por sector que sirvan como señales tempranas de posibles tendencias de salud y revisarlas junto con otras fuentes. Todo el flujo se plantea con datos sintéticos.

Este documento toma como alcance de referencia el [plan de implementación del backend](../backend/PLAN_IMPLEMENTACION_BACKEND.md). La asignación oficial de reto a Los 21 Pilotos sigue pendiente de confirmación. Además, [SOLUCION.md](SOLUCION.md) conserva una propuesta distinta, centrada en anticipar quiebres de stock y caducidad por producto; ambos documentos deben alinearse antes de congelar el alcance del producto.

Las señales representan cambios observados o estimados en ventas agregadas; pueden sugerir dónde revisar una posible tendencia de salud, pero no identifican una enfermedad ni estiman casos confirmados. La propuesta de mostrar posibles tendencias de salud amplía el plan backend actual, que define alertas de demanda y proyecciones de unidades por categoría, no un modelo epidemiológico. Para asociar señales a enfermedades concretas harían falta categorías justificadas y validadas por especialistas, datos de referencia y evaluación del modelo. Una variación también puede deberse a promociones, precios, disponibilidad u otros cambios operativos. No se usan datos de clientes ni transacciones individuales. La simulación no crea órdenes reales ni modifica el inventario; tampoco se presupone conexión con SAP ni acceso a datos reales de Farmaenlace.

## Actores

| Actor | Participación |
|---|---|
| **Analista de salud pública o vigilancia territorial** | Usuario propuesto para revisar las señales por sector con otras fuentes y decidir si ameritan investigación. Su participación debe confirmarse como parte del alcance del producto. |
| **Planificador de abastecimiento** | Usuario del flujo operativo. Revisa proyecciones de demanda y evalúa una acción entre sucursales. |
| **Fuente de datos sintéticos** | Proporciona el escenario JSON con sectores, sucursales, ventas agregadas e inventario. Puede leerse localmente durante el desarrollo o desde almacenamiento privado si el despliegue lo habilita. |
| **Proveedor de rutas** | Servicio externo opcional para estimar tiempos y distancias por carretera. Si no está disponible, el sistema puede mostrar una distancia aproximada claramente identificada. |

El cliente y las sucursales son beneficiarios indirectos de una mejor disponibilidad; no interactúan con el prototipo descrito aquí.

## Resumen del flujo principal

```mermaid
flowchart LR
    A[Planificador] --> B[Consulta proyección de demanda]
    B --> C[Simula traslado entre sucursales]
    C --> D[Compara estrategias y métricas estimadas]
    E[Analista territorial] -. caso complementario .-> F[Visualiza señales por sector]
    F --> G[Explora el detalle de la señal]
```

## CU-01 — Consultar proyección de demanda

| Campo | Descripción |
|---|---|
| **Actor principal** | Planificador de abastecimiento. |
| **Objetivo** | Revisar las unidades de demanda proyectadas para una categoría y un sector. |
| **Disparador** | El planificador abre la proyección desde el dashboard o una alerta. |
| **Precondiciones** | El sector y categoría seleccionados tienen datos históricos suficientes para la regla de proyección. |

### Flujo principal

1. El planificador elige sector, categoría y horizonte disponible.
2. El sistema calcula la proyección de unidades para el horizonte solicitado (siete días por defecto en la propuesta del backend).
3. El sistema presenta el resultado junto con el horizonte, el estado de suficiencia del historial y la etiqueta de datos sintéticos.
4. El planificador compara la proyección con el inventario disponible y, si corresponde, continúa a CU-02.

### Alternativas y errores

- **Historial insuficiente o incompleto:** se muestra `insufficient_data` y la razón; no se inventa una precisión o probabilidad.
- **Hubo quiebres de stock en el historial:** el sistema señala que las ventas observadas pueden subestimar la demanda si no cuenta con información para corregirlas.

**Postcondición:** queda visible una proyección de unidades de productos. No es una predicción de incidencia de enfermedad.

## CU-02 — Simular un traslado entre sucursales

| Campo | Descripción |
|---|---|
| **Actor principal** | Planificador de abastecimiento. |
| **Actores de apoyo** | Proveedor de rutas, si está habilitado. |
| **Objetivo** | Evaluar si una sucursal con excedente puede cubrir parte de la demanda proyectada de otra sucursal. |
| **Disparador** | El planificador solicita una recomendación desde una alerta o su detalle. |
| **Precondiciones** | Existe un escenario con inventario y sucursales; la alerta o selección identifica la categoría que se evaluará. |

### Flujo principal

1. El sistema estima el faltante proyectado en la sucursal destino.
2. Busca sucursales origen con excedente seguro, respetando la reserva mínima y los datos de caducidad disponibles.
3. Compara las alternativas por ubicación y tiempo o distancia de ruta.
4. El sistema devuelve categoría, cantidad sugerida, origen, destino, ruta o estimación disponible y efecto operativo estimado.
5. El planificador revisa la justificación y el estado de la ruta.

### Alternativas y errores

- **Ningún origen tiene excedente seguro:** se informa que no hay traslado recomendado.
- **Faltan datos de inventario, coordenadas o caducidad:** se explica qué criterio no pudo evaluarse y se limita la recomendación.
- **Proveedor de rutas no disponible:** se usa otro proveedor solo si está configurado; si no, puede mostrarse distancia en línea recta con la etiqueta `approximate`, sin llamarla ruta vial.

**Postcondición:** se presenta una recomendación simulada. No se crea una orden, no se reserva producto y no se modifica el inventario.

## CU-03 — Comparar estrategias e impacto estimado

| Campo | Descripción |
|---|---|
| **Actor principal** | Planificador de abastecimiento. |
| **Objetivo** | Comparar el escenario Geo-AI con una estrategia base usando la misma demanda e inventario inicial. |
| **Disparador** | El planificador solicita ver el resultado de una simulación. |
| **Precondiciones** | Hay datos sintéticos y supuestos definidos para demanda, inventario, margen y costo de traslado. |

### Flujo principal

1. El sistema calcula el resultado de la estrategia base, por ejemplo, sin traslado o con una regla sencilla.
2. Calcula el resultado de la estrategia Geo-AI con las señales y traslados simulados.
3. Presenta, para ambos escenarios, demanda no atendida, unidades con riesgo de caducidad y costo estimado de traslados.
4. Presenta el costo operativo estimado y su diferencia frente a la base.
5. El planificador revisa los supuestos junto con el resultado.

La métrica propuesta es:

```text
Costo estimado = (unidades de demanda no atendida × margen unitario estimado)
               + (unidades caducadas × costo unitario estimado)
               + costo estimado de los traslados

Reducción (%) = 100 × (Costo_base − Costo_Geo-AI) / Costo_base
```

Si el costo base es cero, se informa la diferencia absoluta en vez del porcentaje.

### Alternativas y errores

- **Faltan márgenes, costos u otros supuestos:** el sistema muestra los indicadores disponibles y señala qué valores son supuestos sintéticos.
- **No existe estrategia base comparable:** no se calcula una reducción; se informa la diferencia que sí pueda estimarse.
- **La demanda real no está disponible:** los resultados se describen como simulación, nunca como ahorro o impacto medido en Farmaenlace.

**Postcondición:** se muestra una comparación reproducible sobre el mismo escenario de entrada, con sus supuestos visibles.

## CU-04 — Explorar el detalle de una señal de demanda

| Campo | Descripción |
|---|---|
| **Actor principal** | Analista de salud pública o vigilancia territorial (propuesto). |
| **Objetivo** | Entender qué ventas agregadas originaron una señal y qué limitaciones afectan su interpretación. |
| **Disparador** | El analista selecciona un sector o una señal en el mapa de CU-05. |
| **Precondiciones** | CU-05 identificó una variación para el sector y periodo seleccionados. |

### Flujo principal

1. El analista abre una señal del mapa.
2. El sistema presenta el sector, periodo, categoría, unidades observadas y referencia esperada, desviación, severidad y estado sintético de los datos.
3. El sistema explica qué historial y campos se usaron y si existe una etiqueta descriptiva validada para la categoría.
4. El analista revisa la señal como una pista para investigar con otras fuentes. El planificador puede consultar la proyección en CU-01 o evaluar un traslado simulado en CU-02.

### Alternativas y errores

- **No se detectan desviaciones relevantes:** se muestra el estado sin alertas para los filtros seleccionados.
- **Historial insuficiente:** se explica la limitación y no se presenta una alerta con falsa precisión.
- **Hay semanas con quiebre de stock conocido:** si existe el dato `stockoutDays`, el sistema lo considera como limitación de las ventas observadas; si no existe, muestra esa limitación.

**Postcondición:** el analista comprende la base y las limitaciones de la señal. La alerta no identifica una enfermedad ni afirma por qué aumentaron las ventas.

## CU-05 — Visualizar señales tempranas de posibles enfermedades por sector

| Campo | Descripción |
|---|---|
| **Actor principal** | Analista de salud pública o vigilancia territorial (propuesto). |
| **Objetivo** | Identificar sectores donde las ventas de categorías asociadas a síntomas presentan una variación que podría servir como señal temprana de una posible tendencia de enfermedad, para que un profesional la revise. |
| **Disparador** | El analista abre el mapa de señales o cambia el periodo de análisis. |
| **Precondiciones** | Hay ventas agregadas sintéticas por producto/categoría, sucursal y periodo; las sucursales están asociadas a sectores. Cualquier relación entre una categoría y un grupo de síntomas debe estar justificada; una hipótesis sobre una enfermedad concreta requiere validación profesional y datos de referencia. |

### Flujo principal

1. El analista selecciona el periodo y, opcionalmente, una categoría o sector.
2. El sistema agrupa las unidades vendidas por categoría y sector y las compara con el comportamiento histórico de referencia.
3. El sistema identifica cambios inusuales solo cuando hay historial suficiente y devuelve el periodo, valor observado, referencia esperada, desviación, severidad y estado de los datos.
4. El mapa resalta los sectores con señales y muestra las categorías asociadas. Solo si existe una relación validada, presenta el posible patrón de salud como hipótesis para revisar; si no, muestra únicamente el cambio de ventas.
5. El analista abre una señal para revisar su detalle en CU-04; el planificador puede consultar la proyección de demanda en CU-01.

### Alternativas y errores

- **Historial insuficiente:** el sector aparece sin señal concluyente y con el estado `insufficient_data`; el sistema no fabrica una tendencia.
- **Aumentan ventas de una categoría:** se muestra una señal de demanda, pero el sistema no atribuye el aumento a una enfermedad. Puede deberse a promociones, cambios de precio, disponibilidad u otros factores.
- **No existe una asociación validada entre categoría y grupo de síntomas:** el mapa muestra la variación de ventas por categoría sin sugerir una condición de salud.
- **Falta o es inconsistente la información del escenario:** el sistema explica el error y no genera resultados usando valores inventados.

**Postcondición:** el analista ve una señal territorial agregada para revisión. No se presenta como diagnóstico, brote confirmado ni número de personas enfermas.

**Ejemplo ilustrativo con datos sintéticos:** si suben las ventas de productos asociados a síntomas respiratorios en un sector, el mapa lo resalta como señal para revisar. Un profesional contrasta el patrón con otras fuentes antes de asociarlo con una posible enfermedad.

## Reglas comunes

1. Los datos de la demo deben identificarse como sintéticos.
2. Una desviación de ventas es una señal de demanda, no una explicación causal. Solo CU-05 puede mostrar una hipótesis de tendencia de salud y únicamente con una relación entre categorías y síntomas previamente validada.
3. Los resultados dependen de la calidad y suficiencia del historial; cuando falten datos se debe explicar la limitación.
4. Las rutas aproximadas deben distinguirse de rutas viales calculadas por un proveedor.
5. Toda recomendación de traslado es simulada y no debe afectar inventarios u órdenes reales.

## Límite epidemiológico y validación

La idea es de vigilancia por señales: revisar patrones agregados de ventas de medicamentos o productos como posibles indicadores tempranos, no predecir diagnósticos individuales. El CDC describe compras de medicamentos y productos entre los datos no diagnósticos que pueden servir como indicadores, pero también señala que una desviación estadística por sí sola no define un brote y debe evaluarse con evidencia y criterio de salud pública ([marco de evaluación del CDC](https://www.cdc.gov/mmwr/preview/mmwrhtml/rr5305a1.htm)).

Para avanzar de una alerta de demanda a una alerta de una posible enfermedad se debe validar, como mínimo, la relación entre las categorías vendidas y el grupo de síntomas, la calidad y suficiencia de los datos, la oportunidad de la señal y sus falsos positivos. El uso previsto y los límites de interpretación deben revisarse con profesionales de salud pública.

## Trazabilidad con los documentos del proyecto

| Caso | Referencia principal |
|---|---|
| CU-04 y CU-05 | Extienden la alerta de demanda del [plan backend](../backend/PLAN_IMPLEMENTACION_BACKEND.md) con un análisis territorial complementario; la hipótesis de salud requiere validación epidemiológica. |
| CU-01 y CU-02 | [Plan de implementación del backend](../backend/PLAN_IMPLEMENTACION_BACKEND.md) |
| CU-03 | [Impacto esperado y medición](IMPACTO.md) |
| Alcance de producto y demo | [Propuesta de solución](SOLUCION.md) |
| Prioridades de evaluación | [Rúbrica del hackathon](RUBRICA.md) |

**Pendiente de producto:** confirmar el reto asignado a Los 21 Pilotos y conciliar la diferencia entre el flujo de FarmaSeñal de este documento y la propuesta de reabastecimiento por quiebres/caducidad de `SOLUCION.md`.
