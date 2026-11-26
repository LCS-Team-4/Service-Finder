import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, TrafficCone, LogOut, Loader2,
  CheckCircle2, AlertCircle, Check, X, Menu,
  Phone, Globe, Clock3, Search, MapPin,
  Pencil, Archive, RotateCcw, ExternalLink, Layers,
  List, LayoutGrid,
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
  type ServiceStatus,
} from '../services/api';
import LeafletMap from '../components/Map/LeafletMap';
import { useTrafficIncidents } from '../hooks/useTrafficIncidents';
import RoleSwitcher from '../components/common/RoleSwitcher';
import { getCoordinates, googleMapsAddressUrl, googleMapsPinUrl } from '../utils/geo';
import type { Place, Service } from '../types/service.types';
import type { TrafficIncident } from '../types/traffic.types';

const STATUS_FILTERS: { value: ServiceStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

type EditForm = {
  name: string;
  type: string;
  formatted_address: string;
  phone: string;
  website: string;
  opening_hours: string;
  wheelchair: string;
  latitude: string;
  longitude: string;
};

const toEditForm = (service: AdminService): EditForm => {
  const coords = getCoordinates(service.location);
  return {
    name: service.name ?? '',
    type: service.type ?? '',
    formatted_address: service.formatted_address ?? '',
    phone: service.phone ?? '',
    website: service.website ?? '',
    opening_hours: service.opening_hours ?? '',
    wheelchair: service.wheelchair ?? '',
    latitude: coords ? String(coords[1]) : '',
    longitude: coords ? String(coords[0]) : '',
  };
};

const buildLocation = (
  latText: string,
  lngText: string,
): { ok: true; value: string | null } | { ok: false; message: string } => {
  const latRaw = latText.trim();
  const lngRaw = lngText.trim();
  if (!latRaw && !lngRaw) return { ok: true, value: null };
  if (!latRaw || !lngRaw) return { ok: false, message: 'Enter both latitude and longitude, or leave both blank.' };
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, message: 'Latitude and longitude must be numbers.' };
  if (lat < -90 || lat > 90) return { ok: false, message: 'Latitude must be between -90 and 90.' };
  if (lng < -180 || lng > 180) return { ok: false, message: 'Longitude must be between -180 and 180.' };
  return { ok: true, value: `SRID=4326;POINT(${lng} ${lat})` };
};

const linkButtonStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 11,
  background: 'transparent',
  border: 0,
  padding: 0,
  color: '#8b5a2b',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  textDecoration: 'none',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [activeTab, setActiveTab] = useState<'actions' | 'services'>('actions');
  const [actionLoading, setActionLoading] = useState<'services' | 'traffic' | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const [statusFilter, setStatusFilter] = useState<ServiceStatus>('pending');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [onlyMissingLocation, setOnlyMissingLocation] = useState(false);
  const [services, setServices] = useState<AdminService[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | null>(null);

  const [detailedView, setDetailedView] = useState(false);

  const [rejecting, setRejecting] = useState<AdminService | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const [dupes, setDupes] = useState<Service[]>([]);
  const [dupesFor, setDupesFor] = useState<string | null>(null);

  const [placingFor, setPlacingFor] = useState<string | null>(null);
  const [placingError, setPlacingError] = useState('');

  const [editing, setEditing] = useState<AdminService | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const mapRef = useRef<any>(null);
  const [satellite, setSatellite] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { incidents } = useTrafficIncidents(true);

  const places = useMemo<Place[]>(
    () =>
      services.flatMap((s) => {
        const coords = getCoordinates(s.location);
        if (!coords) return [];
        return [
          {
            ...s,
            category: s.type ?? 'Service',
            parentCategory: null,
            lat: coords[1],
            lng: coords[0],
          } as unknown as Place,
        ];
      }),
    [services],
  );

  const selected = useMemo(
    () => places.find((p) => p.id === selectedId) ?? null,
    [places, selectedId],
  );

  useEffect(() => {
    getMe()
      .then((me) => setEmail(me.email ?? ''))
      .catch(() => navigate('/admin', { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const fetchServices = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await getServicesByStatus(statusFilter, {
        q: appliedSearch || undefined,
        missingLocation: onlyMissingLocation || undefined,
        limit: 300,
      });
      setServices(data);
    } catch (err) {
      setServices([]);
      setNotice({ text: err instanceof Error ? err.message : 'Failed to load services.', isError: true });
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter, appliedSearch, onlyMissingLocation]);

  useEffect(() => {
    if (activeTab === 'services') fetchServices();
  }, [activeTab, fetchServices]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !placingFor) return;
    const container = map.getContainer?.() as HTMLElement | undefined;
    if (container) container.style.cursor = 'crosshair';
    const targetId = placingFor;
    const onClick = async (e: any) => {
      const { lat, lng } = e.latlng.wrap();
      try {
        await updateServiceFields(targetId, {
          location: `SRID=4326;POINT(${lng} ${lat})`,
        });
        setPlacingFor(null);
        setPlacingError('');
        setNotice({ text: 'Pin saved. Check it on the map, then approve.', isError: false });
        setSelectedId(targetId);
        await fetchServices();
        map.flyTo([lat, lng], 18, { animate: true, duration: 0.8 });
      } catch (err) {
        setPlacingError(err instanceof Error ? err.message : 'Could not save location.');
      }
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
      if (container) container.style.cursor = '';
    };
  }, [placingFor, fetchServices]);

  useEffect(() => {
    if (!selectedId) return;
    document.getElementById(`svc-${selectedId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId]);

  const removeFromList = (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  };

  const changeStatus = async (service: AdminService, status: ServiceStatus, note?: string) => {
    try {
      await updateServiceStatus(service.id, status, note);
      removeFromList(service.id);
      setNotice({ text: `"${service.name}" is now ${status}.`, isError: false });
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Failed to update service.', isError: true });
    }
  };

  const submitRejection = async () => {
    if (!rejecting) return;
    const target = rejecting;
    const note = rejectNote.trim() || undefined;
    setRejecting(null);
    setRejectNote('');
    await changeStatus(target, 'rejected', note);
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

  const handleSelectFromList = (service: AdminService) => {
    setSelectedId(service.id);
    const place = places.find((p) => p.id === service.id);
    if (place) mapRef.current?.flyTo([place.lat, place.lng], 17, { animate: true, duration: 0.8 });
  };

  const startPlacing = (service: AdminService) => {
    setPlacingError('');
    setPlacingFor(service.id);
    setIsSidebarOpen(true);
    const place = places.find((p) => p.id === service.id);
    if (place) mapRef.current?.flyTo([place.lat, place.lng], 17, { animate: true, duration: 0.8 });
  };

  const openEdit = (service: AdminService) => {
    setEditing(service);
    setEditForm(toEditForm(service));
    setEditError('');
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm(null);
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editing || !editForm) return;
    if (!editForm.name.trim()) {
      setEditError('Name is required.');
      return;
    }
    const loc = buildLocation(editForm.latitude, editForm.longitude);
    if (!loc.ok) {
      setEditError(loc.message);
      return;
    }
    setSavingEdit(true);
    try {
      await updateServiceFields(editing.id, {
        name: editForm.name.trim(),
        type: editForm.type.trim() || null,
        formatted_address: editForm.formatted_address.trim() || null,
        phone: editForm.phone.trim() || null,
        website: editForm.website.trim() || null,
        opening_hours: editForm.opening_hours.trim() || null,
        wheelchair: editForm.wheelchair.trim() || null,
        ...(loc.value ? { location: loc.value } : {}),
      });
      const savedId = editing.id;
      closeEdit();
      setSelectedId(savedId);
      setNotice({ text: 'Changes saved.', isError: false });
      await fetchServices();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  const editField = (key: keyof EditForm, label: string, placeholder?: string) => (
    <>
      <label className="field-label" htmlFor={`edit-${key}`}>{label}</label>
      <input
        id={`edit-${key}`}
        className="auth-input"
        value={editForm?.[key] ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          setEditForm((prev) => (prev ? { ...prev, [key]: e.target.value } : prev));
          if (editError) setEditError('');
        }}
      />
    </>
  );

  if (loading) {
    return (
      <main className="guide-shell">
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'Cormorant SC', fontSize: 24 }}>
          Verifying admin access...
        </div>
      </main>
    );
  }

  const editCoords = editForm ? buildLocation(editForm.latitude, editForm.longitude) : null;

  return (
    <main className="admin-layout">
      <button
        className={`admin-dock-toggle ${isSidebarOpen ? 'open' : ''}`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <Menu size={18} />
        {isSidebarOpen ? 'Close Panel' : 'Admin Menu'}
      </button>

      <RoleSwitcher />

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
          {notice && (
            <div className={`admin-status-msg ${notice.isError ? 'error' : 'success'}`}>
              {notice.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
              <span>{notice.text}</span>
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
              className={`admin-tab ${activeTab === 'services' ? 'active' : ''}`}
              onClick={() => setActiveTab('services')}
            >
              Services
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

          {activeTab === 'services' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h3 className="admin-section-title" style={{ marginBottom: 0, borderBottom: 'none' }}>Services</h3>
                <button
                  onClick={() => setDetailedView(!detailedView)}
                  style={{
                    background: '#fff',
                    border: '1px solid #8b5a2b',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: '#4a2b16',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '4px 8px',
                    fontFamily: 'DM Sans, sans-serif',
                  }}
                  title={detailedView ? 'Switch to Simplified View' : 'Switch to Detailed View'}
                >
                  {detailedView ? <><List size={14} /> Simplified</> : <><LayoutGrid size={14} /> Detailed</>}
                </button>
              </div>

              <div className="admin-tabs" style={{ flexWrap: 'wrap' }}>
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.value}
                    className={`admin-tab ${statusFilter === f.value ? 'active' : ''}`}
                    onClick={() => { setStatusFilter(f.value); setDupesFor(null); }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => { e.preventDefault(); setAppliedSearch(searchInput.trim()); }}
                style={{ display: 'flex', gap: 6, margin: '8px 0' }}
              >
                <input
                  className="auth-input"
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder="Search by name…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button className="admin-action-btn" type="submit"><Search size={14} /></button>
              </form>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b4423', marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={onlyMissingLocation}
                  onChange={(e) => setOnlyMissingLocation(e.target.checked)}
                />
                Only services with no map pin
              </label>

              <button className="admin-btn" type="button" onClick={() => setSatellite((s) => !s)} style={{ marginBottom: 10 }}>
                <Layers size={18} />
                {satellite ? 'Street map' : 'Satellite view (confirm buildings)'}
              </button>

              {loadingList ? (
                <div style={{ textAlign: 'center', marginTop: 20 }}><Loader2 className="spin" /></div>
              ) : services.length === 0 ? (
                <p style={{ fontSize: 13, color: '#6b4423' }}>No {statusFilter} services match.</p>
              ) : (
                <div className="admin-service-list">
                  {services.map((service) => {
                    const coords = getCoordinates(service.location);
                    const hasPin = coords !== null;
                    return (
                      <div
                        key={service.id}
                        id={`svc-${service.id}`}
                        className="admin-service-card"
                        style={selectedId === service.id ? { outline: '2px solid #8b5a2b' } : undefined}
                      >
                        <div onClick={() => handleSelectFromList(service)}>
                          <h4>{service.name}</h4>
                          <p className="admin-card-type">{service.type ?? 'Uncategorised'}</p>

                          {detailedView && (
                            <>
                              {service.formatted_address && (
                                <p style={{ fontSize: 13, lineHeight: 1.4, whiteSpace: 'normal', marginBottom: 4 }}>
                                  {service.formatted_address}
                                </p>
                              )}
                              {service.phone && (
                                <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, marginBottom: 4, whiteSpace: 'normal' }}>
                                  <Phone size={12} /> {service.phone}
                                </p>
                              )}
                              {service.website && (
                                <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, marginBottom: 4, whiteSpace: 'normal' }}>
                                  <Globe size={12} />
                                  <a href={service.website} target="_blank" rel="noreferrer" style={{ color: '#8b5a2b' }}>
                                    {service.website}
                                  </a>
                                </p>
                              )}
                              {service.opening_hours && (
                                <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, marginBottom: 4, whiteSpace: 'normal' }}>
                                  <Clock3 size={12} /> {service.opening_hours}
                                </p>
                              )}
                              {service.review_note && statusFilter !== 'pending' && (
                                <p style={{ fontSize: 12, fontStyle: 'italic', marginBottom: 4, whiteSpace: 'normal' }}>
                                  Note: {service.review_note}
                                </p>
                              )}
                            </>
                          )}

                          {!detailedView && service.review_note && statusFilter !== 'pending' && (
                            <p style={{ fontStyle: 'italic', fontSize: 12 }}>Note: {service.review_note}</p>
                          )}

                          <p className="admin-card-meta">
                            Submitted {new Date(service.created_at).toLocaleDateString()}
                          </p>
                          {!hasPin && (
                            <p style={{ color: '#b5362d', fontSize: 12, fontWeight: 600 }}>
                              {service.status === 'approved'
                                ? 'No map pin — users cannot see this service. Place it or archive it.'
                                : 'No map pin yet — place it on the map before approving.'}
                            </p>
                          )}
                        </div>

                        <div className="admin-service-actions">
                          {service.status === 'pending' && (
                            <>
                              <button
                                className="admin-action-btn approve"
                                disabled={!hasPin}
                                title={hasPin ? 'Approve' : 'Place the service on the map first'}
                                onClick={() => changeStatus(service, 'approved')}
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button className="admin-action-btn reject" onClick={() => setRejecting(service)}>
                                <X size={14} /> Reject
                              </button>
                            </>
                          )}
                          {service.status === 'approved' && (
                            <button className="admin-action-btn" onClick={() => changeStatus(service, 'archived')}>
                              <Archive size={14} /> Archive
                            </button>
                          )}
                          {(service.status === 'rejected' || service.status === 'archived') && (
                            <button className="admin-action-btn" onClick={() => changeStatus(service, 'pending')}>
                              <RotateCcw size={14} /> Restore to pending
                            </button>
                          )}
                        </div>

                        <button type="button" onClick={() => openEdit(service)} style={linkButtonStyle}>
                          <Pencil size={12} /> Edit details
                        </button>

                        <button
                          type="button"
                          disabled={placingFor === service.id}
                          onClick={() => startPlacing(service)}
                          style={linkButtonStyle}
                        >
                          <MapPin size={12} />
                          {placingFor === service.id ? 'Click the map…' : hasPin ? 'Move pin' : 'Place on map'}
                        </button>

                        {detailedView && (
                          <>
                            {service.formatted_address && (
                              <a href={googleMapsAddressUrl(service.formatted_address)} target="_blank" rel="noreferrer" style={linkButtonStyle}>
                                <ExternalLink size={12} /> Verify address on Google Maps
                              </a>
                            )}
                            {coords && (
                              <a href={googleMapsPinUrl(coords[1], coords[0])} target="_blank" rel="noreferrer" style={linkButtonStyle}>
                                <ExternalLink size={12} /> Open pin in Google Maps
                              </a>
                            )}
                            <button type="button" onClick={() => checkDuplicates(service)} style={linkButtonStyle}>
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
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <h3 className="admin-section-title" style={{ marginTop: '40px' }}>Session</h3>

            <div style={{ marginBottom: '10px' }}>
              <RoleSwitcher />
            </div>
          
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
          onSelect={(place) => setSelectedId(place.id)}
          mapRef={mapRef}
          satellite={satellite}
          userLocation={null}
          incidents={incidents as TrafficIncident[]}
          routeTarget={null}
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

      {editing && editForm && (
        <div className="suggest-overlay" onClick={closeEdit}>
          <div
            className="suggest-modal"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="suggest-close" onClick={closeEdit} aria-label="Close">
              <X size={18} />
            </button>
            <h2>Edit service</h2>
            <p className="suggest-hint">Status: <strong>{editing.status}</strong></p>
            {editError && <p className="form-error" role="alert">{editError}</p>}
            {editField('name', 'Name *')}
            {editField('type', 'Category')}
            {editField('formatted_address', 'Address')}
            {editField('phone', 'Phone')}
            {editField('website', 'Website')}
            {editField('opening_hours', 'Opening hours')}
            {editField('wheelchair', 'Wheelchair access', 'yes / no / limited / unknown')}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>{editField('latitude', 'Latitude', '-33.9249')}</div>
              <div style={{ flex: 1 }}>{editField('longitude', 'Longitude', '18.4241')}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              <button
                type="button"
                style={linkButtonStyle}
                onClick={() => {
                  const target = editing;
                  closeEdit();
                  startPlacing(target);
                }}
              >
                <MapPin size={12} /> Pick location on the map
              </button>
              {editForm.formatted_address.trim() && (
                <a href={googleMapsAddressUrl(editForm.formatted_address.trim())} target="_blank" rel="noreferrer" style={linkButtonStyle}>
                  <ExternalLink size={12} /> Verify address on Google Maps
                </a>
              )}
              {editCoords?.ok && editCoords.value && (
                <a href={googleMapsPinUrl(Number(editForm.latitude), Number(editForm.longitude))} target="_blank" rel="noreferrer" style={linkButtonStyle}>
                  <ExternalLink size={12} /> Open pin in Google Maps
                </a>
              )}
            </div>
            <button
              className="submit-button"
              type="button"
              onClick={saveEdit}
              disabled={savingEdit}
              style={{ marginTop: 12 }}
            >
              {savingEdit ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}