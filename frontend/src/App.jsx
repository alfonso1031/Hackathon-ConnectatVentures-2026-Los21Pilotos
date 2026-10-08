import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Polygon, Popup, TileLayer, useMap } from 'react-leaflet'
import { Activity, AlertCircle, AlertTriangle, Bell, PackageCheck, RefreshCw, Zap } from 'lucide-react'
import L from 'leaflet'
import './App.css'

const API = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
const CARTO_KEY = import.meta.env.VITE_CARTO_BASEMAPS_KEY?.trim()
const CARTO_TILES = `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : ''}`
const DEFAULT_CENTER = [-0.18, -78.48]
const HEX_RADIUS_METERS = 350
const MIN_HEX_RADIUS_PIXELS = 5.5
const HEX_FIT_PADDING = 30
const HEAT_INFLUENCE_RADIUS_METERS = 3_000
const HEAT_SIGMA_METERS = 1_450
const AUTO_REFRESH_MS = 30_000
const EMPTY_ARRAY = []
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
  if (score < 0.025) {
    return { color: '#94a3b8', fillOpacity: 0.055, opacity: 0.28 }
  }
  const normalizedScore = (score - 0.025) / 0.975
  return {
    color: getHeatColor(score),
    fillOpacity: 0.12 + normalizedScore * 0.46,
    opacity: 0.4 + normalizedScore * 0.48,
  }
}

function buildHexCells(map, pharmacies, alerts) {
  const zoom = map.getZoom()
  const radius = getHexRadius(map, zoom)
  const viewport = map.getPixelBounds()
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
        sectors: new Set(),
      })
    }
  }

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
    }
    const location = L.latLng(pharmacy.lat, pharmacy.lng)
    if (pharmacy.status === 'red') {
      activeSources.push({ pharmacy, location, strength: 1 })
    } else if (pharmacy.status === 'yellow') {
      activeSources.push({ pharmacy, location, strength: 0.62 })
    }
  })

  const alertsBySector = new Map()
  alerts.forEach((alert) => {
    const sectorAlerts = alertsBySector.get(alert.sector) || []
    sectorAlerts.push(alert)
    alertsBySector.set(alert.sector, sectorAlerts)
  })

  const maxDistanceSquared = HEAT_INFLUENCE_RADIUS_METERS ** 2
  const sigmaFactor = 2 * HEAT_SIGMA_METERS ** 2

  return [...bins.values()].map((cell) => {
    const cellLocation = map.unproject(cell.center, zoom)
    const positions = Array.from({ length: 6 }, (_, index) => {
      const angle = (Math.PI / 180) * (60 * index - 30)
      const x = cell.center.x + radius * Math.cos(angle)
      const y = cell.center.y + radius * Math.sin(angle)
      const coordinate = map.unproject(L.point(x, y), zoom)
      return [coordinate.lat, coordinate.lng]
    })
    let remainingIntensity = 1
    let nearbySignalCount = 0
    const nearbySectorIntensity = new Map()

    activeSources.forEach((source) => {
      const distance = map.distance(cellLocation, source.location)
      const distanceSquared = distance * distance
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

    const nearbySectors = [...nearbySectorIntensity.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([sector]) => sector)
    const sectors = [...cell.sectors].filter(Boolean).sort((a, b) => a.localeCompare(b))
    const cellAlerts = [...new Map(
      nearbySectors
        .flatMap((sector) => alertsBySector.get(sector) || [])
        .map((alert) => [alert.id, alert]),
    ).values()]
    const score = 1 - remainingIntensity

    return {
      ...cell,
      positions,
      sectors,
      nearbySectors,
      nearbySignalCount,
      alerts: cellAlerts,
      score,
      style: getHeatStyle(score),
    }
  })
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

function HexHeatmapLayer({ pharmacies, alerts }) {
  const map = useMap()
  const [, setViewportVersion] = useState(0)

  useEffect(() => {
    let frameId = 0
    const refreshHexGrid = () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => {
        frameId = 0
        setViewportVersion((version) => version + 1)
      })
    }

    map.on('zoom', refreshHexGrid)
    map.on('zoomend', refreshHexGrid)
    map.on('moveend', refreshHexGrid)
    map.on('resize', refreshHexGrid)
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      map.off('zoom', refreshHexGrid)
      map.off('zoomend', refreshHexGrid)
      map.off('moveend', refreshHexGrid)
      map.off('resize', refreshHexGrid)
    }
  }, [map])

  const cells = buildHexCells(map, pharmacies, alerts)

  return cells.map((cell) => (
    <Polygon
      key={cell.id}
      positions={cell.positions}
      pathOptions={{
        className: 'heat-hex',
        color: cell.style.color,
        fillColor: cell.style.color,
        fillOpacity: cell.style.fillOpacity,
        opacity: cell.style.opacity,
        weight: 1,
      }}
    >
      <Popup>
        <div className="map-popup">
          <h3>Área de influencia</h3>
          <p><strong>Intensidad:</strong> {formatNumber(cell.score * 100)}%</p>
          <p><strong>Sectores en la celda:</strong> {cell.sectors.join(', ') || 'Sin farmacia'}</p>
          <p><strong>Farmacias en la celda:</strong> {formatNumber(cell.pharmacyCount)}</p>
          <p><strong>Farmacias con señal cercana:</strong> {formatNumber(cell.nearbySignalCount)}</p>
          <p><strong>Unidades recientes en la celda:</strong> {formatNumber(cell.recentUnits)}</p>
          {cell.alerts.length > 0 ? (
            <>
              <p><strong>Sectores con señal próximos:</strong> {cell.nearbySectors.join(', ')}</p>
              <ul className="hex-alert-list">
                {cell.alerts.slice(0, 5).map((alert) => (
                  <li key={alert.id}>
                    {alert.sector} · {alert.category}: +{formatNumber(alert.changePercent)}% ({statusDetails[alert.status]?.label || 'Alza observada'})
                  </li>
                ))}
              </ul>
            </>
          ) : <p>No hay señales de alza cercanas.</p>}
        </div>
      </Popup>
    </Polygon>
  ))
}

function App() {
  const [dashboard, setDashboard] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [toasts, setToasts] = useState([])
  const previousAlerts = useRef(null)

  useEffect(() => {
    let active = true

    const loadDashboard = async () => {
      setLoading(true)
      const query = selectedCategory ? `?category=${encodeURIComponent(selectedCategory)}` : ''
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
  }, [selectedCategory, reloadToken])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setReloadToken((value) => value + 1)
      }
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [])

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
  const stats = dashboard?.stats || {
    totalPharmacies: 0,
    sectorsWithSignals: 0,
    highSignalCount: 0,
    alertCount: 0,
  }
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
            <FitMapToPharmacies pharmacies={pharmacies} />
            <HexHeatmapLayer pharmacies={pharmacies} alerts={alerts} />
          </MapContainer>
          <div className={`map-refresh-status${error ? ' stale' : ''}`} aria-live="polite">
            <span className={`refresh-indicator${loading ? ' loading' : ''}`} />
            <span>
              {error && dashboard ? 'Mostrando datos anteriores' : error ? 'Datos no disponibles' : loading ? 'Actualizando mapa' : 'Mapa actualizado'}
              {lastUpdated && ` · ${lastUpdated.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`}
            </span>
          </div>
          <div className="hex-legend" role="region" tabIndex={0} aria-label="Leyenda de intensidad de señales">
            <strong>Intensidad</strong>
            <i className="heat-gradient" aria-hidden="true" />
            <div className="hex-legend-details">
              <span><i className="legend-swatch no-signal" />Sin señal cercana</span>
              <div className="heat-scale-labels"><span>Menor</span><span>Mayor</span></div>
              <small>El color se atenúa con la distancia</small>
              <small>Se actualiza cada 30 s</small>
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

          <CollapsibleCard title="Filtros" className="product-card">
            <label className="product-filter" htmlFor="category-select">Categoría de producto</label>
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              disabled={loading || !dashboard?.categories?.length}
            >
              <option value="">Todas las categorías</option>
              {dashboard?.categories?.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </CollapsibleCard>

          <CollapsibleCard title="Señales del periodo" icon={Zap} iconColor="var(--status-yellow)">
            <div className="stats-grid">
              <div className="stat-box">
                <span className="stat-label">Farmacias</span>
                <span className="stat-value">{formatNumber(stats.totalPharmacies)}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Sectores con alza</span>
                <span className="stat-value" style={{ color: 'var(--status-red)' }}>{formatNumber(stats.sectorsWithSignals)}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Alertas categoría</span>
                <span className="stat-value" style={{ color: 'var(--status-yellow)' }}>{formatNumber(stats.alertCount)}</span>
              </div>
            </div>
            <span className="location-count">
              {formatNumber(dashboard?.stats?.recentUnits || 0)} unidades registradas en el periodo reciente
            </span>
          </CollapsibleCard>

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
                  const leadingProduct = alert.topProducts?.[0]
                  return (
                    <article key={alert.id} className={`alert-item ${status}`}>
                      <div className="alert-header">
                        <span className="alert-title">{alert.sector}</span>
                        <span className={`alert-badge badge-${status}`}>
                          {statusDetails[status].label}
                        </span>
                      </div>
                      <div className="alert-metric">
                        <span className="alert-category">{alert.category}</span>
                        <span className={`metric-value ${status}`}>
                          +{formatNumber(alert.changePercent)}% frente a la línea base
                        </span>
                      </div>
                      <div className="signal-details">
                        <span>{formatNumber(alert.recentUnits)} uds. en 30 días</span>
                        <span>Base: {formatNumber(alert.baselineUnits)} uds. en 90 días</span>
                      </div>
                      {leadingProduct && (
                        <div className="top-product">Mayor aporte reciente: {leadingProduct.name}</div>
                      )}
                    </article>
                  )
                })
              )}
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Predicción Epidemiológica" icon={Activity} iconColor="var(--status-red)" defaultOpen={false}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
              <strong>Basado en patrones de compra:</strong>
              <ul style={{ paddingLeft: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>
                  <strong>Zona Norte:</strong> Aumento de Antihistamínicos.
                  <div style={{ color: 'var(--status-yellow)' }}>Posible brote de alergias estacionales.</div>
                </li>
                <li>
                  <strong>Sector Centro:</strong> Alta demanda de Analgésicos/Antipiréticos.
                  <div style={{ color: 'var(--status-red)' }}>Posible foco de infecciones virales (ej. Dengue o Gripe).</div>
                </li>
              </ul>
            </div>
            <div style={{ fontSize: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', padding: '0.5rem', borderRadius: '4px', color: '#991b1b', marginTop: '0.5rem' }}>
              <strong>Atención:</strong> Esta es una proyección teórica (MOCK para demo) basada en ventas y no constituye un diagnóstico epidemiológico real.
            </div>
          </CollapsibleCard>

          <button
            className={`action-button ${loading ? 'disabled' : ''}`}
            onClick={() => setReloadToken((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw size={20} />
            {loading ? 'Actualizando…' : 'Actualizar análisis'}
          </button>
          <span className="signal-disclaimer">
            Un aumento de ventas es una señal comercial; no diagnostica ni confirma enfermedades.
          </span>
        </aside>
      </main>
    </div>
  )
}

export default App
