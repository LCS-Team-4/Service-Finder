import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, TrafficCone, LogOut, Loader2, 
  CheckCircle2, AlertCircle, Check, X, Menu 
} from 'lucide-react';
import { 
  getMe, 
  triggerServiceImport, 
  triggerTrafficImport, 
  getServicesByStatus, 
  updateServiceStatus, 
  type AdminService 
} from '../services/api';
import LeafletMap from '../components/Map/LeafletMap';
import { useTrafficIncidents } from '../hooks/useTrafficIncidents';
import type { Place } from '../types/service.types';
import type { TrafficIncident } from '../types/traffic.types';

const getCoordinates = (location: any): [number, number] | null => {
  if (location && typeof location === 'object' && location.coordinates) return location.coordinates;
  if (typeof location !== 'string') return null;
  const match = location.match(/(?:SRID=\d+;)?\s*POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
  if (match) return [Number(match[1]), Number(match[2])];
  return null;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<'actions' | 'pending'>('actions');

  // Action State
  const [actionLoading, setActionLoading] = useState<'services' | 'traffic' | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Pending Services State
  const [pendingServices, setPendingServices] = useState<AdminService[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Map State
  const mapRef = useRef<any>(null);
  const { incidents } = useTrafficIncidents();
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [userLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [routeTarget] = useState<Place | null>(null);

  useEffect(() => {
    getMe()
      .then((me) => setEmail(me.email ?? ''))
      .catch(() => navigate('/admin', { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const fetchPending = async () => {
    setLoadingPending(true);
    try {
      const data = await getServicesByStatus('pending');
      setPendingServices(data);
      
      // Convert to Place format for the map
      const newPlaces = data.map((s) => {
        const coords = getCoordinates(s.location);
        if (!coords) return null;
        return {
          ...s,
          category: s.type ?? 'Service',
          parentCategory: null,
          lat: coords[1],
          lng: coords[0],
        } as Place;
      }).filter((p): p is Place => p !== null);
      
      setPlaces(newPlaces);
    } catch (err) {
      console.error('Failed to load pending services', err);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPending();
    }
  }, [activeTab]);

  const handleImportServices = async () => {
    setActionLoading('services');
    setStatusMsg({ text: 'Running Geoapify import...', isError: false });
    try {
      const res = await triggerServiceImport();
      setStatusMsg({ 
        text: res.skipped ? 'Import skipped (already running).' : `Success: Imported ${res.imported} services.`, 
        isError: false 
      });
    } catch (err) {
      setStatusMsg({ text: err instanceof Error ? err.message : 'Import failed.', isError: true });
    } finally {
      setActionLoading(null);
    }
  };

  const handleImportTraffic = async () => {
    setActionLoading('traffic');
    setStatusMsg({ text: 'Running TomTom traffic import...', isError: false });
    try {
      const res = await triggerTrafficImport();
      setStatusMsg({ 
        text: res.skipped ? 'Import skipped (already running).' : `Success: Imported ${res.imported} incidents.`, 
        isError: false 
      });
    } catch (err) {
      setStatusMsg({ text: err instanceof Error ? err.message : 'Import failed.', isError: true });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    try {
      await updateServiceStatus(id, newStatus);
      // Remove from list on success
      setPendingServices((prev) => prev.filter((s) => s.id !== id));
      setPlaces((prev) => prev.filter((p) => p.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      alert(`Failed to update service: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSelectFromList = (service: AdminService) => {
    const place = places.find(p => p.id === service.id);
    if (place) {
      setSelected(place);
      mapRef.current?.flyTo([place.lat, place.lng], 16, { animate: true, duration: 0.8 });
    }
  };

  if (loading) {
    return (
      <main className="guide-shell">
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Cormorant SC', fontSize: 24 }}>
          Verifying admin access...
        </div>
      </main>
    );
  }

  return (
    <main className="admin-layout">
      {/* The Toggle Button */}
      <button 
        className={`admin-dock-toggle ${isSidebarOpen ? 'open' : ''}`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <Menu size={18} /> 
        {isSidebarOpen ? 'Close Panel' : 'Admin Menu'}
      </button>

      {/* The Sidebar */}
      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <h2>ADMIN PANEL</h2>
          <p>Signed in as: {email}</p>
        </div>
        
        <div className="admin-sidebar-content">
          <div className="admin-tabs">
            <button 
              className={`admin-tab ${activeTab === 'actions' ? 'active' : ''}`}
              onClick={() => setActiveTab('actions')}
            >
              System Actions
            </button>
            <button 
              className={`admin-tab ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Pending Approvals
            </button>
          </div>

          {activeTab === 'actions' && (
            <>
              <h3 className="admin-section-title">System Actions</h3>
              
              {statusMsg && (
                <div className={`admin-status-msg ${statusMsg.isError ? 'error' : 'success'}`}>
                  {statusMsg.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
                  <span>{statusMsg.text}</span>
                </div>
              )}

              <button className="admin-btn" onClick={handleImportServices} disabled={actionLoading !== null}>
                {actionLoading === 'services' ? <Loader2 size={18} className="spin" /> : <Building2 size={18} />}
                Import Services
              </button>
              <button className="admin-btn" onClick={handleImportTraffic} disabled={actionLoading !== null}>
                {actionLoading === 'traffic' ? <Loader2 size={18} className="spin" /> : <TrafficCone size={18} />}
                Import Traffic
              </button>
            </>
          )}

          {activeTab === 'pending' && (
            <>
              <h3 className="admin-section-title">Pending Services</h3>
              
              {loadingPending ? (
                <div style={{ textAlign: 'center', marginTop: 20 }}><Loader2 className="spin" /></div>
              ) : pendingServices.length === 0 ? (
                <p style={{ fontSize: 13, color: '#6b4423' }}>No pending services to review.</p>
              ) : (
                <div className="admin-service-list">
                  {pendingServices.map(service => (
                    <div key={service.id} className="admin-service-card">
                      <div onClick={() => handleSelectFromList(service)}>
                        <h4>{service.name}</h4>
                        <p>{service.formatted_address || 'No address provided'}</p>
                      </div>
                      <div className="admin-service-actions">
                        <button className="admin-action-btn approve" onClick={() => handleUpdateStatus(service.id, 'approved')}>
                          <Check size={14} /> Approve
                        </button>
                        <button className="admin-action-btn reject" onClick={() => handleUpdateStatus(service.id, 'rejected')}>
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <h3 className="admin-section-title" style={{ marginTop: '40px' }}>Session</h3>
          <button
            className="admin-btn danger"
            onClick={() => {
              localStorage.removeItem('servicefinder_access_token');
              localStorage.removeItem('servicefinder_refresh_token');
              navigate('/admin', { replace: true });
            }}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      <section className="admin-map-area">
        <LeafletMap
          places={places}
          selected={selected}
          onSelect={setSelected}
          mapRef={mapRef}
          satellite={false}
          userLocation={userLocation}
          incidents={incidents as TrafficIncident[]}
          routeTarget={routeTarget}
        />
      </section>
    </main>
  );
}