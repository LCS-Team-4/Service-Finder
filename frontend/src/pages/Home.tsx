import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, MapPinned, Minus, Plus, X, LocateFixed } from 'lucide-react';
import LeafletMap, { parseIncidentGeometry } from '../components/Map/LeafletMap';
import GuideSearch from '../components/SearchBar/GuideSearch';
import ServicePopup from '../components/ServiceCard/ServicePopup';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { IncidentIcon } from '../components/common/IncidentIcon';
import { useServices } from '../hooks/useServices';
import { useTrafficIncidents } from '../hooks/useTrafficIncidents';
import { categoryColor } from '../utils/constants';
import { buildIncidentLegend } from '../services/trafficLegend';
import { distanceKm, isMobileViewport } from '../utils/geo';
import { ScrollHint } from '../components/common/ScrollHint';
import type { Category, Place, Service } from '../types/service.types';

interface CategoryItem {
  name: Category;
  color: string;
}

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
  const [radiusKm, setRadiusKm] = useState<number | null>(5);
  const [hiddenIncidents, setHiddenIncidents] = useState<Set<number | null>>(() => new Set());

  const isMobile = useMemo(() => isMobileViewport(), []);

  const mapRef = useRef<any>(null);
  const watchId = useRef<number | null>(null);
  const hasCentered = useRef(false);
  const legendPanelRef = useRef<HTMLElement>(null);
  const aboutPanelRef = useRef<HTMLElement>(null);

  const allPlaces = useMemo(
    () => services.map(toPlace).filter((place): place is Place => place !== null),
    [services],
  );

  const places = useMemo(() => {
    if (isMobile && !userLocation) return [];
    return allPlaces;
  }, [allPlaces, isMobile, userLocation]);

  const categories = useMemo<CategoryItem[]>(
    () => Array.from(new Set(allPlaces.map((place) => place.category)))
      .map((name) => ({ name, color: categoryColor(name) })),
    [allPlaces],
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

  const nearbyIncidents = useMemo(() => {
    if (!userLocation || radiusKm === null) return incidents;

    return incidents.filter((incident) => {
      const coords = parseIncidentGeometry(incident.geometry);
      if (coords.length === 0) return false;
      return coords.some(
        ([lng, lat]) => distanceKm({ lat, lng }, userLocation) <= radiusKm,
      );
    });
  }, [incidents, userLocation, radiusKm]);

  const incidentLegend = useMemo(
    () => buildIncidentLegend(nearbyIncidents),
    [nearbyIncidents],
  );

  const visibleIncidents = useMemo(
    () => nearbyIncidents.filter(
      (incident) => !hiddenIncidents.has(incident.icon_category ?? null),
    ),
    [nearbyIncidents, hiddenIncidents],
  );

  const toggleIncident = useCallback((code: number | null) => {
    setHiddenIncidents((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

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
        if (!hasCentered.current && accuracy < 500) {
          mapRef.current?.flyTo([latitude, longitude], 15, { animate: true, duration: 0.7 });
          hasCentered.current = true;
        }
        setNotice(
          accuracy < 100
            ? 'Showing your live location.'
            : `Live location ±${Math.round(accuracy)} m — still refining…`,
        );
      },
      (err) => {
        if (hasCentered.current) {
          if (err.code === err.PERMISSION_DENIED) {
            setNotice('Location permission was revoked.');
            setTracking(false);
          }
          return;
        }
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setNotice('Location permission denied. Enable it in browser settings.');
            break;
          case err.POSITION_UNAVAILABLE:
            setNotice('Location unavailable. Check your device settings.');
            break;
          case err.TIMEOUT:
            setNotice('Location request timed out. Try again.');
            break;
          default:
            setNotice('We could not access your location.');
        }
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  };

  const toggleSave = (name: string) => {
    setSaved((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    );
  };

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  const showMobilePrompt = isMobile && !userLocation && !loading;

  return (
    <main className="guide-shell">
      <div className="map-stage">
        <LeafletMap
          places={visible}
          selected={selected}
          onSelect={selectPlace}
          mapRef={mapRef}
          userLocation={userLocation}
          incidents={visibleIncidents}
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

        {showMobilePrompt && (
          <div className="mobile-locate-prompt">
            <button className="mobile-locate-button" onClick={locate}>
              <LocateFixed size={18} />
              Find services near me
            </button>
          </div>
        )}

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

        <button
          className="panel-trigger about-trigger"
          onClick={() => {
            setAboutOpen((open) => !open);
            setLegendOpen(false);
          }}
        >
          <BookOpen size={17} /> About the Guide
        </button>
        <button
          className="panel-trigger legend-trigger"
          onClick={() => {
            setLegendOpen((open) => !open);
            setAboutOpen(false);
          }}
        >
          <MapPinned size={17} /> Legend
        </button>

        {aboutOpen && (
          <aside className="about popup-panel" ref={aboutPanelRef}>
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
          <aside className="legend popup-panel" ref={legendPanelRef}>
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

            <h3 className="legend-heading">
              Traffic &amp; road works
              <span className="legend-count">
                {visibleIncidents.length}/{nearbyIncidents.length}
              </span>
            </h3>

            {incidentLegend.length === 0 ? (
              <p className="legend-hint">No incidents reported nearby.</p>
            ) : (
              incidentLegend.map((item) => (
                <button
                  key={item.label}
                  className={hiddenIncidents.has(item.code) ? 'legend-toggle off' : 'legend-toggle'}
                  aria-pressed={!hiddenIncidents.has(item.code)}
                  title={`${hiddenIncidents.has(item.code) ? 'Show' : 'Hide'} ${item.label.toLowerCase()}`}
                  onClick={() => toggleIncident(item.code)}
                >
                  <i style={{ background: item.color }}><IncidentIcon category={item.code} /></i>
                  {item.label}
                  <span className="legend-count">{item.count}</span>
                </button>
              ))
            )}

            {hiddenIncidents.size > 0 && (
              <button
                className="legend-show-all"
                onClick={() => setHiddenIncidents(new Set())}
              >
                Show all road events
              </button>
            )}

            <button className="you-are" onClick={locate}>
              <i><MapPinned size={16} /></i>
              You Are Here
            </button>
            <ScrollHint targetRef={legendPanelRef} label="Scroll for more" />
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