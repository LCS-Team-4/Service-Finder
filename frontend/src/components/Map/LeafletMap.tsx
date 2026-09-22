import { useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IncidentIcon } from '../common/IncidentIcon';
import { CategoryIcon } from '../common/CategoryIcon';
import { categories } from '../../services/guideData';
import { Place } from '../../types/guide.types';
import type { TrafficIncident } from '../../types/traffic.types';

declare const L: any;

function parseLineString(geometry: TrafficIncident['geometry']): [number, number][] {
  if (typeof geometry !== 'string') return [];
  const match = geometry.match(/LINESTRING\s*\((.*)\)/i);
  if (match) {
    return match[1].split(',').map((pair) => {
      const [lng, lat] = pair.trim().split(/\s+/).map(Number);
      return [lat, lng] as [number, number];
    }).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }
  if (!/^[0-9a-f]+$/i.test(geometry)) return [];
  const bytes = new Uint8Array(geometry.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
  const littleEndian = bytes[0] === 1;
  const view = new DataView(bytes.buffer);
  const type = view.getUint32(1, littleEndian);
  if ((type & 0xff) !== 2) return [];
  const offset = type & 0x20000000 ? 9 : 5;
  const count = view.getUint32(offset, littleEndian);
  const coordinates: [number, number][] = [];
  for (let index = 0; index < count; index += 1) {
    const coordinateOffset = offset + 4 + index * 16;
    if (coordinateOffset + 16 > bytes.length) break;
    const lng = view.getFloat64(coordinateOffset, littleEndian);
    const lat = view.getFloat64(coordinateOffset + 8, littleEndian);
    if (Number.isFinite(lat) && Number.isFinite(lng)) coordinates.push([lat, lng]);
  }
  return coordinates;
}

export default function LeafletMap({ places, incidents, onSelect, mapRef }: { places: Place[]; incidents: TrafficIncident[]; onSelect: (place: Place) => void; mapRef: React.MutableRefObject<any> }) {
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
    incidents.forEach((incident) => {
      const coordinates = parseLineString(incident.geometry);
      if (coordinates.length === 0) return;
      const severity = (incident.magnitude_of_delay ?? 0) >= 4 ? 'traffic' : 'road-works';
      L.polyline(coordinates, { color: severity === 'traffic' ? '#b5362d' : '#c56a24', weight: 5, opacity: 0.82 }).addTo(layer.current);
      const iconMarkup = renderToStaticMarkup(<IncidentIcon category={incident.icon_category} />);
      const icon = L.divIcon({ className: 'traffic-marker-wrap', html: `<div class="traffic-marker ${severity}">${iconMarkup}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
      const marker = L.marker(coordinates[0], { icon }).addTo(layer.current);
      marker.bindTooltip(`<strong>${incident.from_road ?? 'Traffic incident'}</strong><br>${incident.description ?? 'Traffic disruption'}`, { direction: 'top' });
    });
    if (places.length > 0) {
      mapRef.current?.fitBounds(places.map((place) => [place.lat, place.lng]), { padding: [40, 40], maxZoom: 12 });
    }
  }, [incidents, onSelect, places]);

  return <div className="leaflet-map" ref={root} />;
}