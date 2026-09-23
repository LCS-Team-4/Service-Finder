import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, MapPinned, Minus, Plus, X } from 'lucide-react';
import { parseIncidentGeometry } from '../components/Map/LeafletMap';
import LeafletMap from '../components/Map/LeafletMap';
import GuideSearch from '../components/SearchBar/GuideSearch';
import ServicePopup from '../components/ServiceCard/ServicePopup';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { useServices } from '../hooks/useServices';
import { useTrafficIncidents } from '../hooks/useTrafficIncidents';
import { categoryColor } from '../utils/constants';
import type { Category, Place, Service } from '../types/service.types';

interface CategoryItem {
  name: Category;
  color: string;
}

/** Decode a Service.location into [longitude, latitude] or null. */
const getCoordinates = (location: Service['location']): [number, number] | null => {
  if (location && typeof location === 'object' && location.coordinates) return location.coordinates;
  if (typeof location !== 'string') return null;

  // WKT: "POINT(lng lat)" or "SRID=4326;POINT(lng lat)"
  const match = location.match(/(?:SRID=\d+;)?\s*POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
  if (match) return [Number(match[1]), Number(match[2])];

  // WKB hex (PostGIS binary)
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

/** Convert a raw Service row into a renderable Place, or null if unusable. */
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

const distanceKm = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  const R = 6371; // earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export default function Home() {
  const { services, loading, error } = useServices();
  const { incidents } = useTrafficIncidents();

  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Category | null>(null);
  const [selected, setSelected] = useState<Place | null>(null);
  const [notice, setNotice] = useState('');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [tracking, setTracking] = useState(false);
  const [routeTarget, setRouteTarget] = useState<Place | null>(null);
  const [radiusKm, setRadiusKm] = useState<number | null>(5);  // null = unlimited

  const mapRef = useRef<any>(null);
  const watchId = useRef<number | null>(null);
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

  const visible = useMemo(() => {
    const searched = places.filter((p) =>
      (!active || p.category === active) &&
      `${p.name} ${p.formatted_address ?? ''} ${p.category}`.toLowerCase().includes(query.toLowerCase()),
    );

    if (!userLocation || radiusKm === null) return searched;

    return searched.filter(
      (place) => distanceKm({ lat: place.lat, lng: place.lng }, userLocation) <= radiusKm,
    );
  }, [active, places, query, userLocation, radiusKm]);

  const visibleIncidents = useMemo(() => {
    if (!userLocation || radiusKm === null) return incidents;

    return incidents.filter((incident) => {
      const coords = parseIncidentGeometry(incident.geometry);
      if (coords.length === 0) return false;
      return coords.some(
        ([lng, lat]) => distanceKm({ lat, lng }, userLocation) <= radiusKm,
      );
    });
  }, [incidents, userLocation, radiusKm]);

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
      setNotice('Geolocation is not supported on this device.');
      return;
    }
    if (tracking) {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      hasCentered.current = false;
      setTracking(false);
      setUserLocation(null);
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
        setNotice('Showing your live location.');
      },
      () => {
        setNotice('We could not access your location.');
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  };

  const toggleSave = (name: string) => {
    setSaved((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    );
  };

  // Clean up the watcher on unmount.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);   // 4 seconds
    return () => clearTimeout(timer);
  }, [notice]);

  return (
    <main className="guide-shell">

      <div className="map-stage">
        <LeafletMap
          places={visible}
          selected={selected}
          onSelect={selectPlace}
          mapRef={mapRef}
          userLocation={userLocation}
        incidents={incidents}
        routeTarget={routeTarget}
        />

        <header className="masthead">
          <h1>The Cape Guide</h1>
          <p>Find. Navigate. Connect.</p>
        </header>

       <GuideSearch
          query={query}
          onQueryChange={setQuery}
          onSearch={search}
          onLocate={locate}
          tracking={tracking}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
        />

        {loading && <div className="notice">Loading services...</div>}
        {error && <div className="notice">{error}</div>}
        {notice && !loading && <div className="notice">{notice}</div>}

        {selected && (
          <ServicePopup
            place={selected}
            saved={saved.includes(selected.name)}
            onClose={() => {
              setSelected(null);
              setRouteTarget(null);
            }}
            onSave={() => toggleSave(selected.name)}
            onViewDetails={() => setNotice(`More details for ${selected.name} coming soon.`)}
            onGetDirections={() => {
              setRouteTarget(selected);
              setSelected(null);
              setNotice(`Getting road directions to ${selected.name}...`);
            }}
          />
        )}

                {routeTarget && (
          <button
            className="clear-route"
            onClick={() => {
              setRouteTarget(null);
              setNotice('');
            }}
          >
            Clear route
          </button>
        )}

        <button className="panel-trigger about-trigger" onClick={() => setAboutOpen(true)}>
          <BookOpen size={17} /> About the Guide
        </button>
        <button className="panel-trigger legend-trigger" onClick={() => setLegendOpen(true)}>
          <MapPinned size={17} /> Legend
        </button>

        {aboutOpen && (
          <aside className="about popup-panel">
            <button className="close-panel" aria-label="Close about" onClick={() => setAboutOpen(false)}>
              <X size={17} />
            </button>
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
            <button className="close-panel" aria-label="Close legend" onClick={() => setLegendOpen(false)}>
              <X size={17} />
            </button>
            <h2>Legend</h2>
            {categories.map((item) => (
              <button
                key={item.name}
                className={active === item.name ? 'active' : ''}
                onClick={() => {
                  setActive(active === item.name ? null : item.name);
                  setSelected(null);
                }}
              >
                <i style={{ background: item.color }}><CategoryIcon category={item.name} /></i>
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