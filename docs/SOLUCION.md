# Solución: recomendaciones operativas de abastecimiento

## Propuesta

FarmaSeñal incorpora una ventana de recomendaciones que ayuda a revisar qué sucursales podrían abastecer a otras y cuáles requieren vigilancia. Las reglas deterministas combinan estado y mínimo de inventario, excedente del mismo producto, caducidad, ventas agregadas y ubicación. Amazon Bedrock puede explicar el resultado con un resumen breve; no calcula las cantidades ni decide ejecutar acciones.

La ubicación permite ordenar orígenes por distancia aproximada en línea recta. El prototipo no calcula rutas viales ni tiempos de traslado. Solo considera como origen el excedente con coordenadas y caducidad futura conocidas; cada propuesta se limita al faltante del destino y al excedente disponible en el cálculo.

## Flujo de la demo

1. La API carga el dataset **sintético** completo de farmacias, coordenadas, ventas e inventario.
2. La ventana muestra destinos con riesgo y propone un origen elegible cercano o vigilancia cuando no hay suministro seguro.
3. El planificador revisa producto, cantidad, origen, destino, cobertura, distancia aproximada y evidencias.
4. El usuario puede guardar una decisión local de simular, vigilar o descartar. No se crea una orden ni se cambia el inventario.
5. Al solicitarlo, Amazon Bedrock resume las propuestas calculadas; si AWS no está disponible se muestra un resumen por reglas identificado como modo local/simulado.

La app y el flujo local están implementados sobre CSV sintéticos. El uso real de Bedrock requiere configurar el modelo autorizado, región, credenciales/rol y permiso del sandbox. No existe conexión con SAP, no se entrenó un modelo con datos de Farmaenlace y no se envían órdenes reales.

## Alcance inicial

El alcance operativo del prototipo cubre traslados sugeridos y vigilancia para todos los pares de farmacia/producto del dataset. La vigilancia epidemiológica del mapa permanece como flujo separado: las señales comerciales no diagnostican enfermedades ni explican por qué cambiaron las ventas.

## Relación con la rúbrica

- **Calidad técnica y ejecución (25):** evidencia esperada: flujo funcional con datos sintéticos y distinción visible entre recomendación y orden simulada.
- **Novedad y diferenciación (20):** evidencia esperada: mostrar cómo inventario, caducidad, señal de ventas y distancia aproximada ayudan a ordenar traslados simulados.
- **Viabilidad e implementación (15):** evidencia esperada: explicar qué datos, permisos e interfaces se requerirían para un piloto.
- **Claridad de presentación y demo (10):** evidencia esperada: seguir el flujo anterior en una demo breve y legible.
