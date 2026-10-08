# Hackathon-ConnectatVentures-2026-Los21Pilotos
Repositorio para la solucion creada en la Hackathon ConnectatVentures 2026

## Infraestructura de FarmaSeñal y por qué se usó

La demo documentada usa una arquitectura serverless en AWS para publicar el flujo con pocos servicios y sin administrar servidores:

```text
React + Vite + Leaflet/CARTO → API Gateway HTTP API → AWS Lambda (Python)
                                                     ├─ CSV sintéticos
                                                     └─ Amazon Bedrock (Nova Micro, bajo demanda)
```

- **Frontend:** React y Vite muestran el mapa con Leaflet y teselas de CARTO. El navegador consulta la API; no recibe credenciales de AWS.
- **API y lógica:** API Gateway enruta las solicitudes a una función Lambda Python. El mismo handler también puede ejecutarse localmente. Las reglas calculan alertas de ventas y propuestas de traslado a partir de cuatro CSV sintéticos.
- **IA opcional:** Lambda llama a Amazon Bedrock con Nova Micro para generar hasta tres señales prospectivas breves. Son orientativas, no predicciones garantizadas; si Bedrock no responde, el backend ofrece señales de respaldo basadas en reglas. La IA no modifica inventario ni crea órdenes.
- **Persistencia y operación:** no se usa una base de datos porque los CSV son de solo lectura y las decisiones de la demo se guardan en `localStorage` del navegador. CloudWatch recibe los registros operativos.
- **Límites:** la API documentada no tiene autenticación y solo debe usarse con datos sintéticos. El análisis con IA está limitado a una solicitud por segundo. No se usan actualmente DynamoDB, S3 ni Cognito; S3 privado o autenticación podrían evaluarse si el piloto los necesitara.

Se eligió este conjunto para demostrar rápidamente un flujo completo, mantener bajo el trabajo operativo y ajustarse a las restricciones del sandbox del hackathon. Los datos de ventas son señales operativas: no diagnostican enfermedades ni identifican por sí solos la causa de un aumento.
