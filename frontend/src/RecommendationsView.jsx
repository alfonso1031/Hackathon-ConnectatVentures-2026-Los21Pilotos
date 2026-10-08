import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowLeftRight, BrainCircuit, Check, Eye, RefreshCw, Trash2, X } from 'lucide-react'

const STORAGE_KEY = 'farmasenal.recommendationDecisions.v1'
const VALID_DECISIONS = new Set(['simulated', 'watch', 'dismissed'])
const EMPTY_ARRAY = []
const DEFAULT_FILTERS = { query: '', type: 'all', priority: 'all', decision: 'all' }

const numberFormat = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 1 })
const quantityFormat = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 })

function readDecisions() {
  if (typeof window === 'undefined') return {}
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter(([id, decision]) => typeof id === 'string' && VALID_DECISIONS.has(decision)),
    )
  } catch {
    return {}
  }
}

function writeDecisions(decisions) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions))
  } catch {
    // The view remains usable if browser storage is disabled or full.
  }
}

function format(value, formatter = numberFormat) {
  return Number.isFinite(value) ? formatter.format(value) : '—'
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function RecommendationsView({ apiBase }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [decisions, setDecisions] = useState(readDecisions)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [cooldown, setCooldown] = useState(false)
  const analyzeLock = useRef(false)
  const cooldownTimer = useRef(null)

  const loadRecommendations = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${apiBase}/recommendations`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'No se pudieron cargar las recomendaciones.')
      if (!Array.isArray(payload.recommendations)) throw new Error('El backend devolvió una respuesta de recomendaciones inválida.')
      setData(payload)
      setAnalysis(null)
    } catch (requestError) {
      setError(requestError.message || 'No se pudo conectar con el backend.')
    } finally {
      setLoading(false)
    }
  }, [apiBase])

  useEffect(() => {
    loadRecommendations()
    return () => {
      if (cooldownTimer.current) window.clearTimeout(cooldownTimer.current)
    }
  }, [loadRecommendations])

  const recommendations = data?.recommendations || EMPTY_ARRAY
  const validIds = useMemo(() => new Set(recommendations.map((item) => item.id).filter(Boolean)), [recommendations])
  const activeDecisions = useMemo(
    () => Object.fromEntries(Object.entries(decisions).filter(([id, decision]) => validIds.has(id) && VALID_DECISIONS.has(decision))),
    [decisions, validIds],
  )
  const filteredRecommendations = useMemo(() => {
    const query = normalizeSearch(filters.query.trim())
    return recommendations.filter((item) => {
      if (filters.type !== 'all' && item.type !== filters.type) return false
      if (filters.priority !== 'all' && item.priority !== filters.priority) return false

      const decision = activeDecisions[item.id]
      if (filters.decision === 'undecided' && decision) return false
      if (filters.decision !== 'all' && filters.decision !== 'undecided' && decision !== filters.decision) return false

      if (query) {
        const searchable = [
          item.product?.name,
          item.product?.category,
          item.source?.name,
          item.destination?.name,
          item.source?.sectorId,
          item.destination?.sectorId,
        ].map(normalizeSearch).join(' ')
        if (!searchable.includes(query)) return false
      }
      return true
    })
  }, [activeDecisions, filters, recommendations])
  const hasActiveFilters = filters.query.trim() !== '' || filters.type !== 'all' || filters.priority !== 'all' || filters.decision !== 'all'

  useEffect(() => {
    if (!data) return
    setDecisions((current) => {
      const cleaned = Object.fromEntries(
        Object.entries(current).filter(([id, decision]) => validIds.has(id) && VALID_DECISIONS.has(decision)),
      )
      if (Object.keys(cleaned).length !== Object.keys(current).length) writeDecisions(cleaned)
      return cleaned
    })
  }, [data, validIds])

  const setDecision = (id, decision) => {
    setDecisions((current) => {
      const next = { ...current }
      if (next[id] === decision) delete next[id]
      else next[id] = decision
      writeDecisions(next)
      return next
    })
  }

  const clearDecisions = () => {
    setDecisions({})
    writeDecisions({})
  }

  const analyze = async () => {
    if (analyzeLock.current || cooldown) return
    analyzeLock.current = true
    setAnalyzing(true)
    setAnalysis(null)
    try {
      const response = await fetch(`${apiBase}/recommendations/analyze`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error?.message || 'No se pudo completar el análisis.')
      setAnalysis(payload)
    } catch (requestError) {
      setAnalysis({
        provider: 'error',
        summary: requestError.message || 'El servicio de análisis no está disponible.',
        notice: 'Las propuestas calculadas por reglas siguen disponibles en esta pantalla.',
      })
    } finally {
      setAnalyzing(false)
      setCooldown(true)
      cooldownTimer.current = window.setTimeout(() => {
        setCooldown(false)
        cooldownTimer.current = null
      }, 1000)
      analyzeLock.current = false
    }
  }

  const counts = data?.counts || {}
  const decisionCount = Object.keys(activeDecisions).length

  return (
    <main className="recommendations-page" aria-labelledby="recommendations-title">
      <section className="recommendations-heading">
        <div>
          <p className="recommendations-eyebrow">Abastecimiento entre sucursales</p>
          <h1 id="recommendations-title">Recomendaciones operativas</h1>
          <p>Propuestas calculadas con inventario, ventas y ubicación del dataset sintético completo.</p>
        </div>
        <div className="recommendations-controls">
          <button type="button" className="secondary-button" onClick={loadRecommendations} disabled={loading}>
            <RefreshCw size={17} aria-hidden="true" />
            {loading ? 'Actualizando…' : 'Actualizar propuestas'}
          </button>
      <button type="button" className={`action-button recommendations-ai-button ${analyzing || cooldown || loading ? 'disabled' : ''}`} onClick={analyze} disabled={analyzing || cooldown || loading}>
            <BrainCircuit size={18} aria-hidden="true" />
            {analyzing ? 'Proyectando…' : cooldown ? 'Disponible en un momento' : 'Proyectar con AWS AI'}
          </button>
        </div>
      </section>

      <div className="recommendations-notice" role="note">
        Datos sintéticos. La proyección orientativa combina el cambio de ventas recientes con la cobertura actual; no garantiza un resultado futuro. Cantidades y prioridades vienen de reglas; los traslados son simulaciones.
      </div>

      <section className="recommendation-stats" aria-label="Resumen de recomendaciones">
        <div className="recommendation-stat"><span>Traslados simulables</span><strong>{format(counts.transferCount || 0)}</strong></div>
        <div className="recommendation-stat"><span>Casos en vigilancia</span><strong>{format(counts.watchCount || 0)}</strong></div>
        <div className="recommendation-stat"><span>Decisiones locales</span><strong>{format(decisionCount)}</strong></div>
        <div className="recommendation-stat"><span>Unidades aún por cubrir</span><strong>{format(counts.unfilledUnits || 0, quantityFormat)}</strong></div>
      </section>

      {analysis && (
        <section className={`recommendation-analysis ${analysis.provider === 'bedrock' ? 'is-bedrock' : 'is-fallback'}`} aria-live="polite">
          <div className="analysis-provider"><BrainCircuit size={18} aria-hidden="true" />
            {analysis.provider === 'bedrock' ? 'Proyección orientativa con Amazon Bedrock' : analysis.provider === 'fallback' ? 'Proyección orientativa por reglas' : 'Análisis de IA no disponible'}
          </div>
          <p>{analysis.summary}</p>
          {analysis.notice && <small>{analysis.notice}</small>}
        </section>
      )}

      {error && (
        <div className="recommendations-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <div><strong>No se pudieron cargar las recomendaciones</strong><p>{error}</p></div>
          <button type="button" className="secondary-button" onClick={loadRecommendations}>Reintentar</button>
        </div>
      )}

      {loading && !data && <div className="recommendations-loading" role="status">Cargando propuestas calculadas por reglas…</div>}

      {!loading && !error && recommendations.length === 0 && (
        <div className="recommendations-empty">
          <Check size={24} aria-hidden="true" />
          <strong>No hay casos de abastecimiento o vigilancia con los datos actuales.</strong>
          <span>El análisis usa el inventario disponible, sus mínimos y la caducidad registrada.</span>
        </div>
      )}

      {recommendations.length > 0 && (
        <section className="recommendation-list" aria-label="Propuestas por farmacia">
          <div className="recommendation-list-heading">
            <div><h2>Propuestas para revisar</h2><span>Referencia: {data?.referenceDate || 'sin fecha disponible'}</span></div>
            <button type="button" className="secondary-button clear-decisions" onClick={clearDecisions} disabled={decisionCount === 0}>
              <Trash2 size={16} aria-hidden="true" /> Limpiar decisiones locales
            </button>
          </div>
          <div className="recommendation-filters" role="group" aria-label="Filtros de propuestas">
            <label className="recommendation-filter-control recommendation-filter-search">
              <span>Producto o farmacia</span>
              <input
                type="search"
                value={filters.query}
                onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
                placeholder="Buscar por nombre o sector"
              />
            </label>
            <label className="recommendation-filter-control">
              <span>Tipo</span>
              <select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
                <option value="all">Todos</option>
                <option value="transfer">Traslados</option>
                <option value="watch">Vigilancia</option>
              </select>
            </label>
            <label className="recommendation-filter-control">
              <span>Prioridad</span>
              <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}>
                <option value="all">Todas</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
              </select>
            </label>
            <label className="recommendation-filter-control">
              <span>Decisión</span>
              <select value={filters.decision} onChange={(event) => setFilters((current) => ({ ...current, decision: event.target.value }))}>
                <option value="all">Todas</option>
                <option value="undecided">Sin decisión</option>
                <option value="simulated">Traslado simulado</option>
                <option value="watch">En vigilancia</option>
                <option value="dismissed">Descartada</option>
              </select>
            </label>
            <div className="recommendation-filter-summary">
              <span aria-live="polite">Mostrando <strong>{format(filteredRecommendations.length)}</strong> de {format(recommendations.length)} propuestas</span>
              <button type="button" className="secondary-button" onClick={() => setFilters(DEFAULT_FILTERS)} disabled={!hasActiveFilters}>Limpiar filtros</button>
            </div>
            <small className="recommendation-filter-note">Los filtros organizan estas tarjetas; el resumen de AWS AI sigue describiendo la muestra general.</small>
          </div>
          {filteredRecommendations.length === 0 ? (
            <div className="recommendations-empty filtered-empty">
              <AlertCircle size={22} aria-hidden="true" />
              <strong>No hay propuestas que coincidan con estos filtros.</strong>
            </div>
          ) : filteredRecommendations.map((item) => {
            const decision = activeDecisions[item.id]
            const isTransfer = item.type === 'transfer'
            return (
              <article className={`recommendation-card ${item.priority === 'high' ? 'priority-high' : ''}`} key={item.id}>
                <div className="recommendation-card-topline">
                  <span className={`recommendation-type ${isTransfer ? 'transfer' : 'watch'}`}>
                    {isTransfer ? <ArrowLeftRight size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                    {isTransfer ? 'Traslado simulable' : 'Vigilancia'}
                  </span>
                  <span className={`priority-tag ${item.priority === 'high' ? 'high' : ''}`}>
                    Prioridad {item.priority === 'high' ? 'alta' : 'media'}
                  </span>
                  {decision && <span className="decision-tag">{decision === 'simulated' ? 'Decisión: simulado' : decision === 'watch' ? 'Decisión: vigilancia' : 'Decisión: descartado'}</span>}
                </div>
                <div className="recommendation-card-title">
                  <div><h3>{item.product?.name || 'Producto sin nombre'}</h3><span>{item.product?.category || 'Sin categoría'}</span></div>
                  <strong>{isTransfer ? `${format(item.suggestedQuantity, quantityFormat)} uds.` : 'Sin origen seguro'}</strong>
                </div>
                <div className="recommendation-route">
                  <div><small>Origen</small><strong>{item.source?.name || 'Sin origen elegible'}</strong></div>
                  <span className="route-arrow" aria-hidden="true">→</span>
                  <div><small>Destino</small><strong>{item.destination?.name || 'Farmacia sin identificar'}</strong><span>{item.destination?.status || 'Estado desconocido'} · {format(item.destination?.daysCoverage)} días de cobertura</span></div>
                </div>
                <div className="recommendation-facts">
                  <span><strong>Stock destino</strong>{format(item.destination?.stockActual)} / mínimo {format(item.destination?.stockMinimum)} uds.</span>
                  <span><strong>Distancia</strong>{Number.isFinite(item.distanceKm) ? `≈ ${format(item.distanceKm)} km` : 'No disponible'}</span>
                  {Number.isFinite(item.unfilledQuantity) && <span><strong>Faltante restante</strong>{format(item.unfilledQuantity, quantityFormat)} uds.</span>}
                  {item.source?.expirationDate && <span><strong>Caducidad origen</strong>{item.source.expirationDate}</span>}
                </div>
                <ul className="recommendation-evidence">
                  {(item.evidence || EMPTY_ARRAY).map((evidence, index) => <li key={`${item.id}-evidence-${index}`}>{evidence}</li>)}
                </ul>
                <div className="recommendation-actions" role="group" aria-label={`Decisiones para ${item.product?.name || 'producto'}`}>
                  {isTransfer && <button type="button" className={decision === 'simulated' ? 'selected' : ''} aria-pressed={decision === 'simulated'} onClick={() => setDecision(item.id, 'simulated')}><ArrowLeftRight size={15} aria-hidden="true" />Simular traslado</button>}
                  <button type="button" className={decision === 'watch' ? 'selected' : ''} aria-pressed={decision === 'watch'} onClick={() => setDecision(item.id, 'watch')}><Eye size={15} aria-hidden="true" />Poner en vigilancia</button>
                  <button type="button" className={decision === 'dismissed' ? 'selected' : ''} aria-pressed={decision === 'dismissed'} onClick={() => setDecision(item.id, 'dismissed')}><X size={15} aria-hidden="true" />Descartar</button>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}

export default RecommendationsView
