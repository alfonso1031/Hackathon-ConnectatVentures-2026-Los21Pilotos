# 🎤 Guía Maestra del Pitch — FarmaSeñal Corporativo

> **Equipo:** Los 21 Pilotos  
> **Evento:** Hackathon ConnectatVentures 2026 (Farmaenlace & BYD)  
> **Formato:** Pitch de 3 minutos + Demo en vivo + Preguntas del Jurado  
> **Alineación:** Rúbrica oficial (100 puntos: 30 Impacto, 25 Técnica, 20 Novedad, 15 Viabilidad, 10 Claridad)

---

## 📌 1. Ficha Resumen del Proyecto

| Elemento | Definición |
|---|---|
| **Nombre del Producto** | **FarmaSeñal** (Inteligencia Geoespacial para la Cadena de Salud y Abastecimiento) |
| **Problema Central** | Quiebres de stock locales y ventas perdidas en medicamentos críticos (cardiovasculares, analgésicos, respiratorios), provocados por un modelo de reposición reactivo que no considera la demanda territorial ni la proximidad entre farmacias. |
| **Usuario Objetivo** | Planificador de abastecimiento y analista de operaciones de Farmaenlace (beneficiando directamente al adulto mayor y cliente frecuente en percha). |
| **Solución Construida** | Plataforma analítica geoespacial con mapa interactivo en tiempo real (React + Leaflet + CARTO) y API backend (Python / AWS Lambda) que detecta anomalías estadísticas en ventanas móviles (30 vs. 90 días) para alertar riesgos de desabastecimiento e identificar oportunidades de traslado entre sucursales. |
| **Diferenciador Clave** | La decisión incorpora **ubicación, tiempo de ruta, demanda agregada por sector y rotación de producto**, evitando traslados ciegos y reduciendo la pérdida de clientes por falta de stock. |

---

## ⏱️ 2. Guión de Pitch de 3 Minutos (Segundo a Segundo)

### [0:00 - 0:40] El Gancho Emocional y el Problema de Negocio
*(Objetivo: Captar atención inmediata y conectar el dolor del usuario con los números de Farmaenlace)*

> *"Buenos días, jurado. Les presento a Don José. Tiene 68 años y padece hipertensión. Hoy caminó cuatro cuadras hasta su Farmacia Económica habitual para comprar su Losartan mensual. Al llegar al mostrador, el dependiente le dice: **'Se nos terminó, Don José; nos llega la próxima semana'**.*
>
> *Don José no puede esperar. Camina a la esquina y compra en la competencia.*
>
> *En la presentación del reto, Farmaenlace nos mostró un dato crítico: **en 4 de sus 5 marcas, más de la mitad de los clientes compra una sola vez**. Cuando un paciente crónico encuentra la percha vacía, la empresa no solo pierde una venta de 8 o 10 dólares: pierde la lealtad y el valor de vida (LTV) de ese cliente para siempre. El quiebre de stock es el destructor silencioso de la fidelización."*

---

### [0:40 - 1:15] La Causa Raíz y la Oportunidad Operativa
*(Objetivo: Demostrar comprensión profunda del negocio y de la limitación tecnológica actual)*

> *"¿Por qué ocurre esto en una cadena con más de 1.400 puntos de venta y SAP S/4HANA?*
>
> *Porque el modelo tradicional de reposición suele ser **reactivo**: la señal de pedido se genera cuando el inventario local ya está en niveles críticos o agotado. Entre la detección, la preparación en bodega central y el transporte, pasan 24 a 48 horas con la percha vacía.*
>
> *Y lo más grave: **no hay contexto geoespacial**. Mientras la sucursal de Don José se queda sin Losartan por un pico de demanda en su barrio, otra sucursal a 15 minutos en el mismo sector podría tener excedentes o lotes con riesgo de caducidad. Hoy esas dos sucursales no dialogan operativamente."*

---

### [1:15 - 2:10] La Solución: FarmaSeñal en Vivo (DEMO)
*(Objetivo: Mostrar la ejecución técnica, el prototipo funcional y la arquitectura)*

> *(👉 Transición a la pantalla con el Dashboard en ejecución)*
>
> *"Para resolver esto creamos **FarmaSeñal**, un motor de inteligencia geoespacial para la planificación de abastecimiento.*
>
> *Aquí pueden ver nuestro prototipo funcional conectado a los datos de la red:*
> 1. **Detección temprana en mapa interactivo:** *Cada punto representa una sucursal georreferenciada. El sistema compara las ventas de los últimos 30 días contra la línea base histórica de 90 días.*
> 2. **Semáforo inteligente de señales:** *Si la tasa diaria de ventas de una categoría supera el 50% frente a su histórico, el sistema marca el sector en amarillo (alza observada); si se duplica (+100%), se activa una alerta roja de alta severidad.*
> 3. **Visión por categorías sensibles:** *Al filtrar por 'Respiratorios' o 'Cardiovasculares', el planificador identifica al instante qué sector está experimentando una aceleración de consumo inusual y cuál es el producto tractor (por ejemplo, Paracetamol 500mg).*
> 4. **Acción informada:** *El sistema no solo muestra el mapa; genera la señal para simular y priorizar traslados preventivos entre sucursales cercanas antes de que ocurra el quiebre de inventario.*
>
> *Técnicamente, construimos una arquitectura modular: un frontend responsivo en **React + Leaflet** consumiendo una API REST en **Python**, lista para desplegarse como microservicio serverless en **AWS Lambda y API Gateway**."*

---

### [2:10 - 2:40] Impacto Económico y Sinergia con BYD
*(Objetivo: Cuantificar el beneficio, justificar la inversión y enlazar con el aliado de movilidad)*

> *"¿Cuál es el impacto para Farmaenlace?*
>
> *Diseñamos nuestra métrica de impacto sobre el costo operativo total: **demanda no atendida por falta de stock + costo de medicamentos caducados + costos de traslado logístico**.*
>
> *Al anticipar los picos de demanda y redistribuir existencias entre sucursales de proximidad, reducimos las ventas perdidas y disminuimos las mermas por vencimiento.*
>
> *Y aquí entra la sinergia con **BYD**: para los traslados intercomunitarios o entregas de última milla entre nodos urbanos, la logística puede coordinarse mediante flotas eléctricas livianas de BYD, reduciendo costos operativos de combustible y emisiones, e integrándose con la red de más de 150 electrolineras a nivel nacional."*

---

### [2:40 - 3:00] Cierre y Visión a Futuro
*(Objetivo: Dejar una frase memorable y postura profesional)*

> *"Farmaenlace ya cuenta con la infraestructura transaccional y la escala. Lo que FarmaSeñal aporta es la **capa de inteligencia geográfica y predictiva** que transforma datos dispersos en decisiones ágiles en primera línea.*
>
> *Con FarmaSeñal, garantizamos que Don José siempre encuentre su tratamiento a tiempo, y que Farmaenlace nunca vuelva a perder una venta por falta de anticipación.*
>
> *Muchas gracias. Quedamos atentos a sus preguntas y listos para mostrar más de la demo."*

---

## 📊 3. Estructura de Diapositivas (Pitch Deck de 6 Slides - Rápido y Visual)

| # | Título | Mensaje y Contenido Visual | Apoyo Gráfico Incrustado |
|---|---|---|---|
| **1** | **FarmaSeñal** | Portada corporativa: Inteligencia Geoespacial para la Cadena de Salud y Abastecimiento. Reto Farmaenlace & BYD — Equipo Los 21 Pilotos. | Estilo corporativo azul marino / cian tecnológico. |
| **2** | **Imaginemos a Don José...** | Conexión humana con un ser querido (padre o abuelo) que busca su medicina crónica (Losartan/Paracetamol). Percha vacía ("vuelva la próxima semana"). 98% compra presencial. >50% fuga de clientes únicos. | **Ilustración 3D de Don José caminando a la farmacia** (`docs/assets/don_jose.jpg`). |
| **3** | **Las Fallas del Abastecimiento** | 3 causas en bloques concisos: 1) Modelo Reactivo (tarde). 2) Bache logístico de 24-48h con percha vacía. 3) Aislamiento entre farmacias del mismo sector a 10 min de distancia. | 3 tarjetas visuales comparativas con métricas destacadas. |
| **4** | **Solución: FarmaSeñal en Vivo** | Explicación express del motor predictivo (30 vs 90 días, semáforos amarillo/rojo, categorías críticas) y **PASE DIRECTO A LA DEMO DEL DASHBOARD REACT**. | Tarjeta de llamado a demo en vivo + Dashboard Leaflet interactivo. |
| **5** | **Diferenciación & Sinergia BYD** | Valor operativo en tiempo real vs. reporte forense de BI. Traslados de proximidad con flotas eléctricas BYD (+150 electrolineras). Ahorro operativo y cero emisiones. | **Ilustración 3D de logística eléctrica BYD en farmacia** (`docs/assets/logistica_byd.jpg`). |
| **6** | **Cierre** | *"Que ningún ser querido se quede sin su medicina, y que ninguna farmacia pierda una venta."* Pasamos a la sesión de preguntas. | Cierre limpio con mensaje memorable y logos del reto. |

---

## 🛡️ 4. Guía de Respuestas a Preguntas Difíciles del Jurado (Q&A Prep)

### P1: *"¿Esto no lo hace ya el equipo de Business Intelligence (BI) de Farmaenlace con Power BI o Qlik?"*
> **Respuesta:**  
> *"Un tablero tradicional de Power BI o Qlik muestra un resumen forense de lo que ocurrió la semana o el mes pasado. FarmaSeñal está diseñado como una **herramienta operativa en tiempo real**: calcula anomalías estadísticas sobre ventanas móviles en el momento en que se registran las transacciones y está concebida para conectarse con Vendix (su sistema POS en caja) para sugerir traslados o alertas operativas inmediatas, no reportes estáticos para fin de mes."*

### P2: *"¿Por qué usaron reglas estadísticas (30 vs 90 días) en vez de un modelo de Deep Learning o Redes Neuronales?"*
> **Respuesta:**  
> *"En la gestión de inventario y salud farmacéutica, la **explicabilidad** es crítica. Una caja negra de Deep Learning que dice 'envía 100 unidades' sin justificación genera desconfianza en el planificador. Nuestra regla de tasa diaria (ventana de 30 días comparada con 90 días de línea base) es transparente, auditable, no requiere semanas de reentrenamiento y es lo suficientemente ligera para correr en microservicios serverless en milisegundos con cero costo computacional."*

### P3: *"¿Esto predice epidemias o diagnostica enfermedades en la población?"*
> **Respuesta:**  
> *(Rigor ético y técnico)* *"No. Queremos ser sumamente transparentes: FarmaSeñal detecta **señales comerciales de demanda agregada**. Un aumento en antigripales puede deberse a estacionalidad, promociones o clima, pero no constituye un diagnóstico epidemiológico. Para vigilancia epidemiológica se requerirían datos clínicos validados con el Ministerio de Salud. FarmaSeñal se enfoca en la eficiencia del abastecimiento farmacéutico."*

### P4: *"¿Cómo se integra esto con SAP S/4HANA o Vendix en la vida real?"*
> **Respuesta:**  
> *"El backend está diseñado como una API agnóstica. En el prototipo lee CSVs estandarizados; en producción, el mismo endpoint consume los servicios REST u OData que expone la capa de APIs de SAP HANA y Vendix HUB (descritos en la diapositiva 27 y 29 del documento del reto), requiriendo únicamente permisos de lectura sobre transacciones e inventario local."*

### P5: *"¿Qué rol cumple BYD en todo esto?"*
> **Respuesta:**  
> *"Farmaenlace tiene un reto de última milla y distribución en más de 1.400 locales. El documento destaca la alianza con BYD y sus 150 puntos de carga. Cuando FarmaSeñal detecta que dos sucursales cercanas deben balancear inventario, ese traslado de corto radio puede ejecutarse con la flota corporativa eléctrica de BYD, convirtiendo la movilidad sustentable en una ventaja de costo logístico para el grupo."*

---

## 🎯 5. Checklist para el Ensayo Final (Antes de Subir al Escenario)

- [ ] **Cronómetro en mano:** Practicar el guión para terminar en exactamente **2 minutos con 50 segundos** (dejando 10 segundos de margen de seguridad).
- [ ] **Demo cargada y lista:** Abrir el navegador en `http://localhost:5173/` con el backend corriendo en `http://127.0.0.1:8000/`.
- [ ] **Filtro preparado:** Seleccionar una categoría en vivo (ej. *Respiratorios*) durante el minuto 1:30 para mostrar cómo se actualizan las alertas y marcadores.
- [ ] **Respaldo:** Tener abierta una pestaña con capturas de pantalla o un video corto de 30 segundos por si la red WiFi del evento tiene latencia.
- [ ] **Repartición de voces (Equipo de 3):**
  - **Persona 1:** Intro, problema de Don José y cifras de negocio (0:00 - 1:15).
  - **Persona 2:** Demo en vivo y explicación técnica de arquitectura (1:15 - 2:10).
  - **Persona 3:** Impacto económico, sinergia BYD y cierre (2:10 - 3:00).
