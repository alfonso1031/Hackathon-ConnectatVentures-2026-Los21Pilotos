import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import { Activity, AlertCircle, AlertTriangle, Bell, PackageCheck, RefreshCw, TrendingUp, Zap } from 'lucide-react'
import L from 'leaflet'
import './App.css'

const API = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
const CARTO_KEY = import.meta.env.VITE_CARTO_BASEMAPS_KEY?.trim()
const CARTO_TILES = `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : ''}`
const DEFAULT_CENTER = [-0.18, -78.48]

const statusDetails = {
  red: { label: 'Alza alta', color: 'var(--status-red)', icon: AlertTriangle },
  yellow: { label: 'Alza observada', color: 'var(--status-yellow)', icon: AlertCircle },
  green: { label: 'Sin señal detectada', color: 'var(--status-green)', icon: PackageCheck },
}

const formatNumber = (value, maximumFractionDigits = 0) => {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('es-EC', { maximumFractionDigits }).format(value)
}

const createIcon = (status) => {
  const markerStatus = status in statusDetails ? status : 'green'
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-pulse marker-${markerStatus}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

function FitMapToPharmacies({ pharmacies }) {
  const map = useMap()

  useEffect(() => {
    const coordinates = pharmacies
      .filter((pharmacy) => Number.isFinite(pharmacy.lat) && Number.isFinite(pharmacy.lng))
      .map((pharmacy) => [pharmacy.lat, pharmacy.lng])

    if (coordinates.length === 1) map.setView(coordinates[0], 13)
    if (coordinates.length > 1) {
      map.fitBounds(L.latLngBounds(coordinates), { padding: [32, 32], maxZoom: 13 })
    }
  }, [map, pharmacies])

  return null
}

function App() {
  const [dashboard, setDashboard] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
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
        setError('')
      } catch (requestError) {
        if (!active) return
        setDashboard(null)
        setError(requestError.message || 'No se pudo conectar con el backend.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()
    return () => { active = false }
  }, [selectedCategory, reloadToken])

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

  const pharmacies = dashboard?.pharmacies || []
  const alerts = dashboard?.alerts || []
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
          <Activity className="brand-icon" size={28} />
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
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution/">CARTO</a>'
              url={CARTO_TILES}
            />
            <FitMapToPharmacies pharmacies={pharmacies} />
            {pharmacies.map((pharmacy) => (
              <Marker
                key={pharmacy.id}
                position={[pharmacy.lat, pharmacy.lng]}
                icon={createIcon(pharmacy.status)}
              >
                <Popup>
                  <div className="map-popup">
                    <h3>{pharmacy.name}</h3>
                    <p><strong>Sector:</strong> {pharmacy.sectorId}</p>
                    <p><strong>Señal:</strong> {statusDetails[pharmacy.status]?.label || 'Sin señal'}</p>
                    <p><strong>Unidades vendidas, últimos 30 días:</strong> {formatNumber(pharmacy.recentUnits)}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
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

          <div className="glass-card product-card">
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
          </div>

          <div className="glass-card">
            <h2 className="card-title"><Zap size={20} color="var(--status-yellow)" /> Señales del periodo</h2>
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
          </div>

          <div className="glass-card alert-card">
            <h2 className="card-title">
              <span className="alert-title-group"><AlertTriangle size={20} color="var(--status-red)" /> Aumentos por sector</span>
              <span className="alert-count">{alerts.length} señales</span>
            </h2>
            <div className="alert-list">
              {loading ? (
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
          </div>

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
