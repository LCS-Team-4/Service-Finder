import type { RouteResult, TravelMode } from '../types/service.types';

const routeCache = new Map<string, RouteResult>();

export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TravelMode = 'driving',
): Promise<RouteResult | null> {
  const key = `${mode}|${from.lat.toFixed(4)},${from.lng.toFixed(4)}|${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const cached = routeCache.get(key);
  if (cached) return cached;

  try {
    const res = await fetch('/api/services/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromLng: from.lng,
        fromLat: from.lat,
        toLng: to.lng,
        toLat: to.lat,
        mode,
      }),
    });

    if (!res.ok) throw new Error(`Route proxy HTTP ${res.status}`);

    const data = await res.json();
    if (!data.features || data.features.length === 0) return null;

    const feature = data.features[0];
    const summary = feature.properties.summary;

    const geometry: [number, number][] = feature.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng],
    );

    const result: RouteResult = {
      distanceMeters: summary.distance,
      durationSeconds: summary.duration,
      geometry,
    };

    routeCache.set(key, result);
    return result;
  } catch (err) {
    console.error(`[Route] Failed ${mode}:`, err);
    return null;
  }
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}