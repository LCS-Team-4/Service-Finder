export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: [number, number][]; // [lat, lng] pairs for Leaflet
}

// In-memory cache keyed by "fromLat,fromLng|toLat,toLng"
const routeCache = new Map<string, RouteResult>();

export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<RouteResult | null> {
  const key = `${from.lat.toFixed(4)},${from.lng.toFixed(4)}|${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const cached = routeCache.get(key);
  if (cached) return cached;

  // OSRM expects lng,lat order
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);

    const data = await res.json();
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    const geometry: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng],
    );

    const result: RouteResult = {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry,
    };
    routeCache.set(key, result);
    return result;
  } catch (err) {
    console.error('[OSRM] Failed to fetch route:', err);
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