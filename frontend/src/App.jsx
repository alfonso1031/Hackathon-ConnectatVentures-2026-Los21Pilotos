import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { AlertTriangle, Activity, PackageCheck, Zap, TrendingDown } from 'lucide-react';
import L from 'leaflet';
import './App.css'; // Optional: if you have extra styles not in index.css

const MOCK_DATA = [
  { id: 1, name: "FarmaSeñal Centro", lat: 19.4326, lng: -99.1332, med: "Losartan", stock: 150, dailySales: 10 },
  { id: 2, name: "FarmaSeñal Polanco", lat: 19.4323, lng: -99.1936, med: "Paracetamol", stock: 12, dailySales: 5 },
  { id: 3, name: "FarmaSeñal Condesa", lat: 19.4140, lng: -99.1709, med: "Insulina", stock: 6, dailySales: 4 },
  { id: 4, name: "FarmaSeñal Coyoacán", lat: 19.3490, lng: -99.1622, med: "Losartan", stock: 200, dailySales: 20 },
  { id: 5, name: "FarmaSeñal Roma", lat: 19.4194, lng: -99.1593, med: "Paracetamol", stock: 45, dailySales: 15 },
  { id: 6, name: "FarmaSeñal Reforma", lat: 19.4285, lng: -99.1677, med: "Insulina", stock: 3, dailySales: 3 },
  { id: 7, name: "FarmaSeñal Tlalpan", lat: 19.2891, lng: -99.1623, med: "Losartan", stock: 35, dailySales: 12 },
  { id: 8, name: "FarmaSeñal Santa Fe", lat: 19.3622, lng: -99.2731, med: "Paracetamol", stock: 20, dailySales: 8 },
  { id: 9, name: "FarmaSeñal Del Valle", lat: 19.3756, lng: -99.1683, med: "Insulina", stock: 8, dailySales: 2 },
  { id: 10, name: "FarmaSeñal Narvarte", lat: 19.3888, lng: -99.1534, med: "Losartan", stock: 15, dailySales: 10 },
];

// Helper to determine status based on days left
const getStatus = (stock, dailySales) => {
  const daysLeft = stock / dailySales;
  if (daysLeft > 5) return 'green';
  if (daysLeft > 1) return 'yellow';
  return 'red';
};

// Custom Marker Icons
const createIcon = (status) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-pulse marker-${status}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

function App() {
  const [pharmacies, setPharmacies] = useState(MOCK_DATA);
  const [simulationActive, setSimulationActive] = useState(true);

  // Real-time stock simulator
  useEffect(() => {
    if (!simulationActive) return;

    const interval = setInterval(() => {
      setPharmacies(current => 
        current.map(pharma => {
          // Randomly decrease stock for some pharmacies to simulate sales
          const shouldDecrease = Math.random() > 0.6;
          if (shouldDecrease && pharma.stock > 0) {
            // Subtract slightly accelerated rate to show demo effect quickly
            const decreaseAmount = Math.max(1, Math.floor(Math.random() * 3));
            return { ...pharma, stock: Math.max(0, pharma.stock - decreaseAmount) };
          }
          return pharma;
        })
      );
    }, 2000); // Check every 2 seconds

    return () => clearInterval(interval);
  }, [simulationActive]);

  // Handle Predictve Restock Approval
  const handleRestock = () => {
    setPharmacies(current => 
      current.map(pharma => {
        const daysLeft = pharma.stock / pharma.dailySales;
        // If stock is below 5 days, restock it to 10 days worth
        if (daysLeft <= 5) {
          return { ...pharma, stock: pharma.dailySales * 10 };
        }
        return pharma;
      })
    );
  };

  const criticalAlerts = useMemo(() => {
    return pharmacies
      .filter(p => getStatus(p.stock, p.dailySales) !== 'green')
      .sort((a, b) => (a.stock / a.dailySales) - (b.stock / b.dailySales));
  }, [pharmacies]);

  const globalStats = useMemo(() => {
    const totalLocations = pharmacies.length;
    const criticalCount = criticalAlerts.filter(p => getStatus(p.stock, p.dailySales) === 'red').length;
    const warningCount = criticalAlerts.filter(p => getStatus(p.stock, p.dailySales) === 'yellow').length;
    return { totalLocations, criticalCount, warningCount };
  }, [pharmacies, criticalAlerts]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="brand">
          <Activity className="brand-icon" size={28} />
          FarmaSeñal
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Plataforma de IA Predictiva para Quiebres de Stock
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* Map Section */}
        <div className="map-container">
          <MapContainer 
            center={[19.3900, -99.1800]} 
            zoom={12} 
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%', background: '#0f172a' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {pharmacies.map((pharma) => (
              <Marker 
                key={pharma.id} 
                position={[pharma.lat, pharma.lng]}
                icon={createIcon(getStatus(pharma.stock, pharma.dailySales))}
              >
                <Popup>
                  <div style={{ padding: '5px', minWidth: '150px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--accent)' }}>{pharma.name}</h3>
                    <p style={{ margin: '5px 0', fontSize: '0.9rem' }}><strong>Medicamento:</strong> {pharma.med}</p>
                    <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>
                      <strong>Stock:</strong> <span style={{ color: getStatus(pharma.stock, pharma.dailySales) === 'red' ? '#ef4444' : '#111' }}>{pharma.stock} uds</span>
                    </p>
                    <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#666' }}>Ventas Diarias: {pharma.dailySales}/día</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Dashboard / Alertas */}
        <aside className="panel">
          
          {/* Stats Overview */}
          <div className="glass-card">
            <h2 className="card-title"><Zap size={20} color="var(--status-yellow)" /> Estado de la Red</h2>
            <div className="stats-grid">
              <div className="stat-box">
                <span className="stat-label">Nodos Críticos</span>
                <span className="stat-value" style={{ color: 'var(--status-red)' }}>{globalStats.criticalCount}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">En Riesgo</span>
                <span className="stat-value" style={{ color: 'var(--status-yellow)' }}>{globalStats.warningCount}</span>
              </div>
            </div>
          </div>

          {/* Alerts List */}
          <div className="glass-card" style={{ flex: 1, overflow: 'hidden' }}>
            <h2 className="card-title"><AlertTriangle size={20} color="var(--status-red)" /> Alertas Críticas de IA</h2>
            <div className="alert-list">
              {criticalAlerts.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--status-green)', padding: '2rem 0' }}>
                  <PackageCheck size={40} style={{ margin: '0 auto 1rem', display: 'block' }} />
                  Todos los nodos tienen stock saludable.
                </div>
              ) : (
                criticalAlerts.map(alert => {
                  const status = getStatus(alert.stock, alert.dailySales);
                  const daysLeft = (alert.stock / alert.dailySales).toFixed(1);
                  return (
                    <div key={alert.id} className={`alert-item ${status}`}>
                      <div className="alert-header">
                        <span className="alert-title">{alert.name}</span>
                        <span className="alert-time">Hace instantes</span>
                      </div>
                      <div className="alert-details">
                        <div className="alert-metric">
                          <span>{alert.med}</span>
                          <span className={`metric-value ${status}`}>{alert.stock} uds</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <TrendingDown size={14} color={status === 'red' ? 'var(--status-red)' : 'var(--status-yellow)'} />
                          Quiebre en: <strong>{daysLeft} días</strong>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action Button */}
          <button 
            className={`action-button ${criticalAlerts.length === 0 ? 'disabled' : ''}`}
            onClick={handleRestock}
            disabled={criticalAlerts.length === 0}
          >
            <PackageCheck size={20} />
            Aprobar Reabastecimiento Predictivo
          </button>
        </aside>

      </main>
    </div>
  );
}

export default App;
