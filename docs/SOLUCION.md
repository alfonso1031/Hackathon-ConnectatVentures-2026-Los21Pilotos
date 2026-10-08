# Solución: reabastecimiento predictivo geoespacial

## Propuesta

Proponemos un motor de inteligencia geoespacial que anticipe riesgo de quiebre o de caducidad y ayude a planificar traslados entre sucursales. Analizaría la demanda esperada por producto y ubicación, el inventario disponible, las fechas de caducidad y el tiempo o costo de las rutas.

La ubicación es parte central de la decisión: el sistema compararía sucursales de origen y destino, priorizando una ruta que llegue a tiempo y permita vender el producto antes de que caduque. No bastaría con mostrar las tiendas en un mapa; la distancia y el tiempo de traslado deben cambiar la recomendación.

## Flujo propuesto para la demo

1. Cargar un conjunto de datos **sintéticos** de sucursales, coordenadas, ventas, inventario, lotes y rutas.
2. Señalar una sucursal con posible quiebre y sucursales candidatas con excedente.
3. Estimar el riesgo y explicar la recomendación: producto, cantidad, origen, destino y ruta.
4. Simular la creación de una orden de traslado.
5. Comparar los resultados estimados con una estrategia base.

Los datos sintéticos y la demo funcional todavía están por crear. La propuesta no implica que exista una conexión con SAP, que se haya entrenado un modelo con datos de Farmaenlace ni que se vayan a enviar órdenes reales.

## Alcance inicial

Para mantener un flujo demostrable, el prototipo se centrará en un producto, varias sucursales y una decisión de traslado. Variables como clima o densidad comercial se pueden incorporar si aportan a la predicción y se pueden generar o justificar; no deben distraer de demostrar el valor de la ubicación, la demanda y la caducidad.

## Relación con la rúbrica

- **Calidad técnica y ejecución (25):** evidencia esperada: flujo funcional con datos sintéticos y distinción visible entre recomendación y orden simulada.
- **Novedad y diferenciación (20):** evidencia esperada: mostrar que demanda, caducidad y tiempo de ruta cambian cuál traslado conviene.
- **Viabilidad e implementación (15):** evidencia esperada: explicar qué datos, permisos e interfaces se requerirían para un piloto.
- **Claridad de presentación y demo (10):** evidencia esperada: seguir el flujo anterior en una demo breve y legible.
