import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Pane, TileLayer, useMap } from 'react-leaflet'
import { Activity, AlertCircle, AlertTriangle, Bell, MapPin, PackageCheck, RefreshCw } from 'lucide-react'
import L from 'leaflet'
import './App.css'

const API = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
const CARTO_KEY = import.meta.env.VITE_CARTO_BASEMAPS_KEY?.trim()
const CARTO_TILES = `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : ''}`
const DEFAULT_CENTER = [-0.18, -78.48]
const HEX_RADIUS_METERS = 350
const MIN_HEX_RADIUS_PIXELS = 5.5
const PHARMACY_DOT_RADIUS_PIXELS = 1.7
const PHARMACY_DOT_OUTLINE_RADIUS_PIXELS = 3
const HEX_FIT_PADDING = 30
const HEX_VIEW_BUFFER_RATIO = 0.3
const HEX_VIEW_REFRESH_MARGIN_RATIO = 0.08
const HEAT_INFLUENCE_RADIUS_METERS = 3_000
const HEAT_SIGMA_METERS = 1_450
const EMPTY_ARRAY = []
const METRIC_OPTIONS = [
  { value: 'signal', label: 'Intensidad de señales', low: 'Menor señal', high: 'Mayor señal', note: 'La intensidad baja al alejarse de farmacias con alzas.' },
  { value: 'sales', label: 'Ventas recientes (30 días)', low: 'Menos unidades', high: 'Más unidades', note: 'Escala relativa a los hexágonos visibles; el detalle muestra la cantidad.' },
  { value: 'change', label: 'Aumento frente a la base', low: 'Sin alza', high: 'Mayor alza', note: 'Compara la tasa reciente con los 90 días anteriores.' },
  { value: 'inventory', label: 'Riesgo de inventario', low: 'Menor riesgo', high: 'Mayor riesgo', note: 'Proporción de registros de inventario en estado crítico, bajo o agotado.' },
]
const HEAT_COLOR_STOPS = [
  { score: 0.025, color: '#60a5fa' },
  { score: 0.16, color: '#22d3ee' },
  { score: 0.3, color: '#22c55e' },
  { score: 0.44, color: '#a3e635' },
  { score: 0.58, color: '#facc15' },
  { score: 0.72, color: '#fb923c' },
  { score: 0.86, color: '#ef4444' },
  { score: 1, color: '#991b1b' },
]

const statusDetails = {
  red: { label: 'Alza alta', color: 'var(--status-red)', icon: AlertTriangle },
  yellow: { label: 'Alza observada', color: 'var(--status-yellow)', icon: AlertCircle },
  green: { label: 'Sin señal detectada', color: 'var(--status-green)', icon: PackageCheck },
}

const formatNumber = (value, maximumFractionDigits = 0) => {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('es-EC', { maximumFractionDigits }).format(value)
}

function roundAxial(q, r) {
  const x = q
  const z = r
  const y = -x - z
  let roundedX = Math.round(x)
  let roundedY = Math.round(y)
  let roundedZ = Math.round(z)
  const xDiff = Math.abs(roundedX - x)
  const yDiff = Math.abs(roundedY - y)
  const zDiff = Math.abs(roundedZ - z)

  if (xDiff > yDiff && xDiff > zDiff) roundedX = -roundedY - roundedZ
  else if (yDiff > zDiff) roundedY = -roundedX - roundedZ
  else roundedZ = -roundedX - roundedY

  return { q: roundedX, r: roundedZ }
}

function hexForPoint(x, y, radius) {
  const q = (Math.sqrt(3) / 3 * x - y / 3) / radius
  const r = (2 / 3 * y) / radius
  return roundAxial(q, r)
}

function hexCenter(q, r, radius) {
  return L.point(
    radius * Math.sqrt(3) * (q + r / 2),
    radius * 1.5 * r,
  )
}

function getHexRadius(map, zoom) {
  const latitude = map.getCenter().lat * Math.PI / 180
  const metersPerPixel = 156543.03392804097 * Math.cos(latitude) / (2 ** zoom)
  return Math.max(MIN_HEX_RADIUS_PIXELS, HEX_RADIUS_METERS / metersPerPixel)
}

function getHeatColor(score) {
  const upperIndex = HEAT_COLOR_STOPS.findIndex((stop) => score <= stop.score)
  if (upperIndex <= 0) return HEAT_COLOR_STOPS[0].color

  const lower = HEAT_COLOR_STOPS[upperIndex - 1]
  const upper = HEAT_COLOR_STOPS[upperIndex]
  const ratio = (score - lower.score) / (upper.score - lower.score)
  const from = lower.color.match(/[\da-f]{2}/gi).map((channel) => Number.parseInt(channel, 16))
  const to = upper.color.match(/[\da-f]{2}/gi).map((channel) => Number.parseInt(channel, 16))
  const interpolated = from.map((channel, index) => Math.round(channel + (to[index] - channel) * ratio))

  return `#${interpolated.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function getHeatStyle(score) {
  const boundedScore = Math.max(0, Math.min(score, 1))
  if (boundedScore < 0.025) {
    return { color: '#94a3b8', fillOpacity: 0.055, opacity: 0.28 }
  }
  const normalizedScore = (boundedScore - 0.025) / 0.975
  return {
    color: getHeatColor(boundedScore),
    fillOpacity: 0.12 + normalizedScore * 0.46,
    opacity: 0.4 + normalizedScore * 0.48,
  }
}

function buildHexCells(map, pharmacies, alerts, sectorMetrics) {
  const zoom = map.getZoom()
  const radius = getHexRadius(map, zoom)
  const visibleBounds = map.getPixelBounds()
  const mapSize = map.getSize()
  const bufferX = Math.ceil(mapSize.x * HEX_VIEW_BUFFER_RATIO)
  const bufferY = Math.ceil(mapSize.y * HEX_VIEW_BUFFER_RATIO)
  const viewport = L.bounds(
    L.point(visibleBounds.min.x - bufferX, visibleBounds.min.y - bufferY),
    L.point(visibleBounds.max.x + bufferX, visibleBounds.max.y + bufferY),
  )
  const viewportCorners = [
    viewport.min,
    L.point(viewport.max.x, viewport.min.y),
    viewport.max,
    L.point(viewport.min.x, viewport.max.y),
  ]
  const cornerHexes = viewportCorners.map((point) => {
    const q = (Math.sqrt(3) / 3 * point.x - point.y / 3) / radius
    const r = (2 / 3 * point.y) / radius
    return { q, r }
  })
  const minQ = Math.floor(Math.min(...cornerHexes.map((hex) => hex.q))) - 2
  const maxQ = Math.ceil(Math.max(...cornerHexes.map((hex) => hex.q))) + 2
  const minR = Math.floor(Math.min(...cornerHexes.map((hex) => hex.r))) - 2
  const maxR = Math.ceil(Math.max(...cornerHexes.map((hex) => hex.r))) + 2
  const halfWidth = radius * Math.sqrt(3) / 2
  const bins = new Map()

  for (let q = minQ; q <= maxQ; q += 1) {
    for (let r = minR; r <= maxR; r += 1) {
      const center = hexCenter(q, r, radius)
      if (
        center.x + halfWidth < viewport.min.x
        || center.x - halfWidth > viewport.max.x
        || center.y + radius < viewport.min.y
        || center.y - radius > viewport.max.y
      ) continue

      const key = `${q}:${r}`
      bins.set(key, {
        id: key,
        q,
        r,
        center,
        pharmacyCount: 0,
        recentUnits: 0,
        inventoryRecordCount: 0,
        inventoryRiskCount: 0,
        inventoryCoverageTotal: 0,
        inventoryItems: [],
        sectors: new Set(),
      })
    }
  }

  const latitude = map.getCenter().lat * Math.PI / 180
  const metersPerPixel = 156543.03392804097 * Math.cos(latitude) / (2 ** zoom)
  const activeSources = []
  pharmacies.forEach((pharmacy) => {
    if (!Number.isFinite(pharmacy.lat) || !Number.isFinite(pharmacy.lng)) return

    const point = map.project([pharmacy.lat, pharmacy.lng], zoom)
    const cellIndex = hexForPoint(point.x, point.y, radius)
    const key = `${cellIndex.q}:${cellIndex.r}`
    const cell = bins.get(key)

    if (cell) {
      cell.pharmacyCount += 1
      cell.recentUnits += Number.isFinite(pharmacy.recentUnits) ? pharmacy.recentUnits : 0
      cell.sectors.add(pharmacy.sectorId)
      const inventorySummary = pharmacy.inventorySummary || {}
      cell.inventoryRecordCount += inventorySummary.recordCount || 0
      cell.inventoryRiskCount += inventorySummary.riskCount || 0
      cell.inventoryCoverageTotal += (inventorySummary.averageCoverageDays || 0) * (inventorySummary.recordCount || 0)
      cell.inventoryItems.push(...(pharmacy.inventory || []))
    }
    if (pharmacy.status === 'red') {
      activeSources.push({ pharmacy, x: point.x, y: point.y, strength: 1 })
    } else if (pharmacy.status === 'yellow') {
      activeSources.push({ pharmacy, x: point.x, y: point.y, strength: 0.62 })
    }
  })

  const alertsBySector = new Map()
  alerts.forEach((alert) => {
    const sectorAlerts = alertsBySector.get(alert.sector) || []
    sectorAlerts.push(alert)
    alertsBySector.set(alert.sector, sectorAlerts)
  })

  const maxDistanceSquared = (HEAT_INFLUENCE_RADIUS_METERS / metersPerPixel) ** 2
  const sigmaFactor = 2 * (HEAT_SIGMA_METERS / metersPerPixel) ** 2
  const metricBySector = new Map(sectorMetrics.map((item) => [item.sectorId, item]))
  const sourceBucketSize = Math.sqrt(maxDistanceSquared)
  const sourceBuckets = new Map()
  activeSources.forEach((source) => {
    const bucketId = `${Math.floor(source.x / sourceBucketSize)}:${Math.floor(source.y / sourceBucketSize)}`
    const bucket = sourceBuckets.get(bucketId) || []
    bucket.push(source)
    sourceBuckets.set(bucketId, bucket)
  })

  const cells = [...bins.values()].map((cell) => {
    let remainingIntensity = 1
    let nearbySignalCount = 0
    const nearbySectorIntensity = new Map()
    const bucketX = Math.floor(cell.center.x / sourceBucketSize)
    const bucketY = Math.floor(cell.center.y / sourceBucketSize)

    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const candidates = sourceBuckets.get(`${bucketX + offsetX}:${bucketY + offsetY}`) || EMPTY_ARRAY
        candidates.forEach((source) => {
          const dx = cell.center.x - source.x
          const dy = cell.center.y - source.y
          const distanceSquared = dx * dx + dy * dy
          if (distanceSquared > maxDistanceSquared) return

          const contribution = source.strength * Math.exp(-distanceSquared / sigmaFactor)
          if (contribution < 0.025) return
          remainingIntensity *= 1 - contribution
          nearbySignalCount += 1
          if (source.pharmacy.sectorId) {
            nearbySectorIntensity.set(
              source.pharmacy.sectorId,
              Math.max(nearbySectorIntensity.get(source.pharmacy.sectorId) || 0, contribution),
            )
          }
        })
      }
    }

    const nearbySectors = [...nearbySectorIntensity.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([sector]) => sector)
    const sectors = [...cell.sectors].filter(Boolean).sort((a, b) => a.localeCompare(b))
    const sectorChanges = sectors
      .map((sector) => metricBySector.get(sector)?.changePercent)
      .filter(Number.isFinite)
    const changePercent = sectorChanges.length ? Math.max(...sectorChanges) : null
    const cellAlerts = [...new Map(
      nearbySectors
        .flatMap((sector) => alertsBySector.get(sector) || [])
        .map((alert) => [alert.id, alert]),
    ).values()]

    return {
      ...cell,
      sectors,
      nearbySectors,
      nearbySignalCount,
      alerts: cellAlerts,
      signalScore: 1 - remainingIntensity,
      changePercent,
      inventoryRiskPercent: cell.inventoryRecordCount
        ? cell.inventoryRiskCount / cell.inventoryRecordCount * 100
        : null,
      averageCoverageDays: cell.inventoryRecordCount
        ? cell.inventoryCoverageTotal / cell.inventoryRecordCount
        : null,
    }
  })

  const maxRecentUnits = cells.reduce((maximum, cell) => Math.max(maximum, cell.recentUnits), 0)
  const cellsById = new Map(cells.map((cell) => [cell.id, cell]))
  return { cells, cellsById, radius, zoom, maxRecentUnits, bounds: viewport, bufferX, bufferY }
}

function getCellScore(cell, metric, maxRecentUnits) {
  if (metric === 'sales') return maxRecentUnits ? cell.recentUnits / maxRecentUnits : 0
  if (metric === 'change') return Math.max(0, Math.min((cell.changePercent || 0) / 200, 1))
  if (metric === 'inventory') return Math.max(0, Math.min((cell.inventoryRiskPercent || 0) / 100, 1))
  return cell.signalScore
}

function createMapPopup(cell) {
  const content = document.createElement('div')
  content.className = 'map-popup'
  const heading = document.createElement('h3')
  heading.textContent = 'Detalle del hexágono'
  content.append(heading)

  const hasRecordedData = cell.pharmacyCount > 0
    || cell.recentUnits > 0
    || cell.inventoryRecordCount > 0
    || cell.nearbySignalCount > 0
    || cell.alerts.length > 0
  if (!hasRecordedData) {
    content.classList.add('map-popup-empty')
    const message = document.createElement('p')
    message.textContent = 'Sin farmacias, ventas ni inventario registrados en esta celda.'
    content.append(message)
    return content
  }

  const addLine = (label, value) => {
    const paragraph = document.createElement('p')
    const strong = document.createElement('strong')
    strong.textContent = `${label}: `
    paragraph.append(strong, document.createTextNode(String(value)))
    content.append(paragraph)
  }

  addLine('Sectores', cell.sectors.join(', ') || 'Sin farmacia')
  addLine('Farmacias en la celda', formatNumber(cell.pharmacyCount))
  addLine('Unidades vendidas en 30 días', formatNumber(cell.recentUnits, 1))
  addLine('Variación máxima frente a la base', cell.changePercent === null ? 'Sin base suficiente' : `${cell.changePercent > 0 ? '+' : ''}${formatNumber(cell.changePercent, 1)}%`)
  addLine('Productos en inventario', formatNumber(cell.inventoryRecordCount))
  addLine('Inventario con riesgo', cell.inventoryRiskPercent === null ? 'Sin datos' : `${formatNumber(cell.inventoryRiskPercent, 1)}%`)
  addLine('Cobertura promedio', cell.averageCoverageDays === null ? 'Sin datos' : `${formatNumber(cell.averageCoverageDays, 1)} días`)

  const inventoryRows = [...cell.inventoryItems]
    .sort((a, b) => ({ Agotado: 0, Crítico: 1, Bajo: 2 }[a.status] ?? 3) - ({ Agotado: 0, Crítico: 1, Bajo: 2 }[b.status] ?? 3) || a.daysCoverage - b.daysCoverage)
    .slice(0, 6)
  if (inventoryRows.length) {
    const inventoryHeading = document.createElement('strong')
    inventoryHeading.textContent = 'Inventario por producto'
    content.append(inventoryHeading)
    const list = document.createElement('ul')
    list.className = 'hex-alert-list'
    inventoryRows.forEach((item) => {
      const row = document.createElement('li')
      row.textContent = `${item.productName} · ${item.status}: ${formatNumber(item.stockActual)} / ${formatNumber(item.stockMinimum)} uds. · ${formatNumber(item.daysCoverage, 1)} días`
      list.append(row)
    })
    content.append(list)
  }

  if (cell.alerts.length) {
    const alertsHeading = document.createElement('strong')
    alertsHeading.textContent = 'Señales cercanas'
    content.append(alertsHeading)
    const list = document.createElement('ul')
    list.className = 'hex-alert-list'
    cell.alerts.slice(0, 5).forEach((alert) => {
      const row = document.createElement('li')
      row.textContent = `${alert.sector} · ${alert.category}: +${formatNumber(alert.changePercent, 1)}%`
      list.append(row)
    })
    content.append(list)
  }
  return content
}

function createPharmacyPopup(alert, pharmacy) {
  const content = document.createElement('div')
  content.className = 'map-popup pharmacy-popup'
  const heading = document.createElement('h3')
  heading.textContent = pharmacy.name || 'Farmacia'
  content.append(heading)

  const subtitle = document.createElement('p')
  subtitle.className = 'popup-subtitle'
  subtitle.textContent = `${alert.category} · ${alert.sector}`
  content.append(subtitle)

  const addLine = (label, value) => {
    const paragraph = document.createElement('p')
    const strong = document.createElement('strong')
    strong.textContent = `${label}: `
    paragraph.append(strong, document.createTextNode(String(value)))
    content.append(paragraph)
  }

  addLine('Aumento del sector', `+${formatNumber(alert.changePercent, 1)}%`)
  addLine('Ventas de esta farmacia (30 días)', `${formatNumber(pharmacy.recentUnits, 1)} uds.`)
  addLine(
    'Exceso estimado en esta farmacia',
    `${pharmacy.excessUnits > 0 ? '+' : ''}${formatNumber(pharmacy.excessUnits, 1)} uds. sobre ${formatNumber(pharmacy.expectedUnits, 1)} esperadas`,
  )

  const inventorySummary = pharmacy.inventorySummary
  if (inventorySummary?.recordCount) {
    addLine('Inventario en riesgo', `${formatNumber(inventorySummary.riskCount)} de ${formatNumber(inventorySummary.recordCount)} productos`)
    if (inventorySummary.averageCoverageDays !== null) {
      addLine('Cobertura promedio', `${formatNumber(inventorySummary.averageCoverageDays, 1)} días`)
    }
  }
  return content
}

function HexHeatmapLayer({ pharmacies, alerts, sectorMetrics, metric, heatOpacity, focusRequest }) {
  const map = useMap()
  const [grid, setGrid] = useState(() => buildHexCells(map, pharmacies, alerts, sectorMetrics))
  const drawRef = useRef(null)
  const gridRef = useRef(grid)
  const metricRef = useRef(metric)
  const opacityRef = useRef(heatOpacity)

  useEffect(() => {
    const alert = focusRequest?.alert
    const pharmacy = alert?.leadPharmacy
    if (!pharmacy || !Number.isFinite(pharmacy.lat) || !Number.isFinite(pharmacy.lng)) return undefined

    const coordinates = [pharmacy.lat, pharmacy.lng]
    const marker = L.circleMarker(coordinates, {
      radius: 9,
      color: '#c2410c',
      weight: 3,
      fillColor: '#fff7ed',
      fillOpacity: 1,
      pane: 'markerPane',
      interactive: false,
    }).addTo(map)
    marker.bringToFront()

    const popup = L.popup({
      maxWidth: 290,
      minWidth: 210,
      autoPanPadding: [18, 18],
      pane: 'popupPane',
      className: 'heatmap-popup pharmacy-focus-popup',
    })
      .setLatLng(coordinates)
      .setContent(createPharmacyPopup(alert, pharmacy))

    const target = L.latLng(coordinates)
    const targetZoom = Math.max(map.getZoom(), 15)
    const openPopup = () => popup.openOn(map)
    if (target.distanceTo(map.getCenter()) > 1 || map.getZoom() !== targetZoom) {
      map.once('moveend', openPopup)
      map.flyTo(coordinates, targetZoom, { duration: 0.7 })
    } else {
      openPopup()
    }

    return () => {
      map.off('moveend', openPopup)
      marker.remove()
      if (map.hasLayer(popup)) map.closePopup(popup)
    }
  }, [map, focusRequest])

  useEffect(() => {
    gridRef.current = grid
    metricRef.current = metric
    opacityRef.current = heatOpacity
    drawRef.current?.()
  }, [grid, metric, heatOpacity])

  useEffect(() => {
    let frameId = 0
    const refreshHexGrid = () => {
      if (frameId) return
      frameId = window.requestAnimationFrame(() => {
        frameId = 0
        setGrid(buildHexCells(map, pharmacies, alerts, sectorMetrics))
      })
    }
    const refreshWhenNearGridEdge = () => {
      const grid = gridRef.current
      if (!grid?.bounds) {
        refreshHexGrid()
        return
      }
      const visibleBounds = map.getPixelBounds()
      const size = map.getSize()
      const horizontalMargin = Math.min(
        visibleBounds.min.x - grid.bounds.min.x,
        grid.bounds.max.x - visibleBounds.max.x,
      )
      const verticalMargin = Math.min(
        visibleBounds.min.y - grid.bounds.min.y,
        grid.bounds.max.y - visibleBounds.max.y,
      )
      if (
        horizontalMargin < size.x * HEX_VIEW_REFRESH_MARGIN_RATIO
        || verticalMargin < size.y * HEX_VIEW_REFRESH_MARGIN_RATIO
      ) refreshHexGrid()
    }

    map.on('zoomend', refreshHexGrid)
    map.on('moveend', refreshHexGrid)
    map.on('resize', refreshHexGrid)
    map.on('move', refreshWhenNearGridEdge)
    refreshHexGrid()
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      map.off('zoomend', refreshHexGrid)
      map.off('moveend', refreshHexGrid)
      map.off('resize', refreshHexGrid)
      map.off('move', refreshWhenNearGridEdge)
    }
  }, [map, pharmacies, alerts, sectorMetrics])

  useEffect(() => {
    const canvas = L.DomUtil.create('canvas', 'hex-heat-canvas')
    canvas.style.position = 'absolute'
    canvas.style.left = '0'
    canvas.style.top = '0'
    canvas.style.pointerEvents = 'none'
    map.getPanes().overlayPane.appendChild(canvas)

    const drawCanvas = () => {
      const size = map.getSize()
      const currentGrid = gridRef.current
      const bufferX = currentGrid?.bufferX || 0
      const bufferY = currentGrid?.bufferY || 0
      const canvasWidth = size.x + bufferX * 2
      const canvasHeight = size.y + bufferY * 2
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.round(canvasWidth * pixelRatio))
      canvas.height = Math.max(1, Math.round(canvasHeight * pixelRatio))
      canvas.style.width = `${canvasWidth}px`
      canvas.style.height = `${canvasHeight}px`

      const context = canvas.getContext('2d')
      if (!context) return
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, canvasWidth, canvasHeight)
      const canvasOrigin = map.containerPointToLayerPoint([0, 0]).subtract([bufferX, bufferY])
      L.DomUtil.setPosition(canvas, canvasOrigin)
      const activeMetric = metricRef.current
      const activeOpacity = opacityRef.current

      currentGrid.cells.forEach((cell) => {
        const style = getHeatStyle(getCellScore(cell, activeMetric, currentGrid.maxRecentUnits))
        const centerPoint = map.latLngToLayerPoint(map.unproject(cell.center, currentGrid.zoom))
        const centerX = centerPoint.x - canvasOrigin.x
        const centerY = centerPoint.y - canvasOrigin.y
        context.beginPath()
        for (let index = 0; index < 6; index += 1) {
          const angle = (Math.PI / 180) * (60 * index - 30)
          const x = centerX + currentGrid.radius * Math.cos(angle)
          const y = centerY + currentGrid.radius * Math.sin(angle)
          if (index === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        }
        context.closePath()
        context.fillStyle = style.color
        context.globalAlpha = style.fillOpacity * activeOpacity
        context.fill()
        context.strokeStyle = style.color
        context.lineWidth = 1
        context.globalAlpha = style.opacity * activeOpacity
        context.stroke()
        if (cell.pharmacyCount > 0) {
          context.beginPath()
          context.arc(centerX, centerY, PHARMACY_DOT_OUTLINE_RADIUS_PIXELS, 0, Math.PI * 2)
          context.fillStyle = '#fff'
          context.globalAlpha = 1
          context.fill()
          context.beginPath()
          context.arc(centerX, centerY, PHARMACY_DOT_RADIUS_PIXELS, 0, Math.PI * 2)
          context.fillStyle = '#0f172a'
          context.fill()
        }
      })
      context.globalAlpha = 1
    }

    const handleMapClick = (event) => {
      const currentGrid = gridRef.current
      const point = map.project(event.latlng, currentGrid.zoom)
      const index = hexForPoint(point.x, point.y, currentGrid.radius)
      const cell = currentGrid.cellsById.get(`${index.q}:${index.r}`)
      if (!cell) return
      const emptyCell = cell.pharmacyCount === 0
        && cell.recentUnits === 0
        && cell.inventoryRecordCount === 0
        && cell.nearbySignalCount === 0
        && cell.alerts.length === 0
      L.popup({
        maxWidth: emptyCell ? 220 : 310,
        autoPanPaddingTopLeft: [18, 18],
        autoPanPaddingBottomRight: [18, 18],
        pane: 'popupPane',
        className: `heatmap-popup${emptyCell ? ' heatmap-popup-empty' : ''}`,
      })
        .setLatLng(event.latlng)
        .setContent(createMapPopup(cell))
        .openOn(map)
    }

    map.on('click', handleMapClick)
    drawRef.current = drawCanvas
    drawCanvas()
    return () => {
      map.off('click', handleMapClick)
      canvas.remove()
      drawRef.current = null
    }
  }, [map])

  return null
}

function FitMapToPharmacies({ pharmacies }) {
  const map = useMap()
  const fittedCoordinates = useRef('')
  const coordinateKey = pharmacies
    .filter((pharmacy) => Number.isFinite(pharmacy.lat) && Number.isFinite(pharmacy.lng))
    .map((pharmacy) => `${pharmacy.id}:${pharmacy.lat},${pharmacy.lng}`)
    .join('|')

  useEffect(() => {
    if (!coordinateKey || coordinateKey === fittedCoordinates.current) return
    fittedCoordinates.current = coordinateKey
    const coordinates = pharmacies
      .filter((pharmacy) => Number.isFinite(pharmacy.lat) && Number.isFinite(pharmacy.lng))
      .map((pharmacy) => [pharmacy.lat, pharmacy.lng])

    if (coordinates.length === 1) map.setView(coordinates[0], 13)
    if (coordinates.length > 1) {
      map.fitBounds(L.latLngBounds(coordinates), { padding: [HEX_FIT_PADDING, HEX_FIT_PADDING], maxZoom: 13 })
    }
  }, [coordinateKey, map, pharmacies])

  return null
}

function MapStatusOverlay({ error, dashboard, loading, hasPendingChanges, lastUpdated }) {
  const map = useMap()
  const statusRef = useRef(null)
  const [size, setSize] = useState(() => map.getSize())

  useEffect(() => {
    const alignWithViewport = () => {
      if (!statusRef.current) return
      const panePosition = L.DomUtil.getPosition(map.getPanes().mapPane)
      L.DomUtil.setPosition(statusRef.current, panePosition.multiplyBy(-1))
    }
    const updateSize = () => setSize(map.getSize())

    map.on('move', alignWithViewport)
    map.on('moveend', alignWithViewport)
    map.on('resize', updateSize)
    alignWithViewport()
    return () => {
      map.off('move', alignWithViewport)
      map.off('moveend', alignWithViewport)
      map.off('resize', updateSize)
    }
  }, [map])

  return (
    <Pane
      name="analysisStatusPane"
      style={{ zIndex: 650, width: `${size.x}px`, height: `${size.y}px`, pointerEvents: 'none' }}
    >
      <div ref={statusRef} className={`map-refresh-status${error ? ' stale' : ''}`} aria-live="polite">
        <span className={`refresh-indicator${loading ? ' loading' : ''}`} />
        <span>
          {error && dashboard ? 'Mostrando datos anteriores' : error ? 'Datos no disponibles' : loading ? 'Actualizando análisis' : hasPendingChanges ? 'Filtros pendientes de aplicar' : 'Análisis actualizado'}
          {lastUpdated && ` · ${lastUpdated.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`}
        </span>
      </div>
    </Pane>
  )
}

const CollapsibleCard = ({ title, icon: Icon, iconColor, children, className = '', defaultOpen = false, extraHeader }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`glass-card ${className}`} style={{ flex: isOpen && className.includes('alert-card') ? 1 : 'none' }}>
      <h2 className="card-title" onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer', marginBottom: isOpen ? '1rem' : '0' }}>
        <span className="alert-title-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {Icon && <Icon size={20} color={iconColor} />} {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {extraHeader}
          <span style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s', fontSize: '0.8rem' }}>▼</span>
        </div>
      </h2>
      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minHeight: 0, overflow: className.includes('alert-card') ? 'hidden' : 'visible' }}>
          {children}
        </div>
      )}
    </div>
  );
};

function App() {
  const [dashboard, setDashboard] = useState(null)
  const [draftCategory, setDraftCategory] = useState('')
  const [draftMetric, setDraftMetric] = useState('signal')
  const [analysisFilters, setAnalysisFilters] = useState({ category: '', metric: 'signal' })
  const [heatOpacity, setHeatOpacity] = useState(0.82)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [toasts, setToasts] = useState([])
  const [mapFocusRequest, setMapFocusRequest] = useState(null)
  const previousAlerts = useRef(null)

  useEffect(() => {
    let active = true

    const loadDashboard = async () => {
      setLoading(true)
      const params = new URLSearchParams()
      if (analysisFilters.category) params.set('category', analysisFilters.category)
      const query = params.size ? `?${params.toString()}` : ''
      try {
        const response = await fetch(`${API}/dashboard${query}`)
        const payload = await response.json()
        if (!response.ok) {
          const missing = payload.error?.missingFiles?.length
            ? ` Archivos faltantes: ${payload.error.missingFiles.join(', ')}.`
            : ''
          throw new Error(`${payload.error?.message || 'No se pudo cargar el análisis.'}${missing}`)
        }
        if (!active) return
        setDashboard(payload)
        setLastUpdated(new Date())
        setError('')
      } catch (requestError) {
        if (!active) return
        setError(requestError.message || 'No se pudo conectar con el backend.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()
    return () => { active = false }
  }, [analysisFilters, reloadToken])

  useEffect(() => {
    if (!dashboard) return
    const currentAlerts = new Set(dashboard.alerts.map((alert) => alert.id))
    if (previousAlerts.current) {
      const newAlert = dashboard.alerts.find((alert) => !previousAlerts.current.has(alert.id))
      if (newAlert) {
        const id = `${Date.now()}-${newAlert.id}`
        setToasts((current) => [...current, {
          id,
          title: 'Señal de ventas detectada',
          message: `${newAlert.category} registra un aumento en ${newAlert.sector}.`,
          status: newAlert.status,
        }])
        window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5000)
      }
    }
    previousAlerts.current = currentAlerts
  }, [dashboard])

  const pharmacies = dashboard?.pharmacies || EMPTY_ARRAY
  const alerts = dashboard?.alerts || EMPTY_ARRAY
  const sectorMetrics = dashboard?.sectorMetrics || EMPTY_ARRAY
  const inventorySectors = dashboard?.inventorySectors || EMPTY_ARRAY
  const inventoryAlerts = dashboard?.inventoryAlerts || EMPTY_ARRAY
  const categories = dashboard?.categories || EMPTY_ARRAY
  const metricDetails = METRIC_OPTIONS.find((option) => option.value === analysisFilters.metric) || METRIC_OPTIONS[0]
  const hasPendingChanges = (
    draftCategory !== analysisFilters.category
    || draftMetric !== analysisFilters.metric
  )
  const stats = dashboard?.stats || {
    totalPharmacies: 0,
    sectorsWithSignals: 0,
    highSignalCount: 0,
    alertCount: 0,
    inventoryRecordCount: 0,
    inventoryRiskCount: 0,
    inventoryOutOfStockCount: 0,
    inventoryCriticalCount: 0,
    inventoryLowCount: 0,
  }
  const hasInventoryData = inventorySectors.length > 0 || stats.inventoryRecordCount > 0
  const mapCenter = useMemo(() => {
    const first = pharmacies.find((pharmacy) => Number.isFinite(pharmacy.lat) && Number.isFinite(pharmacy.lng))
    return first ? [first.lat, first.lng] : DEFAULT_CENTER
  }, [pharmacies])

  return (
    <div className="app-container">
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = statusDetails[toast.status]?.icon || Bell
          return (
            <div key={toast.id} className={`toast toast-${toast.status}`}>
              <Icon className="toast-icon" size={24} color={statusDetails[toast.status]?.color} />
              <div className="toast-content">
                <div className="toast-title">{toast.title}</div>
                <div className="toast-desc">{toast.message}</div>
              </div>
            </div>
          )
        })}
      </div>

      <header className="header">
        <div className="brand">
          <img src="/logo.png" alt="FarmaSeñal Logo" className="brand-icon" style={{ height: '28px', width: 'auto' }} />
          FarmaSeñal Corporativo
        </div>
        <div className="header-caption">
          <span><Bell size={16} /> Señales de ventas agregadas por sector</span>
          <button
            type="button"
            className="header-refresh-button"
            onClick={() => {
              setAnalysisFilters({ category: draftCategory, metric: draftMetric })
              setReloadToken((value) => value + 1)
            }}
            disabled={loading}
          >
            <RefreshCw size={16} />
            {loading ? 'Actualizando…' : hasPendingChanges ? 'Aplicar y actualizar' : 'Actualizar análisis'}
          </button>
          {dashboard?.dataStatus === 'synthetic' && <span className="data-badge">DATOS SINTÉTICOS</span>}
        </div>
      </header>

      <main className="main-content">
        <div className="map-container">
          <MapContainer
            center={mapCenter}
            zoom={11}
            zoomAnimation={false}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution/">CARTO</a>'
              url={CARTO_TILES}
            />
            <MapStatusOverlay
              error={error}
              dashboard={dashboard}
              loading={loading}
              hasPendingChanges={hasPendingChanges}
              lastUpdated={lastUpdated}
            />
            <FitMapToPharmacies pharmacies={pharmacies} />
            <HexHeatmapLayer
              pharmacies={pharmacies}
              alerts={alerts}
              sectorMetrics={sectorMetrics}
              metric={analysisFilters.metric}
              heatOpacity={heatOpacity}
              focusRequest={mapFocusRequest}
            />
          </MapContainer>
          <div className="map-opacity-panel">
            <label htmlFor="map-heat-opacity">
              Opacidad del calor <strong>{formatNumber(heatOpacity * 100)}%</strong>
            </label>
            <input
              id="map-heat-opacity"
              className="heat-opacity-control"
              type="range"
              min="0.15"
              max="1"
              step="0.05"
              value={heatOpacity}
              onChange={(event) => setHeatOpacity(Number(event.target.value))}
              aria-label="Opacidad del mapa de calor"
            />
            <div className="range-end-labels"><span>Más mapa base</span><span>Más calor</span></div>
          </div>
          <div className="hex-legend" role="region" tabIndex={0} aria-label={`Leyenda: ${metricDetails.label}`}>
            <strong>{metricDetails.label}</strong>
            <i className="heat-gradient" aria-hidden="true" />
            <div className="hex-legend-details">
              <span><i className="legend-swatch no-signal" />Sin dato o valor mínimo</span>
              <div className="heat-scale-labels"><span>{metricDetails.low}</span><span>{metricDetails.high}</span></div>
              <span><i className="legend-pharmacy-dot" />Farmacia en el centro del hexágono</span>
              <small>{metricDetails.note}</small>
              <small>El mapa base permanece visible bajo los hexágonos.</small>
              <small>Los datos cambian al pulsar “Actualizar análisis”.</small>
            </div>
          </div>
          {!loading && !error && pharmacies.length === 0 && (
            <div className="map-empty-state">No hay farmacias en el dataset.</div>
          )}
        </div>

        <aside className="panel">
          {error && (
            <div className="data-message error-message" role="alert">
              <strong>No se pudo cargar el análisis</strong>
              <span>{error}</span>
              <button type="button" onClick={() => setReloadToken((value) => value + 1)}>
                <RefreshCw size={16} /> Reintentar
              </button>
            </div>
          )}

          <CollapsibleCard
            title="Aumentos por sector"
            icon={AlertTriangle}
            iconColor="var(--status-red)"
            className="alert-card"
            extraHeader={<span className="alert-count" style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>{alerts.length} señales</span>}
          >
            <div className="alert-list">
              {loading && !dashboard ? (
                <div className="empty-alert">Calculando señales…</div>
              ) : alerts.length === 0 ? (
                <div className="empty-alert healthy-state">
                  <PackageCheck size={36} />
                  <span>No se detectaron aumentos que superen los criterios del análisis.</span>
                </div>
              ) : (
                alerts.map((alert) => {
                  const status = alert.status === 'red' ? 'red' : 'yellow'
                  const leadPharmacy = alert.leadPharmacy
                  const hasCoordinates = Number.isFinite(leadPharmacy?.lat) && Number.isFinite(leadPharmacy?.lng)
                  return (
                    <button
                      key={alert.id}
                      type="button"
                      className={`alert-item alert-item-button ${status}`}
                      disabled={!hasCoordinates}
                      aria-label={hasCoordinates
                        ? `Ver ${leadPharmacy.name}, en ${alert.sector}, con aumento de ${formatNumber(alert.changePercent, 1)} por ciento en ${alert.category}`
                        : `Farmacia sin ubicación para la señal de ${alert.sector}`}
                      title="Ver esta farmacia en el mapa"
                      onClick={() => setMapFocusRequest({ alert })}
                    >
                      <span className="alert-header">
                        <span className="alert-title">{alert.sector}</span>
                        <span className={`alert-badge badge-${status}`}>
                          {statusDetails[status].label}
                        </span>
                      </span>
                      <span className="alert-metric">
                        <span className="alert-category">{alert.category}</span>
                        <span className={`metric-value ${status}`}>
                          +{formatNumber(alert.changePercent)}%
                        </span>
                      </span>
                      <span className="alert-location">
                        <MapPin size={13} aria-hidden="true" />
                        <span>{leadPharmacy?.name || 'Ubicación no disponible'}</span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Filtros" className="product-card">
            <label className="product-filter" htmlFor="category-select">Categoría de producto</label>
            <select
              id="category-select"
              value={draftCategory}
              onChange={(event) => setDraftCategory(event.target.value)}
              disabled={loading || !categories.length}
            >
              <option value="">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>

            <label className="product-filter" htmlFor="metric-select">El color representa</label>
            <select
              id="metric-select"
              value={draftMetric}
              onChange={(event) => setDraftMetric(event.target.value)}
              disabled={loading}
            >
              {METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            {hasPendingChanges && <span className="pending-analysis">La categoría y la métrica se aplican al actualizar. La opacidad cambia al instante.</span>}
          </CollapsibleCard>

          <CollapsibleCard
            title="Inventario por sector"
            icon={PackageCheck}
            iconColor="var(--status-red)"
            extraHeader={(
              <span className="alert-count">
                {hasInventoryData
                  ? `${formatNumber(inventorySectors.length)} sectores · ${formatNumber(stats.inventoryRiskCount)} en riesgo`
                  : 'Sin datos'}
              </span>
            )}
          >
            {hasInventoryData ? (
              <>
                <div className="stats-grid inventory-stats-grid">
                  <div className="stat-box">
                    <span className="stat-label">Agotados</span>
                    <span className="stat-value inventory-out-value">{formatNumber(stats.inventoryOutOfStockCount)}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Críticos</span>
                    <span className="stat-value inventory-critical-value">{formatNumber(stats.inventoryCriticalCount)}</span>
                  </div>
                  <div className="stat-box">
                    <span className="stat-label">Bajos</span>
                    <span className="stat-value inventory-low-value">{formatNumber(stats.inventoryLowCount)}</span>
                  </div>
                </div>
                <div className="inventory-sector-list">
                  {inventorySectors.slice(0, 5).map((sector) => (
                    <div className="inventory-sector-row" key={sector.sectorId}>
                      <span>{sector.sectorId}</span>
                      <strong>{formatNumber(sector.riskPercent, 1)}%</strong>
                      <small>{formatNumber(sector.riskCount)} de {formatNumber(sector.recordCount)} registros en riesgo · {formatNumber(sector.averageCoverageDays, 1)} días promedio</small>
                    </div>
                  ))}
                </div>
                <div className="inventory-alert-list">
                  <strong>Alertas prioritarias</strong>
                  {inventoryAlerts.length === 0 ? (
                    <span className="empty-alert">No hay registros de inventario en riesgo con estos filtros.</span>
                  ) : inventoryAlerts.slice(0, 8).map((item) => (
                    <article className={`inventory-alert-item stock-${item.status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`} key={item.id || `${item.pharmacyId}-${item.productId}`}>
                      <span className="inventory-alert-sector">{item.sectorId} · {item.pharmacyName}</span>
                      <strong>{item.productName} · {item.status}</strong>
                      <small>{formatNumber(item.stockActual)} / {formatNumber(item.stockMinimum)} uds. · {formatNumber(item.daysCoverage, 1)} días de cobertura</small>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="inventory-empty-state">
                <strong>El inventario no llegó al tablero</strong>
                <span>No se recibieron registros de inventario para los filtros actuales.</span>
                <span>Reinicia <code>python backend/local_server.py</code> desde la raíz del proyecto y pulsa «Actualizar análisis».</span>
              </div>
            )}
          </CollapsibleCard>

          <CollapsibleCard title="Señal epidemiológica orientativa" icon={Activity} iconColor="var(--status-red)">
            <p className="epidemiological-summary">
              Variación de ventas por sector y categoría para priorizar una revisión. Estos datos no identifican una enfermedad.
            </p>
            {alerts.length === 0 ? (
              <div className="empty-alert">No se detectaron aumentos con el filtro aplicado.</div>
            ) : (
              <div className="epidemiological-list">
                {alerts.slice(0, 5).map((alert) => (
                  <article className={`epidemiological-item ${alert.status === 'red' ? 'high' : 'watch'}`} key={alert.id}>
                    <div><strong>{alert.sector}</strong><span>{alert.category}</span></div>
                    <strong>+{formatNumber(alert.changePercent, 1)}%</strong>
                    <small>{formatNumber(alert.recentUnits)} uds. en 30 días frente a {formatNumber(alert.baselineUnits)} en 90 días</small>
                    <small className="epidemiological-possibility">Ejemplos para revisar (no inferidos de esta señal): influenza, COVID-19 y VRS.</small>
                  </article>
                ))}
              </div>
            )}
            <div className="prediction-disclaimer">
              La variación de ventas por sí sola no identifica una enfermedad ni confirma un brote. Para valorar afecciones se requieren datos epidemiológicos autorizados y una asociación validada por especialistas.
            </div>
          </CollapsibleCard>

          <span className="signal-disclaimer">
            Un aumento de ventas es una señal comercial; no diagnostica ni confirma enfermedades.
          </span>
        </aside>
      </main>
    </div>
  )
}

export default App
