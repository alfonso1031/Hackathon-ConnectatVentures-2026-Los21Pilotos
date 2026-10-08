# Causa propuesta: reposición reactiva y decisiones sin contexto geográfico

## Hipótesis de causa raíz

La hipótesis del equipo es que una política que reacciona cuando el inventario ya está bajo puede dejar poco margen para reponer antes de que llegue la siguiente demanda. El tiempo entre detectar la necesidad, preparar el despacho y transportar el producto puede crear un periodo en el que la sucursal no tenga existencias.

Además, una decisión tomada solo con el inventario de una sucursal no necesariamente identifica si otra sucursal cercana tiene excedentes que podrían trasladarse a tiempo. La demanda local, los lotes próximos a caducar y el tiempo de ruta podrían no estar considerados juntos en la decisión.

Esta es una hipótesis sobre el proceso que proponemos mejorar; **no afirmamos que el sistema actual de Farmaenlace funcione así** ni que su ERP carezca de información o capacidades.

## Cadena causal que investigaremos

1. La demanda de un producto aumenta o cambia en una zona.
2. El inventario disponible se consume antes de la siguiente reposición.
3. La señal de reposición llega tarde o no considera alternativas entre sucursales.
4. El tiempo de preparación y traslado deja la percha sin producto.
5. Se puede perder una venta y, al mismo tiempo, quedar inventario lento en otra ubicación.

## Validaciones necesarias

- ¿Qué política de reposición se usa hoy y con qué anticipación genera una orden?
- ¿Cuáles son los tiempos reales de reposición por producto, sucursal y ruta?
- ¿Se puede consultar inventario por lote y fecha de caducidad?
- ¿Qué traslados entre sucursales están permitidos y qué costos o restricciones aplican?
- ¿Qué datos e interfaces estarían disponibles para un piloto?

## Hechos y límites de las fuentes

El resumen del reto identifica oportunidades para mejorar el recorrido del cliente y convertir datos en acciones, pero no describe el proceso de reposición ni confirma los tiempos de entrega.

Una [comunicación oficial de SAP de 2025](https://news.sap.com/latinamerica/2025/01/farmaenlace-avanza-en-su-transformacion-digital-apoyada-por-sap-y-sybven/) informa que Farmaenlace implementó SAP S/4HANA en su vertical retail y que su red superaba las 1.200 farmacias en ese momento. Esto no confirma que el equipo pueda acceder a esos sistemas ni valida las cifras de 1.400 locales, 50.000 cajas de un producto o 24–48 horas de reposición citadas en el texto inicial.

## Relación con la rúbrica

Esta sección ayuda a justificar **Viabilidad e implementación (15 puntos)** y **Calidad técnica y ejecución (25 puntos)**: identifica qué habría que comprobar antes de conectar una solución a la operación real y evita presentar supuestos como integraciones disponibles.
