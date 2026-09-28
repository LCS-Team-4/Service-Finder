import { useCallback, useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CarFront, Construction } from 'lucide-react';
import { CategoryIcon } from '../common/CategoryIcon';
import { categoryColor } from '../../utils/constants';
import type { Place } from '../../types/service.types';
import type { TrafficIncident } from '../../types/traffic.types';

declare const L: any;

const MAX_MARKERS_IN_VIEW = 200;

const parseIncidentGeometry = (geometry: unknown): [number, number][] => {
  if (geometry && typeof geometry === 'object' && 'coordinates' in geometry) {
    const coords = (geometry as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coords)) {
      return coords.filter(
        (c): c is [number, number] =>
          Array.isArray(c) && c.length >= 2 &&
          typeof c[0] === 'number' && typeof c[1] === 'number',
      );
    }
  }
  if (typeof geometry !== 'string') return [];
  const wkt = geometry.match(/LINESTRING\s*\(([^)]+)\)/i);
  if (wkt) {
    return wkt[1].split(',').flatMap((pair) => {
      const [lng, lat] = pair.trim().split(/\s+/).map(Number);
      return Number.isFinite(lng) && Number.isFinite(lat) ? [[lng, lat] as [number, number]] : [];
    });
  }
  if (!/^[0-9a-f]+$/i.test(geometry) || geometry.length < 18) return [];
  const bytes = new Uint8Array(geometry.match(/.{2}/g)!.map((p) => parseInt(p, 16)));
  const littleEndian = bytes[0] === 1;
  const view = new DataView(bytes.buffer);
  const geometryType = view.getUint32(1, littleEndian);
  const baseType = geometryType & 0xff;
  let pointCountOffset = 5;
  if ((geometryType & 0x20000000) !== 0) pointCountOffset += 4;
  const coordinateOffset = pointCountOffset + 4;
  if (baseType !== 2 || bytes.length < coordinateOffset) return [];
  const pointCount = view.getUint32(pointCountOffset, littleEndian);
  if (pointCount > 10_000) return [];
  const coords: [number, number][] = [];
  for (let i = 0; i < pointCount; i++) {
    const offset = coordinateOffset + i * 16;
    if (offset + 16 > bytes.length) break;
    const lng = view.getFloat64(offset, littleEndian);
    const lat = view.getFloat64(offset + 8, littleEndian);
    if (Number.isFinite(lng) && Number.isFinite(lat)) coords.push([lng, lat]);
  }
  return coords;
};

interface LeafletMapProps {
  places: Place[];
  selected: Place | null;
  onSelect: (place: Place) => void;
  mapRef: React.MutableRefObject<any>;
  userLocation: { lat: number; lng: number; accuracy: number } | null;
  incidents: TrafficIncident[];
  routeTarget: Place | null;
}

export default function LeafletMap({
  places,
  selected,
  onSelect,
  mapRef,
  userLocation,
  incidents,
  routeTarget,
}: LeafletMapProps) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<any>(null);
  const incidentLayer = useRef<any>(null);
  const userMarker = useRef<any>(null);
  const accuracyCircle = useRef<any>(null);
  const routeLine = useRef<any>(null);
  const lastRouteKey = useRef<string>('');

  // Keep the latest data in refs so the map-event callback can read it
  // without re-registering listeners on every data change.
  const placesRef = useRef<Place[]>([]);
  const incidentsRef = useRef<TrafficIncident[]>([]);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef<Place | null>(selected);

  placesRef.current = places;
  incidentsRef.current = incidents;
  onSelectRef.current = onSelect;
  selectedRef.current = selected;

  const renderMarkersInView = useCallback(() => {
    const map = mapRef.current;
    if (!map || !layer.current) return;

    const bounds = map.getBounds();
    const currentSelected = selectedRef.current;

    layer.current.clearLayers();

    let shown = 0;
    for (const place of placesRef.current) {
      if (shown >= MAX_MARKERS_IN_VIEW) break;
      if (!bounds.contains([place.lat, place.lng])) continue;
      // Always render the selected marker even if culling would hide it
      if (currentSelected && place.name !== currentSelected.name) {
        // (still count toward the cap)
      }
      const color = categoryColor(place.category);
      const icon = L.divIcon({
        className: 'cape-marker-wrap',
        html: `<div class="cape-marker" style="--marker:${color}"><span>${renderToStaticMarkup(<CategoryIcon category={place.category} size={14} />)}</span></div>`,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
      });
      const marker = L.marker([place.lat, place.lng], { icon }).addTo(layer.current);
      marker.bindTooltip(
        `<strong>${place.name}</strong><br>${place.category}`,
        { direction: 'top', offset: [0, -38] },
      );
      marker.on('click', () => onSelectRef.current(place));
      shown++;
    }
  }, [mapRef]);

  const renderIncidentsInView = useCallback(() => {
    const map = mapRef.current;
    if (!map || !incidentLayer.current) return;

    const bounds = map.getBounds();
    incidentLayer.current.clearLayers();

    for (const incident of incidentsRef.current) {
      const coordinates = parseIncidentGeometry(incident.geometry);
      if (coordinates.length < 2) continue;

      // Quick check: is any point of this incident inside the viewport?
      const inView = coordinates.some(([lng, lat]) => bounds.contains([lat, lng]));
      if (!inView) continue;

      const isRoadWorks = incident.icon_category === 9;
      const color = isRoadWorks ? '#c56a24' : '#b5362d';
      L.polyline(coordinates.map(([lng, lat]) => [lat, lng]), {
        color,
        weight: 5,
        opacity: 0.82,
        dashArray: isRoadWorks ? '8 7' : undefined,
      }).addTo(incidentLayer.current);

      const [lng, lat] = coordinates[Math.floor(coordinates.length / 2)];
      const icon = L.divIcon({
        className: 'cape-marker-wrap',
        html: `<div class="cape-marker" style="--marker:${color}"><span>${renderToStaticMarkup(isRoadWorks ? <Construction size={14} strokeWidth={2.2} /> : <CarFront size={14} strokeWidth={2.2} />)}</span></div>`,
        iconSize: [34, 42],
        iconAnchor: [17, 42],
      });
      const marker = L.marker([lat, lng], { icon }).addTo(incidentLayer.current);
      const road = [incident.from_road, incident.to_road].filter(Boolean).join(' to ');
      marker.bindTooltip(
        `<strong>${isRoadWorks ? 'Road works' : 'Traffic incident'}</strong><br>${incident.description ?? (road || 'Reported road event')}`,
        { direction: 'top', offset: [0, -16] },
      );
    }
  }, [mapRef]);

  // 1. Map setup
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
    incidentLayer.current = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 0);

    const onMove = () => {
      renderMarkersInView();
      renderIncidentsInView();
    };
    map.on('moveend', onMove);
    map.on('zoomend', onMove);

    return () => {
      map.off('moveend', onMove);
      map.off('zoomend', onMove);
      map.remove();
    };
  }, [mapRef, renderMarkersInView, renderIncidentsInView]);

  // 2. Re-render when the data changes
  useEffect(() => {
    renderMarkersInView();
  }, [places, selected, renderMarkersInView]);

  useEffect(() => {
    renderIncidentsInView();
  }, [incidents, renderIncidentsInView]);

  // 3. When the user location first arrives, jump to it and let the marker
  //    layer repopulate around their position.
  const hasCenteredOnUser = useRef(false);
  useEffect(() => {
    if (!userLocation || !mapRef.current) return;
    if (hasCenteredOnUser.current) return;
    hasCenteredOnUser.current = true;
    mapRef.current.flyTo([userLocation.lat, userLocation.lng], 14, {
      animate: true,
      duration: 0.8,
    });
  }, [userLocation, mapRef]);

  // 4. Live user marker
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

  // 5. OSRM route
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

    const key = `${routeTarget.lat.toFixed(4)},${routeTarget.lng.toFixed(4)}|${userLocation.lat.toFixed(3)},${userLocation.lng.toFixed(3)}`;
    if (key === lastRouteKey.current && routeLine.current) return;
    lastRouteKey.current = key;

    const controller = new AbortController();
    const from = `${userLocation.lng},${userLocation.lat}`;
    const to = `${routeTarget.lng},${routeTarget.lat}`;
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

        try {
          map.fitBounds(L.latLngBounds(latlngs), {
            padding: [48, 48],
            maxZoom: 16,
            animate: true,
          });
        } catch {
          /* ignore invalid bounds */
        }
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
      });

    return () => controller.abort();
  }, [userLocation, routeTarget, mapRef]);

  return <div className="leaflet-map" ref={root} />;
}