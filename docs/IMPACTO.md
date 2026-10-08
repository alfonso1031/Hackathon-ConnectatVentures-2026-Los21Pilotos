# Impacto esperado y medición

## Beneficio esperado

La hipótesis es que anticipar la falta de productos y recomendar traslados adecuados puede mejorar la disponibilidad, reducir productos que caducan sin venderse y evitar algunos traslados urgentes. Estos son beneficios esperados; no se han medido en la operación de Farmaenlace.

## Métrica principal para la simulación

Usaremos la **reducción porcentual del costo operativo estimado** de la estrategia Geo-AI frente a una estrategia base, en el mismo periodo y con la misma demanda e inventario inicial:

```text
Costo = (unidades de demanda no atendida × margen unitario estimado)
      + (unidades caducadas × costo unitario estimado)
      + costo estimado de los traslados

Reducción (%) = 100 × (Costo_base − Costo_Geo-AI) / Costo_base
```

La estrategia base puede ser “sin traslado” o una regla sencilla de reposición. Si su costo es cero, reportaremos la diferencia absoluta en vez de un porcentaje. Los márgenes, costos, demanda y resultados deberán identificarse como **supuestos sintéticos**; no son ahorros reales.

## Indicadores complementarios

- **Disponibilidad:** demanda atendida como porcentaje de la demanda total, o unidades no atendidas.
- **Riesgo de caducidad:** unidades o costo estimado de los lotes que caducan dentro del horizonte.
- **Efecto geográfico:** tiempo o costo de ruta por traslado recomendado; comparar también la decisión con la variable geográfica desactivada.
- **Error del pronóstico:** si el conjunto sintético tiene demanda conocida reservada para validación, reportar WAPE en ese periodo. Esta mide el pronóstico, no el beneficio económico.

## Cómo demostrar el impacto sin exagerar

La demo comparará, sobre el mismo escenario sintético:

1. **Sin acción:** no se trasladan productos.
2. **Regla sencilla:** se repone al cruzar un mínimo o desde una sucursal cercana con excedente.
3. **Geo-AI:** se consideran riesgo de demanda, caducidad y tiempo o costo de ruta.

Mostraremos resultados estimados y supuestos visibles. No prometeremos “cero ventas perdidas”, “retención absoluta” ni reducciones “drásticas” sin datos que los demuestren.

## Evidencia según la rúbrica

| Criterio | Peso | Evidencia que prepararemos |
|---|---:|---|
| Propuesta de valor e impacto | 30 | Usuario operativo definido, problema de disponibilidad y reducción estimada de pérdidas frente a la base. |
| Calidad técnica y ejecución | 25 | Demo funcional de extremo a extremo y etiqueta visible de datos y órdenes simuladas. |
| Novedad y diferenciación | 20 | Comparación que muestre el efecto de ubicación, rutas y caducidad sobre la decisión. |
| Viabilidad e implementación | 15 | Lista de datos, permisos e integraciones pendientes para un piloto real. |
| Claridad de presentación y demo | 10 | Caso breve, mapa legible, recomendación explicable y resultado comparativo en el pitch. |

La fórmula de puntaje de cada criterio es `(calificación ÷ 5) × peso`, según la [rúbrica del hackathon](RUBRICA.md).
