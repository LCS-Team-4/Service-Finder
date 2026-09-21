import Login from './pages/Login';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Accessibility, BookOpen, Bookmark, Clock3, Flame, Globe, GraduationCap,
  Heart, Hospital, House, Landmark, Library, LocateFixed, MapPinned, Minus,
  Navigation, Phone, Pill, Plus, Search, Shield, ShoppingBag, Smile,
  Stethoscope, X,
} from 'lucide-react';
import Navbar from './components/common/Navbar';
import { useServices } from './hooks/useServices';
import type { Service } from './types/service.types';

declare const L: any;

type Category = string;
type Place = Omit<Service, 'category'> & { category: Category; lat: number; lng: number };
type CategoryItem = { name: Category; color: string };
type UserLocation = { lat: number; lng: number; accuracy: number };

const categoryColors = ['#b94b3c', '#4f876f', '#cb8c38', '#3b77a2', '#375f93', '#81528d', '#77909c', '#815c54', '#bd6240', '#75664b', '#a45b83', '#847337', '#43858a'];
const categoryColor = (category: string) =>
  categoryColors[Math.max(category.length - 1, 0) % categoryColors.length];

const getCoordinates = (location: Service['location']): [number, number] | null => {
  if (location && typeof location === 'object' && location.coordinates) return location.coordinates;
  if (typeof location !== 'string') return null;
  const match = location.match(/(?:SRID=\d+;)?\s*POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
  if (match) return [Number(match[1]), Number(match[2])];

  if (!/^[0-9a-f]+$/i.test(location) || location.length < 34) return null;
  const bytes = new Uint8Array(location.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
  const littleEndian = bytes[0] === 1;
  const view = new DataView(bytes.buffer);
  const geometryType = view.getUint32(1, littleEndian);
  const coordinateOffset = 5 + (geometryType & 0x20000000 ? 4 : 0);
  if ((geometryType & 0xff) !== 1 || bytes.length < coordinateOffset + 16) return null;
  return [
    view.getFloat64(coordinateOffset, littleEndian),
    view.getFloat64(coordinateOffset + 8, littleEndian),
  ];
};

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const formatDistance = (m: number) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

const toPlace = (service: Service): Place | null => {
  const coordinates = getCoordinates(service.location);
  if (!coordinates || coordinates.some((coordinate) => !Number.isFinite(coordinate))) return null;
  return {
    ...service,
    category: service.category?.name ?? service.type ?? 'Service',
    lat: coordinates[1],
    lng: coordinates[0],
  };
};

const categoryIcon = (category: Category, size = 14) => {
  const props = { size, strokeWidth: 2.2 };
  switch (category) {
    case 'Clinic':         return <Stethoscope    {...props} />;
    case 'Library':        return <Library        {...props} />;
    case 'Shelter':        return <House          {...props} />;
    case 'Hospital':       return <Hospital       {...props} />;
    case 'Police station': return <Shield         {...props} />;
    case 'Pharmacy':       return <Pill           {...props} />;
    case 'Dentist':        return <Smile          {...props} />;
    case 'Fire station':   return <Flame          {...props} />;
    case 'Home Affairs':   return <Landmark       {...props} />;
    case 'School':         return <GraduationCap  {...props} />;
    default:               return <MapPinned      {...props} />;
  }
};

function LeafletMap({
  places, selected, onSelect, mapRef,
  userLocation, radiusMeters, routeTarget,
}: {
  places: Place[];
  selected: Place | null;
  onSelect: (place: Place) => void;
  mapRef: React.MutableRefObject<any>;
  userLocation: UserLocation | null;
  radiusMeters: number | null;
  routeTarget: Place | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<any>(null);
  const userMarker = useRef<any>(null);
  const accuracyCircle = useRef<any>(null);
  const radiusCircle = useRef<any>(null);
  const routeLine = useRef<any>(null);
  const lastRouteKey = useRef<string>('');

  useEffect(() => {
    if (!root.current || !L) return;
    const map = L.map(root.current, { zoomControl: false, attributionControl: true })
      .setView([-33.96, 18.5], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    mapRef.current = map;
    layer.current = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 0);
    return () => map.remove();
  }, [mapRef]);

  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    places.forEach((place) => {
      const color = categoryColor(place.category);
      const icon = L.divIcon({
        className: 'cape-marker-wrap',
        html: `<div class="cape-marker" style="--marker:${color}"><span>${renderToStaticMarkup(categoryIcon(place.category, 14))}</span></div>`,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
      });
      const marker = L.marker([place.lat, place.lng], { icon }).addTo(layer.current);
      marker.bindTooltip(`<strong>${place.name}</strong><br>${place.category}`, { direction: 'top', offset: [0, -38] });
      marker.on('click', () => onSelect(place));
    });
    if (places.length > 0 && !userLocation) {
      mapRef.current?.fitBounds(
        L.latLngBounds(places.map((place) => [place.lat, place.lng])),
        { padding: [48, 48], maxZoom: 12 },
      );
    }
  }, [places, selected, onSelect, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;

    if (!userLocation) {
      if (userMarker.current) { map.removeLayer(userMarker.current); userMarker.current = null; }
      if (accuracyCircle.current) { map.removeLayer(accuracyCircle.current); accuracyCircle.current = null; }
      return;
    }

    const { lat, lng, accuracy } = userLocation;
    if (!userMarker.current) {
      const icon = L.divIcon({
        className: 'user-location-wrap',
        html: '<span class="user-location-pulse"></span><span class="user-location-dot"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      userMarker.current = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
      accuracyCircle.current = L.circle([lat, lng], {
        radius: accuracy, color: '#22c55e', weight: 1,
        fillColor: '#22c55e', fillOpacity: 0.12, interactive: false,
      }).addTo(map);
    } else {
      userMarker.current.setLatLng([lat, lng]);
      accuracyCircle.current.setLatLng([lat, lng]);
      accuracyCircle.current.setRadius(accuracy);
    }
  }, [userLocation, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;
    if (!userLocation || radiusMeters === null) {
      if (radiusCircle.current) { map.removeLayer(radiusCircle.current); radiusCircle.current = null; }
      return;
    }
    const center: [number, number] = [userLocation.lat, userLocation.lng];
    if (!radiusCircle.current) {
      radiusCircle.current = L.circle(center, {
        radius: radiusMeters, color: '#005a8a', weight: 1,
        fillColor: '#08aef0', fillOpacity: 0.08, interactive: false,
      }).addTo(map);
    } else {
      radiusCircle.current.setLatLng(center);
      radiusCircle.current.setRadius(radiusMeters);
    }
  }, [userLocation, radiusMeters, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;

    if (!userLocation || !routeTarget) {
      if (routeLine.current) { map.removeLayer(routeLine.current); routeLine.current = null; }
      lastRouteKey.current = '';
      return;
    }

    const key = `${routeTarget.lat.toFixed(4)},${routeTarget.lng.toFixed(4)}|${userLocation.lat.toFixed(3)},${userLocation.lng.toFixed(3)}`;
    if (key === lastRouteKey.current && routeLine.current) return;
    lastRouteKey.current = key;

    const controller = new AbortController();
    const from = `${userLocation.lng},${userLocation.lat}`;
    const to = `${routeTarget.lng},${routeTarget.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${from};${to}?overview=full&geometries=geojson`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Routing request failed');
        return res.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const coords = data?.routes?.[0]?.geometry?.coordinates?.map(
          (c: [number, number]) => [c[1], c[0]] as [number, number],
        ) ?? null;
        const latlngs: [number, number][] = coords && coords.length > 1
          ? coords
          : [[userLocation.lat, userLocation.lng], [routeTarget.lat, routeTarget.lng]];

        if (!routeLine.current) {
          routeLine.current = L.polyline(latlngs, { color: '#1f9450', weight: 5, opacity: 0.9 }).addTo(map);
        } else {
          routeLine.current.setLatLngs(latlngs);
        }

        try {
          map.fitBounds(L.latLngBounds(latlngs), { padding: [48, 48], maxZoom: 16, animate: true });
        } catch { /* ignore */ }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        const latlngs: [number, number][] = [
          [userLocation.lat, userLocation.lng],
          [routeTarget.lat, routeTarget.lng],
        ];
        if (!routeLine.current) {
          routeLine.current = L.polyline(latlngs, {
            color: '#1f9450', weight: 5, opacity: 0.9, dashArray: '8 10',
          }).addTo(map);
        } else {
          routeLine.current.setLatLngs(latlngs);
        }
      });

    return () => controller.abort();
  }, [userLocation, routeTarget, mapRef]);

  return <div className="leaflet-map" ref={root} />;
}

function CapeGuide() {
  const { services, loading, error } = useServices();
  const [query,        setQuery]        = useState('');
  const [active,       setActive]       = useState<Category | null>(null);
  const [selected,     setSelected]     = useState<Place | null>(null);
  const [notice,       setNotice]       = useState('');
  const [aboutOpen,    setAboutOpen]    = useState(false);
  const [legendOpen,   setLegendOpen]   = useState(false);
  const [saved,        setSaved]        = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [tracking,     setTracking]     = useState(false);
  const [radiusMeters, setRadiusMeters] = useState<number | null>(2000);
  const [resultsOpen,  setResultsOpen]  = useState(false);
  const [routeTarget,  setRouteTarget]  = useState<Place | null>(null);
  const mapRef =      useRef<any>(null);
  const watchId =     useRef<number | null>(null);
  const hasCentered = useRef(false);

  const places = useMemo(
    () => services.map(toPlace).filter((place): place is Place => place !== null),
    [services],
  );

  const categories = useMemo<CategoryItem[]>(
    () => Array.from(new Set(places.map((place) => place.category)))
      .map((name) => ({ name, color: categoryColor(name) })),
    [places],
  );

  const matchesQuery = useCallback((place: Place, q: string) => {
    const term = q.trim().toLowerCase();
    if (!term) return true;
    const haystack = `${place.name} ${place.formatted_address ?? ''} ${place.category}`.toLowerCase();
    if (haystack.includes(term)) return true;
    const categoryWords = place.category.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
    return categoryWords.some((word) => word.startsWith(term) || term.startsWith(word));
  }, []);

  const visible = useMemo(() => {
    const filtered = places.filter((p) => {
      if (active && p.category !== active) return false;
      if (!matchesQuery(p, query)) return false;
      if (userLocation && radiusMeters !== null) {
        const d = distanceMeters(userLocation.lat, userLocation.lng, p.lat, p.lng);
        if (d > radiusMeters) return false;
      }
      return true;
    });

    if (userLocation && radiusMeters !== null) {
      filtered.sort((a, b) =>
        distanceMeters(userLocation.lat, userLocation.lng, a.lat, a.lng) -
        distanceMeters(userLocation.lat, userLocation.lng, b.lat, b.lng)
      );
    }

    return filtered;
  }, [active, places, query, userLocation, radiusMeters, matchesQuery]);

  // Search dropdown shows ALL matches (ignores radius so users can find far places too)
  const sortedResults = useMemo(() => {
    const list = places.filter((p) =>
      (!active || p.category === active) && matchesQuery(p, query)
    );
    if (userLocation) {
      list.sort((a, b) =>
        distanceMeters(userLocation.lat, userLocation.lng, a.lat, a.lng) -
        distanceMeters(userLocation.lat, userLocation.lng, b.lat, b.lng)
      );
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [places, active, query, userLocation, matchesQuery]);

  const selectPlace = useCallback((place: Place) => {
    setSelected(place);
    mapRef.current?.flyTo([place.lat, place.lng], 15, { animate: true, duration: 0.7 });
  }, []);

  const search = () => {
    const first = sortedResults[0];
    if (first) selectPlace(first);
    setNotice(first
      ? `${sortedResults.length} place${sortedResults.length === 1 ? '' : 's'} found`
      : 'No places found');
  };

  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  const locate = () => {
    if (!navigator.geolocation) {
      setNotice('Geolocation is not supported on this device.');
      return;
    }
    if (tracking) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      hasCentered.current = false;
      setTracking(false);
      setUserLocation(null);
      setRouteTarget(null);
      setNotice('Live location turned off.');
      return;
    }
    setTracking(true);
    setNotice('Getting your live location...');
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        if (!hasCentered.current) {
          mapRef.current?.flyTo([latitude, longitude], 15, { animate: true, duration: 0.7 });
          hasCentered.current = true;
        }
        setNotice(radiusMeters === null
          ? 'Showing your live location.'
          : `Showing services within ${radiusMeters / 1000} km.`);
      },
      () => {
        setNotice('We could not access your location.');
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  };

  const getDirections = (place: Place) => {
    setRouteTarget(place);
    if (!tracking) locate();
    setNotice(`Getting road directions to ${place.name}...`);
  };

  const clearFilter = () => {
    setRadiusMeters(null);
    setNotice('Showing all services.');
  };

  return (
    <main className="guide-shell">
      <Navbar />

      <div className="map-stage">
        <LeafletMap
          places={visible}
          selected={selected}
          onSelect={selectPlace}
          mapRef={mapRef}
          userLocation={userLocation}
          radiusMeters={radiusMeters}
          routeTarget={routeTarget}
        />

        <header className="masthead">
          <h1>The Cape Guide</h1>
          <p>Find. Navigate. Connect.</p>
        </header>

        <section className="search-panel">
          <span className="glass"><Search size={19} /></span>
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setResultsOpen(true); }}
            onFocus={() => query.trim() && setResultsOpen(true)}
            onBlur={() => setTimeout(() => setResultsOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { search(); setResultsOpen(false); }
              if (e.key === 'Escape') setResultsOpen(false);
            }}
            placeholder="Search for a place or service..."
          />
          <button className="search-button" onClick={() => { search(); setResultsOpen(false); }}>
            Search
          </button>
          <button
            className={`locate${tracking ? ' active' : ''}`}
            title={tracking ? 'Stop live location' : 'Show my live location'}
            onClick={locate}
          >
            <LocateFixed size={17} />
          </button>
        </section>

        {resultsOpen && query.trim() && (
          <div className="search-results" onMouseDown={(e) => e.preventDefault()}>
            {sortedResults.length === 0 ? (
              <div className="search-results-empty">No places found</div>
            ) : (
              sortedResults.slice(0, 20).map((place) => (
                <div
                  key={place.id}
                  className="search-result-row"
                  onClick={() => {
                    selectPlace(place);
                    setQuery(place.name);
                    setResultsOpen(false);
                  }}
                >
                  <span
                    className="search-result-icon"
                    style={{ background: categoryColor(place.category) }}
                  >
                    {categoryIcon(place.category, 14)}
                  </span>
                  <div className="search-result-info">
                    <strong>{place.name}</strong>
                    <span>
                      {place.category}
                      {userLocation
                        ? ` · ${formatDistance(distanceMeters(userLocation.lat, userLocation.lng, place.lat, place.lng))} away`
                        : ''}
                    </span>
                  </div>
                  <button
                    className="search-result-directions"
                    onClick={(e) => {
                      e.stopPropagation();
                      getDirections(place);
                      setQuery(place.name);
                      setResultsOpen(false);
                    }}
                  >
                    <Navigation size={13} />
                    Directions
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {loading && <div className="notice">Loading services...</div>}
        {error && <div className="notice">{error}</div>}
        {notice && !loading && <div className="notice">{notice}</div>}

        {userLocation && (
          <div className="radius-control">
            {[1000, 2000, 5000, 10000, 25000].map((r) => (
              <button
                key={r}
                className={radiusMeters === r ? 'active' : ''}
                onClick={() => setRadiusMeters(r)}
              >
                {r / 1000} km
              </button>
            ))}
            <button
              className={radiusMeters === null ? 'active' : ''}
              onClick={clearFilter}
            >
              All
            </button>
          </div>
        )}

        {selected && (
          <section className="service-popup">
            <button className="service-close" aria-label="Close service" onClick={() => setSelected(null)}>
              <X size={18} />
            </button>
            <div className="service-title">
              <span className="service-icon" style={{ background: categoryColor(selected.category) }}>
                {categoryIcon(selected.category, 18)}
              </span>
              <div>
                <h2>{selected.name}</h2>
                <p>{selected.category}</p>
              </div>
            </div>
            <div className="service-info">
              <p><MapPinned size={17} /><span>{selected.formatted_address ?? 'Address unavailable'}</span></p>
              {selected.opening_hours && <p><Clock3 size={17} />{selected.opening_hours}</p>}
              {selected.phone && <p><Phone size={17} />{selected.phone}</p>}
              {selected.website && <p><Globe size={17} /><a href={selected.website} target="_blank" rel="noreferrer">Visit website</a></p>}
              {selected.wheelchair && <p><Accessibility size={17} />Wheelchair access: {selected.wheelchair}</p>}
            </div>
            <div className="service-actions">
              <button className="directions" onClick={() => getDirections(selected)}>
                <Navigation size={14} /> Get Directions
              </button>
              <button
                className={saved.includes(selected.id) ? 'saved' : ''}
                onClick={() => setSaved(saved.includes(selected.id)
                  ? saved.filter((id) => id !== selected.id)
                  : [...saved, selected.id])}
              >
                <Bookmark size={15} /> {saved.includes(selected.id) ? 'Saved' : 'Save'}
              </button>
            </div>
          </section>
        )}

        <button className="panel-trigger about-trigger" onClick={() => setAboutOpen(true)}>
          <BookOpen size={17} /> About the Guide
        </button>
        <button className="panel-trigger legend-trigger" onClick={() => setLegendOpen(true)}>
          <MapPinned size={17} /> Legend
        </button>

        {aboutOpen && (
          <aside className="about popup-panel">
            <button className="close-panel" aria-label="Close about" onClick={() => setAboutOpen(false)}><X size={17} /></button>
            <h2>About the Cape<br />Guide</h2>
            <p>
              The Cape Guide is a map-based service finder designed to help people
              discover useful public services across Cape Town. Search, explore
              and navigate to the services you need — all from one map.
            </p>
            <div className="motto">Every road leads somewhere.<br />Every service helps someone.</div>
          </aside>
        )}

        {legendOpen && (
          <aside className="legend popup-panel">
            <button className="close-panel" aria-label="Close legend" onClick={() => setLegendOpen(false)}><X size={17} /></button>
            <h2>Legend</h2>
            {categories.map((item) => (
              <button
                key={item.name}
                className={active === item.name ? 'active' : ''}
                onClick={() => { setActive(active === item.name ? null : item.name); setSelected(null); }}
              >
                <i style={{ background: item.color }}>{categoryIcon(item.name)}</i>
                {item.name}
              </button>
            ))}
            <button className="you-are" onClick={locate}>
              <i><MapPinned size={16} /></i>
              You Are Here
            </button>
          </aside>
        )}

        <div className="leaflet-zoom">
          <button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}><Plus size={18} /></button>
          <button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}><Minus size={18} /></button>
        </div>
      </div>
    </main>
  );
}

function ProtectedDashboard() {
  const accessToken = localStorage.getItem('servicefinder_access_token');
  return accessToken ? <CapeGuide /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CapeGuide />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedDashboard />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}