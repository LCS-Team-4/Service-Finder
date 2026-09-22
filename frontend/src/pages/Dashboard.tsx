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
    } catch {
      return null;
    }
  }
  try {
    return parseServiceLocation(JSON.parse(location) as Service['location']);
  } catch {
    return null;
  }
}

function serviceCategory(service: Service): Category | null {
  const source = `${service.category?.name ?? ''} ${service.category?.slug ?? ''} ${service.type ?? ''}`.toLowerCase();
  const aliases: Partial<Record<Category, string[]>> = {
    'Hospitals': ['hospital'],
    'Police Stations': ['police'],
    'Fire Stations': ['fire station', 'firestation'],
    'Schools / Universities': ['school', 'university', 'college'],
    'Home Affairs': ['home affairs', 'government'],
  };
  return categories.find((item) => {
    const name = item.name.toLowerCase();
    return source.includes(name) || source.includes(name.endsWith('s') ? name.slice(0, -1) : name) || aliases[item.name]?.some((alias) => source.includes(alias));
  })?.name ?? null;
}

function serviceToPlace(service: Service): Place | null {
  const coordinates = parseServiceLocation(service.location);
  const category = serviceCategory(service);
  if (!coordinates || !category) return null;
  return {
    name: service.name,
    category,
    area: service.formatted_address?.split(',')[0] ?? category,
    lat: coordinates[0],
    lng: coordinates[1],
  };
}

export default function Dashboard() {
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
  const selectPlace = useCallback((place: Place) => { setSelected(place); mapRef.current?.flyTo([place.lat, place.lng], 15, { animate: true, duration: 0.7 }); }, []);
  const search = () => { const first = visible[0]; if (first) selectPlace(first); setNotice(first ? `${visible.length} place${visible.length === 1 ? '' : 's'} found` : 'No places found'); };
  const locate = () => navigator.geolocation?.getCurrentPosition((position) => { mapRef.current?.flyTo([position.coords.latitude, position.coords.longitude], 14); setNotice('Showing your current location.'); }, () => setNotice('We could not access your location.'));
  useEffect(() => { if (servicesError) setNotice('Showing sample services while the full service list is unavailable.'); }, [servicesError]);

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
