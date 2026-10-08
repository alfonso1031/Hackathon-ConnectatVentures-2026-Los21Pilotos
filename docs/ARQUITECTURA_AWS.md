# Propuesta inicial de arquitectura AWS

**Estado:** recomendación para el prototipo tras revisar el frontend actualizado por Git. El equipo aún debe confirmar su reto asignado y qué servicios están habilitados en su sandbox. No despliegues nada hasta revisar permisos y límites del evento.

## Stack mínimo

Para una demo web de un día, empezaría con pocos servicios:

1. **Interfaz:** el frontend actual usa React, Leaflet y teselas CARTO. Mantén ese mapa; para los marcadores, el backend solo necesita devolver coordenadas.
2. **API:** Amazon API Gateway HTTP API como punto HTTPS y AWS Lambda para el flujo principal. El mismo handler puede ejecutarse en un servidor local durante el desarrollo.
3. **Datos de demo:** lee los CSV sintéticos de `data/` localmente. Si los archivos son pequeños y estáticos, inclúyelos en el paquete de Lambda; usa S3 privado solo si el tamaño o las actualizaciones lo justifican.
4. **Registros:** CloudWatch Logs para consultar errores y mostrar evidencia de ejecución.

La primera versión no necesita DynamoDB: el backend lee tres CSV y calcula señales de ventas sin persistir resultados. El dataset no contiene inventario, así que el MVP actual no muestra existencias ni simula reabastecimientos.

AWS documenta el patrón API Gateway → Lambda → DynamoDB para aplicaciones web serverless y CRUD. Amplify Hosting ofrece publicación basada en Git para aplicaciones web; úsalo solo si el acceso está habilitado y cabe en el tiempo del hackathon.

## Opcionales según el reto confirmado

- **IA generativa:** Amazon Bedrock solo si mejora una parte concreta de la experiencia y se puede mostrar su aporte frente a una alternativa simple. Llama desde Lambda, limita el ritmo a una solicitud por segundo según la guía del evento y usa datos sintéticos. Si el modelo o permiso no está disponible, muestra una respuesta simulada e identifícala como tal. Las cuotas generales de Bedrock varían por modelo y región; el límite del evento es el que debe seguir el equipo.
- **Autenticación:** Amazon Cognito únicamente si el flujo necesita diferenciar usuarios o roles. Para una demo de usuario único, evita añadir autenticación innecesaria.
- **Mapas y rutas:** la UI actual usa Leaflet/CARTO y solo requiere coordenadas de farmacia. Amazon Location Service Routes puede incorporarse si luego se muestran rutas viales y la cuenta del evento habilita el servicio.
- **Clima:** OpenWeather podría añadirse como contexto opcional si una versión futura lo necesita; no es evidencia de enfermedad ni es parte del análisis actual.
- **Archivos remotos:** Amazon S3 privado con Block Public Access solo si el prototipo necesita actualizar los CSV sin redesplegar; no conviertas el bucket en un sitio público.

## Ajuste a cada línea posible

| Línea | Flujo demostrable que priorizar | Servicios iniciales |
| --- | --- | --- |
| Fidelización transversal | Perfil de prueba → beneficio/oferta entre marcas → registro del resultado | API Gateway, Lambda y DynamoDB. |
| Servicio al cliente o posventa | Solicitud de prueba → recomendación o estado → siguiente acción visible | API Gateway, Lambda y DynamoDB; Bedrock opcional para redactar o clasificar. |
| Mejora operativa | CSV sintéticos → comparación de ventas por sector/categoría → señal de aumento | API Gateway y Lambda; CSV incluidos en el despliegue o S3 privado si hace falta. |

Estas son formas de demostrar las líneas generales descritas en las fuentes, no asignaciones confirmadas para Los 21 Pilotos.

## Decisiones de arquitectura guiadas por la rúbrica

- **30 puntos — valor e impacto:** registra un problema y usuario concretos y presenta una métrica antes/después.
- **25 puntos — ejecución técnica:** demuestra una sola ruta completa; usa integraciones reales cuando estén disponibles y marca las simulaciones.
- **20 puntos — novedad:** destaca una diferencia concreta sin añadir servicios por cantidad.
- **15 puntos — viabilidad:** describe qué datos, permisos, integración, costo y cambio operativo requeriría un piloto.
- **10 puntos — demo:** prepara un guion breve que funcione dentro del pitch de 3 minutos.

## Condiciones del sandbox

Aplica todas las restricciones de la [guía AWS del evento](GUIA_AWS.md): datos sintéticos, S3 privado, no abrir recursos de cómputo o bases de datos al público, uso mínimo de recursos y máximo de 1 solicitud por segundo para IA generativa. Confirma disponibilidad de cada producto con el organizador; esta recomendación no presupone que el sandbox habilite todos los servicios.

## Referencias técnicas oficiales

- [Patrón de aplicación web con API Gateway y Lambda](https://docs.aws.amazon.com/whitepapers/latest/serverless-multi-tier-architectures-api-gateway-lambda/web-application.html).
- [Guía de AWS Amplify Hosting](https://docs.aws.amazon.com/amplify/latest/userguide/).
- [Tutorial de API Gateway HTTP API, Lambda y DynamoDB](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-dynamo-db.html).
- [Cuotas de inferencia de Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-runtime.html).
- [Configuración de AWS CLI con IAM Identity Center](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html).
