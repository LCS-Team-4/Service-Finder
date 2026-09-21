import { useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CategoryIcon } from '../common/CategoryIcon';
import { categories } from '../../services/guideData';
import { Place } from '../../types/guide.types';

declare const L: any;

export default function LeafletMap({ places, onSelect, mapRef }: { places: Place[]; onSelect: (place: Place) => void; mapRef: React.MutableRefObject<any> }) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<any>(null);

  useEffect(() => {
    if (!root.current || !L) return;
    const map = L.map(root.current, { zoomControl: false, attributionControl: true }).setView([-33.96, 18.5], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
    mapRef.current = map;
    layer.current = L.layerGroup().addTo(map);
    return () => map.remove();
  }, [mapRef]);

  useEffect(() => {
    if (!layer.current) return;
    layer.current.clearLayers();
    places.forEach((place) => {
      const category = categories.find((item) => item.name === place.category)!;
      const icon = L.divIcon({ className: 'cape-marker-wrap', html: `<div class="cape-marker" style="--marker:${category.color}"><span>${renderToStaticMarkup(<CategoryIcon category={place.category} />)}</span></div>`, iconSize: [34, 42], iconAnchor: [17, 42] });
      const marker = L.marker([place.lat, place.lng], { icon }).addTo(layer.current);
      marker.bindTooltip(`<strong>${place.name}</strong><br>${place.category}`, { direction: 'top', offset: [0, -38] });
      marker.on('click', () => onSelect(place));
    });
  }, [places, onSelect]);

  return <div className="leaflet-map" ref={root} />;
}