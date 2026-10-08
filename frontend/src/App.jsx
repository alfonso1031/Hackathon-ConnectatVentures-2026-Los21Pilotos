import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { AlertTriangle, Activity, PackageCheck, Zap, AlertCircle, XCircle, TrendingDown, Bell } from 'lucide-react';
import L from 'leaflet';
import './App.css';

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

const getStatus = (stock, dailySales) => {
  if (stock === 0) return 'out';
  const daysLeft = stock / dailySales;
  if (daysLeft > 5) return 'green';
  if (daysLeft > 1) return 'yellow';
  return 'red';
};

const getStatusDetails = (status) => {
  switch(status) {
    case 'out': return { label: 'Agotado', color: 'var(--status-out)', icon: XCircle };
    case 'red': return { label: 'Quiebre Inminente', color: 'var(--status-red)', icon: AlertTriangle };
    case 'yellow': return { label: 'En Riesgo', color: 'var(--status-yellow)', icon: AlertCircle };
    default: return { label: 'Saludable', color: 'var(--status-green)', icon: PackageCheck };
  }
};

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
  const [toasts, setToasts] = useState([]);
  const prevStatuses = useRef({});

  const addToast = (title, message, status) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, message, status }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000); // Hide toast after 5s
  };

  useEffect(() => {
    if (!simulationActive) return;

    const interval = setInterval(() => {
      setPharmacies(current => {
        let newPharmacies = [...current];
        let hasChanges = false;

        newPharmacies = newPharmacies.map(pharma => {
          const shouldDecrease = Math.random() > 0.6;
          if (shouldDecrease && pharma.stock > 0) {
            hasChanges = true;
            const decreaseAmount = Math.max(1, Math.floor(Math.random() * 3));
            const newStock = Math.max(0, pharma.stock - decreaseAmount);
            return { ...pharma, stock: newStock };
          }
          return pharma;
        });

        if (hasChanges) {
          // Check for state transitions to trigger notifications
          newPharmacies.forEach(pharma => {
            const currentStatus = getStatus(pharma.stock, pharma.dailySales);
            const prevStatus = prevStatuses.current[pharma.id];
            
            if (prevStatus && currentStatus !== prevStatus) {
              if (currentStatus === 'out') {
                addToast("¡Atención Crítica!", `Stock agotado de ${pharma.med} en ${pharma.name}.`, "out");
              } else if (currentStatus === 'red' && prevStatus !== 'out') {
                addToast("Quiebre Inminente", `${pharma.name} tiene menos de 1 día de ${pharma.med}.`, "red");
              }
            }
            prevStatuses.current[pharma.id] = currentStatus;
          });
        }

        return newPharmacies;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [simulationActive]);

  // Initial populate of prevStatuses
  useEffect(() => {
    pharmacies.forEach(p => {
      prevStatuses.current[p.id] = getStatus(p.stock, p.dailySales);
    });
  }, []);

  const handleRestockAll = () => {
    setPharmacies(current => 
      current.map(pharma => {
        const status = getStatus(pharma.stock, pharma.dailySales);
        if (status !== 'green') {
          return { ...pharma, stock: pharma.dailySales * 10 };
        }
        return pharma;
      })
    );
  };

  const handleRestockSingle = (id, e) => {
    e.stopPropagation();
    setPharmacies(current => 
      current.map(p => p.id === id ? { ...p, stock: p.dailySales * 10 } : p)
    );
  };

  const sortedAlerts = useMemo(() => {
    return pharmacies
      .filter(p => getStatus(p.stock, p.dailySales) !== 'green')
      .sort((a, b) => {
        const aStatus = getStatus(a.stock, a.dailySales);
        const bStatus = getStatus(b.stock, b.dailySales);
        // Priority: Out > Red > Yellow
        const priority = { 'out': 0, 'red': 1, 'yellow': 2 };
        if (priority[aStatus] !== priority[bStatus]) {
          return priority[aStatus] - priority[bStatus];
        }
        return (a.stock / a.dailySales) - (b.stock / b.dailySales);
      });
  }, [pharmacies]);

  const stats = useMemo(() => {
    return {
      out: pharmacies.filter(p => getStatus(p.stock, p.dailySales) === 'out').length,
      red: pharmacies.filter(p => getStatus(p.stock, p.dailySales) === 'red').length,
      yellow: pharmacies.filter(p => getStatus(p.stock, p.dailySales) === 'yellow').length,
    };
  }, [pharmacies]);

  return (
    <div className="app-container">
      {/* Notifications Toast Area */}
      <div className="toast-container">
        {toasts.map(toast => {
          const Icon = getStatusDetails(toast.status).icon;
          return (
            <div key={toast.id} className={`toast toast-${toast.status}`}>
              <Icon className="toast-icon" size={24} color={`var(--status-${toast.status})`} />
              <div className="toast-content">
                <div className="toast-title">{toast.title}</div>
                <div className="toast-desc">{toast.message}</div>
              </div>
            </div>
          );
        })}
      </div>

      <header className="header">
        <div className="brand">
          <Activity className="brand-icon" size={28} />
          FarmaSeñal Corporativo
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={16} />
          Monitoreo Predictivo en Tiempo Real
        </div>
      </header>

      <main className="main-content">
        <div className="map-container">
          <MapContainer 
            center={[19.3900, -99.1800]} 
            zoom={12} 
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {pharmacies.map((pharma) => {
              const status = getStatus(pharma.stock, pharma.dailySales);
              return (
                <Marker 
                  key={pharma.id} 
                  position={[pharma.lat, pharma.lng]}
                  icon={createIcon(status)}
                >
                  <Popup>
                    <div style={{ padding: '5px', minWidth: '150px' }}>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--accent)' }}>{pharma.name}</h3>
                      <p style={{ margin: '5px 0', fontSize: '0.9rem' }}><strong>Medicamento:</strong> {pharma.med}</p>
                      <p style={{ margin: '5px 0', fontSize: '0.9rem' }}>
                        <strong>Stock:</strong> <span style={{ fontWeight: 'bold', color: `var(--status-${status})` }}>{pharma.stock} uds</span>
                      </p>
                      <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#666' }}>Ventas Diarias: {pharma.dailySales}/día</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        <aside className="panel">
          <div className="glass-card">
            <h2 className="card-title"><Zap size={20} color="var(--accent)" /> Estado de Inventario</h2>
            <div className="stats-grid">
              <div className="stat-box">
                <span className="stat-label">Agotados</span>
                <span className="stat-value" style={{ color: 'var(--status-out)' }}>{stats.out}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Quiebre &lt;24h</span>
                <span className="stat-value" style={{ color: 'var(--status-red)' }}>{stats.red}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">En Riesgo</span>
                <span className="stat-value" style={{ color: 'var(--status-yellow)' }}>{stats.yellow}</span>
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ flex: 1 }}>
            <h2 className="card-title">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} color="var(--status-red)" />
                Panel de Alertas
              </div>
              <span style={{ fontSize: '0.8rem', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>
                {sortedAlerts.length} locaciones
              </span>
            </h2>
            
            <div className="alert-list">
              {sortedAlerts.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--status-green)', padding: '2rem 0' }}>
                  <PackageCheck size={40} style={{ margin: '0 auto 1rem', display: 'block' }} />
                  La red está operando en niveles óptimos.
                </div>
              ) : (
                sortedAlerts.map(alert => {
                  const status = getStatus(alert.stock, alert.dailySales);
                  const details = getStatusDetails(status);
                  const daysLeft = (alert.stock / alert.dailySales).toFixed(1);
                  
                  return (
                    <div key={alert.id} className={`alert-item ${status}`}>
                      <div className="alert-header">
                        <span className="alert-title">{alert.name}</span>
                        <span className={`alert-badge badge-${status}`}>{details.label}</span>
                      </div>
                      <div className="alert-details">
                        <div className="alert-metric">
                          <span style={{ fontSize: '0.8rem' }}>{alert.med}</span>
                          <span className={`metric-value ${status}`}>{alert.stock} uds {status !== 'out' && `(~${daysLeft}d)`}</span>
                        </div>
                        <button className="mini-action-btn" onClick={(e) => handleRestockSingle(alert.id, e)}>
                          <PackageCheck size={14} /> Abastecer
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button 
            className={`action-button ${sortedAlerts.length === 0 ? 'disabled' : ''}`}
            onClick={handleRestockAll}
            disabled={sortedAlerts.length === 0}
          >
            <Activity size={20} />
            Ejecutar Logística Preventiva (Todo)
          </button>
        </aside>
      </main>
    </div>
  );
}

export default App;
