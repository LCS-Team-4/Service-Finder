import type { Service } from '../types/service.types';

/**
 * Parses a PostGIS Point string, GeoJSON object, or coordinate tuple into [lat, lng].
 */
export function getCoordinates(location: any): [number, number] | null {
  if (!location) return null;

  // 1. Tuple: [lng, lat]
  if (Array.isArray(location) && location.length >= 2) {
    const [lng, lat] = location;
    if (typeof lat === 'number' && typeof lng === 'number') return [lat, lng];
  }

  // 2. GeoJSON object: { coordinates: [lng, lat] }
  if (typeof location === 'object' && location.coordinates) {
    const [lng, lat] = location.coordinates;
    if (typeof lat === 'number' && typeof lng === 'number') return [lat, lng];
  }

  // 3. PostGIS WKT string: "SRID=4326;POINT(lng lat)"
  if (typeof location === 'string') {
    const match = location.match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
    if (match) {
      const lng = Number(match[1]);
      const lat = Number(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    }
  }

  return null;
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number | undefined | null): string {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 780px)').matches;
}

/** Generates a Google Maps URL that opens the address in a new tab. */
export function googleMapsAddressUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Generates a Google Maps URL that drops a pin at exact coordinates. */
export function googleMapsPinUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}