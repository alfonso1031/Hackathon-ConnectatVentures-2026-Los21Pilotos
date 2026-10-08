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
| **Solución Construida** | Plataforma analítica geoespacial con mapa interactivo (React + Leaflet + CARTO) y API backend en Python / AWS Lambda que detecta anomalías estadísticas en ventanas móviles (30 vs. 90 días), calcula propuestas simuladas de reabastecimiento y deja a Amazon Bedrock resumirlas bajo demanda. |
| **Diferenciador Clave** | La decisión incorpora **ubicación aproximada, demanda agregada por sector y rotación de producto**, para revisar posibles traslados antes de que ocurra un quiebre de stock. |

---

## ⏱️ 2. Guión de Pitch de 3 Minutos (Segundo a Segundo)

### [0:00 - 0:40] El Gancho Emocional y el Problema de Negocio
*(Objetivo: Captar atención inmediata y conectar el dolor del usuario con los números de Farmaenlace)*

> *"Buenos días, jurado. **Imaginemos a Don José...** Pensemos en un padre, una madre o un abuelo querido que depende de su tratamiento diario para la hipertensión o el dolor crónico. Hoy caminó cuatro cuadras con esfuerzo hasta su Farmacia Económica habitual para comprar su Losartan mensual. Al llegar al mostrador, el dependiente le dice: **'Se nos terminó, Don José; nos llega la próxima semana'**.*
>
> *Don José no puede esperar. Camina a la esquina y compra en la competencia.*
>
> *En la presentación del reto, Farmaenlace nos mostró un dato crítico: **en 4 de sus 5 marcas, más de la mitad de los clientes compra una sola vez**. Cuando un paciente crónico encuentra la percha vacía, la empresa no solo pierde una venta puntual de 8 o 10 dólares: pierde la lealtad y el valor de vida (LTV) de ese cliente para siempre. El quiebre de stock es el destructor silencioso de la fidelización en el canal físico, donde ocurre el 98% de las compras."*

---

### [0:40 - 1:15] La Causa Raíz y la Oportunidad Operativa
*(Objetivo: Demostrar comprensión profunda del negocio y de la limitación tecnológica actual)*

> *"¿Por qué ocurre esto en una cadena con más de 1.400 puntos de venta y SAP S/4HANA?*
>
> *Porque el modelo tradicional de reposición suele ser **reactivo**: la señal de pedido se genera cuando el inventario local ya está en niveles críticos o agotado. Entre la detección, la preparación en bodega central y el transporte, pasan 24 a 48 horas con la percha vacía.*
>
> *Y lo más grave: **no hay contexto geoespacial**. Mientras la sucursal de Don José se queda sin Losartan por un pico de demanda en su barrio, otra sucursal a 10 minutos de distancia en el mismo sector podría tener excedentes o lotes con riesgo de caducidad. Hoy esas dos sucursales no dialogan operativamente."*

---

### [1:15 - 2:10] La Solución: FarmaSeñal en Vivo (DEMO & Enfoque de Mejora Operativa)
*(Objetivo: Mostrar la ejecución técnica, el prototipo funcional y la alineación con la Línea 3 del reto)*

> *(👉 Transición a la pantalla con el Dashboard en ejecución)*
>
> *"Para resolver esto creamos **FarmaSeñal**, enfocados 100% en la **Línea de Reto: Mejora Operativa** de la cadena de suministro.*
>
> *FarmaSeñal es un motor de inteligencia geoespacial que transforma el abastecimiento de reactivo a predictivo en tiempo real:*
> 1. **Detección temprana en mapa interactivo:** *Cada punto representa una sucursal georreferenciada. El sistema compara las ventas de los últimos 30 días contra la línea base histórica de 90 días.*
> 2. **Semáforo inteligente de señales:** *Si la tasa diaria de ventas de una categoría supera el 50% frente a su histórico, el sistema marca el sector en amarillo (alza observada); si se duplica (+100%), se activa una alerta roja de alta severidad.*
> 3. **Visión por categorías sensibles:** *Al filtrar por 'Cardiovasculares', 'Analgésicos' o 'Respiratorios', el planificador identifica al instante qué sector experimenta aceleración y cuál es el producto tractor.*
> 4. **Balanceo preventivo entre farmacias:** *El sistema no solo muestra el mapa; genera la recomendación para transferir excedentes entre sucursales de proximidad antes de que ocurra el quiebre.*
>
> *Técnicamente, el backend REST en **Python** está desplegado en **AWS Lambda detrás de API Gateway** y usa **Amazon Bedrock** para resumir propuestas bajo demanda. La integración con Vendix POS y SAP queda como trabajo futuro para un piloto con datos autorizados.*

---

### [2:10 - 2:40] Impacto Operativo y Retorno de Inversión
*(Objetivo: Cuantificar el beneficio operativo y justificar la viabilidad)*

> *"¿Cuál es el impacto para Farmaenlace?*
>
> *Nuestra métrica de impacto ataca directamente el costo operativo total: **demanda no atendida por falta de stock + costo de medicamentos caducados + costos de traslados logísticos urgentes**.*
>
> *Frente a un Power BI o Qlik tradicional —que son reportes forenses del mes pasado—, FarmaSeñal es un motor **operativo en tiempo real** que previene el quiebre hoy, optimiza la rotación de lotes para evitar mermas por caducidad y protege la recurrencia del cliente en mostrador.*
>
> *Convertimos farmacias aisladas en una **red colaborativa inteligente**."*

---

### [2:40 - 3:00] Cierre y Visión
*(Objetivo: Dejar una frase memorable y postura profesional)*

> *"Farmaenlace ya cuenta con la infraestructura transaccional y la escala. Lo que FarmaSeñal aporta es la **capa de inteligencia geográfica y operativa** que transforma datos en perchas siempre llenas.*
>
> *Con FarmaSeñal, garantizamos que ningún ser querido se quede sin su medicina, y que ninguna farmacia pierda una venta.*
>
> *Muchas gracias. Quedamos atentos a sus preguntas y listos para profundizar en la demo."*

---

## 📊 3. Estructura de Diapositivas (Pitch Deck de 6 Slides - Rápido y Visual)

| # | Título | Mensaje y Contenido Visual | Apoyo Gráfico Incrustado |
|---|---|---|---|
| **1** | **FarmaSeñal** | Portada corporativa: Inteligencia Geoespacial para la Cadena de Salud y Abastecimiento. Reto Farmaenlace: Línea Mejora Operativa — Equipo Los 21 Pilotos. | Estilo corporativo azul marino y cian tecnológico. |
| **2** | **Imaginemos a Don José...** | Conexión humana con un ser querido que busca su medicina crónica (Losartan/Paracetamol). Percha vacía ("vuelva la próxima semana"). 98% compra presencial. >50% fuga de clientes únicos. | **Ilustración 3D de Don José caminando a la farmacia** (`docs/assets/don_jose.jpg`). |
| **3** | **Las Fallas del Abastecimiento** | 3 causas en bloques concisos: 1) Modelo Reactivo (tarde). 2) Bache logístico de 24-48h con percha vacía. 3) Aislamiento entre farmacias del mismo sector a 10 min de distancia. | 3 tarjetas visuales comparativas con métricas destacadas. |
| **4** | **Solución: FarmaSeñal en Vivo** | **Destacado: Línea 3 — Mejora Operativa**. Explicación express del motor predictivo (30 vs 90 días, semáforos amarillo/rojo, categorías críticas) y **PASE DIRECTO A LA DEMO DEL DASHBOARD REACT**. | Badge de Línea de Reto + Tarjeta de llamado a demo en vivo + Dashboard Leaflet interactivo. |
| **5** | **Diferenciación e Impacto Operativo** | Valor operativo en tiempo real vs. reporte forense de BI. Red inteligente de distribución farmacéutica y balanceo de proximidad. Ecuación de ahorro operativo. | **Ilustración 3D de red logística inteligente** (`docs/assets/red_logistica.jpg`). |
| **6** | **Cierre** | *"Que ningún ser querido se quede sin su medicina, y que ninguna farmacia pierda una venta."* Pasamos a la sesión de preguntas. | Cierre limpio con mensaje memorable y llamada a Q&A. |

---

## 🛡️ 4. Guía de Respuestas a Preguntas del Jurado (Q&A Prep)

### P1: *"¿Por qué esta solución pertenece a la línea de Mejora Operativa?"*
> **Respuesta:**  
> *"Porque ataca directamente el proceso central de la cadena de valor retail: la gestión de abastecimiento y la disponibilidad en góndola. En vez de limitarse a una campaña de marketing o fidelización cosmética, FarmaSeñal optimiza los tiempos de reposición, reduce mermas de inventario por caducidad y evita viajes logísticos innecesarios entre bodegas y sucursales mediante traslados de proximidad."*

### P2: *"¿Cómo se diferencia de un reporte en Power BI o Qlik que Farmaenlace ya tiene?"*
> **Respuesta:**  
> *"Un tablero tradicional de Power BI o Qlik muestra un resumen forense de lo que ocurrió la semana o el mes pasado. FarmaSeñal está diseñado como una **herramienta operativa en tiempo real**: calcula anomalías estadísticas sobre ventanas móviles en el momento en que se registran las transacciones y está concebida para conectarse con Vendix (su sistema POS en caja) para sugerir traslados o alertas operativas inmediatas, no reportes estáticos para fin de mes."*

### P3: *"¿Por qué usaron reglas estadísticas (30 vs 90 días) en vez de un modelo de Deep Learning?"*
> **Respuesta:**  
> *"En la gestión de inventario y salud farmacéutica, la **explicabilidad** es crítica. Una caja negra de Deep Learning que dice 'envía 100 unidades' sin justificación genera desconfianza en el planificador. Nuestra regla de tasa diaria (ventana de 30 días comparada con 90 días de línea base) es transparente, auditable, no requiere semanas de reentrenamiento y es lo suficientemente ligera para correr en microservicios serverless en milisegundos con cero costo computacional."*

### P4: *"¿Cómo se integra esto con SAP S/4HANA o Vendix en la vida real?"*
> **Respuesta:**  
> *"El backend está diseñado como una API agnóstica. En el prototipo lee CSVs estandarizados; en producción, el mismo endpoint consume los servicios REST u OData que expone la capa de APIs de SAP HANA y Vendix HUB (descritos en la diapositiva 27 y 29 del documento del reto), requiriendo únicamente permisos de lectura sobre transacciones e inventario local."*

---

## 🎯 5. Checklist para el Ensayo Final (Antes de Subir al Escenario)

- [ ] **Cronómetro en mano:** Practicar el guión para terminar en exactamente **2 minutos con 50 segundos** (dejando 10 segundos de margen de seguridad).
- [ ] **Demo cargada y lista:** Abrir el navegador en `http://localhost:5173/` con el backend corriendo en `http://127.0.0.1:8000/`.
- [ ] **Filtro preparado:** Seleccionar una categoría en vivo (ej. *Cardiovasculares* o *Respiratorios*) durante el minuto 1:30 para mostrar cómo se actualizan las alertas y marcadores.
- [ ] **Respaldo:** Tener abierta una pestaña con capturas de pantalla o un video corto de 30 segundos por si la red WiFi del evento tiene latencia.
- [ ] **Repartición de voces (Equipo de 3):**
  - **Persona 1:** Intro, Don José y costo de fidelización (0:00 - 1:15).
  - **Persona 2:** Solución operativa y demo en vivo del Dashboard (1:15 - 2:10).
  - **Persona 3:** Diferenciación vs BI, impacto financiero y cierre (2:10 - 3:00).

