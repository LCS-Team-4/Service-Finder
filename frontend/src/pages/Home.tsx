import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Layers, MapPinned, Minus, Plus, X, LocateFixed } from 'lucide-react';
import LeafletMap, { parseIncidentGeometry } from '../components/Map/LeafletMap';
import WeatherWidget from '../components/Map/WeatherWidget';
import GuideSearch from '../components/SearchBar/GuideSearch';
import ServicePopup from '../components/ServiceCard/ServicePopup';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { IncidentIcon } from '../components/common/IncidentIcon';
import { useServices } from '../hooks/useServices';
import { useTrafficIncidents } from '../hooks/useTrafficIncidents';
import { useWeather } from '../hooks/useWeather';
import { categoryColor } from '../utils/constants';
import { buildIncidentLegend } from '../services/trafficLegend';
import { distanceKm, isMobileViewport } from '../utils/geo';
import { ScrollHint } from '../components/common/ScrollHint';
import type { Category, Place, Service } from '../types/service.types';

interface CategoryItem {
  name: Category;
  color: string;
}

interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
}

const DEFAULT_WEATHER_LOCATION = { lat: -33.96, lng: 18.5 };

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

// PERF: cache Place objects by service ID so the geometry parser doesn't rerun
// for every row whenever Dexie emits a fresh `services` array (e.g. on refresh).
const placeCache = new Map<string, Place | null>();

const toPlace = (service: Service): Place | null => {
  if (placeCache.has(service.id)) return placeCache.get(service.id) ?? null;
  const coordinates = getCoordinates(service.location);
  if (!coordinates || coordinates.some((coordinate) => !Number.isFinite(coordinate))) {
    placeCache.set(service.id, null);
    return null;
  }
  const place: Place = {
    ...service,
    category: service.category?.name ?? service.type ?? 'Service',
    parentCategory: service.category?.parent?.name ?? null,
    lat: coordinates[1],
    lng: coordinates[0],
  };
  placeCache.set(service.id, place);
  return place;
};

export default function Home() {
  const { services, loading, error } = useServices();
  const { incidents } = useTrafficIncidents();

  const [isMapMoving, setIsMapMoving] = useState(false);
  const [query, setQuery] = useState('');
  // PERF: keep the input snappy while the heavy memos filter at low priority.
  const deferredQuery = useDeferredValue(query);
  const [active, setActive] = useState<Set<Category>>(() => new Set());
  const [selected, setSelected] = useState<Place | null>(null);
  const [notice, setNotice] = useState('');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [tracking, setTracking] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [routeTarget, setRouteTarget] = useState<Place | null>(null);
  const [searchLocationStatus, setSearchLocationStatus] = useState<'idle' | 'locating' | 'unavailable'>('idle');
  const [radiusKm, setRadiusKm] = useState<number | null>(5);
  const [hiddenIncidents, setHiddenIncidents] = useState<Set<number | null>>(() => new Set());
  const weatherLocation = userLocation ?? DEFAULT_WEATHER_LOCATION;
  const { weather, error: weatherError, now } = useWeather(weatherLocation.lat, weatherLocation.lng);

  const isMobile = useMemo(() => isMobileViewport(), []);

  const mapRef = useRef<any>(null);
  const watchId = useRef<number | null>(null);
  const locationRequest = useRef<Promise<UserLocation> | null>(null);
  const requestedCategoryLocation = useRef('');
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

  // Per-category totals within the current radius (denominator in "X of Y").
  const categoryTotals = useMemo(() => {
    const totals = new Map<Category, number>();
    for (const place of allPlaces) {
      if (userLocation && radiusKm !== null) {
        if (distanceKm({ lat: place.lat, lng: place.lng }, userLocation) > radiusKm) continue;
      }
      totals.set(place.category, (totals.get(place.category) ?? 0) + 1);
    }
    return totals;
  }, [allPlaces, userLocation, radiusKm]);

  // Per-category matches for the current search text (numerator in "X of Y").
  const categoryMatches = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const matches = new Map<Category, number>();
    for (const place of allPlaces) {
      if (userLocation && radiusKm !== null) {
        if (distanceKm({ lat: place.lat, lng: place.lng }, userLocation) > radiusKm) continue;
      }
      const haystack = `${place.name} ${place.formatted_address ?? ''} ${place.category}`.toLowerCase();
      if (q && !haystack.includes(q)) continue;
      matches.set(place.category, (matches.get(place.category) ?? 0) + 1);
    }
    return matches;
  }, [allPlaces, deferredQuery, userLocation, radiusKm]);

  const matchingCategoryNames = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return [];
    return Array.from(new Set(allPlaces
      .filter((place) => {
        const category = place.category.toLocaleLowerCase();
        const parent = place.parentCategory?.toLocaleLowerCase() ?? '';
        return category.includes(normalizedQuery)
          || normalizedQuery.includes(category)
          || parent.includes(normalizedQuery)
          || (parent && normalizedQuery.includes(parent));
      })
      .map((place) => place.category)));
  }, [allPlaces, deferredQuery]);

  const categorySuggestions = useMemo(() => {
    if (matchingCategoryNames.length === 0) return [];
    return allPlaces
      .filter((place) => matchingCategoryNames.includes(place.category))
      .map((place) => ({
        place,
        distanceKm: userLocation
          ? distanceKm({ lat: place.lat, lng: place.lng }, userLocation)
          : null,
      }))
      .sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        if (a.distanceKm !== null) return -1;
        if (b.distanceKm !== null) return 1;
        return a.place.name.localeCompare(b.place.name);
      });
  }, [allPlaces, matchingCategoryNames, userLocation]);

  const requestCurrentLocation = useCallback((): Promise<UserLocation> => {
    if (userLocation) return Promise.resolve(userLocation);
    if (!navigator.geolocation) return Promise.reject(new Error('Geolocation is not supported on this device.'));
    if (locationRequest.current) return locationRequest.current;

    locationRequest.current = new Promise<UserLocation>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setUserLocation(location);
          resolve(location);
        },
        (error) => {
          const message = error.code === error.PERMISSION_DENIED
            ? 'Location permission denied. Enable it in browser settings to sort nearby services and get directions.'
            : error.code === error.TIMEOUT
              ? 'Location request timed out. Try again.'
              : 'Location unavailable. Check your device settings.';
          reject(new Error(message));
        },
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 },
      );
    }).finally(() => {
      locationRequest.current = null;
    });

    return locationRequest.current;
  }, [userLocation]);

  useEffect(() => {
    if (matchingCategoryNames.length === 0) {
      requestedCategoryLocation.current = '';
      setSearchLocationStatus('idle');
      return;
    }
    if (userLocation) {
      setSearchLocationStatus('idle');
      return;
    }

    const categoryKey = matchingCategoryNames.join('|');
    if (requestedCategoryLocation.current === categoryKey) return;
    requestedCategoryLocation.current = categoryKey;
    setSearchLocationStatus('locating');
    requestCurrentLocation()
      .then(() => setSearchLocationStatus('idle'))
      .catch(() => setSearchLocationStatus('unavailable'));
  }, [matchingCategoryNames, requestCurrentLocation, userLocation]);

  const visible = useMemo(() => {
    const q = deferredQuery.toLowerCase();
    const searched = places.filter((place) =>
      (active.size === 0 || active.has(place.category)) &&
      `${place.name} ${place.formatted_address ?? ''} ${place.category}`.toLowerCase().includes(q),
    );

    if (!userLocation || radiusKm === null) return searched;

    return searched.filter(
      (place) => distanceKm({ lat: place.lat, lng: place.lng }, userLocation) <= radiusKm,
    );
  }, [active, places, deferredQuery, userLocation, radiusKm]);

  const incidentLegend = useMemo(
    () => buildIncidentLegend(incidents),
    [incidents],
  );

  const visibleIncidents = useMemo(
    () => incidents.filter(
      (incident) => !hiddenIncidents.has(incident.icon_category ?? null),
    ),
    [incidents, hiddenIncidents],
  );

  const toggleIncident = useCallback((code: number | null) => {
    setHiddenIncidents((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const toggleCategory = useCallback((category: Category) => {
    setActive((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
    setSelected(null);
  }, []);

  const selectPlace = useCallback((place: Place) => {
    setSelected(place);
    mapRef.current?.flyTo([place.lat, place.lng], 15, { animate: true, duration: 0.7 });
  }, []);

  const search = async () => {
    let results = matchingCategoryNames.length > 0
      ? categorySuggestions
      : visible.map((place) => ({
          place,
          distanceKm: userLocation ? distanceKm({ lat: place.lat, lng: place.lng }, userLocation) : null,
        }));

    if (matchingCategoryNames.length > 0 && !userLocation) {
      setSearchLocationStatus('locating');
      try {
        const location = await requestCurrentLocation();
        results = allPlaces
          .filter((place) => matchingCategoryNames.includes(place.category))
          .map((place) => ({
            place,
            distanceKm: distanceKm({ lat: place.lat, lng: place.lng }, location),
          }))
          .sort((a, b) => a.distanceKm! - b.distanceKm!);
        setSearchLocationStatus('idle');
      } catch {
        setSearchLocationStatus('unavailable');
      }
    }

    const first = results[0]?.place;
    if (first) selectPlace(first);
    setNotice(first ? `${results.length} place${results.length === 1 ? '' : 's'} found` : 'No places found');
  };

  const getDirections = useCallback(async (place: Place) => {
    let origin = userLocation;
    if (!origin) {
      setNotice('Getting your current location for directions...');
      try {
        origin = await requestCurrentLocation();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Unable to get your current location.');
        return;
      }
    }

    mapRef.current?.flyTo([origin.lat, origin.lng], 18, { animate: true, duration: 0.7 });
    setSelected(null);
    setRouteTarget(place);
    setNotice(`Getting road directions to ${place.name}...`);
  }, [userLocation, requestCurrentLocation]);

  const selectSuggestion = (place: Place) => {
    setQuery(place.name);
    setSelected(place);
    setRouteTarget(null);
    mapRef.current?.flyTo([place.lat, place.lng], 15, { animate: true, duration: 0.7 });
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setNotice('Geolocation is not supported on this device.');
      return;
    }
    if (tracking) {
      const lastLocation = userLocation;
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      hasCentered.current = false;
      setTracking(false);
      setUserLocation(null);
      mapRef.current?.flyTo(
        lastLocation ? [lastLocation.lat, lastLocation.lng] : [-33.96, 18.5],
        11,
        { animate: true, duration: 0.8 },
      );
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

  // PERF: stable callbacks so memo() on ServicePopup actually prevents re-renders.
  const handleClosePopup = useCallback(() => {
    setSelected(null);
    setRouteTarget(null);
  }, []);

  const handleSaveSelected = useCallback(() => {
    if (!selected) return;
    setSaved((current) =>
      current.includes(selected.name)
        ? current.filter((n) => n !== selected.name)
        : [...current, selected.name],
    );
  }, [selected]);

  const handleDirectionsForSelected = useCallback(() => {
    if (selected) void getDirections(selected);
  }, [getDirections, selected]);

  const showMobilePrompt = isMobile && !userLocation && !loading;

  return (
    <main className="guide-shell">
      <div className="map-stage">
        <LeafletMap
          places={routeTarget ? [routeTarget] : visible}
          selected={selected}
          onSelect={selectPlace}
          mapRef={mapRef}
          satellite={satellite}
          userLocation={userLocation}
          incidents={visibleIncidents}
          routeTarget={routeTarget}
          onMapMoving={setIsMapMoving}
        />

        <header className={`masthead ${isMapMoving ? 'is-faded' : ''}`}>
          <h1>The Cape Guide</h1>
          <p>Find. Navigate. Connect.</p>
        </header>

        <GuideSearch
          query={query}
          onQueryChange={setQuery}
          onSearch={search}
          suggestions={categorySuggestions}
          showSuggestions={!routeTarget && matchingCategoryNames.length > 0}
          locationStatus={searchLocationStatus}
          onSelectSuggestion={selectSuggestion}
          onGetDirections={getDirections}
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
            onClose={handleClosePopup}
            onSave={handleSaveSelected}
            onGetDirections={handleDirectionsForSelected}
          />
        )}

        {routeTarget && (
          <button
            className="clear-route"
            onClick={() => {
              if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
              watchId.current = null;
              hasCentered.current = false;
              setTracking(false);
              setUserLocation(null);
              setRouteTarget(null);
              setSelected(null);
              setQuery('');
              setActive(new Set());
              setRadiusKm(null);
              mapRef.current?.flyTo([-33.96, 18.5], 11, { animate: true, duration: 0.8 });
              setNotice('Route cleared. Showing all services.');
            }}
          >
            Clear route
          </button>
        )}

        <WeatherWidget
          weather={weather}
          error={weatherError}
          now={now}
          locationLabel={userLocation ? 'Your location' : 'Cape Town'}
        />

        <button
          type="button"
          className="map-layer-toggle"
          aria-pressed={satellite}
          onClick={() => setSatellite((current) => !current)}
        >
          <Layers size={16} />
          {satellite ? 'Street map' : 'Satellite'}
        </button>

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

            <div className="legend-summary">
              <span>
                Showing <strong>{visible.length}</strong> of <strong>{allPlaces.length}</strong> services
              </span>
              {active.size > 0 && (
                <button
                  className="legend-clear-filters"
                  onClick={() => setActive(new Set())}
                >
                  Clear filters
                </button>
              )}
            </div>

            {categories.map((item) => {
              const isActive = active.has(item.name);
              const total = categoryTotals.get(item.name) ?? 0;
              const matched = categoryMatches.get(item.name) ?? 0;
              const isFiltered = active.size > 0;

              return (
                <button
                  key={item.name}
                  className={isActive ? 'active' : ''}
                  aria-pressed={isActive}
                  title={
                    isActive
                      ? `Remove ${item.name.toLowerCase()} filter`
                      : `Filter to ${item.name.toLowerCase()} (${matched} of ${total})`
                  }
                  onClick={() => toggleCategory(item.name)}
                >
                  <i style={{ background: item.color }}><CategoryIcon category={item.name} /></i>
                  <span className="legend-label">{item.name}</span>
                  <span className="legend-count">
                    {isFiltered && !isActive ? `${matched}/${total}` : `${matched} of ${total}`}
                  </span>
                </button>
              );
            })}

            <h3 className="legend-heading">
              Traffic &amp; road works
              <span className="legend-count">
                {visibleIncidents.length}/{incidents.length}
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