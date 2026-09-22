import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BookOpen, Bookmark, Bus, Clock3, Flame, GraduationCap, Heart, Hospital, House, Landmark, Library, LocateFixed, MapPinned, Minus, Navigation, Phone, Pill, Plus, Search, Shield, ShoppingBag, Smile, Stethoscope, X } from 'lucide-react';

declare const L: any;
type Category = 'Clinics' | 'Libraries' | 'Shelters' | 'Hospitals' | 'Police Stations' | 'Pharmacies' | 'Dentists' | 'SPCA' | 'Fire Stations' | 'Home Affairs' | 'Malls' | 'Transport' | 'Schools / Universities';
type Place = { name: string; category: Category; area: string; lat: number; lng: number };
const categories: { name: Category; symbol: string; color: string }[] = [
  { name: 'Clinics', symbol: '+', color: '#b94b3c' },
  { name: 'Libraries', symbol: '▮', color: '#4f876f' },
  { name: 'Shelters', symbol: '⌂', color: '#cb8c38' },
  { name: 'Hospitals', symbol: '+', color: '#3b77a2' },
  { name: 'Police Stations', symbol: '●', color: '#375f93' },
  { name: 'Pharmacies', symbol: '●', color: '#81528d' },
  { name: 'Dentists', symbol: '●', color: '#77909c' },
  { name: 'SPCA', symbol: '♥', color: '#815c54' },
  { name: 'Fire Stations', symbol: '♦', color: '#bd6240' },
  { name: 'Home Affairs', symbol: '▦', color: '#75664b' },
  { name: 'Malls', symbol: '●', color: '#a45b83' },
  { name: 'Transport', symbol: '▰', color: '#847337' },
  { name: 'Schools / Universities', symbol: '◆', color: '#43858a' },
];
const places: Place[] = [
  ['Cape Town Civic Centre', 'Home Affairs', 'Cape Town', -33.925, 18.424],
  ['Groote Schuur Hospital', 'Hospitals', 'Observatory', -33.941, 18.465],
  ['Sea Point Police Station', 'Police Stations', 'Sea Point', -33.918, 18.386],
  ['Cape Town Central Library', 'Libraries', 'CBD', -33.925, 18.423],
  ['Woodstock Clinic', 'Clinics', 'Woodstock', -33.927, 18.448],
  ['Mowbray Maternity Hospital', 'Hospitals', 'Mowbray', -33.948, 18.475],
  ['Rondebosch Library', 'Libraries', 'Rondebosch', -33.961, 18.476],
  ['Khayelitsha Mall', 'Malls', 'Khayelitsha', -34.037, 18.678],
  ['Mitchells Plain Clinic', 'Clinics', 'Mitchells Plain', -34.048, 18.617],
  ['Bellville Police Station', 'Police Stations', 'Bellville', -33.900, 18.628],
  ['Tygerberg Hospital', 'Hospitals', 'Parow', -33.908, 18.596],
  ['Milnerton Library', 'Libraries', 'Milnerton', -33.879, 18.496],
  ['Hout Bay Fire Station', 'Fire Stations', 'Hout Bay', -34.044, 18.348],
  ['Wynberg SPCA', 'SPCA', 'Wynberg', -34.003, 18.468],
  ['Claremont Transport Hub', 'Transport', 'Claremont', -33.981, 18.465],
  ['UCT', 'Schools / Universities', 'Rondebosch', -33.957, 18.461],
  ['Table View Shelter', 'Shelters', 'Table View', -33.824, 18.488],
  ['Kloof Street Pharmacy', 'Pharmacies', 'Gardens', -33.932, 18.410],
].map(([name, category, area, lat, lng]) => ({
  name: name as string,
  category: category as Category,
  area: area as string,
  lat: lat as number,
  lng: lng as number,
}));

const categoryIcon = (category: Category, size = 14) => {
  const props = { size, strokeWidth: 2.2 };
  switch (category) {
    case 'Clinics': return <Stethoscope {...props} />;
    case 'Libraries': return <Library {...props} />;
    case 'Shelters': return <House {...props} />;
    case 'Hospitals': return <Hospital {...props} />;
    case 'Police Stations': return <Shield {...props} />;
    case 'Pharmacies': return <Pill {...props} />;
    case 'Dentists': return <Smile {...props} />;
    case 'SPCA': return <Heart {...props} />;
    case 'Fire Stations': return <Flame {...props} />;
    case 'Home Affairs': return <Landmark {...props} />;
    case 'Malls': return <ShoppingBag {...props} />;
    case 'Transport': return <Bus {...props} />;
    case 'Schools / Universities': return <GraduationCap {...props} />;
  }
};

const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const formatDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

function LeafletMap({
  places,
  selected,
  onSelect,
  mapRef,
  userLocation,
  routeTarget,
}: {
  places: Place[];
  selected: Place | null;
  onSelect: (place: Place) => void;
  mapRef: React.MutableRefObject<any>;
  userLocation: { lat: number; lng: number; accuracy: number } | null;
  routeTarget: Place | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<any>(null);
  const userMarker = useRef<any>(null);
  const accuracyCircle = useRef<any>(null);
  const routeLine = useRef<any>(null);
  const lastRouteKey = useRef<string>('');

  useEffect(() => {
    if (!root.current || !L) return;
    const map = L.map(root.current, { zoomControl: false, attributionControl: true }).setView([-33.96, 18.5], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    mapRef.current = map;
    layer.current = L.layerGroup().addTo(map);
    return () => map.remove();
  }, [mapRef]);

  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    places.forEach((place) => {
      const item = categories.find((c) => c.name === place.category)!;
      const icon = L.divIcon({
        className: 'cape-marker-wrap',
        html: `<div class="cape-marker" style="--marker:${item.color}"><span>${renderToStaticMarkup(categoryIcon(place.category, 14))}</span></div>`,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
      });
      const marker = L.marker([place.lat, place.lng], { icon }).addTo(layer.current);
      marker.bindTooltip(`<strong>${place.name}</strong><br>${place.category}`, { direction: 'top', offset: [0, -38] });
      marker.on('click', () => onSelect(place));
    });
  }, [places, selected, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;
    if (!userLocation) {
      if (userMarker.current) {
        map.removeLayer(userMarker.current);
        userMarker.current = null;
      }
      if (accuracyCircle.current) {
        map.removeLayer(accuracyCircle.current);
        accuracyCircle.current = null;
      }
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
        radius: accuracy,
        color: '#22c55e',
        weight: 1,
        fillColor: '#22c55e',
        fillOpacity: 0.12,
      }).addTo(map);
    } else {
      userMarker.current.setLatLng([lat, lng]);
      accuracyCircle.current.setLatLng([lat, lng]);
      accuracyCircle.current.setRadius(accuracy);
    }
  }, [userLocation, mapRef]);

  // Fetch real road directions (OSRM) and draw the route along actual roads
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;

    if (!userLocation || !routeTarget) {
      if (routeLine.current) {
        map.removeLayer(routeLine.current);
        routeLine.current = null;
      }
      lastRouteKey.current = '';
      return;
    }

    // Only re-fetch when destination changes or user has moved ~80m+
    const key = `${routeTarget.lat.toFixed(4)},${routeTarget.lng.toFixed(4)}|${userLocation.lat.toFixed(3)},${userLocation.lng.toFixed(3)}`;
    if (key === lastRouteKey.current && routeLine.current) return;
    lastRouteKey.current = key;

    const controller = new AbortController();
    const from = `${userLocation.lng},${userLocation.lat}`;
    const to = `${routeTarget.lng},${routeTarget.lat}`;
    // Public OSRM demo — driving profile with full road geometry
    const url = `https://router.project-osrm.org/route/v1/driving/${from};${to}?overview=full&geometries=geojson`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Routing request failed');
        return res.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const coords =
          data?.routes?.[0]?.geometry?.coordinates?.map(
            (c: [number, number]) => [c[1], c[0]] as [number, number],
          ) ?? null;

        // Fallback to straight line only if routing fails
        const latlngs: [number, number][] =
          coords && coords.length > 1
            ? coords
            : [
                [userLocation.lat, userLocation.lng],
                [routeTarget.lat, routeTarget.lng],
              ];

        if (!routeLine.current) {
          routeLine.current = L.polyline(latlngs, {
            color: '#1f9450',
            weight: 5,
            opacity: 0.9,
          }).addTo(map);
        } else {
          routeLine.current.setLatLngs(latlngs);
        }

        // Zoom in tight on the user's live location — Google Maps "locate me" style —
        // rather than zooming out to fit the whole route.
        map.flyTo([userLocation.lat, userLocation.lng], 18, { animate: true, duration: 0.8 });
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        const latlngs: [number, number][] = [
          [userLocation.lat, userLocation.lng],
          [routeTarget.lat, routeTarget.lng],
        ];
        if (!routeLine.current) {
          routeLine.current = L.polyline(latlngs, {
            color: '#1f9450',
            weight: 5,
            opacity: 0.9,
            dashArray: '8 10',
          }).addTo(map);
        } else {
          routeLine.current.setLatLngs(latlngs);
        }
        map.flyTo([userLocation.lat, userLocation.lng], 18, { animate: true, duration: 0.8 });
      });

    return () => controller.abort();
  }, [userLocation, routeTarget, mapRef]);

  return <div className="leaflet-map" ref={root} />;
}

function Dashboard() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Category | null>(null);
  const [selected, setSelected] = useState<Place | null>(null);
  const [notice, setNotice] = useState('');
  const [aboutOpen, setAboutOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [tracking, setTracking] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [routeTarget, setRouteTarget] = useState<Place | null>(null);
  const mapRef = useRef<any>(null);
  const watchId = useRef<number | null>(null);
  const hasCentered = useRef(false);

  // Match by name, area, or category (partial category ok: "school" -> "Schools / Universities")
  const matchesQuery = useCallback((place: Place, q: string) => {
    const term = q.trim().toLowerCase();
    if (!term) return true;
    const haystack = `${place.name} ${place.area} ${place.category}`.toLowerCase();
    if (haystack.includes(term)) return true;
    const categoryWords = place.category
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/);
    return categoryWords.some((word) => word.startsWith(term) || term.startsWith(word));
  }, []);

  // Map markers: respect legend category filter + search query
  const visible = useMemo(
    () => places.filter((p) => (!active || p.category === active) && matchesQuery(p, query)),
    [active, query, matchesQuery],
  );

  // Dropdown: ALL matching places from full dataset, sorted closest -> farthest
  const sortedResults = useMemo(() => {
    const list = places.filter((p) => matchesQuery(p, query));
    if (userLocation) {
      list.sort((a, b) => distanceKm(userLocation, a) - distanceKm(userLocation, b));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [query, userLocation, matchesQuery]);

  const selectPlace = useCallback((place: Place) => {
    setSelected(place);
    mapRef.current?.flyTo([place.lat, place.lng], 15, { animate: true, duration: 0.7 });
  }, []);

  const search = () => {
    const first = sortedResults[0];
    if (first) selectPlace(first);
    setNotice(
      first
        ? `${sortedResults.length} place${sortedResults.length === 1 ? '' : 's'} found`
        : 'No places found',
    );
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
        setNotice('Showing your live location.');
      },
      () => {
        setNotice('We could not access your location.');
        setTracking(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
  };

  useEffect(
    () => () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  // In-map directions: set route target, start live location if needed, and zoom
  // in tight on the user's live location right away (Google Maps "locate me" style).
  const getDirections = (place: Place) => {
    setRouteTarget(place);
    if (!tracking) locate();
    if (userLocation) {
      mapRef.current?.flyTo([userLocation.lat, userLocation.lng], 18, { animate: true, duration: 0.8 });
    }
    setNotice(`Getting road directions to ${place.name}...`);
  };

  const details = selected
    ? {
        address:
          selected.category === 'SPCA'
            ? '1 Bird Street, Grassy Park'
            : `${selected.area} service centre, Cape Town`,
        hours: selected.category === 'Hospitals' ? 'Open 24 hours' : '08:00 – 16:30',
        phone: selected.category === 'SPCA' ? '021 700 4158' : '021 400 0000',
      }
    : null;

  return (
    <main className="guide-shell">
      <LeafletMap
        places={visible}
        selected={selected}
        onSelect={selectPlace}
        mapRef={mapRef}
        userLocation={userLocation}
        routeTarget={routeTarget}
      />
      <header className="masthead">
        <h1>The Cape Guide</h1>
        <p>Find. Navigate. Connect.</p>
      </header>
      <section className="search-panel">
        <span className="glass">
          <Search size={19} />
        </span>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setResultsOpen(true);
          }}
          onFocus={() => query.trim() && setResultsOpen(true)}
          onBlur={() => setTimeout(() => setResultsOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              search();
              setResultsOpen(false);
            }
            if (e.key === 'Escape') setResultsOpen(false);
          }}
          placeholder="Search for a place or service..."
        />
        <button
          className="search-button"
          onClick={() => {
            search();
            setResultsOpen(false);
          }}
        >
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
            sortedResults.map((place) => (
              <div
                key={place.name}
                className="search-result-row"
                onClick={() => {
                  selectPlace(place);
                  setQuery(place.name);
                  setResultsOpen(false);
                }}
              >
                <span
                  className="search-result-icon"
                  style={{ background: categories.find((c) => c.name === place.category)?.color }}
                >
                  {categoryIcon(place.category, 14)}
                </span>
                <div className="search-result-info">
                  <strong>{place.name}</strong>
                  <span>
                    {place.category}
                    {userLocation ? ` · ${formatDistance(distanceKm(userLocation, place))} away` : ''}
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
      {notice && <div className="notice">{notice}</div>}
      {selected && details && (
        <section className="service-popup">
          <button className="service-close" aria-label="Close service" onClick={() => setSelected(null)}>
            <X size={18} />
          </button>
          <div className="service-title">
            <span
              className="service-icon"
              style={{ background: categories.find((c) => c.name === selected.category)?.color }}
            >
              {categoryIcon(selected.category, 18)}
            </span>
            <div>
              <h2>{selected.name}</h2>
              <p>{selected.category}</p>
            </div>
          </div>
          <div className="service-info">
            <p>
              <MapPinned size={17} />
              <span>
                {details.address}
                <br />
                Cape Town
              </span>
            </p>
            <p>
              <Clock3 size={17} />
              {details.hours}
            </p>
            <p>
              <Phone size={17} />
              {details.phone}
            </p>
          </div>
          <div className="service-actions">
            <button onClick={() => setNotice(`More details for ${selected.name} coming soon.`)}>
              View Details
            </button>
            <button className="directions" onClick={() => getDirections(selected)}>
              <Navigation size={14} />
              Get Directions
            </button>
            <button
              className={saved.includes(selected.name) ? 'saved' : ''}
              onClick={() =>
                setSaved(
                  saved.includes(selected.name)
                    ? saved.filter((name) => name !== selected.name)
                    : [...saved, selected.name],
                )
              }
            >
              <Bookmark size={15} />
              {saved.includes(selected.name) ? 'Saved' : 'Save'}
            </button>
          </div>
        </section>
      )}
      <button className="panel-trigger about-trigger" onClick={() => setAboutOpen(true)}>
        <BookOpen size={17} />
        About the Guide
      </button>
      <button className="panel-trigger legend-trigger" onClick={() => setLegendOpen(true)}>
        <MapPinned size={17} />
        Legend
      </button>
      {aboutOpen && (
        <aside className="about popup-panel">
          <button className="close-panel" aria-label="Close about" onClick={() => setAboutOpen(false)}>
            <X size={17} />
          </button>
          <h2>
            About the Cape
            <br />
            Guide
          </h2>
          <p>
            The Cape Guide is a map-based service finder designed to help people discover useful public
            services across Cape Town. Search, explore and navigate to the services you need — all from one
            map.
          </p>
          <div className="motto">
            Every road leads somewhere.
            <br />
            Every service helps someone.
          </div>
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
              <i style={{ background: item.color }}>{categoryIcon(item.name)}</i>
              {item.name}
            </button>
          ))}
          <button className="you-are" onClick={locate}>
            <i>
              <MapPinned size={16} />
            </i>
            You Are Here
          </button>
        </aside>
      )}
      <div className="leaflet-zoom">
        <button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <Plus size={18} />
        </button>
        <button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <Minus size={18} />
        </button>
      </div>
    </main>
  );
}

export default Dashboard;