import { useCallback, useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, TrafficCone, LogOut, Loader2,
  CheckCircle2, AlertCircle, Check, X, Menu,
  Phone, Globe, Clock3, Search, MapPin,
} from 'lucide-react';
import {
  getMe,
  triggerServiceImport,
  triggerTrafficImport,
  getServicesByStatus,
  getServices,
  updateServiceStatus,
  updateServiceFields,
  type AdminService,
} from '../services/api';
import LeafletMap from '../components/Map/LeafletMap';
import { useTrafficIncidents } from '../hooks/useTrafficIncidents';
import type { Place, Service } from '../types/service.types';
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

  // Rejection State
  const [rejecting, setRejecting] = useState<AdminService | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  // Duplicate Check State
  const [dupes, setDupes] = useState<Service[]>([]);
  const [dupesFor, setDupesFor] = useState<string | null>(null);

  // Click-to-place State
  const [placingFor, setPlacingFor] = useState<string | null>(null);
  const [placingError, setPlacingError] = useState('');

  // Map State
  const mapRef = useRef<any>(null);
  const [userLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  // Admin map: always fetch incidents (the hook used to be dead because
  // userLocation is a constant null — `Boolean(null)` is `false`).
  const { incidents } = useTrafficIncidents(true);

  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place | null>(null);
  const [routeTarget] = useState<Place | null>(null);

  useEffect(() => {
    getMe()
      .then((me) => setEmail(me.email ?? ''))
      .catch(() => navigate('/admin', { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  // PERF: wrapped in useCallback so the placing-on-map effect (which calls
  // fetchPending) has a stable dependency and doesn't re-register the
  // Leaflet click listener on every render.
  const fetchPending = useCallback(async () => {
    setLoadingPending(true);
    try {
      const data = await getServicesByStatus('pending');
      setPendingServices(data);

      const newPlaces = data
        .map((s) => {
          const coords = getCoordinates(s.location);
          if (!coords) return null;
          return {
            ...s,
            category: s.type ?? 'Service',
            parentCategory: null,
            lat: coords[1],
            lng: coords[0],
          } as Place;
        })
        .filter((p): p is Place => p !== null);

      setPlaces(newPlaces);
    } catch (err) {
      console.error('Failed to load pending services', err);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPending();
    }
  }, [activeTab, fetchPending]);

  // Click-to-place: while `placingFor` is set, every map click saves a new
  // POINT for that service. Must live *after* fetchPending is defined.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !placingFor) return;

    const onClick = async (e: any) => {
      const { lat, lng } = e.latlng;
      try {
        await updateServiceFields(placingFor, {
          location: `SRID=4326;POINT(${lng} ${lat})`,
        });
        setPlacingFor(null);
        setPlacingError('');
        await fetchPending();
      } catch (err) {
        setPlacingError(err instanceof Error ? err.message : 'Could not save location.');
      }
    };

    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [placingFor, fetchPending]);

  const submitRejection = async () => {
    if (!rejecting) return;
    try {
      await updateServiceStatus(rejecting.id, 'rejected', rejectNote.trim() || undefined);
      setPendingServices((prev) => prev.filter((s) => s.id !== rejecting.id));
      setPlaces((prev) => prev.filter((p) => p.id !== rejecting.id));
      if (selected?.id === rejecting.id) setSelected(null);
      setRejecting(null);
      setRejectNote('');
    } catch (err) {
      alert(`Failed to reject: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const checkDuplicates = useCallback(async (service: AdminService) => {
    const q = service.name.split(/\s+/).slice(0, 3).join(' ');
    try {
      const results = await getServices({ q, limit: 5 });
      setDupes(results.filter((s) => s.id !== service.id));
    } catch {
      setDupes([]);
    } finally {
      setDupesFor(service.id);
    }
  }, []);

  const handleImportServices = async () => {
    setActionLoading('services');
    setStatusMsg({ text: 'Running Geoapify import...', isError: false });
    try {
      const res = await triggerServiceImport();
      setStatusMsg({
        text: res.skipped ? 'Import skipped (already running).' : `Success: Imported ${res.imported} services.`,
        isError: false,
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
        isError: false,
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
      setPendingServices((prev) => prev.filter((s) => s.id !== id));
      setPlaces((prev) => prev.filter((p) => p.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      alert(`Failed to update service: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleSelectFromList = (service: AdminService) => {
    const place = places.find((p) => p.id === service.id);
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
      <button
        className={`admin-dock-toggle ${isSidebarOpen ? 'open' : ''}`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <Menu size={18} />
        {isSidebarOpen ? 'Close Panel' : 'Admin Menu'}
      </button>

      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <h2>ADMIN PANEL</h2>
          <p>Signed in as: {email}</p>
        </div>

        <div className="admin-sidebar-content">
          {placingFor && (
            <div className="admin-status-msg">
              <MapPin size={16} />
              <span>
                Click anywhere on the map to set the location.
                <button
                  onClick={() => setPlacingFor(null)}
                  style={{ marginLeft: 8, background: 'transparent', border: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}
                >
                  Cancel
                </button>
              </span>
            </div>
          )}
          {placingError && (
            <div className="admin-status-msg error">
              <AlertCircle size={16} /><span>{placingError}</span>
            </div>
          )}

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
                  {pendingServices.map((service) => (
                    <div key={service.id} className="admin-service-card">
                      <div onClick={() => handleSelectFromList(service)}>
                        <h4>{service.name}</h4>
                        <p className="admin-card-type">{service.type ?? 'Uncategorised'}</p>
                        <p>{service.formatted_address || 'No address'}</p>
                        {service.phone && <p><Phone size={12} /> {service.phone}</p>}
                        {service.website && <p><Globe size={12} /> {service.website}</p>}
                        {service.opening_hours && <p><Clock3 size={12} /> {service.opening_hours}</p>}
                        <p className="admin-card-meta">
                          Submitted {new Date(service.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="admin-service-actions">
                        <button className="admin-action-btn approve" onClick={() => handleUpdateStatus(service.id, 'approved')}>
                          <Check size={14} /> Approve
                        </button>
                        <button className="admin-action-btn reject" onClick={() => setRejecting(service)}>
                          <X size={14} /> Reject
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => checkDuplicates(service)}
                        style={{ marginTop: 8, fontSize: 11, background: 'transparent', border: 0, color: '#8b5a2b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Search size={12} /> Check for duplicates
                      </button>
                      {dupesFor === service.id && (
                        dupes.length === 0 ? (
                          <p style={{ fontSize: 11, fontStyle: 'italic', color: '#6b4423', margin: '4px 0 0' }}>
                            No matching approved services.
                          </p>
                        ) : (
                          <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 11, color: '#6b4423' }}>
                            {dupes.map((d) => (
                              <li key={d.id}><strong>{d.name}</strong> — {d.formatted_address ?? 'No address'}</li>
                            ))}
                          </ul>
                        )
                      )}
                      <button
                        type="button"
                        disabled={placingFor === service.id}
                        onClick={() => { setPlacingError(''); setPlacingFor(service.id); }}
                        style={{ marginTop: 6, fontSize: 11, background: 'transparent', border: 0, color: '#8b5a2b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <MapPin size={12} />
                        {placingFor === service.id ? 'Click the map…' : 'Place on map'}
                      </button>
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

      {rejecting && (
        <div className="suggest-overlay" onClick={() => setRejecting(null)}>
          <div className="suggest-modal" onClick={(e) => e.stopPropagation()}>
            <button className="suggest-close" onClick={() => setRejecting(null)} aria-label="Close">
              <X size={18} />
            </button>
            <h2>Reject service</h2>
            <p className="suggest-hint">
              Rejecting: <strong>{rejecting.name}</strong>
            </p>
            <label className="field-label" htmlFor="reject-note">Reason (optional)</label>
            <textarea
              id="reject-note"
              className="auth-input"
              style={{ minHeight: 80, padding: 10 }}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g. Duplicate of existing entry"
            />
            <button className="submit-button" type="button" onClick={submitRejection} style={{ marginTop: 12 }}>
              Reject service
            </button>
          </div>
        </div>
      )}
    </main>
  );
}