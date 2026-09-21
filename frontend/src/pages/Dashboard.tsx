import { useCallback, useMemo, useRef, useState } from 'react';
import { BookOpen, MapPinned, Minus, Plus, X } from 'lucide-react';
import LeafletMap from '../components/Map/LeafletMap';
import GuideSearch from '../components/SearchBar/GuideSearch';
import ServicePopup from '../components/ServiceCard/ServicePopup';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { categories, places } from '../services/guideData';
import { Category, Place } from '../types/guide.types';

export default function Dashboard() {
	const [query, setQuery] = useState('');
	const [active, setActive] = useState<Category | null>(null);
	const [selected, setSelected] = useState<Place | null>(null);
	const [notice, setNotice] = useState('');
	const [aboutOpen, setAboutOpen] = useState(false);
	const [legendOpen, setLegendOpen] = useState(false);
	const [saved, setSaved] = useState<string[]>([]);
	const mapRef = useRef<any>(null);
	const visible = useMemo(() => places.filter((place) => (!active || place.category === active) && `${place.name} ${place.area} ${place.category}`.toLowerCase().includes(query.toLowerCase())), [active, query]);
	const selectPlace = useCallback((place: Place) => { setSelected(place); mapRef.current?.flyTo([place.lat, place.lng], 15, { animate: true, duration: 0.7 }); }, []);
	const search = () => { const first = visible[0]; if (first) selectPlace(first); setNotice(first ? `${visible.length} place${visible.length === 1 ? '' : 's'} found` : 'No places found'); };
	const locate = () => navigator.geolocation?.getCurrentPosition((position) => { mapRef.current?.flyTo([position.coords.latitude, position.coords.longitude], 14); setNotice('Showing your current location.'); }, () => setNotice('We could not access your location.'));

	return <main className="guide-shell">
		<LeafletMap places={visible} onSelect={selectPlace} mapRef={mapRef} />
		<header className="masthead"><h1>The Cape Guide</h1><p>Find. Navigate. Connect.</p></header>
		<GuideSearch query={query} onQueryChange={setQuery} onSearch={search} onLocate={locate} />
		{notice && <div className="notice">{notice}</div>}
		{selected && <ServicePopup place={selected} saved={saved.includes(selected.name)} onClose={() => setSelected(null)} onNotice={setNotice} onSave={() => setSaved((current) => current.includes(selected.name) ? current.filter((name) => name !== selected.name) : [...current, selected.name])} />}
		<button className="panel-trigger about-trigger" onClick={() => setAboutOpen(true)}><BookOpen size={17} />About the Guide</button>
		<button className="panel-trigger legend-trigger" onClick={() => setLegendOpen(true)}><MapPinned size={17} />Legend</button>
		{aboutOpen && <aside className="about popup-panel"><button className="close-panel" aria-label="Close about" onClick={() => setAboutOpen(false)}><X size={17} /></button><h2>About the Cape<br />Guide</h2><p>The Cape Guide is a map-based service finder designed to help people discover useful public services across Cape Town. Search, explore and navigate to the services you need — all from one map.</p><div className="motto">Every road leads somewhere.<br />Every service helps someone.</div></aside>}
		{legendOpen && <aside className="legend popup-panel"><button className="close-panel" aria-label="Close legend" onClick={() => setLegendOpen(false)}><X size={17} /></button><h2>Legend</h2>{categories.map((item) => <button key={item.name} className={active === item.name ? 'active' : ''} onClick={() => { setActive(active === item.name ? null : item.name); setSelected(null); }}><i style={{ background: item.color }}><CategoryIcon category={item.name} /></i>{item.name}</button>)}<button className="you-are" onClick={locate}><i><MapPinned size={16} /></i>You Are Here</button></aside>}
		<div className="leaflet-zoom"><button aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}><Plus size={18} /></button><button aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}><Minus size={18} /></button></div>
	</main>;
}
