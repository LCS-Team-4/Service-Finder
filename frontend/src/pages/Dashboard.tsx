import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, MapPinned, Minus, Plus, X } from 'lucide-react';
import LeafletMap from '../components/Map/LeafletMap';
import GuideSearch from '../components/SearchBar/GuideSearch';
import ServicePopup from '../components/ServiceCard/ServicePopup';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { IncidentIcon } from '../components/common/IncidentIcon';
import { useTrafficIncidents } from '../hooks/useTrafficIncidents';
import { useServices } from '../hooks/useServices';
import { categories, places } from '../services/guideData';
import { buildIncidentLegend } from '../services/trafficLegend';
import { Category, Place } from '../types/guide.types';
import type { Service } from '../types/service.types';

function parseServiceLocation(location: Service['location']): [number, number] | null {
  if (location && typeof location === 'object' && Array.isArray(location.coordinates)) {
    const [lng, lat] = location.coordinates.map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }
  if (Array.isArray(location)) {
    const [lng, lat] = location.map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }
  if (typeof location !== 'string') return null;
  const point = location.match(/POINT\s*\(\s*([-\d.]+)\s*[,\s]+\s*([-\d.]+)\s*\)/i);
  if (point) return [Number(point[2]), Number(point[1])];
  if (/^[0-9a-f]+$/i.test(location) && location.length >= 42) {
    try {
      const bytes = new Uint8Array(location.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
      const littleEndian = bytes[0] === 1;
      const view = new DataView(bytes.buffer);
      const type = view.getUint32(1, littleEndian);
      if ((type & 0xff) === 1) {
        const offset = type & 0x20000000 ? 9 : 5;
        const lng = view.getFloat64(offset, littleEndian);
        const lat = view.getFloat64(offset + 8, littleEndian);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
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
  const [hiddenIncidents, setHiddenIncidents] = useState<Set<number | null>>(() => new Set());
  const { incidents } = useTrafficIncidents();
  const { services, error: servicesError } = useServices();
  const mapRef = useRef<any>(null);
  const allPlaces = useMemo(() => {
    const apiPlaces = services.map(serviceToPlace).filter((place): place is Place => place !== null);
    return apiPlaces.length > 0 ? apiPlaces : places;
  }, [services]);
  const visible = useMemo(() => allPlaces.filter((place) => (!active || place.category === active) && `${place.name} ${place.area} ${place.category}`.toLowerCase().includes(query.toLowerCase())), [active, allPlaces, query]);
  const incidentLegend = useMemo(() => buildIncidentLegend(incidents), [incidents]);
  const visibleIncidents = useMemo(() => incidents.filter((incident) => !hiddenIncidents.has(incident.icon_category ?? null)), [hiddenIncidents, incidents]);
  const toggleIncident = useCallback((code: number | null) => {
    setHiddenIncidents((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
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

  return <main className="guide-shell">
    <LeafletMap places={visible} incidents={visibleIncidents} onSelect={selectPlace} mapRef={mapRef} />
    <header className="masthead"><h1>The Cape Guide</h1><p>Find. Navigate. Connect.</p></header>
    <GuideSearch query={query} onQueryChange={setQuery} onSearch={search} onLocate={locate} />
    {notice && <div className="notice">{notice}</div>}
    {selected && <ServicePopup place={selected} saved={saved.includes(selected.name)} onClose={() => setSelected(null)} onNotice={setNotice} onSave={() => setSaved((current) => current.includes(selected.name) ? current.filter((name) => name !== selected.name) : [...current, selected.name])} />}
    <button className="panel-trigger about-trigger" onClick={() => setAboutOpen(true)}><BookOpen size={17} />About the Guide</button>
    <button className="panel-trigger legend-trigger" onClick={() => setLegendOpen(true)}><MapPinned size={17} />Legend</button>
    {aboutOpen && <aside className="about popup-panel"><button className="close-panel" aria-label="Close about" onClick={() => setAboutOpen(false)}><X size={17} /></button><h2>About the Cape<br />Guide</h2><p>The Cape Guide is a map-based service finder designed to help people discover useful public services across Cape Town. Search, explore and navigate to the services you need — all from one map.</p><div className="motto">Every road leads somewhere.<br />Every service helps someone.</div></aside>}
    {legendOpen && <aside className="legend popup-panel">
      <button className="close-panel" aria-label="Close legend" onClick={() => setLegendOpen(false)}><X size={17} /></button>
      <h2>Legend</h2>
      {categories.map((item) => <button key={item.name} className={active === item.name ? 'active' : ''} onClick={() => { setActive(active === item.name ? null : item.name); setSelected(null); }}><i style={{ background: item.color }}><CategoryIcon category={item.name} /></i>{item.name}</button>)}
      <h3 className="legend-heading">Traffic &amp; road works<span className="legend-count">{visibleIncidents.length}/{incidents.length}</span></h3>
      {incidents.length > 0 && <p className="legend-hint">Tap a road event to hide or show it on the map.</p>}
      {incidentLegend.length === 0
        ? <p className="legend-hint">No incidents reported right now.</p>
        : incidentLegend.map((item) => <button key={item.label} className={hiddenIncidents.has(item.code) ? 'legend-toggle off' : 'legend-toggle'} aria-pressed={!hiddenIncidents.has(item.code)} title={`${hiddenIncidents.has(item.code) ? 'Show' : 'Hide'} ${item.label.toLowerCase()}`} onClick={() => toggleIncident(item.code)}><i style={{ background: item.color }}><IncidentIcon category={item.code} /></i>{item.label}<span className="legend-count">{item.count}</span></button>)}
      {hiddenIncidents.size > 0 && <button className="legend-show-all" onClick={() => setHiddenIncidents(new Set())}>Show all road events</button>}
      <button className="you-are" onClick={locate}><i><MapPinned size={16} /></i>You Are Here</button>
    </aside>}
    <div className="leaflet-zoom"><button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}><Plus size={18} /></button><button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}><Minus size={18} /></button></div>
  </main>;
}
