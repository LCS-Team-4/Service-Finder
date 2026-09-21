import Login from './pages/Login';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Accessibility, BookOpen, Bookmark, Bus, Clock3, Flame, Globe,
  GraduationCap, Heart, Hospital, House, Landmark, Library, LocateFixed,
  MapPinned, Minus, Navigation, Phone, Pill, Plus, Search, Shield,
  ShoppingBag, Smile, Stethoscope, X,
} from 'lucide-react';
import Navbar from './components/common/Navbar';
import { useServices } from './hooks/useServices';
import type { Service } from './types/service.types';

declare const L: any;

type Category = string;
type Place = Omit<Service, 'category'> & { category: Category; lat: number; lng: number };
type CategoryItem = { name: Category; color: string };

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
  places, selected, onSelect, mapRef, userPosition, radiusMeters,
}: {
  places: Place[];
  selected: Place | null;
  onSelect: (place: Place) => void;
  mapRef: React.MutableRefObject<any>;
  userPosition: [number, number] | null;
  radiusMeters: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<any>(null);

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
    if (places.length > 0 && !userPosition) {
      mapRef.current?.fitBounds(
        L.latLngBounds(places.map((place) => [place.lat, place.lng])),
        { padding: [48, 48], maxZoom: 12 },
      );
    }
  }, [places, selected, onSelect, userPosition]);

  useEffect(() => {
    if (!mapRef.current || !userPosition) return;
    const map = mapRef.current;
    const circle = L.circle(userPosition, {
      radius: radiusMeters,
      color: '#005a8a',
      weight: 1,
      fillColor: '#08aef0',
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(map);
    return () => map.removeLayer(circle);
  }, [userPosition, radiusMeters, mapRef]);

  return <div className="leaflet-map" ref={root} />;
}

function CapeGuide() {
  const { services,   loading, error } = useServices();
  const [query,       setQuery] =       useState('');
  const [active,      setActive] =      useState<Category | null>(null);
  const [selected,    setSelected] =    useState<Place | null>(null);
  const [notice,      setNotice] =      useState('');
  const [aboutOpen,   setAboutOpen] =   useState(false);
  const [legendOpen,  setLegendOpen] =  useState(false);
  const [saved,       setSaved] =       useState<string[]>([]);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(2000);
  const mapRef =      useRef<any>(null);

  const places = useMemo(
    () => services.map(toPlace).filter((place): place is Place => place !== null),
    [services],
  );

  const categories = useMemo<CategoryItem[]>(
    () => Array.from(new Set(places.map((place) => place.category)))
      .map((name) => ({ name, color: categoryColor(name) })),
    [places],
  );

  const visible = useMemo(() => {
    const filtered = places.filter((p) => {
      if (active && p.category !== active) return false;
      if (query && !`${p.name} ${p.formatted_address ?? ''} ${p.category}`
        .toLowerCase().includes(query.toLowerCase())) return false;
      if (userPosition) {
        const d = distanceMeters(userPosition[0], userPosition[1], p.lat, p.lng);
        if (d > radiusMeters) return false;
      }
      return true;
    });

    if (userPosition) {
      filtered.sort((a, b) =>
        distanceMeters(userPosition[0], userPosition[1], a.lat, a.lng) -
        distanceMeters(userPosition[0], userPosition[1], b.lat, b.lng)
      );
    }

    return filtered;
  }, [active, places, query, userPosition, radiusMeters]);

  const selectPlace = useCallback((place: Place) => {
    setSelected(place);
    mapRef.current?.flyTo([place.lat, place.lng], 15, { animate: true, duration: 0.7 });
  }, []);

  const search = () => {
    const first = visible[0];
    if (first) selectPlace(first);
    setNotice(first ? `${visible.length} place${visible.length === 1 ? '' : 's'} found` : 'No places found');
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setNotice('Geolocation is not available on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPosition(coords);
        mapRef.current?.flyTo(coords, 14, { animate: true, duration: 0.7 });
        setNotice(`Showing services within ${radiusMeters / 1000} km.`);
      },
      () => setNotice('We could not access your location.'),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
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
          userPosition={userPosition}
          radiusMeters={radiusMeters}
        />

        <header className="masthead">
          <h1>The Cape Guide</h1>
          <p>Find. Navigate. Connect.</p>
        </header>

        <section className="search-panel">
          <span className="glass"><Search size={19} /></span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Search for a place or service..."
          />
          <button className="search-button" onClick={search}>Search</button>
          <button className="locate" title="Use my location" onClick={locate}>
            <LocateFixed size={17} />
          </button>
        </section>

        {loading && <div className="notice">Loading services...</div>}
        {error && <div className="notice">{error}</div>}
        {notice && !loading && <div className="notice">{notice}</div>}

        {userPosition && (
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
              onClick={() => {
                setUserPosition(null);
                setNotice('Showing all services.');
              }}
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
              <span className="service-icon" style={{ background: categories.find((c) => c.name === selected.category)?.color }}>
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
              <button className="directions" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`, '_blank', 'noopener,noreferrer')}>
                <Navigation size={14} /> Get Directions
              </button>
              <button
                className={saved.includes(selected.name) ? 'saved' : ''}
                onClick={() => setSaved(saved.includes(selected.name) ? saved.filter((name) => name !== selected.name) : [...saved, selected.name])}
              >
                <Bookmark size={15} /> {saved.includes(selected.name) ? 'Saved' : 'Save'}
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
  return accessToken ? <Dashboard /> : <Navigate to="/login" replace />;
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