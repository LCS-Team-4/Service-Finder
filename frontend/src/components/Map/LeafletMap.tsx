import { memo, useCallback, useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CarFront, Construction } from 'lucide-react';
import { CategoryIcon } from '../common/CategoryIcon';
import { categoryColor } from '../../utils/constants';
import type { Place } from '../../types/service.types';
import type { TrafficIncident } from '../../types/traffic.types';

declare const L: any;

const MAX_MARKERS_IN_VIEW = 200;

export const parseIncidentGeometry = (geometry: unknown): [number, number][] => {
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
  satellite: boolean;
  userLocation: { lat: number; lng: number; accuracy: number } | null;
  incidents: TrafficIncident[];
  routePath: [number, number][] | null;  // <-- changed from routeTarget
  fitRouteBounds?: boolean;              // <-- new: let Home tell the map to zoom to route
  onMapMoving?: (moving: boolean) => void;
}

function LeafletMap({
  places,
  selected,
  onSelect,
  mapRef,
  satellite,
  userLocation,
  incidents,
  routePath,
  fitRouteBounds = false,
  onMapMoving,
}: LeafletMapProps) {
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<any>(null);
  const incidentLayer = useRef<any>(null);
  const tileLayer = useRef<any>(null);
  const userMarker = useRef<any>(null);
  const routeLine = useRef<any>(null);
  const lastRouteKey = useRef<string>('');

  const placesRef = useRef<Place[]>([]);
  const incidentsRef = useRef<TrafficIncident[]>([]);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef<Place | null>(selected);
  const onMapMovingRef = useRef(onMapMoving);

  placesRef.current = places;
  incidentsRef.current = incidents;
  onSelectRef.current = onSelect;
  selectedRef.current = selected;
  onMapMovingRef.current = onMapMoving;

  const renderMarkersInView = useCallback(() => {
    const map = mapRef.current;
    if (!map || !layer.current) return;

    const bounds = map.getBounds();
    layer.current.clearLayers();

    let shown = 0;
    for (const place of placesRef.current) {
      if (shown >= MAX_MARKERS_IN_VIEW) break;
      if (!bounds.contains([place.lat, place.lng])) continue;
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

    incidentLayer.current.clearLayers();

    for (const incident of incidentsRef.current) {
      const coordinates = parseIncidentGeometry(incident.geometry);
      if (coordinates.length < 2) continue;

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

  // Map setup
  useEffect(() => {
    if (!root.current || !L) return;
    const map = L.map(root.current, { zoomControl: false, attributionControl: true })
      .setView([-33.96, 18.5], 11);
    tileLayer.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    mapRef.current = map;
    layer.current = L.layerGroup().addTo(map);
    incidentLayer.current = L.layerGroup().addTo(map);

    const ro = new ResizeObserver(() => map.invalidateSize());
    if (root.current) ro.observe(root.current);

    const onMove = () => {
      renderMarkersInView();
      renderIncidentsInView();
    };
    const onMoveStart = () => onMapMovingRef.current?.(true);
    const onMoveEnd = () => {
      onMapMovingRef.current?.(false);
      onMove();
    };

    map.on('movestart', onMoveStart);
    map.on('zoomstart', onMoveStart);
    map.on('moveend', onMoveEnd);
    map.on('zoomend', onMoveEnd);

    return () => {
      ro.disconnect();
      map.off('movestart', onMoveStart);
      map.off('zoomstart', onMoveStart);
      map.off('moveend', onMoveEnd);
      map.off('zoomend', onMoveEnd);
      map.remove();
    };
  }, [mapRef, renderMarkersInView, renderIncidentsInView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayer.current) return;

    map.removeLayer(tileLayer.current);
    tileLayer.current = satellite
      ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
        })
      : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        });
    tileLayer.current.addTo(map);
  }, [mapRef, satellite]);

  useEffect(() => {
    renderMarkersInView();
  }, [places, renderMarkersInView]);

  useEffect(() => {
    renderIncidentsInView();
  }, [incidents, renderIncidentsInView]);

  // Center on user once
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

  // Live user marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;
    if (!userLocation) {
      if (userMarker.current) {
        map.removeLayer(userMarker.current);
        userMarker.current = null;
      }
      return;
    }
    const { lat, lng } = userLocation;
    if (!userMarker.current) {
      const icon = L.divIcon({
        className: 'user-location-wrap',
        html: '<span class="user-location-pulse"></span><span class="user-location-dot"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      userMarker.current = L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
    } else {
      userMarker.current.setLatLng([lat, lng]);
    }
  }, [userLocation, mapRef]);

  // === Render pre-computed route polyline ===
  // This component no longer fetches OSRM. Home.tsx handles that.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;

    if (!routePath || routePath.length < 2) {
      if (routeLine.current) {
        map.removeLayer(routeLine.current);
        routeLine.current = null;
      }
      lastRouteKey.current = '';
      return;
    }

    // Only redraw if the path actually changed
    const key = `${routePath.length}|${routePath[0][0].toFixed(4)},${routePath[0][1].toFixed(4)}|${routePath[routePath.length - 1][0].toFixed(4)},${routePath[routePath.length - 1][1].toFixed(4)}`;
    if (key === lastRouteKey.current && routeLine.current) {
      if (fitRouteBounds) {
        map.fitBounds(routePath as [number, number][], { padding: [50, 50] });
      }
      return;
    }
    lastRouteKey.current = key;

    if (!routeLine.current) {
      routeLine.current = L.polyline(routePath, {
        color: '#1f9450',
        weight: 5,
        opacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map);
    } else {
      routeLine.current.setLatLngs(routePath);
    }

    if (fitRouteBounds) {
      map.fitBounds(routePath as [number, number][], { padding: [50, 50] });
    }
  }, [routePath, fitRouteBounds, mapRef]);

  return <div className="leaflet-map" ref={root} />;
}

export default memo(LeafletMap);