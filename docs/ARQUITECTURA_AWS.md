# Arquitectura AWS para la demo de FarmaSeñal

**Estado:** la API de la demo está desplegada en AWS en `us-east-1` sobre API Gateway HTTP API y Lambda. Usa el modelo Amazon Nova Micro (`amazon.nova-micro-v1:0`) bajo demanda. La fuente de datos sigue siendo sintética; no se conectó a inventario real.

## Stack mínimo

Para una demo web de un día, empezaría con pocos servicios:

1. **Interfaz:** el frontend usa React, Leaflet y teselas CARTO. La pestaña de recomendaciones consume el mismo backend que el mapa.
2. **API:** Amazon API Gateway HTTP API enruta a AWS Lambda; el mismo handler corre en el servidor local. Publica las rutas del mapa, recomendaciones `GET` y análisis Bedrock `POST`.
3. **Reglas operativas:** Python carga los CSV sintéticos y calcula candidatos, cantidades y prioridad. Las decisiones de la demo se conservan en `localStorage`; no se necesita base de datos.
4. **Resumen IA:** Lambda usa Boto3 `bedrock-runtime` y Converse bajo demanda. Bedrock explica propuestas ya calculadas y no crea órdenes ni altera inventario.
5. **Datos y registros:** incluye los CSV sintéticos en el paquete Lambda o lee desde S3 privado si hace falta. CloudWatch Logs conserva logs operativos.

La versión actual no necesita DynamoDB: el backend lee cuatro CSV y calcula el mapa y las recomendaciones sin persistir resultados. No hay integración con inventario real ni actualizaciones de stock.

AWS documenta el patrón API Gateway → Lambda → DynamoDB para aplicaciones web serverless y CRUD. Amplify Hosting ofrece publicación basada en Git para aplicaciones web; úsalo solo si el acceso está habilitado y cabe en el tiempo del hackathon.

## Servicios complementarios fuera del flujo principal

- **Amazon Bedrock:** genera hasta tres señales prospectivas breves bajo demanda desde Lambda, usando casos priorizados, variación de ventas de 30 días frente al promedio diario de los 90 anteriores y cobertura actual. Son proyecciones condicionales, no un modelo entrenado ni certezas. La demo usa `BEDROCK_MODEL_ID=amazon.nova-micro-v1:0` y `BEDROCK_REGION=us-east-1`; el navegador nunca recibe credenciales AWS. El rol dedicado permite `bedrock:InvokeModel` solo para ese modelo. API Gateway limita `POST /api/v1/recommendations/analyze` a 1 solicitud por segundo y ráfaga 1. Si Bedrock no está disponible, las reglas devuelven hasta tres señales breves como `fallback`.
- **Autenticación:** Amazon Cognito únicamente si el flujo necesita diferenciar usuarios o roles. Para una demo de usuario único, evita añadir autenticación innecesaria.
- **Mapas y rutas:** la UI actual usa Leaflet/CARTO y solo requiere coordenadas de farmacia. Amazon Location Service Routes puede incorporarse si luego se muestran rutas viales y la cuenta del evento habilita el servicio.
- **Clima:** OpenWeather podría añadirse como contexto opcional si una versión futura lo necesita; no es evidencia de enfermedad ni es parte del análisis actual.
- **Archivos remotos:** Amazon S3 privado con Block Public Access solo si el prototipo necesita actualizar los CSV sin redesplegar; no conviertas el bucket en un sitio público.

## Ajuste a cada línea posible

| Línea | Flujo demostrable que priorizar | Servicios iniciales |
| --- | --- | --- |
| Fidelización transversal | Perfil de prueba → beneficio/oferta entre marcas → registro del resultado | API Gateway, Lambda y DynamoDB. |
| Servicio al cliente o posventa | Solicitud de prueba → recomendación o estado → siguiente acción visible | API Gateway, Lambda y DynamoDB; Bedrock opcional para redactar o clasificar. |
| Mejora operativa | CSV sintéticos → riesgo de inventario → origen/destino/cantidad explicables → decisión simulada | API Gateway, Lambda y Bedrock para resumen opcional; CSV incluidos o S3 privado. |

Las fuentes describen estas líneas generales sin asignar una a cada equipo. Los 21 Pilotos confirmó al equipo que le corresponde mejora operativa para Farmaenlace.

## Decisiones de arquitectura guiadas por la rúbrica

- **30 puntos — valor e impacto:** registra un problema y usuario concretos y presenta una métrica antes/después.
- **25 puntos — ejecución técnica:** demuestra una sola ruta completa; usa integraciones reales cuando estén disponibles y marca las simulaciones.
- **20 puntos — novedad:** destaca una diferencia concreta sin añadir servicios por cantidad.
- **15 puntos — viabilidad:** describe qué datos, permisos, integración, costo y cambio operativo requeriría un piloto.
- **10 puntos — demo:** prepara un guion breve que funcione dentro del pitch de 3 minutos.

## Condiciones del sandbox

Aplica todas las restricciones de la [guía AWS del evento](GUIA_AWS.md): datos sintéticos, S3 privado, no abrir recursos de cómputo o bases de datos al público, uso mínimo de recursos y máximo de 1 solicitud por segundo para IA generativa. La HTTP API de esta demo no tiene autenticación y expone solo el dataset sintético; no la uses con información real regulada. El endpoint se conserva en `VITE_API_BASE_URL` del `.env` local y no se registra en el repositorio.

## Referencias técnicas oficiales

- [Patrón de aplicación web con API Gateway y Lambda](https://docs.aws.amazon.com/whitepapers/latest/serverless-multi-tier-architectures-api-gateway-lambda/web-application.html).
- [Guía de AWS Amplify Hosting](https://docs.aws.amazon.com/amplify/latest/userguide/).
- [Tutorial de API Gateway HTTP API, Lambda y DynamoDB](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-dynamo-db.html).
- [Cuotas de inferencia de Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas-runtime.html).
- [Configuración de AWS CLI con IAM Identity Center](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html).
