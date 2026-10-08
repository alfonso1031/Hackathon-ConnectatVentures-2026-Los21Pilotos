# Guía del hackathon

Estos documentos reúnen las reglas, criterios y referencias que encontramos en la carpeta compartida **Hackathon ConnectatVentures 2026**. Para las decisiones de producto, la rúbrica es la guía principal; las reglas del evento, el acuerdo y los límites de AWS son condiciones obligatorias.

## Documentos

- [Problema](PROBLEMA.md): quiebre de stock como hipótesis de dolor para clientes y operación.
- [Causa](CAUSA.md): hipótesis de reposición reactiva y datos por validar.
- [Solución](SOLUCION.md): flujo propuesto de reabastecimiento predictivo geoespacial.
- [Casos de uso](CASOS_DE_USO.md): flujo principal de reabastecimiento y caso complementario de señales territoriales de salud para FarmaSeñal.
- [Pitch y Presentación](PITCH.md): guion cronometrado de 3 minutos, diapositivas y respuestas para el jurado.
- [Impacto](IMPACTO.md): métricas de simulación y evidencia alineada con la rúbrica.
- [Rúbrica](RUBRICA.md): criterios, pesos y cálculo de puntaje.
- [Reglas para participantes](REGLAS_PARTICIPANTES.md): formato, integridad, convivencia y uso del trabajo.
- [Acuerdo de participación](ACUERDO_PARTICIPACION.md): confidencialidad, propiedad intelectual, datos e imagen; incluye una discrepancia que requiere aclaración.
- [Reto Farmaenlace y BYD](RETO_FARMAENLACE_BYD.md): contexto y oportunidades descritas en el material del reto.
- [Guía del sandbox AWS](GUIA_AWS.md): acceso y restricciones de seguridad compartidas para el evento.
- [Agenda](AGENDA.md): horarios y cierre de entregas.
- [Recursos de Cursor](RECURSOS_CURSOR.md): tratamiento seguro del archivo de referidos.
- [Arquitectura AWS](ARQUITECTURA_AWS.md): flujo implementado localmente y configuración pendiente para Bedrock y el sandbox.

## Fuentes revisadas

- `Hackathon Farmaenlace_BYD — Rúbrica para participantes.pdf`.
- `Reglas participantes` (Google Doc) y `Reglas participantes.pdf`. El contenido consultado coincide; se resume una sola vez.
- `1. Hackaton - FARMAENLACE_BYD_Reto.pdf`.
- `Guia para construir en AWS.pdf`.
- `Acuerdo_de_participacion.docx.pdf`.
- `Agenda minuto a minuto — Hackathon Connect atVentures.pdf`.
- `Links para Cursor.pdf`.

## Estado y pendientes

El equipo confirmó que a Los 21 Pilotos le asignaron **mejora operativa para Farmaenlace**. Esta confirmación viene del equipo; las fuentes oficiales revisadas describen las líneas del reto, pero no identifican la asignación del equipo.

1. Las reglas y el acuerdo difieren sobre los derechos del trabajo creado durante el hackathon. Consulta [el resumen del acuerdo](ACUERDO_PARTICIPACION.md) y pide aclaración escrita antes de asumir las condiciones de propiedad intelectual.
2. El PDF de Cursor contiene datos personales y códigos de referido por equipo; no se copiaron esos valores. La guía de AWS también contiene un código de acceso al sandbox; consúltalo en el original y no lo publiques en el repo.
3. La API AWS de la demo ya está desplegada en `us-east-1`: Lambda usa Amazon Nova Micro bajo demanda, el rol limita `bedrock:InvokeModel` a ese modelo y API Gateway limita el análisis a una solicitud por segundo. Los datos siguen siendo sintéticos; el endpoint está en `VITE_API_BASE_URL` del `.env` local, que no se publica.

Estos archivos resumen las fuentes y no sustituyen los documentos originales ni las instrucciones actualizadas de la organización.
