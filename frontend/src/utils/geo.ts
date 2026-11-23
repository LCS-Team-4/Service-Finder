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

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 780px)').matches;
}

/**
 * Turn whatever Supabase/PostgREST gives us for a `geography(Point)` column
 * into [lng, lat]. Handles:
 *   - GeoJSON object   { coordinates: [lng, lat] }
 *   - WKT / EWKT       "SRID=4326;POINT(lng lat)"
 *   - EWKB hex string  "0101000020E6100000..."   <- what PostgREST returns by default
 */
export function getCoordinates(location: unknown): [number, number] | null {
  if (location && typeof location === 'object' && 'coordinates' in location) {
    const c = (location as { coordinates?: unknown }).coordinates;
    if (Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
      return [Number(c[0]), Number(c[1])];
    }
    return null;
  }
  if (typeof location !== 'string') return null;

  const wkt = location.match(/(?:SRID=\d+;)?\s*POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
  if (wkt) return [Number(wkt[1]), Number(wkt[2])];

  if (!/^[0-9a-f]+$/i.test(location) || location.length < 34) return null;
  const bytes = new Uint8Array(location.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
  const littleEndian = bytes[0] === 1;
  const view = new DataView(bytes.buffer);
  const geometryType = view.getUint32(1, littleEndian);
  const coordinateOffset = 5 + (geometryType & 0x20000000 ? 4 : 0);
  if ((geometryType & 0xff) !== 1 || bytes.length < coordinateOffset + 16) return null;
  const lng = view.getFloat64(coordinateOffset, littleEndian);
  const lat = view.getFloat64(coordinateOffset + 8, littleEndian);
  return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
}

// Appended to address searches so "19 Crescent Street" doesn't resolve to a
// different country. Change this if the app ever covers another region.
const REGION_HINT = 'Cape Town, South Africa';

/** Google Maps search for a typed address — quick "does this place exist?" check. */
export function googleMapsAddressUrl(address: string): string {
  const query = /cape town/i.test(address) ? address : `${address}, ${REGION_HINT}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Google Maps pointing at an exact coordinate. */
export function googleMapsPinUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
