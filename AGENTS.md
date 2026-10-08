# Instrucciones para agentes — Los 21 Pilotos

## Prioridad de trabajo: rúbrica

Usa la rúbrica como referencia principal para decidir qué construir, qué dejar fuera y cómo preparar la demo. Antes de proponer o implementar una funcionalidad, indica qué criterio mejora y qué evidencia permitirá demostrarlo. Prioriza el impacto ponderado; no añadas complejidad solo para aumentar la cantidad de código o servicios.

| Criterio | Peso | Evidencia esperada |
| --- | ---: | --- |
| Propuesta de valor e impacto | 30 | Problema relevante, usuario definido, beneficio concreto y una métrica de impacto. |
| Calidad técnica y ejecución | 25 | Flujo principal funcional, integraciones reales cuando estén disponibles y distinción clara entre lo real y lo simulado. |
| Novedad y diferenciación | 20 | Una mejora original y explicable frente a las alternativas. |
| Viabilidad e implementación | 15 | Camino realista a un piloto, con datos e integraciones accesibles, costos razonables y compatibilidad operativa. |
| Claridad de presentación y demo | 10 | Demo comprensible y explicación del problema, solución y beneficio dentro del pitch de 3 minutos. |

La escala es de 1 a 5; el aporte de cada criterio es `(calificación ÷ 5) × peso`. Los cuatro criterios generales suman 75 puntos y el técnico aporta 25, para un total de 100.

## Límites obligatorios

La rúbrica guía las prioridades; no justifica incumplir las reglas del evento, el acuerdo de participación ni los límites del sandbox de AWS. Si una meta de la rúbrica entra en conflicto con esos límites, respétalos y explica el bloqueo.

- No asumas cuál de los retos se asignó a Los 21 Pilotos. Las fuentes consultadas describen varias líneas de reto, pero la carpeta compartida del equipo está vacía. Pide o registra confirmación antes de orientar el producto a una de ellas.
- El trabajo que se presente como creado en el hackathon debe desarrollarse durante el evento. Se permite investigar y explorar herramientas antes; declara el código, librerías, datos, recursos de terceros e IA utilizados. No copies trabajo ajeno y verifica derechos de uso.
- Usa APIs, sandboxes y la información del patrocinador solo para el reto y dentro de los límites recibidos. Usa datos sintéticos; nunca ingreses datos personales, de salud, financieros, de pago u otros datos reales regulados en la cuenta de AWS.
- En AWS, no expongas públicamente buckets S3, grupos de seguridad de EC2, instancias RDS ni clústeres EMR. Limita los recursos y las solicitudes de IA generativa según la guía del evento (máximo 1 solicitud por segundo).
- No guardes ni publiques credenciales, códigos de acceso del evento, enlaces de referidos de Cursor ni datos personales de otros equipos en el repositorio.

## Decisiones y entrega

- Mantén el prototipo centrado en un flujo principal que pueda demostrarse. Identifica qué funciona de extremo a extremo y qué partes son simuladas.
- Relaciona cada decisión de alcance con los criterios y sus pesos. Para priorizar, atiende primero el valor (30), después la ejecución técnica (25), la diferenciación (20), la viabilidad (15) y la presentación (10), siempre dentro de los límites anteriores.
- Prepara un pitch de 3 minutos y congela el producto a la hora de cierre indicada en la agenda.
- Las reglas de participantes y el acuerdo de participación describen de manera distinta la titularidad del trabajo. No afirmes que el equipo conserva todos los derechos ni que el patrocinador obtiene derechos sin límites: señala la diferencia y solicita aclaración escrita a los organizadores.
- Distingue en la documentación los hechos de las fuentes, las decisiones del equipo y los datos pendientes de confirmar.
