import type { RouteResult, TravelMode } from '../types/service.types';

// Cache so we don't spam the API
const routeCache = new Map<string, RouteResult>();

const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY || '';

// ORS uses slightly different names for the profiles
const ORS_PROFILES: Record<TravelMode, string> = {
  driving: 'driving-car',
  cycling: 'cycling-regular',
  walking: 'foot-walking',
};

export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: TravelMode = 'driving',
): Promise<RouteResult | null> {
  const key = `${mode}|${from.lat.toFixed(4)},${from.lng.toFixed(4)}|${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const cached = routeCache.get(key);
  if (cached) return cached;

  const profile = ORS_PROFILES[mode];
  const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, application/geo+json',
        'Content-Type': 'application/json',
        'Authorization': ORS_API_KEY, 
      },
      body: JSON.stringify({
        coordinates: [
          [from.lng, from.lat], // ORS uses [lng, lat]
          [to.lng, to.lat]
        ]
      })
    });

    if (!res.ok) throw new Error(`ORS HTTP ${res.status}`);
    const data = await res.json();
    
    if (!data.features || data.features.length === 0) return null;

    const feature = data.features[0];
    const summary = feature.properties.summary;
    
    // ORS returns [lng, lat], Leaflet wants [lat, lng]
    const geometry: [number, number][] = feature.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );

    const result: RouteResult = {
      distanceMeters: summary.distance,
      durationSeconds: summary.duration,
      geometry,
    };
    
    routeCache.set(key, result);
    return result;
  } catch (err) {
    console.error(`[ORS] Failed to fetch ${mode} route:`, err);
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